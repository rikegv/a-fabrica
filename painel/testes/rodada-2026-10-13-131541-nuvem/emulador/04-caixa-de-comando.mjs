/*
 * Complemento dos itens 6 e 7: a caixa de comando diz POR QUE esta parada, e o
 * texto muda quando a ponte cai.
 *
 * O motivo vive no proprio campo (atributo placeholder do textarea), entao ele
 * nao aparece no texto corrido da pagina. Aqui o motivo e lido do campo e
 * fotografado de perto, no computador e no celular.
 *
 * Fala so com 127.0.0.1. Nada vai para a nuvem.
 *
 * Uso: node 04-caixa-de-comando.mjs
 */

import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/Henrique/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright');

const AQUI = dirname(fileURLToPath(import.meta.url));
const PAINEL = 'http://127.0.0.1:3399/';
const DIRETOR = 'henrique.vieira@soulan.com.br';
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const linhas = [];
const diga = (t = '') => {
  linhas.push(t);
  console.log(t);
};
function semear(modo) {
  const r = spawnSync('node', ['semear.mjs', modo], { cwd: AQUI, stdio: 'inherit', shell: true });
  if (r.status !== 0) throw new Error('semear ' + modo + ' falhou');
}
async function entrar(pagina) {
  await pagina.waitForSelector('button:has-text("Entrar com o Google")', { timeout: 30_000 });
  const [popup] = await Promise.all([
    pagina.waitForEvent('popup', { timeout: 30_000 }),
    pagina.click('button:has-text("Entrar com o Google")')
  ]);
  await popup.waitForLoadState('domcontentloaded');
  await popup.waitForSelector('#add-account-button', { timeout: 30_000 });
  await espera(600);
  const existente = popup.locator('li', { hasText: DIRETOR }).first();
  if (await existente.count()) await existente.click();
  else {
    await popup.click('#add-account-button');
    await popup.waitForSelector('#email-input', { state: 'visible', timeout: 30_000 });
    await popup.fill('#email-input', DIRETOR);
    await popup.fill('#display-name-input', 'Henrique Vieira');
    await popup.click('#sign-in');
  }
  await popup.waitForEvent('close', { timeout: 30_000 }).catch(() => {});
  await espera(2500);
}
async function lerCaixa(pagina) {
  return pagina.evaluate(() => {
    const t = document.querySelector('textarea');
    const botaoEnviar = [...document.querySelectorAll('button')].find((b) => /^Enviar$/.test((b.textContent || '').trim()));
    return {
      existe: Boolean(t),
      desabilitada: t ? t.disabled : null,
      rotulo: t ? t.getAttribute('aria-label') : null,
      motivoNoCampo: t ? t.getAttribute('placeholder') : null,
      classe: t ? t.parentElement.className : null,
      botaoEnviarDesabilitado: botaoEnviar ? botaoEnviar.disabled : null
    };
  });
}
async function fotoDaCaixa(pagina, nome) {
  const caixa = pagina.locator('.gf-cmd').first();
  await caixa.screenshot({ path: join(AQUI, nome) }).catch(async () => {
    await pagina.screenshot({ path: join(AQUI, nome) });
  });
  diga('foto: ' + nome);
}

diga('COMPLEMENTO DOS ITENS 6 E 7, A CAIXA DE COMANDO DIZ POR QUE ESTA PARADA');
diga('hora: ' + new Date().toISOString());
diga();

const navegador = await chromium.launch();
try {
  semear('ponte-viva');
  const pc = await navegador.newContext({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR' });
  const tela = await pc.newPage();
  await tela.goto(PAINEL, { waitUntil: 'domcontentloaded' });
  await entrar(tela);
  await tela.waitForSelector('.gf-app', { timeout: 60_000 });
  await espera(2500);
  await tela.click('.gf-fcard >> nth=0');
  await espera(2000);

  diga('--- ponte CONECTADA, computador ---');
  const viva = await lerCaixa(tela);
  diga(JSON.stringify(viva, null, 1));
  await fotoDaCaixa(tela, '26-caixa-ponte-conectada.png');
  diga();

  const cel = await navegador.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'pt-BR'
  });
  const mob = await cel.newPage();
  await mob.goto(PAINEL, { waitUntil: 'domcontentloaded' });
  await entrar(mob);
  await mob.waitForSelector('.gf-mapp', { timeout: 60_000 });
  await espera(2000);
  await mob.click('.gf-mnav-item:has-text("Fábricas")');
  await espera(1200);
  await mob.click('.gf-mrow >> nth=0');
  await espera(1800);
  diga('--- ponte CONECTADA, celular ---');
  const vivaCel = await lerCaixa(mob);
  diga(JSON.stringify(vivaCel, null, 1));
  await fotoDaCaixa(mob, '27-celular-caixa-ponte-conectada.png');
  diga();

  semear('ponte-velha');
  diga('sinal de vida envelhecido para 5 minutos atras, com as duas telas abertas e sem recarregar.');
  await espera(17_000);

  diga('--- ponte OFFLINE, computador ---');
  const morta = await lerCaixa(tela);
  diga(JSON.stringify(morta, null, 1));
  await fotoDaCaixa(tela, '28-caixa-ponte-offline.png');
  diga();

  diga('--- ponte OFFLINE, celular ---');
  const mortaCel = await lerCaixa(mob);
  diga(JSON.stringify(mortaCel, null, 1));
  await fotoDaCaixa(mob, '29-celular-caixa-ponte-offline.png');
  diga();

  diga('--- veredito ---');
  diga('computador, ponte conectada: ' + (morta.desabilitada && viva.desabilitada ? 'desabilitada nos dois estados' : 'ACHADO'));
  diga('o motivo muda quando a ponte cai: ' + (viva.motivoNoCampo !== morta.motivoNoCampo));
  diga('  conectada: "' + viva.motivoNoCampo + '"');
  diga('  offline:   "' + morta.motivoNoCampo + '"');
  diga('celular, o motivo muda tambem: ' + (vivaCel.motivoNoCampo !== mortaCel.motivoNoCampo));
  diga('  conectada: "' + vivaCel.motivoNoCampo + '"');
  diga('  offline:   "' + mortaCel.motivoNoCampo + '"');
  diga('travessao em algum desses textos, §A.11: ' + /[\u2014\u2013]/.test([viva, morta, vivaCel, mortaCel].map((x) => x.motivoNoCampo).join(' ')));
} finally {
  await navegador.close();
  writeFileSync(join(AQUI, '04-saida.txt'), linhas.join('\n') + '\n', 'utf8');
  console.log('\nevidencia escrita em 04-saida.txt');
}
