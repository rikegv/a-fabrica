import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/Henrique/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright');
const b = await chromium.launch();
const c = await b.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const p = await c.newPage();
await p.setContent(`<style>
 body{margin:0;font-family:sans-serif}
 .cartao{display:flex;flex-direction:column;align-items:stretch;gap:8px;width:340px;border:1px solid #999;padding:14px}
 .a{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
 .b{display:block}
 .b > span{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
</style>
<div class="cartao">
  <span id="um" class="a">Texto longo de teste que precisa ocupar mais de duas linhas para provar o corte com reticencias no cartao do celular, e segue falando.</span>
  <span id="dois" class="b"><span>Texto longo de teste que precisa ocupar mais de duas linhas para provar o corte com reticencias no cartao do celular, e segue falando.</span></span>
  <span id="tres" class="b"><span>Parou para pedir aprovação.</span></span>
</div>`);
const r = await p.evaluate(() => {
  const m = (id) => { const e = document.getElementById(id); const cs = getComputedStyle(e); return { altura: e.getBoundingClientRect().height, display: cs.display }; };
  return { inline_no_flex: m('um'), aninhado_longo: m('dois'), aninhado_curto: m('tres') };
});
console.log(JSON.stringify(r, null, 2));
await p.screenshot({ path: 'teste-corte.png' });
await b.close();
