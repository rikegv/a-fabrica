// ver-relatorios.mjs, mostra os relatorios de UMA fabrica, campo por campo. So le.
// Nunca imprime o texto inteiro: so tamanho, hash e as primeiras 80 letras.
// Uso: node ganchos/ver-relatorios.mjs <fabricaId> [--comparar <transcricao.jsonl>]
// Com --comparar, tira da transcricao a ultima mensagem do assistente principal
// (nao isSidechain), passa pela mesma mascara da ponte e compara com o texto gravado.
// Feito pelo tester na OST 13.

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { collection, getDocs, getFirestore, query, where } from 'firebase/firestore';
import { abrirIdentidade } from '../dist/identidade.js';
import { mascarar } from '../dist/mascara.js';

const alvo = process.argv[2];
if (!alvo) {
  console.error('diga o identificador da fabrica');
  process.exit(2);
}
const iComparar = process.argv.indexOf('--comparar');
const transcricao = iComparar > 0 ? process.argv[iComparar + 1] : null;

const hash = (s) => createHash('sha256').update(s, 'utf8').digest('hex').slice(0, 16);

function ultimaDoPrincipal(caminho) {
  const ordem = [];
  const porId = new Map();
  for (const linha of readFileSync(caminho, 'utf8').split('\n')) {
    if (!linha) continue;
    let o;
    try {
      o = JSON.parse(linha);
    } catch {
      continue;
    }
    if (o?.type !== 'assistant' || o.isSidechain === true) continue;
    const m = o.message;
    if (!Array.isArray(m?.content)) continue;
    const id = m.id ?? o.uuid;
    for (const b of m.content) {
      if (b?.type !== 'text' || typeof b.text !== 'string') continue;
      if (!porId.has(id)) {
        porId.set(id, []);
        ordem.push(id);
      }
      porId.get(id).push(b.text);
    }
  }
  if (ordem.length === 0) return null;
  return porId.get(ordem[ordem.length - 1]);
}

const id = await abrirIdentidade({ emulador: false, permitirNavegador: false, registrar: () => undefined });
const db = getFirestore(id.app);
const docs = (await getDocs(query(collection(db, 'relatorios'), where('fabricaId', '==', alvo)))).docs;
console.log(`${docs.length} relatorio(s) da fabrica ${alvo}`);
const partes = transcricao ? ultimaDoPrincipal(transcricao) : null;
if (transcricao) {
  if (partes === null) console.log('transcricao: nenhuma mensagem de texto do principal');
  else {
    const t = partes.join('\n');
    console.log(`transcricao: ultima mensagem do principal em ${partes.length} bloco(s), ${t.length} caracteres, hash ${hash(t)}`);
    const mt = mascarar(t);
    console.log(`  depois da mascara: ${mt.texto.length} caracteres, hash ${hash(mt.texto)}, pegou ${JSON.stringify(mt.pegou ?? mt.padroes ?? Object.keys(mt).filter((k) => k !== 'texto'))}`);
  }
}
for (const d of docs) {
  const r = d.data();
  console.log(`\nrelatorio ${d.id}:`);
  for (const [k, v] of Object.entries(r).sort(([a], [b]) => a.localeCompare(b))) {
    if (k === 'texto') continue;
    const mostrar =
      v !== null && typeof v === 'object' && typeof v.seconds === 'number'
        ? `${new Date(v.seconds * 1000).toISOString()} (hora de servidor)`
        : JSON.stringify(v);
    console.log(`  ${k.padEnd(14)} ${mostrar}`);
  }
  const texto = String(r.texto ?? '');
  console.log(`  texto          ${texto.length} caracteres, hash ${hash(texto)}, comeca ${JSON.stringify(texto.slice(0, 80))}`);
  console.log(`  mascara        ${(texto.match(/\[credencial mascarada\]/g) ?? []).length} troca(s) no texto gravado`);
  if (partes !== null && partes !== undefined) {
    for (const [nome, sep] of [['\\n', '\n'], ['vazio', ''], ['\\n\\n', '\n\n']]) {
      const m = mascarar(partes.join(sep)).texto;
      console.log(`  igual a transcricao mascarada (juntando com ${nome}): ${m === texto}`);
    }
  }
}
process.exit(0);
