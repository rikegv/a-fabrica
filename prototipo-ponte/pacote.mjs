// pacote.mjs, monta o pacote de aprovacao completo para a tela do diretor.
//
// Regra de honestidade: cada campo marca a origem.
//   origem "fato"  = capturado do agy, declaracao ou dado real.
//   origem "ponte" = deducao da ponte, leitura, nunca declaracao do agente.
// Risco e impacto sao sempre deducao da ponte.
import { readFileSync } from 'node:fs';

// Heuristica de risco da ponte, sobre o comando.
function classificarRisco(cmd) {
  const c = (cmd || '').toLowerCase();
  const alto = /\b(rm|remove-item|del|rmdir|format|mkfs|dd|curl|wget|invoke-webrequest|iwr|git\s+push|npm\s+publish|shutdown|reg\s+delete|rd)\b|:\s*>/;
  const medio = /\b(set-content|add-content|new-item|out-file|move-item|mv|copy-item|cp|git\s+commit|npm\s+install|pip\s+install|mkdir|ni)\b|>>?/;
  if (alto.test(c)) return 'alto';
  if (medio.test(c)) return 'medio';
  return 'baixo';
}

// Extrai, do comando, o que aparenta ser tocado. Os tokens sao fato; a leitura e ponte.
function recursosTocados(cmd) {
  const achados = [];
  const re = /(?:-Path|-Destination|>|>>|\bto\b)?\s*["']?([A-Za-z0-9._\-\\/]+\.[A-Za-z0-9]{1,6})["']?/g;
  let m;
  while ((m = re.exec(cmd || '')) !== null) { if (!achados.includes(m[1])) achados.push(m[1]); }
  return achados;
}

function limparTarefa(s) {
  if (!s) return null;
  const m = s.match(/<USER_REQUEST>\s*([\s\S]*?)\s*<\/USER_REQUEST>/);
  return (m ? m[1] : s).trim().slice(0, 400);
}

export function montarPacote(payload, opts = {}) {
  const cmd = payload?.toolCall?.args?.CommandLine ?? null;
  const args = payload?.toolCall?.args ?? {};
  let tarefa = null, agenteDisse = null;
  try {
    const linhas = readFileSync(payload.transcriptPath, 'utf8').trim().split('\n');
    for (const l of linhas) {
      let o; try { o = JSON.parse(l); } catch { continue; }
      if (o.type === 'USER_INPUT' && !tarefa && typeof o.content === 'string') tarefa = limparTarefa(o.content);
      if (o.type === 'PLANNER_RESPONSE' && typeof o.content === 'string' && o.content.trim()) agenteDisse = o.content.trim().slice(0, 400);
    }
  } catch { /* transcript indisponivel, campos ficam nulos */ }

  const risco = classificarRisco(cmd);
  const tocado = recursosTocados(cmd);
  const impactoPorRisco = { baixo: 'Sem efeito colateral aparente, apenas leitura ou impressao.', medio: 'Cria ou altera arquivo ou estado local.', alto: 'Pode apagar, publicar ou acessar rede, efeito dificil de desfazer.' };

  return {
    capturadoEm: new Date().toISOString(),
    marcacao: 'Campos com origem fato foram capturados do agy. Campos com origem ponte sao leitura da ponte, nao declaracao do agente. Risco e impacto sao sempre deducao da ponte.',
    oQue: { valor: cmd, origem: 'fato' },
    resumo: { valor: args.toolSummary || args.toolAction || null, origem: 'fato' },
    tarefa: { valor: tarefa, origem: 'fato' },
    fabrica: { valor: payload?.conversationId ?? null, origem: 'fato' },
    workspace: { valor: payload?.workspacePaths ?? null, origem: 'fato' },
    agenteDisse: { valor: agenteDisse, origem: 'fato' },
    porQue: { valor: agenteDisse ? 'A ponte le que o comando serve a tarefa acima, conforme o que o agente disse.' : 'O agente nao narrou motivo antes de pedir; a ponte infere o motivo pela tarefa.', origem: 'ponte' },
    impacto: { valor: impactoPorRisco[risco], origem: 'ponte' },
    oQueSeraTocado: { valor: tocado.length ? tocado : ['nada identificado no comando'], origem: 'fato mais leitura da ponte' },
    risco: { valor: risco, origem: 'ponte' },
    tempoParadoMs: { valor: opts.tempoParadoMs ?? 0, origem: 'fato' },
  };
}
