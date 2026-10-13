/*
 * Itens 2 e 3 da OST 6 parte 2, contra a NUVEM de verdade.
 *
 * Item 2: o painel publicado mostra a barreira, o botao de entrar com o Google
 *         dispara, e a janela do Google abre e chega na tela do Google, sem erro
 *         de dominio nao autorizado.
 * Item 3: com o painel aberto e SEM login, nenhuma chamada ao Firestore sai do
 *         navegador; e se alguem fizer a chamada na mao com a chave publica, a
 *         nuvem nega.
 *
 * So leitura. Nenhuma escrita na nuvem. Nenhuma senha e nenhum consentimento:
 * o clique do diretor na tela do Google e dele, §A.6.
 *
 * Uso: node 02-entrada-e-rede.mjs [--cabeca]
 */

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/Henrique/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright');

const AQUI = dirname(fileURLToPath(import.meta.url));
const SITE = 'https://a-fabrica-soulan.web.app/';
const COM_CABECA = process.argv.includes('--cabeca');

const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const linhas = [];
const diga = (t = '') => {
  linhas.push(t);
  console.log(t);
};
const mascarar = (t) =>
  String(t)
    .replace(/AIzaSy[\w-]+/g, 'AIzaSy<mascarado>')
    .replace(/1:(\d+):web:[0-9a-f]+/g, '1:<remetente>:web:<mascarado>')
    .replace(/(client_id=)[\w.-]+/g, '$1<mascarado>')
    .replace(/(apiKey=)[\w-]+/g, '$1<mascarado>');

diga('ITENS 2 E 3, CONTRA A NUVEM DE VERDADE');
diga('endereco: ' + SITE);
diga('navegador: chromium do playwright, ' + (COM_CABECA ? 'com janela' : 'sem janela'));
diga('hora: ' + new Date().toISOString());
diga();

const navegador = await chromium.launch({ headless: !COM_CABECA });
const pedidos = [];
const consoleDoPainel = [];
const falhas = [];

try {
  const contexto = await navegador.newContext({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR' });
  const tela = await contexto.newPage();

  /* Captura de TODO pedido de rede do navegador, de qualquer pagina do contexto. */
  contexto.on('request', (p) => {
    pedidos.push({ quando: Date.now(), metodo: p.method(), url: p.url(), tipo: p.resourceType() });
  });
  contexto.on('requestfailed', (p) => {
    falhas.push({ url: p.url(), erro: p.failure()?.errorText ?? '' });
  });
  tela.on('console', (m) => {
    consoleDoPainel.push({ tipo: m.type(), texto: m.text() });
  });
  tela.on('pageerror', (e) => {
    consoleDoPainel.push({ tipo: 'pageerror', texto: String(e.message ?? e) });
  });

  /* ---------- 2.a a barreira aparece ---------- */
  diga('--- 2.a a barreira de entrada aparece no painel publicado ---');
  const resposta = await tela.goto(SITE, { waitUntil: 'networkidle' });
  diga('HTTP da raiz: ' + resposta.status());
  await espera(3000);
  await tela.screenshot({ path: join(AQUI, '02-barreira-na-nuvem.png') });
  diga('foto: 02-barreira-na-nuvem.png');

  const barreira = await tela.evaluate(() => {
    const botao = [...document.querySelectorAll('button')].find((b) => /Entrar com o Google/.test(b.textContent || ''));
    const texto = (document.body.innerText || '').replace(/\s+\n/g, '\n').trim();
    return {
      existeBotao: Boolean(botao),
      botaoDesabilitado: botao ? botao.disabled : null,
      textoDaTela: texto,
      temAppDoPainel: Boolean(document.querySelector('.gf-app') || document.querySelector('.gf-mapp'))
    };
  });
  diga('botao "Entrar com o Google" existe: ' + barreira.existeBotao);
  diga('botao desabilitado: ' + barreira.botaoDesabilitado);
  diga('painel de dentro desenhado antes do login (.gf-app ou .gf-mapp): ' + barreira.temAppDoPainel);
  diga('texto que a tela mostra, na integra:');
  diga('  ' + barreira.textoDaTela.split('\n').join('\n  '));
  diga();

  /* ---------- 3.a nenhuma chamada ao Firestore sem usuario ---------- */
  diga('--- 3.a trafego de rede do navegador, painel aberto e SEM login ---');
  const comDominio = (re) => pedidos.filter((p) => re.test(p.url));
  const firestore = comDominio(/firestore\.googleapis\.com|firestore\.google\.com|datastore\.googleapis\.com/);
  const identity = comDominio(/identitytoolkit\.googleapis\.com|securetoken\.googleapis\.com/);
  diga('total de pedidos observados ate aqui: ' + pedidos.length);
  diga('pedidos por destino:');
  const porHost = {};
  for (const p of pedidos) {
    const h = new URL(p.url).host;
    porHost[h] = (porHost[h] ?? 0) + 1;
  }
  for (const [h, n] of Object.entries(porHost).sort((a, b) => b[1] - a[1])) diga(`  ${h}: ${n}`);
  diga();
  diga('pedidos ao FIRESTORE antes de haver usuario: ' + firestore.length);
  for (const p of firestore) diga('  ' + p.metodo + ' ' + mascarar(p.url));
  diga('pedidos ao Identity Toolkit antes de clicar em entrar: ' + identity.length);
  for (const p of identity) diga('  ' + p.metodo + ' ' + mascarar(p.url));
  diga();
  diga(
    firestore.length === 0
      ? 'VEREDITO 3.a: ZERO chamada ao Firestore. O ouvinte nao nasce porque a base e nula sem usuario.'
      : 'ACHADO: o painel falou com o Firestore sem usuario autenticado.'
  );
  diga();

  /* ---------- 3.b a nuvem nega quem nao tem sessao, do proprio painel ---------- */
  diga('--- 3.b a mesma leitura feita na mao, da origem do painel publicado, com a chave publica ---');
  const negacao = await tela.evaluate(async () => {
    const cfg = await (await fetch('/__/firebase/init.json', { cache: 'no-store' })).json();
    const colecoes = ['maquinas', 'fabricas', 'aprovacoes', 'comandos', 'relatorios'];
    const saida = [];
    for (const c of colecoes) {
      const url =
        `https://firestore.googleapis.com/v1/projects/${cfg.projectId}` +
        `/databases/(default)/documents/${c}?key=${cfg.apiKey}`;
      const r = await fetch(url);
      const corpo = await r.json().catch(() => ({}));
      saida.push({
        colecao: c,
        http: r.status,
        status: corpo?.error?.status ?? '(sem erro)',
        mensagem: corpo?.error?.message ?? ''
      });
    }
    return saida;
  });
  for (const n of negacao) {
    diga(`  ${n.colecao.padEnd(11)} -> HTTP ${n.http} ${n.status} ${n.mensagem}`);
  }
  const todasNegadas = negacao.every((n) => n.http === 403 && n.status === 'PERMISSION_DENIED');
  diga(
    todasNegadas
      ? 'VEREDITO 3.b: a regra que esta na nuvem nega leitura sem sessao em todas as colecoes, agora, com Auth ligado.'
      : 'ACHADO: alguma colecao respondeu sem sessao.'
  );
  diga();

  /* ---------- 2.b o botao dispara e a janela do Google abre ---------- */
  diga('--- 2.b o botao dispara e a janela do Google abre ---');
  const antesDoClique = pedidos.length;
  let popup = null;
  try {
    [popup] = await Promise.all([
      tela.waitForEvent('popup', { timeout: 45_000 }),
      tela.click('button:has-text("Entrar com o Google")')
    ]);
    diga('a janela abriu, evento popup recebido.');
  } catch (erro) {
    diga('NAO abriu janela: ' + String(erro).split('\n')[0]);
  }

  await espera(1500);
  await tela.screenshot({ path: join(AQUI, '03-painel-depois-do-clique.png') });
  diga('foto do painel depois do clique: 03-painel-depois-do-clique.png');

  if (popup) {
    diga('url inicial da janela: ' + mascarar(popup.url()));
    /* A janela do Firebase redireciona para o Google. Espera a navegacao assentar. */
    for (let i = 0; i < 20; i += 1) {
      await espera(1500);
      const u = popup.url();
      if (/accounts\.google\.com/.test(u)) break;
      if (popup.isClosed()) break;
    }
    const aberta = !popup.isClosed();
    diga('janela ainda aberta: ' + aberta);
    if (aberta) {
      const urlFinal = popup.url();
      diga('url onde a janela parou: ' + mascarar(urlFinal));
      diga('host: ' + new URL(urlFinal).host);
      await popup.screenshot({ path: join(AQUI, '04-janela-do-google.png') }).catch((e) => diga('foto da janela falhou: ' + e.message));
      diga('foto da janela: 04-janela-do-google.png');
      const dentroDaJanela = await popup
        .evaluate(() => ({
          titulo: document.title,
          texto: (document.body.innerText || '').replace(/\s+/g, ' ').trim().slice(0, 600)
        }))
        .catch(() => ({ titulo: '(sem acesso)', texto: '(sem acesso)' }));
      diga('titulo da janela: ' + dentroDaJanela.titulo);
      diga('texto que a janela mostra: ' + dentroDaJanela.texto);
      const naTelaDoGoogle = /accounts\.google\.com/.test(urlFinal);
      diga(
        naTelaDoGoogle
          ? 'VEREDITO 2.b: a janela chegou no accounts.google.com. Daqui para frente e o clique do diretor.'
          : 'A janela nao chegou no accounts.google.com, ver o texto acima.'
      );
    } else {
      diga('a janela fechou sozinha, o que normalmente quer dizer erro de configuracao. Ver o console abaixo.');
    }
  }
  diga();

  /* ---------- 2.c o que o painel registrou, e o erro de dominio ---------- */
  diga('--- 2.c o que o navegador registrou no console do painel ---');
  if (consoleDoPainel.length === 0) diga('  (nenhuma linha, nem erro nem aviso)');
  for (const l of consoleDoPainel) diga(`  [${l.tipo}] ${mascarar(l.texto)}`);
  diga();

  const estadoFinal = await tela.evaluate(() => {
    const botao = [...document.querySelectorAll('button')].find((b) => /Entrar com o Google/.test(b.textContent || ''));
    return {
      texto: (document.body.innerText || '').replace(/\s+\n/g, '\n').trim(),
      botaoDesabilitado: botao ? botao.disabled : null
    };
  });
  diga('texto da tela do painel depois do clique:');
  diga('  ' + estadoFinal.texto.split('\n').join('\n  '));
  diga('botao desabilitado durante a entrada: ' + estadoFinal.botaoDesabilitado);
  diga();

  const erroDeDominio = [...consoleDoPainel, ...linhas].some((x) =>
    /unauthorized-domain|unauthorized_domain|configuration-not-found|operation-not-allowed|disallowed_useragent/.test(
      typeof x === 'string' ? x : x.texto
    )
  );
  diga('--- 2.d procura por erro de configuracao ---');
  for (const codigo of [
    'auth/unauthorized-domain',
    'auth/configuration-not-found',
    'auth/operation-not-allowed',
    'auth/popup-blocked',
    'auth/internal-error',
    'disallowed_useragent'
  ]) {
    const achado = [...consoleDoPainel.map((c) => c.texto), estadoFinal.texto, ...linhas].some((t) => t.includes(codigo));
    diga(`  ${codigo}: ${achado ? 'ACHADO, grave' : 'nao apareceu'}`);
  }
  diga('resumo: ' + (erroDeDominio ? 'ACHADO GRAVE, erro de configuracao do Auth' : 'nenhum erro de configuracao do Auth'));
  diga();

  /* ---------- 3.c depois do clique, ainda nenhuma leitura da base ---------- */
  diga('--- 3.c depois do clique no botao, e com a janela do Google aberta ---');
  const depois = pedidos.slice(antesDoClique);
  const firestoreDepois = depois.filter((p) =>
    /firestore\.googleapis\.com|firestore\.google\.com/.test(p.url)
  );
  const naoSaoMinhas = firestoreDepois.filter((p) => !/[?&]key=/.test(p.url));
  diga('pedidos novos depois do clique: ' + depois.length);
  diga('destinos novos:');
  const porHost2 = {};
  for (const p of depois) {
    const h = new URL(p.url).host;
    porHost2[h] = (porHost2[h] ?? 0) + 1;
  }
  for (const [h, n] of Object.entries(porHost2).sort((a, b) => b[1] - a[1])) diga(`  ${h}: ${n}`);
  diga('pedidos ao Firestore feitos pelo PAINEL (fora da sonda 3.b): ' + naoSaoMinhas.length);
  for (const p of naoSaoMinhas) diga('  ' + p.metodo + ' ' + mascarar(p.url));
  diga(
    naoSaoMinhas.length === 0
      ? 'VEREDITO 3.c: nem durante a entrada o painel le a base. A base so nasce quando a conta e conferida.'
      : 'ACHADO: o painel leu a base durante a entrada.'
  );
  diga();

  writeFileSync(
    join(AQUI, '02-trafego-de-rede.json'),
    JSON.stringify(
      {
        endereco: SITE,
        hora: new Date().toISOString(),
        totalDePedidos: pedidos.length,
        pedidos: pedidos.map((p) => ({ metodo: p.metodo, url: mascarar(p.url), tipo: p.tipo })),
        falhas: falhas.map((f) => ({ url: mascarar(f.url), erro: f.erro })),
        console: consoleDoPainel.map((c) => ({ tipo: c.tipo, texto: mascarar(c.texto) }))
      },
      null,
      2
    ),
    'utf8'
  );
} finally {
  await navegador.close();
  writeFileSync(join(AQUI, '02-saida.txt'), linhas.join('\n') + '\n', 'utf8');
  console.log('\nevidencia escrita em 02-saida.txt e 02-trafego-de-rede.json');
}
