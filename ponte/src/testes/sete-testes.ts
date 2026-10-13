// sete-testes.ts, o executor dos sete testes ao vivo da OST 6.
//
// O que ele prova, de ponta a ponta, com a ponte de verdade rodando como servico
// em processo separado e com SESSAO VIVA do Claude Code:
//   1. abrir fabrica pela ponte e a atividade chegando na base ao vivo;
//   2. comando gravado na base e a fabrica executando;
//   3. pedido de aprovacao chegando na base com o pacote completo, aprovado pela
//      base, e o comando executando;
//   4. o mesmo recusado, e nada executando;
//   5. conexao caindo no meio, nada perdido, nada executado duas vezes;
//   6. ponte parada, estado virando ponte offline na base;
//   7. pedido pendente sobrevivendo a reinicio da ponte.
//
// ONDE APONTA: uma UNICA variavel de ambiente decide, sem mudar codigo.
//   PONTE_EMULADOR=1  base no emulador do Firebase (Firestore e Auth locais)
//   sem a variavel     BASE REAL, projeto a-fabrica-soulan
// O emulador substitui SO a base. O Claude Code e sempre de verdade, sessao viva.
//
// REGRAS OPERACIONAIS cumpridas aqui:
//   §A.17 cada rodada tem a sua pasta nova, com data e hora no nome. Nada e
//         sobrescrito, nada e apagado.
//   §A.19 a fila de pedidos e respostas vive dentro da pasta da rodada.
//   §A.6  so conexao de saida. O executor nao abre porta nenhuma.
//   Nenhum projeto real do diretor serve de cobaia: as fabricas rodam numa pasta
//   de projeto criada dentro da propria rodada.

import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  collection,
  disableNetwork,
  doc,
  enableNetwork,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore';
import { initBase, tomarComando } from '../base.js';
import { DIRETOR } from '../config.js';
import type { RespostaAprovacao } from '../tipos.js';

const EMULADOR = process.env.PONTE_EMULADOR === '1';
const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ_PONTE = join(AQUI, '..', '..');
const SERVICO = join(AQUI, '..', 'ponte.js');

function selo(): string {
  const d = new Date();
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}`;
}

const RODADA = join(
  'C:\\Users\\Henrique\\a-fabrica-lab\\rodadas',
  `${selo()}-ost6-sete-testes-${EMULADOR ? 'emulador' : 'base-real'}`
);
const FILA = join(RODADA, 'fila');
const PROJETO = join(RODADA, 'projeto-cc');
const SAIDA = join(RODADA, 'saida.txt');
const MAQUINA = `maquina-teste-${selo().replace(/[:T-]/g, '')}`;

mkdirSync(FILA, { recursive: true });
mkdirSync(PROJETO, { recursive: true });

function reg(linha: string): void {
  const texto = `${new Date().toISOString()} ${linha}`;
  console.log(texto);
  appendFileSync(SAIDA, `${texto}\n`, 'utf8');
}

function dormir(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Espera uma condicao do lado de quem le, sem depender de estado velho na base. */
async function esperarCondicao(condicao: () => boolean, limiteMs: number, rotulo: string): Promise<boolean> {
  const limite = Date.now() + limiteMs;
  while (Date.now() < limite) {
    if (condicao()) {
      reg(`${rotulo}: condicao atendida`);
      return true;
    }
    await dormir(500);
  }
  reg(`${rotulo}: tempo esgotado`);
  return false;
}

// ---------------------------------------------------------------------------
// A ponte de verdade, como servico em processo separado
// ---------------------------------------------------------------------------

interface PonteViva {
  filho: ChildProcessWithoutNullStreams;
  rotulo: string;
  saida: string[];
  pararLimpo(): Promise<void>;
  matarSeco(): Promise<void>;
}

async function subirPonte(rotulo: string): Promise<PonteViva> {
  const log = join(RODADA, `servico-${rotulo}.log`);
  const ambiente: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined) ambiente[k] = v;
  ambiente['PONTE_MAQUINA_ID'] = MAQUINA;
  ambiente['PONTE_CWD'] = PROJETO;
  if (EMULADOR) ambiente['PONTE_EMULADOR'] = '1';
  else delete ambiente['PONTE_EMULADOR'];

  const filho = spawn(process.execPath, [SERVICO], {
    cwd: RAIZ_PONTE,
    env: ambiente,
    stdio: ['pipe', 'pipe', 'pipe'],
  }) as ChildProcessWithoutNullStreams;

  const saida: string[] = [];
  const guardar = (d: Buffer): void => {
    const t = d.toString('utf8');
    appendFileSync(log, t, 'utf8');
    for (const linha of t.split('\n')) if (linha.trim().length > 0) saida.push(linha.trim());
  };
  filho.stdout.on('data', guardar);
  filho.stderr.on('data', guardar);

  const ponte: PonteViva = {
    filho,
    rotulo,
    saida,
    pararLimpo: async (): Promise<void> => {
      if (filho.exitCode !== null) return;
      filho.stdin.write('parar\n');
      await new Promise<void>((resolve) => {
        const relogio = setTimeout(resolve, 20000);
        filho.once('exit', () => {
          clearTimeout(relogio);
          resolve();
        });
      });
    },
    matarSeco: async (): Promise<void> => {
      if (filho.exitCode !== null) return;
      filho.kill('SIGKILL');
      await new Promise<void>((resolve) => {
        const relogio = setTimeout(resolve, 10000);
        filho.once('exit', () => {
          clearTimeout(relogio);
          resolve();
        });
      });
    },
  };

  const noAr = await new Promise<boolean>((resolve) => {
    const relogio = setTimeout(() => resolve(false), 90000);
    const conferir = (): void => {
      if (saida.some((l) => /ponte no ar/.test(l))) {
        clearTimeout(relogio);
        resolve(true);
      }
    };
    filho.stdout.on('data', conferir);
    filho.stderr.on('data', conferir);
    filho.once('exit', () => {
      clearTimeout(relogio);
      resolve(saida.some((l) => /ponte no ar/.test(l)));
    });
  });
  reg(`ponte ${rotulo}: ${noAr ? 'no ar' : 'NAO SUBIU'} (log em ${log})`);
  if (!noAr) throw new Error(`a ponte ${rotulo} nao subiu. Veja ${log}`);
  return ponte;
}

// ---------------------------------------------------------------------------
// O lado do painel: escrever comando, ouvir, responder aprovacao
// ---------------------------------------------------------------------------

async function escreverComando(
  db: Firestore,
  dados: { fabricaId: string; texto: string; conversationId?: string | null }
): Promise<string> {
  const comandoId = randomUUID();
  await setDoc(doc(db, 'comandos', comandoId), {
    comandoId,
    fabricaId: dados.fabricaId,
    maquinaId: MAQUINA,
    texto: dados.texto,
    situacao: 'pendente',
    criadoEm: serverTimestamp(),
    origem: `painel de teste, ${DIRETOR}`,
    cwd: PROJETO,
    conversationId: dados.conversationId ?? null,
    entregueEm: null,
  });
  reg(`comando ${comandoId} gravado na base para a fabrica ${dados.fabricaId}`);
  return comandoId;
}

function esperarDoc(
  db: Firestore,
  caminho: string[],
  condicao: (d: DocumentData) => boolean,
  limiteMs: number,
  rotulo: string
): Promise<DocumentData | null> {
  return new Promise((resolve) => {
    let pronto = false;
    const ref = doc(db, caminho[0] as string, ...(caminho.slice(1) as string[]));
    const relogio = setTimeout(() => fim(null), limiteMs);
    const fim = (d: DocumentData | null): void => {
      if (pronto) return;
      pronto = true;
      clearTimeout(relogio);
      try {
        off();
      } catch {
        // ouvinte ja desligado
      }
      resolve(d);
    };
    const off = onSnapshot(
      ref,
      (snap) => {
        const d = snap.data();
        if (d && condicao(d)) {
          reg(`${rotulo}: condicao atendida, estado na base ${JSON.stringify(d['estado'] ?? d['situacao'] ?? '')}`);
          fim(d);
        }
      },
      (e) => {
        reg(`${rotulo}: erro ao ouvir, ${String(e)}`);
        fim(null);
      }
    );
  });
}

interface EventoRecebido {
  recebidoEm: string;
  seq: number;
  tipo: string;
  ferramenta: string | null;
}

interface EscutaAtividade {
  eventos: EventoRecebido[];
  parar(): void;
}

function ouvirAtividade(db: Firestore, fabricaId: string): EscutaAtividade {
  const eventos: EventoRecebido[] = [];
  const vistos = new Set<string>();
  const off = onSnapshot(
    collection(db, 'fabricas', fabricaId, 'atividade'),
    (snap) => {
      snap.docChanges().forEach((mudanca) => {
        if (mudanca.type !== 'added' || vistos.has(mudanca.doc.id)) return;
        vistos.add(mudanca.doc.id);
        const d = mudanca.doc.data();
        eventos.push({
          recebidoEm: new Date().toISOString(),
          seq: typeof d['seq'] === 'number' ? d['seq'] : -1,
          tipo: typeof d['tipo'] === 'string' ? d['tipo'] : '?',
          ferramenta: typeof d['ferramenta'] === 'string' ? d['ferramenta'] : null,
        });
      });
    },
    () => undefined
  );
  return { eventos, parar: off };
}

interface PedidoVisto {
  aprovacaoId: string;
  dados: DocumentData;
}

function esperarAprovacaoPendente(db: Firestore, limiteMs: number): Promise<PedidoVisto | null> {
  return new Promise((resolve) => {
    let pronto = false;
    const q = query(
      collection(db, 'aprovacoes'),
      where('maquinaId', '==', MAQUINA),
      where('situacao', '==', 'pendente')
    );
    const relogio = setTimeout(() => fim(null), limiteMs);
    const fim = (p: PedidoVisto | null): void => {
      if (pronto) return;
      pronto = true;
      clearTimeout(relogio);
      try {
        off();
      } catch {
        // ouvinte ja desligado
      }
      resolve(p);
    };
    const off = onSnapshot(
      q,
      (snap) => {
        const primeiro = snap.docs[0];
        if (primeiro) {
          const visto: PedidoVisto = { aprovacaoId: primeiro.id, dados: primeiro.data() };
          // §A.19: o pedido fica guardado na fila desta rodada.
          writeFileSync(join(FILA, `pedido-${primeiro.id}.json`), JSON.stringify(visto.dados, null, 2), 'utf8');
          fim(visto);
        }
      },
      () => fim(null)
    );
  });
}

async function responder(
  db: Firestore,
  aprovacaoId: string,
  resposta: RespostaAprovacao,
  observacao: string | null = null
): Promise<void> {
  await updateDoc(doc(db, 'aprovacoes', aprovacaoId), {
    situacao: 'respondida',
    resposta,
    observacao,
    respondidoEm: serverTimestamp(),
    respondidoPor: `painel de teste, ${DIRETOR}`,
  });
  writeFileSync(
    join(FILA, `resposta-${aprovacaoId}.json`),
    JSON.stringify({ aprovacaoId, resposta, observacao, respondidoEm: new Date().toISOString() }, null, 2),
    'utf8'
  );
  reg(`resposta ${resposta} gravada na base para o pedido ${aprovacaoId}`);
}

const CAMPOS_DO_PACOTE = [
  'marcacao',
  'oQue',
  'ferramenta',
  'tarefa',
  'fabrica',
  'agenteDisse',
  'porQue',
  'impacto',
  'oQueSeraTocado',
  'risco',
  'tempoParadoMs',
];

function conferirPacote(dados: DocumentData): string[] {
  const faltando: string[] = [];
  const pacote = dados['pacote'];
  if (typeof pacote !== 'object' || pacote === null) return ['pacote'];
  const p = pacote as Record<string, unknown>;
  for (const campo of CAMPOS_DO_PACOTE) {
    const v = p[campo];
    if (v === undefined || v === null) faltando.push(campo);
    else if (campo !== 'marcacao' && (typeof v !== 'object' || !('valor' in (v as object)) || !('origem' in (v as object)))) {
      faltando.push(`${campo} sem valor ou sem origem`);
    }
  }
  if (typeof dados['origem'] !== 'string') faltando.push('origem do pedido');
  if (dados['criadoEm'] === undefined || dados['criadoEm'] === null) faltando.push('criadoEm');
  return faltando;
}

// ---------------------------------------------------------------------------
// Os sete testes
// ---------------------------------------------------------------------------

interface Resultado {
  numero: number;
  nome: string;
  passou: boolean;
  detalhe: string;
}

async function principal(): Promise<void> {
  reg(`rodada em ${RODADA}`);
  reg(`base ${EMULADOR ? 'NO EMULADOR (Firestore e Auth locais)' : 'REAL, projeto a-fabrica-soulan'}`);
  reg('Claude Code sempre de verdade, sessao viva, nunca simulado');
  reg(`maquina de teste ${MAQUINA}, pasta de projeto das fabricas ${PROJETO}`);

  const base = await initBase({ emulador: EMULADOR, registrar: (l) => reg(`[identidade do executor] ${l}`) });
  const db = base.db;
  reg(`executor entrou na base como ${base.identidade.usuario.email}, degrau ${base.identidade.degrau}`);

  const resultados: Resultado[] = [];
  const anotar = (r: Resultado): void => {
    resultados.push(r);
    reg(`TESTE ${r.numero} ${r.passou ? 'PASSOU' : 'FALHOU'}: ${r.nome}. ${r.detalhe}`);
  };

  let ponte = await subirPonte('a');

  // ---- Teste 1 ------------------------------------------------------------
  const f1 = `f1-${randomUUID().slice(0, 8)}`;
  const escuta1 = ouvirAtividade(db, f1);
  const c1 = await escreverComando(db, {
    fabricaId: f1,
    texto: 'Responda apenas com a palavra PRONTO. Nao use nenhuma ferramenta.',
  });
  const entregue1 = await esperarDoc(db, ['comandos', c1], (d) => d['situacao'] === 'entregue', 240000, 'comando 1');
  const fim1 = await esperarDoc(
    db,
    ['fabricas', f1],
    (d) => d['estado'] === 'concluida' || d['estado'] === 'falhou',
    420000,
    'fabrica 1'
  );
  const momentoFim1 = Date.now();
  await dormir(2500);
  escuta1.parar();
  const antesDoFim = escuta1.eventos.filter((e) => Date.parse(e.recebidoEm) < momentoFim1).length;
  const chegouAoVivo = antesDoFim > 0;
  writeFileSync(join(RODADA, 'teste1-atividade.json'), JSON.stringify(escuta1.eventos, null, 2), 'utf8');
  anotar({
    numero: 1,
    nome: 'abrir fabrica pela ponte e a atividade chegando na base ao vivo',
    passou:
      entregue1 !== null &&
      fim1 !== null &&
      fim1['estado'] === 'concluida' &&
      escuta1.eventos.length > 0 &&
      escuta1.eventos.some((e) => e.tipo === 'init') &&
      chegouAoVivo,
    detalhe:
      `comando entregue ${entregue1 !== null}, estado final ${String(fim1?.['estado'])}, ` +
      `${escuta1.eventos.length} evento(s) de atividade na base, ${antesDoFim} deles chegaram ao vivo, antes do fim, ` +
      `evento init presente ${escuta1.eventos.some((e) => e.tipo === 'init')}, consumo ${JSON.stringify(fim1?.['consumo'] ?? null).slice(0, 80)}`,
  });

  // ---- Teste 2 ------------------------------------------------------------
  const fabrica1 = await getDoc(doc(db, 'fabricas', f1));
  const conversa1 = fabrica1.data()?.['conversationId'];
  const escuta2 = ouvirAtividade(db, f1);
  await dormir(2000); // deixa a escuta carregar o que ja existia, para nao contar duas vezes
  const antes2 = escuta2.eventos.length;
  const finsAntes = escuta2.eventos.filter((e) => e.tipo === 'fim').length;
  const c2 = await escreverComando(db, {
    fabricaId: f1,
    texto: 'Responda apenas com a palavra DOIS. Nao use nenhuma ferramenta.',
    conversationId: typeof conversa1 === 'string' ? conversa1 : null,
  });
  const entregue2 = await esperarDoc(db, ['comandos', c2], (d) => d['situacao'] === 'entregue', 240000, 'comando 2');
  // Nao vale olhar o estado da fabrica, que ja estava concluida do comando anterior:
  // o que prova a execucao e atividade NOVA, com um novo fim, depois deste comando.
  const executou2 = await esperarCondicao(
    () => escuta2.eventos.filter((e) => e.tipo === 'fim').length > finsAntes,
    420000,
    'fabrica 1, segunda execucao'
  );
  await dormir(2500);
  escuta2.parar();
  const fabricaDepois2 = await getDoc(doc(db, 'fabricas', f1));
  const estado2 = fabricaDepois2.data()?.['estado'];
  writeFileSync(join(RODADA, 'teste2-atividade.json'), JSON.stringify(escuta2.eventos, null, 2), 'utf8');
  anotar({
    numero: 2,
    nome: 'comando gravado na base e a fabrica executando',
    passou: entregue2 !== null && executou2 && estado2 === 'concluida',
    detalhe:
      `comando entregue ${entregue2 !== null}, retomou a conversa ${String(conversa1).slice(0, 12)}, ` +
      `atividade nova depois do comando: ${escuta2.eventos.length - antes2} evento(s), ` +
      `novo evento de fim: ${executou2}, estado final ${String(estado2)}`,
  });

  // ---- Teste 3 ------------------------------------------------------------
  const f3 = `f3-${randomUUID().slice(0, 8)}`;
  const alvo3 = join(PROJETO, 'aprovado.txt');
  const c3 = await escreverComando(db, {
    fabricaId: f3,
    texto: `Usando a ferramenta de escrita, crie o arquivo ${alvo3} com o conteudo ok. Depois responda apenas FEITO.`,
  });
  const pedido3 = await esperarAprovacaoPendente(db, 420000);
  const faltando3 = pedido3 ? conferirPacote(pedido3.dados) : ['pedido nao chegou'];
  if (pedido3) await responder(db, pedido3.aprovacaoId, 'aprovado');
  const fim3 = await esperarDoc(
    db,
    ['fabricas', f3],
    (d) => d['estado'] === 'concluida' || d['estado'] === 'falhou',
    420000,
    'fabrica 3'
  );
  const criou3 = existsSync(alvo3);
  anotar({
    numero: 3,
    nome: 'pedido de aprovacao com pacote completo, aprovado pela base, e o comando executando',
    passou: pedido3 !== null && faltando3.length === 0 && criou3,
    detalhe:
      `comando ${c3.slice(0, 8)}, pedido ${pedido3?.aprovacaoId.slice(0, 8) ?? 'nao chegou'}, ` +
      `campos faltando no pacote: ${faltando3.length === 0 ? 'nenhum' : faltando3.join(', ')}, ` +
      `arquivo criado ${criou3}, estado final ${String(fim3?.['estado'])}`,
  });

  // ---- Teste 4 ------------------------------------------------------------
  const f4 = `f4-${randomUUID().slice(0, 8)}`;
  const alvo4 = join(PROJETO, 'recusado.txt');
  await escreverComando(db, {
    fabricaId: f4,
    texto: `Usando a ferramenta de escrita, crie o arquivo ${alvo4} com o conteudo nao deveria existir. Depois responda apenas FEITO.`,
  });
  const pedido4 = await esperarAprovacaoPendente(db, 420000);
  if (pedido4) await responder(db, pedido4.aprovacaoId, 'recusado', 'recusado no teste 4');
  const fim4 = await esperarDoc(
    db,
    ['fabricas', f4],
    (d) => d['estado'] === 'concluida' || d['estado'] === 'falhou',
    420000,
    'fabrica 4'
  );
  await dormir(3000);
  const criou4 = existsSync(alvo4);
  anotar({
    numero: 4,
    nome: 'pedido recusado pela base, e nada executando',
    passou: pedido4 !== null && !criou4,
    detalhe:
      `pedido ${pedido4?.aprovacaoId.slice(0, 8) ?? 'nao chegou'} recusado, ` +
      `arquivo ${alvo4} existe: ${criou4} (tem de ser false), estado final ${String(fim4?.['estado'])}`,
  });

  // ---- Teste 5 ------------------------------------------------------------
  // Parte a: a ponte cai de forma seca, o comando e gravado com a ponte fora do ar
  // e nao se perde. Parte b: a conexao do lado que le cai no meio da execucao e
  // nada de atividade se perde. Parte c: o comando nao e executado duas vezes.
  await ponte.matarSeco();
  reg('ponte morta de forma seca, sem parada limpa, para simular queda');
  const f5 = `f5-${randomUUID().slice(0, 8)}`;
  const c5 = await escreverComando(db, {
    fabricaId: f5,
    texto: 'Responda apenas com a palavra CINCO. Nao use nenhuma ferramenta.',
  });
  await dormir(8000);
  const c5Parado = await getDoc(doc(db, 'comandos', c5));
  const continuouPendente = c5Parado.data()?.['situacao'] === 'pendente';
  reg(`com a ponte fora do ar, o comando ${c5.slice(0, 8)} continua pendente: ${continuouPendente}`);

  const escuta5 = ouvirAtividade(db, f5);
  ponte = await subirPonte('b');
  await dormir(1500);
  reg('derrubando a conexao do lado que le, no meio da execucao');
  await disableNetwork(db);
  await dormir(6000);
  await enableNetwork(db);
  reg('conexao do lado que le restabelecida');
  const entregue5 = await esperarDoc(db, ['comandos', c5], (d) => d['situacao'] === 'entregue', 300000, 'comando 5');
  const fim5 = await esperarDoc(
    db,
    ['fabricas', f5],
    (d) => d['estado'] === 'concluida' || d['estado'] === 'falhou',
    420000,
    'fabrica 5'
  );
  await dormir(3000);
  escuta5.parar();
  writeFileSync(join(RODADA, 'teste5-atividade.json'), JSON.stringify(escuta5.eventos, null, 2), 'utf8');
  const seqs = escuta5.eventos.map((e) => e.seq).sort((a, b) => a - b);
  const semBuraco = seqs.every((s, i) => s === i);
  const inits = escuta5.eventos.filter((e) => e.tipo === 'init').length;
  const segundaEntrega = await tomarComando(db, c5); // tem de dar null: ja entregue
  anotar({
    numero: 5,
    nome: 'conexao caindo no meio, nada perdido, nada executado duas vezes',
    passou: continuouPendente && entregue5 !== null && fim5 !== null && semBuraco && inits === 1 && segundaEntrega === null,
    detalhe:
      `comando sobreviveu a ponte fora do ar: ${continuouPendente}; ` +
      `atividade com sequencia sem buraco: ${semBuraco} (${seqs.length} evento(s), sequencia ${seqs.join(',')}); ` +
      `aberturas da fabrica: ${inits} (tem de ser 1); segunda tentativa de entrega do mesmo comando devolveu ` +
      `${segundaEntrega === null ? 'null, nao executa de novo' : 'comando, o que seria falha'}; ` +
      `estado final ${String(fim5?.['estado'])}`,
  });

  // ---- Teste 6 ------------------------------------------------------------
  // Fabrica parada esperando aprovacao, ponte parada, a base deixa de mentir.
  const f6 = `f6-${randomUUID().slice(0, 8)}`;
  const alvo6 = join(PROJETO, 'sobrevivente.txt');
  await escreverComando(db, {
    fabricaId: f6,
    texto: `Usando a ferramenta de escrita, crie o arquivo ${alvo6} com o conteudo seis. Depois responda apenas FEITO.`,
  });
  const pedido6 = await esperarAprovacaoPendente(db, 420000);
  reg(`pedido ${pedido6?.aprovacaoId ?? 'nao chegou'} esta pendente, ninguem respondeu`);
  const antesDeParar = await getDoc(doc(db, 'maquinas', MAQUINA));
  reg(`maquina antes de parar: ${JSON.stringify(antesDeParar.data()?.['estadoPonte'])}`);
  await ponte.pararLimpo();
  await dormir(4000);
  const maquina6 = await getDoc(doc(db, 'maquinas', MAQUINA));
  const fabrica6 = await getDoc(doc(db, 'fabricas', f6));
  const estadoPonte6 = maquina6.data()?.['estadoPonte'];
  const estadoFabrica6 = fabrica6.data()?.['estado'];
  anotar({
    numero: 6,
    nome: 'ponte parada, estado virando ponte offline na base',
    passou: estadoPonte6 === 'offline' && estadoFabrica6 === 'ponte offline',
    detalhe:
      `maquinas/${MAQUINA}.estadoPonte = ${String(estadoPonte6)} (tem de ser offline), ` +
      `fabricas/${f6}.estado = ${String(estadoFabrica6)} (tem de ser ponte offline)`,
  });

  // ---- Teste 7 ------------------------------------------------------------
  const antes7 = pedido6 ? await getDoc(doc(db, 'aprovacoes', pedido6.aprovacaoId)) : null;
  const sobreviveu = antes7?.data()?.['situacao'] === 'pendente';
  reg(`com a ponte parada, o pedido continua pendente na base: ${sobreviveu}`);
  ponte = await subirPonte('c');
  const depois7 = pedido6
    ? await esperarDoc(db, ['aprovacoes', pedido6.aprovacaoId], (d) => d['situacao'] === 'respondida', 120000, 'pedido do teste 6')
    : null;
  const criou6 = existsSync(alvo6);
  const resposta7 = depois7?.['resposta'];
  anotar({
    numero: 7,
    nome: 'pedido pendente sobrevivendo a reinicio da ponte',
    passou: sobreviveu && depois7 !== null && resposta7 === 'recusado' && !criou6,
    detalhe:
      `pedido sobreviveu a parada: ${sobreviveu}; depois do reinicio a ponte resolveu como ${String(resposta7)} ` +
      `com a trilha ${JSON.stringify(depois7?.['observacao'] ?? null)}; ` +
      `o arquivo que o agente queria escrever existe: ${criou6} (tem de ser false, nada executou sem resposta do diretor)`,
  });

  await ponte.pararLimpo();

  // ---- Fechamento --------------------------------------------------------
  const todos = await getDocs(query(collection(db, 'aprovacoes'), where('maquinaId', '==', MAQUINA)));
  writeFileSync(
    join(FILA, 'aprovacoes-da-rodada.json'),
    JSON.stringify(
      todos.docs.map((d) => ({ id: d.id, ...d.data() })),
      null,
      2
    ),
    'utf8'
  );

  const passaram = resultados.filter((r) => r.passou).length;
  reg('');
  reg(`RESUMO: ${passaram} de ${resultados.length} testes passaram`);
  for (const r of resultados) reg(`  teste ${r.numero}: ${r.passou ? 'PASSOU' : 'FALHOU'}, ${r.nome}`);
  reg(
    EMULADOR
      ? 'ROTULO HONESTO: base no emulador, sessao do Claude Code viva. NAO E o teste ao vivo contra a base real que a OST pede.'
      : 'ROTULO: base REAL do projeto a-fabrica-soulan, sessao do Claude Code viva. Este e o teste ao vivo que a OST pede.'
  );
  writeFileSync(join(RODADA, 'resultados.json'), JSON.stringify({ emulador: EMULADOR, maquina: MAQUINA, resultados }, null, 2), 'utf8');
  process.exit(passaram === resultados.length ? 0 : 1);
}

principal().catch((e: unknown) => {
  reg(`executor quebrou: ${e instanceof Error ? `${e.message}\n${e.stack ?? ''}` : String(e)}`);
  process.exit(1);
});
