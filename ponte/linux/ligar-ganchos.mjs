// ligar-ganchos.mjs, liga os ganchos de ciclo de vida do Claude Code no Linux. OST 14.
//
// Equivalente de ponte/ganchos/ligar.ps1, em Node, como o estudo pediu (secao
// 4.1): ler e escrever JSON de forma segura, sem depender de bash nem PowerShell.
// Roda COMO O DIRETOR, porque mexe no ~/.claude/settings.json dele. Quem chama e o
// instalador, com sudo -u.
//
// §A.9, so acrescentar:
//   copia de seguranca com data e hora antes de tocar;
//   nao duplica a entrada se ja esta la; mantem todo gancho que ja exista;
//   grava em arquivo temporario, confere que e JSON valido, e so entao troca;
//   sem ~/.claude/settings.json, PARA e pede para abrir o Claude Code uma vez.
// Ressalva declarada: reler e regravar mantem o conteudo, mas a formatacao do
// arquivo (espacos, quebras) pode mudar.
//
// Uso: node ligar-ganchos.mjs <caminho do node> <caminho do gancho>

import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync, statSync, chmodSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const [node, gancho] = process.argv.slice(2);
if (!node || !gancho) {
  console.error('uso: node ligar-ganchos.mjs <caminho do node> <caminho do gancho>');
  process.exit(64);
}
const EVENTOS = ['SessionStart', 'UserPromptSubmit', 'PostToolUse', 'SubagentStart', 'SubagentStop', 'Stop', 'SessionEnd', 'Notification'];
// A mesma marca do Windows: e por ela que o desligar acha so o que a Fabrica pos.
const MARCA = 'a-fabrica-gancho';
if (!gancho.includes(MARCA)) {
  console.error(`o caminho do gancho tem de conter ${MARCA}, para o desligar achar a entrada depois`);
  process.exit(64);
}

const settings = join(homedir(), '.claude', 'settings.json');
if (!existsSync(settings)) {
  console.error(`Nao achei ${settings}. Abra o Claude Code uma vez como este usuario e rode de novo.`);
  process.exit(2);
}
const selo = new Date().toISOString().replace(/[:.]/g, '-');
const pastaCopias = join(homedir(), '.a-fabrica-ponte-copias');
mkdirSync(pastaCopias, { recursive: true, mode: 0o700 });
const copia = join(pastaCopias, `settings-${selo}.json`);
copyFileSync(settings, copia);
chmodSync(copia, 0o600);
console.log(`   copia de seguranca: ${copia}`);

const json = JSON.parse(readFileSync(settings, 'utf8'));
if (typeof json !== 'object' || json === null || Array.isArray(json)) {
  console.error('o settings.json nao descreve um objeto, nada foi mexido');
  process.exit(3);
}
if (typeof json.hooks !== 'object' || json.hooks === null) json.hooks = {};
let acrescentados = 0;
let jaTinha = 0;
for (const evento of EVENTOS) {
  const existentes = Array.isArray(json.hooks[evento]) ? json.hooks[evento] : [];
  const nossa = existentes.some((g) => Array.isArray(g?.hooks) && g.hooks.some((h) => typeof h?.command === 'string' && h.command.includes(MARCA)));
  if (nossa) {
    jaTinha++;
    continue;
  }
  json.hooks[evento] = [...existentes, { hooks: [{ type: 'command', command: `"${node}" "${gancho}" ${evento}`, timeout: 5 }] }];
  acrescentados++;
}
const modo = statSync(settings).mode & 0o777;
const temporario = `${settings}.novo-${process.pid}`;
writeFileSync(temporario, JSON.stringify(json, null, 2) + '\n', { encoding: 'utf8', mode: modo });
JSON.parse(readFileSync(temporario, 'utf8'));
renameSync(temporario, settings);
console.log(`   settings.json: ${acrescentados} evento(s) acrescentado(s), ${jaTinha} ja estava(m) ligado(s)`);
