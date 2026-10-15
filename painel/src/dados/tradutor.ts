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
  dataAmigavel,
  horaComSegundos,
  tempoDecorrido,
  tempoParado as formatarTempoParado
} from '@/formato';
import type {
  AprovacaoBase,
  AtividadeBase,
  ConsumoBase,
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
  /* Identificador da maquina, que a fila de comandos carrega. O nome e para a
     tela; este e para a ordem chegar na maquina certa. */
  maquinaId: string | null;
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
      maquinaId: null,
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
    maquinaId: melhor.maquina.maquinaId ?? melhor.maquina.id ?? null,
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
  /* Nulo quer dizer NÃO MEDIDO, que é diferente de zero. Fábrica aberta na mão
     não tem contagem de token, porque o gancho do Claude Code não entrega. */
  tokens: number | null;
  elapsed: string;
  usage: string;
  pending: string | null;
  maquinaId: string | null;
  /* Onda 2: o que a tela precisa para comandar esta fabrica. */
  conversationId: string | null;
  pausada: boolean;
  nasceuNoPainel: boolean;
  erro: string | null;
  /* Rodada de teste da própria fábrica. A grade esconde por padrão. */
  teste: boolean;
}

/* O contrato nao tem campo para a frase do que a fabrica faz agora. Em vez de
   inventar, o painel escreve a frase a partir do estado, e a tela da fabrica
   mostra o passo real da atividade ao lado. */
function frasePeloEstado(estado: FactoryState, temPedido: boolean, pausada = false): string {
  if (estado === 'approval' || temPedido) return 'Parou para pedir aprovação.';
  if (estado === 'running') return 'Em execução. Abra a fábrica para ver o passo atual.';
  /* Pausada não é estado novo, §A.4 fecha a lista: ela fica em aguardando
     comando, com o campo pausada, e a tela diz a palavra certa ao diretor. */
  if (estado === 'idle' && pausada) return 'Pausada por você. Retome para ela voltar a andar.';
  if (estado === 'idle') return 'Esperando a próxima ordem.';
  if (estado === 'done') return 'Concluída.';
  if (estado === 'failed') return 'Falhou. Abra a fábrica para ver o último passo.';
  return 'A ponte está offline, o painel não sabe o passo atual.';
}

/*
 * Soma os tokens do consumo, aceitando a grafia do kit e a nossa.
 *
 * Devolve null quando NAO EXISTE medida, que é o caso de toda fábrica aberta na
 * mão: o gancho não recebe contagem de token do Claude Code. Zero seria mentira,
 * porque zero afirma que ela não gastou nada.
 */
export function somarTokens(consumo: ConsumoBase | undefined | null): number | null {
  if (consumo == null || typeof consumo !== 'object') return null;
  const n = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : 0);
  if (typeof consumo.totalTokens === 'number') return consumo.totalTokens;
  const soma =
    n(consumo.input_tokens) +
    n(consumo.output_tokens) +
    n(consumo.cache_read_input_tokens) +
    n(consumo.cache_creation_input_tokens) +
    n(consumo.inputTokens) +
    n(consumo.outputTokens) +
    n(consumo.cacheReadTokens) +
    n(consumo.thinkingTokens);
  /* Objeto de consumo existe mas sem nenhum número conhecido: isso é medida que
     não deu para ler, e continua sendo "não medido", não zero. */
  return soma > 0 ? soma : null;
}

export function traduzirFabrica(
  doc: FabricaBase,
  opcoes: { pontePerdida: boolean; pedidoParado?: number | null; agora?: Date }
): Fabrica {
  const agora = opcoes.agora ?? new Date();
  const inicio = paraData(doc.inicio);
  const estadoGravado = traduzirEstado(doc.estado);
  const state: FactoryState = opcoes.pontePerdida ? 'offline' : estadoGravado;
  /*
   * TEMPO DECORRIDO, e o que ele mede de verdade.
   *
   * Defeito achado na tela do diretor: fábrica CONCLUÍDA mostrava 19h57, e a
   * sessão não trabalhou 19 horas seguidas. O relógio era contado da abertura até
   * AGORA, para todo estado, então fábrica encerrada continuava contando a noite
   * inteira, o computador dormindo e o tempo parado junto.
   *
   * Agora o relógio PARA quando a fábrica para. Para a que já terminou, conta do
   * início até o fim; para a que está viva, conta do início até agora.
   *
   * O que este número é, dito sem enfeite: tempo de PAREDE desde a abertura, e
   * não tempo de trabalho. Fábrica aberta de manhã e usada duas vezes no dia
   * mostra o dia inteiro, porque o relógio não sabe distinguir espera de
   * trabalho. Medir tempo de trabalho de verdade é somar os intervalos entre
   * passos, e isso muda o desenho do §A.4: está proposto ao diretor, não feito.
   */
  const fimGravado = paraData(doc.encerradaEm) ?? paraData(doc.atualizadoEm);
  const acabou = estadoGravado === 'done' || estadoGravado === 'failed';
  const decorrido =
    typeof doc.tempoDecorridoMs === 'number' && doc.tempoDecorridoMs >= 0
      ? doc.tempoDecorridoMs
      : inicio
        ? Math.max(0, (acabou && fimGravado ? fimGravado.getTime() : agora.getTime()) - inicio.getTime())
        : 0;

  /*
   * CONSUMO. `null` quer dizer NÃO MEDIDO, e isso é diferente de zero.
   *
   * Fábrica que o diretor abre na mão não tem medida nenhuma: o gancho do Claude
   * Code não entrega contagem de token, e inventar zero ali seria dizer que ela
   * não gastou nada. Fábrica aberta pelo painel tem a medida do kit.
   */
  const tokens = somarTokens(doc.consumo);
  const temPedido = opcoes.pedidoParado != null;
  const pausada = doc.pausada === true;
  return {
    id: doc.id,
    project: doc.projeto?.trim() || 'Projeto sem nome',
    folder: doc.pasta?.trim() || null,
    agent: doc.agente?.trim() || 'Agente não informado',
    /*
     * MODELO. Quando falta, a tela tem de dizer POR QUE falta.
     *
     * "modelo não informado" soava como campo que alguém esqueceu de preencher.
     * A verdade é outra: numa sessão que o diretor abre na mão, o gancho do
     * Claude Code não recebe o modelo, e nenhuma parte da Fábrica tem como saber
     * qual é. Conferido na fila de verdade: as chaves que chegam são t, ev, sid,
     * projeto, origem, ferramenta, alvo, descricao, erro, pedidoDoDiretor,
     * subagente, permissao, fonte, motivo, aviso, custoMs, e nenhuma é modelo.
     * Fábrica aberta pelo painel tem modelo, porque ali quem escolhe é a ponte.
     */
    model:
      doc.modelo?.trim() ||
      (semAcento(doc.origem ?? '') === 'mao' || doc.id.startsWith('mao-')
        ? 'modelo não reportado pelo Claude Code'
        : 'modelo não informado'),
    state,
    doing: frasePeloEstado(state, temPedido, pausada),
    startedAt: inicio,
    elapsedMs: decorrido,
    tokens,
    elapsed: tempoDecorrido(decorrido),
    usage: formatarConsumo(tokens),
    pending: temPedido ? `Parado há ${formatarTempoParado(opcoes.pedidoParado)}` : null,
    maquinaId: doc.maquinaId ?? null,
    conversationId: doc.conversationId ?? null,
    pausada,
    nasceuNoPainel: semAcento(doc.origem ?? '') === 'painel' || doc.id.startsWith('painel-'),
    erro: doc.erro?.trim() || null,
    teste: doc.teste === true
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

/* Caminhos de projeto que JA apareceram na base, para a tela de nova fabrica
   oferecer escolha rapida. Não é cadastro de projeto, que é F7 e está fora
   desta onda, §A.12: é só o que a base já viu, sem inventar nada. A ponte
   escreve a pasta no campo projeto, e quando informa pasta separada o painel
   prefere a pasta. */
export interface CaminhoDeProjeto {
  caminho: string;
  nome: string;
  quantas: number;
}

export function caminhosDeProjeto(lista: Fabrica[]): CaminhoDeProjeto[] {
  const vistos = new Map<string, CaminhoDeProjeto>();
  for (const f of lista) {
    const caminho = (f.folder ?? f.project ?? '').trim();
    if (!caminho || caminho === 'Projeto sem nome') continue;
    const anterior = vistos.get(caminho);
    if (anterior) {
      anterior.quantas += 1;
      continue;
    }
    const pedacos = caminho.split(/[\\/]+/).filter(Boolean);
    vistos.set(caminho, { caminho, nome: pedacos[pedacos.length - 1] ?? caminho, quantas: 1 });
  }
  return [...vistos.values()].sort((a, b) => b.quantas - a.quantas || a.caminho.localeCompare(b.caminho));
}

/* ---------- aprovacao ---------- */

/* Marcação de honestidade da OST 2: cada campo do pacote diz se é fato
   capturado do portão ou leitura da ponte sobre o que viu. O painel mostra isso
   na cara, porque foi o que o diretor pediu para poder confiar no pacote. */
export type MarcaDaOrigem = 'fato' | 'ponte' | 'fato e ponte';

export function marcaDaOrigem(origem: string | undefined | null): MarcaDaOrigem | null {
  if (!origem) return null;
  const limpa = semAcento(origem);
  if (limpa === 'fato') return 'fato';
  if (limpa === 'ponte') return 'ponte';
  if (limpa.includes('fato') && limpa.includes('ponte')) return 'fato e ponte';
  if (limpa.includes('ponte')) return 'ponte';
  if (limpa.includes('fato')) return 'fato';
  return null;
}

export const ROTULO_DA_ORIGEM: Record<MarcaDaOrigem, string> = {
  fato: 'fato capturado',
  ponte: 'leitura da ponte',
  'fato e ponte': 'fato mais leitura da ponte'
};

/* O mesmo formato do pacote (interface Approval mais as props de ApprovalItem). */
export interface Aprovacao {
  id: string;
  factoryId: string | null;
  maquinaId: string | null;
  project: string;
  task: string;
  title: string;
  why: string;
  impact: string;
  touches: string[];
  risk: RiskLevel;
  tool: string | null;
  agentSaid: string | null;
  requestedAt: Date | null;
  waitingMs: number;
  waiting: string;
  stale: boolean;
  /* Origem de cada campo que a tela mostra, já traduzida para a marca. */
  origens: {
    title: MarcaDaOrigem | null;
    why: MarcaDaOrigem | null;
    impact: MarcaDaOrigem | null;
    touches: MarcaDaOrigem | null;
    risk: MarcaDaOrigem | null;
    tool: MarcaDaOrigem | null;
    agentSaid: MarcaDaOrigem | null;
  };
}

/* Resposta já dada, para o histórico da tela de Aprovações. */
export interface Decisao {
  id: string;
  title: string;
  resposta: 'approved' | 'rejected' | 'noted';
  observacao: string | null;
  respondidoEm: Date | null;
  quando: string;
  respondidoPor: string | null;
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
    maquinaId: doc.maquinaId ?? null,
    project: pacote.fabrica?.valor?.trim() || 'Fábrica não informada',
    task: pacote.tarefa?.valor?.trim() || '',
    title: pacote.oQue?.valor?.trim() || pacote.resumo?.valor?.trim() || 'Pedido sem descrição',
    why: pacote.porQue?.valor?.trim() || 'A ponte não informou o motivo.',
    impact: pacote.impacto?.valor?.trim() || 'A ponte não informou o impacto.',
    touches: comoLista(pacote.oQueSeraTocado?.valor),
    risk: traduzirRisco(pacote.risco?.valor),
    tool: pacote.ferramenta?.valor?.trim() || null,
    agentSaid: pacote.agenteDisse?.valor?.trim() || null,
    requestedAt: criado,
    waitingMs,
    waiting: formatarTempoParado(waitingMs),
    stale: waitingMs > LIMITE_PARADO_MS,
    origens: {
      title: marcaDaOrigem(pacote.oQue?.origem ?? pacote.resumo?.origem),
      why: marcaDaOrigem(pacote.porQue?.origem),
      impact: marcaDaOrigem(pacote.impacto?.origem),
      touches: marcaDaOrigem(pacote.oQueSeraTocado?.origem),
      risk: marcaDaOrigem(pacote.risco?.origem),
      tool: marcaDaOrigem(pacote.ferramenta?.origem),
      agentSaid: marcaDaOrigem(pacote.agenteDisse?.origem)
    }
  };
}

const MAPA_DE_RESPOSTA: Record<string, Decisao['resposta']> = {
  aprovado: 'approved',
  recusado: 'rejected',
  'aprovado com observacao': 'noted'
};

export function traduzirDecisao(doc: AprovacaoBase, agora: Date = new Date()): Decisao | null {
  const resposta = MAPA_DE_RESPOSTA[semAcento(doc.resposta ?? '')];
  if (!resposta) return null;
  const quando = paraData(doc.respondidoEm);
  return {
    id: doc.id,
    title: doc.pacote?.oQue?.valor?.trim() || doc.pacote?.resumo?.valor?.trim() || 'Pedido sem descrição',
    resposta,
    observacao: doc.observacao?.trim() || null,
    respondidoEm: quando,
    quando: quando ? dataAmigavel(quando, agora) : 'sem hora na base',
    respondidoPor: doc.respondidoPor?.trim() || null
  };
}

export function ordenarDecisoes(lista: Decisao[]): Decisao[] {
  /* Resposta mais recente primeiro: no histórico, o que acabou de acontecer é o
     que o diretor procura. */
  return [...lista].sort((a, b) => (b.respondidoEm?.getTime() ?? 0) - (a.respondidoEm?.getTime() ?? 0));
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
