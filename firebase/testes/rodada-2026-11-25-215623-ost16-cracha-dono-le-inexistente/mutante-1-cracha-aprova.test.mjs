// cracha.test.mjs, prova da regra do cracha por maquina, OST 16, no emulador.
//
// Cobre, linha a linha, a tabela "O que o cracha pode, na regra" de
// docs/ost16-contrato.md e as condicoes R1 a R13 da seguranca: o que passa e o que
// e negado. Cobre tambem que o diretor continua podendo o que podia; a prova
// completa do diretor e o regras.test.mjs antigo, que tem de continuar verde.
//
// Conta anonima: env.authenticatedContext(uid, { firebase: { sign_in_provider:
// 'anonymous' } }), que e o que o token de uma conta anonima de verdade carrega.
//
// Pedido vencido: o emulador usa o relogio real em request.time. O pedido vencido
// e semeado com a regra desligada e criadoEm 16 minutos no passado, e o de 14
// minutos idem; a regra compara com o tempo do servidor, como na nuvem.
//
// Rodar:
//   npm install
//   firebase emulators:exec --only firestore --project a-fabrica-soulan "node cracha.test.mjs"
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
  doc, collection, setDoc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  serverTimestamp, query, where, orderBy, increment, deleteField, runTransaction,
  writeBatch, Timestamp, onSnapshot,
} from 'firebase/firestore';
import { readFileSync } from 'node:fs';

const DIRETOR = 'henrique.vieira@soulan.com.br';
const env = await initializeTestEnvironment({
  projectId: 'a-fabrica-soulan',
  firestore: { rules: readFileSync('./rodada-2026-11-25-215623-ost16-cracha-dono-le-inexistente/mutante-1-cracha-aprova.rules', 'utf8') },
});

const ok = [], fail = [];
async function check(nome, promessa, esperado) {
  try { await (esperado === 'ok' ? assertSucceeds(promessa) : assertFails(promessa)); ok.push(nome); }
  catch (e) { fail.push(`${nome} [esperado ${esperado}]: ${String(e).replace(/\s+/g, ' ').slice(0, 160)}`); }
}
const semear = (fn) => env.withSecurityRulesDisabled((ctx) => fn(ctx.firestore()));
const anonimo = (uid) => env.authenticatedContext(uid, { firebase: { sign_in_provider: 'anonymous' } }).firestore();
const ts = () => serverTimestamp();
const minutosAtras = (m) => Timestamp.fromMillis(Date.now() - m * 60 * 1000);
// Hora do cliente claramente diferente da do servidor. Com new Date() o emulador,
// que marca request.time em milissegundos, as vezes empata no mesmo milissegundo e
// a escrita passa: isso nao e falsificacao, e deixava a prova instavel.
const forjada = () => new Date(Date.now() - 60 * 1000);

// --- identidades ---
const diretor = env.authenticatedContext('uid-diretor', { email: DIRETOR, email_verified: true }).firestore();
const outro = env.authenticatedContext('uid-outro', { email: 'invasor@gmail.com', email_verified: true }).firestore();
const naoLogado = env.unauthenticatedContext().firestore();
const cA = anonimo('uid-cracha-a');        // cracha ativo, maquina-a
const cB = anonimo('uid-cracha-b');        // cracha ativo, maquina-b
const cC = anonimo('uid-cracha-c');        // cracha ativo, maquina-c, sem documento de maquina
const cRev = anonimo('uid-cracha-rev');    // cracha revogado, era da maquina-a
const cUidTrocado = anonimo('uid-x');      // documento de cracha com uid de outra conta
const semCracha = anonimo('uid-sem');      // conta anonima sem cracha
// Conta NAO anonima com documento de cracha ativo: o provedor tem de barrar, R1.
const googleComCracha = env.authenticatedContext('uid-google', { email: 'qualquer@gmail.com', email_verified: true, firebase: { sign_in_provider: 'google.com' } }).firestore();

const MA = 'maquina-a', MB = 'maquina-b';
const cracha = (uid, maquinaId, ativo = true) => ({ uid, maquinaId, rotulo: 'notebook', ativo, emitidoEm: Timestamp.now(), emitidoPor: 'painel no computador' });

await semear(async (db) => {
  await setDoc(doc(db, 'crachas/uid-cracha-a'), cracha('uid-cracha-a', MA));
  await setDoc(doc(db, 'crachas/uid-cracha-b'), cracha('uid-cracha-b', MB));
  await setDoc(doc(db, 'crachas/uid-cracha-c'), cracha('uid-cracha-c', 'maquina-c'));
  await setDoc(doc(db, 'crachas/uid-cracha-rev'), { ...cracha('uid-cracha-rev', MA, false), revogadoEm: Timestamp.now(), revogadoPor: 'painel' });
  await setDoc(doc(db, 'crachas/uid-x'), cracha('uid-de-outra-conta', MA));
  await setDoc(doc(db, 'crachas/uid-google'), cracha('uid-google', MA));
  await setDoc(doc(db, 'maquinas/maquina-a'), { maquinaId: MA, estadoPonte: 'online', vistoPorUltimo: Timestamp.now() });
  await setDoc(doc(db, 'maquinas/maquina-b'), { maquinaId: MB, estadoPonte: 'online', vistoPorUltimo: Timestamp.now() });
  await setDoc(doc(db, 'fabricas/fa1'), { fabricaId: 'fa1', maquinaId: MA, estado: 'em execucao', atualizadoEm: Timestamp.now() });
  await setDoc(doc(db, 'fabricas/fb1'), { fabricaId: 'fb1', maquinaId: MB, estado: 'em execucao', atualizadoEm: Timestamp.now() });
  await setDoc(doc(db, 'fabricas/fsem'), { fabricaId: 'fsem', estado: 'concluida', atualizadoEm: Timestamp.now() });
  await setDoc(doc(db, 'fabricas/fa1/atividade/p1'), { seq: 0, tipo: 'texto', em: Timestamp.now() });
  await setDoc(doc(db, 'fabricas/fb1/atividade/p1'), { seq: 0, tipo: 'texto', em: Timestamp.now() });
  await setDoc(doc(db, 'fabricas/fa1/tarefas/t1'), { tarefaId: 't1', situacao: 'em andamento' });
  await setDoc(doc(db, 'fabricas/fb1/tarefas/t1'), { tarefaId: 't1', situacao: 'em andamento' });
  const cmd = (fabricaId, maquinaId) => ({ fabricaId, maquinaId, texto: 'rodar', situacao: 'pendente', criadoEm: Timestamp.now(), origem: 'painel no computador, ' + DIRETOR, acao: 'comando' });
  for (const id of ['ca1', 'ca2', 'ca3', 'ca4', 'ca5']) await setDoc(doc(db, 'comandos/' + id), cmd('fa1', MA));
  await setDoc(doc(db, 'comandos/cb1'), cmd('fb1', MB));
  const pend = (fabricaId, maquinaId) => ({ aprovacaoId: 'x', fabricaId, maquinaId, pacote: { risco: { valor: 'alto' } }, situacao: 'pendente', resposta: null, observacao: null, respondidoEm: null, respondidoPor: null, criadoEm: Timestamp.now(), origem: 'ponte' });
  for (const id of ['aa1', 'aa2', 'aa3', 'aa4', 'aa5', 'aa6', 'aa7']) await setDoc(doc(db, 'aprovacoes/' + id), pend('fa1', MA));
  await setDoc(doc(db, 'aprovacoes/ab1'), pend('fb1', MB));
  await setDoc(doc(db, 'relatorios/ra1'), { id: 'ra1', tipo: 'fechamento', fabricaId: 'fa1', maquinaId: MA, criadoEm: Timestamp.now() });
  await setDoc(doc(db, 'relatorios/rb1'), { id: 'rb1', tipo: 'fechamento', fabricaId: 'fb1', maquinaId: MB, criadoEm: Timestamp.now() });
  // Pedidos de cracha para a emissao pelo diretor.
  const ped = (uid, maquinaId, criadoEm) => ({ uid, maquinaId, nome: 'NOTEBOOK-RIKE', rotulo: 'notebook', codigo: '123456', criadoEm });
  await setDoc(doc(db, 'pedidosDeCracha/uid-vencido'), ped('uid-vencido', 'maquina-v', minutosAtras(16)));
  await setDoc(doc(db, 'pedidosDeCracha/uid-14min'), ped('uid-14min', 'maquina-q', minutosAtras(14)));
  await setDoc(doc(db, 'pedidosDeCracha/uid-troca'), ped('uid-troca', 'maquina-t', Timestamp.now()));
  await setDoc(doc(db, 'pedidosDeCracha/uid-lote-velho'), ped('uid-lote-velho', 'maquina-l', Timestamp.now()));
  await setDoc(doc(db, 'pedidosDeCracha/uid-lote-novo'), ped('uid-lote-novo', 'maquina-l', Timestamp.now()));
});

console.log('=== CRACHA POR MAQUINA, OST 16, emulador, projeto a-fabrica-soulan ===');
console.log('Momento: ' + new Date().toISOString());

// ------------------------------------------------------------- 1. maquinas, R10
const bater = (maquinaId, extra = {}) => ({ maquinaId, estadoPonte: 'online', vistoPorUltimo: ts(), versaoPonte: '0.16.0', ...extra });
await check('1.1 cracha A bate heartbeat da propria maquina PASSA', setDoc(doc(cA, 'maquinas/maquina-a'), bater(MA), { merge: true }), 'ok');
await check('1.2 cracha A marca offline sem mandar maquinaId PASSA', setDoc(doc(cA, 'maquinas/maquina-a'), { estadoPonte: 'offline', vistoPorUltimo: ts() }, { merge: true }), 'ok');
await check('1.3 cracha A bate heartbeat na maquina B NEGADO', setDoc(doc(cA, 'maquinas/maquina-b'), bater(MB), { merge: true }), 'fail');
await check('1.4 cracha A grava maquinaId diferente do id NEGADO', setDoc(doc(cA, 'maquinas/maquina-a'), bater(MB), { merge: true }), 'fail');
await check('1.5 cracha A heartbeat com hora forjada NEGADO', setDoc(doc(cA, 'maquinas/maquina-a'), { ...bater(MA), vistoPorUltimo: forjada() }, { merge: true }), 'fail');
await check('1.6 cracha A estado de ponte fora da lista NEGADO', setDoc(doc(cA, 'maquinas/maquina-a'), bater(MA, { estadoPonte: 'quase' }), { merge: true }), 'fail');
await check('1.7 cracha A le a propria maquina PASSA', getDoc(doc(cA, 'maquinas/maquina-a')), 'ok');
await check('1.8 cracha A le a maquina B NEGADO', getDoc(doc(cA, 'maquinas/maquina-b')), 'fail');
await check('1.9 cracha C le a propria maquina ainda inexistente NEGADO (R8)', getDoc(doc(cC, 'maquinas/maquina-c')), 'fail');
await check('1.10 cracha C cria a propria maquina PASSA', setDoc(doc(cC, 'maquinas/maquina-c'), bater('maquina-c'), { merge: true }), 'ok');
await check('1.11 cracha A lista maquinas filtrando a propria PASSA', getDocs(query(collection(cA, 'maquinas'), where('maquinaId', '==', MA))), 'ok');
await check('1.12 cracha A lista maquinas SEM filtro NEGADO (R9)', getDocs(collection(cA, 'maquinas')), 'fail');
await check('1.13 cracha A lista maquinas filtrando a B NEGADO', getDocs(query(collection(cA, 'maquinas'), where('maquinaId', '==', MB))), 'fail');
await check('1.14 cracha A apaga a propria maquina NEGADO', deleteDoc(doc(cA, 'maquinas/maquina-a')), 'fail');

// ------------------------------------------------------------- 2. fabricas, R3 R7 R8
await check('2.1 cracha A le fabrica da propria maquina PASSA', getDoc(doc(cA, 'fabricas/fa1')), 'ok');
await check('2.2 cracha A le fabrica da maquina B NEGADO', getDoc(doc(cA, 'fabricas/fb1')), 'fail');
await check('2.3 cracha A le fabrica inexistente PASSA (R8)', getDoc(doc(cA, 'fabricas/nao-existe')), 'ok');
await check('2.4 cracha A le fabrica sem maquinaId NEGADO', getDoc(doc(cA, 'fabricas/fsem')), 'fail');
await check('2.5 cracha A lista fabricas da propria maquina em execucao PASSA (reconciliacao)', getDocs(query(collection(cA, 'fabricas'), where('maquinaId', '==', MA), where('estado', '==', 'em execucao'))), 'ok');
await check('2.6 cracha A lista fabricas SEM filtro de maquina NEGADO (R9)', getDocs(query(collection(cA, 'fabricas'), orderBy('atualizadoEm', 'desc'))), 'fail');
await check('2.7 cracha A lista fabricas da maquina B NEGADO', getDocs(query(collection(cA, 'fabricas'), where('maquinaId', '==', MB))), 'fail');
await check('2.8 cracha A cria fabrica com maquinaId e fabricaId certos PASSA (R7)', setDoc(doc(cA, 'fabricas/painel-nova'), { fabricaId: 'painel-nova', maquinaId: MA, estado: 'em execucao', atualizadoEm: ts() }, { merge: true }), 'ok');
await check('2.9 cracha A cria fabrica mao- com maquinaId PASSA (R7)', setDoc(doc(cA, 'fabricas/mao-sid1'), { fabricaId: 'mao-sid1', maquinaId: MA, projeto: 'c:/p', atualizadoEm: ts() }, { merge: true }), 'ok');
await check('2.10 cracha A cria fabrica SEM maquinaId NEGADO (R7)', setDoc(doc(cA, 'fabricas/mao-sid2'), { fabricaId: 'mao-sid2', estado: 'em execucao', atualizadoEm: ts() }, { merge: true }), 'fail');
await check('2.11 cracha A cria fabrica com maquinaId da B NEGADO', setDoc(doc(cA, 'fabricas/mao-sid3'), { fabricaId: 'mao-sid3', maquinaId: MB, atualizadoEm: ts() }, { merge: true }), 'fail');
await check('2.12 cracha A cria fabrica com fabricaId diferente do id NEGADO (R7)', setDoc(doc(cA, 'fabricas/mao-sid4'), { fabricaId: 'outra', maquinaId: MA, atualizadoEm: ts() }, { merge: true }), 'fail');
await check('2.13 cracha A cria fabrica sem fabricaId NEGADO (R7)', setDoc(doc(cA, 'fabricas/mao-sid5'), { maquinaId: MA, atualizadoEm: ts() }, { merge: true }), 'fail');
await check('2.14 cracha A atualiza estado da propria fabrica PASSA (atualizarFabrica)', setDoc(doc(cA, 'fabricas/fa1'), { fabricaId: 'fa1', atualizadoEm: ts(), estado: 'aguardando aprovacao' }, { merge: true }), 'ok');
await check('2.15 cracha A soma consumo na propria fabrica PASSA (somarConsumoDaFabrica)', setDoc(doc(cA, 'fabricas/fa1'), { fabricaId: 'fa1', atualizadoEm: ts(), consumo: { entrada: increment(10) }, consumoPorDia: { '2026-11-25': { entrada: increment(10) } } }, { merge: true }), 'ok');
await check('2.16 cracha A troca maquinaId da propria fabrica NEGADO (R3)', setDoc(doc(cA, 'fabricas/fa1'), { fabricaId: 'fa1', maquinaId: MB, atualizadoEm: ts() }, { merge: true }), 'fail');
await check('2.17 cracha A apaga maquinaId da propria fabrica NEGADO (R3)', updateDoc(doc(cA, 'fabricas/fa1'), { maquinaId: deleteField(), atualizadoEm: ts() }), 'fail');
await check('2.18 cracha A troca fabricaId da propria fabrica NEGADO (R3)', setDoc(doc(cA, 'fabricas/fa1'), { fabricaId: 'outra', atualizadoEm: ts() }, { merge: true }), 'fail');
await check('2.19 cracha A apaga fabricaId da propria fabrica NEGADO (R3)', updateDoc(doc(cA, 'fabricas/fa1'), { fabricaId: deleteField(), atualizadoEm: ts() }), 'fail');
await check('2.20 cracha A atualiza fabrica da maquina B NEGADO', setDoc(doc(cA, 'fabricas/fb1'), { fabricaId: 'fb1', atualizadoEm: ts(), estado: 'concluida' }, { merge: true }), 'fail');
await check('2.21 cracha A "adota" fabrica sem maquinaId NEGADO', setDoc(doc(cA, 'fabricas/fsem'), { fabricaId: 'fsem', maquinaId: MA, atualizadoEm: ts() }, { merge: true }), 'fail');
await check('2.22 cracha A atualiza com hora forjada NEGADO', setDoc(doc(cA, 'fabricas/fa1'), { fabricaId: 'fa1', atualizadoEm: forjada() }, { merge: true }), 'fail');
await check('2.23 cracha A apaga fabrica NEGADO', deleteDoc(doc(cA, 'fabricas/fa1')), 'fail');

// --------------------------------------------- 3. atividade e tarefas, R6
await check('3.1 cracha A adiciona passo na propria fabrica PASSA', addDoc(collection(cA, 'fabricas/fa1/atividade'), { seq: 1, tipo: 'texto', ferramenta: null, em: ts() }), 'ok');
await check('3.2 cracha A adiciona passo na fabrica da B NEGADO', addDoc(collection(cA, 'fabricas/fb1/atividade'), { seq: 1, tipo: 'texto', em: ts() }), 'fail');
await check('3.3 cracha A adiciona passo em fabrica inexistente NEGADO', addDoc(collection(cA, 'fabricas/nao-existe/atividade'), { seq: 1, em: ts() }), 'fail');
await check('3.4 cracha A passo com hora forjada NEGADO', addDoc(collection(cA, 'fabricas/fa1/atividade'), { seq: 2, em: forjada() }), 'fail');
await check('3.5 cracha A le atividade da propria fabrica PASSA', getDocs(query(collection(cA, 'fabricas/fa1/atividade'), orderBy('seq', 'asc'))), 'ok');
await check('3.6 cracha A le atividade da fabrica da B NEGADO', getDocs(collection(cA, 'fabricas/fb1/atividade')), 'fail');
await check('3.7 cracha A altera passo NEGADO', updateDoc(doc(cA, 'fabricas/fa1/atividade/p1'), { seq: 99 }), 'fail');
await check('3.8 cracha A apaga passo NEGADO', deleteDoc(doc(cA, 'fabricas/fa1/atividade/p1')), 'fail');
await check('3.9 cracha A cria tarefa na propria fabrica PASSA', setDoc(doc(cA, 'fabricas/fa1/tarefas/t2'), { tarefaId: 't2', situacao: 'em andamento' }), 'ok');
await check('3.10 cracha A muda tarefa na propria fabrica PASSA', updateDoc(doc(cA, 'fabricas/fa1/tarefas/t2'), { situacao: 'concluida' }), 'ok');
await check('3.11 cracha A le tarefa da propria fabrica PASSA', getDoc(doc(cA, 'fabricas/fa1/tarefas/t1')), 'ok');
await check('3.12 cracha A cria tarefa na fabrica da B NEGADO', setDoc(doc(cA, 'fabricas/fb1/tarefas/t2'), { tarefaId: 't2' }), 'fail');
await check('3.13 cracha A muda tarefa da fabrica da B NEGADO', updateDoc(doc(cA, 'fabricas/fb1/tarefas/t1'), { situacao: 'x' }), 'fail');
await check('3.14 cracha A le tarefas da fabrica da B NEGADO', getDocs(collection(cA, 'fabricas/fb1/tarefas')), 'fail');
await check('3.15 cracha A apaga tarefa NEGADO', deleteDoc(doc(cA, 'fabricas/fa1/tarefas/t1')), 'fail');
await check('3.16 cracha A subcolecao desconhecida NEGADO', setDoc(doc(cA, 'fabricas/fa1/segredos/x'), { a: 1 }), 'fail');

// ------------------------------------------------------------- 4. comandos, R3
await check('4.1 cracha A le comando da propria maquina PASSA', getDoc(doc(cA, 'comandos/ca1')), 'ok');
await check('4.2 cracha A le comando da maquina B NEGADO', getDoc(doc(cA, 'comandos/cb1')), 'fail');
await check('4.3 cracha A le comando inexistente NEGADO (R8)', getDoc(doc(cA, 'comandos/nao-existe')), 'fail');
await check('4.4 cracha A lista pendentes da propria maquina PASSA (ouvirComandos)', getDocs(query(collection(cA, 'comandos'), where('maquinaId', '==', MA), where('situacao', '==', 'pendente'))), 'ok');
await check('4.5 cracha A lista pendentes SEM filtro de maquina NEGADO (R9)', getDocs(query(collection(cA, 'comandos'), where('situacao', '==', 'pendente'))), 'fail');
await check('4.6 cracha A lista comandos da maquina B NEGADO', getDocs(query(collection(cA, 'comandos'), where('maquinaId', '==', MB))), 'fail');
await check('4.7 cracha A cria comando NEGADO (nunca cria)', addDoc(collection(cA, 'comandos'), { fabricaId: 'fa1', maquinaId: MA, texto: 'x', situacao: 'pendente', criadoEm: ts(), origem: 'ponte' }), 'fail');
await check('4.8 cracha A marca entregue pela transacao da ponte PASSA (tomarComando)', runTransaction(cA, async (tx) => {
  const ref = doc(cA, 'comandos/ca1');
  const s = await tx.get(ref);
  if (!s.exists()) throw new Error('comando sumiu');
  tx.update(ref, { situacao: 'entregue', entregueEm: ts() });
}), 'ok');
await check('4.9 cracha A marca entregue DE NOVO NEGADO', updateDoc(doc(cA, 'comandos/ca1'), { situacao: 'entregue', entregueEm: ts() }), 'fail');
await check('4.10 cracha A marca entregue comando da B NEGADO', updateDoc(doc(cA, 'comandos/cb1'), { situacao: 'entregue', entregueEm: ts() }), 'fail');
await check('4.11 cracha A entregue com campo a mais NEGADO (R3)', updateDoc(doc(cA, 'comandos/ca2'), { situacao: 'entregue', entregueEm: ts(), nota: 'x' }), 'fail');
await check('4.12 cracha A entregue trocando maquinaId NEGADO', updateDoc(doc(cA, 'comandos/ca2'), { situacao: 'entregue', entregueEm: ts(), maquinaId: MB }), 'fail');
await check('4.13 cracha A entregue com hora forjada NEGADO', updateDoc(doc(cA, 'comandos/ca2'), { situacao: 'entregue', entregueEm: forjada() }), 'fail');
await check('4.14 cracha A muda o texto do comando NEGADO', updateDoc(doc(cA, 'comandos/ca2'), { texto: 'outro' }), 'fail');
await check('4.15 cracha A apaga comando NEGADO', deleteDoc(doc(cA, 'comandos/ca2')), 'fail');
await check('4.16 cracha A entregue simples PASSA', updateDoc(doc(cA, 'comandos/ca2'), { situacao: 'entregue', entregueEm: ts() }), 'ok');

// ------------------------------------------------------------ 5. aprovacoes, R4 R6
const pedido = (fabricaId, maquinaId, id) => ({ aprovacaoId: id, situacao: 'pendente', resposta: null, observacao: null, respondidoEm: null, respondidoPor: null, criadoEm: ts(), fabricaId, maquinaId, origem: 'ponte', pacote: { risco: { valor: 'alto', origem: 'ponte' } } });
const recusa = (motivo, maquinaId, extra = {}) => ({ situacao: 'respondida', resposta: 'recusado', observacao: 'recusa por seguranca', respondidoEm: ts(), respondidoPor: `ponte, ${motivo}, ${maquinaId}`, ...extra });
await check('5.1 cracha A cria pedido pendente da propria maquina PASSA (publicarAprovacao)', setDoc(doc(cA, 'aprovacoes/u-1'), pedido('fa1', MA, 'u-1')), 'ok');
await check('5.2 cracha A cria pedido com maquinaId da B NEGADO', setDoc(doc(cA, 'aprovacoes/u-2'), pedido('fb1', MB, 'u-2')), 'fail');
await check('5.3 cracha A cria pedido da propria maquina para fabrica da B NEGADO (R6)', setDoc(doc(cA, 'aprovacoes/u-3'), pedido('fb1', MA, 'u-3')), 'fail');
await check('5.4 cracha A cria pedido para fabrica inexistente NEGADO (R6)', setDoc(doc(cA, 'aprovacoes/u-4'), pedido('nao-existe', MA, 'u-4')), 'fail');
await check('5.5 cracha A cria pedido ja respondido NEGADO', setDoc(doc(cA, 'aprovacoes/u-5'), { ...pedido('fa1', MA, 'u-5'), situacao: 'respondida', resposta: 'aprovado' }), 'fail');
await check('5.6 cracha A cria pedido com hora forjada NEGADO', setDoc(doc(cA, 'aprovacoes/u-6'), { ...pedido('fa1', MA, 'u-6'), criadoEm: forjada() }), 'fail');
await check('5.7 cracha A le pedido da propria maquina PASSA (esperarResposta)', getDoc(doc(cA, 'aprovacoes/u-1')), 'ok');
await check('5.8 cracha A le pedido da maquina B NEGADO', getDoc(doc(cA, 'aprovacoes/ab1')), 'fail');
await check('5.9 cracha A le pedido inexistente NEGADO (R8)', getDoc(doc(cA, 'aprovacoes/nao-existe')), 'fail');
await check('5.10 cracha A lista pendentes da propria maquina PASSA (reconciliacao)', getDocs(query(collection(cA, 'aprovacoes'), where('maquinaId', '==', MA), where('situacao', '==', 'pendente'))), 'ok');
await check('5.11 cracha A lista por fabricaId SEM maquinaId NEGADO (R9, P3)', getDocs(query(collection(cA, 'aprovacoes'), where('fabricaId', '==', 'fa1'), where('situacao', '==', 'pendente'))), 'fail');
await check('5.12 cracha A lista por fabricaId COM maquinaId PASSA (P3)', getDocs(query(collection(cA, 'aprovacoes'), where('maquinaId', '==', MA), where('fabricaId', '==', 'fa1'), where('situacao', '==', 'pendente'))), 'ok');
await check('5.13 cracha A lista aprovacoes da B NEGADO', getDocs(query(collection(cA, 'aprovacoes'), where('maquinaId', '==', MB))), 'fail');
await check('5.14 cracha A APROVA NEGADO (R4)', updateDoc(doc(cA, 'aprovacoes/aa1'), recusa('tempo esgotado', MA, { resposta: 'aprovado' })), 'fail');
await check('5.15 cracha A aprova com observacao NEGADO (R4)', updateDoc(doc(cA, 'aprovacoes/aa1'), recusa('tempo esgotado', MA, { resposta: 'aprovado com observacao', observacao: 'siga' })), 'fail');
await check('5.16 cracha A recusa com respondidoPor antigo, com e-mail, NEGADO (R4)', updateDoc(doc(cA, 'aprovacoes/aa1'), recusa('tempo esgotado', DIRETOR)), 'fail');
await check('5.17 cracha A recusa assinando com a maquina B NEGADO (R4)', updateDoc(doc(cA, 'aprovacoes/aa1'), recusa('tempo esgotado', MB)), 'fail');
await check('5.18 cracha A recusa com motivo fora da lista NEGADO (R4)', updateDoc(doc(cA, 'aprovacoes/aa1'), recusa('porque sim', MA)), 'fail');
await check('5.19 cracha A recusa com espaco a mais no fim NEGADO (formato exato)', updateDoc(doc(cA, 'aprovacoes/aa1'), recusa('tempo esgotado', MA + ' ')), 'fail');
await check('5.20 cracha A recusa com respondidoPor em maiusculas NEGADO', updateDoc(doc(cA, 'aprovacoes/aa1'), { ...recusa('tempo esgotado', MA), respondidoPor: 'Ponte, tempo esgotado, ' + MA }), 'fail');
await check('5.21 cracha A recusa com observacao de 301 caracteres NEGADO (R4)', updateDoc(doc(cA, 'aprovacoes/aa1'), recusa('tempo esgotado', MA, { observacao: 'x'.repeat(301) })), 'fail');
await check('5.22 cracha A recusa sem observacao NEGADO (R4)', updateDoc(doc(cA, 'aprovacoes/aa1'), recusa('tempo esgotado', MA, { observacao: null })), 'fail');
await check('5.23 cracha A recusa com hora forjada NEGADO (R4)', updateDoc(doc(cA, 'aprovacoes/aa1'), recusa('tempo esgotado', MA, { respondidoEm: forjada() })), 'fail');
await check('5.24 cracha A recusa reescrevendo o pacote NEGADO (R3)', updateDoc(doc(cA, 'aprovacoes/aa1'), recusa('tempo esgotado', MA, { pacote: { risco: { valor: 'baixo' } } })), 'fail');
await check('5.25 cracha A recusa com campo a mais NEGADO (R3)', updateDoc(doc(cA, 'aprovacoes/aa1'), recusa('tempo esgotado', MA, { nota: 'x' })), 'fail');
await check('5.26 cracha A recusa trocando maquinaId NEGADO (R3)', updateDoc(doc(cA, 'aprovacoes/aa1'), recusa('tempo esgotado', MA, { maquinaId: MB })), 'fail');
await check('5.27 cracha A recusa pedido da maquina B NEGADO', updateDoc(doc(cA, 'aprovacoes/ab1'), recusa('tempo esgotado', MA)), 'fail');
await check('5.28 cracha B recusa pedido da maquina A, assinando como B, NEGADO', updateDoc(doc(cB, 'aprovacoes/aa1'), recusa('tempo esgotado', MB)), 'fail');
await check('5.29 cracha A recusa por tempo esgotado, formato exato, PASSA (R4)', updateDoc(doc(cA, 'aprovacoes/aa1'), recusa('tempo esgotado', MA, { observacao: 'recusa por tempo esgotado, nao resposta do diretor: ninguem respondeu em 300 segundo(s), a ponte negou por seguranca e nada executou, §A.6' })), 'ok');
await check('5.30 cracha A recusa por reconciliacao PASSA (R4)', updateDoc(doc(cA, 'aprovacoes/aa2'), recusa('reconciliacao', MA, { observacao: 'ponte reiniciou, sessao encerrada, recusa por seguranca' })), 'ok');
await check('5.31 cracha A recusa por ordem do diretor pelo painel PASSA (R4)', updateDoc(doc(cA, 'aprovacoes/aa3'), recusa('ordem do diretor pelo painel', MA)), 'ok');
await check('5.32 cracha A recusa observacao de 300 caracteres PASSA (limite)', updateDoc(doc(cA, 'aprovacoes/aa4'), recusa('tempo esgotado', MA, { observacao: 'x'.repeat(300) })), 'ok');
await check('5.33 cracha A recusa DE NOVO pedido ja respondido NEGADO', updateDoc(doc(cA, 'aprovacoes/aa1'), recusa('reconciliacao', MA)), 'fail');
await check('5.34 cracha A apaga aprovacao NEGADO', deleteDoc(doc(cA, 'aprovacoes/aa5')), 'fail');
await check('5.35 diretor responde aprovado pelo painel com respondidoPor painel PASSA (R5)', updateDoc(doc(diretor, 'aprovacoes/aa5'), { situacao: 'respondida', resposta: 'aprovado', observacao: null, respondidoEm: ts(), respondidoPor: 'painel no computador, ' + DIRETOR }), 'ok');
await check('5.36 ponte antiga, como diretor, recusa com o formato de hoje PASSA', updateDoc(doc(diretor, 'aprovacoes/aa6'), { situacao: 'respondida', resposta: 'recusado', observacao: 'x', respondidoEm: ts(), respondidoPor: 'ponte, tempo esgotado, ' + DIRETOR }), 'ok');

// ------------------------------------------------------------ 6. relatorios, R6 R8
const fech = (fabricaId, maquinaId, id) => ({ tipo: 'fechamento', fabricaId, maquinaId, projeto: 'c:/p', titulo: null, texto: 'feito', rodadaInicio: null, rodadaFim: '2026-11-25T10:00:00Z', dia: '2026-11-25', origem: 'painel', fonteDoTexto: 'kit', cortado: false, marcas: [], id, versao: 1, criadoEm: ts() });
await check('6.1 cracha A le relatorio inexistente PASSA (R8, gravarRelatorio le antes)', getDoc(doc(cA, 'relatorios/nao-existe')), 'ok');
await check('6.2 cracha A le relatorio da propria maquina PASSA', getDoc(doc(cA, 'relatorios/ra1')), 'ok');
await check('6.3 cracha A le relatorio da maquina B NEGADO', getDoc(doc(cA, 'relatorios/rb1')), 'fail');
await check('6.4 cracha A lista por fabricaId SEM maquinaId NEGADO (R9, P3)', getDocs(query(collection(cA, 'relatorios'), where('fabricaId', '==', 'fa1'))), 'fail');
await check('6.5 cracha A lista por fabricaId COM maquinaId PASSA (passadaDoDiario com P3)', getDocs(query(collection(cA, 'relatorios'), where('maquinaId', '==', MA), where('fabricaId', '==', 'fa1'))), 'ok');
await check('6.6 cracha A lista relatorios da B NEGADO', getDocs(query(collection(cA, 'relatorios'), where('maquinaId', '==', MB))), 'fail');
await check('6.7 cracha A cria fechamento da propria maquina PASSA', setDoc(doc(cA, 'relatorios/ra2'), fech('fa1', MA, 'ra2')), 'ok');
await check('6.8 cracha A cria diario da propria maquina PASSA', setDoc(doc(cA, 'relatorios/ra3'), { tipo: 'diario', fabricaId: 'fa1', maquinaId: MA, dia: '2026-11-25', conteudo: { feito: 'x' }, id: 'ra3', versao: 1, criadoEm: ts() }), 'ok');
await check('6.9 cracha A cria relatorio com maquinaId da B NEGADO', setDoc(doc(cA, 'relatorios/ra4'), fech('fb1', MB, 'ra4')), 'fail');
await check('6.10 cracha A cria relatorio da propria maquina para fabrica da B NEGADO (R6)', setDoc(doc(cA, 'relatorios/ra5'), fech('fb1', MA, 'ra5')), 'fail');
await check('6.11 cracha A cria relatorio sem maquinaId NEGADO', setDoc(doc(cA, 'relatorios/ra6'), { tipo: 'fechamento', fabricaId: 'fa1', criadoEm: ts() }), 'fail');
await check('6.12 cracha A cria relatorio sem fabricaId NEGADO (R6)', setDoc(doc(cA, 'relatorios/ra7'), { tipo: 'diario', maquinaId: MA, criadoEm: ts() }), 'fail');
await check('6.13 cracha A relatorio com hora forjada NEGADO', setDoc(doc(cA, 'relatorios/ra8'), { ...fech('fa1', MA, 'ra8'), criadoEm: forjada() }), 'fail');
await check('6.14 cracha A altera relatorio NEGADO', updateDoc(doc(cA, 'relatorios/ra2'), { texto: 'reescrito' }), 'fail');
await check('6.15 cracha A apaga relatorio NEGADO', deleteDoc(doc(cA, 'relatorios/ra2')), 'fail');

// ------------------------------------------- 7. crachas e pedidos, vistos pelo cracha
await check('7.1 cracha A le o proprio cracha PASSA', getDoc(doc(cA, 'crachas/uid-cracha-a')), 'ok');
await check('7.2 cracha A le o cracha da B NEGADO', getDoc(doc(cA, 'crachas/uid-cracha-b')), 'fail');
await check('7.3 cracha A lista crachas NEGADO', getDocs(collection(cA, 'crachas')), 'fail');
await check('7.4 cracha A mexe no proprio cracha NEGADO', updateDoc(doc(cA, 'crachas/uid-cracha-a'), { maquinaId: MB }), 'fail');
await check('7.5 cracha A cria cracha para outra conta NEGADO', setDoc(doc(cA, 'crachas/uid-novo'), cracha('uid-novo', MA)), 'fail');
await check('7.6 cracha A le pedidos de cracha NEGADO', getDocs(collection(cA, 'pedidosDeCracha')), 'fail');
await check('7.7 cracha A colecao fora do modelo NEGADO', setDoc(doc(cA, 'segredos/x'), { a: 1 }), 'fail');

// ---------------------------------------------------- 8. cracha revogado, R2
await check('8.1 cracha revogado le o proprio documento PASSA (a ponte sabe que caiu)', getDoc(doc(cRev, 'crachas/uid-cracha-rev')), 'ok');
await check('8.2 cracha revogado bate heartbeat NEGADO', setDoc(doc(cRev, 'maquinas/maquina-a'), bater(MA), { merge: true }), 'fail');
await check('8.3 cracha revogado le fabrica NEGADO', getDoc(doc(cRev, 'fabricas/fa1')), 'fail');
await check('8.4 cracha revogado le fabrica inexistente NEGADO', getDoc(doc(cRev, 'fabricas/nao-existe')), 'fail');
await check('8.5 cracha revogado lista comandos NEGADO', getDocs(query(collection(cRev, 'comandos'), where('maquinaId', '==', MA))), 'fail');
await check('8.6 cracha revogado cria aprovacao NEGADO', setDoc(doc(cRev, 'aprovacoes/u-r1'), pedido('fa1', MA, 'u-r1')), 'fail');
await check('8.7 cracha revogado recusa aprovacao NEGADO', updateDoc(doc(cRev, 'aprovacoes/aa7'), recusa('tempo esgotado', MA)), 'fail');
await check('8.8 cracha revogado cria relatorio NEGADO', setDoc(doc(cRev, 'relatorios/rr1'), fech('fa1', MA, 'rr1')), 'fail');

// ---------------------------------------- 9. cracha de outra maquina e cracha torto
await check('9.1 cracha B bate heartbeat da maquina A NEGADO', setDoc(doc(cB, 'maquinas/maquina-a'), bater(MA), { merge: true }), 'fail');
await check('9.2 cracha B le fabrica da A NEGADO', getDoc(doc(cB, 'fabricas/fa1')), 'fail');
await check('9.3 cracha B atualiza fabrica da A NEGADO', setDoc(doc(cB, 'fabricas/fa1'), { fabricaId: 'fa1', atualizadoEm: ts() }, { merge: true }), 'fail');
await check('9.4 cracha B lista comandos da A NEGADO', getDocs(query(collection(cB, 'comandos'), where('maquinaId', '==', MA))), 'fail');
await check('9.5 cracha B marca entregue comando da A NEGADO', updateDoc(doc(cB, 'comandos/ca3'), { situacao: 'entregue', entregueEm: ts() }), 'fail');
await check('9.6 cracha B le aprovacao da A NEGADO', getDoc(doc(cB, 'aprovacoes/aa7')), 'fail');
await check('9.7 cracha B adiciona passo na fabrica da A NEGADO', addDoc(collection(cB, 'fabricas/fa1/atividade'), { seq: 9, em: ts() }), 'fail');
await check('9.8 conta Google com documento de cracha ativo NEGADO (provedor, R1)', setDoc(doc(googleComCracha, 'maquinas/maquina-a'), bater(MA), { merge: true }), 'fail');
await check('9.9 conta Google com documento de cracha le fabrica NEGADO', getDoc(doc(googleComCracha, 'fabricas/fa1')), 'fail');
await check('9.10 cracha cujo documento traz outro uid NEGADO (R2)', setDoc(doc(cUidTrocado, 'maquinas/maquina-a'), bater(MA), { merge: true }), 'fail');
await check('9.11 cracha cujo documento traz outro uid le comando NEGADO (R2)', getDoc(doc(cUidTrocado, 'comandos/ca3')), 'fail');

// ------------------------------------------- 10. conta anonima sem cracha, R11 R13
const pedidoDe = (uid, extra = {}) => ({ uid, maquinaId: 'maquina-nova', nome: 'NOTEBOOK-RIKE', rotulo: 'notebook do escritorio', codigo: '048213', criadoEm: ts(), ...extra });
// Ajuste pedido pelo coordenador depois do achado da ponte: o dono le o PROPRIO
// cracha mesmo antes de existir (a ponte espera a emissao lendo esse documento).
// A conferencia e so provedor anonimo e uid da conta igual ao id, sem tocar no
// documento. Excecao declarada a R8, que fica valendo para todo o resto.
await check('10.1 sem cracha le o proprio cracha ainda inexistente PASSA (dono, antes da emissao)', getDoc(doc(semCracha, 'crachas/uid-sem')), 'ok');
await check('10.1b sem cracha le cracha inexistente de OUTRA conta NEGADO', getDoc(doc(semCracha, 'crachas/uid-ninguem')), 'fail');
await check('10.1c conta Google le o proprio cracha inexistente NEGADO (so anonima)', getDoc(doc(outro, 'crachas/uid-outro')), 'fail');
await check('10.1d conta nao logada le cracha inexistente NEGADO', getDoc(doc(naoLogado, 'crachas/uid-ninguem')), 'fail');
await check('10.1e sem cracha ouve o proprio cracha inexistente PASSA (onSnapshot da ponte)', new Promise((resolve, reject) => {
  const parar = onSnapshot(doc(semCracha, 'crachas/uid-sem'), () => { parar(); resolve(); }, (e) => reject(e));
}), 'ok');
await check('10.1f sem cracha ouve cracha inexistente de OUTRA conta NEGADO', new Promise((resolve, reject) => {
  const parar = onSnapshot(doc(semCracha, 'crachas/uid-ninguem'), () => { parar(); resolve(); }, (e) => reject(e));
}), 'fail');
await check('10.2 sem cracha bate heartbeat NEGADO (R13)', setDoc(doc(semCracha, 'maquinas/maquina-nova'), bater('maquina-nova'), { merge: true }), 'fail');
await check('10.3 sem cracha le fabrica NEGADO (R13)', getDoc(doc(semCracha, 'fabricas/fa1')), 'fail');
await check('10.4 sem cracha le fabrica inexistente NEGADO (R13)', getDoc(doc(semCracha, 'fabricas/nao-existe')), 'fail');
await check('10.5 sem cracha cria fabrica NEGADO (R13)', setDoc(doc(semCracha, 'fabricas/mao-x'), { fabricaId: 'mao-x', maquinaId: 'maquina-nova', atualizadoEm: ts() }, { merge: true }), 'fail');
await check('10.6 sem cracha lista comandos NEGADO (R13)', getDocs(query(collection(semCracha, 'comandos'), where('maquinaId', '==', 'maquina-nova'))), 'fail');
await check('10.7 sem cracha cria aprovacao NEGADO (R13)', setDoc(doc(semCracha, 'aprovacoes/u-s1'), pedido('fa1', MA, 'u-s1')), 'fail');
await check('10.8 sem cracha cria relatorio NEGADO (R13)', setDoc(doc(semCracha, 'relatorios/rs1'), fech('fa1', MA, 'rs1')), 'fail');
await check('10.9 sem cracha le relatorio inexistente NEGADO (R13)', getDoc(doc(semCracha, 'relatorios/nao-existe')), 'fail');
await check('10.10 sem cracha le cracha de outra conta NEGADO (R13)', getDoc(doc(semCracha, 'crachas/uid-cracha-a')), 'fail');
await check('10.11 sem cracha cria o proprio cracha NEGADO', setDoc(doc(semCracha, 'crachas/uid-sem'), { ...cracha('uid-sem', 'maquina-nova'), emitidoEm: ts() }), 'fail');
await check('10.12 pedido com campo a mais NEGADO (R11)', setDoc(doc(semCracha, 'pedidosDeCracha/uid-sem'), pedidoDe('uid-sem', { extra: 1 })), 'fail');
await check('10.13 pedido sem o campo rotulo NEGADO (campos exatos, R11)', setDoc(doc(semCracha, 'pedidosDeCracha/uid-sem'), (({ rotulo, ...r }) => r)(pedidoDe('uid-sem'))), 'fail');
await check('10.14 pedido com uid no corpo diferente da conta NEGADO (R11)', setDoc(doc(semCracha, 'pedidosDeCracha/uid-sem'), pedidoDe('uid-cracha-a')), 'fail');
await check('10.15 pedido no id de outra conta NEGADO (R11)', setDoc(doc(semCracha, 'pedidosDeCracha/uid-outra'), pedidoDe('uid-outra')), 'fail');
await check('10.16 pedido com nome fora do padrao, com simbolo, NEGADO (R11)', setDoc(doc(semCracha, 'pedidosDeCracha/uid-sem'), pedidoDe('uid-sem', { nome: '<b>NOTEBOOK</b>' })), 'fail');
await check('10.17 pedido com nome acentuado NEGADO (R11)', setDoc(doc(semCracha, 'pedidosDeCracha/uid-sem'), pedidoDe('uid-sem', { nome: 'MÁQUINA' })), 'fail');
await check('10.18 pedido com nome de 61 caracteres NEGADO (R11)', setDoc(doc(semCracha, 'pedidosDeCracha/uid-sem'), pedidoDe('uid-sem', { nome: 'N'.repeat(61) })), 'fail');
await check('10.19 pedido com nome vazio NEGADO (R11)', setDoc(doc(semCracha, 'pedidosDeCracha/uid-sem'), pedidoDe('uid-sem', { nome: '' })), 'fail');
await check('10.20 pedido com rotulo de 41 caracteres NEGADO (contrato, rotulo ate 40)', setDoc(doc(semCracha, 'pedidosDeCracha/uid-sem'), pedidoDe('uid-sem', { rotulo: 'r'.repeat(41) })), 'fail');
await check('10.21 pedido com rotulo com quebra de linha NEGADO (R11)', setDoc(doc(semCracha, 'pedidosDeCracha/uid-sem'), pedidoDe('uid-sem', { rotulo: 'a\nb' })), 'fail');
await check('10.22 pedido com codigo de 5 digitos NEGADO (R11)', setDoc(doc(semCracha, 'pedidosDeCracha/uid-sem'), pedidoDe('uid-sem', { codigo: '12345' })), 'fail');
await check('10.23 pedido com codigo numerico em vez de texto NEGADO (R11)', setDoc(doc(semCracha, 'pedidosDeCracha/uid-sem'), pedidoDe('uid-sem', { codigo: 123456 })), 'fail');
await check('10.24 pedido com codigo com letra NEGADO (R11)', setDoc(doc(semCracha, 'pedidosDeCracha/uid-sem'), pedidoDe('uid-sem', { codigo: '12345a' })), 'fail');
await check('10.25 pedido com maquinaId fora do padrao NEGADO (U5)', setDoc(doc(semCracha, 'pedidosDeCracha/uid-sem'), pedidoDe('uid-sem', { maquinaId: 'Maquina-Nova' })), 'fail');
await check('10.26 pedido com maquinaId sem prefixo NEGADO (U5)', setDoc(doc(semCracha, 'pedidosDeCracha/uid-sem'), pedidoDe('uid-sem', { maquinaId: 'notebook' })), 'fail');
await check('10.27 pedido com maquinaId de 41 caracteres depois do prefixo NEGADO (U5)', setDoc(doc(semCracha, 'pedidosDeCracha/uid-sem'), pedidoDe('uid-sem', { maquinaId: 'maquina-' + 'a'.repeat(41) })), 'fail');
await check('10.28 pedido com hora forjada NEGADO (R11)', setDoc(doc(semCracha, 'pedidosDeCracha/uid-sem'), pedidoDe('uid-sem', { criadoEm: forjada() })), 'fail');
await check('10.29 pedido de conta nao logada NEGADO', setDoc(doc(naoLogado, 'pedidosDeCracha/uid-sem'), pedidoDe('uid-sem')), 'fail');
await check('10.30 pedido de conta Google, nao anonima, NEGADO (R11)', setDoc(doc(outro, 'pedidosDeCracha/uid-outro'), pedidoDe('uid-outro')), 'fail');
await check('10.31 pedido do diretor NEGADO (pedido e da maquina)', setDoc(doc(diretor, 'pedidosDeCracha/uid-diretor'), pedidoDe('uid-diretor')), 'fail');
await check('10.32 pedido no formato exato PASSA (R11)', setDoc(doc(semCracha, 'pedidosDeCracha/uid-sem'), pedidoDe('uid-sem')), 'ok');
await check('10.33 pedido com rotulo null PASSA (R11)', setDoc(doc(anonimo('uid-sem-rotulo'), 'pedidosDeCracha/uid-sem-rotulo'), pedidoDe('uid-sem-rotulo', { rotulo: null })), 'ok');
await check('10.34 segundo pedido da mesma conta NEGADO (uma vez)', setDoc(doc(semCracha, 'pedidosDeCracha/uid-sem'), pedidoDe('uid-sem', { codigo: '999999' })), 'fail');
await check('10.35 pedido mudado depois NEGADO', updateDoc(doc(semCracha, 'pedidosDeCracha/uid-sem'), { codigo: '999999' }), 'fail');
await check('10.36 pedido apagado NEGADO', deleteDoc(doc(semCracha, 'pedidosDeCracha/uid-sem')), 'fail');
await check('10.37 a propria conta le o proprio pedido NEGADO (so o diretor le)', getDoc(doc(semCracha, 'pedidosDeCracha/uid-sem')), 'fail');
await check('10.38 diretor le o pedido PASSA', getDoc(doc(diretor, 'pedidosDeCracha/uid-sem')), 'ok');
await check('10.39 diretor lista pedidos dos ultimos 15 minutos PASSA (N2)', getDocs(query(collection(diretor, 'pedidosDeCracha'), where('criadoEm', '>=', minutosAtras(15)))), 'ok');
await check('10.40 outro e-mail le pedido NEGADO', getDoc(doc(outro, 'pedidosDeCracha/uid-sem')), 'fail');

// ---------------------------------------------- 11. emissao e revogacao, R12
const emitir = (uid, maquinaId, extra = {}) => ({ uid, maquinaId, rotulo: 'notebook do escritorio', ativo: true, emitidoEm: ts(), emitidoPor: 'painel no computador, ' + DIRETOR, ...extra });
await check('11.1 diretor emite sem pedido NEGADO (R12)', setDoc(doc(diretor, 'crachas/uid-sem-pedido'), emitir('uid-sem-pedido', 'maquina-nova')), 'fail');
await check('11.2 diretor emite com maquinaId diferente do pedido NEGADO (R12)', setDoc(doc(diretor, 'crachas/uid-sem'), emitir('uid-sem', 'maquina-outra')), 'fail');
await check('11.3 diretor emite com pedido de 16 minutos NEGADO (R12, tempo do servidor)', setDoc(doc(diretor, 'crachas/uid-vencido'), emitir('uid-vencido', 'maquina-v')), 'fail');
await check('11.4 diretor emite ja revogado NEGADO', setDoc(doc(diretor, 'crachas/uid-sem'), emitir('uid-sem', 'maquina-nova', { ativo: false })), 'fail');
await check('11.5 diretor emite com campo a mais NEGADO', setDoc(doc(diretor, 'crachas/uid-sem'), emitir('uid-sem', 'maquina-nova', { revogadoEm: null })), 'fail');
await check('11.6 diretor emite com hora forjada NEGADO', setDoc(doc(diretor, 'crachas/uid-sem'), emitir('uid-sem', 'maquina-nova', { emitidoEm: forjada() })), 'fail');
await check('11.7 diretor emite com uid no corpo diferente do id NEGADO', setDoc(doc(diretor, 'crachas/uid-sem'), emitir('uid-cracha-a', 'maquina-nova')), 'fail');
await check('11.8 diretor emite sem emitidoPor NEGADO', setDoc(doc(diretor, 'crachas/uid-sem'), emitir('uid-sem', 'maquina-nova', { emitidoPor: '' })), 'fail');
await check('11.9 outro e-mail emite NEGADO', setDoc(doc(outro, 'crachas/uid-sem'), emitir('uid-sem', 'maquina-nova')), 'fail');
await check('11.10 diretor emite com pedido de 14 minutos PASSA (R12)', setDoc(doc(diretor, 'crachas/uid-14min'), emitir('uid-14min', 'maquina-q')), 'ok');
await check('11.11 diretor emite com pedido valido PASSA (R12)', setDoc(doc(diretor, 'crachas/uid-sem'), emitir('uid-sem', 'maquina-nova')), 'ok');
await check('11.12 diretor emite DE NOVO por cima NEGADO (vira atualizacao)', setDoc(doc(diretor, 'crachas/uid-sem'), emitir('uid-sem', 'maquina-nova')), 'fail');
await check('11.13 dono le o cracha recem emitido PASSA (a ponte espera por isto)', getDoc(doc(semCracha, 'crachas/uid-sem')), 'ok');
await check('11.14 cracha recem emitido ja bate heartbeat PASSA', setDoc(doc(semCracha, 'maquinas/maquina-nova'), bater('maquina-nova'), { merge: true }), 'ok');
await check('11.15 diretor lista crachas PASSA', getDocs(collection(diretor, 'crachas')), 'ok');
const revogar = (extra = {}) => ({ ativo: false, revogadoEm: ts(), revogadoPor: 'painel no computador, ' + DIRETOR, ...extra });
await check('11.16 revogar trocando a maquina junto NEGADO', updateDoc(doc(diretor, 'crachas/uid-sem'), revogar({ maquinaId: 'maquina-outra' })), 'fail');
await check('11.17 revogar com hora forjada NEGADO', updateDoc(doc(diretor, 'crachas/uid-sem'), revogar({ revogadoEm: forjada() })), 'fail');
await check('11.18 revogar sem revogadoPor NEGADO', updateDoc(doc(diretor, 'crachas/uid-sem'), { ativo: false, revogadoEm: ts() }), 'fail');
await check('11.19 mudar o cracha sem revogar NEGADO', updateDoc(doc(diretor, 'crachas/uid-sem'), { rotulo: 'outro' }), 'fail');
await check('11.20 outro e-mail revoga NEGADO', updateDoc(doc(outro, 'crachas/uid-sem'), revogar()), 'fail');
await check('11.21 o proprio cracha se revoga NEGADO', updateDoc(doc(semCracha, 'crachas/uid-sem'), revogar()), 'fail');
await check('11.22 diretor revoga PASSA (R12)', updateDoc(doc(diretor, 'crachas/uid-sem'), revogar()), 'ok');
await check('11.23 revogacao vale na hora: heartbeat logo depois NEGADO', setDoc(doc(semCracha, 'maquinas/maquina-nova'), bater('maquina-nova'), { merge: true }), 'fail');
await check('11.24 revogado NAO volta a ativo NEGADO (R12)', updateDoc(doc(diretor, 'crachas/uid-sem'), { ativo: true }), 'fail');
await check('11.25 revogar de novo NEGADO', updateDoc(doc(diretor, 'crachas/uid-sem'), revogar()), 'fail');
await check('11.26 apagar cracha NEGADO, nem o diretor', deleteDoc(doc(diretor, 'crachas/uid-sem')), 'fail');
await check('11.27 revogado recriado por cima NEGADO', setDoc(doc(diretor, 'crachas/uid-sem'), emitir('uid-sem', 'maquina-nova')), 'fail');
// Troca de cracha da mesma maquina numa gravacao em lote, N3.
await check('11.28 emitir o primeiro cracha da maquina-l PASSA', setDoc(doc(diretor, 'crachas/uid-lote-velho'), emitir('uid-lote-velho', 'maquina-l')), 'ok');
await check('11.29 lote: revogar o antigo e emitir o novo na mesma gravacao PASSA (N3)', (() => {
  const b = writeBatch(diretor);
  b.update(doc(diretor, 'crachas/uid-lote-velho'), revogar());
  b.set(doc(diretor, 'crachas/uid-lote-novo'), emitir('uid-lote-novo', 'maquina-l'));
  return b.commit();
})(), 'ok');
await check('11.30 lote com pedido de outra maquina falha inteiro, nada muda', (() => {
  const b = writeBatch(diretor);
  b.update(doc(diretor, 'crachas/uid-14min'), revogar());
  b.set(doc(diretor, 'crachas/uid-troca'), emitir('uid-troca', 'maquina-errada'));
  return b.commit();
})(), 'fail');
await check('11.31 depois do lote negado o cracha de 14 minutos segue ativo', (async () => {
  const s = await getDoc(doc(diretor, 'crachas/uid-14min'));
  if (s.data()?.ativo !== true) throw new Error('o lote negado mexeu no cracha');
})(), 'ok');

// ---------------------------------- 12. o diretor continua podendo o que podia
await check('12.1 diretor bate heartbeat de qualquer maquina PASSA (ponte antiga)', setDoc(doc(diretor, 'maquinas/m-antiga'), { maquinaId: 'm-antiga', estadoPonte: 'online', vistoPorUltimo: ts() }, { merge: true }), 'ok');
await check('12.2 diretor cria fabrica sem maquinaId PASSA (como hoje)', setDoc(doc(diretor, 'fabricas/f-antiga'), { fabricaId: 'f-antiga', estado: 'em execucao', atualizadoEm: ts() }, { merge: true }), 'ok');
await check('12.3 diretor troca maquinaId de fabrica PASSA (como hoje)', setDoc(doc(diretor, 'fabricas/f-antiga'), { maquinaId: MA, atualizadoEm: ts() }, { merge: true }), 'ok');
await check('12.4 diretor renomeia fabrica de qualquer maquina PASSA (renomearFabrica)', updateDoc(doc(diretor, 'fabricas/fb1'), { nome: 'novo nome', atualizadoEm: ts() }), 'ok');
await check('12.5 diretor lista fabricas sem filtro PASSA (painel)', getDocs(query(collection(diretor, 'fabricas'), orderBy('atualizadoEm', 'desc'))), 'ok');
await check('12.6 diretor cria comando PASSA', addDoc(collection(diretor, 'comandos'), { fabricaId: 'fa1', maquinaId: MA, texto: 'x', situacao: 'pendente', criadoEm: ts(), origem: 'painel no computador, ' + DIRETOR, acao: 'comando' }), 'ok');
await check('12.7 diretor marca entregue com campo a mais PASSA (como hoje)', updateDoc(doc(diretor, 'comandos/ca4'), { situacao: 'entregue', entregueEm: ts(), nota: 'prova' }), 'ok');
await check('12.8 diretor cria aprovacao para fabrica sem documento PASSA (como hoje)', setDoc(doc(diretor, 'aprovacoes/d-1'), pedido('qualquer', 'm-antiga', 'd-1')), 'ok');
await check('12.9 diretor lista aprovacoes pendentes sem filtro de maquina PASSA (painel)', getDocs(query(collection(diretor, 'aprovacoes'), where('situacao', '==', 'pendente'), orderBy('criadoEm', 'asc'))), 'ok');
await check('12.10 diretor lista relatorios por fabricaId PASSA (ponte antiga)', getDocs(query(collection(diretor, 'relatorios'), where('fabricaId', '==', 'fa1'))), 'ok');
await check('12.11 diretor cria relatorio sem maquinaId PASSA (como hoje)', setDoc(doc(diretor, 'relatorios/d-r1'), { tipo: 'diario', criadoEm: ts() }), 'ok');
await check('12.12 diretor le atividade de fabrica de qualquer maquina PASSA', getDocs(collection(diretor, 'fabricas/fb1/atividade')), 'ok');
await check('12.13 diretor cria tarefa PASSA', setDoc(doc(diretor, 'fabricas/fb1/tarefas/t9'), { tarefaId: 't9' }), 'ok');
await check('12.14 diretor continua sem apagar nada NEGADO', deleteDoc(doc(diretor, 'aprovacoes/d-1')), 'fail');

await env.cleanup();
console.log('');
console.log('PASSOU: ' + ok.length + ' | FALHOU: ' + fail.length + ' | TOTAL: ' + (ok.length + fail.length));
for (const o of ok) console.log('  OK    ' + o);
for (const f of fail) console.log('  FALHA ' + f);
console.log('');
console.log(fail.length ? 'VEREDITO: REGRA DO CRACHA COM FURO, nao publicar.' : 'VEREDITO: REGRA DO CRACHA PROVADA no emulador. Publicacao e do coordenador, com a autorizacao do diretor, §A.7.');
process.exit(fail.length ? 1 : 0);
