/*
 * TRADUTOR ENTRE A BASE E A TELA. Arquivo unico, de proposito.
 *
 * A base na nuvem fala portugues, como manda o contrato das tres pecas
 * (docs/contrato-tres-pecas.md): colecoes fabricas, atividade, aprovacoes,
 * comandos, maquinas, e estados como "em execucao" e "aguardando aprovacao".
 * O design system do pacote do designer fala ingles: Factory, FactoryState
 * 'running' | 'approval' | 'idle' | 'done' | 'failed' | 'offline'.
 *
 * Toda a conversao entre os dois mundos mora aqui. Nenhum outro arquivo
 * compara texto de estado com string solta.
 *
 * MAPA DE ESTADO DA FABRICA, um a um:
 *
 *   base (contrato)            tela (design system)   texto na tela           forma do icone
 *   -------------------------  ---------------------  ----------------------  --------------------------
 *   "em execucao"              running                Em execução             ponto com anel pulsando
 *   "aguardando aprovacao"     approval               Aguardando aprovação    losango cheio
 *   "aguardando comando"       idle                   Aguardando comando      círculo vazio
 *   "concluida"                done                   Concluída               círculo com visto
 *   "falhou"                   failed                 Falhou                  X
 *   "ponte offline"            offline                Ponte offline           círculo tracejado cortado
 *   qualquer outra coisa       idle                   Aguardando comando      círculo vazio
 *
 * O contrato escreve sem acento. O painel aceita com acento tambem ("em
 * execução", "aguardando aprovação", "concluída"), porque normaliza antes de
 * comparar. Estado desconhecido cai em idle, nunca em running: o painel nao
 * inventa que a fabrica esta trabalhando.
 *
 * REGRA DURA DA PONTE, §A.10: quando a ponte esta offline (heartbeat velho ou
 * estadoPonte "offline"), toda fabrica passa a offline, qualquer que seja o
 * estado gravado. O painel nunca diz em execução com heartbeat velho.
 *
 * MAPA DE RISCO: "baixo" vira low, "medio" (ou "médio") vira medium, "alto"
 * vira high. Desconhecido vira high, porque na duvida o risco sobe, nao desce.
 *
 * MAPA DE SITUACAO DE TAREFA: "em andamento" vira running, "concluida" vira
 * done, "falhou" vira failed, desconhecida vira idle.
 *
 * MAPA DE TIPO DE ATIVIDADE: estado "ERROR" vira error; tipo "checkpoint" vira
 * done; tipo "tool" com ferramenta de aprovacao fica step, porque o pedido de
 * aprovacao real vive na colecao aprovacoes; o resto vira step.
 */

import type { ActivityTimelineItem, FactoryState, RiskLevel } from '@/componentes/ds';
import {
  consumo as formatarConsumo,
  horaComSegundos,
  tempoDecorrido,
  tempoParado as formatarTempoParado
} from '@/formato';
import type {
  AprovacaoBase,
  AtividadeBase,
  FabricaBase,
  HoraDaBase,
  MaquinaBase,
  TarefaBase
} from './tipos';

/* ---------- limites ---------- */

/* Heartbeat mais velho que isto e ponte offline, §A.10. A ponte bate a cada
   poucos segundos; um minuto de silencio ja e queda. */
export const LIMITE_HEARTBEAT_MS = 60_000;

/* Pedido parado acima disto acende o tempo em âmbar (prop stale do pedido). */
export const LIMITE_PARADO_MS = 15 * 60_000;

/* ---------- hora ---------- */

export function paraData(valor: HoraDaBase): Date | null {
  if (valor == null) return null;
  if (typeof valor === 'object' && typeof valor.toDate === 'function') {
    try {
      return valor.toDate();
    } catch {
      return null;
    }
  }
  if (typeof valor === 'number') return new Date(valor);
  if (typeof valor === 'string') {
    const d = new Date(valor);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function semAcento(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

/* ---------- estado ---------- */

const MAPA_DE_ESTADO: Record<string, FactoryState> = {
  'em execucao': 'running',
  'aguardando aprovacao': 'approval',
  'aguardando comando': 'idle',
  concluida: 'done',
  falhou: 'failed',
  'ponte offline': 'offline'
};

export function traduzirEstado(estado: string | undefined | null): FactoryState {
  if (!estado) return 'idle';
  return MAPA_DE_ESTADO[semAcento(estado)] ?? 'idle';
}

const MAPA_DE_RISCO: Record<string, RiskLevel> = {
  baixo: 'low',
  medio: 'medium',
  alto: 'high'
};

export function traduzirRisco(risco: string | undefined | null): RiskLevel {
  if (!risco) return 'high';
  return MAPA_DE_RISCO[semAcento(risco)] ?? 'high';
}

const MAPA_DE_SITUACAO_DE_TAREFA: Record<string, FactoryState> = {
  'em andamento': 'running',
  concluida: 'done',
  falhou: 'failed'
};

export function traduzirSituacaoDeTarefa(situacao: string | undefined | null): FactoryState {
  if (!situacao) return 'idle';
  return MAPA_DE_SITUACAO_DE_TAREFA[semAcento(situacao)] ?? 'idle';
}

/* ---------- ponte ---------- */

export type SituacaoDaPonte = 'conectada' | 'offline' | 'sem maquina';

export interface Ponte {
  situacao: SituacaoDaPonte;
  online: boolean;
  maquina: string | null;
  versao: string | null;
  vistoPorUltimo: Date | null;
  atrasoMs: number | null;
}

export function avaliarPonte(maquinas: MaquinaBase[], agora: Date = new Date()): Ponte {
  if (!maquinas.length) {
    return {
      situacao: 'sem maquina',
      online: false,
      maquina: null,
      versao: null,
      vistoPorUltimo: null,
      atrasoMs: null
    };
  }
  const vistas = maquinas
    .map((m) => ({ maquina: m, visto: paraData(m.vistoPorUltimo) }))
    .sort((a, b) => (b.visto?.getTime() ?? 0) - (a.visto?.getTime() ?? 0));
  const melhor = vistas[0];
  const atrasoMs = melhor.visto ? agora.getTime() - melhor.visto.getTime() : null;
  const declaradaOffline = semAcento(melhor.maquina.estadoPonte ?? '') === 'offline';
  const online = !declaradaOffline && atrasoMs != null && atrasoMs <= LIMITE_HEARTBEAT_MS;
  return {
    situacao: online ? 'conectada' : 'offline',
    online,
    maquina: melhor.maquina.nome ?? melhor.maquina.maquinaId ?? melhor.maquina.id,
    versao: melhor.maquina.versaoPonte ?? null,
    vistoPorUltimo: melhor.visto,
    atrasoMs
  };
}

/* ---------- fabrica ---------- */

/* O mesmo formato que o pacote do designer espera (interface Factory), com os
   campos ja formatados em pt-BR para a tela, mais o que a tela do painel usa. */
export interface Fabrica {
  id: string;
  project: string;
  folder: string | null;
  agent: string;
  model: string;
  state: FactoryState;
  doing: string;
  startedAt: Date | null;
  elapsedMs: number;
  tokens: number;
  elapsed: string;
  usage: string;
  pending: string | null;
  maquinaId: string | null;
}

/* O contrato nao tem campo para a frase do que a fabrica faz agora. Em vez de
   inventar, o painel escreve a frase a partir do estado, e a tela da fabrica
   mostra o passo real da atividade ao lado. */
function frasePeloEstado(estado: FactoryState, temPedido: boolean): string {
  if (estado === 'approval' || temPedido) return 'Parou para pedir aprovação.';
  if (estado === 'running') return 'Em execução. Abra a fábrica para ver o passo atual.';
  if (estado === 'idle') return 'Esperando a próxima ordem.';
  if (estado === 'done') return 'Concluída.';
  if (estado === 'failed') return 'Falhou. Abra a fábrica para ver o último passo.';
  return 'A ponte está offline, o painel não sabe o passo atual.';
}

export function traduzirFabrica(
  doc: FabricaBase,
  opcoes: { pontePerdida: boolean; pedidoParado?: number | null; agora?: Date }
): Fabrica {
  const agora = opcoes.agora ?? new Date();
  const inicio = paraData(doc.inicio);
  const estadoGravado = traduzirEstado(doc.estado);
  const state: FactoryState = opcoes.pontePerdida ? 'offline' : estadoGravado;
  const decorrido =
    typeof doc.tempoDecorridoMs === 'number' && doc.tempoDecorridoMs >= 0
      ? doc.tempoDecorridoMs
      : inicio
        ? agora.getTime() - inicio.getTime()
        : 0;
  const tokens = doc.consumo?.totalTokens ?? 0;
  const temPedido = opcoes.pedidoParado != null;
  return {
    id: doc.id,
    project: doc.projeto?.trim() || 'Projeto sem nome',
    folder: doc.pasta?.trim() || null,
    agent: doc.agente?.trim() || 'Agente não informado',
    model: doc.modelo?.trim() || 'modelo não informado',
    state,
    doing: frasePeloEstado(state, temPedido),
    startedAt: inicio,
    elapsedMs: decorrido,
    tokens,
    elapsed: tempoDecorrido(decorrido),
    usage: formatarConsumo(tokens),
    pending: temPedido ? `Parado há ${formatarTempoParado(opcoes.pedidoParado)}` : null,
    maquinaId: doc.maquinaId ?? null
  };
}

/* Ordem da grade, como o manual do FactoryCard manda: quem precisa do diretor
   primeiro (aprovacao e falha, mais antigo antes), depois quem roda, depois
   quem esta parado. */
const PESO_DO_ESTADO: Record<FactoryState, number> = {
  approval: 0,
  failed: 1,
  running: 2,
  offline: 3,
  idle: 4,
  done: 5
};

export function ordenarFabricas(lista: Fabrica[]): Fabrica[] {
  return [...lista].sort((a, b) => {
    const peso = PESO_DO_ESTADO[a.state] - PESO_DO_ESTADO[b.state];
    if (peso !== 0) return peso;
    const ta = a.startedAt?.getTime() ?? 0;
    const tb = b.startedAt?.getTime() ?? 0;
    return ta - tb;
  });
}

/* ---------- aprovacao ---------- */

/* O mesmo formato do pacote (interface Approval mais as props de ApprovalItem). */
export interface Aprovacao {
  id: string;
  factoryId: string | null;
  project: string;
  task: string;
  title: string;
  why: string;
  impact: string;
  touches: string[];
  risk: RiskLevel;
  requestedAt: Date | null;
  waitingMs: number;
  waiting: string;
  stale: boolean;
}

function comoLista(valor: string | string[] | undefined): string[] {
  if (!valor) return [];
  if (Array.isArray(valor)) return valor.filter(Boolean);
  return valor
    .split(/\r?\n|;|,/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export function traduzirAprovacao(doc: AprovacaoBase, agora: Date = new Date()): Aprovacao {
  const pacote = doc.pacote ?? {};
  const criado = paraData(doc.criadoEm);
  const paradoGravado = pacote.tempoParadoMs?.valor;
  const paradoAgora = criado ? agora.getTime() - criado.getTime() : null;
  const waitingMs = Math.max(
    typeof paradoGravado === 'number' ? paradoGravado : 0,
    typeof paradoAgora === 'number' ? paradoAgora : 0
  );
  return {
    id: doc.id,
    factoryId: doc.fabricaId ?? null,
    project: pacote.fabrica?.valor?.trim() || 'Fábrica não informada',
    task: pacote.tarefa?.valor?.trim() || '',
    title: pacote.oQue?.valor?.trim() || pacote.resumo?.valor?.trim() || 'Pedido sem descrição',
    why: pacote.porQue?.valor?.trim() || 'A ponte não informou o motivo.',
    impact: pacote.impacto?.valor?.trim() || 'A ponte não informou o impacto.',
    touches: comoLista(pacote.oQueSeraTocado?.valor),
    risk: traduzirRisco(pacote.risco?.valor),
    requestedAt: criado,
    waitingMs,
    waiting: formatarTempoParado(waitingMs),
    stale: waitingMs > LIMITE_PARADO_MS
  };
}

export function ordenarAprovacoes(lista: Aprovacao[]): Aprovacao[] {
  /* Mais antiga primeiro, como o deck manda. Nunca reordenar por risco. */
  return [...lista].sort((a, b) => (a.requestedAt?.getTime() ?? 0) - (b.requestedAt?.getTime() ?? 0));
}

export function aprovacaoPendente(doc: AprovacaoBase): boolean {
  return semAcento(doc.situacao ?? 'pendente') === 'pendente' && !doc.resposta;
}

/* ---------- atividade ---------- */

/* Relato da ferramenta do Claude Code, em portugues. O nome cru da ferramenta e
   fato; a frase e so a traducao dele. Ferramenta desconhecida mantem o nome. */
const RELATO_DA_FERRAMENTA: Record<string, string> = {
  bash: 'Rodou um comando no terminal.',
  read: 'Leu um arquivo.',
  write: 'Escreveu um arquivo.',
  edit: 'Alterou um arquivo.',
  multiedit: 'Alterou um arquivo em vários pontos.',
  glob: 'Procurou arquivos no projeto.',
  grep: 'Procurou um trecho no projeto.',
  task: 'Delegou uma tarefa a um subagente.',
  todowrite: 'Atualizou a lista de tarefas.',
  webfetch: 'Buscou uma página na internet.',
  websearch: 'Pesquisou na internet.',
  notebookedit: 'Alterou um caderno de notas.'
};

function resumoDaFerramenta(doc: AtividadeBase): string {
  const nome = doc.ferramenta ?? doc.toolInfo?.name ?? 'ferramenta';
  return RELATO_DA_FERRAMENTA[nome.toLowerCase()] ?? `Usou ${nome}.`;
}

/* Detalhe da linha do tempo: o log cru que o manual pede em mono. Comando,
   caminho ou trecho procurado, nunca o objeto inteiro. */
function detalheDaFerramenta(doc: AtividadeBase): string | null {
  const parametros = doc.toolInfo?.parameters as Record<string, unknown> | undefined;
  if (!parametros || typeof parametros !== 'object') return null;
  for (const chave of ['command', 'file_path', 'path', 'pattern', 'url', 'prompt', 'description']) {
    const valor = parametros[chave];
    if (typeof valor === 'string' && valor.trim()) return primeiraLinha(valor, 120);
  }
  const erro = doc.toolInfo?.error;
  if (typeof erro === 'string' && erro.trim()) return primeiraLinha(erro, 120);
  return null;
}

function primeiraLinha(texto: string, limite = 160): string {
  const limpo = texto.replace(/\s+/g, ' ').trim();
  return limpo.length > limite ? limpo.slice(0, limite - 1) + '…' : limpo;
}

export function traduzirAtividade(doc: AtividadeBase): ActivityTimelineItem {
  const em = paraData(doc.em);
  const erro = String(doc.estado ?? '').toUpperCase() === 'ERROR';
  const tipo = String(doc.tipo ?? '');
  let texto: string;
  if (tipo === 'user_input') texto = primeiraLinha(doc.textoDelta ?? 'Recebeu uma ordem do diretor.');
  else if (tipo === 'agent_response') texto = primeiraLinha(doc.textoDelta ?? 'Respondeu.');
  else if (tipo === 'tool') texto = resumoDaFerramenta(doc);
  else if (tipo === 'checkpoint') texto = 'Fechou um passo.';
  else texto = primeiraLinha(doc.textoDelta ?? 'Deu um passo.');

  const detalhe = tipo === 'tool' ? detalheDaFerramenta(doc) : null;

  return {
    time: horaComSegundos(em),
    text: erro ? `Erro: ${texto}` : texto,
    detail: detalhe ?? undefined,
    kind: erro ? 'error' : tipo === 'checkpoint' ? 'done' : 'step'
  };
}

/* ---------- tarefa ---------- */

export interface Tarefa {
  id: string;
  title: string;
  state: FactoryState;
  startedAt: Date | null;
  elapsed: string;
}

export function traduzirTarefa(doc: TarefaBase, agora: Date = new Date()): Tarefa {
  const criada = paraData(doc.criadaEm);
  const atualizada = paraData(doc.atualizadaEm);
  const fim = doc.situacao && semAcento(doc.situacao) !== 'em andamento' ? atualizada : null;
  const base = criada ? ((fim ?? agora).getTime() - criada.getTime()) : null;
  return {
    id: doc.id,
    title: doc.titulo?.trim() || 'Tarefa sem título',
    state: traduzirSituacaoDeTarefa(doc.situacao),
    startedAt: criada,
    elapsed: base == null ? '' : tempoDecorrido(base)
  };
}

const PESO_DA_TAREFA: Record<FactoryState, number> = {
  approval: 0,
  failed: 1,
  running: 2,
  idle: 3,
  offline: 4,
  done: 5
};

export function ordenarTarefas(lista: Tarefa[]): Tarefa[] {
  return [...lista].sort((a, b) => {
    const peso = PESO_DA_TAREFA[a.state] - PESO_DA_TAREFA[b.state];
    if (peso !== 0) return peso;
    return (a.startedAt?.getTime() ?? 0) - (b.startedAt?.getTime() ?? 0);
  });
}
