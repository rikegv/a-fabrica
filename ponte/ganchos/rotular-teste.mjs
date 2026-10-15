// rotular-teste.mjs, poe o rotulo de teste no que JA esta na base.
//
// Decisao do diretor na retomada da OST 7: lixo de teste em producao se ROTULA e
// se FILTRA no painel, NUNCA se apaga, §A.17. Para frente, a propria rodada de
// teste ja nasce rotulada (PONTE_ROTULO_TESTE=1). Este arquivo cuida do que subiu
// antes disso existir.
//
// COMO ELE DECIDE o que e teste, e por que nao adivinha
// ----------------------------------------------------
// Nao olha nome, nao usa heuristica solta. Olha duas evidencias duras:
//   1. a fabrica pertence a uma MAQUINA que nunca existiu de verdade, isto e, uma
//      maquina de rodada de teste, reconhecida pelo proprio identificador que as
//      provas escrevem (maquina-TESTE-... e maquina-teste-...);
//   2. ou o projeto dela aponta para dentro de C:\Users\Henrique\a-fabrica-lab,
//      que e a pasta de rodadas da fabrica, e nao pasta de trabalho do diretor.
// Qualquer coisa fora dessas duas nao e tocada.
//
// §A.18: documento por documento, pelo nome completo. §A.20: projeto explicito.
//
// Uso:
//   node ganchos/rotular-teste.mjs            so olha
//   node ganchos/rotular-teste.mjs --aplicar  rotula

import { collection, doc, getDocs, getFirestore, serverTimestamp, setDoc } from 'firebase/firestore';
import { abrirIdentidade } from '../dist/identidade.js';

const PROJETO = 'a-fabrica-soulan';
const APLICAR = process.argv.includes('--aplicar');
const PASTA_DE_RODADAS = 'c:\\users\\henrique\\a-fabrica-lab';


/**
 * Rotula pelo MESMO caminho que a ponte usa: a sessao de cliente do diretor.
 *
 * Antes ia pela API de administracao com token do gcloud, e travava toda vez que
 * a credencial daquela ferramenta vencia. A regra do Firestore ja permite ao
 * diretor atualizar `fabricas` e `maquinas` exigindo hora de servidor, entao o
 * rotulo passa a obedecer a mesma regra que o resto do sistema obedece, em vez de
 * passar por cima dela como dono do projeto.
 */
async function rotular(colecao, docId) {
  await setDoc(
    doc(db, colecao, docId),
    {
      teste: true,
      rotuladaEm: 'rotulada como rodada de teste na OST 7, por decisao do diretor. Nada foi apagado, §A.17.',
      atualizadoEm: serverTimestamp(),
    },
    { merge: true }
  );
}

const id = await abrirIdentidade({ emulador: false, permitirNavegador: false, registrar: () => undefined });
const db = getFirestore(id.app);

const dentroDoLab = (p) => {
  const c = String(p ?? '').toLowerCase().replace(/\//g, '\\');
  return c === PASTA_DE_RODADAS || c.startsWith(PASTA_DE_RODADAS + '\\');
};
const maquinaDeTeste = (m) => /^maquina-teste/i.test(String(m ?? ''));

console.log(`base REAL, projeto ${PROJETO}, explicito, §A.20`);
console.log(APLICAR ? 'modo APLICAR' : 'modo OLHAR, nao escreve nada');
console.log('');

let fabricasRotuladas = 0;
for (const d of (await getDocs(collection(db, 'fabricas'))).docs) {
  const f = d.data();
  if (f.teste === true) {
    console.log(`ja rotulada: ${d.id}`);
    continue;
  }
  const porMaquina = maquinaDeTeste(f.maquinaId);
  // A PASTA DE RODADAS DA FABRICA NUNCA E TRABALHO DE VERDADE, venha a ordem de
  // onde vier.
  //
  // A primeira versao disto abria excecao para fabrica aberta pelo diretor no
  // painel, com medo de esconder trabalho dele. O diretor olhou a tela e disse o
  // contrario, com estas palavras: "uma pasta de rodada de teste do laboratorio
  // aparece como fabrica de verdade". E ele tem razao. Aquela fabrica existiu
  // porque o atalho de pasta do painel oferecia caminhos de rodada de teste, o
  // que ja foi consertado; o que ela produziu ficou dentro de a-fabrica-lab e nao
  // e trabalho. Rotular nao apaga nada, §A.17: ela continua na base, com a
  // trilha inteira, so sai da frente.
  const porProjeto = dentroDoLab(f.projeto);
  if (!porMaquina && !porProjeto) continue;
  const motivo = porMaquina ? 'maquina de rodada de teste' : 'projeto dentro da pasta de rodadas da fabrica';
  console.log(`rotular fabrica ${d.id}: ${motivo}`);
  fabricasRotuladas++;
  if (APLICAR) await rotular('fabricas', d.id);
}

// MAQUINA NAO E ROTULADA POR AQUI, E O MOTIVO E DE HONESTIDADE.
//
// A regra do Firestore so aceita escrita em `maquinas` com `vistoPorUltimo` igual
// a hora do servidor NAQUELE instante. Ou seja: para pendurar um rotulo numa
// maquina de teste morta, esta ferramenta teria de escrever que ela acabou de ser
// vista. Isso faria uma maquina que nunca mais vai existir aparecer como se
// tivesse dado sinal agora, e o indicador de ponte do painel le justamente esse
// campo. Rotular mentindo o ultimo sinal e pior do que nao rotular.
//
// Entao: as maquinas de teste ficam sem rotulo, visiveis apenas como offline, que
// e a verdade sobre elas. Se o diretor quiser o rotulo, existem dois caminhos
// honestos, os dois decisao dele: a API de administracao, que nao passa pela
// regra, ou mudar a regra para aceitar rotulo sem mexer no ultimo sinal.
let maquinasRotuladas = 0;
const maquinasDeTeste = (await getDocs(collection(db, 'maquinas'))).docs.filter(
  (d) => d.data().teste !== true && (maquinaDeTeste(d.id) || maquinaDeTeste(d.data().maquinaId))
);
for (const d of maquinasDeTeste) {
  console.log(`maquina de teste SEM rotulo, de proposito: ${d.id}`);
  console.log('  rotular por aqui exigiria escrever que ela foi vista agora, e ela nao foi.');
}

console.log('');
console.log(`fabricas a rotular: ${fabricasRotuladas}, maquinas a rotular: ${maquinasRotuladas}`);
console.log(APLICAR ? 'rotuladas. Nada apagado, §A.17.' : 'nada escrito. Rode com --aplicar.');
process.exit(0);
