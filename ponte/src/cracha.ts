// cracha.ts, OST 16: o cracha por maquina. Contrato em docs/ost16-contrato.md.
//
// O cracha e uma conta ANONIMA do Firebase Authentication, uma por maquina, mais
// o documento `crachas/{uid}` que so o diretor escreve, pelo painel. A conta
// pessoal do diretor nunca pousa na maquina: a maquina cria a propria conta
// anonima, pede o cracha em `pedidosDeCracha/{uid}`, e o diretor emite no painel.
//
// Este arquivo e a BIBLIOTECA do cracha: caminhos, partes puras (nome, codigo,
// pedido, escolha do caminho de entrada, leitura do documento do cracha), a
// conferencia na base e a vigia que derruba a ponte quando o cracha cai. Quem
// pede o cracha no terminal e pedirCracha.ts. Quem entra com o cracha na subida
// e identidade.ts, com a conferencia da base feita em base.ts, initBase.
//
// P2: cracha.json mora na pasta local, com a mesma tranca de sessao.json, fora do
// repositorio. O token de atualizacao NUNCA vai para registro nem para mensagem
// de erro: nada aqui imprime o conteudo do arquivo.
// §A.6: so conexao de saida. Nada aqui escuta porta.
// §A.9: nada fora da pasta local da ponte e escrito.

import { randomInt } from 'node:crypto';
import { join } from 'node:path';
import { doc, getDoc, onSnapshot, type Firestore } from 'firebase/firestore';
import { CAMINHO_CONFIG, PASTA_LOCAL, lerTexto } from './config.js';

/** Arquivo do cracha da nuvem. Mesma pasta e mesma tranca de sessao.json. */
export const CAMINHO_CRACHA = join(PASTA_LOCAL, 'cracha.json');
/** Cracha do emulador em arquivo separado, para nunca escrever sobre o da nuvem. */
export const CAMINHO_CRACHA_EMULADOR = join(PASTA_LOCAL, 'cracha-emulador.json');

export function caminhoDoCracha(emulador: boolean): string {
  return emulador ? CAMINHO_CRACHA_EMULADOR : CAMINHO_CRACHA;
}

/** Chave, dentro de cracha.json, do registro do pedido. Nao e credencial. */
export const CHAVE_DO_PEDIDO = 'a-fabrica:pedidoDeCracha';

/** U5 e R11: forma do maquinaId que a regra aceita. */
export const FORMA_MAQUINA_ID = /^maquina-[a-z0-9-]{1,40}$/;
/** R11: forma de nome e rotulo no pedido. */
export const FORMA_NOME = /^[A-Za-z0-9 ._-]{1,60}$/;
export const TETO_NOME_DO_PEDIDO = 60;
export const TETO_ROTULO_DO_PEDIDO = 40;
/** R11: o codigo tem seis digitos. */
export const FORMA_CODIGO = /^[0-9]{6}$/;

/** Passo 3 do fluxo: 15 minutos de espera, falha fechada. Trocavel so para prova, dentro de limite. */
export const ESPERA_DO_CRACHA_MS = ((): number => {
  const bruto = Number(process.env.PONTE_CRACHA_ESPERA_MS ?? '900000');
  if (!Number.isFinite(bruto) || bruto < 1000 || bruto > 900000) return 900000;
  return Math.floor(bruto);
})();

// ---------------------------------------------------------------------------
// Partes puras
// ---------------------------------------------------------------------------

/**
 * Normaliza texto para a forma que a regra aceita no pedido, R11: tira acento
 * ("Escritório" vira "Escritorio"), troca o que sobrar fora de [A-Za-z0-9 ._-] por
 * espaco, junta espacos, apara e corta no teto. Vazio vira null.
 */
export function normalizarParaPedido(bruto: unknown, teto: number): string | null {
  if (typeof bruto !== 'string') return null;
  const semAcento = bruto.normalize('NFD').replace(/\p{M}+/gu, '');
  const limpo = semAcento
    .replace(/[^A-Za-z0-9 ._-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, teto)
    .trim();
  return limpo.length > 0 && FORMA_NOME.test(limpo) ? limpo : null;
}

/** Codigo de seis digitos, sorteado pelo gerador criptografico. */
export function sortearCodigo(): string {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

export interface PedidoDeCracha {
  uid: string;
  maquinaId: string;
  nome: string;
  rotulo: string | null;
  codigo: string;
}

/**
 * Monta os campos do pedido, menos `criadoEm`, que e hora do servidor e entra na
 * gravacao. Campos exatos de R11. Lanca com motivo legivel quando o maquinaId nao
 * tem a forma que a regra aceita: melhor parar aqui do que a regra negar calada.
 */
export function montarPedido(d: {
  uid: string;
  maquinaId: string;
  nomeMaquina: string | null | undefined;
  rotulo: string | null | undefined;
  codigo: string;
}): PedidoDeCracha {
  if (!FORMA_MAQUINA_ID.test(d.maquinaId)) {
    throw new Error(
      `o maquinaId desta maquina (${d.maquinaId}) nao tem a forma que a base aceita, maquina- seguido de letras minusculas, numeros e hifen, ate 40`
    );
  }
  if (!FORMA_CODIGO.test(d.codigo)) throw new Error('codigo do pedido fora da forma de seis digitos');
  // Nome vazio depois da limpeza vira o proprio maquinaId, que ja tem forma aceita.
  const nome = normalizarParaPedido(d.nomeMaquina, TETO_NOME_DO_PEDIDO) ?? d.maquinaId;
  const rotulo = normalizarParaPedido(d.rotulo, TETO_ROTULO_DO_PEDIDO);
  return { uid: d.uid, maquinaId: d.maquinaId, nome, rotulo, codigo: d.codigo };
}

export type CaminhoDeEntrada = 'cracha' | 'sessao do diretor';

/**
 * P1: com cracha.json presente, a ponte entra SO com o cracha. Sem ele, entra
 * como hoje. Funcao pura, a unica que decide, para dar para provar sem base.
 */
export function escolherCaminhoDeEntrada(crachaPresente: boolean): CaminhoDeEntrada {
  return crachaPresente ? 'cracha' : 'sessao do diretor';
}

export type LeituraDoCracha = { ok: true } | { ok: false; motivo: string };

/**
 * Le o documento `crachas/{uid}` como a ponte precisa: existe, ativo === true,
 * uid igual, e o maquinaId e o desta ponte. Qualquer outra coisa e recusa.
 */
export function avaliarCracha(dado: unknown, uid: string, maquinaId: string): LeituraDoCracha {
  if (typeof dado !== 'object' || dado === null) {
    return { ok: false, motivo: 'o cracha desta maquina ainda nao foi emitido pelo diretor, ou nao existe mais' };
  }
  const o = dado as Record<string, unknown>;
  if (o['ativo'] !== true) return { ok: false, motivo: 'o cracha desta maquina foi revogado pelo diretor' };
  if (o['uid'] !== uid) return { ok: false, motivo: 'o documento do cracha nao e desta conta, recusado por seguranca' };
  if (o['maquinaId'] !== maquinaId) {
    return {
      ok: false,
      motivo: `o cracha foi emitido para outra maquina (${typeof o['maquinaId'] === 'string' ? o['maquinaId'] : 'sem maquina'}), e esta ponte e ${maquinaId}`,
    };
  }
  return { ok: true };
}

/** Os 8 primeiros caracteres do uid, P5. E o que o diretor confere no painel. */
export function pedacoDoUid(uid: string): string {
  return uid.slice(0, 8);
}

/**
 * O maquinaId gravado no config.json, SEM a variavel PONTE_MAQUINA_ID. P1: a
 * variavel nao sobrepoe o cracha. Null quando nao da para ler.
 */
export function maquinaIdDoArquivo(caminho: string = CAMINHO_CONFIG): string | null {
  try {
    const j: unknown = JSON.parse(lerTexto(caminho));
    if (typeof j !== 'object' || j === null) return null;
    const v = (j as Record<string, unknown>)['maquinaId'];
    return typeof v === 'string' && v.length > 0 ? v : null;
  } catch {
    return null;
  }
}

/**
 * P1: a maquina do cracha e a do config.json. PONTE_MAQUINA_ID diferente nao
 * troca nada: a ponte nao sobe. Igual, ou ausente, segue.
 */
export function conferirMaquinaDoCracha(
  doArquivo: string | null,
  doAmbiente: string | undefined
): { ok: true; maquinaId: string } | { ok: false; motivo: string } {
  if (doArquivo === null) return { ok: false, motivo: 'o config.json nao tem maquinaId legivel, e o cracha exige um' };
  if (doAmbiente !== undefined && doAmbiente.length > 0 && doAmbiente !== doArquivo) {
    return {
      ok: false,
      motivo: `PONTE_MAQUINA_ID (${doAmbiente}) nao sobrepoe o cracha; a maquina do config.json e ${doArquivo}. A ponte nao sobe assim`,
    };
  }
  return { ok: true, maquinaId: doArquivo };
}

/** Le o token de atualizacao de uma entrada de usuario guardada pelo SDK. Nunca registra o valor. */
export function tokenDaEntrada(entrada: unknown): { uid: string; refreshToken: string; anonimo: boolean } | null {
  if (typeof entrada !== 'object' || entrada === null) return null;
  const o = entrada as Record<string, unknown>;
  const sts = o['stsTokenManager'];
  if (typeof sts !== 'object' || sts === null) return null;
  const refreshToken = (sts as Record<string, unknown>)['refreshToken'];
  const uid = o['uid'];
  if (typeof refreshToken !== 'string' || refreshToken.length < 20 || typeof uid !== 'string' || uid.length === 0) return null;
  return { uid, refreshToken, anonimo: o['isAnonymous'] === true };
}

// ---------------------------------------------------------------------------
// Na base
// ---------------------------------------------------------------------------

function codigoDoErro(e: unknown): string {
  if (typeof e === 'object' && e !== null && typeof (e as Record<string, unknown>)['code'] === 'string') {
    return String((e as Record<string, unknown>)['code']);
  }
  return 'erro sem codigo';
}

/** Le o proprio cracha na base. Falha fechada: sem leitura, nao e ativo. */
export async function conferirCrachaNaBase(db: Firestore, uid: string, maquinaId: string): Promise<LeituraDoCracha> {
  try {
    const snap = await getDoc(doc(db, 'crachas', uid));
    return avaliarCracha(snap.exists() ? snap.data() : null, uid, maquinaId);
  } catch (e) {
    return { ok: false, motivo: `nao deu para ler o cracha na base (${codigoDoErro(e)}), recusado por seguranca` };
  }
}

/**
 * Vigia o proprio cracha enquanto a ponte esta no ar. Revogado, de outra
 * maquina, sumido ou ilegivel: chama aoCair uma vez, com o motivo, e para de
 * ouvir. Item 7 do contrato: revogar vale na hora e so para esta maquina.
 */
export function vigiarCracha(
  db: Firestore,
  uid: string,
  maquinaId: string,
  aoCair: (motivo: string) => void
): () => void {
  let caiu = false;
  let desligar: (() => void) | null = null;
  const cair = (motivo: string): void => {
    if (caiu) return;
    caiu = true;
    try {
      desligar?.();
    } catch {
      // ouvinte ja desligado
    }
    aoCair(motivo);
  };
  desligar = onSnapshot(
    doc(db, 'crachas', uid),
    (snap) => {
      const r = avaliarCracha(snap.exists() ? snap.data() : null, uid, maquinaId);
      if (!r.ok) cair(r.motivo);
    },
    (e) => cair(`a ponte perdeu a leitura do proprio cracha (${codigoDoErro(e)}), para por seguranca`)
  );
  return () => {
    caiu = true;
    try {
      desligar?.();
    } catch {
      // ouvinte ja desligado
    }
  };
}
