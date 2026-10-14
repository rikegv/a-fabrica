// listar-base.mjs, so LE a base real e diz o que esta lá dentro.
//
// Serve para o diretor saber o que vai encontrar no painel antes de abrir, e para
// a fabrica nao precisar adivinhar. NAO escreve nada, NAO apaga nada, §A.17.

import { collection, getDocs, getFirestore } from 'firebase/firestore';
import { abrirIdentidade } from '../dist/identidade.js';

const id = await abrirIdentidade({ emulador: false, permitirNavegador: false, registrar: () => undefined });
const db = getFirestore(id.app);

const fabricas = (await getDocs(collection(db, 'fabricas'))).docs;
console.log(`fabricas na base real: ${fabricas.length}`);
for (const d of fabricas) {
  const f = d.data();
  const atividade = (await getDocs(collection(db, 'fabricas', d.id, 'atividade'))).docs.length;
  console.log(
    `  ${d.id}\n    estado ${JSON.stringify(f.estado)}, maquina ${JSON.stringify(f.maquinaId)}, agente ${JSON.stringify(f.agente)}, ${atividade} passo(s), projeto ${JSON.stringify(f.projeto ?? null)}`
  );
}

for (const col of ['maquinas', 'comandos', 'aprovacoes']) {
  const docs = (await getDocs(collection(db, col))).docs;
  console.log(`${col}: ${docs.length}`);
  for (const d of docs.slice(0, 12)) {
    const x = d.data();
    const resumo =
      col === 'maquinas'
        ? `estadoPonte ${JSON.stringify(x.estadoPonte)}`
        : col === 'comandos'
          ? `situacao ${JSON.stringify(x.situacao)}, acao ${JSON.stringify(x.acao ?? null)}`
          : `situacao ${JSON.stringify(x.situacao)}, resposta ${JSON.stringify(x.resposta ?? null)}`;
    console.log(`  ${d.id}: ${resumo}`);
  }
}
process.exit(0);
