/*
 * Tipos da base na nuvem, em portugues, exatamente como o contrato das tres
 * pecas descreve (docs/contrato-tres-pecas.md), mais os campos que a Onda 2
 * acrescenta (docs/ost7-contrato-onda2.md).
 *
 * Quem escreve fabricas, atividade, tarefas e o pedido de aprovacao e a ponte.
 * O painel escreve comandos e a resposta da aprovacao, e so por
 * src/dados/escritas.ts.
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
  /* Máquina de rodada de teste. Fica na base, rotulada, e não conta para o estado
     da ponte na tela, §A.17. */
  teste?: boolean;
}

/*
 * CONSUMO, do jeito que ele CHEGA na base, e não do jeito que alguém imaginou.
 *
 * Defeito achado na tela do diretor: o painel lia totalTokens, e a ponte nunca
 * escreveu esse campo. Ela grava o `usage` do kit do Claude Code tal e qual, com
 * os nomes dele, em letra minúscula com sublinhado. Resultado: fábrica com
 * consumo de verdade gravado aparecia marcando zero token, e ninguém notava
 * porque zero é um número plausível.
 *
 * As duas grafias ficam aceitas: a do kit, que é o que existe hoje, e a nossa,
 * para o dia em que a ponte resolver traduzir antes de gravar.
 */
export interface ConsumoBase {
  /* A grafia do kit, que é a que a ponte grava hoje. */
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
  output_tokens_details?: { thinking_tokens?: number };
  /* A nossa grafia, aceita se um dia aparecer. */
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
  /* Campos da Onda 2, escritos pela ponte (seção 3 do contrato da Onda 2). */
  origem?: 'painel' | 'mao' | string;
  pausada?: boolean;
  encerradaEm?: HoraDaBase;
  pedidoDeEncerramento?: string;
  /* Motivo da falha, quando o portão não confirma e a fábrica não nasce. */
  erro?: string;
  /* Nasceu de uma rodada de teste da fábrica, não de trabalho de verdade. A ponte
     escreve quando a rodada pede. Decisão do diretor: rotular e filtrar no painel,
     nunca apagar, §A.17. */
  teste?: boolean;
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

/* Origem de cada campo do pacote, como a OST 2 aprovou: o painel mostra o que e
   fato capturado e o que e leitura da ponte, sem esconder a diferença. */
export type OrigemDoCampo = 'fato' | 'ponte' | 'fato mais leitura da ponte' | string;

export interface CampoDoPacote<T = string> {
  valor: T;
  origem?: OrigemDoCampo;
}

export interface PacoteDeAprovacao {
  /* Marcação que a ponte escreve no topo do pacote, quando escreve. */
  marcacao?: string;
  oQue?: CampoDoPacote;
  resumo?: CampoDoPacote;
  /* Nome cru da ferramenta que o portão segurou, fato. */
  ferramenta?: CampoDoPacote;
  tarefa?: CampoDoPacote;
  fabrica?: CampoDoPacote;
  agenteDisse?: CampoDoPacote<string | null>;
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
