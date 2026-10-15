// rastrear-comandos.mjs, so LE a base e conta a vida de cada ordem do painel.
//
// Serve para responder, com dado e nao com suposicao, onde uma ordem do diretor
// morreu: se o painel escreveu, se a regra aceitou, se a ponte leu, se a fabrica
// nasceu. NAO escreve nada, NAO apaga nada.

import { collection, getDocs, getFirestore, orderBy, query } from 'firebase/firestore';
import { abrirIdentidade } from '../dist/identidade.js';

const id = await abrirIdentidade({ emulador: false, permitirNavegador: false, registrar: () => undefined });
const db = getFirestore(id.app);

function hora(v) {
  if (v === null || v === undefined) return 'sem hora';
  if (typeof v === 'object' && typeof v.seconds === 'number') return new Date(v.seconds * 1000).toISOString();
  return String(v);
}

const comandos = (await getDocs(query(collection(db, 'comandos'), orderBy('criadoEm', 'asc')))).docs;
console.log(`comandos na base: ${comandos.length}`);
for (const d of comandos) {
  const c = d.data();
  console.log(`\n${d.id}`);
  console.log(`  criadoEm   ${hora(c.criadoEm)}`);
  console.log(`  origem     ${JSON.stringify(c.origem ?? null)}`);
  console.log(`  acao       ${JSON.stringify(c.acao ?? null)}`);
  console.log(`  situacao   ${JSON.stringify(c.situacao ?? null)}`);
  console.log(`  fabricaId  ${JSON.stringify(c.fabricaId ?? null)}`);
  console.log(`  maquinaId  ${JSON.stringify(c.maquinaId ?? null)}`);
  console.log(`  cwd        ${JSON.stringify(c.cwd ?? null)}`);
  console.log(`  agente     ${JSON.stringify(c.agente ?? null)}, modelo ${JSON.stringify(c.modelo ?? null)}`);
  console.log(`  texto      ${JSON.stringify(String(c.texto ?? '').slice(0, 120))}`);
  console.log(`  entregueEm ${hora(c.entregueEm)}`);
  console.log(`  erro       ${JSON.stringify(c.erro ?? null)}`);
  console.log(`  outras chaves: ${Object.keys(c).join(', ')}`);
}

const maquinas = (await getDocs(collection(db, 'maquinas'))).docs;
console.log(`\nmaquinas: ${maquinas.length}`);
for (const d of maquinas) {
  const m = d.data();
  console.log(`  ${d.id}: estadoPonte ${JSON.stringify(m.estadoPonte)}, vistoEm ${hora(m.vistoPorUltimo ?? m.vistoEm)}`);
}
process.exit(0);
