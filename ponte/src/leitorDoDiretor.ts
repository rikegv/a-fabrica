// leitorDoDiretor.ts, como a ponte le a transcricao do Claude Code. OST 14.
//
// No Windows, nada muda: a ponte roda como o diretor e le o arquivo direto.
//
// No Linux a ponte roda como fabrica-ponte, e a transcricao do diretor e dele,
// modo 600, numa pasta 700. Isso e bom e fica assim: a ponte NAO ganha leitura das
// pastas do diretor, e nada na configuracao do Claude Code e mexido (§A.9). No
// lugar, a ponte pede ao sistema, pela mesma regra estreita do sudo, para rodar
// um leitor pequeno COMO o diretor. O leitor (leitorTranscricao.ts):
//   so abre caminho dentro de ~/.claude/projects do diretor, terminado em .jsonl,
//   conferido pelo caminho real, sem atalho para fora;
//   so devolve o que as duas funcoes de transcricao.ts ja devolvem: numeros de
//   token e nome do modelo, ou o texto do fechamento que bate com o do gancho;
//   nunca ecoa conteudo em erro.
// Qualquer falha vira "nada lido", o mesmo comportamento das funcoes originais.

import { spawn } from 'node:child_process';
import { usuarioDasFabricas } from './plataforma.js';
import {
  lerTextoDoFechamento,
  lerTranscricao,
  type LeituraDaTranscricao,
  type MarcaDaTranscricao,
  type TextoDoFechamento,
} from './transcricao.js';

export const LEITOR_COMO_DIRETOR = process.env.PONTE_LEITOR_TRANSCRICAO ?? '/opt/a-fabrica-ponte/bin/ler-transcricao';
const PRAZO_MS = 20_000;
const TETO_SAIDA = 1024 * 1024;

/** Roda o leitor como o diretor e devolve o JSON que ele escreveu, ou null. */
function pedirAoLeitor(usuario: string, pedido: Record<string, unknown>): Promise<Record<string, unknown> | null> {
  return new Promise((ok) => {
    let saida = '';
    let acabou = false;
    const fim = (v: Record<string, unknown> | null): void => {
      if (acabou) return;
      acabou = true;
      clearTimeout(relogio);
      ok(v);
    };
    const filho = spawn('sudo', ['-n', '-u', usuario, '--', LEITOR_COMO_DIRETOR], { stdio: ['pipe', 'pipe', 'ignore'] });
    const relogio = setTimeout(() => {
      filho.kill('SIGTERM');
      fim(null);
    }, PRAZO_MS);
    filho.on('error', () => fim(null));
    filho.stdout.setEncoding('utf8');
    filho.stdout.on('data', (d: string) => {
      saida += d;
      if (saida.length > TETO_SAIDA) {
        filho.kill('SIGTERM');
        fim(null);
      }
    });
    filho.on('close', (codigo) => {
      if (codigo !== 0) return fim(null);
      try {
        const j: unknown = JSON.parse(saida);
        fim(typeof j === 'object' && j !== null ? (j as Record<string, unknown>) : null);
      } catch {
        fim(null);
      }
    });
    filho.stdin.on('error', () => undefined);
    filho.stdin.end(JSON.stringify(pedido));
  });
}

/** O consumo e o modelo desde a marca. Mesmo contrato de lerTranscricao. */
export async function lerTranscricaoDaSessao(
  caminho: string,
  anterior: MarcaDaTranscricao | null
): Promise<LeituraDaTranscricao> {
  const usuario = usuarioDasFabricas();
  if (usuario === null) return lerTranscricao(caminho, anterior);
  const r = await pedirAoLeitor(usuario, { op: 'consumo', caminho, marca: anterior });
  const nada: LeituraDaTranscricao = {
    acrescimo: null,
    modelo: null,
    marca: anterior ?? { caminho, bytes: 0, ultimas: {} },
  };
  if (r === null || typeof r['marca'] !== 'object' || r['marca'] === null) return nada;
  const marca = r['marca'] as MarcaDaTranscricao;
  if (marca.caminho !== caminho || typeof marca.bytes !== 'number' || typeof marca.ultimas !== 'object') return nada;
  return {
    acrescimo: (r['acrescimo'] as LeituraDaTranscricao['acrescimo']) ?? null,
    modelo: typeof r['modelo'] === 'string' ? r['modelo'].slice(0, 80) : null,
    marca,
  };
}

/** O texto inteiro do fechamento. Mesmo contrato de lerTextoDoFechamento. */
export async function lerTextoDoFechamentoDaSessao(
  caminho: string,
  trecho: string,
  hora: string
): Promise<TextoDoFechamento> {
  const usuario = usuarioDasFabricas();
  if (usuario === null) return lerTextoDoFechamento(caminho, trecho, hora);
  const r = await pedirAoLeitor(usuario, { op: 'fechamento', caminho, trecho, hora });
  if (r === null) return { texto: null, cortado: false, motivo: 'o leitor da transcricao nao respondeu' };
  return {
    texto: typeof r['texto'] === 'string' ? r['texto'] : null,
    cortado: r['cortado'] === true,
    motivo: typeof r['motivo'] === 'string' ? r['motivo'].slice(0, 200) : 'sem motivo',
  };
}
