// Diagnostico da OST 16: escrita com hora do cliente as vezes passa na regra nova?
// Uso: node diagnostico-hora-forjada.mjs <arquivo-de-regra>
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { readFileSync } from 'node:fs';

const regra = process.argv[2];
const env = await initializeTestEnvironment({ projectId: 'a-fabrica-soulan', firestore: { rules: readFileSync(regra, 'utf8') } });
const db = env.authenticatedContext('uid-diretor', { email: 'henrique.vieira@soulan.com.br', email_verified: true }).firestore();
let passou = 0;
const detalhes = [];
for (let i = 0; i < 60; i++) {
  const quando = new Date();
  try {
    await setDoc(doc(db, `fabricas/diag-${i}`), { fabricaId: `diag-${i}`, atualizadoEm: quando }, { merge: true });
    passou++;
    const lido = await env.withSecurityRulesDisabled(async (c) => (await getDoc(doc(c.firestore(), `fabricas/diag-${i}`))).data());
    detalhes.push(`  ${i}: cliente ${quando.toISOString()} gravado ${lido.atualizadoEm.toDate().toISOString()} nanos ${lido.atualizadoEm.nanoseconds}`);
  } catch {
    // negado, o esperado
  }
}
console.log(`regra: ${regra}`);
console.log(`escritas com hora forjada que PASSARAM: ${passou} de 60`);
for (const d of detalhes) console.log(d);
await env.cleanup();
