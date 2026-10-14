// claudeCode.ts, a peca 3 por dentro: pilota o Claude Code pelo kit oficial.
//
// AS TRES RESSALVAS DA SEGURANCA, regra dura em TODA abertura de fabrica:
//   1. Verificacao do portao com isca antes de abrir, nas MESMAS opcoes e ambiente.
//   2. Limpeza das variaveis de aninhamento do Claude Code.
//   3. Conferencia do modo fixado no evento init.
// Falha fechada: qualquer uma falhando, a fabrica NAO nasce.
//
// Porte para TypeScript (OST 6, Passo 4): as tres ressalvas sobreviveram
// identicas. Nenhum `any` solto no caminho de decisao de aprovacao: o portao
// recebe e devolve tipos fechados do proprio kit.

import { existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import {
  query,
  type AgentDefinition,
  type CanUseTool,
  type Options,
  type PermissionMode,
  type PermissionResult,
} from '@anthropic-ai/claude-agent-sdk';
import type { Consumo, TipoAtividade } from './tipos.js';

export const MODELO_PADRAO = process.env.PONTE_MODELO ?? 'claude-haiku-4-5-20251001';
/** Modo de permissao fixado na mao, sempre. Nunca o padrao do ambiente, §A.6. */
export const MODO: PermissionMode = 'default';

/**
 * Nome de modelo aceito no comando: apelido ou identificador completo.
 *
 * Validacao de borda, nao de gosto: o valor vem da base e vira argumento de linha
 * de comando. Texto com espaco, aspas ou quebra de linha e recusado antes de
 * chegar la, e a fabrica nao nasce, §A.6.
 */
const MODELO_ACEITO = /^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/;

export function modeloAceito(modelo: string): boolean {
  return MODELO_ACEITO.test(modelo);
}

/**
 * Ressalva 2: ambiente sem as variaveis de aninhamento do Claude Code. Sem isto,
 * o filho herda a sessao pai e o portao nao e chamado.
 */
export function ambienteLimpo(): Record<string, string> {
  const limpo: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v === undefined) continue;
    if (/^CLAUDE/i.test(k) || k === 'CLAUDECODE' || k === 'AI_AGENT') continue;
    limpo[k] = v;
  }
  return limpo;
}

/**
 * O que a abertura pode escolher por fabrica: modelo, persona e interrupcao.
 *
 * Isto existe para a ressalva 1 continuar de pe. A verificacao do portao tem de
 * rodar nas MESMAS opcoes da sessao real; se o modelo ou a persona mudassem
 * depois da isca, a isca teria provado outra sessao, nao esta. Entao as duas
 * passam pelo mesmo `opcoesDaSessao`.
 */
export interface EscolhasDaSessao {
  modelo?: string;
  agent?: string | null;
  agents?: Record<string, AgentDefinition> | null;
  controle?: AbortController | null;
}

/** As MESMAS opcoes da sessao real, para a verificacao do portao valer. */
export function opcoesDaSessao(cwd: string, escolhas: EscolhasDaSessao = {}): Options {
  const modelo = escolhas.modelo ?? MODELO_PADRAO;
  const options: Options = {
    cwd,
    model: modelo,
    permissionMode: MODO,
    settingSources: [],
    env: ambienteLimpo(),
    includePartialMessages: true,
  };
  // Persona pelo caminho suportado do kit: `agent` aponta, `agents` define.
  // Veja personas.ts para o porque de a definicao vir do arquivo do diretor.
  if (escolhas.agents) options.agents = escolhas.agents;
  if (escolhas.agent !== null && escolhas.agent !== undefined && escolhas.agents) {
    options.agent = escolhas.agent;
  }
  if (escolhas.controle) options.abortController = escolhas.controle;
  return options;
}

export interface ProvaDoPortao {
  vivo: boolean;
  chamado: number;
  iscaExecutou: boolean;
  erro?: string;
}

const ISCA = 'PONTE-ISCA';

/**
 * Ressalva 1: dispara uma isca de risco que o portao TEM de barrar. Se a isca
 * executou, o portao nao esta vivo e a fabrica nao abre. So o portao vivo e
 * correto produz o sinal: chamado pelo menos uma vez e isca nao executada.
 */
export async function verificaPortao(cwd: string, escolhas: EscolhasDaSessao = {}): Promise<ProvaDoPortao> {
  mkdirSync(cwd, { recursive: true });
  let chamado = 0;
  let iscaExecutou = false;
  let erro: string | undefined;
  const canUseTool: CanUseTool = async (): Promise<PermissionResult> => {
    chamado++;
    return { behavior: 'deny', message: 'Isca do portao, recusa automatica.' };
  };
  const alvo = join(cwd, `${ISCA}.txt`);
  try {
    for await (const m of query({
      prompt: `Usando a ferramenta de escrita, crie o arquivo ${alvo} com o conteudo x.`,
      options: { ...opcoesDaSessao(cwd, escolhas), canUseTool, maxTurns: 2 },
    })) {
      if (m.type === 'user') {
        const conteudo = m.message.content;
        if (Array.isArray(conteudo)) {
          for (const b of conteudo) {
            if (typeof b === 'object' && b !== null && 'type' in b && b.type === 'tool_result') {
              const bruto = (b as { content?: unknown }).content;
              const t = typeof bruto === 'string' ? bruto : JSON.stringify(bruto ?? '');
              if (/created|written|sucesso|\bx\b/i.test(t)) iscaExecutou = true;
            }
          }
        }
      }
    }
  } catch (e) {
    // Erro ao sondar: trata como portao NAO confirmado, falha fechada.
    erro = e instanceof Error ? e.message : String(e);
  }
  // Confirmacao por efeito: o arquivo da isca nao pode ter sido criado.
  if (existsSync(alvo)) {
    iscaExecutou = true;
    try {
      // Caminho completo e nomeado, arquivo por arquivo, §A.18. Este arquivo e
      // residuo da isca da propria ponte, nunca evidencia de rodada.
      unlinkSync(alvo);
    } catch {
      // se nao conseguiu remover, segue: o resultado ja e portao nao confirmado
    }
  }
  const prova: ProvaDoPortao = { vivo: chamado > 0 && !iscaExecutou, chamado, iscaExecutou };
  if (erro !== undefined) prova.erro = erro;
  return prova;
}

export interface EventoFabrica {
  tipo: TipoAtividade;
  sub?: boolean;
  sessionId?: string;
  modelo?: string;
  modo?: PermissionMode;
  texto?: string;
  ferramenta?: string;
  entrada?: Record<string, unknown>;
  inicioSubagente?: boolean;
  estado?: string;
  usage?: Consumo;
  custo?: number;
}

export type Portao = (toolName: string, input: Record<string, unknown>) => Promise<PermissionResult>;

export interface EstadoAbertura {
  sessionId: string | null;
  usage: Consumo | null;
  resultado: string | null;
  custo: number | null;
  modoConferido: boolean;
  textoAoVivo: string;
}

export class PortaoNaoConfirmado extends Error {
  constructor(public readonly prova: ProvaDoPortao) {
    super('portao nao confirmado na abertura, fabrica nao nasce');
    this.name = 'PortaoNaoConfirmado';
  }
}

export interface OpcoesAbertura {
  cwd: string;
  prompt: string;
  resumeId?: string | null;
  portao: Portao;
  onEvento?: (ev: EventoFabrica) => void | Promise<void>;
  maxTurns?: number;
  /** Modelo pedido no comando. Sem ele, vale MODELO_PADRAO. */
  modelo?: string;
  /** Persona pelo caminho suportado do kit. Veja personas.ts. */
  agent?: string | null;
  agents?: Record<string, AgentDefinition> | null;
  /** Como a ponte interrompe esta sessao, para encerrar e pausar. */
  controle?: AbortController | null;
}

/**
 * Abre a fabrica com o portao duro. onEvento recebe a atividade ao vivo; o portao
 * decide allow ou deny (a ponte liga isso a base).
 */
export async function abrirFabrica(opcoes: OpcoesAbertura): Promise<EstadoAbertura> {
  const { cwd, prompt, portao, onEvento } = opcoes;
  const escolhas: EscolhasDaSessao = {
    ...(opcoes.modelo !== undefined ? { modelo: opcoes.modelo } : {}),
    ...(opcoes.agent !== undefined ? { agent: opcoes.agent } : {}),
    ...(opcoes.agents !== undefined ? { agents: opcoes.agents } : {}),
    ...(opcoes.controle !== undefined ? { controle: opcoes.controle } : {}),
  };

  // Ressalva 1: so abre com o portao vivo, nas MESMAS opcoes e ambiente desta
  // sessao, modelo e persona incluidos.
  const prova = await verificaPortao(cwd, escolhas);
  if (!prova.vivo) throw new PortaoNaoConfirmado(prova);

  const estado: EstadoAbertura = {
    sessionId: null,
    usage: null,
    resultado: null,
    custo: null,
    modoConferido: false,
    textoAoVivo: '',
  };

  // Defesa em profundidade: nenhuma ferramenta passa pelo portao antes do init
  // confirmar o modo fixado. Se o init nao chegou, nega por seguranca.
  const portaoSeguro: CanUseTool = async (toolName, input): Promise<PermissionResult> => {
    if (!estado.modoConferido) {
      return { behavior: 'deny', message: 'modo nao conferido no init, negado por seguranca' };
    }
    try {
      return await portao(toolName, input);
    } catch {
      return { behavior: 'deny', message: 'erro no portao, negado por seguranca' };
    }
  };

  const options: Options = {
    ...opcoesDaSessao(cwd, escolhas),
    canUseTool: portaoSeguro,
    maxTurns: opcoes.maxTurns ?? 12,
  };
  if (opcoes.resumeId) options.resume = opcoes.resumeId;

  for await (const m of query({ prompt, options })) {
    if (m.type === 'system' && m.subtype === 'init') {
      estado.sessionId = m.session_id;
      // Ressalva 3: conferir o modo fixado. Se nao veio default, falha fechada.
      estado.modoConferido = m.permissionMode === MODO;
      if (!estado.modoConferido) {
        throw new Error(`modo nao fixado como ${MODO} (veio ${String(m.permissionMode)}), falha fechada`);
      }
      await onEvento?.({ tipo: 'init', sessionId: m.session_id, modelo: m.model, modo: m.permissionMode });
      continue;
    }
    if (m.type === 'stream_event') {
      const evento = m.event;
      if (evento.type === 'content_block_delta' && 'text' in evento.delta && typeof evento.delta.text === 'string') {
        estado.textoAoVivo += evento.delta.text;
      }
      continue;
    }
    if (m.type === 'assistant') {
      const sub = m.parent_tool_use_id !== null;
      for (const b of m.message.content) {
        if (b.type === 'text') {
          estado.textoAoVivo += b.text;
          await onEvento?.({ tipo: 'texto', sub, texto: b.text });
        } else if (b.type === 'thinking') {
          await onEvento?.({ tipo: 'pensamento', sub });
        } else if (b.type === 'tool_use') {
          await onEvento?.({
            tipo: 'ferramenta',
            sub,
            ferramenta: b.name,
            entrada: (b.input ?? {}) as Record<string, unknown>,
            inicioSubagente: b.name === 'Task',
          });
        }
      }
      continue;
    }
    if (m.type === 'user') {
      const conteudo = m.message.content;
      if (Array.isArray(conteudo)) {
        for (const b of conteudo) {
          if (typeof b === 'object' && b !== null && 'type' in b && b.type === 'tool_result') {
            await onEvento?.({ tipo: 'resultado', sub: m.parent_tool_use_id !== null });
          }
        }
      }
      continue;
    }
    if (m.type === 'result') {
      estado.usage = m.usage as unknown as Consumo;
      estado.resultado = m.subtype;
      estado.custo = m.total_cost_usd;
      await onEvento?.({ tipo: 'fim', estado: m.subtype, usage: estado.usage, custo: m.total_cost_usd });
    }
  }
  return estado;
}
