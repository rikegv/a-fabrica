/*
 * Item 4, segunda passada, depois do conserto de texto.
 *
 * A primeira passada (03-prova-no-emulador.mjs) mostrou que os dois casos de
 * recusa, conta diferente e e-mail do diretor sem verificacao, davam a MESMA
 * frase, e a frase dizia "esta conta nao e a do diretor" mesmo quando a conta
 * era a do diretor. Verdadeiro no efeito, impreciso na causa. Agora sao duas
 * frases, uma para cada motivo. Esta rodada prova as duas.
 *
 * Fala so com 127.0.0.1. Nada vai para a nuvem.
 *
 * Uso: node 05-mensagens-de-recusa.mjs
 */

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/Henrique/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright');

const AQUI = dirname(fileURLToPath(import.meta.url));
const PAINEL = 'http://127.0.0.1:3399/';
const PROJETO = 'a-fabrica-soulan';
const AUTH = 'http://127.0.0.1:9399';
const DIRETOR = 'henrique.vieira@soulan.com.br';
const OUTRO = 'outra.pessoa@exemplo.com';

const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const linhas = [];
const diga = (t = '') => {
  linhas.push(t);
  console.log(t);
};
const pedidos = [];
const ehFirestore = (u) => u.includes('127.0.0.1:8399');

async function limparContas() {
  const r = await fetch(`${AUTH}/emulator/v1/projects/${PROJETO}/accounts`, { method: 'DELETE' });
  if (!r.ok) throw new Error('nao deu para limpar as contas: ' + r.status);
}

async function entrar(pagina, email, { verificado = true, nome = 'Henrique Vieira' } = {}) {
  await pagina.waitForSelector('button:has-text("Entrar")', { timeout: 30_000 });
  const [popup] = await Promise.all([
    pagina.waitForEvent('popup', { timeout: 30_000 }),
    pagina.click('button:has-text("Entrar")')
  ]);
  await popup.waitForLoadState('domcontentloaded');
  await popup.waitForSelector('#add-account-button', { timeout: 30_000 });
  await espera(600);
  if (verificado) {
    const existente = popup.locator('li', { hasText: email }).first();
    if (await existente.count()) await existente.click();
    else {
      await popup.click('#add-account-button');
      await popup.waitForSelector('#email-input', { state: 'visible', timeout: 30_000 });
      await popup.fill('#email-input', email);
      await popup.fill('#display-name-input', nome);
      await popup.click('#sign-in');
    }
  } else {
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

async function mensagem(pagina) {
  return pagina.evaluate(() => {
    const corpo = document.body.innerText || '';
    const linha = corpo.split('\n').find((l) => /sess[aã]o foi encerrada/.test(l)) ?? '';
    return {
      dentro: Boolean(document.querySelector('.gf-app') || document.querySelector('.gf-mapp')),
      mensagem: linha.trim(),
      botao: ([...document.querySelectorAll('button')].find((b) => /Entrar/.test(b.textContent || '')) || {}).textContent ?? ''
    };
  });
}

diga('ITEM 4, SEGUNDA PASSADA: UMA FRASE PARA CADA MOTIVO DE RECUSA');
diga('hora: ' + new Date().toISOString());
diga();

const navegador = await chromium.launch();
try {
  const ctx = await navegador.newContext({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR' });
  ctx.on('request', (p) => pedidos.push({ metodo: p.method(), url: p.url() }));
  const tela = await ctx.newPage();

  /* ---------- conta diferente ---------- */
  await limparContas();
  await tela.goto(PAINEL, { waitUntil: 'domcontentloaded' });
  await espera(2000);
  const marca1 = pedidos.length;
  await entrar(tela, OUTRO, { verificado: true, nome: 'Outra Pessoa' });
  const r1 = await mensagem(tela);
  await tela.screenshot({ path: join(AQUI, '30-recusa-conta-diferente.png') });
  diga('--- conta diferente, ' + OUTRO + ' ---');
  diga('painel de dentro desenhado: ' + r1.dentro);
  diga('mensagem: ' + r1.mensagem);
  diga('botao: ' + r1.botao);
  diga('pedidos ao Firestore desde o clique: ' + pedidos.slice(marca1).filter((p) => ehFirestore(p.url)).length);
  diga('foto: 30-recusa-conta-diferente.png');
  diga();

  /* ---------- diretor sem e-mail verificado ---------- */
  await limparContas();
  await tela.reload({ waitUntil: 'domcontentloaded' });
  await espera(2000);
  const marca2 = pedidos.length;
  await entrar(tela, DIRETOR, { verificado: false });
  const r2 = await mensagem(tela);
  await tela.screenshot({ path: join(AQUI, '31-recusa-email-nao-verificado.png') });
  diga('--- e-mail do diretor, sem verificacao ---');
  diga('painel de dentro desenhado: ' + r2.dentro);
  diga('mensagem: ' + r2.mensagem);
  diga('botao: ' + r2.botao);
  diga('pedidos ao Firestore desde o clique: ' + pedidos.slice(marca2).filter((p) => ehFirestore(p.url)).length);
  diga('foto: 31-recusa-email-nao-verificado.png');
  diga();

  diga('--- veredito ---');
  diga('as duas frases sao diferentes: ' + (r1.mensagem !== r2.mensagem));
  diga('nenhuma das duas deixa o painel abrir: ' + (!r1.dentro && !r2.dentro));
  diga('nenhuma das duas le a base: ' + (pedidos.filter((p) => ehFirestore(p.url)).length === 0));
  diga('travessao nas duas frases, §A.11: ' + /[\u2014\u2013]/.test(r1.mensagem + r2.mensagem));
} finally {
  await navegador.close();
  writeFileSync(join(AQUI, '05-saida.txt'), linhas.join('\n') + '\n', 'utf8');
  console.log('\nevidencia escrita em 05-saida.txt');
}
