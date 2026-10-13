/*
 * Item 1 da OST 6 parte 2: o painel publicado le a configuracao da hospedagem de
 * verdade, e o pacote publicado nao leva chave dentro.
 *
 * So leitura. Nenhuma escrita na nuvem, nenhum comando de publicacao.
 *
 * Tudo que for chave aparece mascarado na evidencia: a chave do cliente web e
 * publica por natureza, mas pasta de rodada versionada nao carrega valor de
 * credencial, §A.6.
 *
 * Uso: node 01-configuracao-da-hospedagem.mjs
 */

import { writeFileSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const SITE = 'https://a-fabrica-soulan.web.app';
const OUT = join(AQUI, '..', '..', '..', 'out');

const linhas = [];
const diga = (t = '') => {
  linhas.push(t);
  console.log(t);
};

function mascarar(texto) {
  return String(texto)
    .replace(/AIzaSy[\w-]+/g, 'AIzaSy<mascarado>')
    .replace(/1:(\d+):web:[0-9a-f]+/g, '1:<remetente>:web:<mascarado>');
}

diga('ITEM 1, A CONFIGURACAO VEM DA HOSPEDAGEM E O PACOTE NAO LEVA CHAVE');
diga('endereco: ' + SITE);
diga('hora: ' + new Date().toISOString());
diga();

/* ---------- 1.a o endereco reservado da hospedagem responde ---------- */
diga('--- 1.a GET ' + SITE + '/__/firebase/init.json ---');
const r1 = await fetch(SITE + '/__/firebase/init.json', { cache: 'no-store' });
diga('HTTP ' + r1.status + ' ' + r1.statusText);
for (const [k, v] of r1.headers.entries()) {
  if (['content-type', 'cache-control', 'server', 'strict-transport-security'].includes(k)) {
    diga('  ' + k + ': ' + v);
  }
}
const bruto = await r1.text();
const cfg = JSON.parse(bruto);
diga('corpo, com chave e id do app mascarados:');
diga(mascarar(JSON.stringify(cfg, null, 2)));
diga();
diga('campos que o painel exige em lerConfiguracao (apiKey, authDomain, projectId, appId):');
for (const campo of ['apiKey', 'authDomain', 'projectId', 'appId']) {
  const v = cfg[campo];
  diga(`  ${campo}: ${v ? 'presente' : 'AUSENTE'}` + (campo === 'projectId' || campo === 'authDomain' ? ` (${v})` : ''));
}
const completo = Boolean(cfg.apiKey && cfg.authDomain && cfg.projectId && cfg.appId);
diga('  veredito: ' + (completo ? 'a hospedagem entrega configuracao completa, lerConfiguracao devolve origem "hospedagem"' : 'FALHA, configuracao incompleta'));
diga();

/* ---------- 1.b o que esta servido na raiz ---------- */
diga('--- 1.b GET ' + SITE + '/ ---');
const r2 = await fetch(SITE + '/', { cache: 'no-store' });
const html = await r2.text();
diga('HTTP ' + r2.status + ', content-type: ' + r2.headers.get('content-type') + ', bytes: ' + html.length);
diga('contem "Entrar com o Google": ' + /Entrar com o Google/.test(html));
diga('contem AIzaSy: ' + /AIzaSy/.test(html));
diga();

/* ---------- 1.c todo pedaco de JavaScript servido, varrido ---------- */
const caminhos = [...new Set([...html.matchAll(/\/_next\/[\w./-]+?\.(?:js|css)/g)].map((m) => m[0]))];
diga('--- 1.c varredura de todo arquivo de /_next que a pagina carrega ---');
diga('arquivos citados no HTML: ' + caminhos.length);

let bytes = 0;
let achouChave = 0;
let achouInitJson = 0;
let achouEmulador = 0;
const comInitJson = [];
const comChave = [];
const padroesDeChave = [
  ['AIzaSy', /AIzaSy/],
  ['a-fabrica-soulan.firebaseapp.com embutido', /a-fabrica-soulan\.firebaseapp\.com/],
  ['id do app embutido', /1:\d+:web:[0-9a-f]+/],
  ['remetente de mensagens embutido', /352717030070/]
];
const achadosPorPadrao = Object.fromEntries(padroesDeChave.map(([nome]) => [nome, []]));

for (const c of caminhos) {
  const r = await fetch(SITE + c, { cache: 'no-store' });
  const texto = await r.text();
  bytes += texto.length;
  if (/__\/firebase\/init\.json/.test(texto)) {
    achouInitJson += 1;
    comInitJson.push(c);
  }
  if (/AIzaSy/.test(texto)) {
    achouChave += 1;
    comChave.push(c);
  }
  if (/127\.0\.0\.1:9099|127\.0\.0\.1:8080|connectAuthEmulator\(/.test(texto) && /NEXT_PUBLIC_EMULADOR/.test(texto)) {
    achouEmulador += 1;
  }
  for (const [nome, re] of padroesDeChave) {
    if (re.test(texto)) achadosPorPadrao[nome].push(c);
  }
}

diga('bytes de JavaScript e CSS baixados e varridos: ' + bytes);
diga('arquivos que contem o endereco /__/firebase/init.json: ' + achouInitJson + (comInitJson.length ? ' -> ' + comInitJson.join(', ') : ''));
diga('arquivos que contem AIzaSy: ' + achouChave + (comChave.length ? ' -> ' + comChave.join(', ') : ''));
diga();
diga('padroes de configuracao embutida, um por um:');
for (const [nome, lista] of Object.entries(achadosPorPadrao)) {
  diga(`  ${nome}: ${lista.length === 0 ? 'ZERO ocorrencias' : 'ACHADO em ' + lista.join(', ')}`);
}
diga();

/* ---------- 1.d a mesma varredura na pasta que foi publicada ---------- */
diga('--- 1.d varredura da pasta publicada no disco, painel/out ---');
function todosOsArquivos(raiz) {
  const fila = [raiz];
  const saida = [];
  while (fila.length) {
    const atual = fila.pop();
    for (const nome of readdirSync(atual)) {
      const caminho = join(atual, nome);
      if (statSync(caminho).isDirectory()) fila.push(caminho);
      else saida.push(caminho);
    }
  }
  return saida;
}
const arquivos = todosOsArquivos(OUT);
diga('arquivos em painel/out: ' + arquivos.length);
const sujos = [];
for (const a of arquivos) {
  let texto;
  try {
    texto = readFileSync(a, 'utf8');
  } catch {
    continue;
  }
  for (const [nome, re] of padroesDeChave) {
    if (re.test(texto)) sujos.push(nome + ' em ' + a.replace(OUT, 'painel/out'));
  }
}
diga(sujos.length === 0 ? 'ZERO ocorrencia de chave, authDomain, id do app ou remetente em painel/out.' : 'ACHADO:\n' + sujos.join('\n'));
diga();

/* ---------- 1.e o emulador nao foi embutido no pacote publicado ---------- */
diga('--- 1.e o pacote publicado nao liga no emulador ---');
diga('arquivos servidos com o emulador ligado por variavel embutida: ' + achouEmulador);
diga('(o codigo le NEXT_PUBLIC_EMULADOR em tempo de construcao; o script de hospedagem constroi com ela em branco)');
diga();

/* ---------- veredito ---------- */
diga('--- VEREDITO DO ITEM 1 ---');
const semChave = achouChave === 0 && sujos.length === 0 && !/AIzaSy/.test(html);
diga('1. a hospedagem serve /__/firebase/init.json completo: ' + (completo ? 'PROVADO' : 'FALHOU'));
diga('2. o JavaScript servido carrega esse endereco: ' + (achouInitJson > 0 ? 'PROVADO' : 'FALHOU'));
diga('3. o pacote publicado nao leva chave nem configuracao embutida: ' + (semChave ? 'PROVADO' : 'FALHOU'));
diga('   logo, servido, lerConfiguracao() nao tem de onde tirar configuracao a nao ser da hospedagem,');
diga('   porque doAmbiente() depende de process.env.NEXT_PUBLIC_* que o Next substitui em tempo de');
diga('   construcao, e nenhum desses valores existe no pacote publicado.');

writeFileSync(join(AQUI, '01-saida.txt'), linhas.join('\n') + '\n', 'utf8');
writeFileSync(join(AQUI, '01-init.json.mascarado.json'), mascarar(JSON.stringify(cfg, null, 2)) + '\n', 'utf8');
console.log('\nevidencia escrita em 01-saida.txt e 01-init.json.mascarado.json');
