import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/Henrique/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright');
const DIRETOR = 'henrique.vieira@soulan.com.br';
const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const p = await c.newPage();
await p.goto('http://127.0.0.1:3210/', { waitUntil: 'domcontentloaded' });
await p.waitForSelector('button:has-text("Entrar com o Google")');
const [pop] = await Promise.all([p.waitForEvent('popup'), p.click('button:has-text("Entrar com o Google")')]);
await pop.waitForSelector('#add-account-button');
await pop.click('#add-account-button');
await pop.fill('#email-input', DIRETOR);
await pop.click('#sign-in');
await pop.waitForEvent('close').catch(()=>{});
await p.waitForSelector('.gf-mapp');
await new Promise(r=>setTimeout(r,2500));
await p.click('.gf-mnav-item:has-text("Fábricas")');
await new Promise(r=>setTimeout(r,1200));
const html = await p.$eval('.gf-mrow', (e) => e.outerHTML);
console.log('HTML DO CARTAO:\n' + html);
const info = await p.$eval('.gf-mrow', (e) => {
  const linha = e.querySelector('span.body');
  const cs = linha ? getComputedStyle(linha) : null;
  const r = e.getBoundingClientRect();
  return {
    cartao: { altura: r.height, overflow: getComputedStyle(e).overflow, display: getComputedStyle(e).display, flexDirection: getComputedStyle(e).flexDirection },
    temLinha: Boolean(linha),
    texto: linha ? linha.textContent : null,
    alturaLinha: linha ? linha.getBoundingClientRect().height : null,
    display: cs ? cs.display : null,
    boxOrient: cs ? cs.webkitBoxOrient || cs.getPropertyValue('-webkit-box-orient') : null,
    lineClamp: cs ? cs.getPropertyValue('-webkit-line-clamp') : null,
    overflow: cs ? cs.overflow : null,
    cor: cs ? cs.color : null,
    fontSize: cs ? cs.fontSize : null
  };
});
console.log('MEDIDAS:', JSON.stringify(info, null, 2));
const corpo = await p.$eval('.gf-mbody', (e) => { const cs = getComputedStyle(e); const r = e.getBoundingClientRect(); return { altura: r.height, overflow: cs.overflow, display: cs.display }; });
console.log('CORPO:', JSON.stringify(corpo));
await b.close();
