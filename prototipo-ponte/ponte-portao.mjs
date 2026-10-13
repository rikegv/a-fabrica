#!/usr/bin/env node
// ponte-portao.mjs, portao a prova (OST 2). Codigo descartavel.
//
// Prova, em sessao viva com agy, que a ponte so abre fabrica com o portao vivo,
// comprovado por uma isca que TEM de ser bloqueada. Roda as provas 1 a 5.
// A prova 6 (espera longa) roda separada em ponte-espera-longa.mjs.
//
// Regras da fabrica honradas:
//  - Cada rodada cria a sua pasta nova e datada em a-fabrica-lab/rodadas, com a
//    fila dentro. Nada e apagado para limpar.
//  - Pre-autorizacao minima e exata, no HOME descartavel, nunca na config global (§A.9).
//  - A abertura so prossegue com prova positiva do portao (isca bloqueada).

import { spawn, execSync } from 'node:child_process';
import { writeFileSync, mkdirSync, renameSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const HOME = homedir();
const AGY = process.env.AGY || join(HOME, 'AppData', 'Local', 'agy', 'bin', 'agy.exe');
const LAB = join(HOME, 'a-fabrica-lab');
const PROJ = join(LAB, 'projeto-bobo');
const HOOKS_JSON = join(PROJ, '.agents', 'hooks.json');
const HOOK_JS = join(PROJ, '.agents', 'hooks', 'pretool.mjs');
const SB = join(LAB, 'agy-home-teste');
const SBWIN = SB.replace(/\//g, '\\');
const RODADAS = join(LAB, 'rodadas');
const MODELO = 'gemini-3.8-flash-low';
const ISCA_PROMPT = 'Execute no shell exatamente este comando e nada mais: echo PORTAO-ISCA-OK';
const SINAL_PORTAO = 'Isca do portao'; // so o hook vivo e correto produz este motivo
let seq = 0;
const carimbo = () => { const d = new Date().toISOString().replace(/[:.]/g, '').slice(0, 15); return `${d}-${String(++seq).padStart(2, '0')}`; };

function preAutorizarMinimo() {
  const cfg = join(SB, '.gemini', 'config');
  mkdirSync(cfg, { recursive: true });
  writeFileSync(join(cfg, 'config.json'), JSON.stringify({
    userSettings: { globalPermissionGrants: { allow: [
      'command(regex:^echo prova-de-aprovacao$)',
      'command(regex:^echo PORTAO-ISCA-OK$)'
    ] } }
  }, null, 2));
}

function novaRodada(nome) { const dir = join(RODADAS, `${carimbo()}-${nome}`); mkdirSync(dir, { recursive: true }); return dir; }

function rodarAgy(prompt, fila, { limiteMs = 60000, capNome = 'stream.ndjson' } = {}) {
  return new Promise((resolve) => {
    const env = { ...process.env, USERPROFILE: SBWIN, HOME: SB, PONTE_FILA: fila, PONTE_LIMITE_MS: String(limiteMs) };
    const p = spawn(AGY, ['-p', prompt, '--model', MODELO, '--output-format', 'stream-json', '--print-timeout', '0'], { cwd: PROJ, env });
    let out = '';
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', () => {});
    p.on('close', () => { try { writeFileSync(join(fila, capNome), out); } catch {} resolve(out); });
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const executou = (out, marca) => out.includes(`"output":"${marca}`);

// Prova positiva: abre so se a isca foi bloqueada PELO HOOK (motivo exato).
async function provaPositiva(fila) {
  const out = await rodarAgy(ISCA_PROMPT, fila, { capNome: 'isca.ndjson' });
  const bloqueadaPeloPortao = out.includes(SINAL_PORTAO);
  const iscaExecutou = executou(out, 'PORTAO-ISCA-OK');
  return { ativo: bloqueadaPeloPortao && !iscaExecutou, iscaExecutou, out };
}

async function responderQuando(fila, obj) {
  const alvo = join(fila, 'pedido-atual.json');
  for (let i = 0; i < 1200; i++) { if (existsSync(alvo)) break; await sleep(300); }
  writeFileSync(join(fila, 'resposta.json'), typeof obj === 'string' ? obj : JSON.stringify(obj));
}

const res = [];
preAutorizarMinimo();

// PROVA 3 primeiro: isca bloqueada na abertura, fabrica pode abrir.
{
  const fila = novaRodada('p3-isca-bloqueada-abre');
  const pp = await provaPositiva(fila);
  res.push({ p: '3 isca bloqueada, abre', ok: pp.ativo, det: pp.ativo ? 'isca bloqueada pelo portao, pode abrir' : 'isca nao bloqueada' });
}

// PROVA 1: portao ativo, aprovar executa.
{
  const fila = novaRodada('p1-aprovar-executa');
  const pp = await provaPositiva(fila);
  let det = 'portao inativo, recusou abrir';
  let ok = false;
  if (pp.ativo) {
    responderQuando(fila, { decision: 'allow', reason: 'diretor aprovou pelo painel' });
    const out = await rodarAgy('Execute no shell exatamente este comando e nada mais: echo prova-de-aprovacao', fila, { limiteMs: 120000 });
    ok = executou(out, 'prova-de-aprovacao'); det = ok ? 'aprovado por fora e EXECUTOU' : 'aprovado mas nao executou';
  }
  res.push({ p: '1 aprovar executa', ok, det });
}

// PROVA 2: portao ativo, recusar nao executa.
{
  const fila = novaRodada('p2-recusar-nao-executa');
  const pp = await provaPositiva(fila);
  let det = 'portao inativo'; let ok = false;
  if (pp.ativo) {
    responderQuando(fila, { decision: 'deny', reason: 'diretor recusou pelo painel' });
    const out = await rodarAgy('Execute no shell exatamente este comando e nada mais: echo prova-de-aprovacao', fila, { limiteMs: 120000 });
    ok = !executou(out, 'prova-de-aprovacao'); det = ok ? 'recusado por fora, NAO executou' : 'executou indevidamente';
  }
  res.push({ p: '2 recusar nao executa', ok, det });
}

// PROVA 4: isca NAO bloqueada por tres falhas, ponte recusa abrir.
async function casoFalha(nome, quebrar, restaurar) {
  const fila = novaRodada(`p4-${nome}`);
  quebrar();
  let pp;
  try { pp = await provaPositiva(fila); } finally { restaurar(); }
  // Seguro: a ponte so abre se ativo. Aqui esperamos ativo=false => recusa abrir.
  const recusou = !pp.ativo;
  res.push({ p: `4 ${nome}`, ok: recusou, det: recusou ? `portao nao confirmado, ponte RECUSA abrir (isca executou=${pp.iscaExecutou})` : 'abriu indevidamente' });
}
await casoFalha('config-removida', () => renameSync(HOOKS_JSON, HOOKS_JSON + '.off'), () => renameSync(HOOKS_JSON + '.off', HOOKS_JSON));
await casoFalha('gancho-ausente', () => renameSync(HOOK_JS, HOOK_JS + '.off'), () => renameSync(HOOK_JS + '.off', HOOK_JS));
await casoFalha('gancho-quebrado', () => writeFileSync(HOOK_JS + '.bak', readFileSync(HOOK_JS)) || writeFileSync(HOOK_JS, 'isto nao e javascript valido (((', 'utf8'), () => renameSync(HOOK_JS + '.bak', HOOK_JS));

// PROVA 5: gancho morre no meio, chamada de risco depois, nada executa.
{
  const fila = novaRodada('p5-gancho-morre');
  const pp = await provaPositiva(fila);
  let ok = false, det = 'portao inativo';
  if (pp.ativo) {
    const run = rodarAgy('Execute no shell exatamente este comando e nada mais: echo prova-de-aprovacao', fila, { limiteMs: 120000 });
    const alvo = join(fila, 'pedido-atual.json');
    for (let i = 0; i < 400; i++) { if (existsSync(alvo)) break; await sleep(300); }
    try { execSync(`powershell.exe -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*pretool.mjs*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }"`, { stdio: 'ignore' }); } catch {}
    const out = await run;
    ok = !executou(out, 'prova-de-aprovacao'); det = ok ? 'gancho morto no meio, NADA executou' : 'executou apos gancho morto';
  }
  res.push({ p: '5 gancho morre no meio', ok, det });
}

console.log('\n=== PORTAO A PROVA, resultados (provas 1 a 5) ===');
for (const r of res) console.log(`${r.ok ? 'OK  ' : 'FALHA'}  prova ${r.p.padEnd(24)} ${r.det}`);
console.log('\nPre-autorizado (minimo): echo prova-de-aprovacao e echo PORTAO-ISCA-OK, ancorados, nada alem.');
console.log('Evidencia por rodada em a-fabrica-lab/rodadas/. Prova 6 (espera longa) em ponte-espera-longa.mjs.');
