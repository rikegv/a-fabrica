// ver-fabrica.mjs, mostra UM documento de fabrica inteiro, campo por campo.
// So le. Uso: node ganchos/ver-fabrica.mjs <fabricaId>

import { collection, doc, getDoc, getDocs, getFirestore } from 'firebase/firestore';
import { abrirIdentidade } from '../dist/identidade.js';

const alvo = process.argv[2];
if (!alvo) {
  console.error('diga o identificador da fabrica');
  process.exit(2);
}
const id = await abrirIdentidade({ emulador: false, permitirNavegador: false, registrar: () => undefined });
const db = getFirestore(id.app);
const d = await getDoc(doc(db, 'fabricas', alvo));
if (!d.exists()) {
  console.log(`a fabrica ${alvo} NAO existe na base`);
  process.exit(0);
}
const f = d.data();
console.log(`fabrica ${alvo}, campo por campo:`);
for (const [k, v] of Object.entries(f).sort(([a], [b]) => a.localeCompare(b))) {
  const mostrar =
    v !== null && typeof v === 'object' && typeof v.seconds === 'number'
      ? `${new Date(v.seconds * 1000).toISOString()} (hora de servidor)`
      : JSON.stringify(v);
  console.log(`  ${k.padEnd(16)} ${mostrar}`);
}
const passos = (await getDocs(collection(db, 'fabricas', alvo, 'atividade'))).docs;
console.log(`\n${passos.length} passo(s):`);
for (const p of passos.map((x) => x.data()).sort((a, b) => (a.seq ?? 0) - (b.seq ?? 0))) {
  console.log(`  seq ${String(p.seq).padEnd(4)} tipo ${String(p.tipo).padEnd(20)} ferramenta ${JSON.stringify(p.ferramenta ?? null)} descricao ${JSON.stringify(String(p.descricao ?? '').slice(0, 80))}`);
}
process.exit(0);
