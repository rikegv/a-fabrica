// ganchos.ts, o lado da PONTE da fila de ganchos.
//
// O QUE ESTE ARQUIVO FAZ
// ----------------------
// O gancho (ponte/ganchos/gancho.cjs) escreve uma linha num arquivo de fila local
// e morre, sem saber que existe nuvem. Este arquivo e o outro lado: a ponte le a
// fila, mascara o que tiver cara de credencial, e publica na base. Com isso, TODA
// sessao que o diretor abrir na mao, em qualquer projeto, aparece no painel sem
// ele mudar o jeito de trabalhar, que e o pedido do Bloco 1 da OST 7.
//
// AS DECISOES QUE IMPORTAM, e o porque de cada uma
// ------------------------------------------------
// 1. IDENTIDADE DA FABRICA. A fabrica aberta na mao usa o identificador da propria
//    sessao do Claude Code, com o prefixo "mao-". Prefixo de proposito: na base
//    fica obvio, de relance, o que o diretor abriu na mao e o que o painel abriu.
//    E o identificador e o da sessao, nao sorteado, para a mesma sessao reaberta
//    nao virar duas fabricas.
//
// 2. ONDE PARAMOS DE LER. Um arquivo de marcas guarda quantos bytes de cada
//    arquivo de fila ja foram publicados. Reinicio da ponte nao republica o que ja
//    subiu, e nao perde o que faltava. A marca e gravada DEPOIS da publicacao, de
//    propósito: em caso de queda no meio, o pior que acontece e um passo subir
//    duas vezes, nunca um passo desaparecer. Perder passo seria mentira na tela;
//    repetir passo e so ruido.
//
// 3. ARQUIVO CONSUMIDO E MOVIDO, NUNCA APAGADO, §A.17. Quando a sessao termina e
//    tudo dela subiu, o arquivo vai para fila-ganchos-consumida, com a data no
//    nome. A evidencia de cada sessao fica preservada.
//
// 4. MASCARA ANTES DE PUBLICAR, regra 5 do Bloco 1. Veja mascara.ts, inclusive o
//    que ela NAO promete.
//
// 5. NADA AQUI ESCUTA PORTA. Este arquivo le arquivo local e escreve na base por
//    conexao de saida, §A.6.
//
// 6. §A.19 E ESTA FILA, dito antes de alguem achar que foi esquecido. O §A.19
//    manda que "a fila de pedidos e respostas da ponte" viva dentro da pasta da
//    rodada, nunca numa pasta fixa reaproveitada. Esta fila aqui NAO e aquela: a
//    do §A.19 e a fila de PEDIDO DE APROVACAO E RESPOSTA de rodada de teste, e a
//    regra existe para uma rodada nao herdar resposta da anterior e dar prova
//    falsa. Esta e a fila de ATIVIDADE de producao, que precisa sobreviver a
//    reinicio da maquina para o painel nao perder passo.
//
//    O espirito do §A.19 continua cumprido do jeito que importa: cada sessao tem
//    o seu PROPRIO arquivo, nomeado pelo identificador dela, entao nao existe
//    heranca entre sessoes; e arquivo de sessao encerrada sai da pasta ativa e vai
//    para fila-ganchos-consumida com data e hora no nome, nunca apagado, §A.17.
//    Nenhuma sessao le o que sobrou de outra.

import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { addDoc, collection, serverTimestamp, type Firestore } from 'firebase/firestore';
import { PASTA_LOCAL } from './config.js';
import { atualizarFabrica } from './base.js';
import { mascarar } from './mascara.js';
import type { EstadoFabrica } from './tipos.js';

/**
 * Onde mora a fila de atividade. Producao: a pasta local da ponte.
 *
 * A VARIAVEL DE AMBIENTE NAO E CONFORTO, E CONSERTO DE UM DEFEITO ACHADO AO VIVO.
 * Na retomada da OST 7, as rodadas de teste contra a base real subiram pontes com
 * identificador de maquina de TESTE, e essas pontes leram esta fila, que e a de
 * PRODUCAO. Resultado: sessoes de verdade do diretor foram publicadas na base real
 * carimbadas com a maquina de teste, e apareceram no painel penduradas numa ponte
 * que depois ficou offline. O painel mostrava a sessao viva dele como se fosse de
 * outra maquina, morta.
 *
 * Com isto, rodada de teste aponta a fila para dentro da PASTA DA RODADA e nao
 * encosta mais na atividade real do diretor. O padrao continua sendo producao, que
 * e o que o servico usa.
 */
const PASTA_BASE_DA_FILA: string = ((): string => {
  const bruto = (process.env.PONTE_PASTA_FILA_GANCHOS ?? '').trim();
  return bruto.length > 0 ? bruto : PASTA_LOCAL;
})();

/**
 * Fabricas que esta ponte ja identificou sem ter visto a abertura delas.
 *
 * Existe para o conserto da fabrica fantasma nao reescrever maquina, agente e
 * projeto em toda varredura: uma vez por sessao basta. Cresce no maximo uma
 * entrada por sessao que a ponte pegou no meio, e zera quando o servico reinicia.
 */
const identificadas = new Set<string>();

export const PASTA_FILA = join(PASTA_BASE_DA_FILA, 'fila-ganchos');
export const PASTA_CONSUMIDA = join(PASTA_BASE_DA_FILA, 'fila-ganchos-consumida');
const CAMINHO_MARCAS = join(PASTA_BASE_DA_FILA, 'fila-ganchos-marcas.json');

/** Prefixo que distingue, na base, a fabrica que o diretor abriu na mao. */
export const PREFIXO_MAO = 'mao-';

/** Uma linha da fila, do jeito que o gancho escreve. Tudo opcional: fila e dado de fora. */
export interface LinhaDeGancho {
  t?: unknown;
  ev?: unknown;
  sid?: unknown;
  projeto?: unknown;
  origem?: unknown;
  ferramenta?: unknown;
  alvo?: unknown;
  descricao?: unknown;
  erro?: unknown;
  pedidoDoDiretor?: unknown;
  subagente?: unknown;
  permissao?: unknown;
  fonte?: unknown;
  motivo?: unknown;
  aviso?: unknown;
  custoMs?: unknown;
}

function texto(v: unknown): string | null {
  return typeof v === 'string' && v.length > 0 ? v : null;
}

export interface PassoPublicado {
  seq: number;
  tipo: string;
  ferramenta: string | null;
  alvo: string | null;
  descricao: string | null;
  subagente: boolean;
  inicioSubagente: boolean;
  erro: boolean;
  origem: 'mao';
  evento: string;
  /** Hora que o gancho anotou na maquina. A hora de ordenacao e a do servidor, em `em`. */
  anotadoEm: string | null;
  /** Quanto o gancho custou por dentro, em milissegundos, para medir sem instrumento de fora. */
  custoDoGanchoMs: number | null;
  /** Quais padroes de mascara pegaram algo nesta linha. Vazio quase sempre. */
  mascarou: string[];
}

/**
 * Traduz um evento de gancho no passo de atividade que o painel mostra, e no
 * estado em que a fabrica fica.
 *
 * Mapa, e ele e a regra de negocio deste bloco:
 *   SessionStart       nasce a fabrica, estado em execucao
 *   UserPromptSubmit   o diretor mandou algo, estado em execucao
 *   PostToolUse        um passo, estado em execucao
 *   SubagentStart/Stop inicio e fim de subagente
 *   Stop               a rodada acabou, estado aguardando comando
 *   SessionEnd         terminou, estado concluida, ou falhou quando o motivo diz
 *   Notification       aviso, nao muda estado
 */
export function traduzir(linha: LinhaDeGancho, seq: number): { passo: PassoPublicado; estado: EstadoFabrica | null; encerra: boolean } {
  const evento = texto(linha.ev) ?? 'desconhecido';
  const mascarou = new Set<string>();
  const limpar = (v: unknown): string | null => {
    const t = texto(v);
    if (t === null) return null;
    const r = mascarar(t);
    for (const p of r.pegou) mascarou.add(p);
    return r.texto;
  };

  const ferramenta = texto(linha.ferramenta);
  const alvo = limpar(linha.alvo);
  const pedido = limpar(linha.pedidoDoDiretor);
  const aviso = limpar(linha.aviso);
  const motivo = limpar(linha.motivo);
  const subagente = texto(linha.subagente);

  let tipo = 'passo';
  let estado: EstadoFabrica | null = 'em execucao';
  let encerra = false;
  let descricao = limpar(linha.descricao);

  switch (evento) {
    case 'SessionStart':
      tipo = 'init';
      descricao = `sessao aberta na mao pelo diretor${texto(linha.fonte) ? `, origem ${texto(linha.fonte)}` : ''}`;
      break;
    case 'UserPromptSubmit':
      tipo = 'comando do diretor';
      descricao = pedido;
      break;
    case 'PostToolUse':
      tipo = 'ferramenta';
      break;
    case 'SubagentStart':
      tipo = 'subagente';
      descricao = `subagente ${subagente ?? 'sem nome'} comecou`;
      break;
    case 'SubagentStop':
      tipo = 'subagente';
      descricao = `subagente ${subagente ?? 'sem nome'} terminou`;
      break;
    case 'Stop':
      tipo = 'fim de rodada';
      estado = 'aguardando comando';
      break;
    case 'SessionEnd':
      tipo = 'fim';
      // Honestidade de estado: so vira falhou quando o motivo diz que falhou.
      // Sessao que o diretor fechou na mao nao e falha.
      estado = motivo !== null && /error|fail|crash|falh/i.test(motivo) ? 'falhou' : 'concluida';
      descricao = motivo !== null ? `sessao encerrada, motivo ${motivo}` : 'sessao encerrada';
      encerra = true;
      break;
    case 'Notification':
      tipo = 'aviso';
      estado = null;
      descricao = aviso;
      break;
    default:
      tipo = 'passo';
      break;
  }

  return {
    passo: {
      seq,
      tipo,
      ferramenta,
      alvo,
      descricao,
      subagente: evento === 'SubagentStart' || evento === 'SubagentStop',
      inicioSubagente: evento === 'SubagentStart',
      erro: linha.erro === true,
      origem: 'mao',
      evento,
      anotadoEm: texto(linha.t),
      custoDoGanchoMs: typeof linha.custoMs === 'number' ? linha.custoMs : null,
      mascarou: [...mascarou],
    },
    estado,
    encerra,
  };
}

interface Marcas {
  versao: 1;
  /** Nome do arquivo de fila, para bytes ja publicados e proxima sequencia. */
  arquivos: Record<string, { bytes: number; seq: number }>;
}

function lerMarcas(): Marcas {
  if (!existsSync(CAMINHO_MARCAS)) return { versao: 1, arquivos: {} };
  try {
    const j: unknown = JSON.parse(readFileSync(CAMINHO_MARCAS, 'utf8'));
    const a = typeof j === 'object' && j !== null ? (j as Record<string, unknown>)['arquivos'] : null;
    if (typeof a === 'object' && a !== null) {
      return { versao: 1, arquivos: a as Record<string, { bytes: number; seq: number }> };
    }
  } catch {
    // Marca ilegivel vale como marca ausente. Pior caso: republica o que ja subiu.
  }
  return { versao: 1, arquivos: {} };
}

function gravarMarcas(m: Marcas): void {
  const temporario = `${CAMINHO_MARCAS}.novo`;
  writeFileSync(temporario, JSON.stringify(m, null, 2), { encoding: 'utf8', mode: 0o600 });
  renameSync(temporario, CAMINHO_MARCAS);
}

export interface ResultadoDaVarredura {
  arquivosVistos: number;
  passosPublicados: number;
  sessoesNovas: number;
  sessoesEncerradas: number;
  linhasIlegiveis: number;
  mascaradas: number;
  erros: string[];
}

/**
 * Uma passada na fila: le o que chegou de novo, mascara, publica, marca.
 *
 * Nunca lanca. Erro de publicacao de uma sessao nao derruba as outras, e nao move
 * a marca daquele arquivo, entao a proxima passada tenta de novo. Isso vale porque
 * a ponte tem de aguentar a base cair no meio.
 */
export async function varrerFila(
  db: Firestore,
  maquinaId: string,
  registrar: (linha: string) => void = () => undefined
): Promise<ResultadoDaVarredura> {
  const r: ResultadoDaVarredura = {
    arquivosVistos: 0,
    passosPublicados: 0,
    sessoesNovas: 0,
    sessoesEncerradas: 0,
    linhasIlegiveis: 0,
    mascaradas: 0,
    erros: [],
  };
  if (!existsSync(PASTA_FILA)) return r;

  const marcas = lerMarcas();
  let arquivos: string[] = [];
  try {
    arquivos = readdirSync(PASTA_FILA).filter((n) => n.endsWith('.jsonl'));
  } catch (e) {
    r.erros.push(`nao deu para listar a fila: ${e instanceof Error ? e.message : String(e)}`);
    return r;
  }

  for (const nome of arquivos) {
    const caminho = join(PASTA_FILA, nome);
    r.arquivosVistos++;
    const marca = marcas.arquivos[nome] ?? { bytes: 0, seq: 0 };
    let tamanho = 0;
    try {
      tamanho = statSync(caminho).size;
    } catch {
      continue;
    }
    if (tamanho <= marca.bytes) continue;

    let bruto = '';
    try {
      bruto = readFileSync(caminho, 'utf8').slice(marca.bytes);
    } catch (e) {
      r.erros.push(`nao deu para ler ${nome}: ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }
    // A ultima linha pode estar pela metade, porque o gancho pode ter escrito no
    // meio desta leitura. So linha terminada em quebra conta.
    const ultimaQuebra = bruto.lastIndexOf('\n');
    if (ultimaQuebra < 0) continue;
    const completo = bruto.slice(0, ultimaQuebra + 1);
    const linhas = completo.split('\n').filter((l) => l.trim().length > 0);

    let seq = marca.seq;
    let encerrou = false;
    let falhouNesteArquivo = false;
    // Bytes publicados com sucesso. Cresce linha por linha, DEPOIS da publicacao,
    // para queda no meio nunca marcar como lido o que nao subiu.
    let bytesOk = marca.bytes;

    for (const cru of linhas) {
      const bytesDestaLinha = Buffer.byteLength(`${cru}\n`, 'utf8');
      let linha: LinhaDeGancho;
      try {
        linha = JSON.parse(cru) as LinhaDeGancho;
      } catch {
        // Linha ilegivel nao trava a fila: conta como vista e segue.
        r.linhasIlegiveis++;
        bytesOk += bytesDestaLinha;
        continue;
      }
      const sid = texto(linha.sid);
      if (sid === null) {
        r.linhasIlegiveis++;
        bytesOk += bytesDestaLinha;
        continue;
      }
      const fabricaId = `${PREFIXO_MAO}${sid}`;
      const { passo, estado, encerra } = traduzir(linha, seq);
      if (passo.mascarou.length > 0) r.mascaradas++;

      try {
        const projeto = texto(linha.projeto);
        if (passo.tipo === 'init') {
          await atualizarFabrica(db, fabricaId, {
            maquinaId,
            estado: 'em execucao',
            agente: 'claude code',
            inicio: texto(linha.t) ?? new Date().toISOString(),
            ...(projeto !== null ? { projeto } : {}),
          });
          r.sessoesNovas++;
        } else if (!identificadas.has(fabricaId)) {
          // FABRICA FANTASMA, conserto de defeito achado ao vivo na OST 7.
          //
          // A ponte so escrevia maquina, agente e projeto no evento de abertura.
          // Quando ela sobe com a sessao do diretor JA no meio do caminho, aquele
          // evento ficou na fila antes dela existir, ou ja tinha sido consumido, e
          // a fabrica nascia da primeira atividade: sem maquina, sem agente, sem
          // projeto, e presa em execucao. No painel isso e uma linha muda, que nao
          // diz de onde veio e nunca fecha.
          //
          // O gancho escreve o projeto em TODA linha, nao so na abertura, entao a
          // informacao estava ali o tempo todo e era so usar. Merge, nunca
          // sobrescrita: se a abertura chegar depois, ela e quem manda.
          await atualizarFabrica(db, fabricaId, {
            maquinaId,
            agente: 'claude code',
            ...(projeto !== null ? { projeto } : {}),
          });
          identificadas.add(fabricaId);
        }
        await addDoc(collection(db, 'fabricas', fabricaId, 'atividade'), { ...passo, em: serverTimestamp() });
        if (estado !== null) await atualizarFabrica(db, fabricaId, { estado });
        r.passosPublicados++;
        seq++;
        bytesOk += bytesDestaLinha;
        if (encerra) encerrou = true;
      } catch (e) {
        // Falha de rede ou de regra: para neste arquivo, nao move a marca, tenta
        // na proxima passada. Nada e perdido.
        r.erros.push(`fabrica ${fabricaId}, passo ${seq}: ${e instanceof Error ? e.message : String(e)}`);
        falhouNesteArquivo = true;
        break;
      }
    }

    // A marca so avanca pelo que de fato subiu.
    marcas.arquivos[nome] = { bytes: bytesOk, seq };

    if (encerrou && !falhouNesteArquivo) {
      // §A.17: movido com data e hora no nome, nunca apagado.
      try {
        mkdirSync(PASTA_CONSUMIDA, { recursive: true });
        const selo = new Date().toISOString().replace(/[:.]/g, '-');
        renameSync(caminho, join(PASTA_CONSUMIDA, `${selo}-${nome}`));
        delete marcas.arquivos[nome];
        r.sessoesEncerradas++;
      } catch (e) {
        r.erros.push(`nao deu para arquivar ${nome}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  try {
    gravarMarcas(marcas);
  } catch (e) {
    r.erros.push(`nao deu para gravar as marcas: ${e instanceof Error ? e.message : String(e)}`);
  }

  if (r.passosPublicados > 0 || r.erros.length > 0) {
    registrar(
      `fila de ganchos: ${r.passosPublicados} passo(s) publicado(s), ${r.sessoesNovas} sessao(oes) nova(s), ` +
        `${r.sessoesEncerradas} encerrada(s), ${r.mascaradas} linha(s) com mascara, ${r.linhasIlegiveis} ilegivel(is)` +
        (r.erros.length > 0 ? `, ${r.erros.length} erro(s): ${r.erros[0]}` : '')
    );
  }
  return r;
}

const CAMINHO_TRAVA = join(PASTA_LOCAL, 'fila-ganchos.lock');

/**
 * Dono da fila DENTRO deste processo.
 *
 * Por que isto existe separado da trava em arquivo, e foi a prova que cobrou: a
 * trava em arquivo guarda o identificador do processo dono, e por isso ela nao
 * barra o PROPRIO processo pedindo de novo. Isso e proposital para a trava velha
 * de um processo que morreu poder ser retomada, mas deixava passar o caso de
 * alguem ligar dois publicadores no mesmo processo, que e erro de programacao e
 * publicaria em dobro do mesmo jeito.
 *
 * Com os dois juntos: este sinalizador barra dentro do processo, a trava em
 * arquivo barra entre processos.
 */
let donoNesteProcesso = false;

/**
 * Trava de processo único do publicador.
 *
 * POR QUE EXISTE, e o achado que a criou: na própria OST 7, duas provas rodaram
 * ao mesmo tempo na máquina e as duas tinham publicador ligado sobre a MESMA
 * fila. O resultado foi uma prova mentindo: ela publicou, a contagem dela deu
 * zero, e os passos apareceram na base pela mão do outro processo. Ninguém
 * perdeu passo, porque a marca de bytes é por arquivo, mas dois publicadores
 * sobre a mesma marca podem publicar o mesmo passo duas vezes, e a trilha não se
 * apaga.
 *
 * Isso não é caso de laboratório: na máquina do diretor a ponte sobe por tarefa
 * agendada, e nada impede ele de rodar uma segunda à mão.
 *
 * Trava de processo morto não prende a fila: se o dono anotado não existe mais,
 * a trava é velha e pode ser tomada. Mesma técnica da trava por fábrica.
 */
function tomarTravaDaFila(): (() => void) | null {
  if (donoNesteProcesso) return null;
  mkdirSync(PASTA_LOCAL, { recursive: true });
  const soltar = (fd: number) => (): void => {
    donoNesteProcesso = false;
    try {
      closeSync(fd);
    } catch {
      // ja fechado
    }
    try {
      // Caminho nomeado, arquivo por arquivo, §A.18. Trava nao e evidencia.
      unlinkSync(CAMINHO_TRAVA);
    } catch {
      // ja removida
    }
  };
  const tomar = (modo: 'wx' | 'w'): (() => void) | null => {
    try {
      const fd = openSync(CAMINHO_TRAVA, modo);
      writeFileSync(CAMINHO_TRAVA, String(process.pid), 'utf8');
      donoNesteProcesso = true;
      return soltar(fd);
    } catch {
      return null;
    }
  };
  const primeira = tomar('wx');
  if (primeira) return primeira;

  let dono = 0;
  try {
    dono = Number(readFileSync(CAMINHO_TRAVA, 'utf8').trim());
  } catch {
    dono = 0;
  }
  if (dono > 0 && dono !== process.pid) {
    try {
      process.kill(dono, 0);
      return null; // dono vivo, este processo nao publica
    } catch {
      // dono morto, a trava e velha
    }
  }
  return tomar('w');
}

export interface Publicador {
  parar(): void;
  /** Força uma passada agora, para prova e para o fechamento limpo. */
  agora(): Promise<ResultadoDaVarredura>;
  /** Falso quando outro processo já é o dono da fila. Nada é publicado por este. */
  ativo: boolean;
}

/**
 * Liga o publicador da fila de ganchos, em laco de tempo.
 *
 * Laco de tempo e nao vigia de pasta de propósito: vigia de pasta no Windows
 * perde evento quando muita escrita acontece junto, e aqui perder evento e perder
 * passo na tela do diretor. Uma passada a cada segundo e meio e barata e nao
 * perde nada, porque a marca de bytes diz exatamente onde paramos.
 */
export function iniciarPublicadorDeGanchos(
  db: Firestore,
  maquinaId: string,
  opcoes: { intervaloMs?: number; registrar?: (l: string) => void } = {}
): Publicador {
  const intervalo = opcoes.intervaloMs ?? 1500;
  const registrar = opcoes.registrar ?? ((): void => undefined);
  let rodando = false;
  let parado = false;

  const soltarTrava = tomarTravaDaFila();
  const vazia: ResultadoDaVarredura = {
    arquivosVistos: 0,
    passosPublicados: 0,
    sessoesNovas: 0,
    sessoesEncerradas: 0,
    linhasIlegiveis: 0,
    mascaradas: 0,
    erros: [],
  };
  if (!soltarTrava) {
    // Falha fechada e falante: nao publica, e diz por que, em vez de publicar em
    // dobro em silencio.
    registrar(
      'fila de ganchos: OUTRO processo da ponte ja e o dono desta fila nesta maquina, ' +
        'entao este nao publica nada. Isso evita o mesmo passo subir duas vezes.'
    );
    return { parar: (): void => undefined, agora: async (): Promise<ResultadoDaVarredura> => vazia, ativo: false };
  }

  const passada = async (): Promise<ResultadoDaVarredura> => {
    if (rodando) return vazia;
    rodando = true;
    try {
      return await varrerFila(db, maquinaId, registrar);
    } catch (e) {
      registrar(`fila de ganchos, erro inesperado na passada: ${e instanceof Error ? e.message : String(e)}`);
      return vazia;
    } finally {
      rodando = false;
    }
  };

  const relogio = setInterval(() => {
    if (!parado) void passada();
  }, intervalo);
  // Nao prende o encerramento do processo por causa deste relogio.
  relogio.unref?.();

  return {
    parar: (): void => {
      parado = true;
      clearInterval(relogio);
      soltarTrava();
    },
    agora: passada,
    ativo: true,
  };
}
