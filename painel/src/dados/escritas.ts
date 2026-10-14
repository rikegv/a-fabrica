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
 * Nenhuma funcao lanca excecao para a tela. Toda uma devolve Resultado, com erro
 * em portugues, para a tela nunca fingir que deu certo.
 */

import type { User } from 'firebase/auth';
import { addDoc, collection, doc, serverTimestamp, updateDoc, type Firestore } from 'firebase/firestore';
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
  return { base: ctx.base, origem: `painel no ${ctx.celular ? 'celular' : 'computador'}, ${email}`, maquinaId };
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

  try {
    const criado = await addDoc(collection(pronto.base, 'comandos'), documento);
    return { ok: true, id: criado.id };
  } catch (erro) {
    return { ok: false, erro: mensagemDoErro(erro, oQue) };
  }
}

export interface DadosDeAbertura {
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
      modelo: dados.modelo?.trim() || undefined
    },
    'a abertura da fábrica'
  );
  if (!resultado.ok) return resultado;
  return { ok: true, id: resultado.id, fabricaId };
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

/* O que impede a escrita agora, para a tela desabilitar o controle e dizer por
   que, antes de qualquer clique. Devolve null quando a escrita esta liberada. */
export function impedimentoDaEscrita(ctx: ContextoDeEscrita): Impedimento | null {
  const pronto = conferir(ctx);
  return falhou(pronto) ? pronto.impedimento : null;
}

export function podeEscrever(ctx: ContextoDeEscrita): boolean {
  return impedimentoDaEscrita(ctx) === null;
}
