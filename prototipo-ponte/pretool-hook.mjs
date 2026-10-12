#!/usr/bin/env node
// Hook PreToolUse da prova de conceito da ponte.
// Caminho suportado: o agy chama este hook antes de usar uma ferramenta.
// Aqui a ponte: (a) percebe o pedido, (b) captura o conteudo, (c) espera a
// resposta do diretor vinda de fora (arquivo local, pois nesta OST nao ha
// nuvem, §A.6) e devolve a decisao ao agy.
import { readFileSync, writeFileSync, existsSync, unlinkSync, appendFileSync, mkdirSync } from 'node:fs';

const FILA = 'C:\\Users\\Henrique\\a-fabrica-lab\\ponte-fila';
const P_PED = FILA + '\\pedido-atual.json';
const P_RESP = FILA + '\\resposta.json';
const P_LOG = FILA + '\\hook.log';
mkdirSync(FILA, { recursive: true });

let raw = '';
try { raw = readFileSync(0, 'utf8'); } catch {}
appendFileSync(P_LOG, `\n--- PreToolUse recebido em ${new Date().toISOString()} ---\n${raw}\n`);

let p = {};
try { p = JSON.parse(raw); } catch {}

// (a)+(b) perceber e capturar o pedido com o maximo de contexto disponivel.
const pedido = {
  recebidoEm: new Date().toISOString(),
  ferramenta: p.toolCall?.name ?? p.tool_name ?? null,
  comando: p.toolCall?.args?.CommandLine ?? null,
  args: p.toolCall?.args ?? null,
  conversationId: p.conversationId ?? p.conversation_id ?? null,
  workspacePaths: p.workspacePaths ?? null,
  chavesBrutas: Object.keys(p),
};
writeFileSync(P_PED, JSON.stringify(pedido, null, 2));

// espera sincrona, sem queimar CPU.
const sleep = (ms) => { try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); } catch {} };

// (c) aguarda a resposta do diretor, por fora.
if (existsSync(P_RESP)) { try { unlinkSync(P_RESP); } catch {} }
const LIMITE_MS = 110000, PASSO = 300;
let esperado = 0, resposta = null;
while (esperado < LIMITE_MS) {
  if (existsSync(P_RESP)) {
    try { resposta = JSON.parse(readFileSync(P_RESP, 'utf8')); } catch {}
    if (resposta) break;
  }
  sleep(PASSO);
  esperado += PASSO;
}

let out;
if (resposta && (resposta.decision === 'allow' || resposta.decision === 'deny')) {
  out = { decision: resposta.decision };
  if (resposta.reason) out.reason = resposta.reason;
  // Aprovar via hook nao basta: o modo headless exige o grant explicito do
  // recurso (permissionOverrides). Quando o diretor aprova um run_command, a
  // ponte concede exatamente aquele comando para este turno.
  if (resposta.decision === 'allow') {
    if (Array.isArray(resposta.permissionOverrides)) {
      out.permissionOverrides = resposta.permissionOverrides;
    } else if (pedido.ferramenta === 'run_command' && pedido.comando) {
      out.permissionOverrides = [`command(${pedido.comando})`];
    }
  }
  appendFileSync(P_LOG, `decisao do diretor: ${resposta.decision} (${resposta.reason || 'sem observacao'}) overrides=${JSON.stringify(out.permissionOverrides || [])}\n`);
} else {
  out = { decision: 'deny', reason: 'Sem resposta do diretor dentro do tempo. Negado por seguranca.' };
  appendFileSync(P_LOG, `timeout sem resposta, negado por seguranca\n`);
}

// limpa o pedido atendido.
try { if (existsSync(P_PED)) unlinkSync(P_PED); } catch {}
try { if (existsSync(P_RESP)) unlinkSync(P_RESP); } catch {}

process.stdout.write(JSON.stringify(out));
process.exit(0);
