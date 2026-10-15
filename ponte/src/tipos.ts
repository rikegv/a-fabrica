// tipos.ts, os tipos das entidades do contrato das tres pecas (docs/contrato-tres-pecas.md).
// A ponte decide aprovacao: erro aqui tem consequencia de seguranca, por isso o
// contrato e tipado e o modo estrito fica ligado (§A.2).
//
// Regra de tipos desta ponte: nenhum `any` solto nos caminhos de decisao de
// aprovacao. O que vem da base e `unknown` e passa por funcao de leitura segura
// antes de virar decisao.

import type { Timestamp, FieldValue } from 'firebase/firestore';

/** Marca de tempo do Firestore, de leitura ou de escrita. */
export type Momento = Timestamp | FieldValue | string | null;

/** §A.4, estados possiveis de uma fabrica. */
export type EstadoFabrica =
  | 'em execucao'
  | 'aguardando aprovacao'
  | 'aguardando comando'
  | 'concluida'
  | 'falhou'
  | 'ponte offline';

export type EstadoPonte = 'online' | 'offline';

export interface Maquina {
  maquinaId: string;
  nome: string;
  estadoPonte: EstadoPonte;
  vistoPorUltimo: Momento;
  versaoPonte?: string;
  pareadoEm?: Momento;
}

export interface Consumo {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
  [chave: string]: unknown;
}

/** De onde a fabrica nasceu. `mao` e escrito pelos ganchos do Bloco 1. */
export type OrigemFabrica = 'painel' | 'mao';

export interface Fabrica {
  fabricaId: string;
  maquinaId: string;
  conversationId?: string | null;
  projeto?: string;
  agente?: string;
  modelo?: string | null;
  estado: EstadoFabrica;
  inicio?: Momento;
  tempoDecorridoMs?: number;
  consumo?: Consumo | null;
  erro?: string | null;
  atualizadoEm?: Momento;
  /** Onda 2, contrato secao 3: painel ou mao. */
  origem?: OrigemFabrica;
  /** Onda 2: true enquanto a fabrica esta pausada. O estado segue aguardando comando, §A.4. */
  pausada?: boolean;
  /** Onda 2: hora do servidor do encerramento pedido pelo painel. */
  encerradaEm?: Momento;
  /** Onda 2: texto do motivo do encerramento, quando houver. */
  pedidoDeEncerramento?: string;
  /**
   * Esta fabrica nasceu de uma RODADA DE TESTE, e nao de trabalho de verdade.
   *
   * Decisao do diretor na retomada da OST 7: rotular e filtrar no painel, nunca
   * apagar, §A.17. A trilha de teste fica na base, com registro de que e teste, e
   * o painel esconde por padrao. Antes disto, quinze fabricas de teste disputavam
   * espaco na tela com o trabalho de verdade, e foi assim que uma fabrica recem
   * aberta pelo diretor acabou fora da tela.
   *
   * Quem liga: a propria rodada de teste, por PONTE_ROTULO_TESTE=1. Nunca e
   * deduzido do nome da maquina, que seria adivinhacao.
   */
  teste?: boolean;
}

export type TipoAtividade = 'init' | 'texto' | 'pensamento' | 'ferramenta' | 'resultado' | 'fim';

export interface PassoAtividade {
  seq: number;
  tipo: TipoAtividade;
  ferramenta: string | null;
  subagente: boolean;
  inicioSubagente: boolean;
  em?: Momento;
}

export type SituacaoComando = 'pendente' | 'entregue';

/** Onda 2, contrato secao 2: as cinco acoes que um comando pode pedir. */
export const ACOES = ['abrir', 'comando', 'encerrar', 'pausar', 'reiniciar'] as const;
export type AcaoComando = (typeof ACOES)[number];

export interface Comando {
  comandoId: string;
  fabricaId: string;
  maquinaId: string;
  texto: string;
  situacao: SituacaoComando;
  criadoEm: Momento;
  origem: string;
  entregueEm?: Momento;
  /** Opcional: pasta de projeto e id de conversa para retomar. */
  cwd?: string;
  conversationId?: string;
  /** Onda 2. Ausente vale `comando`, por compatibilidade com a Onda 1. */
  acao?: AcaoComando;
  agente?: string;
  modelo?: string;
}

/**
 * Leitura do campo `acao` do documento de comando.
 *
 * Duas coisas diferentes, de proposito:
 *   acao ausente     vale `comando`, compatibilidade obrigatoria do contrato secao 2.
 *   acao presente e nao reconhecida  devolve null, e o roteador RECUSA. Falha
 *                    fechada: a ponte nao adivinha o que o painel quis dizer.
 */
export interface LeituraDeAcao {
  acao: AcaoComando | null;
  /** O que veio escrito no documento, para a trilha dizer a verdade. */
  bruta: string | null;
}

export function acaoDe(dado: unknown): LeituraDeAcao {
  if (typeof dado !== 'object' || dado === null) return { acao: 'comando', bruta: null };
  const v = (dado as Record<string, unknown>)['acao'];
  if (v === undefined || v === null) return { acao: 'comando', bruta: null };
  if (typeof v !== 'string') return { acao: null, bruta: JSON.stringify(v).slice(0, 60) };
  const limpo = v.trim().toLowerCase();
  const achada = ACOES.find((a): boolean => a === limpo);
  return achada === undefined ? { acao: null, bruta: v.slice(0, 60) } : { acao: achada, bruta: v };
}

/** Comando ja tomado pela ponte, com os campos que a execucao usa, tipados. */
export interface ComandoTomado {
  id: string;
  fabricaId: string | null;
  texto: string;
  cwd: string | null;
  conversationId: string | null;
  /** null quando o documento trouxe uma acao que a ponte nao reconhece. */
  acao: AcaoComando | null;
  acaoBruta: string | null;
  agente: string | null;
  modelo: string | null;
}

export type Origem = 'fato' | 'ponte' | 'fato mais leitura da ponte';
export type NivelRisco = 'baixo' | 'medio' | 'alto';

export interface CampoMarcado<T> {
  valor: T;
  origem: Origem;
}

/** Pacote completo do pedido de aprovacao, formato aprovado na OST 2. */
export interface PacoteAprovacao {
  marcacao: string;
  /**
   * Quais padroes de mascara pegaram algo neste pacote. Vazio quase sempre.
   *
   * Nasceu do achado da auditoria da OST 7: o caminho da aprovacao publicava
   * texto livre do agente sem mascara. Agora mascara, e DIZ que mascarou, porque
   * o diretor lendo "[credencial mascarada]" na tela precisa saber que foi a
   * ponte que trocou, e nao o agente que escreveu aquilo.
   */
  mascarou: string[];
  /** O texto do agente foi cortado no teto? Para a tela nao fingir que acabou ali. */
  textoDoAgenteCortado: boolean;
  oQue: CampoMarcado<string>;
  ferramenta: CampoMarcado<string>;
  tarefa: CampoMarcado<string>;
  fabrica: CampoMarcado<string>;
  agenteDisse: CampoMarcado<string | null>;
  porQue: CampoMarcado<string>;
  impacto: CampoMarcado<string>;
  oQueSeraTocado: CampoMarcado<string[]>;
  risco: CampoMarcado<NivelRisco>;
  tempoParadoMs: CampoMarcado<number>;
}

export type SituacaoAprovacao = 'pendente' | 'respondida';
export type RespostaAprovacao = 'aprovado' | 'recusado' | 'aprovado com observacao';

export interface Aprovacao {
  aprovacaoId: string;
  fabricaId: string;
  maquinaId: string;
  pacote: PacoteAprovacao;
  situacao: SituacaoAprovacao;
  criadoEm: Momento;
  origem: string;
  resposta: RespostaAprovacao | null;
  observacao?: string | null;
  respondidoEm?: Momento;
  respondidoPor?: string | null;
}

/** Decisao que volta da base para o portao. Falha fechada: o padrao e recusar. */
export interface DecisaoPortao {
  decisao: 'allow' | 'deny';
  resposta: string;
  observacao?: string | null;
}

export interface Relatorio {
  relatorioId: string;
  tipo: 'tarefa' | 'diario';
  fabricaId: string;
  conteudo: {
    solicitado: string;
    feito: string;
    faltou: string;
    decisoes: string;
    arquivosAreas: string;
    problemas: string;
    proximoPasso: string;
  };
  criadoEm: Momento;
}

/** Leitura segura de campo de texto vindo da base, sem `any`. */
export function textoDe(dado: unknown, campo: string): string | null {
  if (typeof dado !== 'object' || dado === null) return null;
  const v = (dado as Record<string, unknown>)[campo];
  return typeof v === 'string' ? v : null;
}

/** Converte resposta vinda da base no tipo fechado, ou null se nao reconhecida. */
export function respostaDe(valor: unknown): RespostaAprovacao | null {
  return valor === 'aprovado' || valor === 'recusado' || valor === 'aprovado com observacao'
    ? valor
    : null;
}
