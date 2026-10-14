// publicar.mjs, publica a regra e o painel sem depender do Firebase CLI.
//
// POR QUE ESTE ARQUIVO EXISTE
// ---------------------------
// Na OST 6, o Firebase CLI da maquina perdeu a credencial e passou a pedir login
// interativo. Isso travou tres entregas de uma vez: republicar o painel,
// republicar a regra do Firestore e aplicar as opcoes do banco. Nada disso era
// defeito do sistema; era credencial de UMA FERRAMENTA vencida levando o trabalho
// embora.
//
// Este script tira essa dependencia. Ele publica pelas APIs de administracao do
// Google, com o token do gcloud, que e o que a maquina do diretor ja tem. O
// Firebase CLI deixa de ser caminho obrigatorio.
//
// §A.20, projeto sempre explicito: o projeto esta escrito em texto aqui e vai em
// toda chamada. NUNCA se confia no projeto padrao, que na maquina do diretor
// aponta para dash-iff, um sistema real em producao.
//
// §A.7, O GATE VALE AQUI TAMBEM, e isto e o ponto mais importante deste cabecalho.
// Publicar por API foi exatamente o caminho que, na OST 7, descobriu-se que
// passava por fora do gate de deploy, porque nenhum comando de curl tem a palavra
// deploy dentro. Duas coisas foram feitas sobre isso:
//   1. o gate passou a vigiar escrita nos enderecos de administracao que publicam
//      (scripts/gate-deploy.sh), e tambem o nome deste arquivo;
//   2. ESTE script confere a flag de liberacao por conta propria, e RECUSA publicar
//      sem ela, mesmo que alguem o chame por um caminho que o gate nao veja.
// Cinto e suspensorio, de proposito. Nenhum agente contorna o gate.
//
// Uso:
//   node scripts/publicar.mjs --regra      publica firebase/firestore.rules
//   node scripts/publicar.mjs --indices    publica firebase/firestore.indexes.json
//   node scripts/publicar.mjs --painel     publica painel/out na hospedagem
//   node scripts/publicar.mjs --conferir   so compara o que esta na nuvem, nao publica

import { execFileSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PROJETO = 'a-fabrica-soulan';
const SITE = 'a-fabrica-soulan';
const ESTADO = join(RAIZ, '.claude', 'state');

const ARQUIVO_REGRA = join(RAIZ, 'firebase', 'firestore.rules');
const ARQUIVO_INDICES = join(RAIZ, 'firebase', 'firestore.indexes.json');
const PASTA_PAINEL = join(RAIZ, 'painel', 'out');

function selo() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}`;
}

const RODADA = join('C:\\Users\\Henrique\\a-fabrica-lab\\rodadas', `${selo()}-ost7-publicacao`);
const linhas = [];
function reg(t) {
  console.log(t);
  linhas.push(t);
}
function guardar(nome, conteudo) {
  mkdirSync(RODADA, { recursive: true });
  writeFileSync(join(RODADA, nome), conteudo, 'utf8');
}

/** §A.7: sem flag de liberacao, nao publica. Falha fechada. */
function exigirFlag(oQue) {
  let flags = [];
  try {
    flags = readdirSync(ESTADO).filter((n) => n.startsWith('READY_'));
  } catch {
    flags = [];
  }
  if (flags.length === 0) {
    console.error(`publicar: BLOQUEADO (${oQue}).`);
    console.error(`Motivo: nenhuma flag READY_ em ${ESTADO}, §A.7.`);
    console.error('Para liberar, apos validacao do diretor: touch .claude/state/READY_<motivo>');
    console.error('Remova a flag logo depois de publicar.');
    process.exit(2);
  }
  reg(`flag de liberacao encontrada (${flags.join(', ')}), publicacao de ${oQue} liberada, §A.7`);
}

function token() {
  // Token do gcloud do diretor. Credencial de FERRAMENTA, para administrar a
  // nuvem; nao e e nunca sera a credencial de execucao da ponte, que entra como
  // cliente pelo login no navegador. Decisao 1 do diretor, OST 6 parte 2.
  //
  // No Windows o gcloud e um arquivo de lote (gcloud.cmd), e chamar programa
  // direto nao resolve extensao de lote: a primeira versao disto morreu com
  // ENOENT nas duas formas. Quem resolve extensao e o interpretador de comandos,
  // entao e por ele que a chamada passa. A linha e fixa em texto, sem nada de
  // fora interpolado, que e o que torna isso seguro.
  let ultimoErro = null;
  const comSpec = process.env.ComSpec ?? 'cmd.exe';
  for (const tentativa of [
    () => execFileSync(comSpec, ['/c', 'gcloud auth print-access-token'], { encoding: 'utf8', windowsHide: true }),
    () => execFileSync('gcloud', ['auth', 'print-access-token'], { encoding: 'utf8', windowsHide: true }),
  ]) {
    try {
      const saida = tentativa().trim();
      if (saida.length > 20) return saida;
      ultimoErro = new Error(`o gcloud devolveu ${saida.length} caractere(s), curto demais para um token`);
    } catch (e) {
      ultimoErro = e;
    }
  }
  throw new Error(
    'nao deu para pegar o token do gcloud. Entre com: gcloud auth login\n' +
      `erro real: ${ultimoErro instanceof Error ? ultimoErro.message : String(ultimoErro)}`
  );
}

async function chamar(metodo, url, corpo, extras = {}) {
  const cabecalhos = {
    authorization: `Bearer ${token()}`,
    // Sem isto a API responde 403 dizendo que falta projeto de cota.
    'x-goog-user-project': PROJETO,
    ...extras,
  };
  let dados;
  if (corpo instanceof Buffer) {
    dados = corpo;
    cabecalhos['content-type'] = cabecalhos['content-type'] ?? 'application/octet-stream';
  } else if (corpo !== undefined) {
    dados = JSON.stringify(corpo);
    cabecalhos['content-type'] = 'application/json';
  }
  const r = await fetch(url, { method: metodo, headers: cabecalhos, body: dados });
  const texto = await r.text();
  let json = null;
  try {
    json = JSON.parse(texto);
  } catch {
    json = null;
  }
  if (!r.ok) {
    throw new Error(`${metodo} ${url}\nHTTP ${r.status}\n${texto.slice(0, 600)}`);
  }
  return json ?? {};
}

// ---------------------------------------------------------------------------
// Regra do Firestore
// ---------------------------------------------------------------------------

async function regraNaNuvem() {
  const releases = await chamar('GET', `https://firebaserules.googleapis.com/v1/projects/${PROJETO}/releases`);
  const release = (releases.releases ?? []).find((r) => r.name.endsWith('/cloud.firestore'));
  if (!release) return { conjunto: null, texto: null };
  const conjunto = await chamar('GET', `https://firebaserules.googleapis.com/v1/${release.rulesetName}`);
  const arquivo = (conjunto.source?.files ?? [])[0];
  return { conjunto: release.rulesetName, texto: arquivo?.content ?? null };
}

async function conferirRegra() {
  const local = readFileSync(ARQUIVO_REGRA, 'utf8');
  const nuvem = await regraNaNuvem();
  guardar('regra-na-nuvem.rules', nuvem.texto ?? '(nada publicado)');
  const igual = nuvem.texto === local;
  reg(`regra publicada: ${nuvem.conjunto ?? 'nenhuma'}`);
  reg(`regra local igual a publicada, byte a byte: ${igual ? 'SIM' : 'NAO'}`);

  // Comparacao do CORPO, sem comentario e sem linha vazia. Isto existe porque a
  // diferenca que importa para a seguranca e a de PERMISSAO, nao a de texto
  // explicativo: um comentario novo faz a comparacao byte a byte falhar sem que
  // nenhuma regra tenha mudado, e foi exatamente esse o caso na OST 6.
  const corpo = (t) =>
    (t ?? '')
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith('//'))
      .join('\n');
  const corpoIgual = corpo(nuvem.texto) === corpo(local);
  reg(`CORPO das regras igual, sem comentario e sem linha vazia: ${corpoIgual ? 'SIM' : 'NAO'}`);
  if (!igual && corpoIgual) {
    reg('  leitura: nenhuma permissao mudou, o que difere e so comentario');
  }
  if (!corpoIgual) {
    reg('  ATENCAO: alguma PERMISSAO difere entre o arquivo e o que esta no ar');
    guardar('regra-corpo-local.txt', corpo(local));
    guardar('regra-corpo-nuvem.txt', corpo(nuvem.texto));
  }
  if (!igual && nuvem.texto !== null) {
    const l = local.split('\n');
    const n = nuvem.texto.split('\n');
    const difs = [];
    for (let i = 0; i < Math.max(l.length, n.length); i++) {
      if (l[i] !== n[i]) difs.push(`  linha ${i + 1}\n    local: ${l[i] ?? '(nao existe)'}\n    nuvem: ${n[i] ?? '(nao existe)'}`);
      if (difs.length >= 12) break;
    }
    reg('primeiras diferencas:');
    for (const d of difs) reg(d);
    guardar('regra-diferencas.txt', difs.join('\n'));
  }
  return igual;
}

async function publicarRegra() {
  exigirFlag('regra do Firestore');
  const local = readFileSync(ARQUIVO_REGRA, 'utf8');
  reg(`publicando ${ARQUIVO_REGRA}, ${local.length} caractere(s)`);
  const conjunto = await chamar('POST', `https://firebaserules.googleapis.com/v1/projects/${PROJETO}/rulesets`, {
    source: { files: [{ name: 'firestore.rules', content: local }] },
  });
  reg(`conjunto de regras criado: ${conjunto.name}`);
  await chamar(
    'PATCH',
    `https://firebaserules.googleapis.com/v1/projects/${PROJETO}/releases/cloud.firestore?updateMask=rulesetName`,
    { release: { name: `projects/${PROJETO}/releases/cloud.firestore`, rulesetName: conjunto.name } }
  );
  reg('regra em uso trocada para o conjunto novo');
  const igual = await conferirRegra();
  if (!igual) throw new Error('publicou mas a comparacao nao fechou, confira a saida acima');
  reg('CONFERIDO: o que esta na nuvem e byte a byte o arquivo do repositorio');
}

// ---------------------------------------------------------------------------
// Indices do Firestore
// ---------------------------------------------------------------------------

async function publicarIndices() {
  exigirFlag('indices do Firestore');
  const j = JSON.parse(readFileSync(ARQUIVO_INDICES, 'utf8'));
  const pedidos = j.indexes ?? [];
  reg(`${pedidos.length} indice(s) no arquivo local`);
  const atuais = await chamar(
    'GET',
    `https://firestore.googleapis.com/v1/projects/${PROJETO}/databases/(default)/collectionGroups/-/indexes`
  );
  const existentes = atuais.indexes ?? [];
  reg(`${existentes.length} indice(s) ja na nuvem`);
  guardar('indices-na-nuvem.json', JSON.stringify(atuais, null, 2));

  let criados = 0;
  for (const pedido of pedidos) {
    const grupo = pedido.collectionGroup;
    const campos = (pedido.fields ?? []).map((c) => ({
      fieldPath: c.fieldPath,
      ...(c.order ? { order: c.order } : {}),
      ...(c.arrayConfig ? { arrayConfig: c.arrayConfig } : {}),
    }));
    const assinatura = JSON.stringify(campos);
    const jaTem = existentes.some(
      (e) =>
        e.name.includes(`/collectionGroups/${grupo}/`) &&
        JSON.stringify((e.fields ?? []).filter((c) => c.fieldPath !== '__name__')) === assinatura
    );
    if (jaTem) {
      reg(`  ja existe: ${grupo} ${assinatura}`);
      continue;
    }
    await chamar(
      'POST',
      `https://firestore.googleapis.com/v1/projects/${PROJETO}/databases/(default)/collectionGroups/${grupo}/indexes`,
      { queryScope: pedido.queryScope ?? 'COLLECTION', fields: campos }
    );
    criados++;
    reg(`  criado: ${grupo} ${assinatura}`);
  }
  reg(`indices: ${criados} criado(s), ${pedidos.length - criados} ja existia(m)`);
}

// ---------------------------------------------------------------------------
// Painel na hospedagem
// ---------------------------------------------------------------------------

function arquivosDaPasta(pasta, base = pasta) {
  const saida = [];
  for (const nome of readdirSync(pasta)) {
    // O ignore do firebase.json: nada que comece com ponto, nada de node_modules.
    if (nome.startsWith('.') || nome === 'node_modules') continue;
    const caminho = join(pasta, nome);
    if (statSync(caminho).isDirectory()) saida.push(...arquivosDaPasta(caminho, base));
    else saida.push(caminho);
  }
  return saida;
}

async function publicarPainel() {
  exigirFlag('painel na hospedagem');
  if (!existsSync(PASTA_PAINEL)) {
    throw new Error(`${PASTA_PAINEL} nao existe. Rode antes, em painel/: npm run construir-para-hospedagem`);
  }
  const caminhos = arquivosDaPasta(PASTA_PAINEL);
  reg(`${caminhos.length} arquivo(s) em ${PASTA_PAINEL}`);

  // Conferencia de seguranca antes de subir qualquer byte: chave do cliente nao
  // pode ir dentro do pacote, §A.6. A hospedagem serve a configuracao em
  // /__/firebase/init.json e o painel le dali.
  const comChave = caminhos.filter(
    (c) => /\.(js|html|json|txt|css)$/.test(c) && /AIzaSy/.test(readFileSync(c, 'utf8'))
  );
  if (comChave.length > 0) {
    throw new Error(`o pacote leva chave do Firebase dentro, nao publico: ${comChave.join(', ')}`);
  }
  reg('conferido: nenhum arquivo do pacote leva chave do Firebase dentro');

  // Passo 1, versao nova com a configuracao de firebase.json.
  //
  // TRADUCAO OBRIGATORIA, e ela custou uma publicacao recusada com HTTP 400 na
  // retomada da OST 7. O firebase.json fala o vocabulario do Firebase CLI, com
  // source e destination. A API de hospedagem fala outro, com glob e path, e
  // recusa o que nao conhece em vez de ignorar. Como a decisao do diretor foi
  // publicar SEM depender do CLI, a traducao tem de morar aqui.
  //
  //   reescrita   source -> glob,  destination -> path
  //   redirecao   source -> glob,  destination -> location,  type -> statusCode
  //   cabecalho   source -> glob,  lista de {key,value} -> um objeto so
  const config = JSON.parse(readFileSync(join(RAIZ, 'firebase.json'), 'utf8')).hosting ?? {};

  const traduzirReescrita = (r) => {
    const alvo = r.destination !== undefined ? { path: r.destination } : {};
    return {
      ...(r.regex !== undefined ? { regex: r.regex } : { glob: r.source ?? r.glob ?? '**' }),
      ...alvo,
      ...(r.function !== undefined ? { function: r.function } : {}),
      ...(r.run !== undefined ? { run: r.run } : {}),
    };
  };
  const traduzirRedirecao = (r) => ({
    ...(r.regex !== undefined ? { regex: r.regex } : { glob: r.source ?? r.glob ?? '**' }),
    location: r.destination ?? r.location,
    statusCode: r.type ?? r.statusCode ?? 301,
  });
  const traduzirCabecalho = (h) => ({
    ...(h.regex !== undefined ? { regex: h.regex } : { glob: h.source ?? h.glob ?? '**' }),
    headers: Array.isArray(h.headers)
      ? Object.fromEntries(h.headers.map((c) => [c.key, String(c.value)]))
      : (h.headers ?? {}),
  });

  const configDaApi = {
    rewrites: (config.rewrites ?? []).map(traduzirReescrita),
    ...(config.headers ? { headers: config.headers.map(traduzirCabecalho) } : {}),
    ...(config.redirects ? { redirects: config.redirects.map(traduzirRedirecao) } : {}),
  };
  reg(`configuracao traduzida para a API: ${JSON.stringify(configDaApi)}`);

  const versao = await chamar('POST', `https://firebasehosting.googleapis.com/v1beta1/sites/${SITE}/versions`, {
    config: configDaApi,
  });
  reg(`versao criada: ${versao.name}`);

  // Passo 2, declarar os arquivos. A hospedagem identifica cada um pelo resumo
  // do conteudo COMPACTADO, nao do conteudo cru.
  const porResumo = new Map();
  const mapa = {};
  for (const caminho of caminhos) {
    const compactado = gzipSync(readFileSync(caminho), { level: 9 });
    const resumo = createHash('sha256').update(compactado).digest('hex');
    const relativo = `/${posix.join(...caminho.slice(PASTA_PAINEL.length + 1).split(/[\\/]/))}`;
    mapa[relativo] = resumo;
    porResumo.set(resumo, compactado);
  }
  const declarado = await chamar('POST', `https://firebasehosting.googleapis.com/v1beta1/${versao.name}:populateFiles`, {
    files: mapa,
  });
  const precisam = declarado.uploadRequiredHashes ?? [];
  reg(`${Object.keys(mapa).length} arquivo(s) declarado(s), ${precisam.length} precisam subir`);

  // Passo 3, subir o que falta.
  let subiram = 0;
  for (const resumo of precisam) {
    const bytes = porResumo.get(resumo);
    if (!bytes) throw new Error(`a hospedagem pediu um resumo que nao e nosso: ${resumo}`);
    await chamar('POST', `${declarado.uploadUrl}/${resumo}`, bytes);
    subiram++;
  }
  reg(`${subiram} arquivo(s) enviado(s)`);

  // Passo 4, fechar a versao.
  await chamar('PATCH', `https://firebasehosting.googleapis.com/v1beta1/${versao.name}?update_mask=status`, {
    status: 'FINALIZED',
  });
  reg('versao fechada');

  // Passo 5, por no ar.
  const release = await chamar(
    'POST',
    `https://firebasehosting.googleapis.com/v1beta1/sites/${SITE}/releases?versionName=${encodeURIComponent(versao.name)}`
  );
  reg(`no ar: ${release.name}`);

  // Conferencia por efeito: o endereco responde, e responde o pacote novo.
  const r = await fetch(`https://${SITE}.web.app/`, { headers: { 'cache-control': 'no-cache' } });
  const html = await r.text();
  reg(`https://${SITE}.web.app/ responde HTTP ${r.status}, ${html.length} byte(s)`);
  const init = await fetch(`https://${SITE}.web.app/__/firebase/init.json`);
  reg(`a hospedagem serve a configuracao do cliente: HTTP ${init.status}`);
}

// ---------------------------------------------------------------------------

async function principal() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Diga o que publicar: --regra, --indices, --painel ou --conferir');
    process.exit(2);
  }
  reg(`publicacao, projeto ${PROJETO}, explicito, §A.20`);
  reg(`rodada em ${RODADA}`);
  try {
    if (args.includes('--conferir')) await conferirRegra();
    if (args.includes('--regra')) await publicarRegra();
    if (args.includes('--indices')) await publicarIndices();
    if (args.includes('--painel')) await publicarPainel();
    reg('');
    reg('PRONTO.');
  } catch (e) {
    reg('');
    reg(`FALHOU: ${e instanceof Error ? e.message : String(e)}`);
    guardar('saida.txt', linhas.join('\n'));
    process.exit(1);
  }
  guardar('saida.txt', linhas.join('\n'));
}

void principal();
