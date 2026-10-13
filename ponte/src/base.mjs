// base.mjs, a peca 2 vista pela ponte: Firestore como ponto de encontro.
// A ponte entra como o PROPRIO DIRETOR (SDK cliente, regras valem), sem chave
// de servico. So conexao de saida: o SDK do Firestore fala com a nuvem por
// saida, inclusive os ouvintes ao vivo. A ponte nunca abre porta.
//
// Para teste sem o login do diretor, use o emulador (PONTE_EMULADOR=1): o mesmo
// codigo, apontado para o emulador, com um usuario de teste com o e-mail do diretor.
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithCustomToken, connectAuthEmulator, onAuthStateChanged } from 'firebase/auth';
import {
  getFirestore, connectFirestoreEmulator, doc, setDoc, getDoc, addDoc, collection,
  query, where, onSnapshot, runTransaction, serverTimestamp, updateDoc,
} from 'firebase/firestore';

const DIRETOR = 'henrique.vieira@soulan.com.br';
const CONFIG = {
  projectId: 'a-fabrica-soulan',
  // apiKey e authDomain entram na instalacao, nao no repositorio. No emulador nao sao usados.
  apiKey: process.env.FIREBASE_API_KEY || 'emulador',
  authDomain: 'a-fabrica-soulan.firebaseapp.com',
};

export async function initBase({ emulador = false } = {}) {
  const app = initializeApp(CONFIG);
  const auth = getAuth(app);
  const db = getFirestore(app);
  if (emulador) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
  }
  return { app, auth, db };
}

// Heartbeat: sinal de vida da maquina. Online enquanto escreve; parada limpa marca offline.
export function iniciarHeartbeat(db, maquinaId, dados = {}, intervaloMs = 15000) {
  const ref = doc(db, 'maquinas', maquinaId);
  const bater = () => setDoc(ref, { maquinaId, estadoPonte: 'online', vistoPorUltimo: serverTimestamp(), ...dados }, { merge: true }).catch(() => {});
  bater();
  const t = setInterval(bater, intervaloMs);
  return { parar: async () => { clearInterval(t); try { await setDoc(ref, { estadoPonte: 'offline', vistoPorUltimo: serverTimestamp() }, { merge: true }); } catch {} } };
}

export const atualizarFabrica = (db, fabricaId, dados) => setDoc(doc(db, 'fabricas', fabricaId), { fabricaId, atualizadoEm: serverTimestamp(), ...dados }, { merge: true });
export const publicarAtividade = (db, fabricaId, passo) => addDoc(collection(db, 'fabricas', fabricaId, 'atividade'), { ...passo, em: serverTimestamp() });
export const publicarAprovacao = (db, aprovacaoId, dados) => setDoc(doc(db, 'aprovacoes', aprovacaoId), { aprovacaoId, situacao: 'pendente', resposta: null, criadoEm: serverTimestamp(), ...dados });

// Espera a resposta do diretor, vinda da base. Falha fechada: tempo esgotado e recusa.
export function esperarResposta(db, aprovacaoId, limiteMs = 300000) {
  return new Promise((resolve) => {
    let resolvido = false;
    const fim = (r) => { if (!resolvido) { resolvido = true; try { off(); } catch {} resolve(r); } };
    const off = onSnapshot(doc(db, 'aprovacoes', aprovacaoId), (snap) => {
      const d = snap.data();
      if (d && d.situacao === 'respondida') {
        if (d.resposta === 'aprovado' || d.resposta === 'aprovado com observacao') fim({ decisao: 'allow', resposta: d.resposta, observacao: d.observacao || null });
        else fim({ decisao: 'deny', resposta: d.resposta || 'recusado' });
      }
    }, () => fim({ decisao: 'deny', resposta: 'erro ao ouvir a base' }));
    setTimeout(() => fim({ decisao: 'deny', resposta: 'sem resposta no tempo' }), limiteMs);
  });
}

// Entrega de comando com idempotencia: numa transacao marca entregue antes de executar.
// Se a conexao cair, o comando continua pendente e e reentregue; o marcador impede
// executar duas vezes.
export async function tomarComando(db, comandoId) {
  const ref = doc(db, 'comandos', comandoId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists()) return null;
    const d = snap.data();
    if (d.situacao !== 'pendente') return null; // ja entregue, nao executa de novo
    tx.update(ref, { situacao: 'entregue', entregueEm: serverTimestamp() });
    return { id: comandoId, ...d };
  }).catch(() => null);
}

export function ouvirComandos(db, maquinaId, aoChegar) {
  const q = query(collection(db, 'comandos'), where('maquinaId', '==', maquinaId), where('situacao', '==', 'pendente'));
  return onSnapshot(q, (snap) => { snap.forEach((docSnap) => aoChegar(docSnap.id)); }, () => {});
}

// Reconciliacao no reinicio: pedido de aprovacao pendente de uma sessao que nao existe
// mais vira recusado por seguranca, com trilha. Nada executou, e o painel nao mostra
// pedido fantasma nem perde pedido real.
export async function reconciliarPendentes(db, maquinaId, sessoesVivas) {
  const q = query(collection(db, 'aprovacoes'), where('maquinaId', '==', maquinaId), where('situacao', '==', 'pendente'));
  return new Promise((resolve) => {
    const off = onSnapshot(q, async (snap) => {
      off();
      let n = 0;
      for (const s of snap.docs) {
        const d = s.data();
        if (!sessoesVivas.has(d.fabricaId)) {
          await updateDoc(s.ref, { situacao: 'respondida', resposta: 'recusado', observacao: 'ponte reiniciou, sessao encerrada, recusa por seguranca', respondidoEm: serverTimestamp() }).catch(() => {});
          n++;
        }
      }
      resolve(n);
    }, () => resolve(0));
  });
}

export { DIRETOR };
