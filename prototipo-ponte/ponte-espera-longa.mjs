#!/usr/bin/env node
// ponte-espera-longa.mjs, prova 6: a sessao sobrevive a espera acima de 5 min.
// Rodada propria e datada, fila dentro. Nada apagado.
import { spawn } from 'node:child_process';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const HOME = homedir();
const AGY = join(HOME, 'AppData', 'Local', 'agy', 'bin', 'agy.exe');
const PROJ = join(HOME, 'a-fabrica-lab', 'projeto-bobo');
const SB = join(HOME, 'a-fabrica-lab', 'agy-home-teste');
const SBWIN = SB.replace(/\//g, '\\');
const fila = join(HOME, 'a-fabrica-lab', 'rodadas', `${new Date().toISOString().replace(/[:.]/g, '').slice(0, 15)}-p6-espera-longa`);
mkdirSync(fila, { recursive: true });
const ESPERA_MS = 320000; // 5 min e 20 s
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function rodar(prompt, cap, limiteMs) {
  return new Promise((resolve) => {
    const env = { ...process.env, USERPROFILE: SBWIN, HOME: SB, PONTE_FILA: fila, PONTE_LIMITE_MS: String(limiteMs) };
    const p = spawn(AGY, ['-p', prompt, '--model', 'gemini-3.8-flash-low', '--output-format', 'stream-json', '--print-timeout', '0'], { cwd: PROJ, env });
    let out = ''; p.stdout.on('data', (d) => { out += d; }); p.on('close', () => { try { writeFileSync(join(fila, cap), out); } catch {} resolve(out); });
  });
}

// prova positiva
const isca = await rodar('Execute no shell exatamente este comando e nada mais: echo PORTAO-ISCA-OK', 'isca.ndjson', 60000);
if (!isca.includes('Isca do portao')) { console.log('portao nao confirmado, abortando prova 6'); process.exit(1); }
console.log('portao confirmado. abrindo sessao e deixando o diretor demorar', ESPERA_MS / 1000, 's');

const t0 = Date.now();
(async () => {
  const alvo = join(fila, 'pedido-atual.json');
  for (let i = 0; i < 2000; i++) { if (existsSync(alvo)) break; await sleep(300); }
  const visto = Date.now();
  await sleep(ESPERA_MS);
  writeFileSync(join(fila, 'resposta.json'), JSON.stringify({ decision: 'allow', reason: 'diretor aprovou pelo celular depois de pensar' }));
  console.log('aprovacao escrita apos', Math.round((Date.now() - visto) / 1000), 's de espera real');
})();

const out = await rodar('Execute no shell exatamente este comando e nada mais: echo prova-de-aprovacao', 'stream.ndjson', 600000);
const total = Math.round((Date.now() - t0) / 1000);
const exec = out.includes('"output":"prova-de-aprovacao');
console.log(`\nprova 6: ${exec ? 'EXECUTOU apos espera longa, sessao sobreviveu' : 'NAO executou'} (total ${total}s)`);
const dur = out.match(/"duration_seconds":([0-9.]+)/g);
if (dur) console.log('duracoes no stream:', dur.slice(-2).join(' '));
