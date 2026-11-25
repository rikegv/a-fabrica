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

import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { usuarioDasFabricas } from './plataforma.js';
import {
  query,
  type AgentDefinition,
  type CanUseTool,
  type Options,
  type PermissionMode,
  type PermissionResult,
  type SpawnOptions,
  type SpawnedProcess,
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

/**
 * O lancador que roda o Claude Code como o diretor, no Linux. OST 14.
 *
 * Por que existe: no Linux a ponte roda como o usuario fabrica-ponte, dono da
 * pasta onde mora a chave de aprovacao. Se a fabrica nascesse como esse mesmo
 * usuario, ela leria a chave, e a tranca nao valeria nada. Entao a fabrica nasce
 * como o DIRETOR, com a pasta, a conta do Claude Code e a configuracao dele, como
 * se ele tivesse aberto na mao (§A.9). Quem permite a troca de usuario e uma regra
 * do sudo, gravada pela instalacao, que deixa a ponte rodar SO este lancador e SO
 * como o diretor. O lancador so aceita o binario exato do Claude Code do kit e so
 * passa adiante as variaveis do kit.
 *
 * ALCANCE REAL, achado R2 da seguranca, dito para ninguem confiar demais: o
 * Claude Code aceita qualquer argumento, entao a regra equivale a "a ponte age
 * como o diretor". Nao e escalada: a ponte ja tem a chave de aprovacao. O que a
 * regra segura de verdade e o sentido contrario, o diretor nao vira a ponte.
 *
 * As opcoes, o portao e o fluxo de dados continuam os mesmos: o kit fala com o
 * filho pela entrada e pela saida padrao, e o sudo so fica no meio do caminho.
 * A isca do portao passa por aqui tambem, entao a ressalva 1 prova o caminho real.
 */
export const LANCADOR_COMO_DIRETOR = process.env.PONTE_LANCADOR_CLAUDE ?? '/opt/a-fabrica-ponte/bin/claude-como-diretor';

/** Variaveis que o kit poe no filho e que o lancador aceita levar. Nada mais passa. */
const VARIAVEIS_DO_KIT = /^(CLAUDE_CODE_ENTRYPOINT|CLAUDE_AGENT_SDK[A-Z_]*|DEBUG)$/;

export function argumentosDoLancador(usuario: string, o: SpawnOptions): string[] {
  const pares: string[] = [];
  for (const [k, v] of Object.entries(o.env ?? {})) {
    if (v === undefined || !VARIAVEIS_DO_KIT.test(k)) continue;
    pares.push('--env', `${k}=${v}`);
  }
  return ['-n', '-u', usuario, '--', LANCADOR_COMO_DIRETOR, ...pares, '--', o.command, ...o.args];
}

function abrirComoDiretor(usuario: string): (o: SpawnOptions) => SpawnedProcess {
  return (o: SpawnOptions): SpawnedProcess => {
    const filho = spawn('sudo', argumentosDoLancador(usuario, o), {
      cwd: o.cwd,
      stdio: ['pipe', 'pipe', 'inherit'],
      signal: o.signal,
    });
    return filho as unknown as SpawnedProcess;
  };
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
  // Linux, OST 14: a fabrica nasce como o diretor, nunca como a ponte.
  const comoQuem = usuarioDasFabricas();
  if (comoQuem !== null) options.spawnClaudeCodeProcess = abrirComoDiretor(comoQuem);
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
  /** OST 10: subagente que agiu, nulo quando foi o agente principal. */
  agente?: string | null;
  estado?: string;
  usage?: Consumo;
  custo?: number;
  /**
   * OST 13, so no evento fim: a resposta final da rodada do AGENTE PRINCIPAL. E o
   * `result` do kit quando a rodada terminou com sucesso; sem ele, o texto da
   * ultima mensagem do assistente sem parent_tool_use_id. Nunca texto de subagente.
   */
  resposta?: string;
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
  /**
   * Consumo AO VIVO, OST 9. Recebe so o que cresceu desde a ultima chamada, campo
   * por campo, nunca o total. Quem recebe soma na base. Veja MedidorDeConsumo.
   */
  onConsumo?: (acrescimo: Record<string, number>) => void | Promise<void>;
}

/** Os quatro campos do `usage` do kit que viram token na tela. */
export const CAMPOS_DE_CONSUMO = [
  'input_tokens',
  'output_tokens',
  'cache_read_input_tokens',
  'cache_creation_input_tokens',
] as const;
type CampoDeConsumo = (typeof CAMPOS_DE_CONSUMO)[number];
type Contagem = Record<CampoDeConsumo, number>;

function zerada(): Contagem {
  return { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };
}

function numero(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0;
}

/**
 * MEDIDOR DE CONSUMO, o conserto da OST 9.
 *
 * O defeito, do Claude Code ate a tela: a ponte so gravava `consumo` quando
 * chegava a mensagem de resultado, que e o FIM do comando. Enquanto a fabrica
 * trabalhava, o campo nao existia, e o painel dizia "consumo nao medido" para
 * justamente quem estava gastando; o indicador do dia somava so quem ja tinha
 * terminado. E no fim de cada comando o valor era SUBSTITUIDO pelo do comando
 * da vez, entao fabrica com tres comandos mostrava o consumo do ultimo.
 *
 * O que mede agora, sem estimar nada:
 *   1. Cada mensagem do assistente traz o `usage` real dela. O kit entrega a
 *      mesma mensagem mais de uma vez enquanto ela cresce (um bloco por vez, com
 *      o mesmo identificador), entao o medidor guarda o maior valor visto por
 *      mensagem e so repassa o que cresceu. Mensagem repetida nao conta duas vezes.
 *   2. No resultado, o `usage` do kit e o total oficial do comando. Se ele for
 *      maior que o que ja foi somado ao vivo, entra a diferenca; se for menor,
 *      nada sai. O total do comando fica igual ao maior dos dois, que sao os dois
 *      numeros medidos, nenhum inventado.
 */
export class MedidorDeConsumo {
  private readonly porMensagem = new Map<string, Contagem>();
  private readonly somado: Contagem = zerada();

  /** Mensagem do assistente. Devolve o acrescimo, ou null se nada cresceu. */
  mensagem(id: string, usage: unknown): Contagem | null {
    if (typeof usage !== 'object' || usage === null) return null;
    const u = usage as Record<string, unknown>;
    const antes = this.porMensagem.get(id) ?? zerada();
    const agora = zerada();
    const acrescimo = zerada();
    let cresceu = false;
    for (const c of CAMPOS_DE_CONSUMO) {
      agora[c] = Math.max(antes[c], numero(u[c]));
      acrescimo[c] = agora[c] - antes[c];
      if (acrescimo[c] > 0) cresceu = true;
    }
    this.porMensagem.set(id, agora);
    if (!cresceu) return null;
    for (const c of CAMPOS_DE_CONSUMO) this.somado[c] += acrescimo[c];
    return acrescimo;
  }

  /** Resultado do comando. Devolve so a diferenca que faltou, ou null. */
  resultado(usage: unknown): Contagem | null {
    if (typeof usage !== 'object' || usage === null) return null;
    const u = usage as Record<string, unknown>;
    const falta = zerada();
    let faltou = false;
    for (const c of CAMPOS_DE_CONSUMO) {
      const d = numero(u[c]) - this.somado[c];
      if (d > 0) {
        falta[c] = d;
        this.somado[c] += d;
        faltou = true;
      }
    }
    return faltou ? falta : null;
  }

  total(): Contagem {
    return { ...this.somado };
  }
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

  const medidor = new MedidorDeConsumo();
  // OST 10: qual subagente cada chamada de Agent (ou Task) abriu, pelo id da
  // chamada. Mensagem de subagente traz parent_tool_use_id, e e assim que a tela
  // sabe QUEM agiu, §A.15.
  const chamados = new Map<string, string>();
  const quemAgiu = (pai: string | null): string | null =>
    pai === null ? null : (chamados.get(pai) ?? 'subagente');
  // OST 13: texto da ultima mensagem do agente principal, juntando os blocos de
  // texto da mesma mensagem. Reserva para quando o resultado nao traz o texto.
  let ultimaPrincipalId: string | null = null;
  let ultimaPrincipalTexto = '';
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
      // Consumo ao vivo, por mensagem, sem contar a mesma mensagem duas vezes.
      // Mensagem de subagente tambem gasta, e entra igual.
      const msg = m.message as { id?: unknown; usage?: unknown };
      const idDaMensagem = typeof msg.id === 'string' && msg.id.length > 0 ? msg.id : `sem-id-${m.uuid}`;
      const acrescimo = medidor.mensagem(idDaMensagem, msg.usage);
      if (acrescimo !== null) await opcoes.onConsumo?.(acrescimo);
      const agente = quemAgiu(m.parent_tool_use_id);
      for (const b of m.message.content) {
        if (b.type === 'text' && !sub) {
          if (ultimaPrincipalId !== idDaMensagem) {
            ultimaPrincipalId = idDaMensagem;
            ultimaPrincipalTexto = '';
          }
          ultimaPrincipalTexto += (ultimaPrincipalTexto.length > 0 ? '\n' : '') + b.text;
        }
        if (b.type === 'text') {
          estado.textoAoVivo += b.text;
          await onEvento?.({ tipo: 'texto', sub, texto: b.text, agente });
        } else if (b.type === 'thinking') {
          await onEvento?.({ tipo: 'pensamento', sub, agente });
        } else if (b.type === 'tool_use') {
          const entrada = (b.input ?? {}) as Record<string, unknown>;
          const chamaSubagente = b.name === 'Task' || b.name === 'Agent';
          if (chamaSubagente) {
            const tipoDoSub = entrada['subagent_type'];
            chamados.set(b.id, typeof tipoDoSub === 'string' && tipoDoSub.length > 0 ? tipoDoSub : 'general-purpose');
          }
          await onEvento?.({
            tipo: 'ferramenta',
            sub,
            ferramenta: b.name,
            entrada,
            inicioSubagente: chamaSubagente,
            agente,
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
            await onEvento?.({ tipo: 'resultado', sub: m.parent_tool_use_id !== null, agente: quemAgiu(m.parent_tool_use_id) });
          }
        }
      }
      continue;
    }
    if (m.type === 'result') {
      // O total oficial do comando fecha a conta do que o ao vivo nao viu.
      const falta = medidor.resultado(m.usage);
      if (falta !== null) await opcoes.onConsumo?.(falta);
      estado.usage = m.usage as unknown as Consumo;
      estado.resultado = m.subtype;
      estado.custo = m.total_cost_usd;
      const resposta =
        m.subtype === 'success' && typeof m.result === 'string' && m.result.length > 0 ? m.result : ultimaPrincipalTexto;
      await onEvento?.({
        tipo: 'fim',
        estado: m.subtype,
        usage: estado.usage,
        custo: m.total_cost_usd,
        ...(resposta.length > 0 ? { resposta } : {}),
      });
    }
  }
  return estado;
}
