/*
 * Prova visual do painel contra o emulador, rodada de fechamento da OST 6.
 *
 * Nao escreve nada na nuvem. Fala com o emulador do Firestore e do Auth em
 * 127.0.0.1 e com o painel em desenvolvimento na porta 3210.
 *
 * As fotos ficam nesta mesma pasta de rodada, §A.17. Nada de rodada anterior e
 * tocado.
 *
 * Uso: node provar.mjs
 */

import { spawnSync } from 'node:child_process';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/Henrique/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright');

const AQUI = dirname(fileURLToPath(import.meta.url));
const PAINEL = 'http://127.0.0.1:3210/';
const BASE_EMULADOR = 'http://127.0.0.1:8080/emulator/v1/projects/a-fabrica-soulan/databases/(default)/documents';
const DIRETOR = 'henrique.vieira@soulan.com.br';
const OUTRO = 'outra.pessoa@exemplo.com';

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

async function limparBase() {
  const r = await fetch(BASE_EMULADOR, { method: 'DELETE' });
  if (!r.ok) throw new Error('nao deu para limpar o emulador: ' + r.status);
  console.log('base do emulador limpa');
}

function semear(modo) {
  const r = spawnSync('node', ['semear.mjs', modo], { cwd: AQUI, stdio: 'inherit', shell: true });
  if (r.status !== 0) throw new Error('semear ' + modo + ' falhou');
}

async function foto(pagina, nome) {
  await pagina.screenshot({ path: `${AQUI}/${nome}` });
  console.log('foto: ' + nome);
}

async function entrar(pagina, email) {
  await pagina.waitForSelector('button:has-text("Entrar com o Google")', { timeout: 30_000 });
  const [popup] = await Promise.all([
    pagina.waitForEvent('popup', { timeout: 30_000 }),
    pagina.click('button:has-text("Entrar com o Google")')
  ]);
  await popup.waitForLoadState('domcontentloaded');
  await popup.waitForSelector('#add-account-button', { timeout: 30_000 });
  await espera(800);
  const existente = popup.locator('li', { hasText: email }).first();
  if (await existente.count()) {
    await existente.click();
  } else {
    await popup.click('#add-account-button');
    await popup.waitForSelector('#email-input', { state: 'visible', timeout: 30_000 });
    await popup.fill('#email-input', email);
    await popup.fill('#display-name-input', email === DIRETOR ? 'Henrique Vieira' : 'Outra Pessoa');
    await popup.click('#sign-in');
  }
  await popup.waitForEvent('close', { timeout: 30_000 }).catch(() => {});
}

/* Medidas que o manual exige: a pagina nunca rola e todo alvo de toque do
   celular tem pelo menos 44px. */
const medidas = {};
async function medir(pagina, nome) {
  medidas[nome] = await pagina.evaluate(() => {
    const alvos = [...document.querySelectorAll('button, a, [role="button"], textarea')]
      .filter((e) => e.getBoundingClientRect().height > 0)
      .map((e) => ({
        texto: (e.getAttribute('aria-label') || e.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 32),
        altura: Math.round(e.getBoundingClientRect().height),
        largura: Math.round(e.getBoundingClientRect().width)
      }));
    return {
      rolagemDaPagina: document.documentElement.scrollHeight - window.innerHeight,
      alvosAbaixoDe44: alvos.filter((a) => a.altura < 44),
      totalDeAlvos: alvos.length
    };
  });
}

const navegador = await chromium.launch();

try {
  /* ---------- computador ---------- */
  const pc = await navegador.newContext({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR' });
  const tela = await pc.newPage();
  tela.on('console', (m) => {
    if (m.type() === 'error') console.log('console do painel: ' + m.text());
  });

  await limparBase();
  await tela.goto(PAINEL, { waitUntil: 'domcontentloaded' });
  await espera(1200);
  await foto(tela, '01-entrada-computador.png');

  await entrar(tela, DIRETOR);
  await tela.waitForSelector('.gf-app', { timeout: 60_000 });
  await espera(2000);
  await foto(tela, '02-base-vazia-computador.png');

  /* ---------- celular, base vazia ---------- */
  const cel = await navegador.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    locale: 'pt-BR'
  });
  const mob = await cel.newPage();
  await mob.goto(PAINEL, { waitUntil: 'domcontentloaded' });
  await entrar(mob, DIRETOR);
  await mob.waitForSelector('.gf-mapp', { timeout: 60_000 });
  await espera(2000);
  await foto(mob, '03-base-vazia-celular.png');

  /* ---------- computador, ponte viva ---------- */
  semear('ponte-viva');
  await espera(2500);
  await foto(tela, '04-visao-geral-computador.png');

  await tela.click('.gf-fcard >> nth=0');
  await espera(1500);
  await foto(tela, '05-fabrica-computador.png');

  await tela.click('button:has-text("Tarefas")');
  await espera(800);
  await foto(tela, '06-fabrica-tarefas-computador.png');

  await tela.click('.gf-side-item:has-text("Relatórios")');
  await espera(600);
  await foto(tela, '07-destino-inerte-computador.png');

  await tela.click('.gf-side-item:has-text("Visão geral")');
  await espera(600);

  /* ---------- celular, ponte viva, entrada derivada ao vivo ---------- */
  semear('ponte-viva');
  await mob.reload({ waitUntil: 'domcontentloaded' });
  await mob.waitForSelector('.gf-mapp', { timeout: 60_000 });
  await espera(2500);
  await foto(mob, '08-celular-entrada-aprovacoes.png');

  await medir(mob, 'celular-aprovacoes');

  await mob.click('.gf-mnav-item:has-text("Fábricas")');
  await espera(1000);
  await foto(mob, '09-celular-fabricas.png');
  await medir(mob, 'celular-fabricas');
  await medir(tela, 'computador-visao-geral');

  await mob.click('.gf-mrow >> nth=0');
  await espera(1500);
  await foto(mob, '10-celular-fabrica.png');
  await medir(mob, 'celular-fabrica');

  await mob.click('button[aria-label="Voltar"]');
  await espera(600);
  await mob.click('.gf-mnav-item:has-text("Mais")');
  await espera(600);
  await foto(mob, '11-celular-mais-inerte.png');

  /* ---------- ponte offline, §A.10 ---------- */
  semear('ponte-velha');
  await espera(16_000); // o relogio do painel acorda a cada 15 s
  await foto(tela, '12-ponte-offline-computador.png');
  await mob.click('.gf-mnav-item:has-text("Fábricas")');
  await espera(1200);
  await foto(mob, '13-celular-ponte-offline.png');

  /* ---------- conta que nao e a do diretor ---------- */
  await tela.click('.gf-side-foot button:has-text("Sair")');
  await espera(1500);
  await entrar(tela, OUTRO);
  await espera(3000);
  await foto(tela, '14-conta-recusada-computador.png');

  const { writeFileSync } = await import('node:fs');
  writeFileSync(`${AQUI}/medidas.json`, JSON.stringify(medidas, null, 2), 'utf8');
  console.log('medidas: ' + JSON.stringify(medidas, null, 2));
  console.log('rodada de prova concluida');
} finally {
  await navegador.close();
}
