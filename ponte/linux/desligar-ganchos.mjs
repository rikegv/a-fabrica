// desligar-ganchos.mjs, tira do ~/.claude/settings.json SO o que a Fabrica pos. OST 14.
//
// Equivalente de ponte/ganchos/desligar.ps1. Roda como o diretor. Copia de
// seguranca antes, troca atomica depois, e nenhum gancho que nao seja o da
// Fabrica e tocado. Evento que fica vazio depois de tirar o nosso sai junto.

import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync, statSync, chmodSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const MARCA = 'a-fabrica-gancho';
const settings = join(homedir(), '.claude', 'settings.json');
if (!existsSync(settings)) {
  console.log(`Nao existe ${settings}, nada a desligar.`);
  process.exit(0);
}
const selo = new Date().toISOString().replace(/[:.]/g, '-');
const pastaCopias = join(homedir(), '.a-fabrica-ponte-copias');
mkdirSync(pastaCopias, { recursive: true, mode: 0o700 });
const copia = join(pastaCopias, `settings-antes-de-desligar-${selo}.json`);
copyFileSync(settings, copia);
chmodSync(copia, 0o600);
console.log(`   copia de seguranca: ${copia}`);
const json = JSON.parse(readFileSync(settings, 'utf8'));
let tirados = 0;
if (json && typeof json.hooks === 'object' && json.hooks !== null) {
  for (const evento of Object.keys(json.hooks)) {
    const grupos = Array.isArray(json.hooks[evento]) ? json.hooks[evento] : null;
    if (grupos === null) continue;
    const ficam = [];
    for (const g of grupos) {
      if (!Array.isArray(g?.hooks)) {
        ficam.push(g);
        continue;
      }
      const hooks = g.hooks.filter((h) => !(typeof h?.command === 'string' && h.command.includes(MARCA)));
      tirados += g.hooks.length - hooks.length;
      if (hooks.length > 0) ficam.push({ ...g, hooks });
    }
    if (ficam.length > 0) json.hooks[evento] = ficam;
    else delete json.hooks[evento];
  }
  if (Object.keys(json.hooks).length === 0) delete json.hooks;
}
const modo = statSync(settings).mode & 0o777;
const temporario = `${settings}.novo-${process.pid}`;
writeFileSync(temporario, JSON.stringify(json, null, 2) + '\n', { encoding: 'utf8', mode: modo });
JSON.parse(readFileSync(temporario, 'utf8'));
renameSync(temporario, settings);
console.log(`   settings.json: ${tirados} entrada(s) da Fabrica tirada(s), o resto ficou como estava`);
