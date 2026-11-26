/*
 * OST 16, CRACHÁ POR MÁQUINA. Cálculo puro, sem React e sem Firebase, para poder
 * ser provado sozinho (painel/testes/rodada-...-ost16/prova.cjs).
 *
 * O contrato é docs/ost16-contrato.md. Aqui moram as decisões que a tela e a
 * camada de escrita tomam ANTES de gravar:
 *
 *  - quais pedidos estão abertos: os de menos de 15 minutos, cujo uid ainda não
 *    tem crachá (N2, R12);
 *  - quando a emissão é barrada: mais de um pedido aberto para a mesma máquina
 *    ou com o mesmo código, lista no teto, pedido malformado ou vencido (N1);
 *  - o que o lote grava: criar o crachá novo e, na MESMA gravação, revogar todo
 *    crachá ativo da máquina (N3). Revogar sozinho também revoga todos os ativos
 *    da máquina.
 *
 * A hora do servidor entra de fora (H), porque serverTimestamp() é do Firebase e
 * este arquivo não carrega o Firebase. A camada de escrita passa
 * serverTimestamp(); a prova passa um marcador.
 *
 * Texto que vem da base só vai para a tela como texto filho do React, N4. Nada
 * daqui vira HTML, endereço ou estilo.
 */

import type { HoraDaBase } from './tipos';
import { paraData } from './tradutor';

/* ---------- limites do contrato ---------- */

/* R12 e N2: pedido vale por 15 minutos, contados da hora do servidor. */
export const JANELA_DO_PEDIDO_MS = 15 * 60_000;
/* N2: a consulta de pedidos traz no máximo 20. */
export const LIMITE_DE_PEDIDOS = 20;
/* Folga para relógio do computador um pouco atrás do servidor: pedido "do
   futuro" até este tanto ainda é aceito como aberto. Além disso, é descartado. */
export const FOLGA_DO_RELOGIO_MS = 2 * 60_000;

export const PADRAO_MAQUINA = /^maquina-[a-z0-9-]{1,40}$/;
export const PADRAO_CODIGO = /^[0-9]{6}$/;

/* ---------- tipos da base ---------- */

export interface PedidoDeCrachaBase {
  id: string;
  uid?: unknown;
  maquinaId?: unknown;
  nome?: unknown;
  rotulo?: unknown;
  codigo?: unknown;
  criadoEm?: HoraDaBase;
}

export interface CrachaBase {
  id: string;
  uid?: unknown;
  maquinaId?: unknown;
  rotulo?: unknown;
  ativo?: unknown;
  emitidoEm?: HoraDaBase;
  emitidoPor?: unknown;
  revogadoEm?: HoraDaBase;
  revogadoPor?: unknown;
}

/* ---------- tipos da tela ---------- */

export interface PedidoDeCracha {
  id: string;
  uid: string;
  maquinaId: string;
  nome: string | null;
  rotulo: string | null;
  codigo: string;
  criadoEm: Date | null;
  /* Nulo quando o pedido está bem formado. Texto do motivo quando não está. */
  malformado: string | null;
}

export interface Cracha {
  id: string;
  uid: string;
  maquinaId: string;
  rotulo: string | null;
  ativo: boolean;
  emitidoEm: Date | null;
  emitidoPor: string | null;
  revogadoEm: Date | null;
  revogadoPor: string | null;
}

function texto(valor: unknown, teto = 80): string | null {
  if (typeof valor !== 'string') return null;
  const limpo = valor.replace(/\s+/g, ' ').trim();
  return limpo ? limpo.slice(0, teto) : null;
}

export function traduzirPedido(doc: PedidoDeCrachaBase): PedidoDeCracha {
  const uid = typeof doc.uid === 'string' ? doc.uid : '';
  const maquinaId = typeof doc.maquinaId === 'string' ? doc.maquinaId : '';
  const codigo = typeof doc.codigo === 'string' ? doc.codigo : '';
  let malformado: string | null = null;
  if (!uid || uid !== doc.id) malformado = 'o uid do pedido não é o mesmo do documento';
  else if (!PADRAO_MAQUINA.test(maquinaId)) malformado = 'a máquina do pedido não tem o formato esperado';
  else if (!PADRAO_CODIGO.test(codigo)) malformado = 'o código do pedido não tem seis dígitos';
  return {
    id: doc.id,
    uid,
    maquinaId,
    nome: texto(doc.nome, 60),
    /* O rótulo vai para o crachá exatamente como está no pedido, sem limpar,
       porque a regra pode comparar os dois. A tela mostra com chamadaDoPedido,
       como texto do React. */
    rotulo: typeof doc.rotulo === 'string' && doc.rotulo ? doc.rotulo : null,
    codigo,
    criadoEm: paraData(doc.criadoEm),
    malformado
  };
}

export function traduzirCracha(doc: CrachaBase): Cracha {
  return {
    id: doc.id,
    uid: typeof doc.uid === 'string' ? doc.uid : doc.id,
    maquinaId: typeof doc.maquinaId === 'string' ? doc.maquinaId : '',
    rotulo: texto(doc.rotulo, 40),
    /* Só o valor exato true é ativo. Qualquer outra coisa conta como revogado. */
    ativo: doc.ativo === true,
    emitidoEm: paraData(doc.emitidoEm),
    emitidoPor: texto(doc.emitidoPor, 120),
    revogadoEm: paraData(doc.revogadoEm),
    revogadoPor: texto(doc.revogadoPor, 120)
  };
}

/* ---------- como a tela escreve ---------- */

/* P5 e N1: os 8 primeiros caracteres do uid, os mesmos que o terminal mostra. */
export function uidCurto(uid: string): string {
  return uid.slice(0, 8);
}

/* "maquina-fa546467f75e" cabe inteiro. Mais comprido que isso, corta. */
export function maquinaCurta(maquinaId: string): string {
  return maquinaId.length > 24 ? `${maquinaId.slice(0, 24)}...` : maquinaId;
}

/* Como a tela chama a máquina: rótulo, nome, identificador. */
export function chamadaDoPedido(p: PedidoDeCracha): string {
  return texto(p.rotulo, 40) ?? p.nome ?? p.maquinaId;
}

/* O crachá não guarda o nome da máquina; quando não tem rótulo, a tela passa o
   nome que a máquina publica em maquinas, se houver. */
export function chamadaDoCracha(c: Cracha, nomeDaMaquina?: string | null): string {
  return c.rotulo || nomeDaMaquina || c.maquinaId || uidCurto(c.uid);
}

/* ---------- janela e pedidos abertos ---------- */

export function dentroDaJanela(criadoEm: Date | null, agora: Date): boolean {
  if (!criadoEm) return false;
  const idade = agora.getTime() - criadoEm.getTime();
  return idade <= JANELA_DO_PEDIDO_MS && idade >= -FOLGA_DO_RELOGIO_MS;
}

/* O início da janela, para a consulta da base: criadoEm >= isto. */
export function inicioDaJanela(agora: Date): Date {
  return new Date(agora.getTime() - JANELA_DO_PEDIDO_MS);
}

/* Pedidos abertos: dentro da janela e sem crachá já emitido para o mesmo uid
   (ativo ou revogado: crachá revogado não volta, contrato). Mais novo em cima. */
export function pedidosAbertos(pedidos: PedidoDeCracha[], crachas: Cracha[], agora: Date): PedidoDeCracha[] {
  const atendidos = new Set(crachas.map((c) => c.uid));
  return pedidos
    .filter((p) => dentroDaJanela(p.criadoEm, agora) && !atendidos.has(p.uid))
    .sort((a, b) => (b.criadoEm?.getTime() ?? 0) - (a.criadoEm?.getTime() ?? 0) || a.id.localeCompare(b.id));
}

/* Quanto falta para o pedido vencer, em ms. Zero ou menos é vencido. */
export function restaDoPedido(p: PedidoDeCracha, agora: Date): number {
  if (!p.criadoEm) return 0;
  return p.criadoEm.getTime() + JANELA_DO_PEDIDO_MS - agora.getTime();
}

/* ---------- N1: pedido duplicado ---------- */

export interface Duplicidade {
  /* Outros pedidos abertos para a mesma máquina, sem contar este. */
  mesmaMaquina: number;
  /* Outros pedidos abertos com o mesmo código, sem contar este. */
  mesmoCodigo: number;
}

export function duplicidadeDoPedido(pedido: PedidoDeCracha, abertos: PedidoDeCracha[]): Duplicidade {
  const outros = abertos.filter((p) => p.uid !== pedido.uid);
  return {
    mesmaMaquina: outros.filter((p) => p.maquinaId === pedido.maquinaId).length,
    mesmoCodigo: outros.filter((p) => p.codigo === pedido.codigo).length
  };
}

export function temDuplicidade(d: Duplicidade): boolean {
  return d.mesmaMaquina > 0 || d.mesmoCodigo > 0;
}

/* ---------- crachás da máquina ---------- */

export function ativosDaMaquina(crachas: Cracha[], maquinaId: string): Cracha[] {
  return crachas.filter((c) => c.ativo && c.maquinaId === maquinaId);
}

/* Lista da tela: ativos primeiro, depois revogados; dentro de cada grupo, o
   emitido mais novo em cima. */
export function ordenarCrachas(crachas: Cracha[]): Cracha[] {
  return [...crachas].sort(
    (a, b) =>
      Number(b.ativo) - Number(a.ativo) ||
      (b.emitidoEm?.getTime() ?? 0) - (a.emitidoEm?.getTime() ?? 0) ||
      a.id.localeCompare(b.id)
  );
}

/* ---------- o que barra a emissão ---------- */

export type Barreira =
  | { tipo: 'malformado'; motivo: string }
  | { tipo: 'vencido' }
  | { tipo: 'ja emitido' }
  | { tipo: 'duplicado'; duplicidade: Duplicidade }
  | { tipo: 'lista cheia' }
  | { tipo: 'nao conferido' };

/*
 * Decide se este pedido pode virar crachá agora. A ordem importa: o que é mais
 * grave aparece primeiro. Falha fechada: na dúvida, barra.
 *
 *  abertos     todos os pedidos abertos, inclusive este
 *  listaCheia  a consulta voltou no teto de 20: pode haver pedido que o painel
 *              não viu, então a duplicidade não pode ser descartada
 *  conferido   o diretor confirmou na tela que o código e o começo do uid são os
 *              do terminal da máquina
 */
export function barreiraDaEmissao(
  pedido: PedidoDeCracha,
  contexto: { abertos: PedidoDeCracha[]; crachas: Cracha[]; agora: Date; listaCheia: boolean; conferido: boolean }
): Barreira | null {
  if (pedido.malformado) return { tipo: 'malformado', motivo: pedido.malformado };
  if (contexto.crachas.some((c) => c.uid === pedido.uid)) return { tipo: 'ja emitido' };
  if (!dentroDaJanela(pedido.criadoEm, contexto.agora)) return { tipo: 'vencido' };
  if (contexto.listaCheia) return { tipo: 'lista cheia' };
  const duplicidade = duplicidadeDoPedido(pedido, contexto.abertos);
  if (temDuplicidade(duplicidade)) return { tipo: 'duplicado', duplicidade };
  if (!contexto.conferido) return { tipo: 'nao conferido' };
  return null;
}

/* A frase da barreira, para a tela e para o erro da escrita. Sem travessão. */
export function fraseDaBarreira(b: Barreira): string {
  switch (b.tipo) {
    case 'malformado':
      return `Este pedido não pode virar crachá: ${b.motivo}. Nada foi emitido. Rode de novo o pedido de crachá na máquina.`;
    case 'vencido':
      return 'Este pedido passou dos 15 minutos e venceu. Nada foi emitido. Rode de novo o pedido de crachá na máquina e emita o pedido novo.';
    case 'ja emitido':
      return 'Esta conta da máquina já recebeu crachá antes. Crachá não é emitido duas vezes para a mesma conta. Rode de novo o pedido de crachá na máquina.';
    case 'lista cheia':
      return `Chegaram ${LIMITE_DE_PEDIDOS} pedidos ou mais em 15 minutos, mais do que uma troca normal faz. Pode ser tentativa de falsificação, e o painel não consegue conferir os pedidos que ficaram fora da lista, então nada foi emitido. Espere 15 minutos sem pedido novo e rode o pedido de crachá uma vez só, na máquina.`;
    case 'duplicado': {
      const partes: string[] = [];
      if (b.duplicidade.mesmaMaquina) partes.push('outro pedido aberto para a mesma máquina');
      if (b.duplicidade.mesmoCodigo) partes.push('outro pedido aberto com o mesmo código');
      return `Existe ${partes.join(' e ')}. Pode ser tentativa de falsificação: alguém pedindo crachá no lugar da máquina. Nada foi emitido. O que fazer: se foi você que rodou o pedido mais de uma vez, espere 15 minutos para os pedidos vencerem e rode uma vez só, na máquina. Se não foi você, não emita nada e revogue os crachás desta máquina.`;
    }
    case 'nao conferido':
      return 'Confira no terminal da máquina o código e o começo do uid antes de emitir. Sem essa conferência, nada é emitido.';
  }
}

/* ---------- o lote de gravação ---------- */

export type Escrita<H> =
  | { operacao: 'criar'; colecao: 'crachas'; id: string; dados: Record<string, unknown> & { emitidoEm: H } }
  | { operacao: 'revogar'; colecao: 'crachas'; id: string; dados: { ativo: false; revogadoEm: H; revogadoPor: string } };

/*
 * N3 e R12: emitir é UMA gravação em lote. Cria crachas/{uid} com os campos
 * exatos do contrato e, se a máquina já tem crachá ativo, revoga cada um no mesmo
 * lote. Ou tudo entra, ou nada entra.
 */
export function loteDeEmissao<H>(pedido: PedidoDeCracha, crachas: Cracha[], origem: string, hora: H): Escrita<H>[] {
  const revogacoes = loteDeRevogacao(pedido.maquinaId, crachas, origem, hora);
  const criar: Escrita<H> = {
    operacao: 'criar',
    colecao: 'crachas',
    id: pedido.uid,
    dados: {
      uid: pedido.uid,
      maquinaId: pedido.maquinaId,
      rotulo: pedido.rotulo,
      ativo: true,
      emitidoEm: hora,
      emitidoPor: origem
    }
  };
  return [criar, ...revogacoes];
}

/* N3: revogar revoga TODOS os crachás ativos daquela máquina. A atualização só
   mexe em ativo, revogadoEm e revogadoPor, R12. */
export function loteDeRevogacao<H>(maquinaId: string, crachas: Cracha[], origem: string, hora: H): Escrita<H>[] {
  return ativosDaMaquina(crachas, maquinaId).map((c) => ({
    operacao: 'revogar' as const,
    colecao: 'crachas' as const,
    id: c.id,
    dados: { ativo: false as const, revogadoEm: hora, revogadoPor: origem }
  }));
}

/* R5 e R12: toda origem gravada pelo painel começa com "painel". */
export function origemDoPainel(celular: boolean, email: string): string {
  return `painel no ${celular ? 'celular' : 'computador'}, ${email}`;
}
