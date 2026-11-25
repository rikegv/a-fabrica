/*
 * OST 11, A FÁBRICA VIVA. Cálculo puro, sem React e sem base, para poder ser
 * provado sozinho.
 *
 * Recebe as linhas da atividade (já traduzidas, do mais antigo para o mais
 * novo) e devolve o que a tela desenha:
 *  - o CHAT com o coordenador: as ordens do diretor e as respostas do
 *    coordenador, em ordem de hora;
 *  - o cartão do COORDENADOR, que é a sessão principal da fábrica, regra do
 *    diretor;
 *  - um cartão por AGENTE do time, lido do projeto pela ponte, mais todo agente
 *    que apareceu na atividade sem estar na lista;
 *  - o estado de cada LINHA entre o coordenador e o agente: apagada, ida
 *    (trabalho saindo do coordenador), em troca (o agente trabalhando) ou volta
 *    (o agente entregando). A luz só anda quando existe troca de verdade.
 *
 * De onde vem o nome do agente, provado ao vivo na OST 11: na fábrica aberta na
 * mão, o próprio Claude Code carimba `agent_type` em todo evento que nasce num
 * agente, e o gancho grava; na aberta pelo painel, a ponte liga cada passo à
 * chamada de delegação que o originou. Passo com `agente` nulo é o principal.
 * Passo gravado antes de a ponte registrar o agente NÃO é atribuído a ninguém:
 * fica contado à parte, dito na tela.
 */

import type { FactoryState } from '@/componentes/ds';
import type { LinhaDaAtividade } from './tradutor';

/* Nome do motor que a ponte grava quando não há persona. Não é agente. */
const NOMES_DO_MOTOR = new Set(['claude code', 'agente não informado', '']);
export const NOME_DO_COORDENADOR = 'coordenador';

/* Janela em que uma delegação ou uma entrega ainda acende a linha. */
export const JANELA_DA_TROCA_MS = 25_000;
/* Sem passo novo há mais que isto, o agente não está mais trabalhando, mesmo
   sem o aviso de fim (a fábrica pode ter caído no meio). */
export const SILENCIO_MS = 3 * 60_000;
/* Quantas ações cada cartão guarda para mostrar. */
export const ACOES_POR_CARTAO = 40;

export type Fluxo = 'apagada' | 'ida' | 'troca' | 'volta';

export interface AcaoDoAgente {
  id: string;
  quando: Date | null;
  frase: string;
  /* Nome do arquivo, ou a descrição curta do que foi feito. */
  objeto: string | null;
  erro: boolean;
}

export interface CartaoDeAgente {
  nome: string;
  rotulo: string;
  descricao: string | null;
  /* Do mais NOVO para o mais antigo: o cartão mostra primeiro o que acabou de
     acontecer. A tela diz isso. */
  acoes: AcaoDoAgente[];
  totalDeAcoes: number;
  ultimaVez: Date | null;
  trabalhando: boolean;
  fluxo: Fluxo;
  /* Veio da lista do projeto (true) ou só apareceu na atividade (false). */
  doProjeto: boolean;
}

export interface MensagemDoChat {
  id: string;
  quando: Date | null;
  de: 'diretor' | 'coordenador' | 'aviso';
  texto: string;
  situacao: string | null;
}

export interface TimeDaFabrica {
  coordenador: CartaoDeAgente;
  agentes: CartaoDeAgente[];
  chat: MensagemDoChat[];
  /* Passos antigos, de antes de a ponte gravar o nome do agente. */
  semRegistro: number;
  delegacoes: number;
  delegacoesEntregues: number;
}

function rotuloDe(nome: string): string {
  const limpo = nome.replace(/[-_]+/g, ' ').trim();
  return limpo.charAt(0).toUpperCase() + limpo.slice(1);
}

function nomeDoArquivo(caminho: string): string {
  const partes = caminho.split(/[\\/]+/).filter(Boolean);
  return partes[partes.length - 1] ?? caminho;
}

function curto(texto: string, limite = 90): string {
  const t = texto.replace(/\s+/g, ' ').trim();
  return t.length > limite ? t.slice(0, limite - 1) + '…' : t;
}

/* A frase em português claro, sem termo técnico, do que o agente fez. */
const FRASE_DA_FERRAMENTA: Record<string, string> = {
  read: 'Leu',
  write: 'Escreveu',
  edit: 'Alterou',
  multiedit: 'Alterou',
  notebookedit: 'Alterou',
  glob: 'Procurou arquivos',
  grep: 'Procurou um trecho nos arquivos',
  bash: 'Rodou um comando no computador',
  powershell: 'Rodou um comando no computador',
  todowrite: 'Atualizou a lista do que falta fazer',
  webfetch: 'Abriu uma página da internet',
  websearch: 'Pesquisou na internet',
  skill: 'Usou uma habilidade pronta',
  toolsearch: 'Procurou uma ferramenta'
};

export function acaoDaLinha(l: LinhaDaAtividade): AcaoDoAgente | null {
  const base = { id: l.id, quando: l.quando, erro: l.erro };
  switch (l.tipo) {
    case 'ferramenta': {
      const chave = (l.ferramenta ?? '').toLowerCase();
      if (chave === 'agent' || chave === 'task') {
        return {
          ...base,
          frase: l.agenteChamado ? `Passou trabalho para ${rotuloDe(l.agenteChamado)}` : 'Passou trabalho para um agente',
          objeto: l.texto ? curto(l.texto) : null
        };
      }
      const frase = FRASE_DA_FERRAMENTA[chave] ?? (chave.startsWith('mcp__') ? 'Usou um serviço externo' : 'Usou uma ferramenta');
      const arquivo = ['read', 'write', 'edit', 'multiedit', 'notebookedit'].includes(chave);
      const objeto = arquivo && l.detalhe ? nomeDoArquivo(l.detalhe) : l.texto ? curto(l.texto) : null;
      return { ...base, frase: l.erro ? `${frase}, e deu erro` : frase, objeto };
    }
    case 'resposta':
      return l.texto ? { ...base, frase: 'Respondeu', objeto: curto(l.texto, 140) } : null;
    case 'subagente':
      return l.titulo.endsWith('terminou')
        ? { ...base, frase: 'Entregou o trabalho', objeto: l.texto ? curto(l.texto, 140) : null }
        : { ...base, frase: 'Começou a trabalhar', objeto: null };
    case 'fim':
      return l.erro ? { ...base, frase: 'Terminou a rodada com falha', objeto: null } : null;
    default:
      return null;
  }
}

function principalDa(agentePrincipal: string): string {
  const n = agentePrincipal.trim().toLowerCase();
  return NOMES_DO_MOTOR.has(n) ? NOME_DO_COORDENADOR : agentePrincipal.trim();
}

/*
 * Quem deu o passo. Nulo é o principal. Na fábrica aberta na mão como
 * coordenador, o próprio principal vem com nome, e conta como principal.
 * O "Passou trabalho" é do principal, mesmo quando o Claude Code carimba nele o
 * nome de quem foi chamado.
 */
function donoDoPasso(l: LinhaDaAtividade, principal: string): string | null {
  if (l.semRegistroDeAgente) return null;
  if (!l.agente || l.agente === principal) return principal;
  return l.agente;
}

/*
 * OST 13, item 2. Junta a conversa inteira (consulta própria, sem o limite de
 * 200) com a janela recente da atividade, sem repetir passo, na ordem da tela:
 * hora, e na mesma hora a ordem do diretor antes do que veio dela.
 */
export function juntarSemRepetir(...listas: LinhaDaAtividade[][]): LinhaDaAtividade[] {
  const porId = new Map<string, LinhaDaAtividade>();
  for (const lista of listas) for (const l of lista) if (!porId.has(l.id)) porId.set(l.id, l);
  return [...porId.values()].sort((a, b) => {
    const ta = a.quando?.getTime() ?? 0;
    const tb = b.quando?.getTime() ?? 0;
    if (ta !== tb) return ta - tb;
    if (a.doDiretor !== b.doDiretor) return a.doDiretor ? -1 : 1;
    return a.seq - b.seq;
  });
}

/* Resposta da sessão principal: o fim de rodada da aberta na mão, ou o texto do
   agente principal da aberta pelo painel. Texto de subagente não é. */
function respostaDoPrincipal(l: LinhaDaAtividade, principal: string): boolean {
  if (l.tipo !== 'resposta') return false;
  if (l.semRegistroDeAgente) return !l.agente && l.evento === 'Resposta';
  return !l.agente || l.agente === principal;
}

/*
 * OST 13, os três pontinhos. Defeito medido: depois do fim de rodada o Claude
 * Code manda um aviso e um "fim de agente" sem nome (o resumo automático), e a
 * tela olhava só a última linha. Agora conta só o que é trabalho de verdade:
 * ordem do diretor ainda sem resposta, ou passo do time depois da última
 * resposta. Aviso, fim de agente, início e fim de sessão não acendem nada.
 */
function trabalhoDoTime(l: LinhaDaAtividade, principal: string): boolean {
  if (l.tipo === 'ferramenta' || l.tipo === 'pensamento' || l.tipo === 'resultado') return true;
  if (l.tipo === 'subagente') return Boolean(l.agente) && l.agente !== principal && !l.titulo.endsWith('terminou');
  /* Texto de subagente, na fábrica aberta pelo painel. */
  if (l.tipo === 'resposta') return Boolean(l.agente) && l.agente !== principal;
  return false;
}

export function conversaEmAndamento(linhas: LinhaDaAtividade[], principal: string): boolean {
  let ultimoFecho = -1;
  let ultimaOrdem = -1;
  let ultimoTrabalho = -1;
  linhas.forEach((l, i) => {
    if (l.doDiretor) ultimaOrdem = i;
    else if (respostaDoPrincipal(l, principal) || l.tipo === 'fim') ultimoFecho = i;
    else if (trabalhoDoTime(l, principal)) ultimoTrabalho = i;
  });
  return ultimaOrdem > ultimoFecho || ultimoTrabalho > ultimoFecho;
}

export function montarTime(opcoes: {
  linhas: LinhaDaAtividade[];
  /* OST 13: a conversa inteira, lida numa consulta própria. Sem ela, o chat sai
     só da janela recente. */
  conversa?: LinhaDaAtividade[];
  agentePrincipal: string;
  agentesDoProjeto: Array<{ nome: string; descricao: string }>;
  estado: FactoryState;
  agora: Date;
}): TimeDaFabrica {
  const principal = principalDa(opcoes.agentePrincipal);
  const viva = opcoes.estado === 'running' || opcoes.estado === 'approval';
  const agora = opcoes.agora.getTime();
  const descricoes = new Map(opcoes.agentesDoProjeto.map((a) => [a.nome, a.descricao]));

  const cartoes = new Map<string, CartaoDeAgente>();
  const cartao = (nome: string): CartaoDeAgente => {
    let c = cartoes.get(nome);
    if (!c) {
      c = {
        nome,
        rotulo: rotuloDe(nome),
        descricao: descricoes.get(nome) ?? null,
        acoes: [],
        totalDeAcoes: 0,
        ultimaVez: null,
        trabalhando: false,
        fluxo: 'apagada',
        doProjeto: descricoes.has(nome)
      };
      cartoes.set(nome, c);
    }
    return c;
  };
  cartao(principal);
  for (const a of opcoes.agentesDoProjeto) if (a.nome !== principal) cartao(a.nome);

  /* Por agente: quando recebeu trabalho, quando deu o último passo, quando
     entregou. É disso que sai a luz da linha. */
  const chamadoEm = new Map<string, number>();
  const ultimoPasso = new Map<string, number>();
  const entregouEm = new Map<string, number>();
  const chat: MensagemDoChat[] = [];
  let semRegistro = 0;
  let delegacoes = 0;
  let ultimoDoPrincipal = 0;
  const temAvisoDeFim = opcoes.linhas.some((l) => l.tipo === 'subagente');

  for (const l of opcoes.linhas) {
    const t = l.quando?.getTime() ?? 0;
    if (l.doDiretor) continue;
    if (l.semRegistroDeAgente) {
      semRegistro++;
      continue;
    }
    const dono = donoDoPasso(l, principal) as string;
    const delegacao = l.tipo === 'ferramenta' && /^(agent|task)$/i.test(l.ferramenta ?? '');
    /* Delegação é ação do coordenador, mesmo carimbada com o nome do chamado. */
    const quem = delegacao ? principal : dono;
    const c = cartao(quem);
    /* O Claude Code às vezes manda "fim de agente" com o nome do próprio
       principal. Isso não é entrega de ninguém, e não vira ação no cartão.
       OST 13: a resposta do coordenador mora no chat e sai do cartão dele; o
       cartão mostra o que ele fez. */
    const acao = quem === principal && (l.tipo === 'subagente' || l.tipo === 'resposta') ? null : acaoDaLinha(l);
    if (acao) {
      c.totalDeAcoes++;
      c.acoes.push(acao);
    }
    if (t) c.ultimaVez = l.quando;
    if (delegacao) {
      delegacoes++;
      const chamado = l.agenteChamado ?? 'general-purpose';
      cartao(chamado);
      chamadoEm.set(chamado, t);
    }
    if (quem === principal) {
      if (t) ultimoDoPrincipal = Math.max(ultimoDoPrincipal, t);
    } else {
      if (t) ultimoPasso.set(quem, Math.max(ultimoPasso.get(quem) ?? 0, t));
      if (l.tipo === 'subagente' && l.titulo.endsWith('começou')) chamadoEm.set(quem, Math.max(chamadoEm.get(quem) ?? 0, t));
      if (l.tipo === 'subagente' && l.titulo.endsWith('terminou')) entregouEm.set(quem, t);
    }
  }

  let delegacoesEntregues = 0;
  for (const c of cartoes.values()) {
    c.acoes = c.acoes.slice(-ACOES_POR_CARTAO).reverse();
    if (c.nome === principal) continue;
    const chamado = chamadoEm.get(c.nome) ?? 0;
    const passo = Math.max(ultimoPasso.get(c.nome) ?? 0, chamado);
    let entregou = entregouEm.get(c.nome) ?? 0;
    /* Fábrica aberta pelo painel não recebe aviso de fim de agente: o agente
       entregou quando o coordenador voltou a agir depois do último passo dele. */
    if (!temAvisoDeFim && passo > 0 && ultimoDoPrincipal > passo) entregou = Math.max(entregou, ultimoDoPrincipal);
    if (chamado > 0 && entregou >= chamado) delegacoesEntregues++;
    const aberto = passo > 0 && entregou < passo;
    c.trabalhando = viva && aberto && agora - passo < SILENCIO_MS;
    if (c.trabalhando) c.fluxo = agora - chamado < JANELA_DA_TROCA_MS && chamado >= passo - 1000 ? 'ida' : 'troca';
    else if (viva && entregou > 0 && agora - entregou < JANELA_DA_TROCA_MS) c.fluxo = 'volta';
    else c.fluxo = 'apagada';
  }
  /* OST 13: o chat sai da conversa inteira mais a janela recente. Aviso
     automático do Claude Code não entra, e nunca aparece como "Você". */
  const todas = juntarSemRepetir(opcoes.conversa ?? [], opcoes.linhas);
  for (const l of todas) {
    if (l.doDiretor) {
      chat.push({ id: l.id, quando: l.quando, de: 'diretor', texto: l.texto ?? l.titulo, situacao: l.situacao });
    } else if (l.texto && respostaDoPrincipal(l, principal)) {
      chat.push({
        id: l.id,
        quando: l.quando,
        de: 'coordenador',
        texto: l.texto,
        situacao: /\[\.\.\.cortado\]\s*$/.test(l.texto) ? 'texto cortado na gravação' : null
      });
    }
  }

  const coord = cartoes.get(principal) as CartaoDeAgente;
  coord.trabalhando = viva && (conversaEmAndamento(todas, principal) || [...cartoes.values()].some((c) => c.trabalhando));
  coord.fluxo = coord.trabalhando ? 'troca' : 'apagada';

  const agentes = [...cartoes.values()].filter((c) => c.nome !== principal);
  /* Os do projeto na ordem da lista; os que só apareceram na atividade, depois. */
  const ordemDoProjeto = new Map(opcoes.agentesDoProjeto.map((a, i) => [a.nome, i]));
  agentes.sort((a, b) => (ordemDoProjeto.get(a.nome) ?? 999) - (ordemDoProjeto.get(b.nome) ?? 999) || a.nome.localeCompare(b.nome));

  return {
    coordenador: coord,
    agentes,
    chat,
    semRegistro,
    delegacoes,
    delegacoesEntregues: Math.min(delegacoesEntregues, delegacoes)
  };
}
