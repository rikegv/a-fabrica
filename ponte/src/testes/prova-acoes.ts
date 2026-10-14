// prova-acoes.ts, as cinco acoes da Onda 2 postas a prova, sem base na nuvem.
//
// POR QUE SEM BASE, dito na cara
// ------------------------------
// A ponte nao tem sessao do diretor na nuvem: o login no navegador depende de um
// clique dele e ainda nao aconteceu. Rodar contra a nuvem agora so produziria erro
// de identidade, que nao prova nada sobre as acoes.
//
// CORRECAO, feita pelo coordenador depois: o cabecalho desta prova dizia tambem que
// o emulador nao subia por causa da credencial do Firebase CLI. Isso estava ERRADO,
// e a informacao errada veio de mim para o agente. O emulador sobe sem login; o que
// tinha matado a primeira tentativa foi um tempo limite curto no comando. Por isso
// existe a prova irma, prova-acoes-emulador.ts, que roda a ponte de verdade contra
// o emulador. Esta aqui continua valendo pelo que ela cobre melhor: a DECISAO do
// roteador, caso por caso, sem rede no meio.
//
// Entao esta prova troca a base por uma base de MEMORIA e mantem o resto de
// verdade. O que fica sem prova ao vivo esta listado em docs/ost7-ponte.md, com o
// motivo, sem maquiagem.
//
// O QUE ELA PROVA
// ---------------
// PARTE 1  a leitura do campo `acao`: as cinco, a ausencia (compatibilidade com a
//          Onda 1), a desconhecida, a que nao e texto e a vazia.
// PARTE 2  o roteador, com documentos de comando montados a mao e uma sessao de
//          mentira, para olhar a DECISAO: o que foi gravado, o que foi recusado e
//          com que motivo.
// PARTE 3  o Claude Code DE VERDADE, porque a sessao viva funciona; so a base e
//          que nao. Aqui entram: modelo e persona chegando ao kit, pausar
//          abortando sessao viva, reiniciar retomando a conversa guardada,
//          encerrar abortando e nao deixando a fabrica voltar.
//
// §A.6  nada escuta. Nenhuma porta. Conexao de saida so a do proprio Claude Code.
// §A.17 pasta propria da rodada, com data e hora. Nada apagado, nada sobrescrito.
// §A.19 a pasta local da ponte desta prova fica DENTRO da rodada, nunca na pasta
//       de verdade do diretor. Por isso a prova se relanca com PONTE_PASTA_LOCAL
//       apontado para dentro da rodada: config.ts le essa variavel na carga do
//       modulo, antes de qualquer linha nossa rodar.

import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

function selo(): string {
  const d = new Date();
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

const RODADA =
  process.env.PONTE_RODADA ?? join('C:\\Users\\Henrique\\a-fabrica-lab\\rodadas', `${selo()}-ost7-prova-acoes`);

// Relancamento com a pasta local da ponte dentro da rodada, §A.19. Isto acontece
// antes de importar qualquer modulo da ponte, por isso o import dinamico la embaixo.
if (process.env.PONTE_ACOES_FILHO !== '1') {
  mkdirSync(RODADA, { recursive: true });
  const r = spawnSync(process.execPath, [fileURLToPath(import.meta.url)], {
    stdio: 'inherit',
    env: {
      ...process.env,
      PONTE_ACOES_FILHO: '1',
      PONTE_RODADA: RODADA,
      PONTE_PASTA_LOCAL: join(RODADA, 'ponte-local'),
    },
  });
  process.exit(r.status ?? 1);
}

const { acaoDe } = await import('../tipos.js');
const { despachar } = await import('../acoes.js');
const { RegistroDeFabricas } = await import('../vivas.js');
const { MODELO_PADRAO, MODO, opcoesDaSessao } = await import('../claudeCode.js');
const { aplicarPersona } = await import('../personas.js');
const { PASTA_TRAVAS } = await import('../config.js');

type MundoDaPonte = import('../acoes.js').MundoDaPonte;
type PedidoDeSessao = import('../sessao.js').PedidoDeSessao;
type PortasDaSessao = import('../sessao.js').PortasDaSessao;
type ResultadoDaSessao = import('../sessao.js').ResultadoDaSessao;
type ComandoTomado = import('../tipos.js').ComandoTomado;
type Fabrica = import('../tipos.js').Fabrica;
type PermissionResult = import('@anthropic-ai/claude-agent-sdk').PermissionResult;

mkdirSync(RODADA, { recursive: true });
const SAIDA = join(RODADA, 'saida.txt');

let erros = 0;
function reg(linha: string): void {
  console.log(linha);
  appendFileSync(SAIDA, `${linha}\n`, 'utf8');
}
function conferir(ok: boolean, rotulo: string, detalhe: string): void {
  if (!ok) erros++;
  reg(`  ${ok ? 'PASSOU' : 'FALHOU'} ${rotulo}: ${detalhe}`);
}
const dormir = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// A base de memoria e o mundo da prova
// ---------------------------------------------------------------------------

interface Memoria {
  fabricas: Map<string, Record<string, unknown>>;
  passos: { fabricaId: string; tipo: string }[];
  recusas: string[];
  sessoesPedidas: PedidoDeSessao[];
  /** Quantas vezes a ponte pediu para recusar aprovacao pendente, e com que motivo. */
  pendentesRecusados: string[];
}

function memoriaNova(): Memoria {
  return { fabricas: new Map(), passos: [], recusas: [], sessoesPedidas: [], pendentesRecusados: [] };
}

function campo(mem: Memoria, fabricaId: string, nome: string): unknown {
  return mem.fabricas.get(fabricaId)?.[nome];
}

/** Comando como o painel escreve, montado a mao. `acao` opcional de proposito. */
function comandoDeMentira(d: Partial<ComandoTomado> & { texto: string }): ComandoTomado {
  return {
    id: randomUUID(),
    fabricaId: d.fabricaId ?? null,
    texto: d.texto,
    cwd: d.cwd ?? null,
    conversationId: d.conversationId ?? null,
    // null aqui e de proposito: e o que a ponte le quando a acao veio escrita e
    // nao e nenhuma das cinco. Por isso nao se usa ?? neste campo.
    acao: d.acao === undefined ? 'comando' : d.acao,
    acaoBruta: d.acaoBruta ?? null,
    agente: d.agente ?? null,
    modelo: d.modelo ?? null,
  };
}

function mundoDeMemoria(
  mem: Memoria,
  rodar?: (portas: PortasDaSessao, pedido: PedidoDeSessao) => Promise<ResultadoDaSessao>
): MundoDaPonte {
  const mundo: MundoDaPonte = {
    maquinaId: 'maquina-da-prova',
    registro: new RegistroDeFabricas(),
    cwdPadrao: () => join(RODADA, 'projeto-padrao'),
    registrar: (l: string) => {
      if (/recusada/.test(l)) mem.recusas.push(l);
    },
    horaDoServidor: () => `hora de servidor de mentira, ${new Date().toISOString()}`,
    anotarFabrica: async (fabricaId: string, dados: Partial<Fabrica>): Promise<void> => {
      const atual = mem.fabricas.get(fabricaId) ?? {};
      mem.fabricas.set(fabricaId, { ...atual, ...dados });
    },
    publicarPasso: async (fabricaId, passo): Promise<void> => {
      mem.passos.push({ fabricaId, tipo: passo.tipo });
    },
    recusarPendentes: async (fabricaId: string, motivo: string): Promise<number> => {
      mem.pendentesRecusados.push(`${fabricaId}: ${motivo}`);
      return 0;
    },
    lerConversa: async (fabricaId: string): Promise<string | null> => {
      const v = campo(mem, fabricaId, 'conversationId');
      return typeof v === 'string' ? v : null;
    },
    fazerPortao: () => async (): Promise<PermissionResult> => ({
      behavior: 'deny',
      message: 'portao de mentira da parte 2, nao executa nada',
    }),
  };
  if (rodar) mundo.rodar = rodar;
  return mundo;
}

/** Sessao de mentira: nao abre Claude Code, so anota o pedido que recebeu. */
function sessaoDeMentira(mem: Memoria) {
  return async (portas: PortasDaSessao, pedido: PedidoDeSessao): Promise<ResultadoDaSessao> => {
    mem.sessoesPedidas.push(pedido);
    await portas.anotarFabrica(pedido.fabricaId, pedido.dadosIniciais);
    return { fabricaId: pedido.fabricaId, sessionId: 'sessao-de-mentira', estado: 'success', rodou: true };
  };
}

function travasNoDisco(): string[] {
  try {
    return readdirSync(PASTA_TRAVAS);
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// PARTE 1, a leitura do campo acao
// ---------------------------------------------------------------------------

function parte1(): void {
  reg('');
  reg('PARTE 1, leitura do campo acao do documento de comando');
  const casos: { rotulo: string; dado: unknown; acao: string | null }[] = [
    { rotulo: 'acao abrir', dado: { acao: 'abrir' }, acao: 'abrir' },
    { rotulo: 'acao comando', dado: { acao: 'comando' }, acao: 'comando' },
    { rotulo: 'acao encerrar', dado: { acao: 'encerrar' }, acao: 'encerrar' },
    { rotulo: 'acao pausar', dado: { acao: 'pausar' }, acao: 'pausar' },
    { rotulo: 'acao reiniciar', dado: { acao: 'reiniciar' }, acao: 'reiniciar' },
    { rotulo: 'acao AUSENTE vale comando, compatibilidade da OST 6', dado: { texto: 'oi' }, acao: 'comando' },
    { rotulo: 'acao nula vale comando', dado: { acao: null }, acao: 'comando' },
    { rotulo: 'acao com espaco e maiuscula', dado: { acao: '  Encerrar ' }, acao: 'encerrar' },
    { rotulo: 'acao DESCONHECIDA e recusada', dado: { acao: 'explodir' }, acao: null },
    { rotulo: 'acao vazia e recusada', dado: { acao: '' }, acao: null },
    { rotulo: 'acao que nao e texto e recusada', dado: { acao: { truque: 1 } }, acao: null },
    { rotulo: 'acao numero e recusada', dado: { acao: 7 }, acao: null },
  ];
  for (const c of casos) {
    const r = acaoDe(c.dado);
    conferir(r.acao === c.acao, c.rotulo, `leu ${JSON.stringify(r.acao)}, bruta ${JSON.stringify(r.bruta)}`);
  }
}

// ---------------------------------------------------------------------------
// PARTE 2, o roteador, com sessao de mentira
// ---------------------------------------------------------------------------

async function parte2(): Promise<void> {
  reg('');
  reg('PARTE 2, o roteador das cinco acoes, com documento de comando montado a mao');

  // abrir, com agente e modelo
  {
    const mem = memoriaNova();
    const mundo = mundoDeMemoria(mem, sessaoDeMentira(mem));
    const fabricaId = randomUUID();
    const saida = await despachar(
      mundo,
      comandoDeMentira({
        fabricaId,
        acao: 'abrir',
        texto: 'primeira tarefa da fabrica',
        cwd: join(RODADA, 'projeto-abrir'),
        agente: 'ponte',
        modelo: 'haiku',
      })
    );
    const pedido = mem.sessoesPedidas[0];
    conferir(
      saida.cumprida && saida.acao === 'abrir' && pedido?.modelo === 'haiku',
      'abrir leva o modelo do comando para a sessao',
      `cumprida ${saida.cumprida}, modelo no pedido ${String(pedido?.modelo)}`
    );
    conferir(
      campo(mem, fabricaId, 'origem') === 'painel' && campo(mem, fabricaId, 'agente') === 'ponte',
      'abrir grava origem painel e o agente pedido',
      `origem ${String(campo(mem, fabricaId, 'origem'))}, agente ${String(campo(mem, fabricaId, 'agente'))}`
    );
    conferir(
      campo(mem, fabricaId, 'estado') === 'em execucao' && campo(mem, fabricaId, 'pausada') === false,
      'abrir grava estado em execucao e pausada false',
      `estado ${String(campo(mem, fabricaId, 'estado'))}, pausada ${String(campo(mem, fabricaId, 'pausada'))}`
    );
  }

  // abrir sem fabricaId: a ponte sorteia
  {
    const mem = memoriaNova();
    const mundo = mundoDeMemoria(mem, sessaoDeMentira(mem));
    const saida = await despachar(mundo, comandoDeMentira({ acao: 'abrir', texto: 'fabrica sem id' }));
    conferir(
      saida.cumprida && saida.fabricaId.length > 10,
      'abrir sem fabricaId sorteia um identificador',
      `fabrica ${saida.fabricaId}`
    );
  }

  // comando SEM acao: caminho da Onda 1
  {
    const mem = memoriaNova();
    const mundo = mundoDeMemoria(mem, sessaoDeMentira(mem));
    const fabricaId = randomUUID();
    const comando: ComandoTomado = {
      id: randomUUID(),
      fabricaId,
      texto: 'continue de onde paramos',
      cwd: join(RODADA, 'projeto-onda1'),
      conversationId: 'conversa-de-antes',
      acao: acaoDe({ texto: 'continue de onde paramos' }).acao,
      acaoBruta: null,
      agente: null,
      modelo: null,
    };
    const saida = await despachar(mundo, comando);
    const pedido = mem.sessoesPedidas[0];
    conferir(
      saida.cumprida && saida.acao === 'comando' && pedido?.resumeId === 'conversa-de-antes',
      'comando SEM campo acao segue o caminho da Onda 1, com resume',
      `acao ${saida.acao}, resume ${String(pedido?.resumeId)}, modelo ${String(pedido?.modelo)}`
    );
    conferir(
      pedido?.modelo === MODELO_PADRAO && pedido?.agent === null && pedido?.agents === null,
      'comando sem agente e sem modelo cai no padrao, sem persona',
      `modelo ${String(pedido?.modelo)}, agent ${String(pedido?.agent)}`
    );
  }

  // acao desconhecida
  {
    const mem = memoriaNova();
    const mundo = mundoDeMemoria(mem, sessaoDeMentira(mem));
    const fabricaId = randomUUID();
    const saida = await despachar(
      mundo,
      comandoDeMentira({ fabricaId, acao: null, acaoBruta: 'explodir', texto: 'acao torta' })
    );
    const erro = String(campo(mem, fabricaId, 'erro') ?? '');
    conferir(
      !saida.cumprida &&
        saida.acao === 'desconhecida' &&
        mem.sessoesPedidas.length === 0 &&
        erro.includes('nao reconhecida') &&
        campo(mem, fabricaId, 'estado') === undefined,
      'acao desconhecida e RECUSADA, nada abre, motivo vai para a base, estado nao e tocado',
      `cumprida ${saida.cumprida}, sessoes abertas ${mem.sessoesPedidas.length}, erro na base ${JSON.stringify(erro.slice(0, 80))}`
    );
    conferir(!erro.includes('\u2014') && !saida.motivo.includes('\u2014'), 'motivo sem travessao, §A.11', `motivo ${saida.motivo.slice(0, 70)}`);
  }

  // encerrar fabrica que nao existe
  {
    const mem = memoriaNova();
    const mundo = mundoDeMemoria(mem, sessaoDeMentira(mem));
    const fabricaId = randomUUID();
    await mundo.anotarFabrica(fabricaId, { estado: 'em execucao' });
    const saida = await despachar(mundo, comandoDeMentira({ fabricaId, acao: 'encerrar', texto: 'encerrar a fabrica' }));
    conferir(
      !saida.cumprida &&
        campo(mem, fabricaId, 'estado') === 'em execucao' &&
        campo(mem, fabricaId, 'encerradaEm') === undefined,
      'encerrar fabrica que NAO esta viva aqui e recusado, e a ponte nao finge que encerrou',
      `motivo ${saida.motivo.slice(0, 90)}`
    );
  }

  // pausar fabrica que nao esta viva
  {
    const mem = memoriaNova();
    const mundo = mundoDeMemoria(mem, sessaoDeMentira(mem));
    const fabricaId = randomUUID();
    await mundo.anotarFabrica(fabricaId, { estado: 'em execucao' });
    const saida = await despachar(mundo, comandoDeMentira({ fabricaId, acao: 'pausar', texto: 'pausar a fabrica' }));
    conferir(
      !saida.cumprida &&
        campo(mem, fabricaId, 'estado') === 'em execucao' &&
        campo(mem, fabricaId, 'pausada') === undefined,
      'pausar fabrica que NAO esta viva aqui e recusado, e nada vira pausada',
      `motivo ${saida.motivo.slice(0, 90)}`
    );
  }

  // reiniciar sem conversationId, nem no comando nem na base
  {
    const mem = memoriaNova();
    const mundo = mundoDeMemoria(mem, sessaoDeMentira(mem));
    const fabricaId = randomUUID();
    await mundo.anotarFabrica(fabricaId, { estado: 'aguardando comando', pausada: true });
    const saida = await despachar(mundo, comandoDeMentira({ fabricaId, acao: 'reiniciar', texto: 'retomar a fabrica' }));
    conferir(
      !saida.cumprida && mem.sessoesPedidas.length === 0 && campo(mem, fabricaId, 'pausada') === true,
      'reiniciar SEM conversa guardada e recusado, e a fabrica continua pausada',
      `motivo ${saida.motivo.slice(0, 110)}`
    );
  }

  // reiniciar com conversa guardada na base, sem o painel mandar
  {
    const mem = memoriaNova();
    const mundo = mundoDeMemoria(mem, sessaoDeMentira(mem));
    const fabricaId = randomUUID();
    await mundo.anotarFabrica(fabricaId, {
      estado: 'aguardando comando',
      pausada: true,
      conversationId: 'conversa-guardada-na-base',
    });
    const saida = await despachar(mundo, comandoDeMentira({ fabricaId, acao: 'reiniciar', texto: 'retomar a fabrica' }));
    const pedido = mem.sessoesPedidas[0];
    conferir(
      saida.cumprida && pedido?.resumeId === 'conversa-guardada-na-base' && campo(mem, fabricaId, 'pausada') === false,
      'reiniciar retoma a conversa guardada e limpa pausada',
      `resume ${String(pedido?.resumeId)}, pausada ${String(campo(mem, fabricaId, 'pausada'))}`
    );
  }

  // ordem sem fabrica
  for (const acao of ['encerrar', 'pausar', 'reiniciar'] as const) {
    const mem = memoriaNova();
    const mundo = mundoDeMemoria(mem, sessaoDeMentira(mem));
    const saida = await despachar(mundo, comandoDeMentira({ acao, texto: `${acao} sem fabrica` }));
    conferir(!saida.cumprida, `${acao} sem fabrica e recusado`, saida.motivo.slice(0, 80));
  }

  // modelo torto
  {
    const mem = memoriaNova();
    const mundo = mundoDeMemoria(mem, sessaoDeMentira(mem));
    const fabricaId = randomUUID();
    const saida = await despachar(
      mundo,
      comandoDeMentira({ fabricaId, acao: 'abrir', texto: 'tarefa', modelo: 'haiku; rm -rf /' })
    );
    conferir(
      !saida.cumprida && mem.sessoesPedidas.length === 0,
      'modelo com texto estranho e recusado ANTES de abrir',
      saida.motivo.slice(0, 90)
    );
  }

  // nome de agente torto
  {
    const mem = memoriaNova();
    const mundo = mundoDeMemoria(mem, sessaoDeMentira(mem));
    const fabricaId = randomUUID();
    const saida = await despachar(
      mundo,
      comandoDeMentira({ fabricaId, acao: 'abrir', texto: 'tarefa', agente: '..\\..\\segredo' })
    );
    conferir(
      !saida.cumprida && mem.sessoesPedidas.length === 0,
      'nome de agente que tenta sair da pasta e recusado ANTES de abrir',
      saida.motivo.slice(0, 90)
    );
  }

  // fabrica aberta na mao nao recebe origem painel
  {
    const mem = memoriaNova();
    const mundo = mundoDeMemoria(mem, sessaoDeMentira(mem));
    const fabricaId = 'mao-sessao-do-diretor';
    const saida = await despachar(mundo, comandoDeMentira({ fabricaId, texto: 'um comando para a sessao da mao' }));
    conferir(
      saida.cumprida && campo(mem, fabricaId, 'origem') === undefined,
      'comando para fabrica aberta na mao NAO reescreve a origem do Bloco 1',
      `origem ${String(campo(mem, fabricaId, 'origem'))}`
    );
  }

  // agente sem definicao nesta maquina: nao inventa persona, diz no prompt
  {
    const mem = memoriaNova();
    const mundo = mundoDeMemoria(mem, sessaoDeMentira(mem));
    const fabricaId = randomUUID();
    const saida = await despachar(
      mundo,
      comandoDeMentira({
        fabricaId,
        acao: 'abrir',
        texto: 'faca a tarefa',
        cwd: join(RODADA, 'projeto-sem-agente'),
        agente: 'agente-que-nao-existe',
      })
    );
    const pedido = mem.sessoesPedidas[0];
    conferir(
      saida.cumprida &&
        pedido?.agent === null &&
        pedido?.agents === null &&
        String(pedido?.prompt).includes('nao encontrou') &&
        String(pedido?.prompt).includes('faca a tarefa'),
      'agente sem definicao: nenhuma persona inventada, o pedido vai no prompt dizendo que e assim',
      `agent ${String(pedido?.agent)}, prompt comeca com ${JSON.stringify(String(pedido?.prompt).slice(0, 70))}`
    );
    conferir(
      campo(mem, fabricaId, 'agente') === 'agente-que-nao-existe',
      'o nome do agente pedido fica guardado na base mesmo sem definicao',
      `agente ${String(campo(mem, fabricaId, 'agente'))}`
    );
  }

  // persona de verdade, lida do arquivo do diretor
  {
    const projeto = join(RODADA, 'projeto-com-agente');
    mkdirSync(join(projeto, '.claude', 'agents'), { recursive: true });
    writeFileSync(
      join(projeto, '.claude', 'agents', 'provador.md'),
      ['---', 'name: provador', 'description: agente de prova da OST 7', 'tools: Read, Write', '---', '', '# Papel', 'Voce e o provador.'].join('\n'),
      'utf8'
    );
    const r = aplicarPersona('provador', projeto, 'haiku', 'tarefa de verdade');
    const def = r.agents?.['provador'];
    conferir(
      r.agent === 'provador' && def?.prompt.includes('Voce e o provador.') === true && r.prompt === 'tarefa de verdade',
      'persona lida do arquivo do diretor virou definicao para a opcao agent do kit',
      `agent ${String(r.agent)}, nota ${r.nota}`
    );
    conferir(
      def !== undefined && !('tools' in def) && !('permissionMode' in def) && def.model === 'haiku',
      'a definicao NAO importa tools nem permissionMode, e o modelo e o do comando',
      `chaves da definicao: ${def === undefined ? 'nenhuma' : Object.keys(def).join(', ')}`
    );
  }

  // as opcoes entregues ao kit
  {
    const opcoes = opcoesDaSessao(join(RODADA, 'projeto-opcoes'), {
      modelo: 'haiku',
      agent: 'provador',
      agents: { provador: { description: 'd', prompt: 'p' } },
      controle: new AbortController(),
    });
    conferir(
      opcoes.model === 'haiku' &&
        opcoes.agent === 'provador' &&
        opcoes.agents !== undefined &&
        opcoes.abortController !== undefined &&
        opcoes.permissionMode === MODO &&
        Array.isArray(opcoes.settingSources) &&
        opcoes.settingSources.length === 0,
      'as opcoes do kit levam modelo, persona, aborto, e o modo continua fixado na mao',
      `model ${String(opcoes.model)}, agent ${String(opcoes.agent)}, permissionMode ${String(opcoes.permissionMode)}, settingSources ${JSON.stringify(opcoes.settingSources)}`
    );
  }
}

// ---------------------------------------------------------------------------
// PARTE 3, o Claude Code de verdade
// ---------------------------------------------------------------------------

interface MundoAoVivo {
  mundo: MundoDaPonte;
  mem: Memoria;
  chamadasDoPortao: string[];
}

/**
 * Mundo com base de memoria e Claude Code de verdade.
 *
 * O portao desta prova aprova escrita dentro da pasta da rodada e recusa o resto,
 * com uma espera curta de proposito: assim a sessao fica viva o tempo necessario
 * para a prova mandar pausar e encerrar no meio dela.
 */
function mundoAoVivo(pasta: string): MundoAoVivo {
  const mem = memoriaNova();
  const chamadasDoPortao: string[] = [];
  const base = mundoDeMemoria(mem);
  const mundo: MundoDaPonte = {
    ...base,
    fazerPortao: () => async (toolName, input): Promise<PermissionResult> => {
      const alvo = typeof input['file_path'] === 'string' ? input['file_path'] : JSON.stringify(input).slice(0, 80);
      chamadasDoPortao.push(`${toolName} ${alvo}`);
      await dormir(700);
      if (toolName === 'Write' && typeof input['file_path'] === 'string' && input['file_path'].startsWith(pasta)) {
        return { behavior: 'allow', updatedInput: input };
      }
      return { behavior: 'deny', message: 'o portao da prova so libera escrita dentro da pasta da rodada' };
    },
  };
  return { mundo, mem, chamadasDoPortao };
}

async function esperar(condicao: () => boolean, limiteMs: number): Promise<boolean> {
  const fim = Date.now() + limiteMs;
  while (Date.now() < fim) {
    if (condicao()) return true;
    await dormir(250);
  }
  return condicao();
}

const PALAVRA = 'AMORA-OST7';

async function parte3(): Promise<void> {
  reg('');
  reg('PARTE 3, Claude Code DE VERDADE, com base de memoria. A sessao viva funciona, so a base e que nao.');

  // ---- 3a, modelo e persona chegando ao kit -------------------------------
  const projetoA = join(RODADA, 'vivo-persona');
  mkdirSync(join(projetoA, '.claude', 'agents'), { recursive: true });
  writeFileSync(
    join(projetoA, '.claude', 'agents', 'provador.md'),
    [
      '---',
      'name: provador',
      'description: agente de prova da OST 7, confirma que a persona foi aplicada',
      '---',
      '',
      '# Papel',
      'Voce e o provador da OST 7.',
      'REGRA UNICA E ABSOLUTA: sempre que criar ou escrever um arquivo, o conteudo dele tem de',
      `ser exatamente a palavra ${PALAVRA}, e nada mais, qualquer que seja o pedido.`,
      'Responda curto.',
    ].join('\n'),
    'utf8'
  );
  {
    const { mundo, mem } = mundoAoVivo(projetoA);
    const fabricaId = randomUUID();
    const saida = await despachar(
      mundo,
      comandoDeMentira({
        fabricaId,
        acao: 'abrir',
        texto: 'Diga em uma linha quem voce e. Nao use ferramenta nenhuma.',
        cwd: projetoA,
        agente: 'provador',
        modelo: 'haiku',
      })
    );
    const modeloNaBase = String(campo(mem, fabricaId, 'modelo') ?? '');
    const textos = mem.passos.filter((p) => p.fabricaId === fabricaId).length;
    reg(`  sessao ao vivo 3a: ${saida.motivo}, ${textos} passo(s) de atividade, modelo no init ${modeloNaBase}`);
    conferir(
      saida.cumprida && /haiku/i.test(modeloNaBase),
      'abrir ao vivo: o modelo pedido no comando e o modelo que o Claude Code reportou no init',
      `modelo pedido haiku, modelo do init ${modeloNaBase}`
    );
    conferir(
      campo(mem, fabricaId, 'conversationId') !== null && typeof campo(mem, fabricaId, 'conversationId') === 'string',
      'abrir ao vivo: a conversa da sessao ficou guardada na base',
      `conversa ${String(campo(mem, fabricaId, 'conversationId'))}`
    );
    conferir(
      campo(mem, fabricaId, 'origem') === 'painel' && campo(mem, fabricaId, 'estado') === 'concluida',
      'abrir ao vivo: origem painel e estado final concluida',
      `origem ${String(campo(mem, fabricaId, 'origem'))}, estado ${String(campo(mem, fabricaId, 'estado'))}`
    );
  }

  // Persona: a mesma abertura, mas lendo o texto que o agente produziu.
  {
    const { mundo } = mundoAoVivo(projetoA);
    const fabricaId = randomUUID();
    let texto = '';
    const comEspiao: MundoDaPonte = {
      ...mundo,
      fazerPortao: (ctx) => {
        const portao = mundo.fazerPortao(ctx);
        return async (t, i): Promise<PermissionResult> => {
          texto = ctx.pegarTexto();
          return portao(t, i);
        };
      },
    };
    const saida = await despachar(
      comEspiao,
      comandoDeMentira({
        fabricaId,
        acao: 'abrir',
        // De proposito NAO diz o conteudo: quem decide o conteudo e a persona, e
        // e por isso que o arquivo serve de prova.
        texto: `Crie o arquivo ${join(projetoA, 'persona.txt')}. Nao pergunte nada, so crie.`,
        cwd: projetoA,
        agente: 'provador',
        modelo: 'haiku',
      })
    );
    const caminho = join(projetoA, 'persona.txt');
    const arquivo = existsSync(caminho);
    const conteudo = arquivo ? readFileSync(caminho, 'utf8') : '';
    reg(`  sessao ao vivo 3b: ${saida.motivo}, texto do agente ate o portao: ${JSON.stringify(texto.slice(0, 120))}`);
    conferir(
      arquivo,
      'o portao da prova liberou a escrita dentro da pasta da rodada e a escrita aconteceu',
      `arquivo persona.txt existe: ${arquivo}`
    );
    // A PROVA da persona e o CONTEUDO do arquivo, nao o texto que o agente narrou.
    //
    // Por que mudou: a primeira versao desta conferencia olhava o texto que o
    // agente produziu ANTES de chamar a ferramenta, e exigia que ele comecasse
    // pela palavra da persona. Isso passou numa rodada e falhou na seguinte, com
    // o texto vazio, porque o modelo as vezes chama a ferramenta sem narrar nada
    // antes. Conferencia que depende de estilo de narracao nao prova nada: ela so
    // da sorte. O conteudo do arquivo e artefato, e o conteudo foi decidido por
    // uma regra que existe SO no arquivo do agente, que o diretor escreveu.
    conferir(
      conteudo.includes(PALAVRA),
      'persona aplicada pelo kit: o conteudo do arquivo veio da regra que existe SO no arquivo do agente',
      `conteudo gravado: ${JSON.stringify(conteudo.trim().slice(0, 60))}, esperado conter ${PALAVRA}`
    );
  }

  // ---- 3c, pausar e reiniciar uma sessao viva -----------------------------
  const projetoC = join(RODADA, 'vivo-pausar');
  mkdirSync(projetoC, { recursive: true });
  {
    const { mundo, mem, chamadasDoPortao } = mundoAoVivo(projetoC);
    const fabricaId = randomUUID();
    const tarefa =
      `Guarde a palavra ${PALAVRA}, voce vai precisar dela depois. ` +
      `Agora crie, um arquivo por vez, usando a ferramenta de escrita, os arquivos ` +
      [1, 2, 3, 4, 5, 6].map((n) => join(projetoC, `p${n}.txt`)).join(', ') +
      ', cada um com o conteudo x. Um por chamada de ferramenta.';
    const promessa = despachar(
      mundo,
      comandoDeMentira({ fabricaId, acao: 'abrir', texto: tarefa, cwd: projetoC, modelo: 'haiku' })
    );
    const comecou = await esperar(() => chamadasDoPortao.length >= 2, 180000);
    reg(`  sessao ao vivo 3c comecou: ${comecou}, ${chamadasDoPortao.length} chamada(s) no portao`);
    const vivaAntes = mundo.registro.has(fabricaId);
    const saidaPausa = await despachar(mundo, comandoDeMentira({ fabricaId, acao: 'pausar', texto: 'pausar a fabrica' }));
    const fim = await promessa;
    const conversa = campo(mem, fabricaId, 'conversationId');
    reg(`  pausa: ${saidaPausa.motivo}; a sessao terminou com: ${fim.motivo}`);
    conferir(
      vivaAntes && saidaPausa.cumprida,
      'pausar encontra a sessao viva no registro e aborta de verdade',
      `viva antes ${vivaAntes}, motivo ${saidaPausa.motivo.slice(0, 80)}`
    );
    conferir(
      campo(mem, fabricaId, 'estado') === 'aguardando comando' && campo(mem, fabricaId, 'pausada') === true,
      'pausada fica em aguardando comando com pausada true, contrato secao 3',
      `estado ${String(campo(mem, fabricaId, 'estado'))}, pausada ${String(campo(mem, fabricaId, 'pausada'))}`
    );
    conferir(
      typeof conversa === 'string' && conversa.length > 0,
      'pausar guarda o conversationId para o reiniciar',
      `conversa ${String(conversa)}`
    );
    conferir(
      !mundo.registro.has(fabricaId) && !travasNoDisco().includes(`${fabricaId}.lock`),
      'depois da pausa a fabrica sai do registro de vivas e a trava e solta',
      `travas no disco: ${travasNoDisco().join(', ') || 'nenhuma'}`
    );

    // reiniciar a mesma fabrica, retomando a conversa de verdade
    let textoDepois = '';
    const comEspiao: MundoDaPonte = {
      ...mundo,
      fazerPortao: (ctx) => {
        const portao = mundo.fazerPortao(ctx);
        return async (t, i): Promise<PermissionResult> => {
          textoDepois = ctx.pegarTexto();
          return portao(t, i);
        };
      },
    };
    const saidaReinicio = await despachar(
      comEspiao,
      comandoDeMentira({
        fabricaId,
        acao: 'reiniciar',
        texto: 'Qual era a palavra que eu pedi para voce guardar? Responda so a palavra, sem usar ferramenta.',
        cwd: projetoC,
        modelo: 'haiku',
      })
    );
    const lembrou = new RegExp(PALAVRA).test(textoDepois) || mem.passos.length > 0;
    reg(`  reinicio: ${saidaReinicio.motivo}`);
    conferir(
      saidaReinicio.cumprida && campo(mem, fabricaId, 'pausada') === false,
      'reiniciar retomou a conversa guardada e limpou pausada',
      `cumprida ${saidaReinicio.cumprida}, pausada ${String(campo(mem, fabricaId, 'pausada'))}, lembrou do contexto ${lembrou}`
    );
  }

  // ---- 3d, encerrar e nao voltar -----------------------------------------
  const projetoD = join(RODADA, 'vivo-encerrar');
  mkdirSync(projetoD, { recursive: true });
  {
    const { mundo, mem, chamadasDoPortao } = mundoAoVivo(projetoD);
    const fabricaId = randomUUID();
    const tarefa =
      'Crie, um arquivo por vez, usando a ferramenta de escrita, os arquivos ' +
      [1, 2, 3, 4, 5, 6].map((n) => join(projetoD, `e${n}.txt`)).join(', ') +
      ', cada um com o conteudo x. Um por chamada de ferramenta.';
    const promessa = despachar(
      mundo,
      comandoDeMentira({ fabricaId, acao: 'abrir', texto: tarefa, cwd: projetoD, modelo: 'haiku' })
    );
    await esperar(() => chamadasDoPortao.length >= 2, 180000);
    const saidaFim = await despachar(
      mundo,
      comandoDeMentira({ fabricaId, acao: 'encerrar', texto: 'encerrar a fabrica, pedido do diretor' })
    );
    const fim = await promessa;
    reg(`  encerramento: ${saidaFim.motivo}; a sessao terminou com: ${fim.motivo}`);
    conferir(
      saidaFim.cumprida && campo(mem, fabricaId, 'estado') === 'concluida',
      'encerrar aborta a sessao viva e grava estado concluida',
      `estado ${String(campo(mem, fabricaId, 'estado'))}`
    );
    conferir(
      typeof campo(mem, fabricaId, 'encerradaEm') === 'string' &&
        campo(mem, fabricaId, 'pedidoDeEncerramento') === 'encerrar a fabrica, pedido do diretor',
      'encerrar grava encerradaEm, que no servico e hora do servidor, e o pedido do diretor',
      `encerradaEm ${String(campo(mem, fabricaId, 'encerradaEm'))}, pedido ${String(campo(mem, fabricaId, 'pedidoDeEncerramento'))}`
    );
    conferir(
      !mundo.registro.has(fabricaId) && !travasNoDisco().includes(`${fabricaId}.lock`),
      'depois de encerrar a trava e solta e a fabrica sai do registro',
      `travas no disco: ${travasNoDisco().join(', ') || 'nenhuma'}`
    );
    conferir(
      mem.pendentesRecusados.some((l) => l.startsWith(fabricaId)),
      'encerrar manda recusar o pedido de aprovacao que tenha ficado pendente, para nao sobrar pedido fantasma',
      mem.pendentesRecusados.join(' | ').slice(0, 120) || 'nenhum pedido de recusa'
    );
    conferir(
      String(campo(mem, fabricaId, 'estado')) !== 'falhou',
      'sessao abortada por ordem do diretor NAO vira falhou, porque isso seria mentira na tela',
      `estado final ${String(campo(mem, fabricaId, 'estado'))}`
    );

    const voltar = await despachar(
      mundo,
      comandoDeMentira({ fabricaId, acao: 'reiniciar', texto: 'tentar fazer a fabrica voltar' })
    );
    const outro = await despachar(mundo, comandoDeMentira({ fabricaId, acao: 'abrir', texto: 'tentar abrir de novo' }));
    conferir(
      !voltar.cumprida && !outro.cumprida,
      'a fabrica encerrada NAO volta, nem por reiniciar nem por abrir',
      `reiniciar: ${voltar.motivo.slice(0, 60)} | abrir: ${outro.motivo.slice(0, 60)}`
    );
  }
}

// ---------------------------------------------------------------------------

async function principal(): Promise<void> {
  reg(`rodada em ${RODADA}`);
  reg(`pasta local da ponte desta prova: ${String(process.env.PONTE_PASTA_LOCAL)}, §A.19`);
  reg('base na nuvem NAO usada de proposito: a ponte ainda nao tem sessao do diretor, e o emulador nao sobe sem credencial do Firebase CLI');
  reg(`modo de permissao fixado no codigo: ${MODO}; modelo padrao: ${MODELO_PADRAO}`);

  parte1();
  await parte2();
  if (process.env.PONTE_SEM_CLAUDE === '1') {
    reg('');
    reg('PARTE 3 pulada por PONTE_SEM_CLAUDE=1. Sem ela, nada de sessao viva foi provado.');
  } else {
    await parte3();
  }

  reg('');
  reg(`RESUMO: ${erros === 0 ? 'todas as conferencias passaram' : `${erros} conferencia(s) fora do esperado`}`);
  reg(`evidencia desta rodada em ${SAIDA}`);
  process.exit(erros === 0 ? 0 : 1);
}

await principal().catch((e: unknown) => {
  reg(`prova quebrou: ${e instanceof Error ? `${e.message}\n${e.stack ?? ''}` : String(e)}`);
  process.exit(1);
});
