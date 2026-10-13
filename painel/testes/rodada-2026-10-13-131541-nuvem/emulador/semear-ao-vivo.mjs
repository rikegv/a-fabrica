/*
 * Escreve na base com o painel ABERTO, para provar a atualizacao ao vivo:
 * o diretor nao recarrega a pagina e a tela muda sozinha.
 *
 * Fala so com o emulador local, 127.0.0.1:8399. Nada vai para a nuvem.
 *
 * Uso:
 *   node semear-ao-vivo.mjs fabrica-nova    acrescenta uma fabrica em execucao
 *   node semear-ao-vivo.mjs passo-novo      acrescenta um passo na atividade de fab-portal
 */

const PROJETO = 'a-fabrica-soulan';
const BASE = `http://127.0.0.1:8399/v1/projects/${PROJETO}/databases/(default)/documents`;

function valor(v) {
  if (v === null) return { nullValue: null };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(valor) } };
  return { mapValue: { fields: campos(v) } };
}
function campos(objeto) {
  const saida = {};
  for (const [k, v] of Object.entries(objeto)) saida[k] = valor(v);
  return saida;
}
async function escrever(caminho, id, dados) {
  const r = await fetch(`${BASE}/${caminho}?documentId=${encodeURIComponent(id)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
    body: JSON.stringify({ fields: campos(dados) })
  });
  if (r.ok) return;
  if (r.status === 409) {
    const p = await fetch(`${BASE}/${caminho}/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
      body: JSON.stringify({ fields: campos(dados) })
    });
    if (!p.ok) throw new Error(`${caminho}/${id}: ${p.status} ${await p.text()}`);
    return;
  }
  throw new Error(`${caminho}/${id}: ${r.status} ${await r.text()}`);
}

const agora = Date.now();
const atras = (ms) => new Date(agora - ms);
const MIN = 60_000;
const modo = process.argv[2] ?? 'fabrica-nova';

if (modo === 'fabrica-nova') {
  await escrever('fabricas', 'fab-ao-vivo', {
    fabricaId: 'fab-ao-vivo',
    maquinaId: 'maquina-do-diretor',
    conversationId: 'conversa-fab-ao-vivo',
    projeto: 'Prova Ao Vivo',
    pasta: '~/projetos/prova-ao-vivo',
    agente: 'Claude Code',
    modelo: 'claude-opus-4-6',
    estado: 'em execucao',
    inicio: atras(2 * MIN),
    tempoDecorridoMs: 2 * MIN,
    consumo: {
      inputTokens: 6000,
      outputTokens: 2500,
      thinkingTokens: 1000,
      cacheReadTokens: 500,
      totalTokens: 10_000
    },
    atualizadoEm: atras(1000)
  });
  console.log('Escrita ao vivo: fabrica "Prova Ao Vivo" acrescentada com o painel aberto.');
} else if (modo === 'passo-novo') {
  await escrever('fabricas/fab-portal/atividade', '49', {
    seq: 49,
    stepIndex: 49,
    tipo: 'agent_response',
    estado: 'DONE',
    ferramenta: null,
    textoDelta: 'Passo novo escrito com o painel aberto, para provar a atualização ao vivo.',
    toolInfo: null,
    consumoParcial: null,
    em: atras(1000)
  });
  console.log('Escrita ao vivo: passo 49 acrescentado na atividade de fab-portal.');
} else {
  throw new Error('modo desconhecido: ' + modo);
}
