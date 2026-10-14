// prova-tempo-esgotado.ts, a ressalva 4 da seguranca posta a prova.
//
// O problema que esta prova cobre, nas palavras da auditoria: quando o tempo de
// espera da aprovacao esgota, a ponte recusa, mas o pedido ficava com situacao
// pendente na base. Ou seja, a recusa por tempo nao deixava trilha, e uma resposta
// tardia do diretor gravaria "aprovado" num pedido que nunca executou.
//
// O que esta prova faz, de ponta a ponta, com a ponte de verdade em processo
// separado e o Claude Code vivo:
//   1. manda um comando que obriga o agente a pedir aprovacao de escrita;
//   2. NAO responde o pedido, de proposito;
//   3. espera o tempo esgotar;
//   4. confere na base que o pedido ficou respondida, recusado, com respondidoPor
//      dizendo que foi a ponte por tempo esgotado, e com a hora do servidor;
//   5. confere que o arquivo que o agente queria escrever NAO existe;
//   6. confere que, depois disso, uma resposta tardia do diretor e NEGADA pela
//      regra publicada, porque o pedido ja esta decidido.
//
// Onde aponta: PONTE_EMULADOR=1 vai para o emulador, sem a variavel vai para a
// BASE REAL do projeto a-fabrica-soulan, §A.20.
//
// §A.17 pasta propria da rodada, datada. §A.19 a fila vive dentro dela.

import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore';
import { initBase } from '../base.js';
import { DIRETOR } from '../config.js';

const EMULADOR = process.env.PONTE_EMULADOR === '1';
const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ_PONTE = join(AQUI, '..', '..');
const SERVICO = join(AQUI, '..', 'ponte.js');
/** Prazo curto so para a prova. Na vida real vale o padrao de cinco minutos. */
const LIMITE_MS = 25000;

function selo(): string {
  const d = new Date();
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}`;
}

const RODADA = join(
  'C:\\Users\\Henrique\\a-fabrica-lab\\rodadas',
  `${selo()}-ost6-tempo-esgotado-${EMULADOR ? 'emulador' : 'base-real'}`
);
const FILA = join(RODADA, 'fila');
const PROJETO = join(RODADA, 'projeto-cc');
const SAIDA = join(RODADA, 'saida.txt');
const MAQUINA = `maquina-teste-tempo-${selo().replace(/[:T-]/g, '')}`;
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

async function subirPonte(): Promise<ChildProcessWithoutNullStreams> {
  const log = join(RODADA, 'servico-ponte.log');
  const ambiente: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined) ambiente[k] = v;
  ambiente['PONTE_MAQUINA_ID'] = MAQUINA;
  ambiente['PONTE_CWD'] = PROJETO;
  ambiente['PONTE_LIMITE_APROVACAO_MS'] = String(LIMITE_MS);
  // Fila de atividade desta rodada dentro da rodada, para a ponte de teste nao
  // publicar as sessoes de verdade do diretor com o carimbo desta maquina falsa.
  ambiente['PONTE_PASTA_FILA_GANCHOS'] = join(RODADA, 'fila-de-ganchos-da-rodada');
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
    for (const l of t.split('\n')) if (l.trim()) saida.push(l.trim());
  };
  filho.stdout.on('data', guardar);
  filho.stderr.on('data', guardar);
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
      resolve(false);
    });
  });
  reg(`ponte: ${noAr ? 'no ar' : 'NAO SUBIU'} (log em ${log})`);
  if (!noAr) throw new Error(`a ponte nao subiu. Veja ${log}`);
  return filho;
}

function esperarPendente(db: Firestore, limiteMs: number): Promise<{ id: string; dados: DocumentData } | null> {
  return new Promise((resolve) => {
    let pronto = false;
    const q = query(collection(db, 'aprovacoes'), where('maquinaId', '==', MAQUINA), where('situacao', '==', 'pendente'));
    const relogio = setTimeout(() => fim(null), limiteMs);
    const fim = (v: { id: string; dados: DocumentData } | null): void => {
      if (pronto) return;
      pronto = true;
      clearTimeout(relogio);
      try {
        off();
      } catch {
        // ja desligado
      }
      resolve(v);
    };
    const off = onSnapshot(
      q,
      (snap) => {
        const primeiro = snap.docs[0];
        if (primeiro) {
          writeFileSync(join(FILA, `pedido-${primeiro.id}.json`), JSON.stringify(primeiro.data(), null, 2), 'utf8');
          fim({ id: primeiro.id, dados: primeiro.data() });
        }
      },
      () => fim(null)
    );
  });
}

function esperarDecidido(db: Firestore, aprovacaoId: string, limiteMs: number): Promise<DocumentData | null> {
  return new Promise((resolve) => {
    let pronto = false;
    const relogio = setTimeout(() => fim(null), limiteMs);
    const fim = (v: DocumentData | null): void => {
      if (pronto) return;
      pronto = true;
      clearTimeout(relogio);
      try {
        off();
      } catch {
        // ja desligado
      }
      resolve(v);
    };
    const off = onSnapshot(
      doc(db, 'aprovacoes', aprovacaoId),
      (snap) => {
        const d = snap.data();
        if (d && d['situacao'] === 'respondida') fim(d);
      },
      () => fim(null)
    );
  });
}

async function principal(): Promise<void> {
  reg(`rodada em ${RODADA}`);
  reg(`base ${EMULADOR ? 'NO EMULADOR' : 'REAL, projeto a-fabrica-soulan'}`);
  reg(`maquina de teste ${MAQUINA}, prazo de espera da prova ${LIMITE_MS} ms`);
  const base = await initBase({ emulador: EMULADOR, registrar: (l) => reg(`[identidade] ${l}`) });
  const db = base.db;
  reg(`executor entrou na base como ${base.identidade.usuario.email}, degrau ${base.identidade.degrau}`);

  const ponte = await subirPonte();
  const fabricaId = `f-tempo-${randomUUID().slice(0, 8)}`;
  const alvo = join(PROJETO, 'nunca-deveria-existir.txt');
  const comandoId = randomUUID();
  await setDoc(doc(db, 'comandos', comandoId), {
    comandoId,
    fabricaId,
    maquinaId: MAQUINA,
    texto: `Usando a ferramenta de escrita, crie o arquivo ${alvo} com o conteudo tempo. Depois responda apenas FEITO.`,
    situacao: 'pendente',
    criadoEm: serverTimestamp(),
    origem: `prova de tempo esgotado, ${DIRETOR}`,
    cwd: PROJETO,
    conversationId: null,
    entregueEm: null,
  });
  reg(`comando ${comandoId} gravado na base para a fabrica ${fabricaId}`);

  const pedido = await esperarPendente(db, 420000);
  if (!pedido) {
    reg('FALHOU: o pedido de aprovacao nao chegou na base');
    process.exit(1);
  }
  reg(`pedido ${pedido.id} esta pendente. NINGUEM vai responder, de proposito.`);
  const comecou = Date.now();

  const decidido = await esperarDecidido(db, pedido.id, LIMITE_MS + 120000);
  const esperou = Date.now() - comecou;
  if (decidido) writeFileSync(join(FILA, `resposta-${pedido.id}.json`), JSON.stringify(decidido, null, 2), 'utf8');

  const resposta = decidido?.['resposta'];
  const quem = String(decidido?.['respondidoPor'] ?? '');
  const observacao = String(decidido?.['observacao'] ?? '');
  const horaDoServidor = decidido?.['respondidoEm'] ?? null;
  reg(`depois de ${Math.round(esperou / 1000)}s o pedido virou situacao ${String(decidido?.['situacao'])}`);
  reg(`  resposta: ${String(resposta)}`);
  reg(`  respondidoPor: ${quem}`);
  reg(`  observacao: ${observacao}`);
  reg(`  respondidoEm (hora do servidor): ${JSON.stringify(horaDoServidor)}`);

  // Resposta tardia do diretor: a regra publicada tem de NEGAR, porque o pedido
  // nao esta mais pendente. Antes desta correcao, ela seria aceita e a trilha
  // passaria a dizer "aprovado" num pedido que nunca executou.
  let recusaDaRespostaTardia = 'nao testado';
  try {
    await updateDoc(doc(db, 'aprovacoes', pedido.id), {
      situacao: 'respondida',
      resposta: 'aprovado',
      observacao: 'resposta tardia do diretor, depois do tempo esgotado',
      respondidoEm: serverTimestamp(),
      respondidoPor: `painel de teste, ${DIRETOR}`,
    });
    recusaDaRespostaTardia = 'ACEITA, o que seria falha';
  } catch (e) {
    recusaDaRespostaTardia = `negada pela base: ${e instanceof Error ? e.message : String(e)}`;
  }
  reg(`resposta tardia do diretor: ${recusaDaRespostaTardia}`);

  const depois = await getDoc(doc(db, 'aprovacoes', pedido.id));
  const respostaFinal = depois.data()?.['resposta'];
  const criou = existsSync(alvo);
  reg(`o arquivo que o agente queria escrever existe: ${criou} (tem de ser false)`);

  const passou =
    decidido !== null &&
    resposta === 'recusado' &&
    /tempo esgotado/.test(quem) &&
    /recusa por tempo/.test(observacao) &&
    horaDoServidor !== null &&
    !criou &&
    respostaFinal === 'recusado' &&
    /negada pela base/.test(recusaDaRespostaTardia);

  ponte.stdin.write('parar\n');
  await dormir(6000);
  if (ponte.exitCode === null) ponte.kill('SIGKILL');

  reg('');
  reg(
    passou
      ? 'PASSOU: tempo esgotado deixa trilha na base, com recusa por tempo, hora do servidor e origem, e nada executou'
      : 'FALHOU: veja as linhas acima'
  );
  writeFileSync(
    join(RODADA, 'resultado.json'),
    JSON.stringify(
      {
        emulador: EMULADOR,
        maquina: MAQUINA,
        fabricaId,
        aprovacaoId: pedido.id,
        limiteMs: LIMITE_MS,
        esperouMs: esperou,
        resposta,
        respondidoPor: quem,
        observacao,
        arquivoCriado: criou,
        respostaTardia: recusaDaRespostaTardia,
        passou,
      },
      null,
      2
    ),
    'utf8'
  );
  process.exit(passou ? 0 : 1);
}

principal().catch((e: unknown) => {
  reg(`prova quebrou: ${e instanceof Error ? `${e.message}\n${e.stack ?? ''}` : String(e)}`);
  process.exit(1);
});
