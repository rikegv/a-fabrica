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
// A funcao lerTranscricao abre o arquivo e, de cada linha, aproveita SO tres
// coisas:
//   o identificador da mensagem, para nao contar a mesma mensagem duas vezes;
//   os quatro numeros de token do `usage`;
//   o nome do modelo.
// Dela, nada mais e guardado, devolvido, registrado ou publicado. Linha que nao parseia
// e ignorada em silencio, sem ecoar o conteudo nem no registro da ponte. Numero de
// token e nome de modelo sao METADADO, que o §A.23 manda publicar de todo projeto.
// Projeto IGNORADO nem chega aqui: o gancho dele nao escreve na fila, entao a
// ponte nem conhece o caminho da transcricao.
//
// DECISAO DO DIRETOR, 23/11/2026, registrada no §A.23 do CLAUDE.md: a ponte PODE
// abrir a transcricao de projeto NAO LIBERADO para tirar so o consumo e o nome do
// modelo. Nenhum texto sai de lerTranscricao. Isto fecha a decisao 2 pendente em
// docs/ost9-noite.md.
//
// A VERDADE NOVA, OST 13: UMA funcao deste arquivo tira TEXTO, e so uma
// ---------------------------------------------------------------------
// lerTextoDoFechamento, separada de lerTranscricao de proposito, devolve o texto
// INTEIRO da resposta final da sessao principal, porque o gancho corta a resposta
// em 4000 caracteres e o fechamento real passa disso. A ponte so a chama quando
// TODAS valem (condicoes da seguranca na OST 13): evento Stop, linha com
// conteudo === true exato, sem subagente, resposta do gancho terminada em
// "[...cortado]", caminho dentro de %USERPROFILE%\.claude\projects por fronteira
// de pasta, terminado em .jsonl e com o nome igual ao sid, e projeto fora de
// projetosIgnorados, relido do ganchos.json na hora. Ela le so linhas do
// assistente da sessao principal, so blocos de texto, so a cauda do arquivo, e
// confere por igualdade exata com o que o gancho entregou. O texto fica so em
// memoria ate a ponte mascarar e gravar o relatorio; nunca vai para marca,
// arquivo de marcas, registro ou mensagem de erro.
//
// O QUE NAO COBRE, dito para nao parecer mais do que e
// ----------------------------------------------------
// Se uma versao do Claude Code gravar o subagente num arquivo separado, o consumo
// do subagente da sessao aberta na mao fica de fora. A tela continua honesta: ela
// mostra o que foi medido, e nada e somado por estimativa.

import { closeSync, fstatSync, openSync, readSync } from 'node:fs';
import { join } from 'node:path';
import { SEPARADOR, caminhoComparavel } from './plataforma.js';

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

// ---------------------------------------------------------------------------
// OST 13: o texto inteiro do fechamento. Veja o cabecalho, "A VERDADE NOVA".
// ---------------------------------------------------------------------------

/** Sufixo que o gancho poe quando corta a resposta. */
export const SUFIXO_DE_CORTE = '[...cortado]';
/** Teto do texto devolvido, condicao f da seguranca. */
export const TETO_TEXTO_DO_FECHAMENTO = 200_000;

export interface TextoDoFechamento {
  /** O texto achado, ou null quando nao deu para achar. Fica so em memoria. */
  texto: string | null;
  /** Verdadeiro quando passou do teto e foi cortado. */
  cortado: boolean;
  /** Motivo curto, SEM trecho nenhum do arquivo, para registro. */
  motivo: string;
}

function comparavel(c: string): string {
  // Windows: minusculo e barra invertida. Linux, OST 14: como veio, porque la
  // maiuscula conta. Veja plataforma.ts.
  return caminhoComparavel(c);
}

/**
 * Condicao b: o caminho e uma transcricao do Claude Code DESTA sessao? Dentro de
 * <casa>\.claude\projects por fronteira de pasta, terminado em .jsonl, e com o
 * nome do arquivo igual ao sid. Caminho com ".." e recusado antes de comparar.
 */
export function caminhoDeTranscricaoAceito(caminho: string, sid: string, casa: string): boolean {
  if (caminho.includes('\u0000') || /(^|[\\/])\.\.([\\/]|$)/.test(caminho)) return false;
  const raiz = comparavel(join(casa, '.claude', 'projects'));
  const c = comparavel(caminho);
  if (!c.startsWith(`${raiz}${SEPARADOR}`)) return false;
  if (!c.endsWith('.jsonl')) return false;
  const nome = c.slice(c.lastIndexOf(SEPARADOR) + 1, -'.jsonl'.length);
  return nome === sid.toLowerCase() && /^[a-z0-9-]{8,80}$/.test(nome);
}

/**
 * Le da cauda da transcricao o texto inteiro da resposta final da sessao
 * principal que corresponde ao Stop. Nunca lanca, e nunca poe trecho do arquivo
 * em mensagem.
 *
 * Como acha a mensagem: junta os blocos de texto de cada mensagem do assistente
 * da sessao principal (isSidechain diferente de true) pelo message.id, fica so
 * com as gravadas ate a hora do Stop (folga de 5 segundos, mesmo relogio da
 * maquina), e anda de tras para a frente ate a primeira cujo comeco e IGUAL ao
 * trecho do gancho, sem normalizar nada. A hora importa: a ponte pode ler a fila
 * atrasada, depois de o diretor ja ter mandado a rodada seguinte, e a ultima
 * mensagem do arquivo ja nao e a do Stop.
 */
export function lerTextoDoFechamento(caminho: string, trechoDoGancho: string, horaDoStop: string): TextoDoFechamento {
  const nada = (motivo: string): TextoDoFechamento => ({ texto: null, cortado: false, motivo });
  const limite = new Date(horaDoStop).getTime();
  if (!Number.isFinite(limite)) return nada('hora do Stop ilegivel');
  if (trechoDoGancho.length === 0) return nada('trecho do gancho vazio');
  let fd: number | null = null;
  let bloco: Buffer;
  let doComeco = false;
  try {
    fd = openSync(caminho, 'r');
    const tamanho = fstatSync(fd).size;
    const quanto = Math.min(tamanho, TETO_LEITURA_BYTES);
    doComeco = quanto === tamanho;
    bloco = Buffer.alloc(quanto);
    readSync(fd, bloco, 0, quanto, tamanho - quanto);
  } catch {
    return nada('transcricao ilegivel');
  } finally {
    if (fd !== null) {
      try {
        closeSync(fd);
      } catch {
        // nada a fazer
      }
    }
  }
  let bruto = bloco.toString('utf8');
  if (!doComeco) {
    // Comecou no meio de uma linha: a primeira, partida, nao conta.
    const q = bruto.indexOf('\n');
    bruto = q < 0 ? '' : bruto.slice(q + 1);
  }

  const ordem: string[] = [];
  const porId = new Map<string, { partes: string[]; em: number }>();
  for (const linha of bruto.split('\n')) {
    if (linha.length === 0) continue;
    let obj: unknown;
    try {
      obj = JSON.parse(linha);
    } catch {
      continue;
    }
    if (typeof obj !== 'object' || obj === null) continue;
    const o = obj as Record<string, unknown>;
    if (o['type'] !== 'assistant' || o['isSidechain'] === true) continue;
    const msg = o['message'];
    if (typeof msg !== 'object' || msg === null) continue;
    const m = msg as Record<string, unknown>;
    const conteudo = m['content'];
    if (!Array.isArray(conteudo)) continue;
    const em = typeof o['timestamp'] === 'string' ? new Date(o['timestamp']).getTime() : NaN;
    const id =
      typeof m['id'] === 'string' && m['id'].length > 0 ? m['id'] : typeof o['uuid'] === 'string' ? o['uuid'] : null;
    if (id === null) continue;
    for (const b of conteudo) {
      if (typeof b !== 'object' || b === null) continue;
      const bb = b as Record<string, unknown>;
      if (bb['type'] !== 'text' || typeof bb['text'] !== 'string') continue;
      let reg = porId.get(id);
      if (reg === undefined) {
        reg = { partes: [], em };
        porId.set(id, reg);
        ordem.push(id);
      }
      reg.partes.push(bb['text']);
      if (Number.isFinite(em)) reg.em = em;
    }
  }

  const FOLGA_MS = 5000;
  for (let i = ordem.length - 1; i >= 0; i--) {
    const reg = porId.get(ordem[i] as string);
    if (reg === undefined || !Number.isFinite(reg.em) || reg.em > limite + FOLGA_MS) continue;
    // O jeito de juntar os blocos que o Claude Code usa no last_assistant_message
    // nao e documentado. Tenta os tres; a igualdade exata e quem decide.
    for (const juntado of [reg.partes.join('\n'), reg.partes.join(''), reg.partes.join('\n\n')]) {
      if (juntado.length > trechoDoGancho.length && juntado.slice(0, trechoDoGancho.length) === trechoDoGancho) {
        if (juntado.length > TETO_TEXTO_DO_FECHAMENTO) {
          return { texto: juntado.slice(0, TETO_TEXTO_DO_FECHAMENTO), cortado: true, motivo: 'texto acima do teto, cortado' };
        }
        return { texto: juntado, cortado: false, motivo: 'achado' };
      }
    }
  }
  return nada('nenhuma mensagem da sessao principal bateu com o trecho do gancho');
}
