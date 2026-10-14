/*
 * Print extra da confirmacao de encerrar no computador, ASSENTADA.
 *
 * Por que existe: na prova cheia o print 06 saiu com a folha no meio da
 * animacao de entrada (0,18 s), meio transparente, e isso parece defeito que
 * nao existe. Em vez de apagar e refazer a rodada, §A.17, esta prova tira um
 * print novo, com nome novo, na mesma pasta: 06b.
 *
 * Mesmo emulador da rodada: Firestore 127.0.0.1:8299, Authentication
 * 127.0.0.1:9399.
 */

import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/Henrique/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright');

const DIRETOR = 'henrique.vieira@soulan.com.br';
const espera = (ms) => new Promise((r) => setTimeout(r, ms));

spawnSync('node', ['semear.mjs', 'ponte-viva'], { stdio: 'inherit', shell: true });

const navegador = await chromium.launch();
const ctx = await navegador.newContext({ viewport: { width: 1600, height: 900 }, locale: 'pt-BR' });
const p = await ctx.newPage();
await p.goto('http://127.0.0.1:3210/', { waitUntil: 'domcontentloaded' });
await p.waitForSelector('button:has-text("Entrar com o Google")');
const [pop] = await Promise.all([p.waitForEvent('popup'), p.click('button:has-text("Entrar com o Google")')]);
await pop.waitForSelector('#add-account-button');
await espera(700);
const existente = pop.locator('li', { hasText: DIRETOR }).first();
if (await existente.count()) await existente.click();
else {
  await pop.click('#add-account-button');
  await pop.waitForSelector('#email-input', { state: 'visible' });
  await pop.fill('#email-input', DIRETOR);
  await pop.click('#sign-in');
}
await pop.waitForEvent('close').catch(() => {});
await p.waitForSelector('.gf-app');
await espera(2500);
await p.click('.gf-fcard >> nth=0');
await espera(1500);
await p.click('.gf-fhead-actions button:has-text("Encerrar")');
await p.waitForSelector('[role="dialog"]');
await espera(900);
await p.screenshot({ path: 'telas/06b-computador-confirmacao-assentada.png' });
console.log('print assentado em telas/06b-computador-confirmacao-assentada.png');
await navegador.close();
