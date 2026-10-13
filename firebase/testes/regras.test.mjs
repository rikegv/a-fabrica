// regras.test.mjs, prova das regras do Firestore no emulador, sem login de verdade.
//
// Cobre a matriz de identidade (conta unica), a trilha imutavel com hora do servidor,
// e cada transicao de estado permitida de comando e de aprovacao. As escritas reais
// da ponte, com o arquivo da ponte de verdade, estao em ponte-real.test.mjs.
//
// Rodar:
//   npm install
//   firebase emulators:exec --only firestore --project a-fabrica-soulan "node regras.test.mjs"
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import {
  doc, collection, setDoc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  serverTimestamp, query, where, orderBy,
} from 'firebase/firestore';
import { readFileSync } from 'node:fs';

const DIRETOR = 'henrique.vieira@soulan.com.br';
const env = await initializeTestEnvironment({
  projectId: 'a-fabrica-soulan',
  firestore: { rules: readFileSync('../firestore.rules', 'utf8') },
});

const ok = [], fail = [];
async function check(nome, promessa, esperado) {
  try { await (esperado === 'ok' ? assertSucceeds(promessa) : assertFails(promessa)); ok.push(nome); }
  catch (e) { fail.push(`${nome} [esperado ${esperado}]: ${String(e).replace(/\s+/g, ' ').slice(0, 140)}`); }
}

// --- identidades ---
const diretor = env.authenticatedContext('uid-diretor', { email: DIRETOR, email_verified: true }).firestore();
const outro = env.authenticatedContext('uid-outro', { email: 'invasor@gmail.com', email_verified: true }).firestore();
const naoVerificado = env.authenticatedContext('uid-nv', { email: DIRETOR, email_verified: false }).firestore();
const semEmail = env.authenticatedContext('uid-se', {}).firestore();
const parecido = env.authenticatedContext('uid-par', { email: 'henrique.vieira@soulan.com.br.invasor.com', email_verified: true }).firestore();
const maiusculo = env.authenticatedContext('uid-mai', { email: 'Henrique.Vieira@Soulan.com.br', email_verified: true }).firestore();
const anon = env.unauthenticatedContext().firestore();

const cmd = () => ({ fabricaId: 'f1', maquinaId: 'm1', texto: 'rodar testes', situacao: 'pendente', criadoEm: serverTimestamp(), origem: DIRETOR + ' no navegador' });
// Mesmo formato que a ponte real escreve hoje em ponte/src/base.ts, publicarAprovacao.
const apr = () => ({ aprovacaoId: 'a1', fabricaId: 'f1', maquinaId: 'm1', pacote: { risco: { valor: 'alto', origem: 'ponte' } }, situacao: 'pendente', resposta: null, observacao: null, respondidoEm: null, respondidoPor: null, criadoEm: serverTimestamp(), origem: 'ponte' });

console.log('=== REGRAS DO FIRESTORE, emulador, projeto a-fabrica-soulan ===');
console.log('Momento: ' + new Date().toISOString());

// ---------------------------------------------------------------- 1. conta unica
await check('1.1 diretor cria comando', setDoc(doc(diretor, 'comandos/c1'), cmd()), 'ok');
await check('1.2 diretor le comando', getDoc(doc(diretor, 'comandos/c1')), 'ok');
await check('1.3 outro e-mail NAO le comando', getDoc(doc(outro, 'comandos/c1')), 'fail');
await check('1.4 outro e-mail NAO cria comando', setDoc(doc(outro, 'comandos/c9'), cmd()), 'fail');
await check('1.5 diretor com e-mail NAO verificado NAO le', getDoc(doc(naoVerificado, 'comandos/c1')), 'fail');
await check('1.6 diretor com e-mail NAO verificado NAO escreve', setDoc(doc(naoVerificado, 'comandos/c8'), cmd()), 'fail');
await check('1.7 autenticado sem e-mail no token NAO le', getDoc(doc(semEmail, 'comandos/c1')), 'fail');
await check('1.8 anonimo NAO le', getDoc(doc(anon, 'comandos/c1')), 'fail');
await check('1.9 anonimo NAO escreve', setDoc(doc(anon, 'comandos/c7'), cmd()), 'fail');
await check('1.10 e-mail parecido com o do diretor NAO le', getDoc(doc(parecido, 'comandos/c1')), 'fail');
await check('1.11 e-mail do diretor em maiusculas NAO le', getDoc(doc(maiusculo, 'comandos/c1')), 'fail');
await check('1.12 outro e-mail NAO le maquinas', getDoc(doc(outro, 'maquinas/m1')), 'fail');
await check('1.13 outro e-mail NAO le fabricas', getDoc(doc(outro, 'fabricas/f1')), 'fail');
await check('1.14 outro e-mail NAO le atividade', getDocs(collection(outro, 'fabricas/f1/atividade')), 'fail');
await check('1.15 outro e-mail NAO le aprovacoes', getDocs(collection(outro, 'aprovacoes')), 'fail');
await check('1.16 outro e-mail NAO le relatorios', getDocs(collection(outro, 'relatorios')), 'fail');
await check('1.17 outro e-mail NAO le tarefas', getDocs(collection(outro, 'fabricas/f1/tarefas')), 'fail');

// -------------------------------------------------- 2. trilha de comando, imutavel
await check('2.1 comando com hora forjada pelo cliente NEGADO', setDoc(doc(diretor, 'comandos/c2'), { ...cmd(), criadoEm: new Date('2020-01-01') }), 'fail');
await check('2.2 comando sem origem NEGADO', setDoc(doc(diretor, 'comandos/c3'), { fabricaId: 'f1', maquinaId: 'm1', texto: 'x', situacao: 'pendente', criadoEm: serverTimestamp() }), 'fail');
await check('2.3 comando criado ja como entregue NEGADO', setDoc(doc(diretor, 'comandos/c4'), { ...cmd(), situacao: 'entregue' }), 'fail');
await check('2.4 comando criado com entregueEm preenchido NEGADO', setDoc(doc(diretor, 'comandos/c5'), { ...cmd(), entregueEm: serverTimestamp() }), 'fail');
await check('2.5 comando com texto vazio NEGADO', setDoc(doc(diretor, 'comandos/c6'), { ...cmd(), texto: '' }), 'fail');
await check('2.6 comando sem maquinaId NEGADO', setDoc(doc(diretor, 'comandos/c6b'), { fabricaId: 'f1', texto: 'x', situacao: 'pendente', criadoEm: serverTimestamp(), origem: 'painel' }), 'fail');
await check('2.7 marcar entregue com hora forjada NEGADO', updateDoc(doc(diretor, 'comandos/c1'), { situacao: 'entregue', entregueEm: new Date() }), 'fail');
await check('2.8 marcar entregue trocando o texto NEGADO', updateDoc(doc(diretor, 'comandos/c1'), { situacao: 'entregue', entregueEm: serverTimestamp(), texto: 'outro comando' }), 'fail');
await check('2.9 marcar entregue trocando criadoEm NEGADO', updateDoc(doc(diretor, 'comandos/c1'), { situacao: 'entregue', entregueEm: serverTimestamp(), criadoEm: serverTimestamp() }), 'fail');
await check('2.10 marcar entregue com hora do servidor PASSA', updateDoc(doc(diretor, 'comandos/c1'), { situacao: 'entregue', entregueEm: serverTimestamp() }), 'ok');
await check('2.11 marcar entregue DE NOVO NEGADO (entrega uma vez)', updateDoc(doc(diretor, 'comandos/c1'), { situacao: 'entregue', entregueEm: serverTimestamp() }), 'fail');
await check('2.12 voltar comando entregue para pendente NEGADO', updateDoc(doc(diretor, 'comandos/c1'), { situacao: 'pendente' }), 'fail');
await check('2.13 apagar comando NEGADO (trilha)', deleteDoc(doc(diretor, 'comandos/c1')), 'fail');

// ------------------------------------------------ 3. trilha de aprovacao, imutavel
await check('3.1 ponte cria pedido de aprovacao', setDoc(doc(diretor, 'aprovacoes/a1'), apr()), 'ok');
await check('3.2 pedido com hora forjada NEGADO', setDoc(doc(diretor, 'aprovacoes/a2'), { ...apr(), criadoEm: new Date('2020-01-01') }), 'fail');
await check('3.3 pedido sem pacote NEGADO', setDoc(doc(diretor, 'aprovacoes/a3'), { fabricaId: 'f1', maquinaId: 'm1', situacao: 'pendente', criadoEm: serverTimestamp(), origem: 'ponte' }), 'fail');
await check('3.4 pedido nascendo ja respondido NEGADO (nao existe pre-autorizacao)', setDoc(doc(diretor, 'aprovacoes/a4'), { ...apr(), situacao: 'respondida', resposta: 'aprovado' }), 'fail');
await check('3.5 pedido nascendo com resposta preenchida NEGADO', setDoc(doc(diretor, 'aprovacoes/a5'), { ...apr(), resposta: 'aprovado' }), 'fail');
await check('3.6 resposta com valor fora da lista NEGADA', updateDoc(doc(diretor, 'aprovacoes/a1'), { situacao: 'respondida', resposta: 'talvez', respondidoEm: serverTimestamp(), respondidoPor: DIRETOR }), 'fail');
await check('3.7 resposta com hora forjada NEGADA', updateDoc(doc(diretor, 'aprovacoes/a1'), { situacao: 'respondida', resposta: 'aprovado', respondidoEm: new Date(), respondidoPor: DIRETOR }), 'fail');
await check('3.8 resposta que reescreve o pacote NEGADA', updateDoc(doc(diretor, 'aprovacoes/a1'), { situacao: 'respondida', resposta: 'aprovado', respondidoEm: serverTimestamp(), respondidoPor: DIRETOR, pacote: { risco: { valor: 'baixo' } } }), 'fail');
await check('3.9 responder sem mudar a situacao NEGADO', updateDoc(doc(diretor, 'aprovacoes/a1'), { resposta: 'aprovado', respondidoEm: serverTimestamp(), respondidoPor: DIRETOR }), 'fail');
await check('3.9b resposta sem dizer quem respondeu NEGADA (trilha de origem)', updateDoc(doc(diretor, 'aprovacoes/a1'), { situacao: 'respondida', resposta: 'aprovado', respondidoEm: serverTimestamp() }), 'fail');
await check('3.9c pedido nascendo com respondidoPor preenchido NEGADO', setDoc(doc(diretor, 'aprovacoes/a7'), { ...apr(), respondidoPor: DIRETOR }), 'fail');
await check('3.10 painel responde uma vez PASSA', updateDoc(doc(diretor, 'aprovacoes/a1'), { situacao: 'respondida', resposta: 'aprovado com observacao', observacao: 'siga, mas sem tocar em producao', respondidoEm: serverTimestamp(), respondidoPor: DIRETOR + ' no celular' }), 'ok');
await check('3.11 responder DUAS VEZES NEGADO', updateDoc(doc(diretor, 'aprovacoes/a1'), { situacao: 'respondida', resposta: 'recusado', respondidoEm: serverTimestamp(), respondidoPor: DIRETOR }), 'fail');
await check('3.12 trocar a resposta depois NEGADO', updateDoc(doc(diretor, 'aprovacoes/a1'), { resposta: 'recusado' }), 'fail');
await check('3.13 apagar aprovacao NEGADO (trilha)', deleteDoc(doc(diretor, 'aprovacoes/a1')), 'fail');
await check('3.14 recusa por reconciliacao PASSA (pedido novo)', setDoc(doc(diretor, 'aprovacoes/a6'), apr()).then(() => updateDoc(doc(diretor, 'aprovacoes/a6'), { situacao: 'respondida', resposta: 'recusado', observacao: 'ponte reiniciou, sessao encerrada, recusa por seguranca', respondidoEm: serverTimestamp(), respondidoPor: 'ponte, reconciliacao, ' + DIRETOR })), 'ok');

// ------------------------------------------------------- 4. maquina, fabrica, passo
await check('4.1 heartbeat da ponte PASSA', setDoc(doc(diretor, 'maquinas/m1'), { maquinaId: 'm1', estadoPonte: 'online', vistoPorUltimo: serverTimestamp(), nome: 'maquina do diretor' }, { merge: true }), 'ok');
await check('4.2 heartbeat com hora forjada NEGADO', setDoc(doc(diretor, 'maquinas/m2'), { maquinaId: 'm2', estadoPonte: 'online', vistoPorUltimo: new Date() }, { merge: true }), 'fail');
await check('4.3 estado de ponte fora da lista NEGADO', setDoc(doc(diretor, 'maquinas/m3'), { maquinaId: 'm3', estadoPonte: 'quase', vistoPorUltimo: serverTimestamp() }, { merge: true }), 'fail');
await check('4.4 parada limpa marca offline PASSA', setDoc(doc(diretor, 'maquinas/m1'), { estadoPonte: 'offline', vistoPorUltimo: serverTimestamp() }, { merge: true }), 'ok');
await check('4.5 apagar maquina NEGADO', deleteDoc(doc(diretor, 'maquinas/m1')), 'fail');
await check('4.6 fabrica criada pela ponte PASSA', setDoc(doc(diretor, 'fabricas/f1'), { fabricaId: 'f1', maquinaId: 'm1', projeto: 'c:/projeto', estado: 'em execucao', atualizadoEm: serverTimestamp() }, { merge: true }), 'ok');
await check('4.7 fabrica com hora forjada NEGADA', setDoc(doc(diretor, 'fabricas/f2'), { fabricaId: 'f2', estado: 'em execucao', atualizadoEm: new Date() }, { merge: true }), 'fail');
await check('4.8 apagar fabrica NEGADO', deleteDoc(doc(diretor, 'fabricas/f1')), 'fail');
await check('4.9 atividade adiciona passo PASSA', addDoc(collection(diretor, 'fabricas/f1/atividade'), { seq: 0, tipo: 'texto', ferramenta: null, em: serverTimestamp() }), 'ok');
await check('4.10 atividade com hora forjada NEGADA', addDoc(collection(diretor, 'fabricas/f1/atividade'), { seq: 1, tipo: 'texto', em: new Date() }), 'fail');
await check('4.11 atividade NAO se altera', setDoc(doc(diretor, 'fabricas/f1/atividade/p1'), { seq: 2, em: serverTimestamp() }).then(() => updateDoc(doc(diretor, 'fabricas/f1/atividade/p1'), { seq: 99 })), 'fail');
await check('4.12 atividade NAO se apaga', deleteDoc(doc(diretor, 'fabricas/f1/atividade/p1')), 'fail');
await check('4.13 tarefa criada PASSA', setDoc(doc(diretor, 'fabricas/f1/tarefas/t1'), { tarefaId: 't1', titulo: 'provar as regras', situacao: 'em andamento', criadaEm: serverTimestamp(), atualizadaEm: serverTimestamp() }), 'ok');
await check('4.14 tarefa muda de situacao PASSA', updateDoc(doc(diretor, 'fabricas/f1/tarefas/t1'), { situacao: 'concluida', atualizadaEm: serverTimestamp() }), 'ok');
await check('4.15 apagar tarefa NEGADO', deleteDoc(doc(diretor, 'fabricas/f1/tarefas/t1')), 'fail');

// ------------------------------------------------------------------ 5. relatorios
await check('5.1 relatorio de tarefa PASSA', setDoc(doc(diretor, 'relatorios/r1'), { relatorioId: 'r1', tipo: 'tarefa', fabricaId: 'f1', conteudo: { solicitado: 'x', feito: 'y', faltou: '', decisoes: '', arquivosAreas: '', problemas: '', proximoPasso: '' }, criadoEm: serverTimestamp() }), 'ok');
await check('5.2 relatorio diario PASSA', setDoc(doc(diretor, 'relatorios/r2'), { relatorioId: 'r2', tipo: 'diario', conteudo: { feito: 'fechamento do dia' }, criadoEm: serverTimestamp() }), 'ok');
await check('5.3 relatorio com hora forjada NEGADO', setDoc(doc(diretor, 'relatorios/r3'), { tipo: 'tarefa', criadoEm: new Date() }), 'fail');
await check('5.4 relatorio NAO se altera', updateDoc(doc(diretor, 'relatorios/r1'), { conteudo: { feito: 'reescrito' } }), 'fail');
await check('5.5 relatorio NAO se apaga', deleteDoc(doc(diretor, 'relatorios/r1')), 'fail');

// ------------------------------------------- 6. nega tudo o que nao esta no modelo
await check('6.1 colecao fora do modelo NEGADA ao diretor', setDoc(doc(diretor, 'segredos/x'), { a: 1 }), 'fail');
await check('6.2 leitura de colecao fora do modelo NEGADA', getDoc(doc(diretor, 'segredos/x')), 'fail');
await check('6.3 subcolecao desconhecida dentro de fabricas NEGADA', setDoc(doc(diretor, 'fabricas/f1/segredos/x'), { a: 1 }), 'fail');
await check('6.4 usuarios ou perfis NEGADO (nao existe papel neste sistema)', setDoc(doc(diretor, 'usuarios/uid-diretor'), { papel: 'admin' }), 'fail');

// ---------------------------------------- 7. leitura ao vivo que o painel precisa
await check('7.1 painel lista fabricas por atualizadoEm', getDocs(query(collection(diretor, 'fabricas'), orderBy('atualizadoEm', 'desc'))), 'ok');
await check('7.2 painel lista atividade de uma fabrica por seq', getDocs(query(collection(diretor, 'fabricas/f1/atividade'), orderBy('seq', 'asc'))), 'ok');
await check('7.3 painel lista aprovacoes pendentes por criadoEm', getDocs(query(collection(diretor, 'aprovacoes'), where('situacao', '==', 'pendente'), orderBy('criadoEm', 'asc'))), 'ok');
await check('7.4 ponte lista comandos pendentes da sua maquina', getDocs(query(collection(diretor, 'comandos'), where('maquinaId', '==', 'm1'), where('situacao', '==', 'pendente'))), 'ok');
await check('7.5 outro e-mail NAO lista fabricas', getDocs(query(collection(outro, 'fabricas'), orderBy('atualizadoEm', 'desc'))), 'fail');
await check('7.6 anonimo NAO lista aprovacoes pendentes', getDocs(query(collection(anon, 'aprovacoes'), where('situacao', '==', 'pendente'))), 'fail');

await env.cleanup();
console.log('');
console.log('PASSOU: ' + ok.length + ' | FALHOU: ' + fail.length + ' | TOTAL: ' + (ok.length + fail.length));
for (const o of ok) console.log('  OK    ' + o);
for (const f of fail) console.log('  FALHA ' + f);
console.log('');
console.log(fail.length ? 'VEREDITO: REGRA COM FURO, nao publicar.' : 'VEREDITO: REGRA PROVADA no emulador. Publicacao e do coordenador, com a flag do gate.');
process.exit(fail.length ? 1 : 0);
