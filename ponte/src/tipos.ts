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
  erro?: string;
  atualizadoEm?: Momento;
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
}

/** Comando ja tomado pela ponte, com os campos que a execucao usa, tipados. */
export interface ComandoTomado {
  id: string;
  fabricaId: string | null;
  texto: string;
  cwd: string | null;
  conversationId: string | null;
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
