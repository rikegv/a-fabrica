// provar-abrir-pelo-painel.mjs
//
// A ORDEM DE ABRIR, NA BASE REAL, DO JEITO QUE O PAINEL ESCREVE.
//
// Esta prova faz o papel do PAINEL e de mais nada: grava em `comandos` um
// documento com a MESMA forma que painel/src/dados/escritas.ts grava, pela
// credencial do diretor, e depois so OLHA a base. Quem executa e o servico da
// ponte, que ja esta no ar. Se o servico estiver parado, esta prova falha, e
// falha dizendo isso.
//
// O que ela responde, que foi o que o diretor perguntou:
//   o painel chegou a escrever na base?      documento criado, com identificador
//   a regra aceitou ou negou?                escrita aceita ou PERMISSION_DENIED
//   a ponte leu a ordem?                     situacao vira entregue
//   a ponte tentou abrir a fabrica?          a fabrica aparece em `fabricas`
//   a fabrica nasceu e voltou para a base?   estado e passos de atividade
//
// §A.17 pasta propria da rodada. §A.20 projeto explicito. Nada e apagado.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { collection, doc, getDoc, getDocs, onSnapshot, serverTimestamp, setDoc, getFirestore } from 'firebase/firestore';
import { abrirIdentidade } from '../dist/identidade.js';

const DIRETOR = 'henrique.vieira@soulan.com.br';
const MAQUINA = 'maquina-b06c5b1e81b4';

function selo() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

const RODADA = join('C:\\Users\\Henrique\\a-fabrica-lab\\rodadas', `${selo()}-ost7-abrir-pelo-painel`);
const PROJETO_DA_FABRICA = join(RODADA, 'projeto-do-diretor');
mkdirSync(PROJETO_DA_FABRICA, { recursive: true });
writeFileSync(join(PROJETO_DA_FABRICA, 'leia.txt'), 'CEREJA-DA-RODADA\n', 'utf8');

const linhas = [];
const reg = (t) => {
  const l = `${new Date().toISOString()} ${t}`;
  console.log(l);
  linhas.push(l);
};
let erros = 0;
const conferir = (ok, rotulo, detalhe) => {
  if (!ok) erros++;
  reg(`${ok ? 'PASSOU' : 'FALHOU'} ${rotulo}: ${detalhe}`);
};
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

const id = await abrirIdentidade({ emulador: false, permitirNavegador: false, registrar: () => undefined });
const db = getFirestore(id.app);
reg(`entrei na base REAL como ${id.usuario.email}, projeto a-fabrica-soulan, §A.20`);

// A ponte esta no ar? A prova nao finge que esta.
const maq = await getDoc(doc(db, 'maquinas', MAQUINA));
const estadoPonte = maq.exists() ? maq.data().estadoPonte : 'sem documento';
reg(`estado da ponte na base: ${JSON.stringify(estadoPonte)}`);
if (estadoPonte !== 'online') {
  reg('a ponte NAO esta online. Esta prova precisa do servico no ar, entao para aqui em vez de dar um verde falso.');
  writeFileSync(join(RODADA, 'saida.txt'), linhas.join('\n'), 'utf8');
  process.exit(1);
}

const fabricaId = `painel-${randomUUID()}`;
const comandoId = randomUUID();

// 1. O PAINEL ESCREVE. Mesma forma de escritas.ts: acao abrir, situacao pendente,
//    hora de servidor, origem legivel, maquina pareada.
const t0 = Date.now();
try {
  await setDoc(doc(db, 'comandos', comandoId), {
    comandoId,
    fabricaId,
    maquinaId: MAQUINA,
    texto: 'Leia o arquivo leia.txt desta pasta e responda so com o conteudo dele.',
    acao: 'abrir',
    cwd: PROJETO_DA_FABRICA,
    agente: 'claude code',
    situacao: 'pendente',
    criadoEm: serverTimestamp(),
    origem: `painel no computador, ${DIRETOR}`,
    entregueEm: null,
  });
  conferir(true, '1. o painel escreveu a ordem na base, e a REGRA ACEITOU', `comando ${comandoId.slice(0, 8)}, fabrica ${fabricaId.slice(0, 14)}`);
} catch (e) {
  conferir(false, '1. o painel escreveu a ordem na base', `a regra NEGOU: ${e instanceof Error ? e.message : String(e)}`);
  writeFileSync(join(RODADA, 'saida.txt'), linhas.join('\n'), 'utf8');
  process.exit(1);
}

// 2. A PONTE LEU? A situacao vira entregue.
let entregueEm = null;
for (let i = 0; i < 40 && entregueEm === null; i++) {
  await dormir(500);
  const c = await getDoc(doc(db, 'comandos', comandoId));
  if (c.exists() && c.data().situacao === 'entregue') entregueEm = Date.now();
}
conferir(
  entregueEm !== null,
  '2. a ponte LEU a ordem e marcou entregue',
  entregueEm === null ? 'continuou pendente por 20 s' : `entregue em ${entregueEm - t0} ms`
);

// 3. A FABRICA NASCEU e voltou para a base, com passos.
let nasceuEm = null;
let passos = 0;
let dados = null;
for (let i = 0; i < 60 && nasceuEm === null; i++) {
  await dormir(1000);
  const f = await getDoc(doc(db, 'fabricas', fabricaId));
  if (f.exists()) {
    dados = f.data();
    passos = (await getDocs(collection(db, 'fabricas', fabricaId, 'atividade'))).docs.length;
    if (passos > 0) nasceuEm = Date.now();
  }
}
conferir(
  nasceuEm !== null,
  '3. a FABRICA NASCEU na base e os passos chegaram',
  nasceuEm === null ? 'nao apareceu em 60 s' : `apareceu em ${nasceuEm - t0} ms, com ${passos} passo(s)`
);

if (dados !== null) {
  conferir(dados.origem === 'painel', '4. a fabrica diz que veio do painel', `origem ${JSON.stringify(dados.origem)}`);
  conferir(
    String(dados.projeto ?? '') === PROJETO_DA_FABRICA,
    '5. a fabrica aponta para a pasta que a ordem pediu, e nao para outra',
    `projeto ${JSON.stringify(dados.projeto)}`
  );
  conferir(dados.teste !== true, '6. fabrica de verdade NAO nasce com rotulo de teste, entao aparece na tela', `teste ${JSON.stringify(dados.teste ?? false)}`);
}

// 7. Ela termina.
let estadoFinal = dados?.estado ?? null;
for (let i = 0; i < 90 && estadoFinal !== 'concluida' && estadoFinal !== 'falhou'; i++) {
  await dormir(1000);
  const f = await getDoc(doc(db, 'fabricas', fabricaId));
  if (f.exists()) estadoFinal = f.data().estado;
}
const passosFinais = (await getDocs(collection(db, 'fabricas', fabricaId, 'atividade'))).docs;
conferir(
  estadoFinal === 'concluida',
  '7. a fabrica rodou ate o fim e fechou sozinha',
  `estado ${JSON.stringify(estadoFinal)}, ${passosFinais.length} passo(s)`
);
reg(`  passos: ${passosFinais.map((p) => p.data().tipo).join(', ')}`);

reg('');
reg(erros === 0 ? `PASSOU: ${7} de 7 etapas do caminho, na BASE REAL.` : `FALHOU: ${erros} etapa(s).`);
reg(`ROTULO: base REAL do projeto a-fabrica-soulan, servico da ponte no ar, ordem na forma exata do painel.`);
reg(`identificador desta fabrica, para o diretor achar na tela: ${fabricaId}`);
writeFileSync(join(RODADA, 'saida.txt'), linhas.join('\n'), 'utf8');
process.exit(erros === 0 ? 0 : 1);
