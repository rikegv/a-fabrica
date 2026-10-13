/*
 * Configuracao do Firebase sem segredo no repositorio, §A.6.
 *
 * Duas origens, nesta ordem:
 *
 * 1. /__/firebase/init.json, endereco reservado que o proprio Hosting do
 *    Firebase serve quando o painel esta publicado. Nada fica no codigo.
 * 2. painel/.env.local, so para rodar na maquina em desenvolvimento. O
 *    .gitignore ja ignora .env.* e *.local. O repositorio leva apenas o
 *    .env.example, com os nomes das variaveis e valores vazios.
 *
 * Nenhuma chave e nenhum authDomain aparece em arquivo versionado.
 *
 * Ressalva da seguranca da OST 6, corrigida aqui para nao afirmar o que e falso:
 * o identificador do app APARECE em arquivo versionado, em ponte/instalar.ps1,
 * porque a instalacao precisa dele para pedir a configuracao ao proprio Firebase.
 * Isso e aceito de proposito: o identificador do app nao e segredo, ele vai dentro
 * do init.json que o Hosting serve publicamente para qualquer navegador. Quem
 * protege a base e a regra do Firestore mais a conta unica, nao o sigilo desse
 * identificador. O que nunca entra no repositorio e a chave e a sessao.
 */

export interface ConfiguracaoFirebase {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  messagingSenderId?: string;
  storageBucket?: string;
}

export interface OrigemDaConfiguracao {
  configuracao: ConfiguracaoFirebase;
  origem: 'hospedagem' | 'ambiente local';
}

function doAmbiente(): ConfiguracaoFirebase | null {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID;
  if (!apiKey || !authDomain || !projectId || !appId) return null;
  return {
    apiKey,
    authDomain,
    projectId,
    appId,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
  };
}

async function daHospedagem(): Promise<ConfiguracaoFirebase | null> {
  try {
    const resposta = await fetch('/__/firebase/init.json', { cache: 'no-store' });
    if (!resposta.ok) return null;
    const dado = (await resposta.json()) as Partial<ConfiguracaoFirebase>;
    if (!dado.apiKey || !dado.authDomain || !dado.projectId || !dado.appId) return null;
    return dado as ConfiguracaoFirebase;
  } catch {
    return null;
  }
}

export async function lerConfiguracao(): Promise<OrigemDaConfiguracao> {
  const hospedagem = await daHospedagem();
  if (hospedagem) return { configuracao: hospedagem, origem: 'hospedagem' };
  const ambiente = doAmbiente();
  if (ambiente) return { configuracao: ambiente, origem: 'ambiente local' };
  throw new Error(
    'Sem configuração do Firebase. Publicado, o painel lê de /__/firebase/init.json. Na máquina, preencha painel/.env.local a partir de painel/.env.example.'
  );
}

export const EMULADOR = {
  ligado: process.env.NEXT_PUBLIC_EMULADOR === '1',
  auth: process.env.NEXT_PUBLIC_EMULADOR_AUTH ?? '127.0.0.1:9099',
  firestore: process.env.NEXT_PUBLIC_EMULADOR_FIRESTORE ?? '127.0.0.1:8080'
};
