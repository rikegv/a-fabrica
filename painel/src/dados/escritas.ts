'use client';

/*
 * CAMADA DE ESCRITA DO PAINEL. Porta unica, de proposito.
 *
 * Nenhuma tela chama addDoc, setDoc ou updateDoc. Toda ordem que sai do painel
 * passa por aqui, e por isso todas as regras duras da Onda 2 cabem num arquivo
 * so, onde dao para conferir de uma leitura:
 *
 *  1. SEM USUARIO AUTENTICADO, NADA SAI. Toda funcao comeca por conferir(), que
 *     exige base ligada, usuario presente, e-mail do diretor e e-mail verificado
 *     pelo provedor. Falha fechada, §A.6: na duvida recusa, nunca escreve.
 *  2. HORA DE SERVIDOR SEMPRE. criadoEm e respondidoEm saem de serverTimestamp()
 *     e de nenhum outro lugar. A regra do Firestore compara com request.time e
 *     NEGA hora de cliente, entao hora de maquina aqui nao e estilo, e quebra.
 *  3. SITUACAO NASCE PENDENTE. Comando nasce pendente e so a ponte marca
 *     entregue. Resposta de aprovacao vai de pendente para respondida, uma vez.
 *  4. ORIGEM LEGIVEL. Texto que diz de onde a ordem veio e com qual conta, por
 *     exemplo "painel no celular, henrique.vieira@soulan.com.br". A trilha nao
 *     se apaga, §A.6, entao ela tem de ser lida por pessoa.
 *  5. TEXTO SEMPRE PREENCHIDO, inclusive em encerrar, pausar e reiniciar: a
 *     frase que o diretor leria na trilha, nao codigo.
 *  6. PONTE OFFLINE NAO ESCREVE. A ordem so sai com a ponte viva e com maquina
 *     pareada, porque sem ponte ninguem executa e a fila viraria engano.
 *
 * O painel NUNCA fala com a fabrica, §A.3: ele escreve em comandos e em
 * aprovacoes, e a ponte le. Nenhuma funcao aqui escreve em fabricas, em
 * atividade, em maquinas ou em relatorios, que sao da ponte.
 *
 * OST 16: o painel tambem escreve em crachas, e so ele, porque emitir e revogar
 * o cracha de uma maquina e decisao do diretor. Essas duas escritas nao pedem
 * ponte viva (a maquina que pede cracha ainda nao tem ponte no ar) e saem
 * sempre em gravacao em lote, docs/ost16-contrato.md.
 *
 * Nenhuma funcao lanca excecao para a tela. Toda uma devolve Resultado, com erro
 * em portugues, para a tela nunca fingir que deu certo.
 */

import type { User } from 'firebase/auth';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit as limitar,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type FieldValue,
  type Firestore
} from 'firebase/firestore';
import {
  LIMITE_DE_PEDIDOS,
  barreiraDaEmissao,
  fraseDaBarreira,
  inicioDaJanela,
  loteDeEmissao,
  loteDeRevogacao,
  origemDoPainel,
  pedidosAbertos,
  traduzirCracha,
  traduzirPedido,
  type Cracha,
  type CrachaBase,
  type Escrita,
  type PedidoDeCracha,
  type PedidoDeCrachaBase
} from './crachas';
import { EMAIL_DO_DIRETOR } from './firebase';

/* Acoes de comando, seção 2 do contrato da Onda 2 (docs/ost7-contrato-onda2.md).
   Comando sem acao vale como "comando", e por isso os testes da OST 6 seguem
   valendo sem uma linha de mudanca. */
export type AcaoDeComando = 'abrir' | 'comando' | 'encerrar' | 'pausar' | 'reiniciar';

export type RespostaDeAprovacao = 'aprovado' | 'recusado' | 'aprovado com observacao';

export type Resultado = { ok: true; id: string } | { ok: false; erro: string };

/* O que a tela entrega para a camada poder decidir se escreve. Montado uma vez
   na raiz do painel e passado para as telas. */
export interface ContextoDeEscrita {
  base: Firestore | null;
  usuario: User | null;
  /** Maquina pareada, de onde a ponte le a fila. Sem ela, nada sai. */
  maquinaId: string | null;
  /** Ponte viva pelo heartbeat, §A.10. Offline nao escreve. */
  pontePronta: boolean;
  /** Para a trilha dizer de onde veio a ordem. */
  celular: boolean;
}

/* ---------- guardas ---------- */

/* Por que a escrita esta impedida. A camada decide; quem escreve a frase para o
   controle na tela e src/telas/textos.ts, porque a frase muda de lugar para
   lugar e aqui so interessa o motivo. */
export type Impedimento = 'sem base' | 'sem sessao' | 'ponte offline' | 'sem maquina';

/* A mesma lista, dita depois da tentativa: aqui o diretor precisa ouvir que
   nada foi registrado. */
const DEPOIS_DA_TENTATIVA: Record<Impedimento, string> = {
  'sem base':
    'O painel não está ligado à base agora, então a ordem não foi registrada. Recarregue o painel e tente de novo.',
  'sem sessao': 'A sua sessão não está mais válida, então nada foi registrado. Entre de novo e repita a ordem.',
  'ponte offline': 'A ponte está offline, então a ordem não foi registrada. Nada é entregue até ela voltar.',
  'sem maquina':
    'Nenhuma ponte pareada, então não existe máquina para receber a ordem. Inicie a ponte na máquina e tente de novo.'
};

const SEM_SESSAO = DEPOIS_DA_TENTATIVA['sem sessao'];

interface Confirmado {
  base: Firestore;
  origem: string;
  maquinaId: string;
}

function conferir(ctx: ContextoDeEscrita): Confirmado | { impedimento: Impedimento } {
  if (!ctx.base) return { impedimento: 'sem base' };
  const quem = ctx.usuario;
  const email = (quem?.email ?? '').toLowerCase();
  if (!quem || !email || email !== EMAIL_DO_DIRETOR || !quem.emailVerified) return { impedimento: 'sem sessao' };
  if (!ctx.pontePronta) return { impedimento: 'ponte offline' };
  const maquinaId = (ctx.maquinaId ?? '').trim();
  if (!maquinaId) return { impedimento: 'sem maquina' };
  /* R5, OST 16: a origem começa SEMPRE com "painel". A regra nova separa a
     resposta do diretor da recusa da ponte por esse começo. */
  return { base: ctx.base, origem: origemDoPainel(ctx.celular, email), maquinaId };
}

function falhou(valor: Confirmado | { impedimento: Impedimento }): valor is { impedimento: Impedimento } {
  return 'impedimento' in valor;
}

function recusa(valor: { impedimento: Impedimento }): { ok: false; erro: string } {
  return { ok: false, erro: DEPOIS_DA_TENTATIVA[valor.impedimento] };
}

/* Erro da base em portugues, sem jargao e sem codigo na cara do diretor. */
function mensagemDoErro(erro: unknown, oQue: string): string {
  const codigo = (erro as { code?: string } | null)?.code ?? '';
  if (codigo === 'permission-denied') {
    return `A base recusou ${oQue}. A regra do Firestore não aceitou esta escrita, então nada foi registrado.`;
  }
  if (codigo === 'unavailable' || codigo === 'deadline-exceeded') {
    return `Sem conexão com a base agora, então ${oQue} não foi registrada. Tente de novo quando a rede voltar.`;
  }
  if (codigo === 'not-found') {
    return `Este registro não está mais na base, então ${oQue} não foi gravada.`;
  }
  if (codigo === 'unauthenticated') {
    return SEM_SESSAO;
  }
  const detalhe = (erro as { message?: string } | null)?.message;
  return detalhe
    ? `Não deu para registrar ${oQue}. A base respondeu: ${detalhe}`
    : `Não deu para registrar ${oQue}, e a base não disse o motivo.`;
}

/* ---------- identificador da fabrica que nasce pelo painel ---------- */

/* A fabrica aberta na mao vem com identificador prefixado por "mao-", seção 3 do
   contrato. A aberta pelo painel vem com "painel-", pelo mesmo motivo: ler o
   identificador na base e saber de onde ela nasceu, sem cruzar coleção. */
function novoIdDeFabrica(): string {
  const aleatorio =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  return `painel-${aleatorio}`;
}

/* ---------- comandos ---------- */

interface Ordem {
  fabricaId: string;
  texto: string;
  acao: AcaoDeComando;
  maquinaId?: string | null;
  cwd?: string;
  agente?: string;
  modelo?: string;
  conversationId?: string;
  /* OST 9: nome da fábrica, só na ordem de abrir. */
  nome?: string;
}

async function escreverComando(ctx: ContextoDeEscrita, ordem: Ordem, oQue: string): Promise<Resultado> {
  const pronto = conferir(ctx);
  if (falhou(pronto)) return recusa(pronto);

  const fabricaId = ordem.fabricaId.trim();
  const texto = ordem.texto.trim();
  if (!fabricaId) return { ok: false, erro: 'Esta fábrica não tem identificador na base, então a ordem não foi registrada.' };
  if (!texto) return { ok: false, erro: 'Escreva a ordem antes de enviar. Comando vazio não é registrado.' };

  /* Campos obrigatorios do contrato, na ordem em que a regra do Firestore os
     exige: fabricaId, maquinaId, texto, situacao, criadoEm, origem. */
  const documento: Record<string, unknown> = {
    fabricaId,
    maquinaId: (ordem.maquinaId ?? pronto.maquinaId).trim() || pronto.maquinaId,
    texto,
    situacao: 'pendente',
    criadoEm: serverTimestamp(),
    origem: pronto.origem,
    acao: ordem.acao
  };
  if (ordem.cwd) documento.cwd = ordem.cwd;
  if (ordem.agente) documento.agente = ordem.agente;
  if (ordem.modelo) documento.modelo = ordem.modelo;
  if (ordem.conversationId) documento.conversationId = ordem.conversationId;
  if (ordem.nome) documento.nome = ordem.nome;

  try {
    const criado = await addDoc(collection(pronto.base, 'comandos'), documento);
    return { ok: true, id: criado.id };
  } catch (erro) {
    return { ok: false, erro: mensagemDoErro(erro, oQue) };
  }
}

export interface DadosDeAbertura {
  /** OST 9: nome que o diretor dá à fábrica. Obrigatório. */
  nome: string;
  /** Pasta do projeto na maquina do diretor. */
  cwd: string;
  agente: string;
  /** Vazio ou ausente significa herdar o padrao da ponte. */
  modelo?: string;
  comandoInicial: string;
}

export interface AberturaRegistrada {
  ok: true;
  id: string;
  fabricaId: string;
}

/* Abre fabrica nova. O painel gera o identificador da fabrica, porque a ordem
   nasce antes dela existir, e a ponte abre com esse mesmo identificador. */
export async function abrirFabrica(
  ctx: ContextoDeEscrita,
  dados: DadosDeAbertura
): Promise<AberturaRegistrada | { ok: false; erro: string }> {
  const nome = limparNome(dados.nome);
  if (!nome) {
    return { ok: false, erro: 'Dê um nome à fábrica antes de abrir. É por ele que você vai achá-la no painel.' };
  }
  const cwd = dados.cwd.trim();
  if (!cwd) {
    return { ok: false, erro: 'Escolha a pasta do projeto ou escreva o caminho dela antes de abrir a fábrica.' };
  }
  const fabricaId = novoIdDeFabrica();
  const resultado = await escreverComando(
    ctx,
    {
      fabricaId,
      texto: dados.comandoInicial,
      acao: 'abrir',
      cwd,
      agente: dados.agente.trim() || 'claude code',
      modelo: dados.modelo?.trim() || undefined,
      nome
    },
    'a abertura da fábrica'
  );
  if (!resultado.ok) return resultado;
  return { ok: true, id: resultado.id, fabricaId };
}

/* ---------- nome da fabrica, OST 9 ---------- */

/* O mesmo teto que a ponte aplica. */
export const TETO_NOME = 80;

export function limparNome(bruto: string): string {
  return bruto.replace(/\s+/g, ' ').trim().slice(0, TETO_NOME);
}

/*
 * Renomeia a fábrica, em QUALQUER estado, pedido do diretor.
 *
 * Diferente das ordens, isto não passa pela ponte: é o painel escrevendo um
 * campo de exibição direto na fábrica, que a regra do Firestore já permite ao
 * diretor com a hora do servidor em atualizadoEm. Por isso funciona com a ponte
 * offline e com a fábrica concluída. updateDoc, e não setDoc: renomear nunca
 * cria fábrica que não existe.
 *
 * A ponte nunca escreve este campo depois do nascimento, então o nome digitado
 * não é desfeito.
 */
export async function renomearFabrica(
  ctx: ContextoDeEscrita,
  dados: { fabricaId: string; nome: string }
): Promise<Resultado> {
  if (!ctx.base) {
    return {
      ok: false,
      erro: 'O painel não está ligado à base agora, então o nome não foi gravado. Recarregue o painel e tente de novo.'
    };
  }
  const quem = ctx.usuario;
  const email = (quem?.email ?? '').toLowerCase();
  if (!quem || !email || email !== EMAIL_DO_DIRETOR || !quem.emailVerified) {
    return { ok: false, erro: 'A sua sessão não está mais válida, então o nome não foi gravado. Entre de novo e repita.' };
  }
  const fabricaId = dados.fabricaId.trim();
  if (!fabricaId) return { ok: false, erro: 'Esta fábrica não tem identificador na base, então o nome não foi gravado.' };
  const nome = limparNome(dados.nome);
  if (!nome) return { ok: false, erro: 'Escreva o nome antes de salvar. Nome vazio não é gravado.' };
  try {
    await updateDoc(doc(ctx.base, 'fabricas', fabricaId), { nome, atualizadoEm: serverTimestamp() });
    return { ok: true, id: fabricaId };
  } catch (erro) {
    return { ok: false, erro: mensagemDoErro(erro, 'o nome novo') };
  }
}

/* Manda comando para fabrica que ja existe. */
export function mandarComando(
  ctx: ContextoDeEscrita,
  dados: { fabricaId: string; maquinaId?: string | null; conversationId?: string | null; texto: string }
): Promise<Resultado> {
  return escreverComando(
    ctx,
    {
      fabricaId: dados.fabricaId,
      maquinaId: dados.maquinaId,
      texto: dados.texto,
      acao: 'comando',
      conversationId: dados.conversationId ?? undefined
    },
    'o comando'
  );
}

/* Encerra a fabrica, sem volta. A tela sempre confirma antes de chamar. */
export function encerrarFabrica(
  ctx: ContextoDeEscrita,
  dados: { fabricaId: string; maquinaId?: string | null; motivo?: string }
): Promise<Resultado> {
  const motivo = dados.motivo?.trim();
  return escreverComando(
    ctx,
    {
      fabricaId: dados.fabricaId,
      maquinaId: dados.maquinaId,
      texto: motivo ? `encerrar a fábrica: ${motivo}` : 'encerrar a fábrica',
      acao: 'encerrar'
    },
    'o encerramento da fábrica'
  );
}

/* Para a fabrica guardando a conversa. */
export function pausarFabrica(
  ctx: ContextoDeEscrita,
  dados: { fabricaId: string; maquinaId?: string | null }
): Promise<Resultado> {
  return escreverComando(
    ctx,
    { fabricaId: dados.fabricaId, maquinaId: dados.maquinaId, texto: 'pausar a fábrica', acao: 'pausar' },
    'a pausa da fábrica'
  );
}

/* Retoma a fabrica, com a conversa de onde parou quando a ponte informou o
   identificador dela. */
export function reiniciarFabrica(
  ctx: ContextoDeEscrita,
  dados: { fabricaId: string; maquinaId?: string | null; conversationId?: string | null; pausada?: boolean }
): Promise<Resultado> {
  return escreverComando(
    ctx,
    {
      fabricaId: dados.fabricaId,
      maquinaId: dados.maquinaId,
      texto: dados.pausada ? 'retomar a fábrica pausada' : 'reiniciar a fábrica',
      acao: 'reiniciar',
      conversationId: dados.conversationId ?? undefined
    },
    dados.pausada ? 'a retomada da fábrica' : 'o reinício da fábrica'
  );
}

/* ---------- resposta de aprovacao ---------- */

/* Responde um pedido parado, seção 4 do contrato. Uma resposta por pedido: a
   regra do Firestore so aceita pendente virando respondida, e nega a segunda.
   Quando a base recusa por isso, a tela recebe a frase que explica, em vez de
   um codigo. */
export async function responderAprovacao(
  ctx: ContextoDeEscrita,
  dados: { aprovacaoId: string; resposta: RespostaDeAprovacao; observacao?: string }
): Promise<Resultado> {
  const pronto = conferir(ctx);
  if (falhou(pronto)) return recusa(pronto);

  const aprovacaoId = dados.aprovacaoId.trim();
  if (!aprovacaoId) return { ok: false, erro: 'Este pedido não tem identificador na base, então a resposta não foi registrada.' };

  const observacao = dados.observacao?.trim() ?? '';
  if (dados.resposta === 'aprovado com observacao' && !observacao) {
    return { ok: false, erro: 'Escreva a observação antes de aprovar. Aprovar com observação sem texto não é registrado.' };
  }

  try {
    await updateDoc(doc(pronto.base, 'aprovacoes', aprovacaoId), {
      situacao: 'respondida',
      resposta: dados.resposta,
      observacao: observacao || null,
      respondidoEm: serverTimestamp(),
      respondidoPor: pronto.origem
    });
    return { ok: true, id: aprovacaoId };
  } catch (erro) {
    const codigo = (erro as { code?: string } | null)?.code ?? '';
    if (codigo === 'permission-denied') {
      return {
        ok: false,
        erro: 'A base recusou esta resposta. O pedido pode já ter sido respondido, e a trilha não aceita segunda resposta.'
      };
    }
    return { ok: false, erro: mensagemDoErro(erro, 'a resposta') };
  }
}

/* ---------- cracha por maquina, OST 16 ---------- */

/* Para emitir e revogar basta base ligada e sessao do diretor. A ponte nao
   precisa estar no ar: a maquina que pede cracha ainda nao tem ponte, e revogar
   tem de funcionar justamente quando a maquina sumiu. */
function conferirDiretor(ctx: ContextoDeEscrita): { base: Firestore; origem: string } | { erro: string } {
  if (!ctx.base) {
    return { erro: 'O painel não está ligado à base agora, então nada foi gravado. Recarregue o painel e tente de novo.' };
  }
  const quem = ctx.usuario;
  const email = (quem?.email ?? '').toLowerCase();
  if (!quem || !email || email !== EMAIL_DO_DIRETOR || !quem.emailVerified) return { erro: SEM_SESSAO };
  return { base: ctx.base, origem: origemDoPainel(ctx.celular, email) };
}

export type ResultadoDoCracha = { ok: true; id: string; revogados: number } | { ok: false; erro: string };

function erroDoCracha(erro: unknown, oQue: 'a emissão' | 'a revogação'): string {
  const codigo = (erro as { code?: string } | null)?.code ?? '';
  if (codigo === 'permission-denied') {
    return oQue === 'a emissão'
      ? 'A base recusou a emissão, e nada foi gravado: nem o crachá novo, nem a revogação do antigo. O motivo mais provável é o pedido ter passado dos 15 minutos, ou a regra nova da OST 16 ainda não estar publicada. Rode de novo o pedido de crachá na máquina e tente outra vez.'
      : 'A base recusou a revogação, e nada foi gravado. O motivo mais provável é a regra nova da OST 16 ainda não estar publicada, ou o crachá já ter sido revogado por outra tela. Recarregue o painel e confira a lista.';
  }
  return mensagemDoErro(erro, oQue);
}

/* Aplica o lote montado pelo calculo puro. Uma gravacao so: ou tudo entra, ou
   nada entra, N3. criar usa set num documento que nao existe, e a regra ve
   criacao; revogar usa update so de ativo, revogadoEm e revogadoPor, R12. */
async function gravarLote(base: Firestore, lote: Escrita<FieldValue>[]): Promise<void> {
  const gravacao = writeBatch(base);
  for (const e of lote) {
    const ref = doc(base, e.colecao, e.id);
    if (e.operacao === 'criar') gravacao.set(ref, e.dados);
    else gravacao.update(ref, e.dados);
  }
  await gravacao.commit();
}

/* Le de novo, direto da base, o que a decisao precisa. A tela ja mostra os
   pedidos ao vivo, mas a decisao de emitir nao confia no que esta na tela:
   pedido falso que chegou um segundo antes do clique tem de barrar, N1. */
async function lerParaDecidir(
  base: Firestore,
  maquinaId: string,
  agora: Date
): Promise<{ pedidos: PedidoDeCracha[]; listaCheia: boolean; crachasDaMaquina: Cracha[] }> {
  const [fotoDosPedidos, fotoDosCrachas] = await Promise.all([
    getDocs(
      query(
        collection(base, 'pedidosDeCracha'),
        where('criadoEm', '>=', inicioDaJanela(agora)),
        orderBy('criadoEm', 'desc'),
        limitar(LIMITE_DE_PEDIDOS)
      )
    ),
    getDocs(query(collection(base, 'crachas'), where('maquinaId', '==', maquinaId)))
  ]);
  return {
    pedidos: fotoDosPedidos.docs.map((d) => traduzirPedido({ ...(d.data() as object), id: d.id } as PedidoDeCrachaBase)),
    listaCheia: fotoDosPedidos.size >= LIMITE_DE_PEDIDOS,
    crachasDaMaquina: fotoDosCrachas.docs.map((d) => traduzirCracha({ ...(d.data() as object), id: d.id } as CrachaBase))
  };
}

/*
 * Emite o cracha de um pedido. A tela so chama depois de o diretor conferir, no
 * terminal da maquina, o codigo e o comeco do uid (conferido). Falha fechada:
 * qualquer duvida barra e diz por que, §A.22.
 */
export async function emitirCracha(
  ctx: ContextoDeEscrita,
  dados: { pedido: PedidoDeCracha; conferido: boolean }
): Promise<ResultadoDoCracha> {
  const pronto = conferirDiretor(ctx);
  if ('erro' in pronto) return { ok: false, erro: pronto.erro };
  const agora = new Date();

  let lido: Awaited<ReturnType<typeof lerParaDecidir>>;
  let jaTemCracha: boolean;
  try {
    lido = await lerParaDecidir(pronto.base, dados.pedido.maquinaId, agora);
    jaTemCracha = (await getDoc(doc(pronto.base, 'crachas', dados.pedido.uid))).exists();
  } catch (erro) {
    return {
      ok: false,
      erro: `Antes de emitir, o painel confere de novo os pedidos na base, e essa leitura falhou. Nada foi emitido. ${mensagemDoErro(erro, 'a conferência')}`
    };
  }

  /* O pedido como esta na base agora, nao como estava na tela. */
  const pedido = lido.pedidos.find((p) => p.uid === dados.pedido.uid) ?? dados.pedido;
  const crachasConhecidos = jaTemCracha
    ? [...lido.crachasDaMaquina, { ...traduzirCracha({ id: pedido.uid }), uid: pedido.uid }]
    : lido.crachasDaMaquina;
  const barreira = barreiraDaEmissao(pedido, {
    abertos: pedidosAbertos(lido.pedidos, crachasConhecidos, agora),
    crachas: crachasConhecidos,
    agora,
    listaCheia: lido.listaCheia,
    conferido: dados.conferido
  });
  if (barreira) return { ok: false, erro: fraseDaBarreira(barreira) };

  const lote = loteDeEmissao<FieldValue>(pedido, lido.crachasDaMaquina, pronto.origem, serverTimestamp());
  try {
    await gravarLote(pronto.base, lote);
    return { ok: true, id: pedido.uid, revogados: lote.length - 1 };
  } catch (erro) {
    return { ok: false, erro: erroDoCracha(erro, 'a emissão') };
  }
}

/* Revoga TODOS os crachas ativos da maquina, N3. A tela confirma antes. */
export async function revogarCrachasDaMaquina(
  ctx: ContextoDeEscrita,
  dados: { maquinaId: string }
): Promise<ResultadoDoCracha> {
  const pronto = conferirDiretor(ctx);
  if ('erro' in pronto) return { ok: false, erro: pronto.erro };
  const maquinaId = dados.maquinaId.trim();
  if (!maquinaId) return { ok: false, erro: 'Este crachá não diz de qual máquina é, então nada foi revogado.' };

  let crachas: Cracha[];
  try {
    const foto = await getDocs(query(collection(pronto.base, 'crachas'), where('maquinaId', '==', maquinaId)));
    crachas = foto.docs.map((d) => traduzirCracha({ ...(d.data() as object), id: d.id } as CrachaBase));
  } catch (erro) {
    return {
      ok: false,
      erro: `Antes de revogar, o painel confere os crachás da máquina na base, e essa leitura falhou. Nada foi revogado. ${mensagemDoErro(erro, 'a conferência')}`
    };
  }

  const lote = loteDeRevogacao<FieldValue>(maquinaId, crachas, pronto.origem, serverTimestamp());
  if (!lote.length) {
    return { ok: false, erro: 'Esta máquina não tem crachá ativo na base, então não havia o que revogar. Recarregue o painel e confira a lista.' };
  }
  try {
    await gravarLote(pronto.base, lote);
    return { ok: true, id: maquinaId, revogados: lote.length };
  } catch (erro) {
    return { ok: false, erro: erroDoCracha(erro, 'a revogação') };
  }
}

/* O que impede a escrita agora, para a tela desabilitar o controle e dizer por
   que, antes de qualquer clique. Devolve null quando a escrita esta liberada. */
export function impedimentoDaEscrita(ctx: ContextoDeEscrita): Impedimento | null {
  const pronto = conferir(ctx);
  return falhou(pronto) ? pronto.impedimento : null;
}

export function podeEscrever(ctx: ContextoDeEscrita): boolean {
  return impedimentoDaEscrita(ctx) === null;
}
