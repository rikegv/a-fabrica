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

import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
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
  return [join(cwd, '.claude', 'agents'), join(homedir(), '.claude', 'agents')];
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
