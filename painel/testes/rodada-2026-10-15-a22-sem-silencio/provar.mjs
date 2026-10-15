/*
 * PROVA DO §A.22, NENHUMA ACAO DO PAINEL FALHA EM SILENCIO.
 *
 * POR QUE ESTA RODADA EXISTE
 * --------------------------
 * O diretor abriu uma fabrica pelo painel e nao viu nada. Tudo funcionou: a ordem
 * foi gravada, a regra aceitou, a ponte executou, a fabrica nasceu, rodou e
 * concluiu em 22 segundos. O painel e que nao disse uma palavra, nem antes nem
 * depois, e devolveu ele para uma lista de vinte fabricas onde a dele, recem
 * aberta, era a ULTIMA, fora da tela.
 *
 * Esta prova mostra as tres telas que faltavam, com navegador de verdade:
 *   1. ordem aceita: o painel leva o diretor para a fabrica que ele abriu e diz
 *      que a ordem foi registrada e que a ponte vai abrir;
 *   2. nada responde: passado o prazo, a tela diz que a fabrica nao nasceu, com o
 *      motivo mais provavel e o proximo passo, em vez de tela parada;
 *   3. ponte offline: a tela diz que nao vai entregar, ANTES de o diretor tentar.
 *
 * CONTRA O EMULADOR, NAO CONTRA A BASE REAL, e o rotulo e esse mesmo. Emulador
 * PROPRIO desta rodada, em portas proprias (Firestore 8399, Auth 9499), com as
 * regras copiadas de firebase/firestore.rules como evidencia, §A.17. O que esta
 * prova mostra e a TELA; que a cadeia inteira funciona na base real ja esta
 * provado em outro lugar, inclusive pela fabrica que o diretor abriu de verdade.
 *
 * Nesta prova NAO existe ponte. E de proposito: sem ninguem para executar, a
 * fabrica nao nasce, e e exatamente o caminho de espera e de falha que precisa
 * aparecer na tela.
 *
 * §A.17 pasta propria da rodada. Nada apagado, nada sobrescrito.
 */

import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/Henrique/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright');

const DIRETOR = 'henrique.vieira@soulan.com.br';
const PAINEL = 'http://127.0.0.1:3310/';
const PROJETO = 'a-fabrica-soulan';
const BASE = `http://127.0.0.1:8399/v1/projects/${PROJETO}/databases/(default)/documents`;

const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const trilha = [];
const registrar = (o) => {
  trilha.push(o);
  console.log(JSON.stringify(o));
};
let erros = 0;
function conferir(ok, rotulo, detalhe) {
  if (!ok) erros++;
  registrar({ veredito: ok ? 'PASSOU' : 'FALHOU', rotulo, detalhe });
}

function semear(modo) {
  const r = spawnSync('node', ['semear.mjs', modo], { stdio: 'inherit', shell: true });
  if (r.status !== 0) throw new Error('semear falhou');
}

async function lerColecao(nome) {
  const r = await fetch(`${BASE}/${nome}?pageSize=300`, { headers: { Authorization: 'Bearer owner' } });
  if (!r.ok) throw new Error(`${nome}: ${r.status}`);
  const corpo = await r.json();
  return (corpo.documents ?? []).map((d) => ({ id: d.name.split('/').pop(), campos: d.fields ?? {} }));
}

const texto = (campos, nome) => campos?.[nome]?.stringValue ?? null;

async function entrar(pagina) {
  await pagina.goto(PAINEL, { waitUntil: 'domcontentloaded' });
  await pagina.waitForSelector('button:has-text("Entrar com o Google")');
  const [pop] = await Promise.all([
    pagina.waitForEvent('popup'),
    pagina.click('button:has-text("Entrar com o Google")')
  ]);
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
  await espera(2500);
}

/** O texto inteiro que o diretor esta vendo agora. */
const naTela = (p) => p.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));

const navegador = await chromium.launch();

/* ============ PARTE 1, ORDEM ACEITA E ESPERA VISIVEL ============ */

semear('ponte-viva');
const ctx = await navegador.newContext({ viewport: { width: 1600, height: 900 }, locale: 'pt-BR' });
const p = await ctx.newPage();
await entrar(p);
await p.waitForSelector('.gf-app');
await espera(1200);

// O semear nao limpa `comandos`, de proposito: §A.17, nada e apagado. Entao a
// conferencia olha a DIFERENCA desta rodada, e nao o total, senao ordem de uma
// execucao anterior contaria como desta.
const abrirAntes = (await lerColecao('comandos')).filter((d) => texto(d.campos, 'acao') === 'abrir').length;
registrar({ passo: '0 base no comeco', ordensDeAbrirQueJaExistiam: abrirAntes });

// A lista esconde fabrica de teste e DIZ quantas escondeu.
const visaoGeral = await naTela(p);
await p.screenshot({ path: 'telas/01-visao-geral-com-aviso-de-escondidas.png' });
conferir(
  /escondida/i.test(visaoGeral),
  'a visao geral diz que existem fabricas de teste escondidas, em vez de filtrar calada',
  (visaoGeral.match(/[^.]*escondid[^.]*/i) ?? ['nao achei a frase'])[0].trim().slice(0, 120)
);

// Abrir fabrica, do jeito que o diretor faz.
await p.click('button:has-text("Abrir nova fábrica")');
await p.waitForSelector('textarea[aria-label="Comando inicial da fábrica"]');
// A pasta sai do atalho de escolha rapida, como o diretor faz. O atalho agora
// NAO oferece pasta de rodada de teste: foi assim que ele acabou abrindo uma
// fabrica apontada para projeto-cc de uma rodada antiga.
await p.click('.gf-pick >> nth=0');
await p.fill(
  'textarea[aria-label="Comando inicial da fábrica"]',
  'prova do §A.22: nenhuma acao do painel falha em silencio'
);
await espera(300);
await p.screenshot({ path: 'telas/02-nova-fabrica-preenchida.png' });

await p.click('button:has-text("Abrir fábrica")');
await espera(2500);

const depois = await lerColecao('comandos');
const todasDeAbrir = depois.filter((d) => texto(d.campos, 'acao') === 'abrir');
const novas = todasDeAbrir.length - abrirAntes;
conferir(novas === 1, 'o painel gravou UMA ordem de abrir na base, e so uma', `ja existiam ${abrirAntes}, agora ${todasDeAbrir.length}, diferenca ${novas}`);
const ultima = todasDeAbrir[todasDeAbrir.length - 1];
const fabricaPedida = ultima ? texto(ultima.campos, 'fabricaId') : null;
registrar({ passo: '1 ordem gravada', fabricaId: fabricaPedida, origem: ultima ? texto(ultima.campos, 'origem') : null });

const telaDepoisDeAbrir = await naTela(p);
await p.screenshot({ path: 'telas/03-levado-para-a-fabrica-esperando.png' });
conferir(
  /Ordem registrada, abrindo a fábrica/i.test(telaDepoisDeAbrir),
  'ANTES: o painel voltava calado para a lista. AGORA: ele leva o diretor para a fabrica e diz que a ordem foi registrada',
  (telaDepoisDeAbrir.match(/Ordem registrada[^.]*\./i) ?? ['nao achei a frase'])[0].slice(0, 160)
);
conferir(
  /Posto de comando/i.test(telaDepoisDeAbrir),
  'o painel esta na tela DA FABRICA que ele acabou de abrir, nao na lista',
  /Posto de comando/i.test(telaDepoisDeAbrir) ? 'cabecalho Posto de comando na tela' : 'nao achei o cabecalho'
);
conferir(
  !/não está mais no painel/i.test(telaDepoisDeAbrir),
  'a tela NAO diz que a fabrica nao existe mais, que era a frase falsa de antes',
  /não está mais no painel/i.test(telaDepoisDeAbrir) ? 'a frase falsa apareceu' : 'a frase falsa nao aparece'
);

/* ============ PARTE 2, PASSOU DO PRAZO E NINGUEM ABRIU ============ */
// Nesta rodada nao existe ponte, entao a fabrica nao nasce nunca. O prazo da tela
// e de 20 segundos; esperamos um pouco mais e lemos o que ela diz.
await espera(23000);
const telaDoPrazo = await naTela(p);
await p.screenshot({ path: 'telas/04-passou-do-prazo-com-motivo.png' });
conferir(
  /não nasceu em \d+ segundos/i.test(telaDoPrazo),
  'passado o prazo, a tela diz que a fabrica nao nasceu, em vez de ficar parada sem explicacao',
  (telaDoPrazo.match(/não nasceu em[^.]*\./i) ?? ['nao achei a frase'])[0].slice(0, 200)
);
conferir(
  /motivo mais provável|pasta do projeto não existir|ponte ficou offline/i.test(telaDoPrazo),
  'a tela diz o motivo mais provavel e o proximo passo, nao so que deu errado',
  (telaDoPrazo.match(/(O motivo mais provável|A ponte ficou offline)[^.]*\./i) ?? ['nao achei'])[0].slice(0, 220)
);

/* ============ PARTE 3, A FALHA PROVOCADA: A PONTE PARA ============ */
// Este e o caso que o diretor pediu de proposito: a ponte para, e ele tem de VER
// o que aconteceu, com o texto certo para ESTE motivo, e nao o texto generico.
semear('ponte-velha');
await espera(4000);
const telaPonteParada = await naTela(p);
await p.screenshot({ path: 'telas/05-ponte-parada-na-tela-da-fabrica.png' });
conferir(
  /A ponte ficou offline depois que a ordem foi registrada/i.test(telaPonteParada),
  'com a ponte parada, a tela da fabrica troca o motivo: diz que ninguem executou e que a ordem espera a ponte voltar',
  (telaPonteParada.match(/A ponte ficou offline[^.]*\./i) ?? ['nao achei a frase'])[0].slice(0, 220)
);
conferir(
  /Inicie a ponte na máquina/i.test(telaPonteParada),
  'a tela diz o PROXIMO PASSO, nao so o motivo',
  /Inicie a ponte na máquina/i.test(telaPonteParada) ? 'proximo passo na tela' : 'nao achei o proximo passo'
);

/* ============ PARTE 3B, PONTE OFFLINE NA VISAO GERAL ============ */
// Voltar para a visao geral: o botao de abrir tem de estar desabilitado, com o
// motivo escrito do lado, ANTES de o diretor tentar.
await p.click('nav button:has-text("Visão geral"), [role="navigation"] >> text=Visão geral').catch(async () => {
  await p.click('text=Visão geral');
});
await espera(2000);
const telaOffline = await naTela(p);
await p.screenshot({ path: 'telas/06-ponte-offline-visao-geral.png' });
conferir(
  /ponte está offline/i.test(telaOffline),
  'com a ponte offline a tela diz, sem o diretor precisar tentar para descobrir',
  (telaOffline.match(/[^.]*ponte está offline[^.]*\./i) ?? ['nao achei'])[0].slice(0, 200)
);

const botaoAbrir = p.locator('button:has-text("Abrir nova fábrica")').first();
const desabilitado = (await botaoAbrir.count()) > 0 ? await botaoAbrir.isDisabled() : null;
conferir(
  desabilitado === true,
  'com a ponte offline o botao de abrir esta desabilitado, e o motivo aparece do lado',
  `desabilitado: ${String(desabilitado)}`
);

/* ============ PARTE 4, O MESMO NO CELULAR ============ */

semear('ponte-viva');
const ctxCel = await navegador.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  locale: 'pt-BR'
});
const c = await ctxCel.newPage();
await entrar(c);
await espera(1500);
// No celular a entrada pode cair em Aprovacoes quando ha pedido parado. O botao
// de abrir mora na tela de Fabricas, entao vamos para la primeiro.
await c.click('text=Fábricas').catch(() => undefined);
await espera(1200);
await c.waitForSelector('button[aria-label="Abrir nova fábrica"]');
await c.click('button[aria-label="Abrir nova fábrica"]');
await c.waitForSelector('textarea[aria-label="Comando inicial da fábrica"]');
await c.click('.gf-li >> nth=0');
await c.fill('textarea[aria-label="Comando inicial da fábrica"]', 'prova do §A.22 no celular');
await espera(300);
await c.click('button:has-text("Abrir fábrica")');
await espera(2500);
const telaCel = await naTela(c);
await c.screenshot({ path: 'telas/06-celular-levado-para-a-fabrica.png' });
conferir(
  /Ordem registrada, abrindo a fábrica/i.test(telaCel),
  'no celular tambem: o painel leva para a fabrica e diz que a ordem foi registrada',
  (telaCel.match(/Ordem registrada[^.]*\./i) ?? ['nao achei a frase'])[0].slice(0, 160)
);

await navegador.close();

writeFileSync('saida-da-prova.txt', trilha.map((o) => JSON.stringify(o)).join('\n'), 'utf8');
console.log('');
console.log(`ROTULO: EMULADOR proprio desta rodada (Firestore 8399, Auth 9499), regras de firebase/firestore.rules.`);
console.log('NAO existe ponte nesta rodada, de proposito: e o caminho de espera e de falha que a prova mostra.');
console.log(erros === 0 ? 'RESUMO: todas as conferencias do §A.22 passaram.' : `RESUMO: ${erros} conferencia(s) FALHOU.`);
process.exit(erros === 0 ? 0 : 1);
