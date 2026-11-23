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
 * ATIVIDADE: veja traduzirPasso, na secao de atividade. OST 10: o mapa antigo
 * esperava tipos que a ponte nunca gravou e escrevia "Deu um passo" em tudo.
 */

import type { FactoryState, RiskLevel } from '@/componentes/ds';
import {
  consumo as formatarConsumo,
  dataAmigavel,
  horaComSegundos,
  quandoCurto,
  tempoDecorrido,
  tempoParado as formatarTempoParado
} from '@/formato';
import type {
  AprovacaoBase,
  AtividadeBase,
  ComandoBase,
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

/* OST 9: como nasce, na tela, a fábrica aberta na mão. Pode ser renomeada. */
export const NOME_EXTERNA = 'Fábrica externa';

/*
 * Duas fábricas externas ao mesmo tempo têm de ser distinguíveis SEM mostrar
 * caminho, pedido do diretor. Só as que ainda não ganharam nome entram na conta.
 * Uma sozinha fica "Fábrica externa". Duas ou mais ganham a hora em que abriram;
 * se até a hora bater, ganham o número, na ordem em que abriram.
 *
 * OST 10: a hora sozinha era ambígua entre dias. Na tela de 23/11 apareciam
 * "das 18:30" e "das 21:57" que eram de outro dia. Agora a de hoje leva só a
 * hora, e a de outro dia leva a data junto: "Fábrica externa de 22/11 às 18:30".
 */
export function nomeDaExternaPelaHora(inicio: Date | null, agora: Date = new Date()): string {
  if (!inicio) return NOME_EXTERNA;
  const quando = quandoCurto(inicio, agora);
  return quando.includes(' às ') ? `${NOME_EXTERNA} de ${quando}` : `${NOME_EXTERNA} das ${quando}`;
}

export function distinguirExternas(lista: Fabrica[], agora: Date = new Date()): Fabrica[] {
  const semNome = lista.filter((f) => f.externa && f.nomeDado === null);
  if (semNome.length < 2) return lista;
  const ordem = [...semNome].sort((a, b) => (a.startedAt?.getTime() ?? 0) - (b.startedAt?.getTime() ?? 0));
  const rotulo = new Map<string, string>();
  const vezes = new Map<string, number>();
  for (const f of ordem) {
    const base = nomeDaExternaPelaHora(f.startedAt, agora);
    const n = (vezes.get(base) ?? 0) + 1;
    vezes.set(base, n);
    rotulo.set(f.id, n === 1 ? base : `${base}, nº ${n}`);
  }
  /* Se a primeira de uma hora repetida ficou sem número, ela ganha o 1. */
  for (const f of ordem) {
    const r = rotulo.get(f.id) as string;
    if (!r.includes(', nº ') && (vezes.get(r) ?? 0) > 1) rotulo.set(f.id, `${r}, nº 1`);
  }
  return lista.map((f) => (rotulo.has(f.id) ? { ...f, project: rotulo.get(f.id) as string } : f));
}

/* O mesmo formato que o pacote do designer espera (interface Factory), com os
   campos ja formatados em pt-BR para a tela, mais o que a tela do painel usa. */
export interface Fabrica {
  id: string;
  /* OST 9: o TITULO da fabrica na tela, que e o NOME. O nome dado pelo diretor;
     sem ele, "Fábrica externa" para a aberta na mão, e o nome da pasta para a
     fábrica antiga do painel que nasceu antes de existir nome. */
  project: string;
  /* O nome que o diretor digitou, ou nulo. É o que a caixa de renomear mostra. */
  nomeDado: string | null;
  /* Aberta na mão, fora do painel. */
  externa: boolean;
  /* Só o NOME da pasta do projeto, nunca o caminho. OST 9: o caminho C:Users
     saiu de toda tela que o diretor lê. */
  projeto: string;
  /* O caminho inteiro fica só por dentro, para a escolha rápida de projeto na
     abertura. Nenhuma tela mostra este campo. */
  caminho: string | null;
  agent: string;
  model: string;
  state: FactoryState;
  doing: string;
  startedAt: Date | null;
  /* OST 10: quando abriu, para o cartão. Hoje, só a hora; outro dia, com a data. */
  abertaEm: string;
  /* OST 9: tempo da TAREFA, não da abertura. Nulo quando não foi medido. */
  taskMs: number | null;
  /* A tarefa está andando agora: o relógio conta até agora. */
  tarefaAndando: boolean;
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
  /*
   * OST 9: o número que a tela mostra passou a ser o TEMPO DA TAREFA, pedido do
   * diretor. Tarefa é o comando que está rodando, ou o último que rodou: começa
   * quando a ponte entrega o comando (ou quando o diretor manda o prompt na
   * sessão aberta na mão) e para quando a rodada termina.
   *
   * Andando: conta do começo até agora. Parada: do começo até o fim gravado.
   * Sem começo gravado, ou parada sem fim gravado, é "não medida": a tela não
   * estima, e fábrica antiga, de antes da OST 9, cai aqui.
   */
  const tarefaInicio = paraData(doc.tarefaInicio);
  const tarefaFim = paraData(doc.tarefaFim ?? null);
  const ativa = estadoGravado === 'running' || estadoGravado === 'approval';
  const tarefaAndando = tarefaInicio !== null && tarefaFim === null && ativa && !opcoes.pontePerdida;
  const taskMs =
    tarefaInicio === null
      ? null
      : tarefaFim !== null && tarefaFim.getTime() >= tarefaInicio.getTime()
        ? tarefaFim.getTime() - tarefaInicio.getTime()
        : tarefaAndando
          ? Math.max(0, agora.getTime() - tarefaInicio.getTime())
          : null;
  const externa = semAcento(doc.origem ?? '') === 'mao' || doc.id.startsWith('mao-');
  const caminho = doc.projeto?.trim() || doc.pasta?.trim() || null;
  const nomeDaPasta = caminho ? (caminho.split(/[\\/]+/).filter(Boolean).pop() ?? null) : null;
  const nomeDado = doc.nome?.trim() || null;

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
    project: nomeDado ?? (externa ? NOME_EXTERNA : (nomeDaPasta ?? 'Fábrica sem nome')),
    nomeDado,
    externa,
    projeto: nomeDaPasta ?? 'projeto não informado',
    caminho,
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
    abertaEm: inicio
      ? quandoCurto(inicio, agora).includes(' às ')
        ? `aberta em ${quandoCurto(inicio, agora)}`
        : `aberta às ${quandoCurto(inicio, agora)}`
      : 'abertura sem hora',
    taskMs,
    tarefaAndando,
    tokens,
    elapsed: taskMs === null ? 'tarefa não medida' : `${tarefaAndando ? 'tarefa' : 'última tarefa'} ${tempoDecorrido(taskMs)}`,
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
    const caminho = (f.caminho ?? '').trim();
    if (!caminho) continue;
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

/*
 * OST 10, A TELA PASSA A DIZER O QUE ACONTECEU.
 *
 * DEFEITO QUE ISTO CONSERTA, visto na tela do diretor: as seis linhas diziam
 * "Deu um passo". O tradutor antigo esperava os tipos do kit de outra versão
 * (user_input, agent_response, tool, checkpoint), e a ponte nunca gravou esses
 * nomes: ela grava init, texto, pensamento, ferramenta, resultado e fim (fábrica
 * aberta pelo painel) e init, comando do diretor, ferramenta, subagente, fim de
 * rodada, fim e aviso (aberta na mão). Nenhum casava, tudo caía no "Deu um
 * passo". Isso valia para TODA fábrica, liberada ou não.
 *
 * Agora cada passo vira uma linha com: qual evento, o que aconteceu, qual
 * ferramenta, qual arquivo ou comando, e qual agente agiu.
 */

export type TipoDaLinha =
  | 'ordem'
  | 'resposta'
  | 'ferramenta'
  | 'subagente'
  | 'inicio'
  | 'fim'
  | 'aviso'
  | 'pensamento'
  | 'resultado'
  | 'passo';

export interface LinhaDaAtividade {
  id: string;
  quando: Date | null;
  seq: number;
  tipo: TipoDaLinha;
  /* Nome legível do evento, curto: "Ferramenta Read", "Sua ordem", "Resposta". */
  evento: string;
  /* O que aconteceu, numa frase. */
  titulo: string;
  /* Arquivo, comando ou padrão, em fonte de código. */
  detalhe: string | null;
  /* Texto longo: a ordem do diretor, a resposta da fábrica, a descrição. */
  texto: string | null;
  /* Subagente que agiu. Nulo é o agente principal da fábrica. */
  agente: string | null;
  erro: boolean;
  /* Ordem que o DIRETOR mandou, destacada das ações da fábrica. */
  doDiretor: boolean;
  /* Só para ordem do painel: entregue à ponte ou ainda pendente. */
  situacao: string | null;
}

/* Relato da ferramenta do Claude Code, em português. O nome cru da ferramenta é
   fato e aparece junto, no evento; a frase é só a tradução dele. */
const RELATO_DA_FERRAMENTA: Record<string, string> = {
  bash: 'Rodou um comando no terminal',
  powershell: 'Rodou um comando no PowerShell',
  read: 'Leu um arquivo',
  write: 'Escreveu um arquivo',
  edit: 'Alterou um arquivo',
  multiedit: 'Alterou um arquivo em vários pontos',
  glob: 'Procurou arquivos pelo nome',
  grep: 'Procurou um trecho nos arquivos',
  task: 'Delegou uma tarefa a um subagente',
  agent: 'Delegou uma tarefa a um subagente',
  todowrite: 'Atualizou a lista de tarefas',
  webfetch: 'Buscou uma página na internet',
  websearch: 'Pesquisou na internet',
  notebookedit: 'Alterou um caderno de notas',
  skill: 'Carregou uma habilidade',
  toolsearch: 'Procurou uma ferramenta'
};

function textoOuNulo(valor: unknown): string | null {
  return typeof valor === 'string' && valor.trim().length > 0 ? valor.trim() : null;
}

function primeiraLinha(texto: string, limite = 160): string {
  const limpo = texto.replace(/\s+/g, ' ').trim();
  return limpo.length > limite ? limpo.slice(0, limite - 1) + '…' : limpo;
}

/* Texto que a ponte grava quando o projeto não estava liberado para conteúdo. */
function semConteudo(valor: string | null): boolean {
  return valor !== null && /^conteudo nao publicado/i.test(valor);
}

const AVISO_SEM_CONTEUDO =
  'O texto não foi gravado: quando este passo aconteceu, o projeto não estava liberado para conteúdo.';

type BaseDaLinha = Omit<LinhaDaAtividade, 'tipo' | 'evento' | 'titulo'>;

function linhaDeFerramenta(doc: AtividadeBase, base: BaseDaLinha): LinhaDaAtividade {
  const nome = textoOuNulo(doc.ferramenta) ?? textoOuNulo(doc.toolInfo?.name) ?? 'ferramenta';
  const chave = nome.toLowerCase();
  const chamado = textoOuNulo(doc.agenteChamado);
  let titulo =
    RELATO_DA_FERRAMENTA[chave] ??
    (nome.startsWith('mcp__') ? `Usou a ferramenta externa ${nome.split('__').slice(1).join(' ')}` : `Usou ${nome}`);
  if ((chave === 'agent' || chave === 'task') && chamado) titulo = `Delegou uma tarefa ao subagente ${chamado}`;
  const parametros = doc.toolInfo?.parameters as Record<string, unknown> | undefined;
  let detalhe = textoOuNulo(doc.alvo);
  if (!detalhe && parametros && typeof parametros === 'object') {
    for (const chaveP of ['command', 'file_path', 'path', 'pattern', 'url']) {
      const v = textoOuNulo(parametros[chaveP]);
      if (v) {
        detalhe = v;
        break;
      }
    }
  }
  return {
    ...base,
    tipo: 'ferramenta',
    evento: `Ferramenta ${nome}`,
    titulo: base.erro ? `${titulo}, e a ferramenta devolveu erro` : titulo,
    detalhe: detalhe ? primeiraLinha(detalhe, 400) : null,
    texto: textoOuNulo(doc.descricao)
  };
}

export function traduzirPasso(doc: AtividadeBase): LinhaDaAtividade {
  const quando = paraData(doc.anotadoEm ?? null) ?? paraData(doc.em);
  const erro = doc.erro === true || String(doc.estado ?? '').toUpperCase() === 'ERROR';
  const agente = textoOuNulo(doc.agente);
  const descricao = textoOuNulo(doc.descricao);
  const base: BaseDaLinha = {
    id: doc.id,
    quando,
    seq: typeof doc.seq === 'number' ? doc.seq : 0,
    detalhe: null,
    texto: null,
    agente,
    erro,
    doDiretor: false,
    situacao: null
  };
  const evento = textoOuNulo(doc.evento);
  const tipo = String(doc.tipo ?? '');

  /* Fábrica aberta na MÃO: a fila de ganchos grava o evento do Claude Code. */
  if (evento) {
    switch (evento) {
      case 'SessionStart':
        return {
          ...base,
          tipo: 'inicio',
          evento: 'Início',
          titulo: /origem resume/i.test(descricao ?? '') ? 'Sessão retomada na mão pelo diretor' : 'Sessão aberta na mão pelo diretor',
          detalhe: descricao
        };
      case 'UserPromptSubmit':
        /* Achado da prova da OST 10: quando um subagente roda em segundo plano,
           o próprio Claude Code entrega o aviso de "terminou" como se fosse um
           prompt. Isso NÃO é ordem do diretor e não pode aparecer como "Você
           mandou". */
        if (descricao !== null && /^\s*<(task-notification|system-reminder)>/i.test(descricao)) {
          return {
            ...base,
            tipo: 'aviso',
            evento: 'Aviso automático',
            titulo: /task-notification/i.test(descricao)
              ? 'O Claude Code avisou a fábrica que uma tarefa em segundo plano terminou. Não foi você quem mandou.'
              : 'O Claude Code mandou um lembrete automático à fábrica. Não foi você quem mandou.',
            texto: descricao
          };
        }
        return {
          ...base,
          tipo: 'ordem',
          evento: 'Sua ordem',
          titulo: 'Você mandou',
          texto: semConteudo(descricao) ? AVISO_SEM_CONTEUDO : descricao,
          doDiretor: true
        };
      case 'PostToolUse':
        return linhaDeFerramenta(doc, base);
      case 'SubagentStart':
        return { ...base, tipo: 'subagente', evento: 'Subagente', titulo: `O subagente ${agente ?? 'sem nome'} começou` };
      case 'SubagentStop':
        return {
          ...base,
          tipo: 'subagente',
          evento: 'Subagente',
          titulo: `O subagente ${agente ?? 'sem nome'} terminou`,
          texto: textoOuNulo(doc.resposta)
        };
      case 'Stop': {
        const resposta = textoOuNulo(doc.resposta);
        return {
          ...base,
          tipo: 'resposta',
          evento: 'Resposta',
          titulo: resposta
            ? 'A fábrica respondeu e parou, esperando a próxima ordem'
            : 'A fábrica terminou a rodada e espera a próxima ordem. O texto da resposta não foi gravado neste passo.',
          texto: resposta
        };
      }
      case 'SessionEnd':
        return {
          ...base,
          tipo: 'fim',
          evento: 'Fim',
          titulo: 'Sessão encerrada',
          detalhe: descricao && descricao !== 'sessao encerrada' ? descricao : null
        };
      case 'Notification':
        return {
          ...base,
          tipo: 'aviso',
          evento: 'Aviso',
          titulo: 'O Claude Code avisou',
          texto: semConteudo(descricao) ? AVISO_SEM_CONTEUDO : descricao
        };
      default:
        return { ...base, tipo: 'passo', evento, titulo: `Evento ${evento}`, texto: descricao };
    }
  }

  /* Fábrica aberta pelo PAINEL: a ponte grava o que o kit do Claude Code entrega. */
  switch (tipo) {
    case 'init':
      return { ...base, tipo: 'inicio', evento: 'Início', titulo: 'A ponte abriu a sessão no Claude Code', detalhe: descricao };
    case 'texto':
    case 'agent_response': {
      const t = descricao ?? textoOuNulo(doc.textoDelta);
      return {
        ...base,
        tipo: 'resposta',
        evento: 'Resposta',
        titulo: t ? 'A fábrica escreveu' : 'A fábrica escreveu uma resposta. O texto não era gravado antes da OST 10.',
        texto: t
      };
    }
    case 'pensamento':
      return { ...base, tipo: 'pensamento', evento: 'Raciocínio', titulo: 'Pensou antes de agir. O raciocínio não é gravado.' };
    case 'ferramenta':
    case 'tool':
      return linhaDeFerramenta(doc, base);
    case 'resultado':
      return { ...base, tipo: 'resultado', evento: 'Resultado', titulo: 'Recebeu o resultado da ferramenta' };
    case 'fim':
    case 'checkpoint': {
      const falhou = descricao !== null && descricao !== 'success';
      return {
        ...base,
        tipo: 'fim',
        evento: 'Fim da rodada',
        titulo:
          descricao === null
            ? 'Terminou a rodada'
            : falhou
              ? `Terminou a rodada com falha (${descricao})`
              : 'Terminou a rodada com sucesso',
        erro: base.erro || falhou
      };
    }
    case 'user_input':
      return { ...base, tipo: 'ordem', evento: 'Sua ordem', titulo: 'Você mandou', texto: textoOuNulo(doc.textoDelta), doDiretor: true };
    default:
      return {
        ...base,
        tipo: 'passo',
        evento: tipo || 'Passo',
        titulo: `Passo do tipo ${tipo || 'não informado'}`,
        texto: descricao
      };
  }
}

const ORDEM_POR_ACAO: Record<string, string> = {
  abrir: 'Você abriu a fábrica com esta ordem',
  comando: 'Você mandou',
  pausar: 'Você pausou a fábrica',
  reiniciar: 'Você mandou reiniciar a fábrica',
  encerrar: 'Você encerrou a fábrica'
};

/* A ordem do diretor pelo painel, lida da própria fila de comandos. */
export function traduzirComando(doc: ComandoBase): LinhaDaAtividade {
  const acao = semAcento(doc.acao ?? 'comando');
  const situacao = semAcento(doc.situacao ?? '');
  const comTexto = acao === 'abrir' || acao === 'comando';
  return {
    id: `comando-${doc.id}`,
    quando: paraData(doc.criadoEm),
    seq: -1,
    tipo: 'ordem',
    evento: 'Sua ordem',
    titulo: ORDEM_POR_ACAO[acao] ?? `Você mandou a ordem ${doc.acao ?? ''}`.trim(),
    detalhe: null,
    texto: comTexto ? textoOuNulo(doc.texto) : null,
    agente: null,
    erro: false,
    doDiretor: true,
    situacao: situacao === 'entregue' ? 'entregue à ponte' : situacao === 'pendente' ? 'ainda não entregue à ponte' : null
  };
}

export interface BlocoDaAtividade {
  /* A ordem do diretor que abre o bloco. Nula no bloco do começo, antes de
     qualquer ordem gravada. */
  ordem: LinhaDaAtividade | null;
  /* O que a fábrica fez em seguida, em ordem de tempo. */
  passos: LinhaDaAtividade[];
}

/*
 * A ordem de execução, do mais ANTIGO para o mais NOVO, e o sentido é este em
 * toda a tela. Cada ordem do diretor abre um bloco com o que veio em resposta a
 * ela, até a próxima ordem.
 *
 * `completo` diz se o histórico inteiro da atividade está carregado. Quando não
 * está, as ordens mais antigas que o passo mais antigo carregado ficam de fora,
 * para não aparecer ordem sem o que veio depois dela.
 */
export function montarAtividade(
  passos: AtividadeBase[],
  comandos: ComandoBase[],
  completo: boolean
): { linhas: LinhaDaAtividade[]; blocos: BlocoDaAtividade[] } {
  const traduzidos = passos.map(traduzirPasso);
  let maisAntigo: number | null = null;
  for (const l of traduzidos) {
    const t = l.quando?.getTime();
    if (t !== undefined && (maisAntigo === null || t < maisAntigo)) maisAntigo = t;
  }
  const ordens = comandos
    .map(traduzirComando)
    .filter((o) => completo || maisAntigo === null || (o.quando !== null && o.quando.getTime() >= maisAntigo));
  /* Fábrica aberta pelo painel: cada comando retoma a mesma conversa e grava um
     novo início. Do segundo em diante, a frase certa é "retomou". */
  const inicios = traduzidos
    .filter((l) => l.tipo === 'inicio' && l.titulo === 'A ponte abriu a sessão no Claude Code')
    .sort((a, b) => (a.quando?.getTime() ?? 0) - (b.quando?.getTime() ?? 0));
  for (const l of inicios.slice(1)) l.titulo = 'A ponte retomou a sessão no Claude Code';
  const linhas = [...traduzidos, ...ordens].sort((a, b) => {
    const ta = a.quando?.getTime() ?? 0;
    const tb = b.quando?.getTime() ?? 0;
    if (ta !== tb) return ta - tb;
    if (a.doDiretor !== b.doDiretor) return a.doDiretor ? -1 : 1;
    return a.seq - b.seq;
  });
  const blocos: BlocoDaAtividade[] = [];
  for (const l of linhas) {
    if (l.doDiretor) blocos.push({ ordem: l, passos: [] });
    else if (blocos.length === 0) blocos.push({ ordem: null, passos: [l] });
    else blocos[blocos.length - 1].passos.push(l);
  }
  return { linhas, blocos };
}

/* Frase curta: o que a linha diz, com o começo do texto quando há texto. */
export function resumoDaLinha(l: LinhaDaAtividade): string {
  return l.texto && l.tipo !== 'ferramenta' ? `${l.titulo}: ${primeiraLinha(l.texto, 120)}` : l.titulo;
}

export function horaDaLinha(l: LinhaDaAtividade): string {
  return horaComSegundos(l.quando);
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
