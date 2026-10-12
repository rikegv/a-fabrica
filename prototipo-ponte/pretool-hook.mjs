#!/usr/bin/env node
// Hook PreToolUse da inversao da aprovacao (OST 1, Parte 2, spike).
//
// Modelo: o agy fica pre-autorizado no config descartavel para nao travar
// sozinho. Este hook e o PORTAO. Ele segura toda chamada de risco, grava o
// pedido na fila, espera a resposta do diretor vinda de fora, e so entao
// deixa passar (allow) ou segura (deny).
//
// REGRA DURA, FALHA FECHADA: qualquer coisa que nao seja um allow explicito e
// bem formado vira RECUSA. Erro, excecao, stdin ilegivel, resposta ausente,
// resposta malformada, decisao desconhecida ou tempo esgotado, tudo nega.
import { readFileSync, writeFileSync, existsSync, unlinkSync, appendFileSync, mkdirSync } from 'node:fs';

const FILA = 'C:\\Users\\Henrique\\a-fabrica-lab\\ponte-fila';
const P_PED = FILA + '\\pedido-atual.json';
const P_RESP = FILA + '\\resposta.json';
const P_LOG = FILA + '\\hook.log';
const LIMITE_MS = Number(process.env.PONTE_LIMITE_MS || 300000); // padrao 5 min
const PASSO = 300;
const sleep = (ms) => { try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); } catch {} };

// Emite a decisao e encerra. Qualquer saida que nao seja allow e deny.
function decidir(decision, reason) {
  const out = { decision };
  if (reason) out.reason = reason;
  try { if (existsSync(P_PED)) unlinkSync(P_PED); } catch {}
  try { if (existsSync(P_RESP)) unlinkSync(P_RESP); } catch {}
  process.stdout.write(JSON.stringify(out));
  process.exit(0);
}

try {
  mkdirSync(FILA, { recursive: true });
  let raw = '';
  try { raw = readFileSync(0, 'utf8'); } catch {}
  appendFileSync(P_LOG, `\n--- PreToolUse em ${new Date().toISOString()} ---\n${raw}\n`);

  let p;
  try { p = JSON.parse(raw); } catch {
    appendFileSync(P_LOG, 'stdin ilegivel, RECUSA por seguranca\n');
    decidir('deny', 'Pedido ilegivel. Negado por seguranca.');
  }

  // Percebe e captura o pedido.
  const pedido = {
    recebidoEm: new Date().toISOString(),
    ferramenta: p.toolCall?.name ?? null,
    comando: p.toolCall?.args?.CommandLine ?? null,
    args: p.toolCall?.args ?? null,
    conversationId: p.conversationId ?? null,
    workspacePaths: p.workspacePaths ?? null,
    transcriptPath: p.transcriptPath ?? null,
  };
  writeFileSync(P_PED, JSON.stringify(pedido, null, 2));
  if (existsSync(P_RESP)) { try { unlinkSync(P_RESP); } catch {} }

  // Espera a resposta do diretor, por fora.
  let esperado = 0, resposta = null, presenteMasRuim = false;
  while (esperado < LIMITE_MS) {
    if (existsSync(P_RESP)) {
      let txt = '';
      try { txt = readFileSync(P_RESP, 'utf8'); } catch {}
      try { resposta = JSON.parse(txt); } catch { presenteMasRuim = true; }
      // Resposta presente: decide agora. Malformada ou desconhecida, RECUSA.
      if (resposta && (resposta.decision === 'allow' || resposta.decision === 'deny')) {
        appendFileSync(P_LOG, `decisao do diretor: ${resposta.decision} (${resposta.reason || 'sem observacao'})\n`);
        decidir(resposta.decision, resposta.reason);
      }
      if (presenteMasRuim || (resposta && resposta.decision !== 'allow' && resposta.decision !== 'deny')) {
        appendFileSync(P_LOG, 'resposta presente porem malformada ou decisao desconhecida, RECUSA por seguranca\n');
        decidir('deny', 'Resposta malformada. Negado por seguranca.');
      }
    }
    sleep(PASSO);
    esperado += PASSO;
  }
  appendFileSync(P_LOG, 'tempo esgotado sem resposta, RECUSA por seguranca\n');
  decidir('deny', 'Sem resposta do diretor no tempo. Negado por seguranca.');
} catch (e) {
  // Qualquer excecao inesperada, falha fechada.
  try { appendFileSync(P_LOG, `excecao no hook: ${e}\nRECUSA por seguranca\n`); } catch {}
  try { process.stdout.write(JSON.stringify({ decision: 'deny', reason: 'Erro no portao. Negado por seguranca.' })); } catch {}
  process.exit(0);
}
