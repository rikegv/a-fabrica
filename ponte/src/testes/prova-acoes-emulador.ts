// prova-acoes-emulador.ts, as cinco acoes da Onda 2 ao vivo, com a ponte de
// verdade como servico e a base no EMULADOR.
//
// HONESTIDADE DE ROTULO, antes de qualquer numero
// -----------------------------------------------
// Isto roda contra o EMULADOR do Firestore e do Authentication, nas portas
// proprias da ponte (8099 e 9199), com as regras publicadas do projeto carregadas
// nele. NAO e a base real da nuvem. O que o emulador prova: o fluxo inteiro das
// tres pecas, a forma dos documentos, as transicoes de estado e as regras. O que
// ele NAO prova: a identidade real do diretor na nuvem, que depende do login no
// navegador, e que fica dito em docs/ost7-ponte.md.
//
// COMO ESTA PROVA FUNCIONA
// ------------------------
// Ela faz o papel do PAINEL: escreve documentos em `comandos` com o campo `acao` e
// responde `aprovacoes`, igual ao que o painel vai fazer. Quem executa e a ponte
// de verdade, em processo separado, com o Claude Code de verdade. A prova nunca
// chama o Claude Code direto, §A.3.
//
// Quem responde aprovacao aqui e a PROVA, fazendo o papel do diretor, e cada
// resposta aparece no registro. A ponte nao aprova nada sozinha, §A.6.
//
// §A.17 pasta propria da rodada, com data e hora. Nada apagado, nada sobrescrito.
// §A.19 a fila desta rodada vive dentro da pasta da rodada.

import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  collection,
  doc,
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
import { initBase } from '../base.js';
import { DIRETOR } from '../config.js';
import type { AcaoComando } from '../tipos.js';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ_PONTE = join(AQUI, '..', '..');
const SERVICO = join(AQUI, '..', 'ponte.js');

function selo(): string {
  const d = new Date();
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

const RODADA = join('C:\\Users\\Henrique\\a-fabrica-lab\\rodadas', `${selo()}-ost7-acoes-emulador`);
const PROJETO = join(RODADA, 'projeto-cc');
const SAIDA = join(RODADA, 'saida.txt');
// Marca no identificador, para o diretor distinguir prova de trabalho de verdade.
const MARCA = 'TESTE-ost7';
const MAQUINA = `maquina-${MARCA}-${selo().replace(/[:T-]/g, '')}`;

mkdirSync(PROJETO, { recursive: true });
mkdirSync(join(PROJETO, '.claude', 'agents'), { recursive: true });
// Agente de verdade, no formato que o diretor ja usa, dentro da pasta da rodada.
// A pasta de agentes do diretor NAO e tocada, §A.9.
writeFileSync(
  join(PROJETO, '.claude', 'agents', 'provador.md'),
  [
    '---',
    'name: provador',
    'description: agente de prova da OST 7 no emulador',
    '---',
    '',
    '# Papel',
    'Voce e o provador da OST 7. Comece TODA resposta com a palavra PROVADO-OST7. Responda curto.',
  ].join('\n'),
  'utf8'
);

let erros = 0;
function reg(linha: string): void {
  const texto = `${new Date().toISOString()} ${linha}`;
  console.log(texto);
  appendFileSync(SAIDA, `${texto}\n`, 'utf8');
}
function conferir(ok: boolean, rotulo: string, detalhe: string): void {
  if (!ok) erros++;
  reg(`${ok ? 'PASSOU' : 'FALHOU'} ${rotulo}: ${detalhe}`);
}
const dormir = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// A ponte de verdade, como servico em processo separado
// ---------------------------------------------------------------------------

interface PonteViva {
  saida: string[];
  pararLimpo(): Promise<void>;
}

async function subirPonte(): Promise<PonteViva> {
  const log = join(RODADA, 'servico.log');
  const ambiente: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined) ambiente[k] = v;
  ambiente['PONTE_MAQUINA_ID'] = MAQUINA;
  ambiente['PONTE_CWD'] = PROJETO;
  ambiente['PONTE_EMULADOR'] = '1';
  // Rotulo de teste em tudo que esta rodada criar, para o painel esconder, §A.17.
  ambiente['PONTE_ROTULO_TESTE'] = '1';
  // Fila de atividade desta rodada dentro da rodada, para a ponte de teste nao
  // encostar na atividade real do diretor.
  ambiente['PONTE_PASTA_FILA_GANCHOS'] = join(RODADA, 'fila-de-ganchos-da-rodada');

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

  const noAr = await new Promise<boolean>((resolve) => {
    const relogio = setTimeout(() => resolve(false), 90000);
    const conferir2 = (): void => {
      if (saida.some((l) => /ponte no ar/.test(l))) {
        clearTimeout(relogio);
        resolve(true);
      }
    };
    filho.stdout.on('data', conferir2);
    filho.stderr.on('data', conferir2);
    filho.once('exit', () => {
      clearTimeout(relogio);
      resolve(saida.some((l) => /ponte no ar/.test(l)));
    });
  });
  reg(`ponte: ${noAr ? 'no ar' : 'NAO SUBIU'} (log em ${log})`);
  if (!noAr) throw new Error(`a ponte nao subiu. Veja ${log}`);
  return {
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
  };
}

// ---------------------------------------------------------------------------
// O lado do painel: escrever comando com acao, responder aprovacao
// ---------------------------------------------------------------------------

interface PedidoDeComando {
  fabricaId: string;
  texto: string;
  acao?: AcaoComando | string;
  cwd?: string | null;
  conversationId?: string | null;
  agente?: string;
  modelo?: string;
}

async function escreverComando(db: Firestore, d: PedidoDeComando): Promise<string> {
  const comandoId = randomUUID();
  const corpo: Record<string, unknown> = {
    comandoId,
    fabricaId: d.fabricaId,
    maquinaId: MAQUINA,
    texto: d.texto,
    situacao: 'pendente',
    criadoEm: serverTimestamp(),
    origem: `painel de prova da OST 7, ${DIRETOR}`,
    entregueEm: null,
  };
  if (d.acao !== undefined) corpo['acao'] = d.acao;
  if (d.cwd !== undefined) corpo['cwd'] = d.cwd;
  if (d.conversationId !== undefined) corpo['conversationId'] = d.conversationId;
  if (d.agente !== undefined) corpo['agente'] = d.agente;
  if (d.modelo !== undefined) corpo['modelo'] = d.modelo;
  await setDoc(doc(db, 'comandos', comandoId), corpo);
  reg(`comando ${comandoId.slice(0, 8)} acao ${String(d.acao ?? 'ausente')} gravado para a fabrica ${d.fabricaId.slice(0, 8)}`);
  return comandoId;
}

async function lerFabrica(db: Firestore, fabricaId: string): Promise<DocumentData> {
  const s = await getDoc(doc(db, 'fabricas', fabricaId));
  return s.data() ?? {};
}

async function esperarFabrica(
  db: Firestore,
  fabricaId: string,
  condicao: (d: DocumentData) => boolean,
  limiteMs: number,
  rotulo: string
): Promise<DocumentData> {
  const limite = Date.now() + limiteMs;
  let ultimo: DocumentData = {};
  while (Date.now() < limite) {
    ultimo = await lerFabrica(db, fabricaId);
    if (condicao(ultimo)) return ultimo;
    await dormir(700);
  }
  reg(`${rotulo}: tempo esgotado, ultimo estado ${JSON.stringify(ultimo).slice(0, 200)}`);
  return ultimo;
}

async function esperarComandoEntregue(db: Firestore, comandoId: string, limiteMs: number): Promise<boolean> {
  const limite = Date.now() + limiteMs;
  while (Date.now() < limite) {
    const s = await getDoc(doc(db, 'comandos', comandoId));
    if (s.data()?.['situacao'] === 'entregue') return true;
    await dormir(500);
  }
  return false;
}

/**
 * Responde, como o diretor responderia pelo painel, todo pedido de aprovacao que
 * aparecer para esta maquina. Fica ligado durante a prova inteira, e cada resposta
 * entra no registro, uma por uma.
 */
function responderComoDiretor(db: Firestore, respostas: string[]): () => void {
  const q = query(
    collection(db, 'aprovacoes'),
    where('maquinaId', '==', MAQUINA),
    where('situacao', '==', 'pendente')
  );
  return onSnapshot(
    q,
    (snap) => {
      for (const s of snap.docs) {
        const dado = s.data();
        const pacote: unknown = dado['pacote'];
        const oQue =
          typeof pacote === 'object' && pacote !== null
            ? JSON.stringify((pacote as Record<string, unknown>)['oQue'] ?? '').slice(0, 90)
            : 'sem pacote';
        void updateDoc(s.ref, {
          situacao: 'respondida',
          resposta: 'aprovado',
          observacao: null,
          respondidoEm: serverTimestamp(),
          respondidoPor: `prova da OST 7 no papel do diretor, ${DIRETOR}`,
        })
          .then(() => {
            respostas.push(`${s.id.slice(0, 8)} aprovado, pedido ${oQue}`);
            reg(`o diretor (a prova) aprovou o pedido ${s.id.slice(0, 8)}: ${oQue}`);
          })
          .catch(() => undefined);
      }
    },
    () => undefined
  );
}

async function pendentesDaFabrica(db: Firestore, fabricaId: string): Promise<DocumentData[]> {
  const q = query(
    collection(db, 'aprovacoes'),
    where('fabricaId', '==', fabricaId),
    where('situacao', '==', 'pendente')
  );
  const r = await getDocs(q);
  return r.docs.map((d) => d.data());
}

// ---------------------------------------------------------------------------

const TAREFA_LONGA =
  'Crie, um arquivo por vez, usando a ferramenta de escrita, os arquivos ' +
  [1, 2, 3, 4, 5, 6].map((n) => join(PROJETO, `longa${n}.txt`)).join(', ') +
  ', cada um com o conteudo x. Uma chamada de ferramenta por arquivo.';

async function principal(): Promise<void> {
  reg(`rodada em ${RODADA}`);
  reg('base: EMULADOR do Firestore em 127.0.0.1:8099 e do Authentication em 127.0.0.1:9199. NAO e a base real da nuvem.');
  reg(`maquina desta prova: ${MAQUINA}`);

  const base = await initBase({ emulador: true, registrar: (l) => reg(`[identidade] ${l}`) });
  const db = base.db;
  reg(`a prova entrou na base como ${base.identidade.usuario.email}, degrau ${base.identidade.degrau}`);

  const respostas: string[] = [];
  const pararRespostas = responderComoDiretor(db, respostas);
  const ponte = await subirPonte();

  // ---- 1, ABRIR, com agente e modelo do comando --------------------------
  reg('');
  reg('ACAO 1, abrir: fabrica nova com agente e modelo vindos do comando');
  const f1 = `fab-${MARCA}-abrir-${randomUUID().slice(0, 8)}`;
  const c1 = await escreverComando(db, {
    fabricaId: f1,
    acao: 'abrir',
    texto: 'Diga em uma linha quem voce e. Nao use ferramenta nenhuma.',
    cwd: PROJETO,
    agente: 'provador',
    modelo: 'haiku',
  });
  const entregue1 = await esperarComandoEntregue(db, c1, 60000);
  const d1 = await esperarFabrica(db, f1, (d) => d['estado'] === 'concluida' || d['estado'] === 'falhou', 300000, 'abrir');
  conferir(
    entregue1 && d1['estado'] === 'concluida',
    'abrir: a ponte tomou o comando uma vez e a fabrica foi ao fim',
    `comando entregue ${entregue1}, estado ${String(d1['estado'])}, erro ${String(d1['erro'] ?? 'nenhum')}`
  );
  conferir(
    d1['origem'] === 'painel' && d1['agente'] === 'provador',
    'abrir: a fabrica nasceu com origem painel e com o agente pedido',
    `origem ${String(d1['origem'])}, agente ${String(d1['agente'])}`
  );
  conferir(
    typeof d1['modelo'] === 'string' && /haiku/i.test(String(d1['modelo'])),
    'abrir: o modelo pedido no comando e o que o Claude Code usou',
    `modelo na base ${String(d1['modelo'])}`
  );
  const conversa1 = typeof d1['conversationId'] === 'string' ? d1['conversationId'] : null;
  conferir(conversa1 !== null, 'abrir: a conversa da sessao ficou guardada na base', `conversa ${String(conversa1)}`);

  // ---- 2, COMANDO, na fabrica que ja existe -------------------------------
  reg('');
  reg('ACAO 2, comando: texto para a fabrica que ja existe, retomando a conversa');
  const c2 = await escreverComando(db, {
    fabricaId: f1,
    acao: 'comando',
    texto: 'Responda em uma linha: qual foi a primeira coisa que eu lhe pedi?',
    cwd: PROJETO,
    conversationId: conversa1,
  });
  const entregue2 = await esperarComandoEntregue(db, c2, 60000);
  // Sinal de que a sessao NOVA comecou: o campo inicio e reescrito em toda
  // abertura. Esperar por ele e deterministico, nao depende de pegar o estado no
  // ar no instante certo.
  const comecou2 = await esperarFabrica(db, f1, (d) => d['inicio'] !== d1['inicio'], 120000, 'comando, sessao nova comecando');
  const d2 = await esperarFabrica(
    db,
    f1,
    (d) => d['estado'] === 'concluida' || d['estado'] === 'falhou',
    300000,
    'comando'
  );
  conferir(
    entregue2 && comecou2['inicio'] !== d1['inicio'] && d2['estado'] === 'concluida',
    'comando: a ponte executou na fabrica que ja existia, retomando a conversa',
    `comando entregue ${entregue2}, estado ${String(d2['estado'])}, conversa agora ${String(d2['conversationId'])}`
  );

  // ---- 3, PAUSAR uma sessao viva, e REINICIAR -----------------------------
  reg('');
  reg('ACAO 3, pausar: aborta a sessao viva guardando a conversa');
  const f3 = `fab-${MARCA}-pausar-${randomUUID().slice(0, 8)}`;
  await escreverComando(db, { fabricaId: f3, acao: 'abrir', texto: TAREFA_LONGA, cwd: PROJETO, modelo: 'haiku' });
  // Espera a sessao estar de fato trabalhando: conversa gravada e pelo menos um
  // pedido de aprovacao ja respondido, ou estado de execucao com atividade.
  const vivendo = await esperarFabrica(
    db,
    f3,
    (d) => typeof d['conversationId'] === 'string' && (d['estado'] === 'em execucao' || d['estado'] === 'aguardando aprovacao'),
    300000,
    'pausar, esperando a sessao andar'
  );
  reg(`a fabrica a pausar esta em ${String(vivendo['estado'])}, conversa ${String(vivendo['conversationId'])}`);
  await dormir(4000);
  await escreverComando(db, { fabricaId: f3, acao: 'pausar', texto: 'pausar a fabrica' });
  const d3 = await esperarFabrica(db, f3, (d) => d['pausada'] === true, 120000, 'pausar');
  conferir(
    d3['estado'] === 'aguardando comando' && d3['pausada'] === true,
    'pausar: estado aguardando comando com pausada true, contrato secao 3',
    `estado ${String(d3['estado'])}, pausada ${String(d3['pausada'])}`
  );
  const conversa3 = typeof d3['conversationId'] === 'string' ? d3['conversationId'] : null;
  conferir(conversa3 !== null, 'pausar: a conversa ficou guardada para o reiniciar', `conversa ${String(conversa3)}`);
  await dormir(3000);
  const fantasmas3 = await pendentesDaFabrica(db, f3);
  conferir(
    fantasmas3.length === 0,
    'pausar: nao sobrou pedido de aprovacao pendente da fabrica pausada, o painel nao mostra pedido fantasma',
    `pedidos pendentes ${fantasmas3.length}`
  );

  reg('');
  reg('ACAO 4, reiniciar: retoma a conversa guardada e limpa pausada');
  const c4 = await escreverComando(db, {
    fabricaId: f3,
    acao: 'reiniciar',
    texto: 'Pare de criar arquivos. Responda em uma linha quantos arquivos voce chegou a criar.',
    cwd: PROJETO,
    conversationId: conversa3,
  });
  const entregue4 = await esperarComandoEntregue(db, c4, 60000);
  const comecou4 = await esperarFabrica(db, f3, (d) => d['inicio'] !== d3['inicio'], 120000, 'reiniciar, sessao retomando');
  const d4 = await esperarFabrica(
    db,
    f3,
    (d) => d['pausada'] === false && (d['estado'] === 'concluida' || d['estado'] === 'falhou'),
    300000,
    'reiniciar'
  );
  conferir(
    entregue4 && comecou4['inicio'] !== d3['inicio'] && d4['pausada'] === false && d4['estado'] === 'concluida',
    'reiniciar: a fabrica voltou, pausada limpa, sem abrir fabrica nova',
    `estado ${String(d4['estado'])}, pausada ${String(d4['pausada'])}, erro ${String(d4['erro'] ?? 'nenhum')}`
  );
  conferir(
    d4['conversationId'] === conversa3,
    'reiniciar: retomou a MESMA conversa, nao abriu conversa nova',
    `conversa antes ${String(conversa3)}, conversa depois ${String(d4['conversationId'])}`
  );

  // ---- 5, ENCERRAR uma sessao viva ---------------------------------------
  reg('');
  reg('ACAO 5, encerrar: aborta a sessao viva, estado concluida, sem volta');
  const f5 = `fab-${MARCA}-encerrar-${randomUUID().slice(0, 8)}`;
  await escreverComando(db, { fabricaId: f5, acao: 'abrir', texto: TAREFA_LONGA, cwd: PROJETO, modelo: 'haiku' });
  await esperarFabrica(
    db,
    f5,
    (d) => typeof d['conversationId'] === 'string' && (d['estado'] === 'em execucao' || d['estado'] === 'aguardando aprovacao'),
    300000,
    'encerrar, esperando a sessao andar'
  );
  await dormir(4000);
  await escreverComando(db, { fabricaId: f5, acao: 'encerrar', texto: 'encerrar a fabrica, pedido do diretor' });
  const d5 = await esperarFabrica(db, f5, (d) => d['encerradaEm'] !== undefined && d['encerradaEm'] !== null, 120000, 'encerrar');
  conferir(
    d5['estado'] === 'concluida' && d5['encerradaEm'] !== undefined,
    'encerrar: estado concluida com encerradaEm em hora do servidor',
    `estado ${String(d5['estado'])}, encerradaEm ${JSON.stringify(d5['encerradaEm'])}`
  );
  conferir(
    d5['pedidoDeEncerramento'] === 'encerrar a fabrica, pedido do diretor',
    'encerrar: o texto do pedido do diretor fica na fabrica, legivel por pessoa',
    `pedidoDeEncerramento ${String(d5['pedidoDeEncerramento'])}`
  );
  // A fabrica encerrada nao volta.
  await dormir(2000);
  const c5b = await escreverComando(db, { fabricaId: f5, acao: 'reiniciar', texto: 'tentar fazer a fabrica voltar' });
  await esperarComandoEntregue(db, c5b, 60000);
  await dormir(6000);
  const d5b = await lerFabrica(db, f5);
  conferir(
    d5b['estado'] === 'concluida' && String(d5b['erro'] ?? '').includes('nao volta'),
    'encerrar: a fabrica encerrada NAO volta, e o motivo da recusa fica na base',
    `estado ${String(d5b['estado'])}, erro ${String(d5b['erro'] ?? 'nenhum')}`
  );

  // ---- 6, ACAO DESCONHECIDA, falha fechada -------------------------------
  reg('');
  reg('ACAO 6, acao desconhecida: recusada, falha fechada, com motivo');
  const f6 = `fab-${MARCA}-torta-${randomUUID().slice(0, 8)}`;
  const c6 = await escreverComando(db, { fabricaId: f6, acao: 'explodir', texto: 'acao que nao existe' });
  const entregue6 = await esperarComandoEntregue(db, c6, 60000);
  const d6 = await esperarFabrica(db, f6, (d) => typeof d['erro'] === 'string', 60000, 'acao desconhecida');
  conferir(
    entregue6 && String(d6['erro'] ?? '').includes('nao reconhecida') && d6['estado'] === undefined,
    'acao desconhecida: recusada com motivo na base, e nenhuma fabrica entrou em execucao',
    `erro ${String(d6['erro'] ?? 'nenhum')}, estado ${String(d6['estado'])}`
  );

  // ---- 7, bordas: encerrar e pausar o que nao esta vivo, reiniciar sem conversa
  reg('');
  reg('ACAO 7, as bordas: ordem para o que nao esta vivo aqui');
  const f7 = `fab-${MARCA}-borda-${randomUUID().slice(0, 8)}`;
  const c7a = await escreverComando(db, { fabricaId: f7, acao: 'encerrar', texto: 'encerrar a fabrica' });
  await esperarComandoEntregue(db, c7a, 60000);
  const d7a = await esperarFabrica(db, f7, (d) => typeof d['erro'] === 'string', 60000, 'encerrar o que nao existe');
  conferir(
    String(d7a['erro'] ?? '').includes('encerrar nao cumprida') && d7a['encerradaEm'] === undefined,
    'encerrar fabrica que nao existe: recusado, e a ponte NAO finge que encerrou',
    `erro ${String(d7a['erro'] ?? 'nenhum')}`
  );

  const f7b = `fab-${MARCA}-borda2-${randomUUID().slice(0, 8)}`;
  const c7b = await escreverComando(db, { fabricaId: f7b, acao: 'pausar', texto: 'pausar a fabrica' });
  await esperarComandoEntregue(db, c7b, 60000);
  const d7b = await esperarFabrica(db, f7b, (d) => typeof d['erro'] === 'string', 60000, 'pausar o que nao esta vivo');
  conferir(
    String(d7b['erro'] ?? '').includes('pausar nao cumprida') && d7b['pausada'] === undefined,
    'pausar fabrica que nao esta viva: recusado, e nada vira pausada',
    `erro ${String(d7b['erro'] ?? 'nenhum')}`
  );

  const f7c = `fab-${MARCA}-borda3-${randomUUID().slice(0, 8)}`;
  const c7c = await escreverComando(db, { fabricaId: f7c, acao: 'reiniciar', texto: 'retomar a fabrica' });
  await esperarComandoEntregue(db, c7c, 60000);
  const d7c = await esperarFabrica(db, f7c, (d) => typeof d['erro'] === 'string', 60000, 'reiniciar sem conversa');
  conferir(
    String(d7c['erro'] ?? '').includes('conversa guardada'),
    'reiniciar sem conversationId: recusado, porque retomar sem conversa seria abrir fabrica nova fingindo ser a antiga',
    `erro ${String(d7c['erro'] ?? 'nenhum')}`
  );

  // ---- fechamento ---------------------------------------------------------
  reg('');
  const linhaPersona = ponte.saida.find((l) => /persona aplicada pelo kit/.test(l)) ?? '';
  conferir(
    linhaPersona.length > 0,
    'o campo agente chegou ao Claude Code pela opcao agent do kit, com definicao lida do arquivo do agente',
    linhaPersona.slice(0, 160) || 'a ponte nao registrou aplicacao de persona'
  );
  reg(`pedidos de aprovacao respondidos pela prova no papel do diretor: ${respostas.length}`);
  for (const r of respostas) reg(`  ${r}`);
  const semTravessao = respostas.every((r) => !r.includes('\u2014'));
  conferir(semTravessao, 'nenhum texto desta rodada traz travessao, §A.11', `respostas conferidas ${respostas.length}`);

  await ponte.pararLimpo();
  pararRespostas();

  const maquina = await getDoc(doc(db, 'maquinas', MAQUINA));
  conferir(
    maquina.data()?.['estadoPonte'] === 'offline',
    'parada limpa: a ponte marcou a maquina como offline, e o painel nao fica mentindo',
    `estadoPonte ${String(maquina.data()?.['estadoPonte'])}`
  );

  reg('');
  reg(`RESUMO: ${erros === 0 ? 'todas as conferencias passaram' : `${erros} conferencia(s) fora do esperado`}`);
  reg(`evidencia desta rodada em ${SAIDA}`);
  process.exit(erros === 0 ? 0 : 1);
}

principal().catch((e: unknown) => {
  reg(`prova quebrou: ${e instanceof Error ? `${e.message}\n${e.stack ?? ''}` : String(e)}`);
  process.exit(1);
});
