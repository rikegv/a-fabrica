// base.ts, a peca 2 vista pela ponte: Firestore como ponto de encontro.
//
// A ponte entra como o PROPRIO DIRETOR (SDK cliente, as regras valem), sem chave
// de servico. A identidade vem de identidade.ts, que persiste a sessao em arquivo
// e deixa o SDK renovar o token sozinho.
//
// §A.6: so conexao de saida. O SDK do Firestore fala com a nuvem por saida,
// inclusive os ouvintes ao vivo, que sao conexao de saida persistente, nao porta
// de entrada. A ponte nunca abre porta.
//
// Falha fechada em tudo: erro, resposta ausente, resposta malformada ou tempo
// esgotado resultam em recusa.

import {
  addDoc,
  collection,
  connectFirestoreEmulator,
  doc,
  getFirestore,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type Firestore,
} from 'firebase/firestore';
import type { Auth } from 'firebase/auth';
import type { FirebaseApp } from 'firebase/app';
import { abrirIdentidade, type Identidade } from './identidade.js';
import { DIRETOR, VERSAO_PONTE } from './config.js';
import {
  respostaDe,
  textoDe,
  type Comando,
  type ComandoTomado,
  type DecisaoPortao,
  type EstadoFabrica,
  type Fabrica,
  type Maquina,
  type PacoteAprovacao,
  type PassoAtividade,
} from './tipos.js';

// Portas proprias da ponte, de proposito diferentes das portas padrao do Firebase:
// na maquina do diretor rodam emuladores de outros projetos, e colidir de porta
// faria um teste ler a base do projeto errado. Veja ponte/emulador/firebase.json.
const EMULADOR_FIRESTORE_HOST = process.env.PONTE_EMULADOR_FIRESTORE_HOST ?? '127.0.0.1';
const EMULADOR_FIRESTORE_PORTA = Number(process.env.PONTE_EMULADOR_FIRESTORE_PORTA ?? '8099');

export interface Base {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  identidade: Identidade;
}

export interface OpcoesBase {
  emulador?: boolean;
  colagem?: string | null;
  registrar?: (linha: string) => void;
}

/**
 * Liga a ponte na base. Sem identidade do diretor, nao sobe: abrirIdentidade
 * lanca e o motivo fica registrado, §A.6.
 */
export async function initBase(opcoes: OpcoesBase = {}): Promise<Base> {
  const identidade = await abrirIdentidade({
    emulador: opcoes.emulador === true,
    colagem: opcoes.colagem ?? null,
    ...(opcoes.registrar ? { registrar: opcoes.registrar } : {}),
  });
  const db = getFirestore(identidade.app);
  if (opcoes.emulador === true) connectFirestoreEmulator(db, EMULADOR_FIRESTORE_HOST, EMULADOR_FIRESTORE_PORTA);
  return { app: identidade.app, auth: identidade.auth, db, identidade };
}

export interface Heartbeat {
  parar(fabricasVivas?: Iterable<string>): Promise<void>;
}

/**
 * Sinal de vida da maquina. Online enquanto bate; a parada limpa marca offline e
 * passa as fabricas vivas para ponte offline, para o painel nao mentir, §A.10.
 */
export function iniciarHeartbeat(
  db: Firestore,
  maquinaId: string,
  dados: Partial<Maquina> = {},
  intervaloMs = 15000
): Heartbeat {
  const ref = doc(db, 'maquinas', maquinaId);
  const bater = (): void => {
    void setDoc(
      ref,
      { maquinaId, estadoPonte: 'online', vistoPorUltimo: serverTimestamp(), versaoPonte: VERSAO_PONTE, ...dados },
      { merge: true }
    ).catch(() => undefined);
  };
  bater();
  const t = setInterval(bater, intervaloMs);
  return {
    parar: async (fabricasVivas: Iterable<string> = []): Promise<void> => {
      clearInterval(t);
      for (const fabricaId of fabricasVivas) {
        await atualizarFabrica(db, fabricaId, { estado: 'ponte offline' }).catch(() => undefined);
      }
      await setDoc(ref, { estadoPonte: 'offline', vistoPorUltimo: serverTimestamp() }, { merge: true }).catch(
        () => undefined
      );
    },
  };
}

export function atualizarFabrica(db: Firestore, fabricaId: string, dados: Partial<Fabrica>): Promise<void> {
  return setDoc(doc(db, 'fabricas', fabricaId), { fabricaId, atualizadoEm: serverTimestamp(), ...dados }, { merge: true });
}

export function publicarAtividade(
  db: Firestore,
  fabricaId: string,
  passo: Omit<PassoAtividade, 'em'>
): Promise<unknown> {
  return addDoc(collection(db, 'fabricas', fabricaId, 'atividade'), { ...passo, em: serverTimestamp() });
}

export function publicarAprovacao(
  db: Firestore,
  aprovacaoId: string,
  dados: { fabricaId: string; maquinaId: string; pacote: PacoteAprovacao; origem: string }
): Promise<void> {
  return setDoc(doc(db, 'aprovacoes', aprovacaoId), {
    aprovacaoId,
    situacao: 'pendente',
    resposta: null,
    observacao: null,
    respondidoEm: null,
    respondidoPor: null,
    criadoEm: serverTimestamp(),
    ...dados,
  });
}

/**
 * Espera a resposta do diretor, vinda da base. Falha fechada: erro ao ouvir,
 * resposta malformada ou tempo esgotado resultam em recusa.
 */
export function esperarResposta(db: Firestore, aprovacaoId: string, limiteMs = 300000): Promise<DecisaoPortao> {
  return new Promise<DecisaoPortao>((resolve) => {
    let resolvido = false;
    let desligar: (() => void) | null = null;
    const relogio = setTimeout(() => fim({ decisao: 'deny', resposta: 'sem resposta no tempo' }), limiteMs);
    const fim = (r: DecisaoPortao): void => {
      if (resolvido) return;
      resolvido = true;
      clearTimeout(relogio);
      try {
        desligar?.();
      } catch {
        // ouvinte ja desligado
      }
      resolve(r);
    };
    desligar = onSnapshot(
      doc(db, 'aprovacoes', aprovacaoId),
      (snap) => {
        const dado: unknown = snap.data();
        if (textoDe(dado, 'situacao') !== 'respondida') return;
        const resposta = respostaDe(
          typeof dado === 'object' && dado !== null ? (dado as Record<string, unknown>)['resposta'] : null
        );
        if (resposta === 'aprovado' || resposta === 'aprovado com observacao') {
          fim({ decisao: 'allow', resposta, observacao: textoDe(dado, 'observacao') });
          return;
        }
        if (resposta === 'recusado') {
          fim({ decisao: 'deny', resposta: 'recusado' });
          return;
        }
        // Respondida com resposta que a ponte nao reconhece: recusa, falha fechada.
        fim({ decisao: 'deny', resposta: 'resposta malformada, recusado por seguranca' });
      },
      () => fim({ decisao: 'deny', resposta: 'erro ao ouvir a base, recusado por seguranca' })
    );
  });
}

/**
 * Entrega de comando com idempotencia: numa transacao marca entregue antes de
 * executar. Se a conexao cair, o comando continua pendente e e reentregue; o
 * marcador impede executar duas vezes.
 */
export async function tomarComando(db: Firestore, comandoId: string): Promise<ComandoTomado | null> {
  const ref = doc(db, 'comandos', comandoId);
  try {
    return await runTransaction<ComandoTomado | null>(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) return null;
      const dado: unknown = snap.data();
      if (textoDe(dado, 'situacao') !== 'pendente') return null; // ja entregue, nao executa de novo
      const texto = textoDe(dado, 'texto');
      if (texto === null) return null; // comando sem texto: nao executa
      tx.update(ref, { situacao: 'entregue', entregueEm: serverTimestamp() });
      return {
        id: comandoId,
        fabricaId: textoDe(dado, 'fabricaId'),
        texto,
        cwd: textoDe(dado, 'cwd'),
        conversationId: textoDe(dado, 'conversationId'),
      };
    });
  } catch {
    return null; // falha fechada: nao executa o que nao conseguiu marcar
  }
}

export function ouvirComandos(
  db: Firestore,
  maquinaId: string,
  aoChegar: (comandoId: string) => void
): () => void {
  const q = query(
    collection(db, 'comandos'),
    where('maquinaId', '==', maquinaId),
    where('situacao', '==', 'pendente')
  );
  return onSnapshot(
    q,
    (snap) => {
      snap.forEach((docSnap) => aoChegar(docSnap.id));
    },
    () => undefined
  );
}

/**
 * Reconciliacao no reinicio. Pedido de aprovacao pendente de uma sessao que nao
 * existe mais vira recusado por seguranca, com trilha. Nada executou, e o painel
 * nao mostra pedido fantasma nem perde pedido real. Fabrica que ficou marcada em
 * execucao sem sessao viva passa a ponte offline.
 */
export async function reconciliarPendentes(
  db: Firestore,
  maquinaId: string,
  sessoesVivas: Set<string>
): Promise<{ aprovacoesRecusadas: number; fabricasMarcadasOffline: number }> {
  const aprovacoesRecusadas = await new Promise<number>((resolve) => {
    const q = query(
      collection(db, 'aprovacoes'),
      where('maquinaId', '==', maquinaId),
      where('situacao', '==', 'pendente')
    );
    const off = onSnapshot(
      q,
      async (snap) => {
        off();
        let n = 0;
        for (const s of snap.docs) {
          const fabricaId = textoDe(s.data(), 'fabricaId');
          if (fabricaId !== null && !sessoesVivas.has(fabricaId)) {
            await updateDoc(s.ref, {
              situacao: 'respondida',
              resposta: 'recusado',
              observacao: 'ponte reiniciou, sessao encerrada, recusa por seguranca',
              respondidoEm: serverTimestamp(),
              respondidoPor: `ponte, reconciliacao, ${DIRETOR}`,
            }).catch(() => undefined);
            n++;
          }
        }
        resolve(n);
      },
      () => resolve(0)
    );
  });

  const fabricasMarcadasOffline = await new Promise<number>((resolve) => {
    const q = query(
      collection(db, 'fabricas'),
      where('maquinaId', '==', maquinaId),
      where('estado', '==', 'em execucao')
    );
    const off = onSnapshot(
      q,
      async (snap) => {
        off();
        let n = 0;
        for (const s of snap.docs) {
          const fabricaId = textoDe(s.data(), 'fabricaId') ?? s.id;
          if (!sessoesVivas.has(fabricaId)) {
            const estado: EstadoFabrica = 'ponte offline';
            await atualizarFabrica(db, fabricaId, { estado }).catch(() => undefined);
            n++;
          }
        }
        resolve(n);
      },
      () => resolve(0)
    );
  });

  return { aprovacoesRecusadas, fabricasMarcadasOffline };
}

/** Pedidos de aprovacao pendentes desta maquina, sem responder nada. Para prova e painel. */
export function contarPendentes(db: Firestore, maquinaId: string): Promise<number> {
  return new Promise<number>((resolve) => {
    const q = query(
      collection(db, 'aprovacoes'),
      where('maquinaId', '==', maquinaId),
      where('situacao', '==', 'pendente')
    );
    const off = onSnapshot(
      q,
      (snap) => {
        off();
        resolve(snap.size);
      },
      () => resolve(0)
    );
  });
}

export type { Comando };
export { DIRETOR };
