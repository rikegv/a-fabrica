/*
 * Itens 4, 5, 6 e 7 da OST 6 parte 2, com o PAINEL REAL rodando contra o
 * emulador de Auth e de Firestore.
 *
 * O painel de desenvolvimento esta preso ao laco de retorno, 127.0.0.1:3399,
 * §A.6. Os emuladores tambem, 9399 (Auth) e 8399 (Firestore). Nada fala com a
 * nuvem nesta prova.
 *
 * Item 4: conta diferente da do diretor e barrada, e o e-mail do diretor sem
 *         verificacao tambem.
 * Item 5: depois do login, o painel funciona, no computador e no celular, com
 *         atualizacao ao vivo de verdade.
 * Item 6: ponte offline com dado real.
 * Item 7: zero escrita no Firestore, decisao e caixa de comando desabilitadas.
 *
 * Uso: node 03-prova-no-emulador.mjs
 */

import { spawnSync, execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/Henrique/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright');

const AQUI = dirname(fileURLToPath(import.meta.url));
const PAINEL = 'http://127.0.0.1:3399/';
const PROJETO = 'a-fabrica-soulan';
const FIRESTORE = 'http://127.0.0.1:8399';
const AUTH = 'http://127.0.0.1:9399';
const DIRETOR = 'henrique.vieira@soulan.com.br';
const OUTRO = 'outra.pessoa@exemplo.com';

const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const linhas = [];
const diga = (t = '') => {
  linhas.push(t);
  console.log(t);
};

/* ---------- registro de TODO pedido de rede ao emulador ---------- */
const pedidos = [];
const marcas = [];
function marcar(nome) {
  marcas.push({ nome, indice: pedidos.length, quando: Date.now() });
  diga(`[marca] ${nome}: ${pedidos.length} pedidos de rede ate aqui`);
}
function pedidosDesde(nome) {
  const m = marcas.find((x) => x.nome === nome);
  return pedidos.slice(m ? m.indice : 0);
}
const ehFirestore = (u) => u.includes('127.0.0.1:8399');
const ehEscritaFirestore = (u) =>
  /Write\/channel|:commit|\/commit\b|:batchWrite|BatchWrite/.test(u) ||
  (/google\.firestore\.v1\.Firestore\/Write/.test(u));

async function limparFirestore() {
  const r = await fetch(`${FIRESTORE}/emulator/v1/projects/${PROJETO}/databases/(default)/documents`, { method: 'DELETE' });
  if (!r.ok) throw new Error('nao deu para limpar o Firestore do emulador: ' + r.status);
}
async function limparContas() {
  const r = await fetch(`${AUTH}/emulator/v1/projects/${PROJETO}/accounts`, { method: 'DELETE' });
  if (!r.ok) throw new Error('nao deu para limpar as contas do emulador: ' + r.status);
}
async function contasDoEmulador() {
  const r = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/projects/${PROJETO}/accounts:query`, {
    method: 'POST',
    headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' },
    body: '{}'
  });
  const d = await r.json();
  return (d.userInfo ?? []).map((u) => ({ email: u.email, emailVerified: u.emailVerified ?? false }));
}
async function contarDocumentos() {
  const colecoes = ['maquinas', 'fabricas', 'aprovacoes', 'comandos', 'relatorios'];
  const saida = {};
  for (const c of colecoes) {
    const r = await fetch(`${FIRESTORE}/v1/projects/${PROJETO}/databases/(default)/documents/${c}?pageSize=300`, {
      headers: { Authorization: 'Bearer owner' }
    });
    const d = await r.json().catch(() => ({}));
    saida[c] = (d.documents ?? []).length;
  }
  return saida;
}
function semear(modo) {
  const r = spawnSync('node', ['semear.mjs', modo], { cwd: AQUI, stdio: 'inherit', shell: true });
  if (r.status !== 0) throw new Error('semear ' + modo + ' falhou');
}
function semearAoVivo(modo) {
  const r = spawnSync('node', ['semear-ao-vivo.mjs', modo], { cwd: AQUI, stdio: 'inherit', shell: true });
  if (r.status !== 0) throw new Error('semear-ao-vivo ' + modo + ' falhou');
}

/* ---------- entrada pelo emulador de Auth ---------- */
async function entrar(pagina, email, { verificado = true, nome = 'Henrique Vieira' } = {}) {
  await pagina.waitForSelector('button:has-text("Entrar com o Google")', { timeout: 30_000 });
  const [popup] = await Promise.all([
    pagina.waitForEvent('popup', { timeout: 30_000 }),
    pagina.click('button:has-text("Entrar com o Google")')
  ]);
  await popup.waitForLoadState('domcontentloaded');
  await popup.waitForSelector('#add-account-button', { timeout: 30_000 });
  await espera(600);

  if (verificado) {
    const existente = popup.locator('li', { hasText: email }).first();
    if (await existente.count()) {
      await existente.click();
    } else {
      await popup.click('#add-account-button');
      await popup.waitForSelector('#email-input', { state: 'visible', timeout: 30_000 });
      await popup.fill('#email-input', email);
      await popup.fill('#display-name-input', nome);
      await popup.click('#sign-in');
    }
  } else {
    /* O formulario do emulador grava email_verified: true e nao oferece opcao.
       Entao a prova do e-mail nao verificado chama a propria funcao do widget
       com a reivindicacao que interessa. E o mesmo caminho de codigo: o painel
       recebe um usuario do provedor Google com emailVerified falso. */
    await popup.evaluate(
      ({ email: e, nome: n }) => {
        const reivindicacao = encodeURIComponent(
          JSON.stringify({
            sub: 'prova-sem-verificacao-' + Date.now(),
            iss: '',
            aud: '',
            exp: 0,
            iat: 0,
            name: n,
            email: e,
            email_verified: false
          })
        );
        // eslint-disable-next-line no-undef
        finishWithUser(reivindicacao, e);
      },
      { email, nome }
    );
  }
  await popup.waitForEvent('close', { timeout: 30_000 }).catch(() => {});
  await espera(2500);
}

/* ---------- leitura da tela ---------- */
async function lerTela(pagina) {
  return pagina.evaluate(() => {
    const controles = [...document.querySelectorAll('button, textarea, input')].map((e) => ({
      marca: e.tagName.toLowerCase(),
      texto: (e.getAttribute('aria-label') || e.textContent || e.getAttribute('placeholder') || '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 60),
      desabilitado: Boolean(e.disabled)
    }));
    return {
      dentro: Boolean(document.querySelector('.gf-app') || document.querySelector('.gf-mapp')),
      texto: (document.body.innerText || '').replace(/\u00a0/g, ' ').trim(),
      controles,
      habilitados: controles.filter((c) => !c.desabilitado).map((c) => c.texto),
      desabilitados: controles.filter((c) => c.desabilitado).map((c) => c.texto),
      rolagemDaPagina: document.documentElement.scrollHeight - window.innerHeight
    };
  });
}
async function foto(pagina, nome) {
  await pagina.screenshot({ path: join(AQUI, nome) });
  diga('foto: ' + nome);
}

diga('ITENS 4, 5, 6 E 7, PAINEL REAL CONTRA O EMULADOR');
diga('painel: ' + PAINEL + ' (preso ao laco de retorno)');
diga('emulador de Auth: ' + AUTH + '   emulador do Firestore: ' + FIRESTORE);
diga('hora: ' + new Date().toISOString());
diga();

const navegador = await chromium.launch();
const resultado = {};

try {
  const contexto = await navegador.newContext({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR' });
  contexto.on('request', (p) => pedidos.push({ metodo: p.method(), url: p.url(), quando: Date.now() }));
  const tela = await contexto.newPage();
  const consoleDoPainel = [];
  tela.on('console', (m) => consoleDoPainel.push({ tipo: m.type(), texto: m.text() }));
  tela.on('pageerror', (e) => consoleDoPainel.push({ tipo: 'pageerror', texto: String(e.message ?? e) }));

  await limparFirestore();
  await limparContas();
  diga('emulador limpo: base vazia e nenhuma conta.');
  diga();

  /* ================= ITEM 4, QUEM NAO E O DIRETOR ================= */
  diga('================ ITEM 4, CONTA QUE NAO E A DO DIRETOR ================');
  marcar('antes-de-tudo');
  await tela.goto(PAINEL, { waitUntil: 'domcontentloaded' });
  await espera(2500);
  const barreira = await lerTela(tela);
  diga('--- 4.0 a barreira, antes de qualquer entrada ---');
  diga('painel de dentro desenhado: ' + barreira.dentro);
  diga('texto:\n  ' + barreira.texto.split('\n').join('\n  '));
  await foto(tela, '10-barreira-desenvolvimento.png');
  diga();

  diga('--- 4.1 entrar com conta diferente da do diretor: ' + OUTRO + ' ---');
  marcar('conta-diferente');
  await entrar(tela, OUTRO, { verificado: true, nome: 'Outra Pessoa' });
  await espera(2000);
  const recusada = await lerTela(tela);
  await foto(tela, '11-conta-diferente-recusada.png');
  const contas1 = await contasDoEmulador();
  diga('contas que existem no emulador agora: ' + JSON.stringify(contas1));
  diga('painel de dentro desenhado: ' + recusada.dentro);
  diga('mensagem na tela:\n  ' + recusada.texto.split('\n').join('\n  '));
  const redeConta = pedidosDesde('conta-diferente');
  const firestoreConta = redeConta.filter((p) => ehFirestore(p.url));
  diga('pedidos ao Firestore desde o clique de entrar: ' + firestoreConta.length);
  for (const p of firestoreConta) diga('  ' + p.metodo + ' ' + p.url);
  const sessaoDerrubada = await tela.evaluate(async () => {
    /* A sessao do Firebase vive no IndexedDB. Se o painel desconectou de
       verdade, nao sobra usuario guardado. */
    const nomes = (await indexedDB.databases?.()) ?? [];
    const temBase = nomes.some((n) => n.name === 'firebaseLocalStorageDb');
    if (!temBase) return { base: false, usuarios: 0 };
    const aberta = await new Promise((ok, falha) => {
      const req = indexedDB.open('firebaseLocalStorageDb');
      req.onsuccess = () => ok(req.result);
      req.onerror = () => falha(req.error);
    });
    const itens = await new Promise((ok) => {
      const t = aberta.transaction('firebaseLocalStorage', 'readonly');
      const r = t.objectStore('firebaseLocalStorage').getAll();
      r.onsuccess = () => ok(r.result ?? []);
      r.onerror = () => ok([]);
    });
    return { base: true, usuarios: itens.filter((i) => String(i.fbase_key ?? '').includes('authUser')).length };
  });
  diga('sessao guardada no navegador depois da recusa: ' + JSON.stringify(sessaoDerrubada));
  resultado.contaDiferente = {
    dentro: recusada.dentro,
    leituraDaBase: firestoreConta.length,
    sessaoGuardada: sessaoDerrubada.usuarios,
    mensagem: recusada.texto
  };
  diga(
    !recusada.dentro && firestoreConta.length === 0 && sessaoDerrubada.usuarios === 0
      ? 'VEREDITO 4.1: conta diferente barrada, zero leitura da base, sessao encerrada, mensagem clara.'
      : 'ACHADO no caso da conta diferente, ver acima.'
  );
  diga();

  /* ---------- 4.2 e-mail do diretor, sem verificacao ---------- */
  diga('--- 4.2 entrar com o e-mail do diretor, com e-mail NAO verificado ---');
  await limparContas();
  await tela.reload({ waitUntil: 'domcontentloaded' });
  await espera(2000);
  marcar('diretor-sem-verificacao');
  await entrar(tela, DIRETOR, { verificado: false });
  await espera(2000);
  const naoVerificado = await lerTela(tela);
  await foto(tela, '12-diretor-sem-email-verificado.png');
  const contas2 = await contasDoEmulador();
  diga('contas que existem no emulador agora: ' + JSON.stringify(contas2));
  diga('painel de dentro desenhado: ' + naoVerificado.dentro);
  diga('mensagem na tela:\n  ' + naoVerificado.texto.split('\n').join('\n  '));
  const redeNV = pedidosDesde('diretor-sem-verificacao').filter((p) => ehFirestore(p.url));
  diga('pedidos ao Firestore desde o clique de entrar: ' + redeNV.length);
  for (const p of redeNV) diga('  ' + p.metodo + ' ' + p.url);
  resultado.diretorSemVerificacao = {
    dentro: naoVerificado.dentro,
    leituraDaBase: redeNV.length,
    contaNoEmulador: contas2,
    mensagem: naoVerificado.texto
  };
  diga(
    !naoVerificado.dentro && redeNV.length === 0 && contas2.every((c) => c.emailVerified === false)
      ? 'VEREDITO 4.2: e-mail do diretor sem verificacao barrado, zero leitura da base, mensagem clara.'
      : 'ACHADO no caso do e-mail nao verificado, ver acima.'
  );
  diga();

  /* ================= ITEM 5, DEPOIS DO LOGIN ================= */
  diga('================ ITEM 5, DEPOIS DO LOGIN O PAINEL FUNCIONA ================');
  await limparContas();
  await tela.reload({ waitUntil: 'domcontentloaded' });
  await espera(1500);
  marcar('diretor');
  await entrar(tela, DIRETOR, { verificado: true });
  await tela.waitForSelector('.gf-app', { timeout: 60_000 });
  await espera(2500);
  const contas3 = await contasDoEmulador();
  diga('conta que entrou: ' + JSON.stringify(contas3));
  const vazia = await lerTela(tela);
  await foto(tela, '13-dentro-base-vazia-computador.png');
  diga('painel de dentro desenhado: ' + vazia.dentro);
  diga('base vazia, o que a tela diz:\n  ' + vazia.texto.split('\n').join('\n  '));
  const firestoreDepoisDoLogin = pedidosDesde('diretor').filter((p) => ehFirestore(p.url));
  diga('pedidos ao Firestore depois do login: ' + firestoreDepoisDoLogin.length + ' (agora e esperado que existam, sao os ouvintes)');
  diga();

  diga('--- 5.1 a ponte escreve na base com o painel ABERTO, sem recarregar ---');
  const antesDoSemeio = await tela.evaluate(() => (document.body.innerText || '').replace(/\s+/g, ' ').trim());
  semear('ponte-viva');
  await espera(3000);
  const depoisDoSemeio = await tela.evaluate(() => (document.body.innerText || '').replace(/\s+/g, ' ').trim());
  diga('a pagina foi recarregada entre as duas leituras: nao, nenhum goto e nenhum reload foi chamado.');
  diga('texto da tela ANTES da escrita (resumo): ' + antesDoSemeio.slice(0, 180));
  diga('texto da tela DEPOIS da escrita (resumo): ' + depoisDoSemeio.slice(0, 180));
  diga('a tela mudou sozinha: ' + (antesDoSemeio !== depoisDoSemeio));
  await foto(tela, '14-visao-geral-computador.png');
  const comDados = await lerTela(tela);
  diga('texto da Visao geral:\n  ' + comDados.texto.split('\n').join('\n  '));
  diga('rolagem da pagina (tem de ser 0): ' + comDados.rolagemDaPagina);
  diga();

  /* ---------- 5.2 atualizacao ao vivo medida no contador ---------- */
  diga('--- 5.2 atualizacao ao vivo de verdade, medida no contador da tela ---');
  const contaCartoes = () =>
    tela.evaluate(() => ({
      cartoes: document.querySelectorAll('.gf-fcard').length,
      textoDoIndicador: [...document.querySelectorAll('.gf-kpi, .gf-kpi-tile')]
        .map((e) => (e.textContent || '').replace(/\s+/g, ' ').trim())
        .join(' | '),
      temProvaAoVivo: (document.body.innerText || '').includes('Prova Ao Vivo')
    }));
  const antes = await contaCartoes();
  diga('antes da escrita: ' + JSON.stringify(antes));
  await foto(tela, '15-ao-vivo-antes.png');
  semearAoVivo('fabrica-nova');
  await espera(3000);
  const depois = await contaCartoes();
  diga('depois da escrita, SEM recarregar: ' + JSON.stringify(depois));
  await foto(tela, '16-ao-vivo-depois.png');
  resultado.aoVivo = { antes, depois };
  diga(
    depois.temProvaAoVivo && !antes.temProvaAoVivo
      ? 'VEREDITO 5.2: a fabrica nova apareceu na tela sem recarregar. Ouvinte ao vivo provado.'
      : 'ACHADO: a tela nao mudou sozinha.'
  );
  diga();

  /* ---------- 5.3 tela da fabrica, no computador ---------- */
  diga('--- 5.3 tela da fabrica no computador ---');
  await tela.click('.gf-fcard >> nth=0');
  await espera(2000);
  await foto(tela, '17-fabrica-computador.png');
  const fabrica = await lerTela(tela);
  diga('texto da tela da fabrica:\n  ' + fabrica.texto.split('\n').join('\n  '));
  diga();
  diga('atualizacao ao vivo da atividade, com a tela da fabrica aberta:');
  const atividadeAntes = await tela.evaluate(() => (document.body.innerText || '').includes('Passo novo escrito com o painel aberto'));
  semearAoVivo('passo-novo');
  await espera(3000);
  const atividadeDepois = await tela.evaluate(() => (document.body.innerText || '').includes('Passo novo escrito com o painel aberto'));
  diga('o passo novo estava na tela antes: ' + atividadeAntes + '; depois da escrita: ' + atividadeDepois);
  await foto(tela, '18-fabrica-atividade-ao-vivo.png');
  resultado.atividadeAoVivo = { antes: atividadeAntes, depois: atividadeDepois };
  diga();

  /* ================= ITEM 7, ZERO ESCRITA E CONTROLES PARADOS ================= */
  diga('================ ITEM 7, NENHUMA ESCRITA E CONTROLES PARADOS ================');
  diga('--- 7.1 controles da tela da fabrica ---');
  diga('controles DESABILITADOS: ' + JSON.stringify(fabrica.desabilitados, null, 1));
  diga('controles habilitados (navegacao e leitura): ' + JSON.stringify(fabrica.habilitados));
  const caixa = await tela.evaluate(() => {
    const t = document.querySelector('textarea');
    const corpo = document.body.innerText || '';
    return {
      existeCaixa: Boolean(t),
      desabilitada: t ? t.disabled : null,
      motivoNaTela: (corpo.match(/Mandar comando entra na Onda 2[^\n]*/) || [''])[0],
      motivoDaDecisao: (corpo.match(/Responder aprova[^\n]*/) || [''])[0],
      motivoDasAcoes: (corpo.match(/Pausar, reiniciar e encerrar[^\n]*/) || [''])[0]
    };
  });
  diga('caixa de comando: ' + JSON.stringify(caixa, null, 1));
  diga();

  diga('--- 7.2 botoes de decisao na Visao geral ---');
  await tela.click('.gf-side-item:has-text("Visão geral")');
  await espera(1500);
  const decisao = await tela.evaluate(() => {
    const botoes = [...document.querySelectorAll('button')]
      .map((b) => ({ texto: (b.textContent || '').replace(/\s+/g, ' ').trim(), desabilitado: b.disabled }))
      .filter((b) => /Aprovar|Recusar|observa|Pausar|Reiniciar|Encerrar|Abrir nova/.test(b.texto));
    return botoes;
  });
  for (const b of decisao) diga(`  "${b.texto}" desabilitado: ${b.desabilitado}`);
  await foto(tela, '19-decisao-desabilitada-computador.png');
  resultado.decisao = decisao;
  diga();

  /* ================= ITEM 5, CELULAR ================= */
  diga('================ ITEM 5, O CELULAR ================');
  const celular = await navegador.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'pt-BR'
  });
  celular.on('request', (p) => pedidos.push({ metodo: p.method(), url: p.url(), quando: Date.now() }));
  const mob = await celular.newPage();
  await mob.goto(PAINEL, { waitUntil: 'domcontentloaded' });
  await espera(1500);
  await entrar(mob, DIRETOR, { verificado: true });
  await mob.waitForSelector('.gf-mapp', { timeout: 60_000 });
  await espera(2500);
  await foto(mob, '20-celular-entrada.png');
  const cel1 = await lerTela(mob);
  diga('entrada do celular, texto:\n  ' + cel1.texto.split('\n').join('\n  '));
  diga('rolagem da pagina no celular (tem de ser 0): ' + cel1.rolagemDaPagina);
  diga('controles desabilitados no celular: ' + JSON.stringify(cel1.desabilitados));
  diga();

  await mob.click('.gf-mnav-item:has-text("Fábricas")');
  await espera(1500);
  await foto(mob, '21-celular-fabricas.png');
  await mob.click('.gf-mrow >> nth=0');
  await espera(1800);
  await foto(mob, '22-celular-fabrica.png');
  const cel2 = await lerTela(mob);
  diga('tela da fabrica no celular:\n  ' + cel2.texto.split('\n').join('\n  '));
  diga('controles desabilitados: ' + JSON.stringify(cel2.desabilitados));
  diga();

  /* ================= ITEM 6, PONTE OFFLINE ================= */
  diga('================ ITEM 6, PONTE OFFLINE COM DADO REAL ================');
  semear('ponte-velha');
  diga('sinal de vida da maquina envelhecido para 5 minutos atras, com as duas telas abertas.');
  await espera(17_000);
  await foto(tela, '23-ponte-offline-computador.png');
  const offline = await lerTela(tela);
  diga('Visao geral com a ponte offline:\n  ' + offline.texto.split('\n').join('\n  '));
  const estados = await tela.evaluate(() => {
    const selos = [...document.querySelectorAll('.gf-badge, .gf-state-badge')].map((e) =>
      (e.textContent || '').replace(/\s+/g, ' ').trim()
    );
    return { selos, cartoes: document.querySelectorAll('.gf-fcard').length };
  });
  diga('selos de estado na tela: ' + JSON.stringify(estados));
  const todosOffline = estados.selos.filter((s) => /Ponte offline/i.test(s)).length;
  diga('cartoes: ' + estados.cartoes + ', selos dizendo Ponte offline: ' + todosOffline);
  diga();

  await tela.click('.gf-fcard >> nth=0');
  await espera(1800);
  await foto(tela, '24-fabrica-offline-comando-desabilitado.png');
  const caixaOffline = await tela.evaluate(() => {
    const t = document.querySelector('textarea');
    const corpo = document.body.innerText || '';
    return {
      desabilitada: t ? t.disabled : null,
      motivo: (corpo.match(/A ponte está offline[^\n]*/) || [''])[0],
      faixa: (corpo.match(/[^\n]*ponte[^\n]*offline[^\n]*/i) || [''])[0]
    };
  });
  diga('caixa de comando com a ponte offline: ' + JSON.stringify(caixaOffline, null, 1));
  resultado.offline = { estados, caixaOffline };
  diga();

  await mob.click('button[aria-label="Voltar"]').catch(() => {});
  await espera(800);
  await mob.click('.gf-mnav-item:has-text("Fábricas")').catch(() => {});
  await espera(1500);
  await foto(mob, '25-celular-ponte-offline.png');
  const celOffline = await lerTela(mob);
  diga('celular com a ponte offline:\n  ' + celOffline.texto.split('\n').join('\n  '));
  diga();

  /* ================= ITEM 7, FECHAMENTO: ZERO ESCRITA ================= */
  diga('================ ITEM 7, FECHAMENTO: ZERO ESCRITA NO FIRESTORE ================');
  const todosFirestore = pedidos.filter((p) => ehFirestore(p.url));
  const escritas = todosFirestore.filter((p) => ehEscritaFirestore(p.url));
  const porCaminho = {};
  for (const p of todosFirestore) {
    const caminho = new URL(p.url).pathname;
    porCaminho[caminho] = (porCaminho[caminho] ?? 0) + 1;
  }
  diga('pedidos ao emulador do Firestore na sessao inteira: ' + todosFirestore.length);
  diga('por caminho:');
  for (const [c, n] of Object.entries(porCaminho).sort((a, b) => b[1] - a[1])) diga(`  ${n.toString().padStart(4)}  ${c}`);
  diga('pedidos de ESCRITA (Write/channel, commit, batchWrite): ' + escritas.length);
  for (const e of escritas) diga('  ' + e.metodo + ' ' + e.url);
  diga();
  const contagem = await contarDocumentos();
  diga('documentos na base do emulador no fim: ' + JSON.stringify(contagem));
  diga('(tudo que esta ali foi escrito pelo semeador fora do navegador, nunca pelo painel)');
  resultado.escrita = { total: todosFirestore.length, escritas: escritas.length, porCaminho, contagem };
  diga(
    escritas.length === 0
      ? 'VEREDITO 7: ZERO escrita. O painel so abre canal de Listen. Com o Auth ligado, nada mudou.'
      : 'ACHADO: o painel escreveu na base.'
  );
  diga();

  diga('--- console do navegador na sessao inteira ---');
  if (consoleDoPainel.length === 0) diga('  (nenhuma linha)');
  for (const l of consoleDoPainel) diga(`  [${l.tipo}] ${l.texto}`);
  diga();

  writeFileSync(
    join(AQUI, '03-rede-do-emulador.json'),
    JSON.stringify(
      {
        hora: new Date().toISOString(),
        totalDePedidos: pedidos.length,
        firestore: todosFirestore.map((p) => ({ metodo: p.metodo, url: p.url })),
        escritas: escritas.map((p) => ({ metodo: p.metodo, url: p.url })),
        resultado
      },
      null,
      2
    ),
    'utf8'
  );
} finally {
  await navegador.close();
  writeFileSync(join(AQUI, '03-saida.txt'), linhas.join('\n') + '\n', 'utf8');
  console.log('\nevidencia escrita em 03-saida.txt e 03-rede-do-emulador.json');
}
