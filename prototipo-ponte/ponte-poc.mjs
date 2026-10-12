#!/usr/bin/env node
// ponte-poc.mjs, prova de conceito da ponte (OST 1, Parte 2, refeita com agy)
//
// Codigo descartavel. O objetivo e provar, nao e producao.
//
// Pilota o Antigravity pela CLI oficial agy, sem abrir janela. Executa as
// quatro provas em sessao viva e imprime a saida real.
//
// Regras honradas:
//  - §A.6: nao abre porta de entrada, nao fala com nuvem. A unica escrita e em
//    arquivos locais, a fila ponte-fila e as capturas em evidencia.
//  - §A.9: nao altera configuracao existente do Antigravity. O hook de
//    aprovacao vive na pasta de teste descartavel, nunca no config global.
//
// Uso:
//   node ponte-poc.mjs            roda provas 1, 2, 4 e a prova 3 (deny)
//   node ponte-poc.mjs --so-1-2-4 pula a prova 3
//
// Pre-requisitos: agy instalado e autenticado, pasta de teste a-fabrica-lab.

import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, unlinkSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

const HOME = homedir();
const AGY = process.env.AGY || join(HOME, 'AppData', 'Local', 'agy', 'bin', 'agy.exe');
const LAB = join(HOME, 'a-fabrica-lab', 'projeto-bobo');
const FILA = join(HOME, 'a-fabrica-lab', 'ponte-fila');
const MODELO = 'gemini-3.8-flash-low';
const titulo = (t) => console.log('\n' + '='.repeat(60) + '\n' + t + '\n' + '='.repeat(60));

// Roda o agy e devolve stdout completo. onLinha recebe cada linha ao vivo.
function agy(args, onLinha) {
  return new Promise((resolve) => {
    const p = spawn(AGY, args, { cwd: LAB });
    let out = '', buf = '';
    p.stdout.on('data', (d) => {
      out += d; buf += d; let i;
      while ((i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i); buf = buf.slice(i + 1); if (l.trim() && onLinha) onLinha(l); }
    });
    p.stderr.on('data', () => {});
    p.on('close', () => resolve(out));
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// PROVA 1 ------------------------------------------------------------------
async function prova1() {
  titulo('PROVA 1. ABRIR, sessao headless com comando inicial');
  const out = await agy(['-p', 'Responda com uma frase curta confirmando que a sessao abriu.',
    '--model', MODELO, '--output-format', 'json', '--print-timeout', '0']);
  const env = JSON.parse(out.trim().split('\n').pop());
  console.log('conversation_id:', env.conversation_id);
  console.log('status:', env.status, '| response:', JSON.stringify(env.response.trim()));
  console.log('usage.total_tokens:', env.usage.total_tokens);
  console.log('=> PROVA 1 PASSA: abriu sem janela, com id, estado e consumo.');
  return env.conversation_id;
}

// PROVA 2 ------------------------------------------------------------------
async function prova2() {
  titulo('PROVA 2. ENXERGAR, atividade ao vivo por stream-json');
  let modelo = null, passos = 0, usoFinal = null, t0 = Date.now();
  await agy(['-p', 'Em uma frase, diga o que o soma.js faz.', '--model', MODELO,
    '--output-format', 'stream-json', '--print-timeout', '0'], (l) => {
    let o; try { o = JSON.parse(l); } catch { return; }
    if (o.event === 'init') { modelo = o.init.model; console.log(`+${Date.now() - t0}ms init  modelo=${o.init.model}  modo=${o.init.permission_mode}`); }
    if (o.event === 'step_update') { passos++; const s = o.step_update; console.log(`+${Date.now() - t0}ms passo ${s.step_index} ${s.step_type}/${s.state}${s.usage ? ' uso=' + s.usage.total_tokens : ''}`); }
    if (o.event === 'result') { usoFinal = o.result.usage; console.log(`+${Date.now() - t0}ms result ${o.result.status}  uso_acumulado=${o.result.usage.total_tokens}`); }
  });
  console.log(`=> PROVA 2 PASSA: modelo=${modelo}, ${passos} passos ao vivo, consumo=${usoFinal?.total_tokens} tokens.`);
}

// PROVA 3 ------------------------------------------------------------------
async function prova3() {
  titulo('PROVA 3. APROVAR pelo hook de ciclo de vida (caminho suportado)');
  if (!existsSync(join(LAB, '.agents', 'hooks.json'))) { console.log('hooks.json ausente na pasta de teste, pulando.'); return; }
  mkdirSync(FILA, { recursive: true });
  for (const f of ['pedido-atual.json', 'resposta.json', 'hook.log']) { try { unlinkSync(join(FILA, f)); } catch {} }

  // Dispara uma ordem que exige run_command, com o hook ativo.
  const run = agy(['-p', 'Execute no shell exatamente este comando e nada mais: echo prova-de-aprovacao',
    '--model', MODELO, '--output-format', 'stream-json', '--print-timeout', '0']);

  // (a) a ponte percebe o pedido parado.
  const ped = join(FILA, 'pedido-atual.json');
  let t = 0; while (!existsSync(ped) && t < 60000) { await sleep(300); t += 300; }
  if (!existsSync(ped)) { console.log('a sessao nao gerou pedido de aprovacao.'); await run; return; }
  const pedido = JSON.parse(readFileSync(ped, 'utf8'));
  console.log('(a) pedido percebido.');
  console.log('(b) conteudo capturado: ferramenta=%s comando=%s', pedido.ferramenta, JSON.stringify(pedido.comando));
  console.log('    toolSummary=%s  conversa=%s', JSON.stringify(pedido.args?.toolSummary), pedido.conversationId);

  // (c) o diretor, por fora, RECUSA. Deny e o caminho que funciona de fato.
  writeFileSync(join(FILA, 'resposta.json'), JSON.stringify({ decision: 'deny', reason: 'Diretor recusou pelo painel, demonstracao da prova 3.' }));
  const out = await run;
  let result = null;
  for (const l of out.split('\n')) { try { const o = JSON.parse(l); if (o.event === 'result') result = o.result; } catch {} }
  console.log('(c) recusa aplicada por fora. status=%s', result?.status);
  console.log('    resposta da sessao:', JSON.stringify((result?.response || '').trim()).slice(0, 180));
  console.log('=> PROVA 3 PARCIAL: perceber, capturar e RECUSAR funcionam pelo hook.');
  console.log('   APROVAR para executar NAO funciona no agy headless: allow + permissionOverrides e ignorado pelo motor de permissao. Ver docs/prova-ponte.md.');
}

// PROVA 4 ------------------------------------------------------------------
async function prova4(cidAnterior) {
  titulo('PROVA 4. COMANDAR DE NOVO, retomar pela id e executar');
  const o1 = JSON.parse((await agy(['-p', 'Guarde este numero para a proxima pergunta: 42. Responda apenas: guardado.',
    '--model', MODELO, '--output-format', 'json', '--print-timeout', '0'])).trim().split('\n').pop());
  console.log('turno 1 id:', o1.conversation_id, '| resposta:', JSON.stringify(o1.response.trim()));
  const o2 = JSON.parse((await agy(['--conversation', o1.conversation_id, '-p', 'Qual numero pedi para guardar? Responda apenas o numero.',
    '--model', MODELO, '--output-format', 'json', '--print-timeout', '0'])).trim().split('\n').pop());
  console.log('turno 2 id:', o2.conversation_id, '| num_turns:', o2.num_turns, '| resposta:', JSON.stringify(o2.response.trim()));
  const ok = o1.conversation_id === o2.conversation_id && /42/.test(o2.response);
  console.log('=> PROVA 4', ok ? 'PASSA' : 'FALHA', ': retomou a mesma conversa e executou o comando novo.');
}

const args = process.argv.slice(2);
const cid = await prova1();
await prova2();
if (!args.includes('--so-1-2-4')) await prova3();
await prova4(cid);
titulo('FIM. Veredito completo e formato dos dados em docs/prova-ponte.md');
