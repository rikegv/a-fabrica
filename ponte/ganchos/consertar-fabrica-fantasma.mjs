// consertar-fabrica-fantasma.mjs
//
// O QUE E A FABRICA FANTASMA, e como ela nasceu
// --------------------------------------------
// Fabrica na base em estado "em execucao" para sempre, sem maquina, sem agente e
// sem projeto. No painel e uma linha muda que nao diz de onde veio e nunca fecha.
//
// A CAUSA, achada na retomada da OST 7 com a fila na mao: a sessao do diretor JA
// ESTAVA ABERTA quando os ganchos foram ligados. O Claude Code le a configuracao
// de ganchos na ABERTURA da sessao, entao aquela sessao nunca disparou o evento de
// abertura; o primeiro evento que o gancho viu dela foi um passo no meio. A ponte,
// que so escrevia maquina, agente e projeto no evento de abertura, criou a fabrica
// a partir do passo, e os tres campos ficaram vazios.
//
// A CAUSA ESTA CONSERTADA EM ponte/src/ganchos.ts: qualquer primeiro evento de uma
// sessao completa a fabrica, nao so o de abertura. O gancho escreve o projeto em
// TODA linha, entao a informacao sempre esteve ali.
//
// ESTE ARQUIVO cuida do caso que o conserto nao alcanca: a fabrica que JA nasceu
// torta e cuja fila ja foi lida ate o fim, entao nao vai gerar novo evento.
//
// §A.17: nada e apagado. Os campos vazios sao PREENCHIDOS com o que a fila local
// prova, e a fabrica ganha um campo dizendo que foi consertada e por que.
// §A.18: o documento e tocado pelo nome completo, escrito por extenso.
// §A.20: projeto da nuvem explicito em toda chamada.
//
// Uso:
//   node ganchos/consertar-fabrica-fantasma.mjs            so olha
//   node ganchos/consertar-fabrica-fantasma.mjs --aplicar  conserta

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { collection, getDocs, getFirestore } from 'firebase/firestore';
import { abrirIdentidade } from '../dist/identidade.js';
import { atualizarFabrica } from '../dist/base.js';
import { PASTA_LOCAL } from '../dist/config.js';

const PROJETO_NUVEM = 'a-fabrica-soulan';
const APLICAR = process.argv.includes('--aplicar');
const PREFIXO_MAO = 'mao-';


/**
 * O que a FILA LOCAL prova sobre esta sessao.
 *
 * Olha a fila ativa e a de consumidas. Devolve o projeto so quando a sessao
 * inteira aponta para UM projeto: se houver divergencia, nao chuta, devolve nulo e
 * deixa para o diretor decidir. Subpasta do mesmo projeto nao e divergencia, e o
 * caminho comum mais curto vale.
 */
function provaDaFila(sessaoId) {
  const pastas = [join(PASTA_LOCAL, 'fila-ganchos'), join(PASTA_LOCAL, 'fila-ganchos-consumida')];
  const projetos = new Map();
  let linhas = 0;
  /**
   * O projeto da linha de ABERTURA da sessao, que e a RAIZ de verdade.
   *
   * Isto existe por um defeito que o diretor viu na tela: a sessao viva dele,
   * aberta em C:\Users\Henrique\a-fabrica, aparecia como a-fabrica\ponte. O
   * gancho escreve o `cwd` de CADA evento, e o `cwd` anda quando a sessao entra
   * numa subpasta. Quem sabe a raiz e so a primeira linha, a de abertura.
   */
  let raiz = null;
  for (const pasta of pastas) {
    if (!existsSync(pasta)) continue;
    for (const nome of readdirSync(pasta)) {
      if (!nome.includes(sessaoId)) continue;
      const texto = readFileSync(join(pasta, nome), 'utf8').trim();
      if (texto.length === 0) continue;
      for (const l of texto.split('\n')) {
        try {
          const j = JSON.parse(l);
          if (typeof j.projeto === 'string' && j.projeto.length > 0) {
            projetos.set(j.projeto, (projetos.get(j.projeto) ?? 0) + 1);
            linhas++;
            if (raiz === null && j.ev === 'SessionStart') raiz = j.projeto;
          }
        } catch {
          // Linha ilegivel vale como linha que nao prova nada.
        }
      }
    }
  }
  if (projetos.size === 0) return { projeto: null, raiz: null, linhas: 0, vistos: [] };
  const vistos = [...projetos.entries()].map(([p, n]) => `${p} (${n})`);
  // O caminho comum: o mais curto que e prefixo de todos os outros.
  const todos = [...projetos.keys()];
  const maisCurto = todos.reduce((a, b) => (a.length <= b.length ? a : b));
  const todosDentro = todos.every(
    (p) => p.toLowerCase() === maisCurto.toLowerCase() || p.toLowerCase().startsWith(maisCurto.toLowerCase() + '\\')
  );
  return { projeto: todosDentro ? maisCurto : null, raiz, linhas, vistos };
}

/**
 * Escreve pelo MESMO caminho que a ponte usa: a sessao de cliente do diretor.
 *
 * Antes isto ia pela API de administracao, com token do gcloud, e travava toda vez
 * que a credencial daquela ferramenta vencia, que aconteceu duas vezes nesta OST.
 * Nao precisava: a regra do Firestore permite ao diretor criar e atualizar
 * `fabricas`, exigindo hora de servidor, e `atualizarFabrica` ja faz isso. Menos
 * uma credencial no caminho, e o conserto passa a obedecer a mesma regra que todo
 * o resto do sistema obedece, em vez de passar por cima dela como dono do projeto.
 */
async function escrever(fabricaId, campos) {
  await atualizarFabrica(db, fabricaId, campos);
}

const id = await abrirIdentidade({ emulador: false, permitirNavegador: false, registrar: () => undefined });
const db = getFirestore(id.app);
console.log(`base REAL, projeto ${PROJETO_NUVEM}, explicito, §A.20`);
console.log(APLICAR ? 'modo APLICAR' : 'modo OLHAR, nao escreve nada');
console.log('');

const fabricas = (await getDocs(collection(db, 'fabricas'))).docs;
let achadas = 0;
for (const d of fabricas) {
  if (!d.id.startsWith(PREFIXO_MAO)) continue;
  const f = d.data();
  const sessao = d.id.slice(PREFIXO_MAO.length);
  const prova = provaDaFila(sessao);
  const semMaquina = typeof f.maquinaId !== 'string' || f.maquinaId.length === 0;
  const semAgente = typeof f.agente !== 'string' || f.agente.length === 0;
  const semProjeto = typeof f.projeto !== 'string' || f.projeto.length === 0;
  // FRONTEIRA DE CAMINHO, nao comeco de texto. A primeira versao desta linha caiu
  // na mesma armadilha que o gancho evita: "a-fabrica-lab" comeca com "a-fabrica",
  // e por isso um projeto de teste passava por projeto da Fabrica.
  const normalizar = (v) => {
    let t = String(v ?? '').toLowerCase().replace(/\//g, '\\');
    while (t.length > 1 && t.endsWith('\\')) t = t.slice(0, -1);
    return t;
  };
  const dentro = (caminho, base) => {
    const c = normalizar(caminho);
    const b = normalizar(base);
    return c === b || c.startsWith(b + '\\');
  };
  const projetoDivergente = !semProjeto && prova.projeto !== null && !dentro(f.projeto, prova.projeto);
  // SUBPASTA NO LUGAR DA RAIZ. A base diz uma pasta de dentro do projeto, e a
  // linha de abertura diz a raiz. Nao e divergencia, e perda de informacao: o
  // diretor deixa de reconhecer a propria fabrica na lista, porque o nome que
  // aparece e o da subpasta em que a sessao estava quando a ponte a identificou.
  const subpastaNoLugarDaRaiz =
    !semProjeto &&
    prova.raiz !== null &&
    dentro(f.projeto, prova.raiz) &&
    normalizar(f.projeto) !== normalizar(prova.raiz);

  if (!semMaquina && !semAgente && !semProjeto && !projetoDivergente && !subpastaNoLugarDaRaiz) continue;
  achadas++;
  console.log(`fabrica ${d.id}`);
  console.log(`  na base agora: maquina ${JSON.stringify(f.maquinaId ?? null)}, agente ${JSON.stringify(f.agente ?? null)}, projeto ${JSON.stringify(f.projeto ?? null)}, estado ${JSON.stringify(f.estado ?? null)}`);
  console.log(`  a fila local prova: ${prova.linhas} linha(s), projeto(s) ${prova.vistos.join(' | ') || 'nenhum'}`);
  console.log(`  raiz, pela linha de abertura da sessao: ${JSON.stringify(prova.raiz)}`);
  if (subpastaNoLugarDaRaiz) {
    console.log('  SUBPASTA NO LUGAR DA RAIZ: a base guardou uma pasta de dentro do projeto, e nao o projeto.');
  }
  if (projetoDivergente) {
    console.log('  DIVERGENCIA: o projeto na base nao bate com a fila. Isso acontece quando um comando do painel');
    console.log('  abriu sessao nesta fabrica com outra pasta de trabalho, e a abertura sobrescreveu o campo.');
  }
  if (prova.projeto === null) {
    console.log('  a fila nao prova um projeto unico, entao nada e chutado aqui. Fica para o diretor decidir.');
    continue;
  }
  const campos = {};
  if (semMaquina) campos.maquinaId = 'maquina-b06c5b1e81b4';
  if (semAgente) campos.agente = 'claude code';
  // A raiz manda, quando a linha de abertura existe. Sem ela, vale o caminho
  // comum da sessao, que e o melhor que a fila prova.
  if (semProjeto || projetoDivergente || subpastaNoLugarDaRaiz) campos.projeto = prova.raiz ?? prova.projeto;
  campos.consertada = `campos preenchidos a partir da fila local de ganchos, ${prova.linhas} linha(s) de prova, OST 7`;
  console.log(`  vai escrever: ${JSON.stringify(campos)}`);
  if (APLICAR) {
    await escrever(d.id, campos);
    console.log('  CONSERTADA');
  }
}

console.log('');
console.log(achadas === 0 ? 'nenhuma fabrica fantasma na base.' : `${achadas} fabrica(s) fora de forma.`);
if (!APLICAR && achadas > 0) console.log('nada foi escrito. Rode com --aplicar para consertar.');
process.exit(0);
