/* Confere o cartao do celular depois do conserto: a linha do que a fabrica faz
   tem altura de verdade e a lista cabe na tela. Fotos nesta mesma rodada. */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/Henrique/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright');
const DIRETOR = 'henrique.vieira@soulan.com.br';
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

async function entrar(p) {
  await p.waitForSelector('button:has-text("Entrar com o Google")');
  const [pop] = await Promise.all([p.waitForEvent('popup'), p.click('button:has-text("Entrar com o Google")')]);
  await pop.waitForSelector('#add-account-button');
  await espera(800);
  const existente = pop.locator('li', { hasText: DIRETOR }).first();
  if (await existente.count()) {
    await existente.click();
  } else {
    await pop.click('#add-account-button');
    await pop.waitForSelector('#email-input', { state: 'visible' });
    await pop.fill('#email-input', DIRETOR);
    await pop.click('#sign-in');
  }
  await pop.waitForEvent('close').catch(() => {});
}

const b = await chromium.launch();
for (const [nome, largura, altura] of [['21-prova-de-token-cor-trocada', 390, 844]]) {
  spawnSync('node', ['semear.mjs', 'ponte-viva'], { cwd: process.cwd(), stdio: 'inherit', shell: true });
  const c = await b.newContext({ viewport: { width: largura, height: altura }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'pt-BR' });
  const p = await c.newPage();
  await p.goto('http://127.0.0.1:3210/', { waitUntil: 'domcontentloaded' });
  await entrar(p);
  await p.waitForSelector('.gf-mapp');
  await espera(2500);
  await p.click('.gf-mnav-item:has-text("Fábricas")');
  await espera(1200);
  await p.screenshot({ path: nome + '.png' });
  const m = await p.evaluate(() => {
    const cartoes = [...document.querySelectorAll('.gf-mrow')];
    const nav = document.querySelector('.gf-mnav').getBoundingClientRect();
    return {
      cartoes: cartoes.map((e) => {
        const linha = e.querySelector('span.body');
        const r = e.getBoundingClientRect();
        return { altura: Math.round(r.height), fim: Math.round(r.bottom), linha: linha ? Math.round(linha.getBoundingClientRect().height) : null, texto: linha ? linha.textContent.slice(0, 40) : null };
      }),
      topoDaBarra: Math.round(nav.top)
    };
  });
  console.log(nome, JSON.stringify(m, null, 1));
  await c.close();
}
await b.close();
