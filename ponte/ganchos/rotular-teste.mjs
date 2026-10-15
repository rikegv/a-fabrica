// rotular-teste.mjs, poe o rotulo de teste no que JA esta na base.
//
// Decisao do diretor na retomada da OST 7: lixo de teste em producao se ROTULA e
// se FILTRA no painel, NUNCA se apaga, §A.17. Para frente, a propria rodada de
// teste ja nasce rotulada (PONTE_ROTULO_TESTE=1). Este arquivo cuida do que subiu
// antes disso existir.
//
// COMO ELE DECIDE o que e teste, e por que nao adivinha
// ----------------------------------------------------
// Nao olha nome, nao usa heuristica solta. Olha duas evidencias duras:
//   1. a fabrica pertence a uma MAQUINA que nunca existiu de verdade, isto e, uma
//      maquina de rodada de teste, reconhecida pelo proprio identificador que as
//      provas escrevem (maquina-TESTE-... e maquina-teste-...);
//   2. ou o projeto dela aponta para dentro de C:\Users\Henrique\a-fabrica-lab,
//      que e a pasta de rodadas da fabrica, e nao pasta de trabalho do diretor.
// Qualquer coisa fora dessas duas nao e tocada.
//
// §A.18: documento por documento, pelo nome completo. §A.20: projeto explicito.
//
// Uso:
//   node ganchos/rotular-teste.mjs            so olha
//   node ganchos/rotular-teste.mjs --aplicar  rotula

import { execFileSync } from 'node:child_process';
import { collection, getDocs, getFirestore } from 'firebase/firestore';
import { abrirIdentidade } from '../dist/identidade.js';

const PROJETO = 'a-fabrica-soulan';
const APLICAR = process.argv.includes('--aplicar');
const PASTA_DE_RODADAS = 'c:\\users\\henrique\\a-fabrica-lab';

function token() {
  const comSpec = process.env.ComSpec ?? 'cmd.exe';
  const t = execFileSync(comSpec, ['/c', 'gcloud auth print-access-token'], { encoding: 'utf8', windowsHide: true }).trim();
  if (t.length < 20) throw new Error('o gcloud nao devolveu token');
  return t;
}

async function rotular(colecao, docId) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJETO}/databases/(default)/documents/${colecao}/${docId}?updateMask.fieldPaths=teste&updateMask.fieldPaths=rotuladaEm`;
  const r = await fetch(url, {
    method: 'PATCH',
    headers: { authorization: `Bearer ${token()}`, 'x-goog-user-project': PROJETO, 'content-type': 'application/json' },
    body: JSON.stringify({
      fields: {
        teste: { booleanValue: true },
        rotuladaEm: { stringValue: 'rotulada como rodada de teste na retomada da OST 7, por decisao do diretor. Nada foi apagado.' },
      },
    }),
  });
  if (!r.ok) throw new Error(`PATCH ${colecao}/${docId}\nHTTP ${r.status}\n${(await r.text()).slice(0, 300)}`);
}

const id = await abrirIdentidade({ emulador: false, permitirNavegador: false, registrar: () => undefined });
const db = getFirestore(id.app);

const dentroDoLab = (p) => {
  const c = String(p ?? '').toLowerCase().replace(/\//g, '\\');
  return c === PASTA_DE_RODADAS || c.startsWith(PASTA_DE_RODADAS + '\\');
};
const maquinaDeTeste = (m) => /^maquina-teste/i.test(String(m ?? ''));

console.log(`base REAL, projeto ${PROJETO}, explicito, §A.20`);
console.log(APLICAR ? 'modo APLICAR' : 'modo OLHAR, nao escreve nada');
console.log('');

let fabricasRotuladas = 0;
for (const d of (await getDocs(collection(db, 'fabricas'))).docs) {
  const f = d.data();
  if (f.teste === true) {
    console.log(`ja rotulada: ${d.id}`);
    continue;
  }
  const porMaquina = maquinaDeTeste(f.maquinaId);
  // FABRICA QUE O DIRETOR ABRIU NO PAINEL NUNCA E TESTE, e esta linha existe por
  // um erro que a primeira versao deste arquivo ia cometer: a fabrica que ele
  // abriu de verdade apontava para uma pasta dentro de a-fabrica-lab, porque o
  // atalho de pasta do painel oferecia os caminhos das rodadas de teste. Pela
  // regra de projeto, a fabrica dele seria rotulada de teste e escondida da tela
  // dele. O comando de teste escreve origem "painel de teste, ...", nunca
  // "painel" puro, entao os dois dao para distinguir sem adivinhar.
  const abertaPeloDiretor = String(f.origem ?? '').trim().toLowerCase() === 'painel' && !porMaquina;
  const porProjeto = dentroDoLab(f.projeto) && !abertaPeloDiretor;
  if (!porMaquina && !porProjeto) {
    if (abertaPeloDiretor && dentroDoLab(f.projeto)) {
      console.log(`NAO rotulada, aberta pelo diretor no painel: ${d.id}, projeto ${JSON.stringify(f.projeto)}`);
    }
    continue;
  }
  const motivo = porMaquina ? 'maquina de rodada de teste' : 'projeto dentro da pasta de rodadas da fabrica';
  console.log(`rotular fabrica ${d.id}: ${motivo}`);
  fabricasRotuladas++;
  if (APLICAR) await rotular('fabricas', d.id);
}

let maquinasRotuladas = 0;
for (const d of (await getDocs(collection(db, 'maquinas'))).docs) {
  const m = d.data();
  if (m.teste === true) continue;
  if (!maquinaDeTeste(d.id) && !maquinaDeTeste(m.maquinaId)) continue;
  console.log(`rotular maquina ${d.id}: identificador de rodada de teste`);
  maquinasRotuladas++;
  if (APLICAR) await rotular('maquinas', d.id);
}

console.log('');
console.log(`fabricas a rotular: ${fabricasRotuladas}, maquinas a rotular: ${maquinasRotuladas}`);
console.log(APLICAR ? 'rotuladas. Nada apagado, §A.17.' : 'nada escrito. Rode com --aplicar.');
process.exit(0);
