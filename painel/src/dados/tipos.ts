/*
 * Tipos da base na nuvem, em portugues, exatamente como o contrato das tres
 * pecas descreve (docs/contrato-tres-pecas.md). Quem escreve cada documento e a
 * ponte; o painel so le, nesta onda.
 *
 * Campos marcados como tolerados nao estao no contrato: se a ponte escrever,
 * o painel aproveita; se nao escrever, o painel segue sem eles.
 */

/* Qualquer coisa que a base devolva onde se espera uma hora: Timestamp do
   Firestore, string ISO ou numero em milissegundos. */
export type HoraDaBase = { toDate: () => Date } | string | number | null | undefined;

export type EstadoFabricaBase =
  | 'em execucao'
  | 'aguardando aprovacao'
  | 'aguardando comando'
  | 'concluida'
  | 'falhou'
  | 'ponte offline';

export type RiscoBase = 'baixo' | 'medio' | 'alto';

export interface MaquinaBase {
  id: string;
  maquinaId?: string;
  nome?: string;
  estadoPonte?: 'online' | 'offline';
  vistoPorUltimo?: HoraDaBase;
  versaoPonte?: string;
  pareadoEm?: HoraDaBase;
}

export interface ConsumoBase {
  inputTokens?: number;
  outputTokens?: number;
  thinkingTokens?: number;
  cacheReadTokens?: number;
  totalTokens?: number;
}

export interface FabricaBase {
  id: string;
  fabricaId?: string;
  maquinaId?: string;
  conversationId?: string;
  projeto?: string;
  pasta?: string; // tolerado: pasta do projeto na maquina, quando a ponte informar
  agente?: string;
  modelo?: string;
  estado?: EstadoFabricaBase | string;
  inicio?: HoraDaBase;
  tempoDecorridoMs?: number;
  consumo?: ConsumoBase;
  atualizadoEm?: HoraDaBase;
}

export interface TarefaBase {
  id: string;
  tarefaId?: string;
  titulo?: string;
  situacao?: 'em andamento' | 'concluida' | 'falhou' | string;
  criadaEm?: HoraDaBase;
  atualizadaEm?: HoraDaBase;
}

export interface AtividadeBase {
  id: string;
  seq?: number;
  stepIndex?: number;
  tipo?: 'user_input' | 'agent_response' | 'tool' | 'checkpoint' | string;
  estado?: 'ACTIVE' | 'DONE' | 'ERROR' | string;
  ferramenta?: string | null;
  textoDelta?: string | null;
  toolInfo?: { name?: string; parameters?: unknown; output?: unknown; error?: unknown } | null;
  consumoParcial?: ConsumoBase | null;
  em?: HoraDaBase;
}

export interface CampoDoPacote<T = string> {
  valor: T;
  origem?: string;
}

export interface PacoteDeAprovacao {
  oQue?: CampoDoPacote;
  resumo?: CampoDoPacote;
  tarefa?: CampoDoPacote;
  fabrica?: CampoDoPacote;
  agenteDisse?: CampoDoPacote;
  porQue?: CampoDoPacote;
  impacto?: CampoDoPacote;
  oQueSeraTocado?: CampoDoPacote<string | string[]>;
  risco?: CampoDoPacote<RiscoBase | string>;
  tempoParadoMs?: CampoDoPacote<number>;
}

export interface AprovacaoBase {
  id: string;
  aprovacaoId?: string;
  fabricaId?: string;
  maquinaId?: string;
  pacote?: PacoteDeAprovacao;
  situacao?: 'pendente' | 'respondida' | string;
  criadoEm?: HoraDaBase;
  origem?: string;
  resposta?: 'aprovado' | 'recusado' | 'aprovado com observacao' | null;
  observacao?: string | null;
  respondidoEm?: HoraDaBase;
  respondidoPor?: string | null;
}
