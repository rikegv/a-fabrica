// pedirCracha.ts, OST 16: `npm run cracha`. Pede o cracha desta maquina.
//
// O que faz, na ordem do contrato (docs/ost16-contrato.md, fluxo do cracha):
//   1. tranca a pasta local, como o login de uma vez (entrar.ts);
//   2. entra com conta ANONIMA, e o SDK guarda a conta em cracha.json, que e
//      trancado e conferido do mesmo jeito que sessao.json;
//   3. sorteia um codigo de seis digitos e grava `pedidosDeCracha/{uid}` com os
//      campos exatos de R11;
//   4. mostra o codigo, os 8 primeiros caracteres do uid, a maquina e o rotulo, e
//      diz ao diretor onde emitir no painel;
//   5. espera `crachas/{uid}` ativo e da mesma maquina, ate 15 minutos.
//
// Ja existe cracha.json: nao cria outro, so confere o estado.
//
// P1: este comando nunca abre sessao.json. P2: o token nunca e impresso.
// §A.6: so conexao de saida, nenhuma porta. §A.9: so a pasta local da ponte.
//
// Saidas: 0 cracha emitido e ativo. 2 sem configuracao. 3 tempo esgotado.
// 4 cracha de outra maquina. 5 tranca nao ficou de pe. 6 revogado. 1 o resto.
//
// Uso: npm run cracha            (nuvem)
//      node dist/pedirCracha.js --emulador

import { existsSync, statSync } from 'node:fs';
import { deleteApp, getApps, initializeApp } from 'firebase/app';
import { connectAuthEmulator, initializeAuth, signInAnonymously, type Auth } from 'firebase/auth';
import {
  connectFirestoreEmulator,
  doc,
  getDoc,
  getFirestore,
  onSnapshot,
  serverTimestamp,
  setDoc,
  type Firestore,
} from 'firebase/firestore';
import { CAMINHO_CONFIG, FaltaConfig, PASTA_LOCAL, carregarConfig, protegerPastaLocal } from './config.js';
import {
  CHAVE_DO_PEDIDO,
  ESPERA_DO_CRACHA_MS,
  avaliarCracha,
  caminhoDoCracha,
  conferirMaquinaDoCracha,
  maquinaIdDoArquivo,
  montarPedido,
  pedacoDoUid,
  sortearCodigo,
  tokenDaEntrada,
} from './cracha.js';
import { criarPersistenciaEmArquivo } from './persistenciaArquivo.js';
import { aplicarProtecao, conferirProtecao } from './protecaoSessao.js';
import { NOME_APP } from './identidade.js';

const EMULADOR_AUTH = process.env.PONTE_EMULADOR_AUTH ?? 'http://127.0.0.1:9199';
const EMULADOR_FIRESTORE_HOST = process.env.PONTE_EMULADOR_FIRESTORE_HOST ?? '127.0.0.1';
const EMULADOR_FIRESTORE_PORTA = Number(process.env.PONTE_EMULADOR_FIRESTORE_PORTA ?? '8099');

export const SAIDA = {
  emitido: 0,
  falha: 1,
  semConfig: 2,
  tempoEsgotado: 3,
  outraMaquina: 4,
  semTranca: 5,
  revogado: 6,
} as const;

async function sair(codigo: number): Promise<never> {
  for (const app of getApps()) await deleteApp(app).catch(() => undefined);
  await new Promise<void>((r) => setTimeout(r, 400));
  process.exit(codigo);
}

function dizer(linha = ''): void {
  console.log(linha);
}

function codigoDoErro(e: unknown): string {
  if (typeof e === 'object' && e !== null && typeof (e as Record<string, unknown>)['code'] === 'string') {
    return String((e as Record<string, unknown>)['code']);
  }
  return 'erro sem codigo';
}

/** Confere a tranca da pasta e do arquivo do cracha. Falha fechada. */
function conferirTranca(caminhoCracha: string): boolean {
  const vereditos = [
    conferirProtecao(PASTA_LOCAL, { exigirHerancaQuebrada: true }),
    conferirProtecao(CAMINHO_CONFIG),
    conferirProtecao(caminhoCracha),
  ];
  for (const v of vereditos) dizer(`  ${v.protegido ? 'TRANCADO' : 'ABERTO'}: ${v.motivo}`);
  return vereditos.every((v) => v.protegido);
}

type Desfecho = { codigo: number; texto: string };

/**
 * Espera o proprio cracha. Ouve `crachas/{uid}`; se o ouvinte for negado ou cair,
 * segue conferindo de 5 em 5 segundos ate o prazo. Ativo e da mesma maquina:
 * emitido. Outra maquina ou revogado: para na hora. Prazo: tempo esgotado.
 */
function esperarCracha(db: Firestore, uid: string, maquinaId: string, prazoMs: number): Promise<Desfecho> {
  return new Promise<Desfecho>((resolve) => {
    let fim = false;
    let desligar: (() => void) | null = null;
    let sondagem: ReturnType<typeof setInterval> | null = null;
    const acabar = (d: Desfecho): void => {
      if (fim) return;
      fim = true;
      clearTimeout(relogio);
      if (sondagem !== null) clearInterval(sondagem);
      try {
        desligar?.();
      } catch {
        // ouvinte ja desligado
      }
      resolve(d);
    };
    const avaliar = (dado: unknown): void => {
      if (dado === null) return; // ainda nao emitido, segue esperando
      const r = avaliarCracha(dado, uid, maquinaId);
      if (r.ok) {
        acabar({ codigo: SAIDA.emitido, texto: 'cracha emitido. Esta maquina ja pode ligar a ponte com o cracha.' });
        return;
      }
      const o = dado as Record<string, unknown>;
      if (o['ativo'] !== true) {
        acabar({ codigo: SAIDA.revogado, texto: `${r.motivo}. Esta maquina precisa de um cracha novo.` });
        return;
      }
      acabar({ codigo: SAIDA.outraMaquina, texto: `${r.motivo}. Nada foi ligado; o diretor revoga esse cracha no painel.` });
    };
    const relogio = setTimeout(
      () =>
        acabar({
          codigo: SAIDA.tempoEsgotado,
          texto:
            `tempo esgotado: o cracha nao foi emitido em ${Math.round(prazoMs / 60000)} minuto(s). ` +
            'O pedido vence e a ponte nao liga. Para tentar de novo, a fabrica guarda este arquivo de cracha de lado e pede outro.',
        }),
      prazoMs
    );
    const sondar = (): void => {
      if (sondagem !== null) return;
      sondagem = setInterval(() => {
        void getDoc(doc(db, 'crachas', uid)).then(
          (s) => avaliar(s.exists() ? s.data() : null),
          () => undefined // negado ou sem rede: segue esperando ate o prazo
        );
      }, 5000);
    };
    desligar = onSnapshot(
      doc(db, 'crachas', uid),
      (s) => avaliar(s.exists() ? s.data() : null),
      () => sondar()
    );
  });
}

function abrir(emulador: boolean, caminhoCracha: string): { auth: Auth; db: Firestore; apiKey: string } {
  const config = carregarConfig({ emulador });
  const arquivo = criarPersistenciaEmArquivo(caminhoCracha);
  const app = initializeApp(
    { apiKey: config.apiKey, authDomain: config.authDomain, projectId: config.projectId, appId: config.appId },
    NOME_APP
  );
  const auth = initializeAuth(app, { persistence: arquivo.persistencia });
  if (emulador) connectAuthEmulator(auth, EMULADOR_AUTH, { disableWarnings: true });
  const db = getFirestore(app);
  if (emulador) connectFirestoreEmulator(db, EMULADOR_FIRESTORE_HOST, EMULADOR_FIRESTORE_PORTA);
  return { auth, db, apiKey: config.apiKey };
}

function mostrarPedido(codigo: string, uid: string, maquinaId: string, rotulo: string | null): void {
  dizer('');
  dizer('==============================================================');
  dizer(`  CODIGO DO PEDIDO:  ${codigo}`);
  dizer(`  CONTA:             ${pedacoDoUid(uid)}`);
  dizer(`  MAQUINA:           ${maquinaId}`);
  dizer(`  ROTULO:            ${rotulo ?? 'sem rotulo'}`);
  dizer('==============================================================');
  dizer('');
  dizer('O que o diretor faz agora, no painel, no navegador dele:');
  dizer('  1. abrir Configuracoes, situacao da ponte;');
  dizer('  2. achar o pedido com este mesmo codigo, esta conta e esta maquina;');
  dizer('  3. conferir os tres e apertar Emitir cracha.');
  dizer('Se o codigo, a conta ou a maquina nao baterem, nao emita: o pedido nao e desta maquina.');
  dizer('');
  dizer(`Esta janela espera ate ${Math.round(ESPERA_DO_CRACHA_MS / 60000)} minuto(s).`);
}

async function principal(): Promise<void> {
  const emulador = process.argv.includes('--emulador') || process.env.PONTE_EMULADOR === '1';
  const caminhoCracha = caminhoDoCracha(emulador);
  dizer(`A Fabrica, pedido de cracha desta maquina${emulador ? ' (emulador)' : ''}`);
  dizer('');

  let config: ReturnType<typeof carregarConfig>;
  try {
    config = carregarConfig({ emulador });
  } catch (e) {
    if (e instanceof FaltaConfig) {
      dizer('A ponte nao tem configuracao local ainda.');
      dizer(e.oQueFalta);
      return sair(SAIDA.semConfig);
    }
    throw e;
  }
  const maquina = conferirMaquinaDoCracha(maquinaIdDoArquivo(), process.env.PONTE_MAQUINA_ID);
  if (!maquina.ok) {
    dizer(`O pedido nao sai: ${maquina.motivo}.`);
    return sair(SAIDA.falha);
  }
  const maquinaId = maquina.maquinaId;

  dizer('Fechando a pasta local para o seu usuario:');
  dizer(protegerPastaLocal());
  dizer('');

  // Ja existe cracha: nao cria outro, so confere.
  if (existsSync(caminhoCracha)) {
    dizer(`Esta maquina ja tem arquivo de cracha em ${caminhoCracha}. Nao crio outro, confiro o estado.`);
    if (!conferirTranca(caminhoCracha)) {
      dizer('A tranca do arquivo de cracha nao esta de pe. A ponte recusa subir assim.');
      return sair(SAIDA.semTranca);
    }
    const { auth, db, apiKey } = abrir(emulador, caminhoCracha);
    const arquivo = criarPersistenciaEmArquivo(caminhoCracha);
    const lido = tokenDaEntrada(arquivo.ler(arquivo.chaveDoUsuario(apiKey, NOME_APP)));
    await auth.authStateReady();
    const u = auth.currentUser;
    if (lido === null || !u || u.uid !== lido.uid || !u.isAnonymous) {
      dizer('O arquivo de cracha esta ilegivel ou a conta dele nao abriu. O diretor revoga no painel e a maquina pede outro.');
      return sair(SAIDA.falha);
    }
    let dado: unknown = null;
    try {
      const s = await getDoc(doc(db, 'crachas', u.uid));
      dado = s.exists() ? s.data() : null;
    } catch (e) {
      dizer(`Nao deu para ler o cracha na base (${codigoDoErro(e)}).`);
      return sair(SAIDA.falha);
    }
    if (dado !== null) {
      const r = avaliarCracha(dado, u.uid, maquinaId);
      dizer(r.ok ? `cracha emitido e ativo, conta ${pedacoDoUid(u.uid)}, maquina ${maquinaId}.` : `${r.motivo}.`);
      if (r.ok) return sair(SAIDA.emitido);
      const ativo = (dado as Record<string, unknown>)['ativo'] === true;
      return sair(ativo ? SAIDA.outraMaquina : SAIDA.revogado);
    }
    // Ainda nao emitido. Se o pedido ainda vale, mostra de novo e espera o resto do prazo.
    const pedido = arquivo.ler(CHAVE_DO_PEDIDO);
    const p = typeof pedido === 'object' && pedido !== null ? (pedido as Record<string, unknown>) : {};
    const pedidoEm = typeof p['pedidoEm'] === 'string' ? Date.parse(p['pedidoEm']) : statSync(caminhoCracha).mtimeMs;
    const resta = ESPERA_DO_CRACHA_MS - (Date.now() - pedidoEm);
    if (!Number.isFinite(resta) || resta <= 0 || typeof p['codigo'] !== 'string') {
      dizer('O cracha nao foi emitido e o pedido ja venceu. A ponte nao liga com este arquivo.');
      dizer('Para pedir de novo, a fabrica guarda este arquivo de cracha de lado e roda o pedido outra vez.');
      return sair(SAIDA.tempoEsgotado);
    }
    mostrarPedido(p['codigo'], u.uid, maquinaId, typeof p['rotulo'] === 'string' ? p['rotulo'] : null);
    const d = await esperarCracha(db, u.uid, maquinaId, resta);
    dizer(d.texto);
    return sair(d.codigo);
  }

  // Pedido novo.
  const { auth, db } = abrir(emulador, caminhoCracha);
  await auth.authStateReady();
  let uid: string;
  try {
    const r = await signInAnonymously(auth);
    uid = r.user.uid;
  } catch (e) {
    dizer(`A entrada anonima foi recusada (${codigoDoErro(e)}).`);
    dizer('Se for a nuvem, o provedor anonimo do projeto pode estar desligado: ele so e ligado na publicacao da OST 16.');
    return sair(SAIDA.falha);
  }

  // A conta ja esta no arquivo, gravada pelo SDK. Tranca e confere, como sessao.json.
  dizer('Trancando o arquivo de cracha para o seu usuario, e so ele:');
  dizer(aplicarProtecao(caminhoCracha));
  if (!conferirTranca(caminhoCracha)) {
    dizer('A conta anonima foi criada, mas a tranca do arquivo de cracha NAO ficou de pe. Nenhum pedido foi gravado.');
    return sair(SAIDA.semTranca);
  }

  let pedido: ReturnType<typeof montarPedido>;
  try {
    pedido = montarPedido({ uid, maquinaId, nomeMaquina: config.nomeMaquina, rotulo: config.rotulo ?? null, codigo: sortearCodigo() });
  } catch (e) {
    dizer(`O pedido nao sai: ${e instanceof Error ? e.message : String(e)}.`);
    return sair(SAIDA.falha);
  }
  try {
    await setDoc(doc(db, 'pedidosDeCracha', uid), { ...pedido, criadoEm: serverTimestamp() });
  } catch (e) {
    dizer(`A base recusou o pedido (${codigoDoErro(e)}). Nada foi emitido.`);
    return sair(SAIDA.falha);
  }
  // Registro do pedido ao lado da conta, para conferir o estado depois. Nao e credencial.
  criarPersistenciaEmArquivo(caminhoCracha).escrever(CHAVE_DO_PEDIDO, {
    uid,
    maquinaId,
    codigo: pedido.codigo,
    rotulo: pedido.rotulo,
    pedidoEm: new Date().toISOString(),
  });

  mostrarPedido(pedido.codigo, uid, maquinaId, pedido.rotulo);
  const d = await esperarCracha(db, uid, maquinaId, ESPERA_DO_CRACHA_MS);
  dizer(d.texto);
  return sair(d.codigo);
}

principal().catch(async (e: unknown) => {
  // Sem pilha e sem corpo de erro: nada que possa levar token sai daqui.
  console.error(`O pedido de cracha falhou (${codigoDoErro(e)}).`);
  if (e instanceof Error && !/token/i.test(e.message)) console.error(e.message.slice(0, 200));
  await sair(SAIDA.falha);
});
