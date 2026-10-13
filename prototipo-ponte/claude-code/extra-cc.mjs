#!/usr/bin/env node
// extra-cc.mjs: complemento da prova 2 (subagente) e a verificacao do portao
// na abertura (§A.6), sobre o Claude Code em sessao viva.
import { query } from '@anthropic-ai/claude-agent-sdk';
import { existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
const HOME = homedir();
const PROJ = join(HOME, 'a-fabrica-lab', 'projeto-cc');
const RODADAS = join(HOME, 'a-fabrica-lab', 'rodadas');
const MODELO = 'claude-haiku-4-5-20251001';
const envLimpo = Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^CLAUDE/i.test(k) && k !== 'CLAUDECODE' && k !== 'AI_AGENT'));
let seq = 0;
const nova = (n) => { const d = join(RODADAS, `${new Date().toISOString().replace(/[:.]/g, '').slice(0, 15)}-${String(++seq).padStart(2, '0')}-cc-${n}`); mkdirSync(d, { recursive: true }); return d; };

// Subagente: forca o uso da ferramenta Task e captura inicio e fim.
async function subagente() {
  const eventos = [];
  const canUseTool = async () => ({ behavior: 'allow' });
  for await (const m of query({
    prompt: 'Use a ferramenta Task para lancar um subagente que liste os arquivos desta pasta e resuma. Depois relate o resultado em uma frase.',
    options: { cwd: PROJ, model: MODELO, permissionMode: 'default', settingSources: [], env: envLimpo, canUseTool, maxTurns: 6 },
  })) {
    if (m.type === 'assistant') for (const b of (m.message?.content || [])) {
      if (b.type === 'tool_use' && b.name === 'Task') eventos.push(`inicio subagente (Task tool_use id=${b.id?.slice(0, 8)})`);
      if (m.parent_tool_use_id) eventos.push(`atividade dentro do subagente (parent=${m.parent_tool_use_id.slice(0, 8)}, ${b.type})`);
    }
    if (m.type === 'user') for (const b of (m.message?.content || [])) if (b?.type === 'tool_result' && m.parent_tool_use_id === undefined) { /* resultado no pai */ }
  }
  console.log('SUBAGENTE eventos capturados:', eventos.length);
  eventos.slice(0, 8).forEach(e => console.log('  -', e));
  console.log('subagente detectado=', eventos.some(e => e.includes('subagente')));
}

// Verificacao do portao na abertura: isca de risco que o portao TEM de barrar.
async function verificaPortao(permissionMode) {
  const fila = nova(`verifica-portao-${permissionMode}`);
  const isca = join(fila, 'ISCA.txt');
  let canUse = 0;
  const canUseTool = async () => { canUse++; return { behavior: 'deny', message: 'isca do portao' }; };
  const options = { cwd: PROJ, model: MODELO, permissionMode, settingSources: [], env: envLimpo, maxTurns: 3 };
  if (permissionMode !== 'bypassPermissions') options.canUseTool = canUseTool; else {}
  // no bypass o portao nao e efetivo; simulamos "portao nao ativo"
  try { for await (const _ of query({ prompt: `Usando a ferramenta de escrita, crie o arquivo ${isca} com o conteudo x.`, options })) {} } catch {}
  const iscaExecutou = existsSync(isca);
  const portaoVivo = canUse > 0 && !iscaExecutou;
  console.log(`VERIFICA PORTAO modo=${permissionMode}: portao_chamado=${canUse} isca_executou=${iscaExecutou} => portao_vivo=${portaoVivo} => ${portaoVivo ? 'PODE abrir' : 'RECUSA abrir'}`);
  return portaoVivo;
}

console.log('=== complemento da prova 2: subagente ===');
await subagente();
console.log('\n=== verificacao do portao na abertura (§A.6) ===');
await verificaPortao('default');
await verificaPortao('bypassPermissions');
