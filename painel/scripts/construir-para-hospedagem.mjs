/*
 * Construcao para a hospedagem, §A.6.
 *
 * Em desenvolvimento o painel le a configuracao de painel/.env.local, e o Next
 * embute essas variaveis no pacote final. Servido pela hospedagem do Firebase,
 * o painel nao precisa delas: le de /__/firebase/init.json, que a propria
 * hospedagem serve.
 *
 * Este script constroi com as variaveis em branco, para que a chave nao va
 * dentro do pacote que vai para a nuvem. A saida fica em painel/out.
 *
 * Uso: npm run construir-para-hospedagem
 */

import { spawnSync } from 'node:child_process';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const raizPainel = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const EM_BRANCO = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'NEXT_PUBLIC_EMULADOR',
  'NEXT_PUBLIC_EMULADOR_AUTH',
  'NEXT_PUBLIC_EMULADOR_FIRESTORE'
];

const ambiente = { ...process.env };
for (const nome of EM_BRANCO) ambiente[nome] = '';

function rodar(comando, argumentos) {
  const r = spawnSync(comando, argumentos, { cwd: raizPainel, env: ambiente, stdio: 'inherit', shell: true });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

rodar('node', ['scripts/gerar-estilos.mjs']);
rodar('npx', ['next', 'build']);

/* Conferencia: nenhuma chave do Firebase pode ter entrado na saida. */
function arquivos(pasta) {
  const saida = [];
  for (const nome of readdirSync(pasta)) {
    const caminho = join(pasta, nome);
    if (statSync(caminho).isDirectory()) saida.push(...arquivos(caminho));
    else saida.push(caminho);
  }
  return saida;
}

const suspeitos = arquivos(join(raizPainel, 'out')).filter((caminho) => {
  if (!/\.(js|html|json|txt|css)$/.test(caminho)) return false;
  return /AIzaSy/.test(readFileSync(caminho, 'utf8'));
});

if (suspeitos.length) {
  console.error('A saída levou chave do Firebase dentro. Arquivos:');
  for (const s of suspeitos) console.error('  ' + s);
  process.exit(1);
}

console.log('Saída limpa de chave do Firebase. Pasta para a hospedagem servir: painel/out');
