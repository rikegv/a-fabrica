// nomeDaSessao.ts, OST 15: o nome que a sessao aberta na mao tem no app.
//
// O QUE E
// -------
// O Claude Code grava o nome da sessao na propria transcricao, em linhas proprias:
//   {"type":"custom-title","customTitle":"...","sessionId":"..."}  nome dado pelo diretor
//   {"type":"ai-title","aiTitle":"...","sessionId":"..."}          titulo que o Claude Code da
// Vale a ULTIMA linha de cada tipo. A ponte grava na fabrica `nomeDaSessao` (do
// custom-title) e `tituloDaSessao` (do ai-title), e o painel escolhe qual mostrar,
// docs/ost15-contrato.md.
//
// AS CONDICOES DA SEGURANCA, OST 15, e onde cada uma mora
// -------------------------------------------------------
// Quem chama (ganchos.ts) so abre a transcricao para nome quando a linha da fila
// que DISPAROU a leitura tem conteudo === true exato, decidido pelo gancho; quando
// projetoIgnorado() diz que nao, relido na hora; e quando o caminho passa em
// caminhoDeTranscricaoAceito(caminho, sid, homedir()). Este arquivo:
//   abre so para leitura, e nunca escreve nada em ~/.claude;
//   olha so linha que comeca com o prefixo, e mesmo assim faz JSON.parse e
//   confere `type` e o tipo string do campo; o prefixo e so atalho;
//   aceita so a linha cujo sessionId e igual ao sid, quando o campo existe;
//   limpa nesta ordem: tira \p{Cc} e \p{Cf}, junta espacos, mascara, corta em 80;
//   le de forma incremental, com marca propria e o teto de 8 MB por passada;
//   a marca guarda SO a posicao em bytes. O titulo nao vai para marca, registro
//   nem mensagem de erro: so fica em memoria ate subir para a fabrica.

import { closeSync, fstatSync, openSync, readSync } from 'node:fs';
import { mascarar } from './mascara.js';
import { TETO_LEITURA_BYTES } from './transcricao.js';

/** O mesmo teto do painel, painel/src/dados/escritas.ts. */
export const TETO_NOME = 80;

/** Limpeza na ordem combinada com a seguranca. Vazio vira null. */
export function limparNomeDaSessao(bruto: string): string | null {
  const semControle = bruto.replace(/[\p{Cc}\p{Cf}]/gu, ' ');
  const junto = semControle.replace(/\s+/g, ' ').trim();
  const t = mascarar(junto).texto.slice(0, TETO_NOME).trim();
  return t.length > 0 ? t : null;
}

/** Ate onde a transcricao ja foi lida para o nome. So posicao, nunca texto. */
export interface MarcaDoNome {
  caminho: string;
  bytes: number;
}

/** O que a leitura achou. Campo ausente: nenhuma linha daquele tipo nesta passada. */
export interface AchadoDoNome {
  nomeDaSessao?: string | null;
  tituloDaSessao?: string | null;
}

export interface LeituraDoNome {
  achado: AchadoDoNome;
  /** Marca a guardar DEPOIS de a mudanca subir. */
  marca: MarcaDoNome;
}

const PREFIXO_NOME = '{"type":"custom-title"';
const PREFIXO_TITULO = '{"type":"ai-title"';

/**
 * Le o que entrou na transcricao desde a marca. Nunca lanca, e nunca poe trecho
 * do arquivo em mensagem.
 */
export function lerNomeDaSessao(caminho: string, sid: string, anterior: MarcaDoNome | null): LeituraDoNome {
  const marca: MarcaDoNome = {
    caminho,
    bytes: anterior !== null && anterior.caminho === caminho ? anterior.bytes : 0,
  };
  const nada: LeituraDoNome = { achado: {}, marca: anterior ?? marca };

  let fd: number | null = null;
  let bloco: Buffer;
  try {
    fd = openSync(caminho, 'r');
    const tamanho = fstatSync(fd).size;
    if (tamanho < marca.bytes) marca.bytes = 0; // trocado: recomeca
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

  const achado: AchadoDoNome = {};
  for (const linha of completo.toString('utf8').split('\n')) {
    if (!linha.startsWith(PREFIXO_NOME) && !linha.startsWith(PREFIXO_TITULO)) continue;
    let o: Record<string, unknown>;
    try {
      const j: unknown = JSON.parse(linha);
      if (typeof j !== 'object' || j === null || Array.isArray(j)) continue;
      o = j as Record<string, unknown>;
    } catch {
      continue;
    }
    if ('sessionId' in o && o['sessionId'] !== sid) continue;
    if (o['type'] === 'custom-title' && typeof o['customTitle'] === 'string') {
      achado.nomeDaSessao = limparNomeDaSessao(o['customTitle']);
    } else if (o['type'] === 'ai-title' && typeof o['aiTitle'] === 'string') {
      achado.tituloDaSessao = limparNomeDaSessao(o['aiTitle']);
    }
  }
  return { achado, marca };
}

/**
 * O que de fato muda na fabrica: so os campos achados que diferem do que ja esta
 * gravado. Null quando nada muda, e entao nada e escrito.
 */
export function mudancaDoNome(achado: AchadoDoNome, gravado: Record<string, unknown>): AchadoDoNome | null {
  const m: AchadoDoNome = {};
  if (achado.nomeDaSessao !== undefined && (gravado['nomeDaSessao'] ?? null) !== achado.nomeDaSessao) {
    m.nomeDaSessao = achado.nomeDaSessao;
  }
  if (achado.tituloDaSessao !== undefined && (gravado['tituloDaSessao'] ?? null) !== achado.tituloDaSessao) {
    m.tituloDaSessao = achado.tituloDaSessao;
  }
  return Object.keys(m).length > 0 ? m : null;
}

/** Eventos que pedem nova leitura do nome, alem da primeira vez. */
export function eventoPedeNome(evento: string): boolean {
  return evento === 'Stop' || evento === 'UserPromptSubmit';
}
