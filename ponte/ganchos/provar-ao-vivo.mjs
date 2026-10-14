// provar-ao-vivo.mjs, o Bloco 1 provado de ponta a ponta.
//
// O QUE ELE PROVA, e por que cada parte importa
// ---------------------------------------------
// As provas de ponte/src/testes/prova-ganchos.ts cobrem o gancho e a traducao sem
// base nenhuma. Esta prova fecha o unico pedaco que faltava: a PONTE lendo a fila
// de verdade e PUBLICANDO na base, com sessoes do Claude Code abertas na mao.
//
// O que e de verdade aqui, sem maquiar:
//   sessao do Claude Code   DE VERDADE, aberta na mao, nada simulado
//   gancho                  DE VERDADE, o mesmo instalado na configuracao geral
//   fila local              DE VERDADE, a mesma pasta que as sessoes do diretor usam
//   publicador              DE VERDADE, o mesmo codigo que o servico roda
//   base                    EMULADOR, com as MESMAS regras que estao na nuvem
//
// O rotulo e esse e nao outro: base no emulador. A base real depende do login no
// navegador do diretor, que e um clique dele.
//
// §A.17 pasta propria da rodada, com data e hora. Nada apagado.
// §A.6  nada escuta. O publicador le arquivo e escreve na base por saida.

import { spawn } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = join(AQUI, '..');

function selo() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}`;
}

const RODADA = join('C:\\Users\\Henrique\\a-fabrica-lab\\rodadas', `${selo()}-ost7-bloco1-ponta-a-ponta`);
const PROJETO_A = join(RODADA, 'projeto-um');
const PROJETO_B = join(RODADA, 'projeto-dois');
mkdirSync(PROJETO_A, { recursive: true });
mkdirSync(PROJETO_B, { recursive: true });
writeFileSync(join(PROJETO_A, 'leia.txt'), 'palavra-do-um\n', 'utf8');
writeFileSync(join(PROJETO_B, 'leia.txt'), 'palavra-do-dois\n', 'utf8');

const SAIDA = join(RODADA, 'saida.txt');
let erros = 0;
function reg(t) {
  console.log(t);
  appendFileSync(SAIDA, `${t}\n`, 'utf8');
}
function conferir(ok, rotulo, detalhe) {
  if (!ok) erros++;
  reg(`  ${ok ? 'PASSOU' : 'FALHOU'} ${rotulo}: ${detalhe}`);
}
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

const PASTA_PONTE = process.env.PONTE_PASTA_LOCAL || join(homedir(), '.a-fabrica-ponte');
const FILA = join(PASTA_PONTE, 'fila-ganchos');

function arquivosDaFila() {
  try {
    return readdirSync(FILA).filter((n) => n.endsWith('.jsonl'));
  } catch {
    return [];
  }
}

/** Abre uma sessao de verdade do Claude Code, na mao, e devolve o identificador dela. */
function sessaoNaMao(cwd, pedido) {
  return new Promise((resolve) => {
    const t0 = process.hrtime.bigint();
    const f = spawn('claude', ['-p', pedido, '--output-format', 'json'], {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
    });
    let saida = '';
    f.stdout.on('data', (d) => (saida += d.toString('utf8')));
    f.stderr.on('data', (d) => (saida += d.toString('utf8')));
    f.on('close', (codigo) => {
      let sid = null;
      try {
        sid = JSON.parse(saida).session_id ?? null;
      } catch {
        sid = null;
      }
      resolve({ sid, codigo, ms: Number(process.hrtime.bigint() - t0) / 1e6, saida });
    });
  });
}

async function principal() {
  reg(`rodada em ${RODADA}`);
  reg('ROTULO HONESTO: sessao do Claude Code, gancho, fila e publicador de VERDADE. Base no EMULADOR.');
  reg(`fila lida: ${FILA}`);
  reg('');

  // O publicador e o MESMO codigo que o servico roda. Importado do que foi
  // compilado, nao de uma copia escrita para a prova.
  process.env.PONTE_EMULADOR = '1';
  const { initBase } = await import(`file://${join(RAIZ, 'dist', 'base.js').replace(/\\/g, '/')}`);
  const { varrerFila, PREFIXO_MAO } = await import(`file://${join(RAIZ, 'dist', 'ganchos.js').replace(/\\/g, '/')}`);
  const { collection, doc, getDoc, getDocs, orderBy, query } = await import('firebase/firestore');

  const base = await initBase({ emulador: true, registrar: (l) => reg(`  [identidade] ${l}`) });
  reg(`publicador entrou na base como ${base.identidade.usuario.email}, degrau ${base.identidade.degrau}`);
  const db = base.db;
  reg('');

  // ---- PARTE 1, duas sessoes na mao, ao mesmo tempo ----------------------
  reg('PARTE 1, duas sessoes do Claude Code abertas na mao AO MESMO TEMPO');
  const antes = new Set(arquivosDaFila());
  const [um, dois] = await Promise.all([
    sessaoNaMao(PROJETO_A, 'Leia o arquivo leia.txt desta pasta e responda apenas com o conteudo dele.'),
    sessaoNaMao(PROJETO_B, 'Liste os arquivos desta pasta com o comando ls e responda apenas PRONTO.'),
  ]);
  reg(`  sessao um: ${um.sid ?? 'sem identificador'}, codigo ${String(um.codigo)}, ${um.ms.toFixed(0)} ms`);
  reg(`  sessao dois: ${dois.sid ?? 'sem identificador'}, codigo ${String(dois.codigo)}, ${dois.ms.toFixed(0)} ms`);
  const novos = arquivosDaFila().filter((n) => !antes.has(n));
  conferir(
    um.codigo === 0 && dois.codigo === 0,
    'as duas sessoes do diretor terminaram normalmente',
    `codigos ${String(um.codigo)} e ${String(dois.codigo)}, com a ponte NAO rodando como servico`
  );
  conferir(
    novos.length >= 2,
    'as duas se anunciaram na fila, cada uma no seu arquivo',
    `${novos.length} arquivo(s) novo(s) na fila: ${novos.join(', ')}`
  );

  // ---- PARTE 2, o publicador levando a fila para a base -------------------
  reg('');
  reg('PARTE 2, o publicador da ponte lendo a fila e publicando na base');
  const r1 = await varrerFila(db, 'maquina-prova-bloco1', (l) => reg(`  [ganchos] ${l}`));
  conferir(
    r1.passosPublicados > 0 && r1.erros.length === 0,
    'a varredura publicou sem erro',
    `${r1.passosPublicados} passo(s), ${r1.sessoesNovas} sessao(oes) nova(s), ${r1.sessoesEncerradas} encerrada(s), ${r1.erros.length} erro(s)`
  );

  for (const sid of [um.sid, dois.sid].filter(Boolean)) {
    const fabricaId = `${PREFIXO_MAO}${sid}`;
    const f = await getDoc(doc(db, 'fabricas', fabricaId));
    const d = f.data();
    const passos = await getDocs(query(collection(db, 'fabricas', fabricaId, 'atividade'), orderBy('seq', 'asc')));
    const tipos = passos.docs.map((p) => p.data().tipo);
    conferir(
      f.exists() && d.estado === 'concluida' && typeof d.projeto === 'string' && tipos.includes('init') && tipos.includes('fim'),
      `a fabrica ${fabricaId.slice(0, 18)} chegou na base com a sessao inteira`,
      `estado ${String(d?.estado)}, projeto ${String(d?.projeto).slice(-24)}, ${passos.size} passo(s): ${tipos.join(', ')}`
    );
    writeFileSync(
      join(RODADA, `fabrica-${sid}.json`),
      JSON.stringify({ fabrica: d, passos: passos.docs.map((p) => p.data()) }, null, 2),
      'utf8'
    );
  }

  // ---- PARTE 3, nao publica duas vezes -----------------------------------
  reg('');
  reg('PARTE 3, segunda varredura: nada pode subir de novo');
  const r2 = await varrerFila(db, 'maquina-prova-bloco1', (l) => reg(`  [ganchos] ${l}`));
  conferir(
    r2.passosPublicados === 0,
    'a marca de leitura impede republicar',
    `segunda varredura publicou ${r2.passosPublicados} passo(s), tem de ser 0`
  );

  // ---- PARTE 4, sessao encerrada vai para a pasta de consumidos ----------
  reg('');
  reg('PARTE 4, arquivo de sessao encerrada arquivado, nunca apagado, §A.17');
  const consumida = join(PASTA_PONTE, 'fila-ganchos-consumida');
  const arquivados = existsSync(consumida) ? readdirSync(consumida) : [];
  const doNosso = arquivados.filter((n) => [um.sid, dois.sid].some((s) => s && n.includes(s)));
  conferir(
    doNosso.length >= 2,
    'as duas sessoes encerradas foram movidas para a pasta de consumidas',
    `${doNosso.length} arquivo(s): ${doNosso.join(', ')}`
  );
  const aindaNaFila = arquivosDaFila().filter((n) => [um.sid, dois.sid].some((s) => s && n.includes(s)));
  conferir(aindaNaFila.length === 0, 'elas sairam da fila ativa', `${aindaNaFila.length} sobrando na fila`);

  // ---- PARTE 5, a mascara no caminho de verdade --------------------------
  reg('');
  reg('PARTE 5, uma sessao que escreve algo com cara de credencial no comando');
  const antes5 = new Set(arquivosDaFila());
  const tres = await sessaoNaMao(
    PROJETO_A,
    'Rode exatamente este comando com a ferramenta de terminal, e nada mais: echo token=AMf-vBxINVENTADOnaoEhCredencialDeVerdade0123456789'
  );
  reg(`  sessao tres: ${tres.sid ?? 'sem identificador'}, codigo ${String(tres.codigo)}`);
  await dormir(500);
  const novos5 = arquivosDaFila().filter((n) => !antes5.has(n));
  reg(`  arquivo(s) novo(s) na fila: ${novos5.join(', ') || 'nenhum'}`);
  const r3 = await varrerFila(db, 'maquina-prova-bloco1', (l) => reg(`  [ganchos] ${l}`));
  reg(`  varredura: ${r3.passosPublicados} passo(s), ${r3.mascaradas} com mascara`);
  if (tres.sid) {
    const fabricaId = `${PREFIXO_MAO}${tres.sid}`;
    const passos = await getDocs(query(collection(db, 'fabricas', fabricaId, 'atividade'), orderBy('seq', 'asc')));
    const tudo = JSON.stringify(passos.docs.map((p) => p.data()));
    const vazou = tudo.includes('AMf-vBxINVENTADOnaoEhCredencialDeVerdade0123456789');
    const mascarou = tudo.includes('[credencial mascarada]');
    conferir(
      !vazou,
      'a credencial NAO chegou na base',
      vazou ? 'VAZOU, o texto da credencial esta na base' : `nao vazou; mascara aplicada: ${mascarou}`
    );
    writeFileSync(join(RODADA, `fabrica-mascara-${tres.sid}.json`), JSON.stringify(passos.docs.map((p) => p.data()), null, 2), 'utf8');
    const linhaDoAlvo = passos.docs.map((p) => p.data()).find((p) => typeof p.alvo === 'string' && p.alvo.includes('echo'));
    if (linhaDoAlvo) reg(`  o que a base guardou no lugar: ${String(linhaDoAlvo.alvo).slice(0, 110)}`);
  }

  // ---- PARTE 6, o publicador morto no meio -------------------------------
  reg('');
  reg('PARTE 6, publicador MORTO com sessao do diretor acontecendo');
  reg('  (esta e a prova que a OST pede: mate a ponte e a sessao do diretor continua normal)');
  const antes6 = new Set(arquivosDaFila());
  const quatro = await sessaoNaMao(PROJETO_B, 'Responda apenas com a palavra QUATRO. Nao use nenhuma ferramenta.');
  conferir(
    quatro.codigo === 0,
    'com NENHUM publicador no ar, a sessao do diretor terminou normalmente',
    `codigo ${String(quatro.codigo)}, ${quatro.ms.toFixed(0)} ms`
  );
  const novos6 = arquivosDaFila().filter((n) => !antes6.has(n));
  conferir(
    novos6.length >= 1,
    'o que ela fez ficou guardado na fila, esperando a ponte voltar',
    `${novos6.length} arquivo(s) novo(s): ${novos6.join(', ')}`
  );
  const r4 = await varrerFila(db, 'maquina-prova-bloco1', (l) => reg(`  [ganchos] ${l}`));
  conferir(
    r4.passosPublicados > 0,
    'quando a ponte voltou, ela publicou o que estava guardado, nada perdido',
    `${r4.passosPublicados} passo(s) publicado(s) depois da volta`
  );

  // ---- PARTE 7, trava de processo unico do publicador --------------------
  reg('');
  reg('PARTE 7, dois publicadores na mesma maquina: o segundo NAO publica');
  reg('  (achado desta propria OST: duas provas rodaram juntas e uma mentiu por causa disso)');
  {
    const { iniciarPublicadorDeGanchos } = await import(`file://${join(RAIZ, 'dist', 'ganchos.js').replace(/\\/g, '/')}`);
    const primeiro = iniciarPublicadorDeGanchos(db, 'maquina-prova-bloco1', { registrar: (l) => reg(`  [um] ${l}`) });
    const segundo = iniciarPublicadorDeGanchos(db, 'maquina-prova-bloco1', { registrar: (l) => reg(`  [dois] ${l}`) });
    conferir(
      primeiro.ativo === true && segundo.ativo === false,
      'o primeiro publicador e o dono da fila, o segundo sai calado',
      `primeiro ativo ${String(primeiro.ativo)}, segundo ativo ${String(segundo.ativo)}`
    );
    const doSegundo = await segundo.agora();
    conferir(
      doSegundo.passosPublicados === 0,
      'o segundo nao publica nem quando mandam publicar na mao',
      `${doSegundo.passosPublicados} passo(s), tem de ser 0`
    );
    primeiro.parar();
    const terceiro = iniciarPublicadorDeGanchos(db, 'maquina-prova-bloco1', { registrar: () => undefined });
    conferir(
      terceiro.ativo === true,
      'quando o dono para, a fila volta a aceitar dono',
      `terceiro ativo ${String(terceiro.ativo)}`
    );
    terceiro.parar();
    segundo.parar();
  }

  reg('');
  reg(`RESUMO: ${erros === 0 ? 'o Bloco 1 fecha de ponta a ponta, com base no EMULADOR' : `${erros} caso(s) fora do esperado`}`);
  reg('O que falta para fechar contra a BASE REAL: o login no navegador do diretor, um clique.');
  process.exit(erros === 0 ? 0 : 1);
}

principal().catch((e) => {
  reg(`prova quebrou: ${e instanceof Error ? `${e.message}\n${e.stack ?? ''}` : String(e)}`);
  process.exit(1);
});
