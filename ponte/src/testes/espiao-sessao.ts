// espiao-sessao.ts, OST 16, P1: anota todo toque de arquivo em sessao.json ou
// sessao-emulador.json, para a prova do cracha conferir que foram ZERO.
//
// Carregado com `node --import <este arquivo> ...` antes de qualquer modulo da
// ponte, ou importado pela propria prova antes de importar identidade.js. Troca
// as funcoes de node:fs por versoes que anotam e seguem, e sincroniza as
// exportacoes nomeadas (syncBuiltinESMExports), porque a ponte importa
// `{ readFileSync } from 'node:fs'`.
//
// So anota o CAMINHO e o nome da funcao, nunca conteudo. Anota em
// PONTE_ESPIAO_SAIDA, que a prova aponta para dentro da pasta da rodada, §A.17.

import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';

const saida = process.env['PONTE_ESPIAO_SAIDA'] ?? '';
const ALVO = /sessao(-emulador)?\.json/i;
const anexar = fs.appendFileSync.bind(fs);

function caminhoDe(p: unknown): string {
  if (typeof p === 'string') return p;
  if (p instanceof URL) return p.pathname;
  if (Buffer.isBuffer(p)) return p.toString('utf8');
  return '';
}

function anotar(funcao: string, ...caminhos: unknown[]): void {
  if (saida.length === 0) return;
  for (const c of caminhos) {
    const t = caminhoDe(c);
    if (t.length > 0 && ALVO.test(t)) anexar(saida, `${new Date().toISOString()} ${funcao} ${t}\n`, 'utf8');
  }
}

type Qualquer = (...args: unknown[]) => unknown;
const alvoFs = fs as unknown as Record<string, Qualquer>;
const umCaminho = [
  'readFileSync', 'existsSync', 'statSync', 'lstatSync', 'openSync', 'accessSync', 'writeFileSync', 'appendFileSync',
  'readFile', 'stat', 'open', 'access', 'writeFile', 'createReadStream', 'createWriteStream', 'unlinkSync', 'rmSync',
];
const doisCaminhos = ['renameSync', 'copyFileSync', 'rename', 'copyFile'];
for (const nome of umCaminho) {
  const original = alvoFs[nome];
  if (typeof original !== 'function') continue;
  alvoFs[nome] = function (this: unknown, ...args: unknown[]): unknown {
    // appendFileSync do proprio espiao nao passa por aqui: usa a copia guardada.
    anotar(nome, args[0]);
    return original.apply(this, args);
  };
}
for (const nome of doisCaminhos) {
  const original = alvoFs[nome];
  if (typeof original !== 'function') continue;
  alvoFs[nome] = function (this: unknown, ...args: unknown[]): unknown {
    anotar(nome, args[0], args[1]);
    return original.apply(this, args);
  };
}
const promessas = fs.promises as unknown as Record<string, Qualquer>;
for (const nome of ['readFile', 'open', 'stat', 'access', 'writeFile', 'rename', 'copyFile']) {
  const original = promessas[nome];
  if (typeof original !== 'function') continue;
  promessas[nome] = function (this: unknown, ...args: unknown[]): unknown {
    anotar(`promises.${nome}`, args[0], nome === 'rename' || nome === 'copyFile' ? args[1] : undefined);
    return original.apply(this, args);
  };
}
syncBuiltinESMExports();

export const ESPIAO_LIGADO = saida.length > 0;
