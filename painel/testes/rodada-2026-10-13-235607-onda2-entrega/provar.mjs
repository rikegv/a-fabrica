/*
 * PROVA AO VIVO DA ONDA 2, OST 7 Bloco 2, metade do PAINEL.
 *
 * CONTRA O EMULADOR, NAO CONTRA A BASE REAL. Emulador proprio desta rodada,
 * subido com firebase.emulador.json desta pasta: Firestore 127.0.0.1:8299 e
 * Authentication 127.0.0.1:9399, com as regras copiadas de
 * firebase/firestore.rules. Toda tela e todo documento deste arquivo sai dai, e
 * o relatorio diz isso com essas palavras.
 *
 * Base limpa de proposito: comandos comeca em zero, entao todo documento que
 * aparecer em comandos foi o PAINEL que escreveu, sem duvida de autoria.
 *
 * O que ela prova, na ordem:
 *   1. abrir fabrica pela tela de nova fabrica, e o comando na base com acao
 *      abrir, situacao pendente, hora de servidor e origem legivel;
 *   2. mandar comando pela caixa viva, e o comando na base;
 *   3. as tres respostas de aprovacao, cada uma no seu pedido, e cada pedido
 *      lido logo depois de responder;
 *   4. encerrar com confirmacao, e o cancelar NAO escrevendo nada;
 *   5. o mesmo no desenho de celular, com medida de alvo de toque de 44;
 *   6. ponte offline: botao de escrita desabilitado e a tela dizendo por que.
 *
 * Nada e apagado: cada passo grava print e medida nesta pasta, §A.17.
 */

import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('C:/Users/Henrique/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright');

const DIRETOR = 'henrique.vieira@soulan.com.br';
const PAINEL = 'http://127.0.0.1:3210/';
const PROJETO = 'a-fabrica-soulan';
const BASE = `http://127.0.0.1:8299/v1/projects/${PROJETO}/databases/(default)/documents`;

const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const trilha = [];
const registrar = (o) => {
  trilha.push(o);
  console.log(JSON.stringify(o));
};

function semear(modo) {
  const r = spawnSync('node', ['semear.mjs', modo], { stdio: 'inherit', shell: true });
  if (r.status !== 0) throw new Error('semear falhou');
}

/* Leitura crua da base pelo endereco do emulador, com a credencial de dono: e
   assim que a prova le o que o PAINEL escreveu, sem passar pelo painel. */
async function lerColecao(nome) {
  const r = await fetch(`${BASE}/${nome}?pageSize=300`, { headers: { Authorization: 'Bearer owner' } });
  if (!r.ok) throw new Error(`${nome}: ${r.status}`);
  const corpo = await r.json();
  return (corpo.documents ?? []).map((d) => ({ id: d.name.split('/').pop(), campos: d.fields ?? {} }));
}

async function lerDocumento(caminho) {
  const r = await fetch(`${BASE}/${caminho}`, { headers: { Authorization: 'Bearer owner' } });
  if (!r.ok) throw new Error(`${caminho}: ${r.status}`);
  const d = await r.json();
  return { id: d.name.split('/').pop(), campos: d.fields ?? {} };
}

const texto = (campos, chave) => campos[chave]?.stringValue ?? null;
const hora = (campos, chave) => campos[chave]?.timestampValue ?? null;
const presente = (campos, chave) => (campos[chave] === undefined ? 'ausente' : campos[chave]);

/* O comando como ele esta na base, campo por campo, sem resumo. */
function comando(doc) {
  return {
    id: doc.id,
    acao: texto(doc.campos, 'acao'),
    situacao: texto(doc.campos, 'situacao'),
    criadoEm: hora(doc.campos, 'criadoEm'),
    entregueEm: presente(doc.campos, 'entregueEm'),
    origem: texto(doc.campos, 'origem'),
    fabricaId: texto(doc.campos, 'fabricaId'),
    maquinaId: texto(doc.campos, 'maquinaId'),
    texto: texto(doc.campos, 'texto'),
    cwd: texto(doc.campos, 'cwd'),
    agente: texto(doc.campos, 'agente'),
    modelo: presente(doc.campos, 'modelo'),
    conversationId: texto(doc.campos, 'conversationId')
  };
}

function aprovacao(doc) {
  return {
    id: doc.id,
    situacao: texto(doc.campos, 'situacao'),
    resposta: texto(doc.campos, 'resposta'),
    observacao: doc.campos.observacao?.nullValue === null ? null : texto(doc.campos, 'observacao'),
    respondidoEm: hora(doc.campos, 'respondidoEm'),
    respondidoPor: texto(doc.campos, 'respondidoPor'),
    criadoEm: hora(doc.campos, 'criadoEm')
  };
}

/* Toda ordem desta prova sai do painel, e o painel escreve origem legivel. A
   prova confere isso em vez de confiar na ordem de chegada. */
const DO_PAINEL = (doc) => (texto(doc.campos, 'origem') ?? '').startsWith('painel no ');

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

/* Medida de alvo de toque e de rolagem da pagina, a mesma conferencia da OST 6,
   agora tambem com campo de digitar e opcao de escolhedor, que a Onda 2 trouxe. */
const medir = (p) =>
  p.evaluate(() => {
    const alvos = [...document.querySelectorAll('button, a, [role="button"], [role="radio"], textarea, input')]
      .filter((e) => e.getBoundingClientRect().height > 0 && !e.disabled)
      .map((e) => ({
        texto: (e.getAttribute('aria-label') || e.textContent || e.placeholder || '')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 40),
        altura: Math.round(e.getBoundingClientRect().height),
        largura: Math.round(e.getBoundingClientRect().width)
      }));
    return {
      rolagemDaPagina: document.documentElement.scrollHeight - window.innerHeight,
      totalDeAlvos: alvos.length,
      abaixoDe44: alvos.filter((a) => a.altura < 44)
    };
  });

const navegador = await chromium.launch();

/* ============ PARTE 1, COMPUTADOR ============ */

semear('ponte-viva');
const ctxComputador = await navegador.newContext({ viewport: { width: 1600, height: 900 }, locale: 'pt-BR' });
const p = await ctxComputador.newPage();
await entrar(p);
await p.waitForSelector('.gf-app');
await espera(1200);
await p.screenshot({ path: 'telas/01-computador-visao-geral.png' });

registrar({ passo: '0 base no comeco', comandos: (await lerColecao('comandos')).length });

/* --- 1. abrir fabrica pela tela --- */
await p.click('button:has-text("Abrir nova fábrica")');
await p.waitForSelector('textarea[aria-label="Comando inicial da fábrica"]');
await p.click('.gf-pick >> nth=0');
await p.fill(
  'textarea[aria-label="Comando inicial da fábrica"]',
  'Implemente o envio de documentos e me peça aprovação antes de mexer no banco.'
);
await p.screenshot({ path: 'telas/02-computador-nova-fabrica.png' });
await p.click('button:has-text("Abrir fábrica")');
await espera(2000);
await p.screenshot({ path: 'telas/03-computador-abertura-registrada.png' });

let comandos = (await lerColecao('comandos')).filter(DO_PAINEL);
registrar({
  passo: '1 abrir fabrica pela tela de nova fabrica',
  comandosDoPainel: comandos.length,
  documento: comandos.map(comando).find((c) => c.acao === 'abrir')
});

/* --- 2. mandar comando pela caixa viva --- */
await p.click('.gf-fcard >> nth=0');
await p.waitForSelector('textarea[aria-label="Comando para esta fábrica"]');
await p.fill(
  'textarea[aria-label="Comando para esta fábrica"]',
  'Rode os testes do fluxo de documentos e me diga o que quebrou.'
);
await p.screenshot({ path: 'telas/04-computador-fabrica-caixa-viva.png' });
await p.click('.gf-cmd button:has-text("Enviar")');
await espera(2000);
await p.screenshot({ path: 'telas/05-computador-comando-registrado.png' });

comandos = (await lerColecao('comandos')).filter(DO_PAINEL);
registrar({
  passo: '2 mandar comando pela caixa viva',
  comandosDoPainel: comandos.length,
  documento: comandos.map(comando).find((c) => c.acao === 'comando')
});

/* --- 4a. encerrar: a confirmacao aparece e o CANCELAR nao escreve --- */
const antesDoCancelar = (await lerColecao('comandos')).length;
await p.click('.gf-fhead-actions button:has-text("Encerrar")');
await p.waitForSelector('[role="dialog"]');
/* a folha entra com animacao de 0,18 s; sem esta espera o print pega ela no meio
   da entrada, meio transparente, e parece defeito que nao existe */
await espera(600);
await p.screenshot({ path: 'telas/06-computador-confirmacao-de-encerrar.png' });
await p.click('[role="dialog"] button:has-text("Deixar rodando")');
await espera(1500);
const depoisDoCancelar = (await lerColecao('comandos')).length;
registrar({
  passo: '4a cancelar o encerramento nao escreve nada',
  comandosAntes: antesDoCancelar,
  comandosDepois: depoisDoCancelar,
  escreveu: depoisDoCancelar !== antesDoCancelar
});

/* --- 4b. encerrar de verdade --- */
await p.click('.gf-fhead-actions button:has-text("Encerrar")');
await p.waitForSelector('[role="dialog"]');
await p.click('[role="dialog"] button:has-text("Encerrar a fábrica")');
await espera(2000);
await p.screenshot({ path: 'telas/07-computador-encerramento-registrado.png' });
comandos = (await lerColecao('comandos')).filter(DO_PAINEL);
registrar({
  passo: '4b encerrar com confirmacao',
  documento: comandos.map(comando).find((c) => c.acao === 'encerrar')
});

/* --- 4c. pausar e retomar, na fabrica que a ponte marcou pausada --- */
await p.click('button[aria-label="Voltar"]');
await espera(1000);
const cartaoPausado = p.locator('.gf-fcard', { hasText: 'Base de Conhecimento' }).first();
if (await cartaoPausado.count()) {
  await cartaoPausado.click();
  await espera(1200);
  await p.screenshot({ path: 'telas/08-computador-fabrica-pausada.png' });
  await p.click('.gf-fhead-actions button:has-text("Retomar")');
  await espera(2000);
  await p.screenshot({ path: 'telas/09-computador-retomada-registrada.png' });
  comandos = (await lerColecao('comandos')).filter(DO_PAINEL);
  registrar({
    passo: '4c retomar a fabrica pausada',
    documento: comandos.map(comando).find((c) => c.acao === 'reiniciar')
  });
  await p.click('button[aria-label="Voltar"]');
  await espera(800);
}

/* Pausar: numa fabrica que NAO esta pausada. A pausada continua pausada depois
   da ordem de retomada, e isso esta certo: quem muda o campo pausada e a ponte,
   quando executa. O painel registra a ordem, nao finge o efeito. */
const cartaoRodando = p.locator('.gf-fcard', { hasText: 'Folha Integração' }).first();
if (await cartaoRodando.count()) {
  await cartaoRodando.click();
  await espera(1200);
  await p.click('.gf-fhead-actions button:has-text("Pausar")');
  await espera(2000);
  await p.screenshot({ path: 'telas/09b-computador-pausa-registrada.png' });
  comandos = (await lerColecao('comandos')).filter(DO_PAINEL);
  registrar({
    passo: '4c pausar a fabrica que esta rodando',
    documento: comandos.map(comando).find((c) => c.acao === 'pausar')
  });
  await p.click('button[aria-label="Voltar"]');
  await espera(800);
}

/* --- 3. as tres respostas, uma por pedido, lidas logo depois --- */
await p.click('.gf-side-item:has-text("Aprovações")');
await p.waitForSelector('.gf-deck');
await espera(1200);
await p.screenshot({ path: 'telas/10-computador-aprovacoes-pacote-com-origem.png' });

/* a marcacao de origem que a OST 2 aprovou, lida da propria tela */
const marcacaoNaTela = await p.evaluate(() =>
  [...document.querySelectorAll('.gf-deck .gf-origem')].map((e) => e.textContent.replace(/\s+/g, ' ').trim())
);

/* 3a. aprovar com observacao, que e obrigatoria */
const idDoPrimeiro = await p.evaluate(() => {
  const campo = document.querySelector('.gf-ap-reason textarea');
  return campo ? campo.id : null;
});
await p.click('.gf-deck button:has-text("Aprovar com observação")');
await p.waitForSelector('.gf-ap-reason textarea');
await p.screenshot({ path: 'telas/11-computador-observacao-obrigatoria.png' });
const travadoSemObservacao = await p
  .locator('.gf-ap-reason button:has-text("Aprovar com observação")')
  .isDisabled();
const alvoDaObservacao = (await p.getAttribute('.gf-ap-reason textarea', 'id'))?.replace('motivo-', '');
await p.fill('.gf-ap-reason textarea', 'Pode seguir, mas rode a migração de volta se algo falhar.');
await p.click('.gf-ap-reason button:has-text("Aprovar com observação")');
await espera(2200);
await p.screenshot({ path: 'telas/12-computador-aprovado-com-observacao.png' });
registrar({
  passo: '3a aprovar com observacao',
  idDoPrimeiro,
  travadoSemObservacao,
  documento: aprovacao(await lerDocumento(`aprovacoes/${alvoDaObservacao}`)),
  marcacaoDeOrigemNaTela: marcacaoNaTela
});

/* 3b. recusar com motivo */
await espera(800);
const alvoDaRecusa = await p.evaluate(() => {
  const botao = [...document.querySelectorAll('.gf-deck button')].find((b) => b.textContent.trim() === 'Recusar');
  if (!botao) return null;
  const item = botao.closest('.gf-ap');
  const campo = item?.querySelector('[id^="motivo-"]');
  return campo ? campo.id.replace('motivo-', '') : 'sem id';
});
await p.click('.gf-deck button:has-text("Recusar")');
await p.waitForSelector('.gf-ap-reason textarea');
const idDaRecusa = (await p.getAttribute('.gf-ap-reason textarea', 'id'))?.replace('motivo-', '');
await p.fill('.gf-ap-reason textarea', 'Não mexa no cache agora, estou usando o build.');
await p.screenshot({ path: 'telas/13-computador-recusa-com-motivo.png' });
await p.click('.gf-ap-reason button:has-text("Confirmar recusa")');
await espera(2200);
await p.screenshot({ path: 'telas/14-computador-recusado.png' });
registrar({
  passo: '3b recusar com motivo',
  alvoDaRecusa,
  documento: aprovacao(await lerDocumento(`aprovacoes/${idDaRecusa}`))
});

/* 3c. aprovar, sem observacao */
await espera(800);
const idDaAprovacao = await p.evaluate(() => {
  const campo = document.querySelector('.gf-deck [id^="motivo-"]');
  return campo ? campo.id.replace('motivo-', '') : null;
});
let alvoDaAprovacao = idDaAprovacao;
if (!alvoDaAprovacao) {
  /* sem campo aberto, o alvo e o pedido que o deck mostra agora: o pendente mais
     antigo que sobrou */
  const pendentes = (await lerColecao('aprovacoes')).filter((d) => texto(d.campos, 'situacao') === 'pendente');
  alvoDaAprovacao = pendentes.map(aprovacao).sort((a, b) => (a.criadoEm < b.criadoEm ? -1 : 1))[0]?.id;
}
await p.locator('.gf-deck button:has-text("Aprovar")').first().click();
await espera(2200);
await p.screenshot({ path: 'telas/15-computador-aprovado-e-historico.png' });
registrar({
  passo: '3c aprovar',
  documento: aprovacao(await lerDocumento(`aprovacoes/${alvoDaAprovacao}`))
});

registrar({
  passo: '3 fila de aprovacoes, como a base ficou',
  documentos: (await lerColecao('aprovacoes')).map(aprovacao)
});

/* --- 6. ponte offline: nada clicavel, e a tela diz por que ---
   Semeia de novo antes, para a fila ter pedido parado: sem pedido a tela mostra
   o estado vazio e nao haveria botao de decisao para conferir desabilitado. */
semear('ponte-viva');
await espera(3000);
semear('ponte-velha');
await espera(20_000); /* o relogio do painel reavalia o heartbeat a cada 15 s */
await p.screenshot({ path: 'telas/16-computador-ponte-offline-aprovacoes.png' });
const offlineAprovacoes = await p.evaluate(() => ({
  pedidosNaFila: document.querySelector('.gf-deck-count')?.textContent?.trim() ?? null,
  botoes: [...document.querySelectorAll('.gf-ap-actions button')].map((b) => ({
    texto: b.textContent.trim(),
    desabilitado: b.disabled
  })),
  motivo: document.querySelector('.gf-ap .gf-motivo')?.textContent?.trim() ?? null,
  faixa: document.querySelector('.gf-banner-text')?.textContent?.trim() ?? null
}));
await p.click('.gf-side-item:has-text("Visão geral")');
await espera(1500);
const offlineAbrir = await p.evaluate(() => {
  const botao = [...document.querySelectorAll('.gf-topbar button')].find((b) =>
    b.textContent.includes('Abrir nova fábrica')
  );
  return {
    desabilitado: botao?.disabled ?? null,
    motivo: botao?.parentElement?.querySelector('.gf-motivo')?.textContent?.trim() ?? null
  };
});
await p.screenshot({ path: 'telas/17-computador-ponte-offline-visao-geral.png' });
await p.click('.gf-fcard >> nth=0');
await espera(1500);
const offlineFabrica = await p.evaluate(() => {
  const caixa = document.querySelector('textarea[aria-label="Comando para esta fábrica"]');
  return {
    acoes: [...document.querySelectorAll('.gf-fhead-actions button')].map((b) => ({
      texto: b.textContent.trim(),
      desabilitado: b.disabled
    })),
    motivoDasAcoes: document.querySelector('.gf-fhead .gf-motivo')?.textContent?.trim() ?? null,
    caixaDesabilitada: caixa?.disabled ?? null,
    motivoDaCaixa: caixa?.placeholder ?? null,
    botaoEnviarDesabilitado: [...document.querySelectorAll('.gf-cmd button')].pop()?.disabled ?? null
  };
});
await p.screenshot({ path: 'telas/18-computador-ponte-offline-fabrica.png' });
registrar({ passo: '6 ponte offline no computador', offlineAprovacoes, offlineAbrir, offlineFabrica });

const comandosNoFim = (await lerColecao('comandos')).filter(DO_PAINEL);
registrar({
  passo: 'tudo o que o painel escreveu em comandos, no computador',
  total: comandosNoFim.length,
  porAcao: comandosNoFim.reduce((c, d) => {
    const a = texto(d.campos, 'acao') ?? 'sem acao';
    c[a] = (c[a] ?? 0) + 1;
    return c;
  }, {}),
  todosPendentes: comandosNoFim.every((d) => texto(d.campos, 'situacao') === 'pendente'),
  todosComHoraDeServidor: comandosNoFim.every((d) => Boolean(hora(d.campos, 'criadoEm'))),
  todosComOrigemLegivel: comandosNoFim.every((d) => (texto(d.campos, 'origem') ?? '').includes(DIRETOR)),
  todosComTexto: comandosNoFim.every((d) => (texto(d.campos, 'texto') ?? '').length > 0)
});

await ctxComputador.close();

/* ============ PARTE 2, CELULAR ============ */

semear('ponte-viva');
const ctxCelular = await navegador.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  locale: 'pt-BR'
});
const c = await ctxCelular.newPage();
await entrar(c);
await c.waitForSelector('.gf-mapp');
await espera(2000);
const medidaAprovacoes = await medir(c);
await c.screenshot({ path: 'telas/19-celular-aprovacoes.png' });

/* responder no celular, com observacao */
await c.click('.gf-ap-actions button:has-text("Com observação")');
await c.waitForSelector('.gf-ap-reason textarea');
const idNoCelular = (await c.getAttribute('.gf-ap-reason textarea', 'id'))?.replace('motivo-', '');
await c.fill('.gf-ap-reason textarea', 'Pode seguir, me avise quando terminar.');
const medidaResposta = await medir(c);
await c.screenshot({ path: 'telas/20-celular-observacao.png' });
await c.click('.gf-ap-reason button:has-text("Aprovar com observação")');
await espera(2200);
await c.screenshot({ path: 'telas/21-celular-respondido.png' });
registrar({
  passo: '5a responder aprovacao no celular',
  documento: aprovacao(await lerDocumento(`aprovacoes/${idNoCelular}`))
});

await c.click('.gf-mnav-item:has-text("Fábricas")');
await espera(1500);
const medidaFabricas = await medir(c);
await c.screenshot({ path: 'telas/22-celular-fabricas.png' });

/* nova fabrica no celular */
await c.click('button[aria-label="Abrir nova fábrica"]');
await c.waitForSelector('textarea[aria-label="Comando inicial da fábrica"]');
await c.click('.gf-li >> nth=0');
await c.fill(
  'textarea[aria-label="Comando inicial da fábrica"]',
  'Suba o relatório do dia e me avise quando terminar.'
);
const medidaNova = await medir(c);
await c.screenshot({ path: 'telas/23-celular-nova-fabrica.png' });
await c.click('button:has-text("Abrir fábrica")');
await espera(2200);
await c.screenshot({ path: 'telas/24-celular-abertura-registrada.png' });
registrar({
  passo: '5b abrir fabrica pelo celular',
  documento: (await lerColecao('comandos'))
    .filter((d) => (texto(d.campos, 'origem') ?? '').startsWith('painel no celular'))
    .map(comando)
    .find((x) => x.acao === 'abrir')
});

/* caixa de comando e folha de acoes no celular */
await c.click('.gf-mrow >> nth=0');
await espera(2000);
const medidaFabrica = await medir(c);
await c.screenshot({ path: 'telas/25-celular-fabrica.png' });
await c.fill(
  'textarea[aria-label="Comando para esta fábrica"]',
  'Pare no próximo passo e me explique o que achou.'
);
await c.click('.gf-cmd button:has-text("Enviar")');
await espera(2200);
await c.screenshot({ path: 'telas/26-celular-comando-registrado.png' });
registrar({
  passo: '5c mandar comando pelo celular',
  documento: (await lerColecao('comandos'))
    .filter((d) => (texto(d.campos, 'origem') ?? '').startsWith('painel no celular'))
    .map(comando)
    .find((x) => x.acao === 'comando')
});

await c.click('button:has-text("Pausar, reiniciar ou encerrar")');
await c.waitForSelector('[role="dialog"]');
const medidaFolha = await medir(c);
await c.screenshot({ path: 'telas/27-celular-folha-de-acoes.png' });
await c.click('[role="dialog"] button:has-text("Encerrar")');
await espera(900);
const medidaConfirmacao = await medir(c);
await c.screenshot({ path: 'telas/28-celular-confirmacao-de-encerrar.png' });
const antesDoCancelarCelular = (await lerColecao('comandos')).length;
await c.click('[role="dialog"] button:has-text("Deixar rodando")');
await espera(1500);
const depoisDoCancelarCelular = (await lerColecao('comandos')).length;
await c.screenshot({ path: 'telas/29-celular-depois-de-cancelar.png' });

/* ponte offline no celular */
semear('ponte-velha');
await espera(20_000);
await c.screenshot({ path: 'telas/30-celular-ponte-offline-fabrica.png' });
const offlineCelular = await c.evaluate(() => {
  const caixa = document.querySelector('textarea[aria-label="Comando para esta fábrica"]');
  const botao = [...document.querySelectorAll('button')].find((b) =>
    b.textContent.includes('Pausar, reiniciar ou encerrar')
  );
  return {
    faixa: document.querySelector('.gf-banner-text')?.textContent?.trim() ?? null,
    caixaDesabilitada: caixa?.disabled ?? null,
    motivoDaCaixa: caixa?.placeholder ?? null,
    acoesDesabilitadas: botao?.disabled ?? null,
    motivoDasAcoes: document.querySelector('.gf-motivo')?.textContent?.trim() ?? null
  };
});
await c.click('button[aria-label="Voltar"]');
await espera(1500);
const offlineAbrirCelular = await c.evaluate(() => {
  const botao = document.querySelector('button[aria-label="Abrir nova fábrica"]');
  return { desabilitado: botao?.disabled ?? null };
});
await c.screenshot({ path: 'telas/31-celular-ponte-offline-fabricas.png' });

registrar({
  passo: '5 celular, alvo de toque e rolagem da pagina',
  aprovacoes: medidaAprovacoes,
  respostaComObservacao: medidaResposta,
  fabricas: medidaFabricas,
  novaFabrica: medidaNova,
  fabrica: medidaFabrica,
  folhaDeAcoes: medidaFolha,
  confirmacao: medidaConfirmacao
});
registrar({
  passo: '4d celular, cancelar o encerramento nao escreve nada',
  comandosAntes: antesDoCancelarCelular,
  comandosDepois: depoisDoCancelarCelular,
  escreveu: antesDoCancelarCelular !== depoisDoCancelarCelular
});
registrar({ passo: '6 ponte offline no celular', offlineCelular, offlineAbrirCelular });

const tudo = (await lerColecao('comandos')).filter(DO_PAINEL);
registrar({
  passo: 'tudo o que o painel escreveu em comandos, no fim da prova',
  total: tudo.length,
  porAcao: tudo.reduce((c, d) => {
    const a = texto(d.campos, 'acao') ?? 'sem acao';
    c[a] = (c[a] ?? 0) + 1;
    return c;
  }, {}),
  porOrigem: tudo.reduce((c, d) => {
    const o = texto(d.campos, 'origem') ?? 'sem origem';
    c[o] = (c[o] ?? 0) + 1;
    return c;
  }, {})
});

await ctxCelular.close();
await navegador.close();

writeFileSync('medidas.json', JSON.stringify(trilha, null, 2), 'utf8');
console.log('\nPROVA CONCLUIDA. Prints em telas/, medidas em medidas.json.');
