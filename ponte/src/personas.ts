// personas.ts, o campo `agente` do comando chegando ao Claude Code de verdade.
//
// O QUE O KIT SUPORTA, conferido no proprio kit instalado
// -------------------------------------------------------
// ponte/node_modules/@anthropic-ai/claude-agent-sdk/sdk.d.ts traz, em `Options`:
//
//   agent?: string    "Agent name for the main thread. When specified, the agent's
//                      system prompt, tool restrictions, and model will be applied
//                      to the main conversation. The agent must be defined either
//                      in the `agents` option or in settings."
//   agents?: Record<string, AgentDefinition>
//
// Entao existe forma suportada, e e esta: `agent` aponta o nome, `agents` traz a
// definicao. Nao e invencao da ponte, e a opcao do kit, equivalente a bandeira
// --agent da linha de comando.
//
// DE ONDE VEM A DEFINICAO, e por que nao e inventada
// --------------------------------------------------
// A ponte abre a sessao com `settingSources: []`, de proposito: nao carregar
// configuracao de projeto e o que impede um projeto qualquer de instalar permissao
// ou gancho que passe por cima do portao. O preco e que o kit tambem nao descobre
// sozinho os agentes de `.claude/agents`. Entao a ponte LE o arquivo do agente ela
// mesma, do jeito que o diretor ja escreve hoje, e entrega a definicao pela opcao
// `agents`.
//
// Leitura, nunca escrita, §A.9: este arquivo abre o .md do agente e nada mais.
// Nao cria, nao altera, nao remove configuracao de ninguem.
//
// O QUE A PONTE NAO IMPORTA DO ARQUIVO, e e decisao consciente
// ------------------------------------------------------------
// 1. `tools`. A definicao do kit aceita restringir ferramentas, e a ponte NAO
//    repassa essa lista. Dois motivos: o controle de verdade e o portao, que para
//    toda chamada de risco e espera o diretor; e a ressalva 1 da seguranca precisa
//    que a isca de escrita seja alcancavel, senao a verificacao do portao daria
//    "portao morto" para todo agente sem ferramenta de escrita, e a fabrica nao
//    nasceria por um motivo falso.
// 2. `permissionMode`. Nunca. O modo e fixado na mao pela ponte e conferido no
//    init, §A.6. Definicao de agente nao mexe nisso.
// 3. `model`. A ponte grava o modelo resolvido do comando na propria definicao,
//    para o arquivo do agente nao trocar o modelo que o diretor escolheu no painel.
//
// SEM DEFINICAO NA MAQUINA
// ------------------------
// Se o agente pedido nao tem arquivo, a ponte NAO inventa persona e NAO passa
// `agent` para o kit, porque nome sem definicao e recusado pelo proprio kit. Ela
// guarda o nome na base e diz no prompt de abertura, com estas palavras, que a
// persona veio por instrucao e nao por definicao de agente. Honestidade acima de
// aparencia.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { SEPARADOR, caminhoComparavel, casaDoDiretor } from './plataforma.js';
import { dirname, join, resolve } from 'node:path';
import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';

/**
 * Nome de agente aceito: letra, numero, espaco, ponto, sublinhado e hifen.
 *
 * Isto e barreira de seguranca, nao capricho: o nome vira pedaco de caminho de
 * arquivo. Barra, contrabarra, dois pontos, ".." e caractere de controle ficam de
 * fora, entao nao existe como o campo `agente` da base apontar para fora da pasta
 * de agentes. Nome que nao passa aqui NAO abre fabrica, §A.6.
 *
 * Espaco entra na lista por um motivo medido: o painel manda `claude code` neste
 * campo, que e o valor que a propria ponte grava desde a Onda 1. Recusar nome com
 * espaco derrubava a abertura de fabrica vinda do painel por um motivo falso.
 */
const NOME_ACEITO = /^[A-Za-z0-9][A-Za-z0-9 ._-]{0,59}$/;

export function nomeDeAgenteAceito(nome: string): boolean {
  return NOME_ACEITO.test(nome) && !nome.includes('..');
}

/**
 * O nome do proprio motor, que a ponte grava desde a Onda 1 e o painel repete.
 *
 * Nao e persona: e o Claude Code. Quando o comando vem com este valor, a ponte
 * entende "nenhum agente pedido" e nao sai procurando definicao de agente nem
 * escreve instrucao de abertura nenhuma. Fingir que procurou uma persona chamada
 * Claude Code seria teatro.
 */
export const NOME_DO_MOTOR = 'claude code';

export interface PersonaEncontrada {
  nome: string;
  descricao: string;
  prompt: string;
  caminho: string;
}

export interface LeituraDePersona {
  /** A persona lida do arquivo do diretor, ou null quando nao existe. */
  persona: PersonaEncontrada | null;
  /** Onde a ponte procurou, por extenso, para o relatorio nao ser vago. */
  procurouEm: string[];
  /** Motivo legivel quando nao achou ou quando o nome foi recusado. */
  motivo: string | null;
}

function pastasDeAgentes(cwd: string): string[] {
  return [join(cwd, '.claude', 'agents'), join(casaDoDiretor(), '.claude', 'agents')];
}

/** Separa o cabecalho em YAML simples do corpo do arquivo de agente. */
function separar(bruto: string): { cabecalho: Record<string, string>; corpo: string } {
  const texto = bruto.charCodeAt(0) === 0xfeff ? bruto.slice(1) : bruto;
  const cabecalho: Record<string, string> = {};
  const linhas = texto.split(/\r?\n/);
  if (linhas[0]?.trim() !== '---') return { cabecalho, corpo: texto.trim() };
  let fim = -1;
  for (let i = 1; i < linhas.length; i++) {
    if (linhas[i]?.trim() === '---') {
      fim = i;
      break;
    }
    const linha = linhas[i] ?? '';
    const corte = linha.indexOf(':');
    if (corte > 0) {
      const chave = linha.slice(0, corte).trim().toLowerCase();
      const valor = linha.slice(corte + 1).trim();
      if (chave.length > 0 && valor.length > 0) cabecalho[chave] = valor;
    }
  }
  if (fim < 0) return { cabecalho: {}, corpo: texto.trim() };
  return { cabecalho, corpo: linhas.slice(fim + 1).join('\n').trim() };
}

/** Procura a definicao do agente nas pastas de agentes, do projeto e do usuario. */
export function lerPersona(nome: string, cwd: string): LeituraDePersona {
  if (!nomeDeAgenteAceito(nome)) {
    return {
      persona: null,
      procurouEm: [],
      motivo: `nome de agente recusado por seguranca: ${JSON.stringify(nome.slice(0, 60))}`,
    };
  }
  const procurouEm = pastasDeAgentes(cwd).map((p) => join(p, `${nome}.md`));
  for (const caminho of procurouEm) {
    if (!existsSync(caminho)) continue;
    let bruto = '';
    try {
      bruto = readFileSync(caminho, 'utf8');
    } catch {
      continue;
    }
    const { cabecalho, corpo } = separar(bruto);
    if (corpo.length === 0) continue;
    return {
      persona: {
        nome,
        descricao: cabecalho['description'] ?? `agente ${nome} da maquina do diretor`,
        prompt: corpo,
        caminho,
      },
      procurouEm,
      motivo: null,
    };
  }
  return {
    persona: null,
    procurouEm,
    motivo: `nao existe definicao do agente ${nome} nesta maquina`,
  };
}

export interface PersonaAplicada {
  /** Vai para `Options.agent`, ou null quando nao ha definicao. */
  agent: string | null;
  /** Vai para `Options.agents`, ou null quando nao ha definicao. */
  agents: Record<string, AgentDefinition> | null;
  /** Prompt final entregue ao Claude Code. Igual ao pedido quando a definicao existe. */
  prompt: string;
  /** Texto para a trilha e para o registro na tela, sem travessao, §A.11. */
  nota: string;
}

/**
 * Resolve o campo `agente` do comando em opcoes do kit mais prompt final.
 *
 * Sem agente pedido: nada muda, e o caminho da Onda 1 segue igual.
 */
export function aplicarPersona(
  agente: string | null,
  cwd: string,
  modelo: string,
  pedido: string
): PersonaAplicada {
  if (agente === null || agente.trim().length === 0) {
    return { agent: null, agents: null, prompt: pedido, nota: 'nenhum agente pedido' };
  }
  if (agente.trim().toLowerCase() === NOME_DO_MOTOR) {
    return { agent: null, agents: null, prompt: pedido, nota: 'nenhum agente pedido, o campo traz o nome do motor' };
  }
  const nome = agente.trim();
  const leitura = lerPersona(nome, cwd);
  const p = leitura.persona;
  if (p === null) {
    const onde = leitura.procurouEm.length > 0 ? leitura.procurouEm.join(' e ') : 'nenhum caminho valido';
    const prompt =
      'Instrucao de abertura, escrita pela ponte da Fabrica, nao pelo diretor: o diretor pediu que ' +
      `esta fabrica rodasse como o agente ${JSON.stringify(nome)}. A ponte procurou a definicao desse ` +
      `agente em ${onde} e nao encontrou, entao nenhuma persona foi aplicada pelo kit do Claude Code. ` +
      'Trabalhe no pedido abaixo e diga, no seu relatorio, que a persona veio por instrucao de abertura ' +
      'e nao por definicao de agente.\n\nPedido do diretor:\n' +
      pedido;
    return {
      agent: null,
      agents: null,
      prompt,
      nota: `${leitura.motivo ?? 'definicao ausente'}, nome guardado na base e dito no prompt de abertura`,
    };
  }
  // Definicao montada pela ponte a partir do arquivo do diretor. Sem `tools`, sem
  // `permissionMode`, e com o modelo do comando, pelos motivos do cabecalho.
  const definicao: AgentDefinition = { description: p.descricao, prompt: p.prompt, model: modelo };
  return {
    agent: nome,
    agents: { [nome]: definicao },
    prompt: pedido,
    nota: `persona aplicada pelo kit, opcao agent, definicao lida de ${p.caminho}`,
  };
}

// ---------------------------------------------------------------------------
// OST 11, Onda 2: OS AGENTES DO PROJETO, todos, lidos de cada projeto.
// ---------------------------------------------------------------------------
//
// Regra do diretor: a sessao principal e o COORDENADOR, porta de entrada da
// fabrica, e os outros agentes sao os que ele despacha. Cada projeto tem a sua
// fabrica no mesmo modelo, mas os nomes mudam (aqui existe "ponte", em outro
// existe "ia"). Por isso nada de nome fixo no codigo: a ponte le a pasta
// .claude/agents do projeto, arquivo por arquivo.
//
// Isto serve a duas coisas:
// 1. A fabrica aberta pelo painel roda com `settingSources: []`, e por isso o
//    kit nao descobre sozinho os agentes do projeto. Sem isto, o coordenador de
//    uma fabrica do painel nao tinha quem despachar. Agora todos vao pela opcao
//    `agents`, com as mesmas decisoes conscientes do cabecalho: sem `tools`, sem
//    `permissionMode`; o portao continua parando toda chamada de risco, tambem
//    a de subagente.
// 2. O painel precisa saber quais agentes a fabrica tem, para desenhar um
//    cartao por agente. A ponte publica so o nome e a descricao.
//
// Leitura, nunca escrita, §A.9.

export const NOME_DO_COORDENADOR = 'coordenador';

/** Teto de agentes por projeto, para um projeto torto nao inundar a base. */
const TETO_DE_AGENTES = 40;

export interface AgenteDoProjeto {
  nome: string;
  descricao: string;
  prompt: string;
  /** Modelo que o arquivo pede, quando e um dos que o kit aceita. */
  modelo: 'sonnet' | 'opus' | 'haiku' | 'inherit' | null;
}

function comparavelDePasta(c: string): string {
  // Windows como antes; Linux sem baixar a caixa, OST 14. Veja plataforma.ts.
  return caminhoComparavel(resolve(c));
}

function pastaDeAgentesAqui(pasta: string): string | null {
  const alvo = join(pasta, '.claude', 'agents');
  try {
    return statSync(alvo).isDirectory() ? alvo : null;
  } catch {
    return null;
  }
}

/**
 * OST 13, P2: a pasta .claude/agents do projeto.
 *
 * Sem `subir`, le SO o .claude/agents do proprio cwd, como sempre foi. Com
 * `subir`, e so quando o cwd esta DENTRO da pasta do usuario, sobe de pasta em
 * pasta ate achar, como o proprio Claude Code acha a raiz, e para antes da pasta
 * do usuario SEM ler a dela (a .claude/agents do usuario nao e do projeto).
 * Projeto fora da pasta do usuario (D:\x) le so o proprio cwd, sem subir.
 * Ressalva da seguranca na OST 13: a subida serve SO a lista do time publicada
 * na base (nome e descricao) da fabrica aberta na mao; a fabrica aberta pelo
 * painel le exatamente o cwd cadastrado.
 */
export function acharPastaDeAgentes(cwd: string, casa: string = casaDoDiretor(), subir = false): string | null {
  const pararEm = comparavelDePasta(casa);
  const inicio = comparavelDePasta(cwd);
  if (inicio === pararEm) return null;
  const dentroDaCasa = inicio.startsWith(`${pararEm}${SEPARADOR}`);
  if (!subir || !dentroDaCasa) return pastaDeAgentesAqui(resolve(cwd));
  let atual = resolve(cwd);
  for (let i = 0; i < 64; i++) {
    if (comparavelDePasta(atual) === pararEm) return null;
    const pasta = join(atual, '.claude', 'agents');
    try {
      if (statSync(pasta).isDirectory()) return pasta;
    } catch {
      // nao existe aqui, sobe
    }
    const pai = dirname(atual);
    if (pai === atual) return null;
    atual = pai;
  }
  return null;
}

/**
 * Agentes da pasta .claude/agents do projeto. Sem pasta, lista vazia. `subir`
 * so para a lista do time da fabrica aberta na mao; veja acharPastaDeAgentes.
 */
export function lerAgentesDoProjeto(
  cwd: string,
  opcoes: { subir?: boolean; casa?: string } = {}
): AgenteDoProjeto[] {
  const pasta = acharPastaDeAgentes(cwd, opcoes.casa ?? casaDoDiretor(), opcoes.subir === true);
  if (pasta === null) return [];
  let nomes: string[] = [];
  try {
    nomes = readdirSync(pasta).filter((n) => n.toLowerCase().endsWith('.md'));
  } catch {
    return [];
  }
  const saida: AgenteDoProjeto[] = [];
  for (const arquivo of nomes.sort()) {
    if (saida.length >= TETO_DE_AGENTES) break;
    let bruto = '';
    try {
      bruto = readFileSync(join(pasta, arquivo), 'utf8');
    } catch {
      continue;
    }
    const { cabecalho, corpo } = separar(bruto);
    const nome = (cabecalho['name'] ?? arquivo.slice(0, -3)).trim();
    if (!nomeDeAgenteAceito(nome) || corpo.length === 0) continue;
    if (saida.some((a) => a.nome === nome)) continue;
    const m = (cabecalho['model'] ?? '').trim().toLowerCase();
    saida.push({
      nome,
      descricao: (cabecalho['description'] ?? `agente ${nome} do projeto`).slice(0, 600),
      prompt: corpo,
      modelo: m === 'sonnet' || m === 'opus' || m === 'haiku' || m === 'inherit' ? m : null,
    });
  }
  return saida;
}

/** O que vai para a base: nome e descricao, nada do corpo do arquivo. */
export function agentesParaABase(agentes: AgenteDoProjeto[]): Array<{ nome: string; descricao: string }> {
  return agentes.map((a) => ({ nome: a.nome, descricao: a.descricao.slice(0, 300) }));
}

/**
 * A persona do comando MAIS todos os agentes do projeto, para o coordenador ter
 * quem despachar. Sem agente pedido (ou com o nome do motor) e com coordenador
 * no projeto, a sessao principal roda como o coordenador, regra do diretor.
 */
export function aplicarPersonaComTime(
  agente: string | null,
  cwd: string,
  modelo: string,
  pedido: string
): PersonaAplicada & { time: AgenteDoProjeto[] } {
  // Fabrica do painel: exatamente o .claude/agents do cwd cadastrado, sem subir.
  const time = lerAgentesDoProjeto(cwd, { subir: false });
  const semPedido =
    agente === null || agente.trim().length === 0 || agente.trim().toLowerCase() === NOME_DO_MOTOR;
  const temCoordenador = time.some((a) => a.nome === NOME_DO_COORDENADOR);
  const base = aplicarPersona(semPedido && temCoordenador ? NOME_DO_COORDENADOR : agente, cwd, modelo, pedido);
  if (time.length === 0) return { ...base, time };
  const agents: Record<string, AgentDefinition> = {};
  for (const a of time) {
    agents[a.nome] = { description: a.descricao, prompt: a.prompt, model: a.modelo ?? 'inherit' };
  }
  // A persona principal manda no proprio nome: ela leva o modelo do comando.
  if (base.agents) Object.assign(agents, base.agents);
  return {
    ...base,
    agents,
    nota: `${base.nota}; time do projeto entregue ao kit: ${time.map((a) => a.nome).join(', ')}`,
    time,
  };
}
