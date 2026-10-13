/*
 * Ligacao com o Firebase, sempre no navegador. Saida estatica: nada disto roda
 * em servidor.
 *
 * Nenhuma leitura da base acontece antes de haver usuario autenticado, §A.6:
 * quem chama estas funcoes e a barreira de entrada, e os ouvintes so sao
 * criados depois que o usuario e o diretor.
 */

import { getApp, getApps, initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import { connectFirestoreEmulator, getFirestore, type Firestore } from 'firebase/firestore';
import { EMULADOR, lerConfiguracao, type OrigemDaConfiguracao } from './configuracao';

export const EMAIL_DO_DIRETOR = 'henrique.vieira@soulan.com.br';

export interface PecasDoFirebase {
  app: FirebaseApp;
  auth: Auth;
  base: Firestore;
  origem: OrigemDaConfiguracao['origem'];
}

let pecas: PecasDoFirebase | null = null;
let emAndamento: Promise<PecasDoFirebase> | null = null;

export async function ligarFirebase(): Promise<PecasDoFirebase> {
  if (pecas) return pecas;
  if (emAndamento) return emAndamento;

  emAndamento = (async () => {
    const { configuracao, origem } = await lerConfiguracao();
    const app = getApps().length ? getApp() : initializeApp(configuracao);
    const auth = getAuth(app);
    const base = getFirestore(app);

    if (EMULADOR.ligado) {
      const [hostAuth, portaAuth] = EMULADOR.auth.split(':');
      const [hostBase, portaBase] = EMULADOR.firestore.split(':');
      connectAuthEmulator(auth, `http://${hostAuth}:${portaAuth}`, { disableWarnings: true });
      connectFirestoreEmulator(base, hostBase, Number(portaBase));
    }

    const montadas: PecasDoFirebase = { app, auth, base, origem };
    pecas = montadas;
    return montadas;
  })();

  try {
    return await emAndamento;
  } finally {
    emAndamento = null;
  }
}
