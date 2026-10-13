#!/usr/bin/env node
// Hook PreToolUse, o PORTAO da ponte (OST 2).
//
// O agy fica pre-autorizado no config descartavel, no minimo necessario. Este
// hook e o portao: segura toda chamada de risco, monta o pacote de aprovacao,
// grava o pedido na fila da rodada, espera a resposta do diretor vinda de fora,
// e so entao deixa passar (allow) ou segura (deny).
//
// FALHA FECHADA: qualquer coisa que nao seja allow explicito e bem formado vira
// RECUSA. Erro, excecao, stdin ilegivel, resposta ausente, malformada, decisao
// desconhecida ou tempo esgotado, tudo nega.
//
// ISCA: um comando de prova positiva do portao. Se o comando contem o marcador
// da isca, o portao recusa na hora. E assim que a ponte prova, antes de abrir
// uma fabrica, que o portao esta vivo.
//
// A fila vive na pasta da rodada, passada por PONTE_FILA. Nada e apagado para
// limpar: cada rodada tem a sua fila nova.
import { readFileSync, writeFileSync, existsSync, unlinkSync, appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { montarPacote } from './pacote.mjs';

const FILA = process.env.PONTE_FILA || 'C:\\Users\\Henrique\\a-fabrica-lab\\ponte-fila';
const P_PED = join(FILA, 'pedido-atual.json');
const P_RESP = join(FILA, 'resposta.json');
const P_LOG = join(FILA, 'hook.log');
const ISCA = /PORTAO-ISCA/;
const LIMITE_MS = Number(process.env.PONTE_LIMITE_MS || 300000);
const PASSO = 300;
const sleep = (ms) => { try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); } catch {} };

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
    appendFileSync(P_LOG, 'stdin ilegivel, RECUSA\n');
    decidir('deny', 'Pedido ilegivel. Negado por seguranca.');
  }

  const cmd = p?.toolCall?.args?.CommandLine ?? '';

  // Prova positiva do portao: a isca sempre e recusada na hora.
  if (ISCA.test(cmd)) {
    appendFileSync(P_LOG, 'isca do portao interceptada, RECUSA automatica (prova de portao vivo)\n');
    decidir('deny', 'Isca do portao. Recusa automatica, portao vivo.');
  }

  // Monta o pacote completo e grava o pedido na fila da rodada.
  const recebido = Date.now();
  let pacote;
  try { pacote = montarPacote(p, { tempoParadoMs: 0 }); } catch (e) { pacote = { erro: String(e) }; }
  writeFileSync(P_PED, JSON.stringify({ pacote, bruto: { ferramenta: p?.toolCall?.name, conversationId: p?.conversationId } }, null, 2));
  if (existsSync(P_RESP)) { try { unlinkSync(P_RESP); } catch {} }

  // Espera a resposta do diretor, por fora.
  let esperado = 0, resposta = null, presenteMasRuim = false;
  while (esperado < LIMITE_MS) {
    if (existsSync(P_RESP)) {
      let txt = ''; try { txt = readFileSync(P_RESP, 'utf8'); } catch {}
      try { resposta = JSON.parse(txt); } catch { presenteMasRuim = true; }
      if (resposta && (resposta.decision === 'allow' || resposta.decision === 'deny')) {
        const tempo = Date.now() - recebido;
        appendFileSync(P_LOG, `decisao do diretor: ${resposta.decision} (${resposta.reason || 'sem observacao'}), parado por ${tempo} ms\n`);
        decidir(resposta.decision, resposta.reason);
      }
      if (presenteMasRuim || (resposta && resposta.decision !== 'allow' && resposta.decision !== 'deny')) {
        appendFileSync(P_LOG, 'resposta presente porem malformada ou decisao desconhecida, RECUSA\n');
        decidir('deny', 'Resposta malformada. Negado por seguranca.');
      }
    }
    sleep(PASSO);
    esperado += PASSO;
  }
  appendFileSync(P_LOG, 'tempo esgotado sem resposta, RECUSA\n');
  decidir('deny', 'Sem resposta do diretor no tempo. Negado por seguranca.');
} catch (e) {
  try { appendFileSync(P_LOG, `excecao no hook: ${e}\nRECUSA\n`); } catch {}
  try { process.stdout.write(JSON.stringify({ decision: 'deny', reason: 'Erro no portao. Negado por seguranca.' })); } catch {}
  process.exit(0);
}
