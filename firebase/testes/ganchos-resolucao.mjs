// ganchos-resolucao.mjs, so para o teste da base.
//
// O teste importa o arquivo real da ponte, ponte/src/base.ts, sem copiar e sem
// alterar nada dele. Dois ajustes de resolucao sao necessarios para isso:
//
// 1. A ponte e TypeScript e importa os vizinhos com extensao .js, como o
//    TypeScript manda. O Node le .ts direto, mas nao troca .js por .ts. Este
//    gancho troca, e so quando o .js nao existe e o .ts existe.
//
// 2. O teste e a ponte precisam da MESMA instancia do SDK do Firebase. Se cada
//    lado carregar a sua copia, um Firestore criado aqui nao serve para as
//    funcoes de la. Entao todo especificador do Firebase e resolvido a partir de
//    uma unica pasta: a da ponte, que e a copia que roda de verdade. Se a ponte
//    nao tiver node_modules, cai para a pasta de testes.
//
// Nada fora de firebase/testes e escrito. Isto e resolucao de modulo, nao
// alteracao de codigo da ponte.

import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const TESTES = new URL('./package.json', import.meta.url).href;
const PONTE = new URL('../../ponte/package.json', import.meta.url);
const TEM_PONTE = existsSync(fileURLToPath(new URL('../../ponte/node_modules/firebase/package.json', import.meta.url)));
const CASA_DO_SDK = TEM_PONTE ? PONTE.href : TESTES;

export async function resolve(especificador, contexto, proximo) {
  if (especificador === 'firebase' || especificador.startsWith('firebase/') || especificador.startsWith('@firebase/')) {
    return proximo(especificador, { ...contexto, parentURL: CASA_DO_SDK });
  }
  if (especificador.startsWith('.') && especificador.endsWith('.js') && contexto.parentURL) {
    const comoJs = new URL(especificador, contexto.parentURL);
    if (!existsSync(fileURLToPath(comoJs))) {
      const comoTs = fileURLToPath(comoJs).replace(/\.js$/, '.ts');
      if (existsSync(comoTs)) return { url: pathToFileURL(comoTs).href, format: 'module-typescript', shortCircuit: true };
    }
  }
  return proximo(especificador, contexto);
}
