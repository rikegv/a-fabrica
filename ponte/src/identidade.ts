// identidade.ts, o dono da identidade da ponte.
//
// A ponte entra na base como o PROPRIO DIRETOR, pelo SDK cliente, sem chave de
// servico. O login acontece UMA vez, na instalacao; depois o proprio SDK renova
// o token de atualizacao sozinho, porque a sessao esta persistida em arquivo
// (persistenciaArquivo.ts).
//
// §A.6, e aqui a regra MUDOU na OST 7, por esclarecimento do diretor: laco de
// retorno local em 127.0.0.1 esta LIBERADO para a entrada da ponte. O que o §A.6
// continua vetando e porta de ENTRADA na maquina, isto e, tunel de entrada,
// endereco publico apontando para ca, ou servico escutando em interface que a
// rede alcanca. Com isso, a COLAGEM de credencial MORREU: o degrau que lia uma
// credencial colada no terminal foi removido inteiro, sem resto comentado, e no
// lugar dele entrou o degrau de login no navegador (entradaNavegador.ts), com as
// sete trancas descritas la. Fora do momento da entrada, nada nesta ponte escuta
// nada: o servico ponte.ts nunca liga esse degrau, e e ele quem roda o dia inteiro.
//
// DECISAO DO DIRETOR, OST 6 parte 2, e ela e dura: esta PROIBIDO usar o token do
// Firebase CLI como credencial da ponte. O degrau que lia o deposito do
// firebase-tools foi REMOVIDO, nao desligado: nao existe mais funcao, constante,
// bandeira nem caminho de codigo neste pacote que alcance aquele arquivo. Razao do
// diretor: aquele token carrega escopo de nuvem (cloud-platform) muito maior do que
// as regras do Firestore limitam, entao um arquivo roubado daria acesso a bem mais
// do que o painel. A ponte entra como o diretor pelo login de CLIENTE, que e o
// escopo exato que as regras controlam. Se o login de cliente nao der conta de
// algum caminho, isso e achado para relatar (docs/ost6-ponte-credencial.md), nunca
// motivo para subir de credencial.
//
// §A.9: a ponte nao le nem escreve configuracao que o diretor ja tem na maquina.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { join } from 'node:path';
import { initializeApp, type FirebaseApp } from 'firebase/app';
import {
  connectAuthEmulator,
  initializeAuth,
  onIdTokenChanged,
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
import { entrarPeloNavegador, EntradaPeloNavegadorFalhou } from './entradaNavegador.js';

const NOME_APP = 'ponte-da-fabrica';
// Porta propria da ponte, para nao colidir com emulador de outro projeto na mesma
// maquina. Veja ponte/emulador/firebase.json.
const EMULADOR_AUTH = process.env.PONTE_EMULADOR_AUTH ?? 'http://127.0.0.1:9199';

export type FaseDegrau = 'antes do SDK' | 'pelo SDK';

export interface ContextoDegrau {
  config: ConfigLocal;
  emulador: boolean;
  sessao: SessaoEmArquivo;
  /**
   * Interruptor unico do degrau que abre o laco de retorno.
   *
   * Vale true SO em entrar.ts, que e o comando de login que o diretor roda na
   * mao. O servico (ponte.ts) passa false, e por isso o servico que fica no ar o
   * dia inteiro NUNCA tem caminho de codigo que abra porta nenhuma. Quem auditar
   * tem um lugar so para conferir: quem seta isto.
   */
  permitirNavegador: boolean;
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

/**
 * Le as alegacoes de um JWT sem verificar assinatura.
 *
 * Serve para conferir a FORMA do que o Google acabou de devolver na troca de
 * token, e para registro. Nao e a defesa: a defesa dura e a regra do Firestore,
 * que confere o token verificado do lado do servidor.
 */
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
// Degrau de nuvem: login no navegador do diretor, pelo laco de retorno local
// ---------------------------------------------------------------------------
//
// Este e o unico degrau de nuvem que existe. Dois degraus morreram antes dele, e
// os dois por decisao do diretor: o que lia o token do Firebase CLI (OST 6 parte
// 2, escopo de nuvem grande demais) e o de colagem no terminal (OST 7, trocado
// pelo login no navegador). Nenhum dos dois deixou resto comentado.
//
// A parte que o navegador entrega e so o transporte. A conferencia e a gravacao
// continuam sendo as mesmas da OST 6, ja provadas caso de erro por caso de erro:
// troca no endpoint de token seguro por conexao de saida, conferencia das
// alegacoes, e so depois disso o disco.

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

/** O que a leitura da credencial devolve: ou um token de atualizacao, ou o motivo exato da recusa. */
export type LeituraDaCredencial =
  | { ok: true; refreshToken: string; emailDeclarado: string | null; formato: 'texto puro' | 'JSON' }
  | { ok: false; motivo: string };

const PISTA_JWT = /^ey[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/;

/**
 * Le a credencial que chega de fora, falha fechada e falante.
 *
 * Nasceu para ler colagem no terminal, na OST 6. A colagem morreu na OST 7, mas
 * esta funcao continua valendo e continua sendo a primeira barreira, porque agora
 * ela confere a FORMA do que a pagina do laco de retorno entregou. O ganho de
 * manter: os dez casos de erro que a prova exercita continuam exercitando o mesmo
 * codigo que roda de verdade, em vez de um caminho novo sem prova.
 *
 * Aceita duas formas: o token de atualizacao puro, ou um JSON com refreshToken e,
 * se quiser, email. Qualquer outra coisa e recusada com motivo legivel.
 *
 * Nao valida assinatura nem decide identidade: isso quem faz e a troca no endpoint
 * de token do Google, mais a conferencia das alegacoes, mais a regra do Firestore.
 */
export function lerCredencialEntregue(bruto: string): LeituraDaCredencial {
  if (typeof bruto !== 'string') return { ok: false, motivo: 'nada foi entregue' };
  const texto = bruto.trim();
  if (texto.length === 0) return { ok: false, motivo: 'nada foi entregue, a linha veio vazia' };

  let candidato = texto;
  let emailDeclarado: string | null = null;
  let formato: 'texto puro' | 'JSON' = 'texto puro';

  if (texto.startsWith('{')) {
    formato = 'JSON';
    let j: unknown;
    try {
      j = JSON.parse(texto);
    } catch {
      return {
        ok: false,
        motivo: 'a credencial entregue comeca com { mas nao e um JSON valido, provavelmente foi copiada pela metade',
      };
    }
    if (typeof j !== 'object' || j === null) return { ok: false, motivo: 'a credencial entregue e um JSON que nao descreve um objeto' };
    const o = j as Record<string, unknown>;
    const emailBruto = o['email'];
    if (typeof emailBruto === 'string' && emailBruto.length > 0) emailDeclarado = emailBruto.trim().toLowerCase();
    let achou: string | null = null;
    for (const campo of ['refreshToken', 'refresh_token', 'tokenDeAtualizacao']) {
      const v = o[campo];
      if (typeof v === 'string' && v.trim().length > 0) {
        achou = v.trim();
        break;
      }
    }
    if (achou === null) {
      return {
        ok: false,
        motivo: `o JSON entregue nao tem o campo refreshToken (campos presentes: ${Object.keys(o).join(', ') || 'nenhum'})`,
      };
    }
    candidato = achou;
  }

  // Copiar de tela as vezes traz quebra de linha ou espaco no meio. O token nao
  // tem espaco, entao tirar espaco em branco e seguro e evita recusa boba.
  candidato = candidato.replace(/\s+/g, '');

  if (candidato.length === 0) return { ok: false, motivo: 'a credencial entregue ficou vazia depois de tirar os espacos' };
  if (PISTA_JWT.test(candidato)) {
    return {
      ok: false,
      motivo:
        'o que foi entregue e um token de identificacao (JWT de tres partes), e a ponte precisa do token de ATUALIZACAO da sessao. ' +
        'O token de identificacao vence em uma hora e nao serve para a ponte renovar sozinha.',
    };
  }
  if (candidato.length < 40) {
    return {
      ok: false,
      motivo: `a credencial entregue tem so ${candidato.length} caractere(s), curta demais para um token de atualizacao, provavelmente foi cortada na copia`,
    };
  }
  if (!/^[A-Za-z0-9_.:\-]+$/.test(candidato)) {
    return {
      ok: false,
      motivo: 'a credencial entregue tem caractere que token de atualizacao nao tem, provavelmente veio texto da pagina junto',
    };
  }
  if (emailDeclarado !== null && emailDeclarado !== DIRETOR) {
    return { ok: false, motivo: `o JSON entregue diz que a conta e ${emailDeclarado}, e so o diretor entra, §A.6` };
  }
  return { ok: true, refreshToken: candidato, emailDeclarado, formato };
}

export interface AlegacoesConferidas {
  ok: boolean;
  motivo: string;
  email: string | null;
  verificado: boolean;
  projeto: string | null;
  provedor: string | null;
}

/**
 * Confere as alegacoes da sessao que o Google acabou de devolver: tem de ser o
 * e-mail do diretor, com e-mail verificado, e do PROJETO desta ponte. Qualquer
 * desvio e recusa, §A.6. Funcao pura, para dar para provar sem rede.
 */
export function conferirAlegacoesDaSessao(
  alegacoes: Record<string, unknown>,
  projectId: string
): AlegacoesConferidas {
  // Comparacao de texto EXATA, igual a da regra do Firestore, que compara
  // request.auth.token.email com o texto do e-mail do diretor. Aceitar aqui uma
  // variacao que a regra recusa seria pior que recusar: a ponte subiria e toda
  // escrita dela seria negada na base, sem motivo visivel.
  const email = typeof alegacoes['email'] === 'string' ? alegacoes['email'] : null;
  const verificado = alegacoes['email_verified'] === true;
  const projeto = typeof alegacoes['aud'] === 'string' ? alegacoes['aud'] : null;
  const firebase = typeof alegacoes['firebase'] === 'object' && alegacoes['firebase'] !== null
    ? (alegacoes['firebase'] as Record<string, unknown>)
    : {};
  const provedor = typeof firebase['sign_in_provider'] === 'string' ? firebase['sign_in_provider'] : null;
  const base = { email, verificado, projeto, provedor };
  if (email === null) return { ...base, ok: false, motivo: 'a sessao devolvida nao tem e-mail nenhum' };
  if (email !== DIRETOR) return { ...base, ok: false, motivo: `a credencial entregue e da conta ${email}, nao do diretor, §A.6` };
  if (!verificado) return { ...base, ok: false, motivo: 'a credencial entregue tem e-mail nao verificado, e o verificado e obrigatorio, §A.6' };
  if (projeto !== projectId) {
    return { ...base, ok: false, motivo: `a credencial entregue e do projeto ${projeto ?? 'desconhecido'}, e esta ponte e do projeto ${projectId}` };
  }
  return { ...base, ok: true, motivo: `conta ${email}, e-mail verificado, projeto ${projeto}, provedor ${provedor ?? 'nao declarado'}` };
}

/**
 * Confere uma credencial que veio de fora e, SO se ela passar em tudo, grava a
 * sessao no disco.
 *
 * Esta funcao e o lugar unico onde credencial de nuvem vira sessao em disco. Era
 * o corpo do degrau de colagem na OST 6; ficou separada na OST 7 para o degrau do
 * navegador usar exatamente o mesmo caminho, sem copia. Toda recusa sai daqui sem
 * gravar um byte.
 */
async function conferirEGravarSessao(
  ctx: ContextoDegrau,
  credencialBruta: string,
  deOnde: string
): Promise<SaidaDegrau> {
  const leitura = lerCredencialEntregue(credencialBruta);
  if (!leitura.ok) {
    return { ok: false, detalhe: `a credencial foi recusada antes de qualquer chamada: ${leitura.motivo}` };
  }
  ctx.registrar(
    `credencial de ${deOnde} lida em formato de ${leitura.formato}, ${leitura.refreshToken.length} caractere(s), ` +
      `conta declarada ${leitura.emailDeclarado ?? 'nao declarada'}`
  );
  let s: SessaoTrocada;
  try {
    s = await trocarNoEndpointDeToken(ctx.config.apiKey, leitura.refreshToken);
  } catch (e) {
    return {
      ok: false,
      detalhe:
        'o endpoint de token do Google recusou a credencial entregue. ' +
        'Isso acontece quando a credencial venceu, foi revogada ou e de outro projeto. ' +
        'Faca o login no navegador outra vez.',
      erroReal: erroDe(e),
    };
  }
  const alegacoes = alegacoesDoJwt(s.idToken);
  if (alegacoes === null) {
    return { ok: false, detalhe: 'o endpoint de token devolveu uma sessao que a ponte nao conseguiu ler, recusado por seguranca' };
  }
  const conferido = conferirAlegacoesDaSessao(alegacoes, ctx.config.projectId);
  ctx.registrar(`sessao trocada e conferida: ${conferido.motivo}`);
  if (!conferido.ok) return { ok: false, detalhe: conferido.motivo };
  const email = conferido.email as string;
  // So aqui, com tudo conferido, a sessao vai para o disco. Credencial recusada
  // nao deixa nada gravado. O formato e o que o proprio SDK le na abertura: dali
  // em diante o SDK renova sozinho e o diretor nao loga de novo.
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
  return { ok: true, detalhe: `sessao gravada para ${email}, uid ${s.uid}` };
}

const degrauNavegadorLocal: Degrau = {
  nome: 'login-no-navegador',
  descricao:
    'A ponte abre uma pagina no navegador do diretor, presa em 127.0.0.1 e com segredo de uso unico, e ele entra com o Google, ' +
    'com a segunda etapa que a conta dele exige. A pagina devolve a credencial da sessao pelo laco de retorno; a ponte troca por ' +
    'sessao propria no endpoint de token seguro, por conexao de SAIDA, confere que a conta e a do diretor com e-mail verificado e ' +
    'que a sessao e deste projeto, e so entao grava. A porta fecha no fim, sempre.',
  fase: 'antes do SDK',
  // Duas condicoes, e as duas tem de valer: fora do emulador, e com o interruptor
  // ligado, que SO o comando de login liga. O servico nunca chega aqui.
  aplicavel: (ctx) => !ctx.emulador && ctx.permitirNavegador,
  async tentar(ctx) {
    let credencial: Awaited<ReturnType<typeof entrarPeloNavegador>>;
    try {
      credencial = await entrarPeloNavegador({ config: ctx.config, registrar: ctx.registrar });
    } catch (e) {
      if (e instanceof EntradaPeloNavegadorFalhou) {
        return { ok: false, detalhe: `${e.message}. O que fazer: ${e.oQueFazer}`, erroReal: e.message };
      }
      return { ok: false, detalhe: 'a entrada pelo navegador falhou', erroReal: erroDe(e) };
    }
    ctx.registrar(
      `porta do laco de retorno ficou aberta ${credencial.portaAbertaMs} ms na porta ${credencial.porta}, e ja fechou`
    );
    const bruta = JSON.stringify({
      email: credencial.emailDeclarado,
      refreshToken: credencial.refreshToken,
    });
    return conferirEGravarSessao(ctx, bruta, 'login no navegador');
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

/**
 * A escada, em ordem de preferencia. O primeiro degrau que funcionar vence.
 *
 * ESCOPO PURO DE FIREBASE, e so. Nenhum degrau le credencial de nuvem, nenhum
 * degrau pede escopo de nuvem, nenhum degrau toca arquivo de outra ferramenta.
 * Fora desta lista, o unico caminho de identidade e a sessao ja salva, que o SDK
 * renova sozinho.
 */
export const ESCADA: Degrau[] = [degrauEmulador, degrauNavegadorLocal];

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
  /**
   * Liga o degrau que abre o laco de retorno em 127.0.0.1 para o login no
   * navegador. PADRAO FALSO, de propósito: quem nao pedir, nao abre porta. Só o
   * comando de login (entrar.ts) passa true. O serviço, as provas e os testes
   * nunca passam.
   */
  permitirNavegador?: boolean;
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

  const ctxBase: ContextoDegrau = {
    config,
    emulador,
    sessao,
    permitirNavegador: opcoes.permitirNavegador === true,
    auth: null,
    registrar,
  };

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
        'Rode o login no navegador, uma vez so: ' +
        'powershell -ExecutionPolicy Bypass -File ponte\\instalar.ps1',
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
