// entradaPorCodigo.ts, o login da ponte no modelo do login do Claude Code. OST 14.
//
// PEDIDO DO DIRETOR, OST 14, item 3: "mesmo modelo do login do Claude. Voce
// entrega o link, o diretor abre, e cola o codigo aqui. Sem chave de conta de
// servico." Nasceu para a ponte do Linux, que roda em maquina sem navegador e,
// na VM fabrica-1, sem nem tela.
//
// COMO FUNCIONA, em quatro passos, e todos sao conexao de SAIDA
// --------------------------------------------------------------
//   1. A ponte pede ao Authentication do proprio projeto um endereco de login do
//      Google (createAuthUri). Ele devolve o link e um identificador de sessao.
//      O identificador fica so com a ponte, num arquivo trancado, e vale 60
//      minutos.
//   2. O diretor abre o link em QUALQUER navegador, no notebook ou no celular, e
//      entra com o Google do jeito que a conta dele exigir, inclusive a segunda
//      etapa. O Google devolve o navegador para a pagina de retorno do proprio
//      Firebase, em a-fabrica-soulan.firebaseapp.com, com um codigo de uso unico
//      no endereco. Essa pagina mostra uma mensagem de erro em ingles ("missing
//      initial state"): e esperado, porque ela foi feita para outro fluxo, e ela
//      NAO usa o codigo. O codigo fica intacto na barra de endereco.
//   3. O diretor copia o endereco inteiro e cola. A ponte confere que ele e da
//      pagina de retorno do projeto e que o estado bate com o desta rodada.
//   4. A ponte troca o codigo por sessao (signInWithIdp), com o identificador do
//      passo 1. Dali em diante e o caminho de sempre: identidade.ts troca no
//      endpoint de token, confere conta, e-mail verificado e projeto, e so entao
//      grava, trancado.
//
// §A.6, por que isto e mais fechado que o laco de retorno: NADA escuta. Nem
// 127.0.0.1, nem por segundos. Nao existe porta, tunel nem encaminhamento.
//
// O QUE ISTO NAO E: nao e a colagem que morreu na OST 7. Aquela colava o TOKEN DE
// ATUALIZACAO, que e a propria chave da ponte, e deixava a chave na tela. Aqui se
// cola um CODIGO DE USO UNICO, que sozinho nao vale nada: ele so vira sessao junto
// com o identificador do passo 1, que nunca sai da pasta trancada da ponte, e
// morre na primeira troca. A chave que nasce dele vai direto para o arquivo
// trancado e nao aparece em tela nenhuma.
//
// LIMITE DECLARADO, achado R1 da seguranca na OST 14. O codigo colado so vale
// com o identificador do passo 1, e esse identificador fica com a ponte. MAS:
// quando quem roda o login e repassa o link e uma FABRICA (o diretor cola na
// conversa com ela), a fabrica controla os dois lados. Ela pode pedir um link
// proprio ao Authentication (a chave do cliente e publica), mostrar esse link ao
// diretor, e trocar o codigo ela mesma, ficando com uma sessao da conta dele.
// Nada neste arquivo impede isso. O caminho fechado e o diretor rodar o login no
// terminal DELE (sudo bash /opt/a-fabrica-ponte/app/linux/entrar.sh), com o link
// e a colagem passando so por ali, e com o usuario das fabricas sem sudo.
//
// §A.11: nenhum travessao em texto que o diretor le.

import { timingSafeEqual } from 'node:crypto';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DIRETOR, PASTA_LOCAL, type ConfigLocal } from './config.js';

/** Quanto vale a entrada pendente, do link ate a colagem. */
export const VALIDADE_DA_ENTRADA_MS = 60 * 60_000;

/** Onde mora a entrada pendente. Pasta trancada da ponte, arquivo 600. */
export const CAMINHO_ENTRADA_PENDENTE = join(PASTA_LOCAL, 'entrada-pendente.json');

export interface EntradaPendente {
  /** O link que o diretor abre. Nao e segredo: sem o identificador, nao vale nada. */
  link: string;
  /** O identificador de sessao do Authentication. Este SIM fica so com a ponte. */
  sessionId: string;
  /** O estado que o Google devolve junto do codigo. Confere que a colagem e desta rodada. */
  estado: string;
  /** A pagina de retorno, por extenso. */
  retorno: string;
  criadoEm: string;
}

export class EntradaPorCodigoFalhou extends Error {
  constructor(
    mensagem: string,
    /** O que fazer, em portugues, para o diretor ler. */
    public readonly oQueFazer: string
  ) {
    super(mensagem);
    this.name = 'EntradaPorCodigoFalhou';
  }
}

function paginaDeRetorno(config: ConfigLocal): string {
  return `https://${config.authDomain}/__/auth/handler`;
}

async function postarNoAuthentication(
  config: ConfigLocal,
  metodo: 'createAuthUri' | 'signInWithIdp',
  corpo: Record<string, unknown>
): Promise<Record<string, unknown>> {
  let resposta: Response;
  try {
    resposta = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:${metodo}?key=${encodeURIComponent(config.apiKey)}`,
      { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) }
    );
  } catch (e) {
    throw new EntradaPorCodigoFalhou(
      `nao deu para falar com o Authentication do projeto (${e instanceof Error ? e.message : String(e)})`,
      'confira a conexao desta maquina com a internet e rode de novo'
    );
  }
  const j: unknown = await resposta.json().catch(() => null);
  const o = typeof j === 'object' && j !== null ? (j as Record<string, unknown>) : {};
  if (!resposta.ok) {
    const erro = typeof o['error'] === 'object' && o['error'] !== null ? (o['error'] as Record<string, unknown>) : {};
    const msg = typeof erro['message'] === 'string' ? erro['message'] : `HTTP ${resposta.status}`;
    // So o codigo de erro do servidor. Nunca o pedido, que leva o codigo colado.
    throw new EntradaPorCodigoFalhou(`o Authentication recusou: ${msg.slice(0, 160)}`, oQueFazerPara(msg));
  }
  return o;
}

function oQueFazerPara(msg: string): string {
  if (/INVALID_IDP_RESPONSE|invalid_grant|EXPIRED|INVALID_SESSION|MISSING_OR_INVALID_NONCE/i.test(msg)) {
    return 'o codigo venceu, ja foi usado ou e de outra rodada. Gere um link novo e cole o endereco logo depois de entrar';
  }
  if (/OPERATION_NOT_ALLOWED/i.test(msg)) return 'o projeto nao tem o login do Google ligado no Authentication. Avise a fabrica';
  if (/API key|API_KEY/i.test(msg)) return 'a configuracao local da ponte esta com a chave errada. Rode a instalacao de novo';
  return 'gere um link novo e tente outra vez; se repetir, avise a fabrica com a mensagem acima';
}

/**
 * Passo 1: pede o link ao Authentication. Nao grava nada; quem grava e quem chama,
 * com gravarEntradaPendente, para a ordem de gravacao ficar visivel em entrar.ts.
 */
export async function gerarEntrada(config: ConfigLocal): Promise<EntradaPendente> {
  const retorno = paginaDeRetorno(config);
  const o = await postarNoAuthentication(config, 'createAuthUri', {
    providerId: 'google.com',
    continueUri: retorno,
    authFlowType: 'CODE_FLOW',
    // Ja abre pedindo a conta do diretor, e deixa ele escolher se tiver varias.
    customParameter: { prompt: 'select_account', login_hint: DIRETOR },
  });
  const link = typeof o['authUri'] === 'string' ? o['authUri'] : '';
  const sessionId = typeof o['sessionId'] === 'string' ? o['sessionId'] : '';
  let estado = '';
  try {
    estado = new URL(link).searchParams.get('state') ?? '';
  } catch {
    estado = '';
  }
  if (!link.startsWith('https://accounts.google.com/') || sessionId.length < 16 || estado.length < 16) {
    throw new EntradaPorCodigoFalhou(
      'o Authentication devolveu um link de login que a ponte nao reconhece, recusado por seguranca',
      'rode de novo; se repetir, avise a fabrica'
    );
  }
  return { link, sessionId, estado, retorno, criadoEm: new Date().toISOString() };
}

/** Grava a entrada pendente na pasta trancada, arquivo 600. */
export function gravarEntradaPendente(e: EntradaPendente): void {
  writeFileSync(CAMINHO_ENTRADA_PENDENTE, JSON.stringify(e, null, 2), { encoding: 'utf8', mode: 0o600 });
}

/** Le a entrada pendente, e recusa se venceu. Nunca devolve entrada vencida. */
export function lerEntradaPendente(): EntradaPendente {
  if (!existsSync(CAMINHO_ENTRADA_PENDENTE)) {
    throw new EntradaPorCodigoFalhou('nao existe link de login pendente nesta ponte', 'gere o link primeiro');
  }
  let o: Record<string, unknown>;
  try {
    o = JSON.parse(readFileSync(CAMINHO_ENTRADA_PENDENTE, 'utf8')) as Record<string, unknown>;
  } catch {
    throw new EntradaPorCodigoFalhou('a entrada pendente esta ilegivel', 'gere um link novo');
  }
  const e: EntradaPendente = {
    link: String(o['link'] ?? ''),
    sessionId: String(o['sessionId'] ?? ''),
    estado: String(o['estado'] ?? ''),
    retorno: String(o['retorno'] ?? ''),
    criadoEm: String(o['criadoEm'] ?? ''),
  };
  const idade = Date.now() - new Date(e.criadoEm).getTime();
  if (!Number.isFinite(idade) || idade < 0 || idade > VALIDADE_DA_ENTRADA_MS) {
    throw new EntradaPorCodigoFalhou(
      `o link de login pendente venceu (vale ${Math.round(VALIDADE_DA_ENTRADA_MS / 60_000)} minutos)`,
      'gere um link novo e cole o endereco logo depois de entrar'
    );
  }
  if (e.sessionId.length < 16 || e.estado.length < 16 || !e.retorno.startsWith('https://')) {
    throw new EntradaPorCodigoFalhou('a entrada pendente esta incompleta', 'gere um link novo');
  }
  return e;
}

/** Apaga a entrada pendente. Caminho completo e nomeado, um arquivo so, §A.18. */
export function apagarEntradaPendente(): void {
  try {
    unlinkSync(CAMINHO_ENTRADA_PENDENTE);
  } catch {
    // ja nao existia
  }
}

function igual(a: string, b: string): boolean {
  const x = Buffer.from(a, 'utf8');
  const y = Buffer.from(b, 'utf8');
  return x.length === y.length && timingSafeEqual(x, y);
}

/**
 * Le o que o diretor colou. Aceita duas formas: o endereco inteiro da pagina de
 * retorno (o jeito recomendado), ou so o valor do codigo. Devolve o endereco de
 * retorno que vai para a troca. Funcao pura, para dar para provar sem rede.
 *
 * Recusa, sem ecoar o que foi colado: endereco de outro dominio ou de outra
 * pagina, estado que nao bate com o desta rodada, codigo ausente ou com
 * caractere estranho, e endereco que traz erro do Google.
 */
export function lerColagem(colado: string, pendente: EntradaPendente): { ok: true; requestUri: string } | { ok: false; motivo: string } {
  const texto = String(colado ?? '').trim().replace(/\s+/g, '');
  if (texto.length === 0) return { ok: false, motivo: 'nada foi colado' };
  if (texto.length > 4096) return { ok: false, motivo: 'o que foi colado e grande demais para ser o endereco de retorno' };

  if (/^https?:\/\//i.test(texto)) {
    let u: URL;
    try {
      u = new URL(texto);
    } catch {
      return { ok: false, motivo: 'o endereco colado nao e um endereco valido, provavelmente foi copiado pela metade' };
    }
    const esperado = new URL(pendente.retorno);
    if (u.protocol !== 'https:' || u.host !== esperado.host || u.pathname !== esperado.pathname) {
      return {
        ok: false,
        motivo: `o endereco colado nao e da pagina de retorno do projeto (${esperado.host}${esperado.pathname}), recusado por seguranca`,
      };
    }
    const erroDoGoogle = u.searchParams.get('error');
    if (erroDoGoogle) return { ok: false, motivo: `o Google devolveu erro no login: ${erroDoGoogle.slice(0, 80)}` };
    const estado = u.searchParams.get('state') ?? '';
    const codigo = u.searchParams.get('code') ?? '';
    if (codigo.length === 0) return { ok: false, motivo: 'o endereco colado nao traz o codigo do Google' };
    if (!igual(estado, pendente.estado)) {
      return { ok: false, motivo: 'o endereco colado e de OUTRA rodada de login, o estado nao bate com o desta' };
    }
    return { ok: true, requestUri: u.toString() };
  }

  // So o codigo. O Google usa letras, numeros, barra, hifen, sublinhado e ponto.
  let codigo = texto;
  try {
    codigo = decodeURIComponent(texto);
  } catch {
    return { ok: false, motivo: 'o codigo colado tem caractere que nao da para ler' };
  }
  if (!/^[A-Za-z0-9/_.\-]{20,1024}$/.test(codigo)) {
    return { ok: false, motivo: 'o que foi colado nao parece o codigo do Google; cole o endereco inteiro da barra do navegador' };
  }
  const r = new URL(pendente.retorno);
  r.searchParams.set('state', pendente.estado);
  r.searchParams.set('code', codigo);
  return { ok: true, requestUri: r.toString() };
}

export interface CredencialPorCodigo {
  refreshToken: string;
  emailDeclarado: string | null;
}

/**
 * Passo 4: troca o codigo por sessao no Authentication do projeto. Conexao de
 * saida. Nao confere identidade e nao grava: isso e de identidade.ts, pelo
 * caminho de sempre.
 */
export async function concluirEntrada(
  config: ConfigLocal,
  pendente: EntradaPendente,
  colado: string
): Promise<CredencialPorCodigo> {
  const leitura = lerColagem(colado, pendente);
  if (!leitura.ok) {
    throw new EntradaPorCodigoFalhou(leitura.motivo, 'gere um link novo se precisar, entre, e cole o endereco inteiro da barra do navegador');
  }
  const o = await postarNoAuthentication(config, 'signInWithIdp', {
    requestUri: leitura.requestUri,
    sessionId: pendente.sessionId,
    returnSecureToken: true,
  });
  if (o['needConfirmation'] === true) {
    throw new EntradaPorCodigoFalhou(
      'o Authentication pediu confirmacao de conta vinculada, e a ponte nao decide isso sozinha',
      'avise a fabrica'
    );
  }
  const refreshToken = typeof o['refreshToken'] === 'string' ? o['refreshToken'] : '';
  const email = typeof o['email'] === 'string' ? o['email'].trim().toLowerCase() : null;
  if (refreshToken.length === 0) {
    throw new EntradaPorCodigoFalhou('o Authentication respondeu sem sessao', 'gere um link novo e tente outra vez');
  }
  return { refreshToken, emailDeclarado: email };
}
