// transcricao.ts, consumo e modelo da fabrica aberta na mao, OST 9.
//
// O DEFEITO
// ---------
// Fabrica que o diretor abre na mao aparecia com "consumo nao medido" e "modelo
// nao reportado pelo Claude Code" para sempre. O motivo era real: o GANCHO do
// Claude Code nao recebe contagem de token nem modelo. Mas todo gancho recebe
// `transcript_path`, o arquivo onde o proprio Claude Code grava a sessao, e cada
// mensagem do assistente gravada ali traz o `usage` medido pela API e o modelo
// que respondeu. A medida existia o tempo todo, no disco da maquina.
//
// O QUE ESTE ARQUIVO LE, E O QUE ELE NAO DEIXA SAIR, §A.23
// --------------------------------------------------------
// A transcricao tem CONTEUDO: texto do diretor, do agente, de arquivo de cliente.
// Este modulo abre o arquivo e, de cada linha, aproveita SO tres coisas:
//   o identificador da mensagem, para nao contar a mesma mensagem duas vezes;
//   os quatro numeros de token do `usage`;
//   o nome do modelo.
// Nada mais e guardado, devolvido, registrado ou publicado. Linha que nao parseia
// e ignorada em silencio, sem ecoar o conteudo nem no registro da ponte. Numero de
// token e nome de modelo sao METADADO, que o §A.23 manda publicar de todo projeto.
// Projeto IGNORADO nem chega aqui: o gancho dele nao escreve na fila, entao a
// ponte nem conhece o caminho da transcricao.
//
// O QUE NAO COBRE, dito para nao parecer mais do que e
// ----------------------------------------------------
// Se uma versao do Claude Code gravar o subagente num arquivo separado, o consumo
// do subagente da sessao aberta na mao fica de fora. A tela continua honesta: ela
// mostra o que foi medido, e nada e somado por estimativa.

import { closeSync, fstatSync, openSync, readSync } from 'node:fs';

export const CAMPOS = [
  'input_tokens',
  'output_tokens',
  'cache_read_input_tokens',
  'cache_creation_input_tokens',
] as const;
type Campo = (typeof CAMPOS)[number];
export type Contagem = Record<Campo, number>;

/** Quanto da transcricao ja foi lido, e as ultimas mensagens vistas. */
export interface MarcaDaTranscricao {
  caminho: string;
  bytes: number;
  /**
   * Ultimas mensagens vistas, com o maior `usage` de cada uma. O Claude Code grava
   * a mesma mensagem em varias linhas, uma por bloco, repetindo o identificador.
   * Guardar as ultimas basta, porque as repeticoes vem em seguida.
   */
  ultimas: Record<string, Contagem>;
}

/** Teto de leitura por passada, para transcricao gigante nao travar a ponte. */
export const TETO_LEITURA_BYTES = 8 * 1024 * 1024;
const TETO_ULTIMAS = 64;

function zerada(): Contagem {
  return { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };
}

function numero(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0;
}

export interface LeituraDaTranscricao {
  /** O que cresceu desde a ultima leitura. Null quando nada cresceu. */
  acrescimo: Contagem | null;
  /** Ultimo modelo visto nesta leitura, ou null. */
  modelo: string | null;
  marca: MarcaDaTranscricao;
}

/**
 * Le o que entrou na transcricao desde a marca. Nunca lanca: transcricao ausente,
 * ilegivel ou trocada devolve nada e a marca como estava.
 */
export function lerTranscricao(caminho: string, anterior: MarcaDaTranscricao | null): LeituraDaTranscricao {
  // Caminho diferente do anterior e outra transcricao: comeca do zero, mas mantem
  // as ultimas mensagens, para sessao retomada nao contar de novo o que ja contou.
  const marca: MarcaDaTranscricao =
    anterior !== null && anterior.caminho === caminho
      ? { caminho, bytes: anterior.bytes, ultimas: { ...anterior.ultimas } }
      : { caminho, bytes: 0, ultimas: anterior !== null ? { ...anterior.ultimas } : {} };
  const nada: LeituraDaTranscricao = { acrescimo: null, modelo: null, marca: anterior ?? marca };

  let fd: number | null = null;
  let bloco: Buffer;
  try {
    fd = openSync(caminho, 'r');
    const tamanho = fstatSync(fd).size;
    if (tamanho < marca.bytes) {
      // Arquivo encolheu: foi trocado. Recomeca, as ultimas seguram a repeticao.
      marca.bytes = 0;
    }
    const quanto = Math.min(tamanho - marca.bytes, TETO_LEITURA_BYTES);
    if (quanto <= 0) return nada;
    bloco = Buffer.alloc(quanto);
    readSync(fd, bloco, 0, quanto, marca.bytes);
  } catch {
    return nada;
  } finally {
    if (fd !== null) {
      try {
        closeSync(fd);
      } catch {
        // nada a fazer
      }
    }
  }

  // So linha terminada conta: o Claude Code pode estar escrevendo agora.
  const ultimaQuebra = bloco.lastIndexOf(0x0a);
  if (ultimaQuebra < 0) return nada;
  const completo = bloco.subarray(0, ultimaQuebra + 1);
  marca.bytes += completo.length;

  const acrescimo = zerada();
  let cresceu = false;
  let modelo: string | null = null;
  for (const linha of completo.toString('utf8').split('\n')) {
    if (linha.length === 0) continue;
    let obj: unknown;
    try {
      obj = JSON.parse(linha);
    } catch {
      continue;
    }
    if (typeof obj !== 'object' || obj === null) continue;
    const o = obj as Record<string, unknown>;
    if (o['type'] !== 'assistant') continue;
    const msg = o['message'];
    if (typeof msg !== 'object' || msg === null) continue;
    const m = msg as Record<string, unknown>;
    const usage = m['usage'];
    if (typeof m['model'] === 'string' && m['model'].length > 0 && !m['model'].startsWith('<')) {
      modelo = m['model'].slice(0, 80);
    }
    if (typeof usage !== 'object' || usage === null) continue;
    const u = usage as Record<string, unknown>;
    const id =
      typeof m['id'] === 'string' && m['id'].length > 0
        ? m['id']
        : typeof o['uuid'] === 'string'
          ? `linha-${o['uuid']}`
          : null;
    if (id === null) continue;
    const antes = marca.ultimas[id] ?? zerada();
    const agora = zerada();
    for (const c of CAMPOS) {
      agora[c] = Math.max(antes[c], numero(u[c]));
      const d = agora[c] - antes[c];
      if (d > 0) {
        acrescimo[c] += d;
        cresceu = true;
      }
    }
    delete marca.ultimas[id];
    marca.ultimas[id] = agora;
  }

  const ids = Object.keys(marca.ultimas);
  for (let i = 0; i < ids.length - TETO_ULTIMAS; i++) delete marca.ultimas[ids[i] as string];

  return { acrescimo: cresceu ? acrescimo : null, modelo, marca };
}
