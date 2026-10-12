#!/usr/bin/env node
// ponte-inversao.mjs, spike da aprovacao invertida (OST 1, Parte 2, tarefa 2)
//
// Codigo descartavel. Prova a inversao: o agy fica pre-autorizado para nao
// travar sozinho, e o hook PreToolUse vira o PORTAO que segura toda chamada
// de risco e so libera com a resposta do diretor, vinda de fora.
//
// §A.9: a pre-autorizacao NAO entra na config global. Ela vive num HOME
// descartavel (a-fabrica-lab/agy-home-teste), usado so no teste. A autenticacao
// do agy sobrevive porque fica no gerenciador de credenciais do Windows.
// O hook vive na pasta de teste. Nada do Antigravity real e tocado.
//
// Uso: node ponte-inversao.mjs

import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, unlinkSync, mkdirSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const HOME = homedir();
const AGY = process.env.AGY || join(HOME, 'AppData', 'Local', 'agy', 'bin', 'agy.exe');
const LAB = join(HOME, 'a-fabrica-lab', 'projeto-bobo');
const FILA = join(HOME, 'a-fabrica-lab', 'ponte-fila');
const SB = join(HOME, 'a-fabrica-lab', 'agy-home-teste');
const SBWIN = SB.replace(/\//g, '\\');
const MODELO = 'gemini-3.8-flash-low';
const PROMPT = 'Execute no shell exatamente este comando e nada mais: echo prova-de-aprovacao';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Pre-autorizacao no config DESCARTAVEL (regex, mecanismo que funciona em headless).
function preAutorizar() {
  const cfg = join(SB, '.gemini', 'config');
  mkdirSync(cfg, { recursive: true });
  writeFileSync(join(cfg, 'config.json'), JSON.stringify({
    userSettings: { globalPermissionGrants: { allow: ['command(regex:echo.*)'] } }
  }, null, 2));
}

function rodarAgy(limiteMs, capturar) {
  return new Promise((resolve) => {
    const env = { ...process.env, USERPROFILE: SBWIN, HOME: SB, PONTE_LIMITE_MS: String(limiteMs) };
    const p = spawn(AGY, ['-p', PROMPT, '--model', MODELO, '--output-format', 'stream-json', '--print-timeout', '0'], { cwd: LAB, env });
    let out = '';
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', () => {});
    p.on('close', () => resolve(out));
  });
}
const executou = (out) => out.includes('"output":"prova-de-aprovacao');
const motivo = (out) => { const m = out.match(/denied by pre-tool hook: ([^"]*)/); return m ? m[1] : (executou(out) ? 'executou' : 'bloqueado'); };

async function limparFila() { mkdirSync(FILA, { recursive: true }); for (const f of ['pedido-atual.json', 'resposta.json', 'hook.log']) { try { unlinkSync(join(FILA, f)); } catch {} } }
async function esperarPedido() { for (let i = 0; i < 400; i++) { if (existsSync(join(FILA, 'pedido-atual.json'))) return true; await sleep(300); } return false; }
function responder(obj) { writeFileSync(join(FILA, 'resposta.json'), typeof obj === 'string' ? obj : JSON.stringify(obj)); }

async function caso(nome, limiteMs, acaoAposPedido) {
  await limparFila();
  const run = rodarAgy(limiteMs);
  esperarPedido().then((ok) => { if (ok && acaoAposPedido) acaoAposPedido(); });
  const out = await run;
  return { nome, executou: executou(out), motivo: motivo(out) };
}

const res = [];
preAutorizar();

// 1. Aprovar por fora, deve EXECUTAR.
res.push(await caso('aprovar', 300000, () => responder({ decision: 'allow', reason: 'diretor aprovou' })));
// 2. Recusar por fora, NAO executa.
res.push(await caso('recusar', 300000, () => responder({ decision: 'deny', reason: 'diretor recusou' })));
// 3a. Sem resposta, timeout curto, NAO executa.
res.push(await caso('falha-sem-resposta', 5000, null));
// 3b. Resposta malformada, NAO executa.
res.push(await caso('falha-malformada', 300000, () => responder('nao-e-json{{{')));
// 3d. Hook ausente com pre-grant: furo conhecido, EXECUTA sem o diretor.
{
  const hj = join(LAB, '.agents', 'hooks.json');
  renameSync(hj, hj + '.off');
  await limparFila();
  const out = await rodarAgy(5000);
  renameSync(hj + '.off', hj);
  res.push({ nome: 'hook-ausente(furo)', executou: executou(out), motivo: executou(out) ? 'EXECUTOU sem o diretor' : 'bloqueado' });
}

console.log('\n=== INVERSAO DA APROVACAO, resultados ===');
for (const r of res) console.log(`${r.executou ? 'EXECUTOU ' : 'bloqueado'}  ${r.nome.padEnd(22)} ${r.motivo}`);
console.log('\nEsperado: aprovar EXECUTA; recusar/timeout/malformada bloqueiam; hook-ausente EXECUTA (furo do pre-grant).');
console.log('Detalhe, evidencia e parecer de seguranca em docs/prova-ponte.md.');
