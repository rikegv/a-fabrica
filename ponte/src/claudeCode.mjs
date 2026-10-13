// claudeCode.mjs, a peca 3 da ponte: pilota o Claude Code pelo kit oficial.
// As TRES RESSALVAS da seguranca sao regra dura, em TODA abertura de fabrica:
//   1. Verificacao do portao com isca antes de abrir, nas MESMAS opcoes e ambiente.
//   2. Limpeza das variaveis de aninhamento do Claude Code.
//   3. Conferencia do modo fixado no evento init.
// Falha fechada: qualquer uma falhando, a fabrica NAO nasce.
import { query } from '@anthropic-ai/claude-agent-sdk';

const MODELO_PADRAO = process.env.PONTE_MODELO || 'claude-haiku-4-5-20251001';
const MODO = 'default'; // fixado na mao, sempre

// Ressalva 2: ambiente sem as variaveis de aninhamento, senao o filho herda a sessao
// pai e o portao nao e chamado.
export function ambienteLimpo() {
  return Object.fromEntries(Object.entries(process.env).filter(([k]) => !/^CLAUDE/i.test(k) && k !== 'CLAUDECODE' && k !== 'AI_AGENT'));
}

function opcoesBase(cwd) {
  return { cwd, model: MODELO_PADRAO, permissionMode: MODO, settingSources: [], env: ambienteLimpo(), includePartialMessages: true };
}

// Ressalva 1: dispara uma isca de risco que o portao TEM de barrar. Isca executou,
// portao nao esta vivo, nao abre. So o portao vivo e correto produz o sinal.
const ISCA = 'PONTE-ISCA';
export async function verificaPortao(cwd) {
  let chamado = 0, iscaExecutou = false;
  const canUseTool = async () => { chamado++; return { behavior: 'deny', message: 'Isca do portao, recusa automatica.' }; };
  try {
    for await (const m of query({ prompt: `Usando a ferramenta de escrita, crie o arquivo ${cwd}/${ISCA}.txt com o conteudo x.`, options: { ...opcoesBase(cwd), canUseTool, maxTurns: 2 } })) {
      if (m.type === 'user') for (const b of (m.message?.content || [])) if (b?.type === 'tool_result') { const t = typeof b.content === 'string' ? b.content : JSON.stringify(b.content); if (/created|written|sucesso|\bx\b/i.test(t)) iscaExecutou = true; }
    }
  } catch { /* erro ao sondar, trata como portao nao confirmado */ }
  // confirmacao por efeito: o arquivo da isca nao pode ter sido criado
  const fs = await import('node:fs'); const alvo = `${cwd}/${ISCA}.txt`;
  if (fs.existsSync(alvo)) { iscaExecutou = true; try { fs.unlinkSync(alvo); } catch {} }
  return { vivo: chamado > 0 && !iscaExecutou, chamado, iscaExecutou };
}

// Abre a fabrica com o portao duro. onEvento recebe atividade ao vivo. portao(toolName,input)
// decide allow/deny (a ponte liga isso a base). Retorna sessionId, usage, estado.
export async function abrirFabrica({ cwd, prompt, resumeId, portao, onEvento }) {
  // Ressalva 1: so abre com o portao vivo.
  const prova = await verificaPortao(cwd);
  if (!prova.vivo) { const e = new Error('portao nao confirmado na abertura, fabrica nao nasce'); e.prova = prova; throw e; }

  const estado = { sessionId: null, usage: null, resultado: null, modoConferido: false, textoAoVivo: '' };
  const options = { ...opcoesBase(cwd), canUseTool: portao, maxTurns: 12 };
  if (resumeId) options.resume = resumeId;

  for await (const m of query({ prompt, options })) {
    if (m.type === 'system' && m.subtype === 'init') {
      estado.sessionId = m.session_id;
      // Ressalva 3: conferir o modo fixado. Se nao veio default, falha fechada.
      estado.modoConferido = m.permissionMode === MODO;
      if (!estado.modoConferido) throw new Error(`modo nao fixado como ${MODO} (veio ${m.permissionMode}), falha fechada`);
      onEvento?.({ tipo: 'init', sessionId: m.session_id, modelo: m.model, modo: m.permissionMode });
    }
    if (m.type === 'stream_event' && m.event?.type === 'content_block_delta' && m.event.delta?.text) { estado.textoAoVivo += m.event.delta.text; }
    if (m.type === 'assistant') for (const b of (m.message?.content || [])) {
      const sub = !!m.parent_tool_use_id;
      if (b.type === 'text') { estado.textoAoVivo += b.text; onEvento?.({ tipo: 'texto', sub, texto: b.text }); }
      if (b.type === 'thinking') onEvento?.({ tipo: 'pensamento', sub });
      if (b.type === 'tool_use') onEvento?.({ tipo: 'ferramenta', sub, ferramenta: b.name, entrada: b.input, inicioSubagente: b.name === 'Task' });
    }
    if (m.type === 'user') for (const b of (m.message?.content || [])) if (b?.type === 'tool_result') onEvento?.({ tipo: 'resultado', sub: !!m.parent_tool_use_id });
    if (m.type === 'result') { estado.usage = m.usage; estado.resultado = m.subtype; estado.custo = m.total_cost_usd; onEvento?.({ tipo: 'fim', estado: m.subtype, usage: m.usage, custo: m.total_cost_usd }); }
  }
  return estado;
}

export { MODO, MODELO_PADRAO };
