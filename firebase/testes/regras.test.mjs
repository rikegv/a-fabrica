import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { readFileSync } from 'node:fs';

const DIRETOR = 'henrique.vieira@soulan.com.br';
const env = await initializeTestEnvironment({
  projectId: 'demo-afabrica',
  firestore: { rules: readFileSync('firestore.rules', 'utf8') },
});
const ok = [], fail = [];
const diretor = env.authenticatedContext('uid-diretor', { email: DIRETOR, email_verified: true }).firestore();
const outro = env.authenticatedContext('uid-outro', { email: 'invasor@gmail.com', email_verified: true }).firestore();
const anon = env.unauthenticatedContext().firestore();

async function check(nome, promessa, esperado) {
  try { await (esperado === 'ok' ? assertSucceeds(promessa) : assertFails(promessa)); ok.push(nome); }
  catch (e) { fail.push(`${nome}: ${String(e).slice(0,80)}`); }
}

const cmd = { fabricaId: 'f1', maquinaId: 'm1', texto: 'rodar testes', situacao: 'pendente', criadoEm: new Date(), origem: DIRETOR };
// diretor cria e le comando
await check('diretor cria comando', setDoc(doc(diretor, 'comandos/c1'), cmd), 'ok');
await check('diretor le comando', getDoc(doc(diretor, 'comandos/c1')), 'ok');
// outra conta negada
await check('outra conta NAO le comando', getDoc(doc(outro, 'comandos/c1')), 'fail');
await check('outra conta NAO cria comando', setDoc(doc(outro, 'comandos/c2'), cmd), 'fail');
await check('anonimo NAO le comando', getDoc(doc(anon, 'comandos/c1')), 'fail');
// trilha imutavel: nao pode alterar criadoEm/origem, nao pode apagar
await check('diretor marca entregue (ok)', updateDoc(doc(diretor, 'comandos/c1'), { situacao: 'entregue', entregueEm: new Date() }), 'ok');
await check('NAO altera criadoEm da trilha', updateDoc(doc(diretor, 'comandos/c1'), { criadoEm: new Date(0) }), 'fail');
await check('NAO apaga comando (trilha)', deleteDoc(doc(diretor, 'comandos/c1')), 'fail');
// aprovacao: diretor cria pedido e responde uma vez; outra conta negada
const ap = { fabricaId:'f1', maquinaId:'m1', pacote:{risco:'alto'}, resposta:null, situacao:'pendente', criadoEm:new Date(), origem:'ponte' };
await check('diretor cria aprovacao', setDoc(doc(diretor, 'aprovacoes/a1'), ap), 'ok');
await check('outra conta NAO le aprovacao', getDoc(doc(outro, 'aprovacoes/a1')), 'fail');
await check('diretor responde aprovacao', updateDoc(doc(diretor, 'aprovacoes/a1'), { situacao:'respondida', resposta:'aprovado' }), 'ok');
await check('NAO apaga aprovacao (trilha)', deleteDoc(doc(diretor, 'aprovacoes/a1')), 'fail');

await env.cleanup();
console.log('\n=== REGRAS DO FIRESTORE, emulador ===');
console.log('PASSOU:', ok.length, '| FALHOU:', fail.length);
for (const o of ok) console.log('  OK   ', o);
for (const f of fail) console.log('  FALHA', f);
process.exit(fail.length ? 1 : 0);
