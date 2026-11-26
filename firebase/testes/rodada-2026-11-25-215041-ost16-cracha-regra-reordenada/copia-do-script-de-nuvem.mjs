// COPIA para checagem de sintaxe (node --check), OST 16. Nao executar.
// Original: scripts/ na raiz do repositorio, mesmo conteudo abaixo desta linha.
//
// Uso:
//   node scripts/publicar.mjs --regra      publica firebase/firestore.rules
//   node scripts/publicar.mjs --indices    publica firebase/firestore.indexes.json
//   node scripts/publicar.mjs --painel     publica painel/out na hospedagem
//   node scripts/publicar.mjs --conferir   so compara o que esta na nuvem, nao publica
//   node scripts/publicar.mjs --cracha     OST 16: liga SO o provedor anonimo do
//                                          Authentication, para o cracha por maquina
//   node scripts/publicar.mjs --encerrar-sessoes-do-diretor
//                                          OST 16, U4: invalida os tokens de
//                                          atualizacao da conta do diretor. So depois
//                                          da troca do notebook para o cracha.

import { execFileSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, posix, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PROJETO = 'a-fabrica-soulan';
const SITE = 'a-fabrica-soulan';
const ESTADO = join(RAIZ, '.claude', 'state');
const EMAIL_DO_DIRETOR = 'henrique.vieira@soulan.com.br';

const ARQUIVO_REGRA = join(RAIZ, 'firebase', 'firestore.rules');
const ARQUIVO_INDICES = join(RAIZ, 'firebase', 'firestore.indexes.json');
const PASTA_PAINEL = join(RAIZ, 'painel', 'out');

function selo() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  // OST 16: com segundos, para duas chamadas no mesmo minuto nao dividirem a
  // mesma pasta e uma nao sobrescrever a evidencia da outra, §A.17.
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
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

const VALIDADE_PRODUCAO_MS = 30 * 60 * 1000;

function exigirFlag(oQue) {
  let flags = [];
  try {
    flags = readdirSync(ESTADO).filter((n) => n.startsWith('PROD_'));
  } catch {
    flags = [];
  }
  if (flags.length === 0) {
    console.error(`publicar: BLOQUEADO (${oQue}).`);
    console.error(`Motivo: nenhuma autorizacao de producao em ${ESTADO}, §A.7.`);
    console.error('Publicar e peso pesado: a flag leve da fabrica nao serve aqui.');
    console.error('Quem autoriza e o diretor, na mao, nesta sessao:');
    console.error('  ! bash scripts/autorizar-producao.sh <motivo> "<as suas palavras>"');
    process.exit(2);
  }

  const caminho = join(ESTADO, flags[0]);
  const conteudo = readFileSync(caminho, 'utf8');
  const linha = conteudo.split('\n').find((l) => l.startsWith('autorizacao:'));
  const palavras = linha ? linha.slice('autorizacao:'.length).trim() : '';
  if (palavras.length === 0) {
    console.error(`publicar: BLOQUEADO (${oQue}).`);
    console.error(`Motivo: ${flags[0]} nao traz a autorizacao escrita do diretor, §A.7.`);
    process.exit(2);
  }

  const idadeMs = Date.now() - statSync(caminho).mtimeMs;
  if (idadeMs > VALIDADE_PRODUCAO_MS) {
    console.error(`publicar: BLOQUEADO (${oQue}).`);
    console.error(`Motivo: a autorizacao ${flags[0]} tem ${Math.round(idadeMs / 60000)} minuto(s) e vale 30.`);
    console.error('Palavra de ontem nao autoriza hoje, §A.7. Peca uma nova ao diretor.');
    process.exit(2);
  }

  reg(`autorizacao de producao encontrada (${flags[0]}), ${Math.round(idadeMs / 60000)} minuto(s) de idade`);
  reg(`palavras do diretor, registradas: ${palavras}`);
  reg(`publicacao de ${oQue} liberada, §A.7`);
}

function token() {
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

function arquivosDaPasta(pasta, base = pasta) {
  const saida = [];
  for (const nome of readdirSync(pasta)) {
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
  const comChave = caminhos.filter(
    (c) => /\.(js|html|json|txt|css)$/.test(c) && /AIzaSy/.test(readFileSync(c, 'utf8'))
  );
  if (comChave.length > 0) {
    throw new Error(`o pacote leva chave do Firebase dentro, nao publico: ${comChave.join(', ')}`);
  }
  reg('conferido: nenhum arquivo do pacote leva chave do Firebase dentro');
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
  let subiram = 0;
  for (const resumo of precisam) {
    const bytes = porResumo.get(resumo);
    if (!bytes) throw new Error(`a hospedagem pediu um resumo que nao e nosso: ${resumo}`);
    await chamar('POST', `${declarado.uploadUrl}/${resumo}`, bytes);
    subiram++;
  }
  reg(`${subiram} arquivo(s) enviado(s)`);
  await chamar('PATCH', `https://firebasehosting.googleapis.com/v1beta1/${versao.name}?update_mask=status`, {
    status: 'FINALIZED',
  });
  reg('versao fechada');
  const release = await chamar(
    'POST',
    `https://firebasehosting.googleapis.com/v1beta1/sites/${SITE}/releases?versionName=${encodeURIComponent(versao.name)}`
  );
  reg(`no ar: ${release.name}`);
  const r = await fetch(`https://${SITE}.web.app/`, { headers: { 'cache-control': 'no-cache' } });
  const html = await r.text();
  reg(`https://${SITE}.web.app/ responde HTTP ${r.status}, ${html.length} byte(s)`);
  const init = await fetch(`https://${SITE}.web.app/__/firebase/init.json`);
  reg(`a hospedagem serve a configuracao do cliente: HTTP ${init.status}`);

  await conferirPainelNoAr(mapa);
}

async function conferirPainelNoAr(mapa) {
  reg('');
  reg('conferindo o que esta NO AR contra o pacote local, arquivo por arquivo, condicao 14');
  const caminhos = Object.keys(mapa).sort();
  const diferentes = [];
  const naoBaixaram = [];
  let iguais = 0;

  for (const caminho of caminhos) {
    const local = readFileSync(join(PASTA_PAINEL, ...caminho.slice(1).split('/')));
    const resumoLocal = createHash('sha256').update(local).digest('hex');
    let resposta;
    try {
      resposta = await fetch(`https://${SITE}.web.app${caminho}`, { headers: { 'cache-control': 'no-cache' } });
    } catch (e) {
      naoBaixaram.push(`${caminho}: ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }
    if (!resposta.ok) {
      naoBaixaram.push(`${caminho}: HTTP ${resposta.status}`);
      continue;
    }
    const bytes = Buffer.from(await resposta.arrayBuffer());
    const resumoNoAr = createHash('sha256').update(bytes).digest('hex');
    if (resumoNoAr === resumoLocal) iguais++;
    else diferentes.push(`${caminho}\n    local: ${resumoLocal}\n    no ar: ${resumoNoAr} (${bytes.length} byte(s), local ${local.length})`);
  }

  reg(`arquivos conferidos: ${caminhos.length}, iguais byte a byte: ${iguais}, diferentes: ${diferentes.length}, nao baixaram: ${naoBaixaram.length}`);
  for (const d of diferentes) reg(`  DIFERE ${d}`);
  for (const n of naoBaixaram) reg(`  NAO BAIXOU ${n}`);
  guardar(
    'conferencia-do-que-esta-no-ar.txt',
    [
      `endereco: https://${SITE}.web.app`,
      `pacote local: ${PASTA_PAINEL}`,
      `arquivos: ${caminhos.length}, iguais: ${iguais}, diferentes: ${diferentes.length}, nao baixaram: ${naoBaixaram.length}`,
      '',
      ...caminhos,
      '',
      'diferentes:',
      ...(diferentes.length === 0 ? ['nenhum'] : diferentes),
      '',
      'nao baixaram:',
      ...(naoBaixaram.length === 0 ? ['nenhum'] : naoBaixaram),
    ].join('\n')
  );

  if (diferentes.length > 0 || naoBaixaram.length > 0) {
    throw new Error(
      `publicou, mas o que esta no ar NAO confere com o pacote local: ${diferentes.length} diferente(s), ${naoBaixaram.length} que nao baixaram. Veja a rodada.`
    );
  }
  reg('CONFERIDO: todo arquivo no ar e byte a byte o arquivo do pacote local.');
}

const ENDERECO_CONFIG = `https://identitytoolkit.googleapis.com/admin/v2/projects/${PROJETO}/config`;
const CHAVES_SECRETAS = /^(hashConfig|signerKey|saltSeparator|apiKey|clientSecret|privateKey|secret)$/i;

function semSegredos(valor) {
  if (Array.isArray(valor)) return valor.map(semSegredos);
  if (valor === null || typeof valor !== 'object') return valor;
  const saida = {};
  for (const [chave, v] of Object.entries(valor)) {
    if (CHAVES_SECRETAS.test(chave)) {
      saida[chave] = '(retirado, segredo)';
      continue;
    }
    saida[chave] = semSegredos(v);
  }
  return saida;
}

function resumoDosSegredos(valor) {
  const partes = [];
  const andar = (v, caminho) => {
    if (Array.isArray(v)) return v.forEach((x, i) => andar(x, `${caminho}[${i}]`));
    if (v === null || typeof v !== 'object') return;
    for (const [chave, x] of Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) {
      const aqui = caminho ? `${caminho}.${chave}` : chave;
      if (CHAVES_SECRETAS.test(chave)) partes.push(`${aqui}=${JSON.stringify(x)}`);
      else andar(x, aqui);
    }
  };
  andar(valor, '');
  return createHash('sha256').update(partes.join('\n')).digest('hex');
}

function achatar(valor, caminho = '', saida = {}) {
  if (Array.isArray(valor)) {
    if (valor.length === 0) saida[caminho] = '[]';
    valor.forEach((x, i) => achatar(x, `${caminho}[${i}]`, saida));
    return saida;
  }
  if (valor !== null && typeof valor === 'object') {
    const chaves = Object.keys(valor);
    if (chaves.length === 0 && caminho) saida[caminho] = '{}';
    for (const chave of chaves) achatar(valor[chave], caminho ? `${caminho}.${chave}` : chave, saida);
    return saida;
  }
  saida[caminho] = JSON.stringify(valor);
  return saida;
}

function diferencas(antes, depois) {
  const a = achatar(antes);
  const d = achatar(depois);
  const caminhos = [...new Set([...Object.keys(a), ...Object.keys(d)])].sort();
  return caminhos
    .filter((c) => a[c] !== d[c])
    .map((c) => ({ caminho: c, antes: a[c] ?? '(nao existia)', depois: d[c] ?? '(nao existe)' }));
}

async function ligarProvedorAnonimo() {
  exigirFlag('provedor anonimo do Authentication, cracha por maquina');

  const cruaAntes = await chamar('GET', ENDERECO_CONFIG);
  const antes = semSegredos(cruaAntes);
  guardar('authentication-config-antes.json', JSON.stringify(antes, null, 2));
  reg(`configuracao do Authentication lida e gravada sem segredos: ${join(RODADA, 'authentication-config-antes.json')}`);
  reg(`provedor anonimo antes: ${cruaAntes.signIn?.anonymous?.enabled === true ? 'LIGADO' : 'DESLIGADO'}`);

  if (cruaAntes.signIn?.anonymous?.enabled === true) {
    reg('o provedor anonimo ja estava ligado, nada foi escrito');
    guardar('authentication-config-depois.json', JSON.stringify(antes, null, 2));
    return;
  }

  await chamar('PATCH', `${ENDERECO_CONFIG}?updateMask=signIn.anonymous.enabled`, {
    signIn: { anonymous: { enabled: true } },
  });
  reg('pedido de ligar o provedor anonimo aceito pela API');

  const cruaDepois = await chamar('GET', ENDERECO_CONFIG);
  const depois = semSegredos(cruaDepois);
  guardar('authentication-config-depois.json', JSON.stringify(depois, null, 2));
  reg(`configuracao depois gravada sem segredos: ${join(RODADA, 'authentication-config-depois.json')}`);

  const difs = diferencas(antes, depois);
  const esperado = (d) => d.caminho === 'signIn.anonymous.enabled' && d.depois === 'true';
  const alemDoPedido = difs.filter((d) => !esperado(d));
  const segredosIguais = resumoDosSegredos(cruaAntes) === resumoDosSegredos(cruaDepois);
  guardar(
    'authentication-diferencas.txt',
    [
      `diferencas entre antes e depois, sem segredos: ${difs.length}`,
      ...difs.map((d) => `  ${d.caminho}\n    antes:  ${d.antes}\n    depois: ${d.depois}`),
      '',
      `campos secretos (hashConfig e afins) iguais antes e depois, comparados por resumo: ${segredosIguais ? 'SIM' : 'NAO'}`,
    ].join('\n')
  );
  for (const d of difs) reg(`  mudou ${d.caminho}: ${d.antes} para ${d.depois}`);
  reg(`campos secretos iguais antes e depois: ${segredosIguais ? 'SIM' : 'NAO'}`);

  if (cruaDepois.signIn?.anonymous?.enabled !== true) {
    throw new Error('a API aceitou, mas a configuracao lida depois diz que o provedor anonimo continua desligado');
  }
  if (alemDoPedido.length > 0 || !segredosIguais) {
    throw new Error(
      `o provedor anonimo ligou, mas ${alemDoPedido.length} outro(s) campo(s) mudaram junto` +
        `${segredosIguais ? '' : ' e uma parte secreta mudou'}. Nada foi desfeito automaticamente. ` +
        'Veja authentication-diferencas.txt na rodada e avise o diretor.'
    );
  }
  reg('CONFERIDO: o provedor anonimo esta ligado e nada alem dele mudou, U2');
}

const PASTA_DA_PONTE = join(homedir(), '.a-fabrica-ponte');

async function contaDoDiretor() {
  const r = await chamar('POST', `https://identitytoolkit.googleapis.com/v1/projects/${PROJETO}/accounts:lookup`, {
    email: [EMAIL_DO_DIRETOR],
  });
  const contas = (r.users ?? []).filter((u) => String(u.email ?? '').toLowerCase() === EMAIL_DO_DIRETOR);
  if (contas.length !== 1 || typeof contas[0].localId !== 'string' || contas[0].localId.length === 0) {
    throw new Error(`esperava exatamente uma conta com o e-mail do diretor, achei ${contas.length}. Nada foi alterado.`);
  }
  return { uid: contas[0].localId, validSince: contas[0].validSince ?? null };
}

async function encerrarSessoesDoDiretor() {
  const sessao = join(PASTA_DA_PONTE, 'sessao.json');
  const cracha = join(PASTA_DA_PONTE, 'cracha.json');
  if (existsSync(sessao)) {
    console.error('publicar: BLOQUEADO (encerrar as sessoes do diretor).');
    console.error(`Motivo: ${sessao} ainda existe. A troca do notebook para o cracha nao terminou, U4.`);
    console.error('Invalidar agora derrubaria a ponte que ainda entra como o diretor.');
    process.exit(2);
  }
  if (!existsSync(cracha)) {
    console.error('publicar: BLOQUEADO (encerrar as sessoes do diretor).');
    console.error(`Motivo: ${cracha} nao existe. A ponte do notebook ficaria sem identidade nenhuma, U4.`);
    process.exit(2);
  }
  reg(`conferido: ${sessao} nao existe e ${cracha} existe (nenhum dos dois foi aberto)`);

  exigirFlag('encerrar as sessoes do diretor, invalidar tokens de atualizacao');

  const antes = await contaDoDiretor();
  const curto = antes.uid.slice(0, 8);
  reg(`conta do diretor achada pelo e-mail, uid comecando com ${curto}`);
  reg(`validSince antes: ${antes.validSince ?? '(nunca marcado)'}`);

  const agora = Math.floor(Date.now() / 1000);
  await chamar('POST', `https://identitytoolkit.googleapis.com/v1/projects/${PROJETO}/accounts:update`, {
    localId: antes.uid,
    validSince: String(agora),
  });
  reg(`pedido aceito: tokens emitidos antes de ${new Date(agora * 1000).toISOString()} deixam de valer`);

  const depois = await contaDoDiretor();
  if (depois.uid !== antes.uid) throw new Error('a conta lida depois nao e a mesma de antes, confira a mao');
  const marcado = Number(depois.validSince ?? '0');
  guardar(
    'encerrar-sessoes-do-diretor.txt',
    [
      `conta: uid comecando com ${curto}`,
      `validSince antes: ${antes.validSince ?? '(nunca marcado)'}`,
      `validSince pedido: ${agora}`,
      `validSince depois: ${depois.validSince ?? '(nao veio)'}`,
      'nenhum token foi lido, impresso ou gravado',
    ].join('\n')
  );
  if (!Number.isFinite(marcado) || marcado < agora) {
    throw new Error(`a API aceitou, mas validSince lido depois (${depois.validSince ?? 'nada'}) e anterior ao pedido (${agora})`);
  }
  reg(`CONFERIDO: validSince da conta do diretor agora e ${marcado}. O navegador dele vai pedir login de novo, uma vez.`);
}

async function principal() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error(
      'Diga o que publicar: --regra, --indices, --painel, --conferir, --cracha ou --encerrar-sessoes-do-diretor'
    );
    process.exit(2);
  }
  reg(`publicacao, projeto ${PROJETO}, explicito, §A.20`);
  reg(`rodada em ${RODADA}`);
  try {
    if (args.includes('--conferir')) await conferirRegra();
    if (args.includes('--regra')) await publicarRegra();
    if (args.includes('--indices')) await publicarIndices();
    if (args.includes('--painel')) await publicarPainel();
    if (args.includes('--cracha')) await ligarProvedorAnonimo();
    if (args.includes('--encerrar-sessoes-do-diretor')) await encerrarSessoesDoDiretor();
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
