// ponte-real.test.mjs, prova que a regra do Firestore deixa passar a escrita REAL
// da ponte e a escrita REAL do painel, e barra o que tem de barrar.
//
// Diferenca em relacao a regras.test.mjs: aqui nao ha copia de codigo da ponte nem
// reivindicacao forjada de token. Este teste importa o arquivo de verdade da ponte,
// ponte/src/base.ts, sem alterar uma linha dele, e entra com login de verdade no
// emulador de Auth, com o e-mail do diretor e e-mail verificado, como o provedor
// Google entrega na nuvem. Se a regra barrar uma escrita que a ponte faz de
// verdade, este teste acusa.
//
// Rodar, de dentro de firebase/testes:
//   npm install
//   firebase emulators:exec --only firestore,auth --project a-fabrica-soulan \
//     "node --experimental-transform-types --import ./registrar-resolucao.mjs ponte-real.test.mjs"
//
// §A.20: o projeto vai explicito na linha de comando. Nenhuma credencial aqui: o
// emulador de Auth nao usa chave de verdade e a senha e descartavel e local.
//
// O que este teste NAO cobre, para nao vender prova que nao existe: initBase da
// ponte, que depende da identidade do diretor gravada na maquina, e a prontidao do
// login na nuvem, que esta em verificar-login.mjs. Aqui a sessao e montada pelo
// proprio teste para poder exercitar as escritas contra a regra.

import { randomUUID } from 'node:crypto';
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword } from 'firebase/auth';
import {
  getFirestore, connectFirestoreEmulator, doc, getDoc, getDocs, setDoc, deleteDoc, updateDoc,
  collection, query, where, orderBy, onSnapshot, serverTimestamp, Timestamp,
} from 'firebase/firestore';

// O arquivo real da ponte, importado como esta no repositorio.
import {
  iniciarHeartbeat, atualizarFabrica, publicarAtividade, publicarAprovacao,
  esperarResposta, tomarComando, ouvirComandos, reconciliarPendentes, contarPendentes, DIRETOR,
} from '../../ponte/src/base.ts';

const PROJETO = 'a-fabrica-soulan';
const AUTH_REST = 'http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1';
const SENHA = 'senha-descartavel-do-emulador';
const MAQUINA = 'maquina-do-diretor';
const ok = [], fail = [];

function registrar(nome, passou, detalhe) {
  (passou ? ok : fail).push(detalhe ? `${nome} :: ${detalhe}` : nome);
}
async function deve(nome, fn) {
  try { await fn(); registrar(nome, true); }
  catch (e) { registrar(nome, false, 'falhou: ' + String(e && e.message ? e.message : e).replace(/\s+/g, ' ').slice(0, 170)); }
}
async function naoDeve(nome, fn) {
  try { await fn(); registrar(nome, false, 'PASSOU e nao devia'); }
  catch (e) {
    const m = String(e && e.code ? e.code : e);
    if (/permission-denied|PERMISSION_DENIED/.test(m)) registrar(nome, true);
    else registrar(nome, false, 'barrou por outro motivo: ' + m.slice(0, 130));
  }
}
function afirmar(condicao, mensagem) { if (!condicao) throw new Error(mensagem); }
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

// Cria conta no emulador de Auth e marca o e-mail como verificado, como o provedor
// Google faria na nuvem. Sem e-mail verificado a regra nega, de proposito.
async function criarContaVerificada(email) {
  const r1 = await fetch(`${AUTH_REST}/accounts:signUp?key=emulador`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: SENHA, returnSecureToken: true }),
  });
  const j1 = await r1.json();
  if (!j1.localId) throw new Error('nao criou a conta no emulador: ' + JSON.stringify(j1).slice(0, 200));
  const r2 = await fetch(`${AUTH_REST}/accounts:update`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
    body: JSON.stringify({ localId: j1.localId, emailVerified: true }),
  });
  const j2 = await r2.json();
  if (j2.emailVerified !== true) throw new Error('nao marcou e-mail verificado: ' + JSON.stringify(j2).slice(0, 200));
}

function ligar(nome, email) {
  const app = initializeApp({ projectId: PROJETO, apiKey: 'emulador', authDomain: PROJETO + '.firebaseapp.com' }, nome);
  const auth = getAuth(app);
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  const db = getFirestore(app);
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  return { app, auth, db, email };
}

console.log('=== ESCRITA REAL DA PONTE E DO PAINEL CONTRA A REGRA, emulador, projeto ' + PROJETO + ' ===');
console.log('Momento: ' + new Date().toISOString());
console.log('Arquivo da ponte sob teste: ponte/src/base.ts, importado sem alteracao.');
console.log('');

await criarContaVerificada(DIRETOR);
await criarContaVerificada('invasor@gmail.com');
const comoDiretor = ligar('diretor', DIRETOR);
const comoOutro = ligar('outro', 'invasor@gmail.com');
const db = comoDiretor.db;
const dbOutro = comoOutro.db;

const cred = await signInWithEmailAndPassword(comoDiretor.auth, DIRETOR, SENHA);
await signInWithEmailAndPassword(comoOutro.auth, 'invasor@gmail.com', SENHA);
const tok = await cred.user.getIdTokenResult();
await deve('0.1 ponte entra como o proprio diretor, pelo SDK cliente, com e-mail verificado', async () => {
  afirmar(tok.claims.email === DIRETOR, 'e-mail do token diferente: ' + tok.claims.email);
  afirmar(tok.claims.email_verified === true, 'e-mail nao verificado no token');
});

const FABRICA = 'fabrica-' + randomUUID().slice(0, 8);

// ================================================= 1. escrita real da ponte
// iniciarHeartbeat engole erro de proposito, para nao derrubar o servico. Entao a
// prova e por efeito: le de volta o que a ponte conseguiu gravar.
comoDiretor.hb = iniciarHeartbeat(db, MAQUINA, { nome: 'maquina do diretor' }, 60000);
await deve('1.1 heartbeat real grava maquinas com hora do servidor', async () => {
  // A hora so chega confirmada quando o servidor aceita a escrita. Enquanto nao
  // confirma, o SDK devolve nulo no campo. Entao espera a confirmacao, com limite.
  let dado = null;
  for (let tentativa = 0; tentativa < 40; tentativa++) {
    const s = await getDoc(doc(db, 'maquinas', MAQUINA));
    if (s.exists() && s.data().vistoPorUltimo instanceof Timestamp) { dado = s.data(); break; }
    await esperar(250);
  }
  afirmar(dado !== null, 'o servidor nao confirmou o heartbeat em 10 segundos, a regra barrou ou a hora nao e do servidor');
  afirmar(dado.estadoPonte === 'online', 'estadoPonte diferente de online');
  const atraso = Math.abs(Date.now() - dado.vistoPorUltimo.toMillis());
  afirmar(atraso < 60000, 'hora do heartbeat fora de hora, atraso ' + atraso + 'ms');
});
await deve('1.2 ponte cria a fabrica em execucao', () => atualizarFabrica(db, FABRICA, { maquinaId: MAQUINA, projeto: 'c:/projeto-cc', estado: 'em execucao' }));
await deve('1.3 ponte grava modelo e conversa na mesma fabrica', () => atualizarFabrica(db, FABRICA, { conversationId: 'sessao-1', modelo: 'claude-sonnet-4-6' }));
await deve('1.4 ponte fecha a fabrica com consumo', () => atualizarFabrica(db, FABRICA, { estado: 'concluida', consumo: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } }));
await deve('1.5 ponte marca fabrica que falhou', () => atualizarFabrica(db, FABRICA, { estado: 'falhou' }));
await deve('1.6 ponte adiciona passos de atividade', async () => {
  for (let i = 0; i < 3; i++) await publicarAtividade(db, FABRICA, { seq: i, tipo: i === 2 ? 'fim' : 'texto', ferramenta: null });
  const s = await getDocs(query(collection(db, 'fabricas', FABRICA, 'atividade'), orderBy('seq', 'asc')));
  afirmar(s.size === 3, 'esperava 3 passos, veio ' + s.size);
  afirmar(s.docs[0].data().em instanceof Timestamp, 'a hora do passo nao e do servidor');
});

const pacoteReal = {
  marcacao: 'origem fato = capturado do fluxo ao vivo. origem ponte = deducao, nunca declaracao do agente.',
  oQue: { valor: 'rm -rf build', origem: 'fato' }, ferramenta: { valor: 'Bash', origem: 'fato' },
  tarefa: { valor: 'limpar a pasta', origem: 'fato' }, fabrica: { valor: FABRICA, origem: 'fato' },
  agenteDisse: { valor: 'vou limpar a pasta de build', origem: 'fato' },
  porQue: { valor: 'A ponte le, do fluxo ao vivo, que a acao serve a tarefa.', origem: 'ponte' },
  impacto: { valor: 'Pode apagar, publicar ou acessar rede.', origem: 'ponte' },
  oQueSeraTocado: { valor: ['build'], origem: 'fato mais leitura da ponte' },
  risco: { valor: 'alto', origem: 'ponte' },
  tempoParadoMs: { valor: 0, origem: 'fato' },
};
const APROVACAO = randomUUID();
await deve('1.7 ponte publica pedido de aprovacao com o pacote completo', () => publicarAprovacao(db, APROVACAO, { fabricaId: FABRICA, maquinaId: MAQUINA, pacote: pacoteReal, origem: 'ponte' }));
await deve('1.8 ponte conta os pendentes da sua maquina', async () => {
  const n = await contarPendentes(db, MAQUINA);
  afirmar(n >= 1, 'contagem de pendentes veio ' + n);
});

// ================================================= 2. escrita real do painel
const COMANDO = randomUUID();
await deve('2.1 painel cria comando pendente, hora do servidor e origem', () => setDoc(doc(db, 'comandos', COMANDO), {
  comandoId: COMANDO, fabricaId: FABRICA, maquinaId: MAQUINA, texto: 'rodar os testes',
  situacao: 'pendente', criadoEm: serverTimestamp(), origem: DIRETOR + ' no navegador',
}));
await naoDeve('2.2 painel NAO cria comando com hora do cliente', () => setDoc(doc(db, 'comandos', randomUUID()), {
  fabricaId: FABRICA, maquinaId: MAQUINA, texto: 'hora forjada', situacao: 'pendente', criadoEm: new Date(), origem: 'painel',
}));
await naoDeve('2.3 painel NAO cria comando ja entregue', () => setDoc(doc(db, 'comandos', randomUUID()), {
  fabricaId: FABRICA, maquinaId: MAQUINA, texto: 'x', situacao: 'entregue', criadoEm: serverTimestamp(), origem: 'painel',
}));
await naoDeve('2.4 painel NAO apaga comando da trilha', () => deleteDoc(doc(db, 'comandos', COMANDO)));
await deve('2.5 ouvinte real da ponte ve o comando pendente da sua maquina', async () => {
  const vistos = new Set();
  const off = ouvirComandos(db, MAQUINA, (id) => vistos.add(id));
  await esperar(1200); off();
  afirmar(vistos.has(COMANDO), 'o ouvinte da ponte nao recebeu o comando');
});
await deve('2.6 ponte toma o comando em transacao e marca entregue', async () => {
  const c = await tomarComando(db, COMANDO);
  afirmar(c !== null, 'a transacao nao devolveu o comando, a regra barrou a marcacao de entregue');
  afirmar(c.texto === 'rodar os testes', 'texto do comando diferente: ' + c.texto);
  const s = await getDoc(doc(db, 'comandos', COMANDO));
  afirmar(s.data().situacao === 'entregue', 'situacao nao virou entregue');
  afirmar(s.data().entregueEm instanceof Timestamp, 'entregueEm nao e hora do servidor');
});
await deve('2.7 tomar o mesmo comando DE NOVO nao entrega duas vezes', async () => {
  const c = await tomarComando(db, COMANDO);
  afirmar(c === null, 'o mesmo comando foi entregue duas vezes');
});
await deve('2.8 painel responde a aprovacao uma vez', () => updateDoc(doc(db, 'aprovacoes', APROVACAO), {
  situacao: 'respondida', resposta: 'aprovado com observacao', observacao: 'siga, mas nao toque em producao',
  respondidoEm: serverTimestamp(), respondidoPor: DIRETOR + ' no celular',
}));
await naoDeve('2.9 painel NAO responde a mesma aprovacao duas vezes', () => updateDoc(doc(db, 'aprovacoes', APROVACAO), {
  situacao: 'respondida', resposta: 'recusado', respondidoEm: serverTimestamp(), respondidoPor: DIRETOR,
}));
await naoDeve('2.10 resposta sem dizer quem respondeu e NEGADA', async () => {
  const id = randomUUID();
  await publicarAprovacao(db, id, { fabricaId: FABRICA, maquinaId: MAQUINA, pacote: pacoteReal, origem: 'ponte' });
  await updateDoc(doc(db, 'aprovacoes', id), { situacao: 'respondida', resposta: 'aprovado', respondidoEm: serverTimestamp() });
});
await naoDeve('2.11 painel NAO apaga aprovacao da trilha', () => deleteDoc(doc(db, 'aprovacoes', APROVACAO)));

// ======================================== 3. portao de ponta a ponta pela base
await deve('3.1 portao: pedido da ponte, resposta do painel, ponte recebe allow', async () => {
  const id = randomUUID();
  await publicarAprovacao(db, id, { fabricaId: FABRICA, maquinaId: MAQUINA, pacote: pacoteReal, origem: 'ponte' });
  const espera = esperarResposta(db, id, 20000);
  await esperar(400);
  await updateDoc(doc(db, 'aprovacoes', id), { situacao: 'respondida', resposta: 'aprovado', respondidoEm: serverTimestamp(), respondidoPor: DIRETOR });
  const r = await espera;
  afirmar(r.decisao === 'allow', 'o portao nao recebeu allow, veio ' + JSON.stringify(r));
});
await deve('3.2 portao: recusa do painel chega como deny', async () => {
  const id = randomUUID();
  await publicarAprovacao(db, id, { fabricaId: FABRICA, maquinaId: MAQUINA, pacote: pacoteReal, origem: 'ponte' });
  const espera = esperarResposta(db, id, 20000);
  await esperar(400);
  await updateDoc(doc(db, 'aprovacoes', id), { situacao: 'respondida', resposta: 'recusado', respondidoEm: serverTimestamp(), respondidoPor: DIRETOR });
  const r = await espera;
  afirmar(r.decisao === 'deny', 'o portao nao recebeu deny, veio ' + JSON.stringify(r));
});
await deve('3.3 portao falha fechada: sem resposta no tempo, recusa', async () => {
  const id = randomUUID();
  await publicarAprovacao(db, id, { fabricaId: FABRICA, maquinaId: MAQUINA, pacote: pacoteReal, origem: 'ponte' });
  const r = await esperarResposta(db, id, 1500);
  afirmar(r.decisao === 'deny', 'tempo esgotado nao recusou');
});

// ==================================== 4. reconciliacao no reinicio da ponte
await deve('4.1 reconciliacao recusa pendente de sessao morta e marca a fabrica offline', async () => {
  const id = randomUUID();
  const fabricaMorta = 'fabrica-morta-' + randomUUID().slice(0, 8);
  await atualizarFabrica(db, fabricaMorta, { maquinaId: MAQUINA, estado: 'em execucao' });
  await publicarAprovacao(db, id, { fabricaId: fabricaMorta, maquinaId: MAQUINA, pacote: pacoteReal, origem: 'ponte' });
  const r = await reconciliarPendentes(db, MAQUINA, new Set());
  afirmar(r.aprovacoesRecusadas >= 1, 'nenhuma aprovacao recusada, veio ' + r.aprovacoesRecusadas);
  afirmar(r.fabricasMarcadasOffline >= 1, 'nenhuma fabrica marcada offline, veio ' + r.fabricasMarcadasOffline);
  const s = await getDoc(doc(db, 'aprovacoes', id));
  afirmar(s.data().situacao === 'respondida', 'situacao nao virou respondida, a regra barrou a reconciliacao');
  afirmar(s.data().resposta === 'recusado', 'resposta nao virou recusado');
  afirmar(s.data().respondidoEm instanceof Timestamp, 'respondidoEm nao e hora do servidor');
  afirmar(typeof s.data().respondidoPor === 'string' && s.data().respondidoPor.length > 0, 'reconciliacao sem origem da resposta');
  const f = await getDoc(doc(db, 'fabricas', fabricaMorta));
  afirmar(f.data().estado === 'ponte offline', 'a fabrica morta nao virou ponte offline, veio ' + f.data().estado);
});
await deve('4.2 reconciliacao NAO mexe em pedido de sessao viva', async () => {
  const id = randomUUID();
  await publicarAprovacao(db, id, { fabricaId: FABRICA, maquinaId: MAQUINA, pacote: pacoteReal, origem: 'ponte' });
  await reconciliarPendentes(db, MAQUINA, new Set([FABRICA]));
  const s = await getDoc(doc(db, 'aprovacoes', id));
  afirmar(s.data().situacao === 'pendente', 'a reconciliacao respondeu um pedido de sessao viva');
});
await deve('4.3 parada limpa marca offline e poe a fabrica viva em ponte offline', async () => {
  await atualizarFabrica(db, FABRICA, { estado: 'em execucao' });
  await comoDiretor.hb.parar([FABRICA]);
  const m = await getDoc(doc(db, 'maquinas', MAQUINA));
  afirmar(m.data().estadoPonte === 'offline', 'a maquina nao ficou offline');
  const f = await getDoc(doc(db, 'fabricas', FABRICA));
  afirmar(f.data().estado === 'ponte offline', 'a fabrica nao ficou em ponte offline, veio ' + f.data().estado);
});

// =============================== 5. ouvintes ao vivo que o painel precisa
await deve('5.1 ouvinte do painel em fabricas, ordenado por atualizadoEm', async () => {
  let n = -1;
  const off = onSnapshot(query(collection(db, 'fabricas'), orderBy('atualizadoEm', 'desc')), (s) => { n = s.size; }, () => { n = -2; });
  await esperar(1200); off();
  afirmar(n >= 1, 'o ouvinte de fabricas nao trouxe nada, codigo ' + n);
});
await deve('5.2 ouvinte do painel na atividade de uma fabrica, ordenado por seq', async () => {
  let n = -1;
  const off = onSnapshot(query(collection(db, 'fabricas', FABRICA, 'atividade'), orderBy('seq', 'asc')), (s) => { n = s.size; }, () => { n = -2; });
  await esperar(1200); off();
  afirmar(n >= 3, 'o ouvinte de atividade nao trouxe os passos, codigo ' + n);
});
await deve('5.3 ouvinte do painel na fila de aprovacoes pendentes, ordenado por criadoEm', async () => {
  let n = -1;
  const off = onSnapshot(query(collection(db, 'aprovacoes'), where('situacao', '==', 'pendente'), orderBy('criadoEm', 'asc')), (s) => { n = s.size; }, () => { n = -2; });
  await esperar(1200); off();
  afirmar(n >= 1, 'o ouvinte da fila de aprovacoes nao trouxe nada, codigo ' + n);
});

// ======================= 6. a mesma ponte, com outra conta, e barrada em tudo
await naoDeve('6.1 outra conta NAO grava fabrica usando o codigo real da ponte', () => atualizarFabrica(dbOutro, FABRICA, { estado: 'em execucao' }));
await naoDeve('6.2 outra conta NAO adiciona atividade usando o codigo real da ponte', () => publicarAtividade(dbOutro, FABRICA, { seq: 99, tipo: 'texto', ferramenta: null }));
await naoDeve('6.3 outra conta NAO publica pedido de aprovacao', () => publicarAprovacao(dbOutro, randomUUID(), { fabricaId: FABRICA, maquinaId: MAQUINA, pacote: pacoteReal, origem: 'ponte' }));
await naoDeve('6.4 outra conta NAO le a fabrica', () => getDoc(doc(dbOutro, 'fabricas', FABRICA)));
await deve('6.5 outra conta NAO ve comando nenhum pelo ouvinte real da ponte', async () => {
  const vistos = new Set();
  const off = ouvirComandos(dbOutro, MAQUINA, (id) => vistos.add(id));
  await esperar(1200); off();
  afirmar(vistos.size === 0, 'a outra conta viu comando, tamanho ' + vistos.size);
});
await deve('6.6 outra conta NAO toma comando (falha fechada, devolve nulo)', async () => {
  const id = randomUUID();
  await setDoc(doc(db, 'comandos', id), { comandoId: id, fabricaId: FABRICA, maquinaId: MAQUINA, texto: 'nao deve sair', situacao: 'pendente', criadoEm: serverTimestamp(), origem: DIRETOR });
  const c = await tomarComando(dbOutro, id);
  afirmar(c === null, 'a outra conta tomou o comando');
  const s = await getDoc(doc(db, 'comandos', id));
  afirmar(s.data().situacao === 'pendente', 'o comando mudou de situacao por conta estranha');
});

console.log('PASSOU: ' + ok.length + ' | FALHOU: ' + fail.length + ' | TOTAL: ' + (ok.length + fail.length));
for (const o of ok) console.log('  OK    ' + o);
for (const f of fail) console.log('  FALHA ' + f);
console.log('');
console.log(fail.length
  ? 'VEREDITO: existe escrita real barrada ou brecha aberta. Nao publicar, corrigir primeiro.'
  : 'VEREDITO: a escrita real da ponte e do painel passa, e a conta que nao e do diretor e barrada em tudo.');
process.exit(fail.length ? 1 : 0);
