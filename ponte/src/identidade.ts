// identidade.ts, o dono da identidade da ponte.
//
// A ponte entra na base como o PROPRIO DIRETOR, pelo SDK cliente, sem chave de
// servico. O login acontece UMA vez, na instalacao; depois o proprio SDK renova
// o token de atualizacao sozinho, porque a sessao esta persistida em arquivo
// (persistenciaArquivo.ts).
//
// §A.6, regra dura que manda aqui: SO CONEXAO DE SAIDA. Nada neste modulo escuta
// nada. Em especial, esta PROIBIDO abrir servidor HTTP local de laco de retorno
// para receber redirecionamento de OAuth, mesmo em 127.0.0.1. Por isso a escada
// de credencial abaixo nao tem nenhum degrau de navegador com retorno local: ela
// so le o que ja existe na maquina, ou recebe uma colagem do diretor, ou fala com
// o emulador. Se uma solucao precisar escutar, ela esta errada.
//
// §A.9: o arquivo do firebase-tools e SO LEITURA. A ponte nunca escreve nele e
// nunca altera configuracao que o diretor ja tem.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  connectAuthEmulator,
  initializeAuth,
  onIdTokenChanged,
  signInWithCredential,
  signInWithEmailAndPassword,
  type Auth,
  type User,
} from 'firebase/auth';
import {
  CAMINHO_SESSAO,
  CAMINHO_SESSAO_EMULADOR,
  DIRETOR,
  PASTA_LOCAL,
  carregarConfig,
  type ConfigLocal,
} from './config.js';
import { criarPersistenciaEmArquivo, type SessaoEmArquivo } from './persistenciaArquivo.js';

const NOME_APP = 'ponte-da-fabrica';
// Porta propria da ponte, para nao colidir com emulador de outro projeto na mesma
// maquina. Veja ponte/emulador/firebase.json.
const EMULADOR_AUTH = process.env.PONTE_EMULADOR_AUTH ?? 'http://127.0.0.1:9199';

/** Caminho do deposito de credencial do firebase-tools. So leitura, §A.9. */
export const CAMINHO_FIREBASE_TOOLS = join(homedir(), '.config', 'configstore', 'firebase-tools.json');

export type FaseDegrau = 'antes do SDK' | 'pelo SDK';

export interface ContextoDegrau {
  config: ConfigLocal;
  emulador: boolean;
  sessao: SessaoEmArquivo;
  /** Credencial colada pelo diretor na instalacao, quando houver. */
  colagem: string | null;
  /** Instancia de autenticacao, disponivel apenas na fase pelo SDK. */
  auth: Auth | null;
  registrar: (linha: string) => void;
}

export interface SaidaDegrau {
  ok: boolean;
  detalhe: string;
  /** Erro real, sem maquiagem, quando o degrau nao serve. */
  erroReal?: string;
}

/** Um degrau da escada de credencial. O primeiro que funcionar vence. */
export interface Degrau {
  nome: string;
  descricao: string;
  fase: FaseDegrau;
  aplicavel(ctx: ContextoDegrau): boolean;
  tentar(ctx: ContextoDegrau): Promise<SaidaDegrau>;
}

export interface Identidade {
  app: FirebaseApp;
  auth: Auth;
  usuario: { uid: string; email: string };
  /** Qual degrau da escada entregou a credencial. */
  degrau: string;
  /** Relato passo a passo, para evidencia e para o relatorio. */
  relato: string[];
}

export class IdentidadeRecusada extends Error {
  constructor(mensagem: string, public readonly relato: string[]) {
    super(mensagem);
    this.name = 'IdentidadeRecusada';
  }
}

// ---------------------------------------------------------------------------
// Leitura do deposito do firebase-tools (so leitura)
// ---------------------------------------------------------------------------

export interface TokensDoCli {
  idToken: string | null;
  accessToken: string | null;
  email: string | null;
  expiraEm: number | null;
  clienteOauth: string | null;
}

export function lerTokensDoFirebaseCli(caminho = CAMINHO_FIREBASE_TOOLS): TokensDoCli | null {
  if (!existsSync(caminho)) return null;
  try {
    const bruto: unknown = JSON.parse(readFileSync(caminho, 'utf8'));
    if (typeof bruto !== 'object' || bruto === null) return null;
    const raiz = bruto as Record<string, unknown>;
    const tokens = (typeof raiz['tokens'] === 'object' && raiz['tokens'] !== null
      ? (raiz['tokens'] as Record<string, unknown>)
      : {}) as Record<string, unknown>;
    const user = (typeof raiz['user'] === 'object' && raiz['user'] !== null
      ? (raiz['user'] as Record<string, unknown>)
      : {}) as Record<string, unknown>;
    const comoTexto = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null);
    return {
      idToken: comoTexto(tokens['id_token']),
      accessToken: comoTexto(tokens['access_token']),
      email: comoTexto(user['email']),
      expiraEm: typeof tokens['expires_at'] === 'number' ? tokens['expires_at'] : null,
      clienteOauth: comoTexto(user['azp']),
    };
  } catch {
    return null;
  }
}

/** Le as alegacoes de um JWT sem verificar assinatura. Serve para registro, nao para decidir. */
export function alegacoesDoJwt(jwt: string): Record<string, unknown> | null {
  const partes = jwt.split('.');
  const meio = partes[1];
  if (partes.length !== 3 || meio === undefined) return null;
  try {
    const json: unknown = JSON.parse(Buffer.from(meio, 'base64url').toString('utf8'));
    return typeof json === 'object' && json !== null ? (json as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function erroDe(e: unknown): string {
  if (typeof e === 'object' && e !== null) {
    const o = e as Record<string, unknown>;
    const codigo = typeof o['code'] === 'string' ? o['code'] : null;
    const mensagem = typeof o['message'] === 'string' ? o['message'] : String(e);
    const servidor =
      typeof o['customData'] === 'object' && o['customData'] !== null
        ? JSON.stringify((o['customData'] as Record<string, unknown>)['serverResponse'] ?? null)
        : null;
    return [codigo, mensagem, servidor].filter((p) => p !== null && p !== 'null').join(' | ');
  }
  return String(e);
}

// ---------------------------------------------------------------------------
// Degrau (a): token do Google que o firebase login do diretor ja deixou na maquina
// ---------------------------------------------------------------------------

const degrauTokenDoFirebaseCli: Degrau = {
  nome: 'token-do-firebase-cli',
  descricao:
    'Troca o token do Google que o firebase login do diretor ja deixou na maquina por sessao do Firebase. ' +
    'Nao pede nada ao diretor. So leitura do arquivo do firebase-tools.',
  fase: 'pelo SDK',
  aplicavel: (ctx) => !ctx.emulador && lerTokensDoFirebaseCli() !== null,
  async tentar(ctx) {
    const auth = ctx.auth;
    if (!auth) return { ok: false, detalhe: 'sem instancia de autenticacao' };
    const t = lerTokensDoFirebaseCli();
    if (!t) return { ok: false, detalhe: `deposito do firebase-tools nao encontrado em ${CAMINHO_FIREBASE_TOOLS}` };
    ctx.registrar(`degrau (a): deposito lido so para leitura, conta ${t.email ?? 'desconhecida'}`);
    ctx.registrar(`degrau (a): cliente OAuth do token e ${t.clienteOauth ?? 'desconhecido'}`);
    if (t.expiraEm !== null) {
      const vencido = t.expiraEm < Date.now();
      ctx.registrar(
        `degrau (a): token do CLI expira em ${new Date(t.expiraEm).toISOString()} (${vencido ? 'VENCIDO' : 'valido'})`
      );
      if (vencido) {
        return {
          ok: false,
          detalhe: 'token do firebase CLI vencido. A ponte nao renova esse token, para nao escrever no arquivo do diretor, §A.9.',
          erroReal: 'token do firebase-tools vencido',
        };
      }
    }
    if (t.email !== null && t.email !== DIRETOR) {
      return { ok: false, detalhe: `o firebase CLI esta logado como ${t.email}, nao como o diretor` };
    }

    const tentativas: { rotulo: string; credencial: ReturnType<typeof GoogleAuthProvider.credential> }[] = [];
    if (t.idToken && t.accessToken)
      tentativas.push({ rotulo: 'id_token mais access_token', credencial: GoogleAuthProvider.credential(t.idToken, t.accessToken) });
    if (t.idToken) tentativas.push({ rotulo: 'so id_token', credencial: GoogleAuthProvider.credential(t.idToken) });
    if (t.accessToken)
      tentativas.push({ rotulo: 'so access_token', credencial: GoogleAuthProvider.credential(null, t.accessToken) });

    const erros: string[] = [];
    for (const tentativa of tentativas) {
      try {
        const r = await signInWithCredential(auth, tentativa.credencial);
        return { ok: true, detalhe: `entrou com ${tentativa.rotulo}, uid ${r.user.uid}` };
      } catch (e) {
        const texto = `${tentativa.rotulo}: ${erroDe(e)}`;
        erros.push(texto);
        ctx.registrar(`degrau (a) recusado, ${texto}`);
      }
    }
    return {
      ok: false,
      detalhe: 'o Identity Toolkit recusou o token do cliente OAuth do firebase CLI',
      erroReal: erros.join('\n'),
    };
  },
};

// ---------------------------------------------------------------------------
// Degrau (b): colagem unica na instalacao, credencial de sessao vinda do painel
// ---------------------------------------------------------------------------

interface SessaoTrocada {
  idToken: string;
  refreshToken: string;
  expiraEmMs: number;
  uid: string;
}

/**
 * Troca um token de atualizacao por sessao, no endpoint de token seguro.
 * Conexao de SAIDA, pedido HTTPS comum. Nada escuta.
 */
async function trocarNoEndpointDeToken(apiKey: string, refreshToken: string): Promise<SessaoTrocada> {
  const resposta = await fetch(`https://securetoken.googleapis.com/v1/token?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }).toString(),
  });
  const corpo: unknown = await resposta.json().catch(() => null);
  if (!resposta.ok || typeof corpo !== 'object' || corpo === null) {
    throw new Error(`endpoint de token recusou, HTTP ${resposta.status}, ${JSON.stringify(corpo)}`);
  }
  const o = corpo as Record<string, unknown>;
  const idToken = typeof o['id_token'] === 'string' ? o['id_token'] : null;
  const novoRefresh = typeof o['refresh_token'] === 'string' ? o['refresh_token'] : null;
  const expiraEm = typeof o['expires_in'] === 'string' ? Number(o['expires_in']) : 3600;
  const uid = typeof o['user_id'] === 'string' ? o['user_id'] : null;
  if (!idToken || !novoRefresh || !uid) throw new Error(`resposta do endpoint de token incompleta, ${JSON.stringify(Object.keys(o))}`);
  return { idToken, refreshToken: novoRefresh, expiraEmMs: Date.now() + expiraEm * 1000, uid };
}

/** Aceita a colagem como token de atualizacao puro ou como JSON com o campo refreshToken. */
export function lerColagem(bruto: string): string | null {
  const texto = bruto.trim();
  if (texto.length === 0) return null;
  if (texto.startsWith('{')) {
    try {
      const j: unknown = JSON.parse(texto);
      if (typeof j === 'object' && j !== null) {
        const o = j as Record<string, unknown>;
        for (const campo of ['refreshToken', 'refresh_token', 'tokenDeAtualizacao']) {
          const v = o[campo];
          if (typeof v === 'string' && v.length > 20) return v;
        }
      }
    } catch {
      return null;
    }
    return null;
  }
  return texto.length > 20 ? texto : null;
}

const degrauColagemNaInstalacao: Degrau = {
  nome: 'colagem-na-instalacao',
  descricao:
    'O diretor abre o painel no navegador, ja logado como ele, e cola na instalacao a credencial de sessao que o painel mostra. ' +
    'A ponte troca essa credencial por sessao propria no endpoint de token seguro, por conexao de saida.',
  fase: 'antes do SDK',
  aplicavel: (ctx) => !ctx.emulador && ctx.colagem !== null && lerColagem(ctx.colagem) !== null,
  async tentar(ctx) {
    const refresh = ctx.colagem ? lerColagem(ctx.colagem) : null;
    if (!refresh) return { ok: false, detalhe: 'nada colado, ou colagem fora de formato' };
    try {
      const s = await trocarNoEndpointDeToken(ctx.config.apiKey, refresh);
      const alegacoes = alegacoesDoJwt(s.idToken) ?? {};
      const email = typeof alegacoes['email'] === 'string' ? alegacoes['email'] : null;
      const verificado = alegacoes['email_verified'] === true;
      ctx.registrar(`degrau (b): sessao trocada, conta ${email ?? 'desconhecida'}, e-mail verificado ${verificado}`);
      if (email !== DIRETOR) return { ok: false, detalhe: `a credencial colada e da conta ${email ?? 'desconhecida'}, nao do diretor` };
      if (!verificado) return { ok: false, detalhe: 'a credencial colada tem e-mail nao verificado' };
      // Grava a sessao no formato que o proprio SDK le na abertura. Dali em diante
      // o SDK renova sozinho.
      ctx.sessao.escrever(ctx.sessao.chaveDoUsuario(ctx.config.apiKey, NOME_APP), {
        uid: s.uid,
        email,
        emailVerified: true,
        isAnonymous: false,
        providerData: [{ providerId: 'google.com', uid: email, displayName: null, email, phoneNumber: null, photoURL: null }],
        stsTokenManager: { refreshToken: s.refreshToken, accessToken: s.idToken, expirationTime: s.expiraEmMs },
        createdAt: String(Date.now()),
        lastLoginAt: String(Date.now()),
        apiKey: ctx.config.apiKey,
        appName: NOME_APP,
      });
      return { ok: true, detalhe: `sessao gravada para ${email}` };
    } catch (e) {
      return { ok: false, detalhe: 'o endpoint de token recusou a credencial colada', erroReal: erroDe(e) };
    }
  },
};

// ---------------------------------------------------------------------------
// Degrau do emulador: usuario de teste com o e-mail do diretor
// ---------------------------------------------------------------------------

function senhaDeEmulador(): string {
  const caminho = join(PASTA_LOCAL, 'emulador-usuario.json');
  if (existsSync(caminho)) {
    try {
      const j: unknown = JSON.parse(readFileSync(caminho, 'utf8'));
      if (typeof j === 'object' && j !== null) {
        const v = (j as Record<string, unknown>)['senha'];
        if (typeof v === 'string' && v.length >= 12) return v;
      }
    } catch {
      // segue e gera outra
    }
  }
  const senha = randomBytes(18).toString('base64url');
  writeFileSync(caminho, JSON.stringify({ senha, nota: 'usuario de teste do emulador local, nao vale na nuvem' }, null, 2), {
    encoding: 'utf8',
    mode: 0o600,
  });
  return senha;
}

async function restEmulador(caminho: string, corpo: unknown, comoAdmin: boolean): Promise<Record<string, unknown>> {
  const cabecalhos: Record<string, string> = { 'content-type': 'application/json' };
  if (comoAdmin) cabecalhos['authorization'] = 'Bearer owner';
  const r = await fetch(`${EMULADOR_AUTH}/identitytoolkit.googleapis.com/v1/${caminho}`, {
    method: 'POST',
    headers: cabecalhos,
    body: JSON.stringify(corpo),
  });
  const j: unknown = await r.json().catch(() => null);
  if (typeof j !== 'object' || j === null) throw new Error(`emulador respondeu HTTP ${r.status} sem corpo`);
  return j as Record<string, unknown>;
}

const degrauEmulador: Degrau = {
  nome: 'emulador-usuario-de-teste',
  descricao:
    'Somente com PONTE_EMULADOR=1. Cria e usa um usuario de teste com o e-mail do diretor no emulador de autenticacao. ' +
    'Nao serve na nuvem, serve para provar o fluxo sem depender do clique do diretor.',
  fase: 'pelo SDK',
  aplicavel: (ctx) => ctx.emulador,
  async tentar(ctx) {
    const auth = ctx.auth;
    if (!auth) return { ok: false, detalhe: 'sem instancia de autenticacao' };
    const senha = senhaDeEmulador();
    try {
      const criado = await restEmulador(
        `accounts:signUp?key=${encodeURIComponent(ctx.config.apiKey)}`,
        { email: DIRETOR, password: senha, returnSecureToken: true },
        false
      );
      const erro = criado['error'];
      if (erro !== undefined) ctx.registrar(`degrau emulador: conta ja existia (${JSON.stringify(erro).slice(0, 120)})`);
      const entrada = await restEmulador(
        `accounts:signInWithPassword?key=${encodeURIComponent(ctx.config.apiKey)}`,
        { email: DIRETOR, password: senha, returnSecureToken: true },
        false
      );
      const localId = typeof entrada['localId'] === 'string' ? entrada['localId'] : null;
      if (!localId) throw new Error(`emulador nao devolveu localId, ${JSON.stringify(entrada).slice(0, 200)}`);
      await restEmulador(`projects/${ctx.config.projectId}/accounts:update`, { localId, emailVerified: true }, true);
      const r = await signInWithEmailAndPassword(auth, DIRETOR, senha);
      return { ok: true, detalhe: `usuario de teste do emulador, uid ${r.user.uid}` };
    } catch (e) {
      return { ok: false, detalhe: 'emulador de autenticacao nao respondeu como esperado', erroReal: erroDe(e) };
    }
  },
};

/** A escada, em ordem de preferencia. O primeiro degrau que funcionar vence. */
export const ESCADA: Degrau[] = [degrauEmulador, degrauTokenDoFirebaseCli, degrauColagemNaInstalacao];

// ---------------------------------------------------------------------------
// Abertura da identidade
// ---------------------------------------------------------------------------

async function conferirDiretor(usuario: User): Promise<{ uid: string; email: string }> {
  const resultado = await usuario.getIdTokenResult(true);
  const email = typeof resultado.claims['email'] === 'string' ? resultado.claims['email'] : null;
  const verificado = resultado.claims['email_verified'] === true;
  if (email !== DIRETOR) throw new Error(`a sessao e da conta ${email ?? 'desconhecida'}, e so o diretor entra, §A.6`);
  if (!verificado) throw new Error('a sessao tem e-mail nao verificado, e o e-mail verificado e obrigatorio, §A.6');
  if (!usuario.emailVerified) throw new Error('o cadastro da conta esta com e-mail nao verificado, §A.6');
  return { uid: usuario.uid, email };
}

export interface OpcoesIdentidade {
  emulador?: boolean;
  colagem?: string | null;
  registrar?: (linha: string) => void;
}

/**
 * Abre a identidade da ponte. Se ja existe sessao salva, usa. Se nao, desce a
 * escada de credencial. Confere que o usuario e o diretor com e-mail verificado.
 * Qualquer outro, a ponte nao sobe e o motivo fica registrado.
 */
export async function abrirIdentidade(opcoes: OpcoesIdentidade = {}): Promise<Identidade> {
  const emulador = opcoes.emulador === true;
  const relato: string[] = [];
  const registrar = (linha: string): void => {
    relato.push(linha);
    opcoes.registrar?.(linha);
  };

  const config = carregarConfig({ emulador });
  registrar(`configuracao local lida, maquina ${config.maquinaId}, projeto ${config.projectId}`);
  const sessao = criarPersistenciaEmArquivo(emulador ? CAMINHO_SESSAO_EMULADOR : CAMINHO_SESSAO);
  registrar(`sessao persistida em ${sessao.caminho}`);

  const ctxBase: ContextoDegrau = { config, emulador, sessao, colagem: opcoes.colagem ?? null, auth: null, registrar };

  const jaTemSessao = sessao.ler(sessao.chaveDoUsuario(config.apiKey, NOME_APP)) !== null;
  let degrauUsado = jaTemSessao ? 'sessao-salva' : '';

  // Fase antes do SDK: degraus que preparam o arquivo de sessao.
  if (!jaTemSessao) {
    for (const degrau of ESCADA.filter((d) => d.fase === 'antes do SDK')) {
      if (!degrau.aplicavel(ctxBase)) {
        registrar(`degrau ${degrau.nome}: nao aplicavel agora`);
        continue;
      }
      const saida = await degrau.tentar(ctxBase);
      registrar(`degrau ${degrau.nome}: ${saida.ok ? 'FUNCIONOU' : 'nao serviu'}, ${saida.detalhe}`);
      if (saida.erroReal) registrar(`erro real do degrau ${degrau.nome}:\n${saida.erroReal}`);
      if (saida.ok) {
        degrauUsado = degrau.nome;
        break;
      }
    }
  } else {
    registrar('sessao salva encontrada, o SDK renova sozinho, o diretor nao loga de novo');
  }

  const app = initializeApp(
    { apiKey: config.apiKey, authDomain: config.authDomain, projectId: config.projectId, appId: config.appId },
    NOME_APP
  );
  const auth = initializeAuth(app, { persistence: sessao.persistencia });
  if (emulador) connectAuthEmulator(auth, EMULADOR_AUTH, { disableWarnings: true });
  // O ouvinte mantem o arquivo de sessao em dia a cada renovacao de token.
  onIdTokenChanged(auth, (u) => {
    if (u) registrar(`token renovado pelo SDK para ${u.email ?? u.uid}`);
  });
  await auth.authStateReady();

  if (!auth.currentUser) {
    for (const degrau of ESCADA.filter((d) => d.fase === 'pelo SDK')) {
      const ctx: ContextoDegrau = { ...ctxBase, auth };
      if (!degrau.aplicavel(ctx)) {
        registrar(`degrau ${degrau.nome}: nao aplicavel agora`);
        continue;
      }
      const saida = await degrau.tentar(ctx);
      registrar(`degrau ${degrau.nome}: ${saida.ok ? 'FUNCIONOU' : 'nao serviu'}, ${saida.detalhe}`);
      if (saida.erroReal) registrar(`erro real do degrau ${degrau.nome}:\n${saida.erroReal}`);
      if (saida.ok) {
        degrauUsado = degrau.nome;
        break;
      }
    }
  }

  const usuarioBruto = auth.currentUser;
  if (!usuarioBruto) {
    throw new IdentidadeRecusada(
      'nenhum degrau da escada de credencial entregou sessao. A ponte nao sobe sem identidade do diretor, §A.6. ' +
        'Rode a instalacao da ponte para fazer o login uma vez.',
      relato
    );
  }

  let usuario: { uid: string; email: string };
  try {
    usuario = await conferirDiretor(usuarioBruto);
  } catch (e) {
    throw new IdentidadeRecusada(`identidade recusada: ${erroDe(e)}`, relato);
  }
  registrar(`identidade confirmada, ${usuario.email}, pelo degrau ${degrauUsado || 'sessao-salva'}`);
  return { app, auth, usuario, degrau: degrauUsado || 'sessao-salva', relato };
}

export { NOME_APP };
