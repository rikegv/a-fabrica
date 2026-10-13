/* Confere, depois do ajuste de 44px, que todo alvo de toque do celular tem pelo
   menos a medida de toque, e que nenhuma tela do celular rola a pagina. */
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/Henrique/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright');
const DIRETOR = 'henrique.vieira@soulan.com.br';
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const medida = (p) => p.evaluate(() => {
  const alvos = [...document.querySelectorAll('button, a, [role="button"], textarea')]
    .filter((e) => e.getBoundingClientRect().height > 0)
    .map((e) => ({ texto: (e.getAttribute('aria-label') || e.textContent || '').replace(/\s+/g,' ').trim().slice(0,32), altura: Math.round(e.getBoundingClientRect().height) }));
  return { rolagemDaPagina: document.documentElement.scrollHeight - window.innerHeight, total: alvos.length, abaixoDe44: alvos.filter((a) => a.altura < 44) };
});

spawnSync('node', ['semear.mjs', 'ponte-viva'], { stdio: 'inherit', shell: true });
const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: 'pt-BR' });
const p = await c.newPage();
await p.goto('http://127.0.0.1:3210/', { waitUntil: 'domcontentloaded' });
await p.waitForSelector('button:has-text("Entrar com o Google")');
const [pop] = await Promise.all([p.waitForEvent('popup'), p.click('button:has-text("Entrar com o Google")')]);
await pop.waitForSelector('#add-account-button');
await espera(800);
const existente = pop.locator('li', { hasText: DIRETOR }).first();
if (await existente.count()) await existente.click();
else { await pop.click('#add-account-button'); await pop.waitForSelector('#email-input', { state: 'visible' }); await pop.fill('#email-input', DIRETOR); await pop.click('#sign-in'); }
await pop.waitForEvent('close').catch(() => {});
await p.waitForSelector('.gf-mapp');
await espera(2500);
const saida = {};
saida.aprovacoes = await medida(p);
await p.screenshot({ path: 'conferencia-toque/15-celular-aprovacoes-toque.png' });
await p.click('.gf-mnav-item:has-text("Fábricas")');
await espera(1200);
saida.fabricas = await medida(p);
await p.screenshot({ path: 'conferencia-toque/16-celular-fabricas-toque.png' });
await p.click('.gf-mrow >> nth=0');
await espera(1500);
saida.fabrica = await medida(p);
await p.screenshot({ path: 'conferencia-toque/17-celular-fabrica-toque.png' });
writeFileSync('conferencia-toque/medidas-de-toque.json', JSON.stringify(saida, null, 2), 'utf8');
console.log(JSON.stringify(saida, null, 2));
await b.close();
