// leitorTranscricao.ts, o leitor que roda COMO o diretor, no Linux. OST 14.
//
// Chamado so pela ponte, pelo lancador /opt/a-fabrica-ponte/bin/ler-transcricao,
// pela regra estreita do sudo. Le um pedido em JSON na entrada e escreve a
// resposta em JSON na saida. Veja leitorDoDiretor.ts para o porque.
//
// O QUE ELE RECUSA, sem ecoar nada do pedido nem do arquivo:
//   caminho fora de ~/.claude/projects do usuario que roda o leitor, pelo
//   caminho REAL (atalho simbolico que aponta para fora e recusado);
//   caminho que nao termina em .jsonl, ou que nao e arquivo comum;
//   operacao que nao seja consumo ou fechamento.

import { realpathSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, sep } from 'node:path';
import { lerTextoDoFechamento, lerTranscricao, type MarcaDaTranscricao } from './transcricao.js';

export function caminhoDentroDasTranscricoes(caminho: string, casa: string): string | null {
  if (typeof caminho !== 'string' || caminho.length === 0 || caminho.length > 1024 || caminho.includes('\u0000')) return null;
  let raiz: string;
  let real: string;
  try {
    raiz = realpathSync(join(casa, '.claude', 'projects'));
    real = realpathSync(caminho);
  } catch {
    return null;
  }
  if (!real.startsWith(raiz + sep) || !real.endsWith('.jsonl')) return null;
  try {
    if (!statSync(real).isFile()) return null;
  } catch {
    return null;
  }
  return real;
}

async function lerEntrada(): Promise<string> {
  const partes: Buffer[] = [];
  let total = 0;
  for await (const p of process.stdin) {
    const b = Buffer.isBuffer(p) ? p : Buffer.from(String(p));
    total += b.length;
    if (total > 512 * 1024) throw new Error('pedido grande demais');
    partes.push(b);
  }
  return Buffer.concat(partes).toString('utf8');
}

async function principal(): Promise<number> {
  let pedido: Record<string, unknown>;
  try {
    pedido = JSON.parse(await lerEntrada()) as Record<string, unknown>;
  } catch {
    return 2;
  }
  const real = caminhoDentroDasTranscricoes(String(pedido['caminho'] ?? ''), homedir());
  if (real === null) return 3;
  if (pedido['op'] === 'consumo') {
    const marcaBruta = pedido['marca'];
    const marca = typeof marcaBruta === 'object' && marcaBruta !== null ? (marcaBruta as MarcaDaTranscricao) : null;
    // A marca guarda o caminho como a ponte o conhece; a leitura usa o real.
    const leitura = lerTranscricao(real, marca !== null ? { ...marca, caminho: real } : null);
    const saida = { ...leitura, marca: { ...leitura.marca, caminho: String(pedido['caminho']) } };
    process.stdout.write(JSON.stringify(saida));
    return 0;
  }
  if (pedido['op'] === 'fechamento') {
    const r = lerTextoDoFechamento(real, String(pedido['trecho'] ?? ''), String(pedido['hora'] ?? ''));
    process.stdout.write(JSON.stringify(r));
    return 0;
  }
  return 4;
}

principal().then(
  (c) => process.exit(c),
  () => process.exit(1)
);
