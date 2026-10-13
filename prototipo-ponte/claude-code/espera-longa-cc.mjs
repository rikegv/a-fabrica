#!/usr/bin/env node
// PROVA 5: pedido parado por mais de cinco minutos e a sessao sobrevive.
import { query } from '@anthropic-ai/claude-agent-sdk';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
const HOME = homedir();
const PROJ = join(HOME, 'a-fabrica-lab', 'projeto-cc');
const fila = join(HOME, 'a-fabrica-lab', 'rodadas', `${new Date().toISOString().replace(/[:.]/g, '').slice(0, 15)}-cc-p5-espera-longa`);
mkdirSync(fila, { recursive: true });
const alvo = join(fila, 'EXECUTOU.txt');
const envLimpo = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^CLAUDE/i.test(k) && k !== 'CLAUDECODE' && k !== 'AI_AGENT'));
const ESPERA_MS = 320000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let pedidoEm = null;
const canUseTool = async () => {
  pedidoEm = Date.now();
  console.log('portao: pedido de risco chegou, segurando ate a resposta do diretor...');
  await sleep(ESPERA_MS); // o diretor demora mais de 5 min
  console.log('portao: resposta chegou apos', Math.round((Date.now() - pedidoEm) / 1000), 's, liberando');
  return { behavior: 'allow' };
};
const t0 = Date.now();
for await (const _ of query({
  prompt: `Usando a ferramenta de escrita, crie o arquivo ${alvo} com o conteudo ok.`,
  options: { cwd: PROJ, model: 'claude-haiku-4-5-20251001', permissionMode: 'default', settingSources: [], env: envLimpo, canUseTool, maxTurns: 3 },
})) {}
const total = Math.round((Date.now() - t0) / 1000);
console.log(`prova 5: ${existsSync(alvo) ? 'EXECUTOU apos espera longa, sessao sobreviveu' : 'NAO executou'} (total ${total}s, espera ${Math.round(ESPERA_MS/1000)}s)`);
