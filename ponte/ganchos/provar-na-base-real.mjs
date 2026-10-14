// provar-na-base-real.mjs, o Bloco 1 provado contra a BASE REAL.
//
// POR QUE ESTE ARQUIVO EXISTE, ao lado de provar-ao-vivo.mjs
// ---------------------------------------------------------
// provar-ao-vivo.mjs prova o Bloco 1 inteiro, mas com a base no EMULADOR, e diz
// isso no proprio rotulo. O pedaco que faltava era a nuvem, e faltava por um
// motivo so: a base real depende do login no navegador, que e um clique do
// diretor. Com a sessao na mao, este arquivo fecha o pedaco que faltava.
//
// O que e de verdade aqui, item por item, sem maquiar nenhum:
//   sessao do Claude Code   DE VERDADE, aberta aqui como o diretor abre na mao
//   projeto                 pasta nova desta rodada, fora do repositorio
//   gancho                  DE VERDADE, o mesmo instalado na configuracao geral
//   fila local              DE VERDADE, a mesma pasta que as sessoes do diretor usam
//   publicador              DE VERDADE, o SERVICO da ponte, que ja esta no ar
//   base                    REAL, projeto a-fabrica-soulan, §A.20 explicito
//
// COMO ELE NAO MENTE: esta prova nao publica nada por conta propria. Ela abre a
// sessao e depois so LE a nuvem. Se o servico da ponte nao estiver no ar, ela
// falha, e falha dizendo isso. O caminho provado e o caminho do dia a dia.
//
// §A.17 pasta propria da rodada, com data e hora. Nada apagado, nada sobrescrito.
// §A.6  nada escuta aqui. Esta prova le a base por conexao de SAIDA.

import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collection, getDocs, getFirestore, query as consulta, orderBy, where } from 'firebase/firestore';
import { abrirIdentidade } from '../dist/identidade.js';

const AQUI = dirname(fileURLToPath(import.meta.url));

function selo() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

const RODADA = join('C:\\Users\\Henrique\\a-fabrica-lab\\rodadas', `${selo()}-ost7-bloco1-base-real`);
const PROJETO = join(RODADA, 'projeto-do-diretor');
mkdirSync(PROJETO, { recursive: true });
// Uma palavra que so existe nesta rodada. Se ela aparecer no passo publicado, o
// caminho inteiro andou: sessao, gancho, fila, servico, nuvem.
const SENHA_DA_RODADA = `AMORA-${selo()}`;
writeFileSync(join(PROJETO, 'leia.txt'), `${SENHA_DA_RODADA}\n`, 'utf8');

const linhas = [];
function reg(t) {
  const linha = `${new Date().toISOString()} ${t}`;
  console.log(linha);
  linhas.push(linha);
}
function guardar() {
  writeFileSync(join(RODADA, 'saida.txt'), linhas.join('\n'), 'utf8');
}

/** Abre uma sessao do Claude Code DE VERDADE, do jeito que o diretor abre. */
function abrirSessaoDeVerdade(pasta) {
  return new Promise((ok) => {
    const comecou = Date.now();
    // Modo de permissao fixado na mao, §A.6: nunca o padrao. Esta sessao so le.
    const filho = spawn(
      process.env.ComSpec ?? 'cmd.exe',
      ['/c', 'claude', '-p', 'Leia o arquivo leia.txt desta pasta e responda so com o conteudo dele.',
        '--model', 'haiku', '--permission-mode', 'default', '--allowedTools', 'Read'],
      { cwd: pasta, encoding: 'utf8', windowsHide: true }
    );
    let saida = '';
    filho.stdout.on('data', (c) => (saida += c));
    filho.stderr.on('data', (c) => (saida += c));
    filho.on('close', (codigo) => ok({ codigo, saida, levou: Date.now() - comecou }));
  });
}

function esperar(ms) {
  return new Promise((ok) => setTimeout(ok, ms));
}

async function principal() {
  reg(`rodada em ${RODADA}`);
  reg('base REAL, projeto a-fabrica-soulan, §A.20 explicito');
  reg(`palavra desta rodada, para seguir o rastro: ${SENHA_DA_RODADA}`);

  const id = await abrirIdentidade({ emulador: false, permitirNavegador: false, registrar: (l) => reg(`[identidade] ${l}`) });
  const db = getFirestore(id.app);
  reg(`leitor entrou na base como ${id.usuario.email}, degrau ${id.degrau}`);

  // Fotografia do ANTES. Sem isto, uma fabrica antiga passaria por nova.
  const antes = new Set((await getDocs(collection(db, 'fabricas'))).docs.map((d) => d.id));
  reg(`fabricas na base antes de abrir a sessao: ${antes.size}`);

  reg('abrindo uma sessao do Claude Code DE VERDADE na pasta da rodada, como o diretor abre na mao');
  const sessao = await abrirSessaoDeVerdade(PROJETO);
  reg(`a sessao terminou com codigo ${sessao.codigo} em ${sessao.levou} ms`);
  reg(`o que o agente respondeu: ${JSON.stringify(sessao.saida.trim().slice(0, 200))}`);
  const leuOArquivo = sessao.saida.includes(SENHA_DA_RODADA);
  reg(`a sessao leu o arquivo da rodada: ${leuOArquivo}`);

  // Agora e so esperar o SERVICO publicar. Quem publica e ele, nao esta prova.
  reg('esperando o servico da ponte publicar a fila, sem ajudar e sem publicar nada daqui');
  let nova = null;
  let passos = [];
  for (let tentativa = 1; tentativa <= 20; tentativa++) {
    await esperar(3000);
    const agora = (await getDocs(collection(db, 'fabricas'))).docs;
    const novas = agora.filter((d) => !antes.has(d.id));
    if (novas.length > 0) {
      // A que aponta para a pasta desta rodada.
      const minha = novas.find((d) => String(d.data().projeto ?? '').includes('projeto-do-diretor')) ?? novas[0];
      const atividade = await getDocs(consulta(collection(db, 'fabricas', minha.id, 'atividade'), orderBy('seq', 'asc')));
      passos = atividade.docs.map((d) => d.data());
      if (passos.length > 0) {
        nova = minha;
        reg(`apareceu sozinha na base depois de ${tentativa * 3} s: ${minha.id}, com ${passos.length} passo(s)`);
        break;
      }
    }
    reg(`  tentativa ${tentativa}: ${novas.length} fabrica(s) nova(s), ainda sem passo publicado`);
  }

  const vereditos = [];
  const conferir = (rotulo, valor, detalhe) => {
    vereditos.push({ rotulo, passou: valor === true, detalhe });
    reg(`  ${valor === true ? 'PASSOU' : 'FALHOU'} ${rotulo}: ${detalhe}`);
  };

  reg('');
  reg('CONFERENCIAS');
  conferir('a sessao do Claude Code rodou de verdade e leu o arquivo da rodada', leuOArquivo,
    `codigo ${sessao.codigo}, achou a palavra da rodada na resposta: ${leuOArquivo}`);
  conferir('a fabrica apareceu SOZINHA na base real, sem ninguem abrir pelo painel', nova !== null,
    nova === null ? 'nenhuma fabrica nova com passo publicado' : `fabrica ${nova.id}`);

  if (nova !== null) {
    const dados = nova.data();
    conferir('a fabrica foi criada como aberta na mao, pelo prefixo que o publicador usa',
      nova.id.startsWith('mao-'), `identificador ${nova.id}`);
    conferir('todo passo publicado diz que a origem foi a mao, nao o painel',
      passos.length > 0 && passos.every((p) => p.origem === 'mao'),
      `origens ${[...new Set(passos.map((p) => String(p.origem)))].join(', ')}`);
    conferir('a fabrica aponta para a pasta do projeto onde a sessao foi aberta',
      String(dados.projeto ?? '').includes('projeto-do-diretor'), `projeto ${JSON.stringify(dados.projeto)}`);
    conferir('a fabrica nasceu com o agente claude code e com inicio gravado',
      dados.agente === 'claude code' && typeof dados.inicio === 'string',
      `agente ${JSON.stringify(dados.agente)}, inicio ${JSON.stringify(dados.inicio)}`);
    conferir('os passos chegaram, em ordem, sem buraco na sequencia',
      passos.length > 0 && passos.every((p, i) => p.seq === i),
      `${passos.length} passo(s), sequencia ${passos.map((p) => p.seq).join(',')}`);
    const tipos = passos.map((p) => p.tipo ?? p.evento ?? '?');
    reg(`  passos publicados: ${tipos.join(', ')}`);
    const comCusto = passos.filter((p) => typeof p.custoDoGanchoMs === 'number');
    if (comCusto.length > 0) {
      const ms = comCusto.map((p) => p.custoDoGanchoMs).sort((a, b) => a - b);
      reg(`  custo do gancho POR DENTRO, medido nesta rodada: ${ms.length} medida(s), menor ${ms[0]} ms, mediana ${ms[Math.floor(ms.length / 2)]} ms, maior ${ms[ms.length - 1]} ms`);
    }
    const texto = JSON.stringify(passos);
    conferir('nada com forma de credencial foi publicado junto com os passos',
      !/AIzaSy|refresh_token|Bearer\s+[A-Za-z0-9._-]{20,}|ya29\./.test(texto),
      'procurei chave do Firebase, token de atualizacao, portador e token do Google');
    conferir('§A.11, nenhum travessao no que o diretor le na tela',
      !/\u2014/.test(texto), 'procurei travessao nos passos publicados');
  }

  reg('');
  const falharam = vereditos.filter((v) => !v.passou);
  if (falharam.length === 0) {
    reg(`PASSOU: ${vereditos.length} de ${vereditos.length} conferencias. O Bloco 1 anda na BASE REAL, fim a fim.`);
  } else {
    reg(`FALHOU: ${falharam.length} de ${vereditos.length} conferencias nao fecharam.`);
  }
  reg('ROTULO: base REAL do projeto a-fabrica-soulan, sessao do Claude Code de verdade, publicador e o SERVICO no ar.');
  guardar();
  process.exit(falharam.length === 0 ? 0 : 1);
}

principal().catch((e) => {
  reg(`FALHOU com erro: ${e instanceof Error ? e.stack : String(e)}`);
  guardar();
  process.exit(1);
});
