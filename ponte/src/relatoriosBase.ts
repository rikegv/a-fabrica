// relatoriosBase.ts, OST 13: a ponte grava fechamento e diario em `relatorios`.
//
// A parte pura (criterio, dia de Brasilia, montagem) mora em relatorios.ts. Aqui
// fica o que fala com a base e com o disco, com as condicoes da seguranca:
//   1. Ler antes de criar. Documento que ja existe nao e reescrito, e a negacao de
//      permissao por documento ja existente conta como "ja gravado".
//   2. Falha de base LANCA, para quem chama nao mover a marca da fila. So depois
//      de o relatorio existir na base a marca anda.
//   3. Texto so passa pela memoria, mascarado antes de gravar. Mensagem de erro e
//      registro nunca levam trecho do texto.
//
// §A.6: so conexao de saida. Nada aqui escuta porta.

import { caminhoComparavel, prefixoDaPasta, casaDoDiretor, usuarioDasFabricas } from './plataforma.js';
import { lerTextoDoFechamentoDaSessao } from './leitorDoDiretor.js';
import { join } from 'node:path';
import { collection, doc, getDoc, getDocs, query, serverTimestamp, setDoc, where, type Firestore } from 'firebase/firestore';
import { PASTA_DOS_GANCHOS, lerTexto } from './config.js';
import { mascarar } from './mascara.js';
import {
  avaliarFechamento,
  diaDeBrasilia,
  diariosAFazer,
  ehFimDaSessaoPrincipal,
  idDoFechamento,
  livroDaPonte,
  marcarLivroSujo,
  montarDiario,
  podarLivro,
  salvarLivro,
  type GrupoDoCriterio,
} from './relatorios.js';
import { SUFIXO_DE_CORTE, caminhoDeTranscricaoAceito, lerTextoDoFechamento } from './transcricao.js';

export type SaidaDaGravacao = 'gravado' | 'ja existia';

/**
 * Cria `relatorios/{id}` uma vez. Lanca em falha de verdade, para a fila nao
 * andar sem o relatorio.
 */
export async function gravarRelatorio(db: Firestore, id: string, dados: Record<string, unknown>): Promise<SaidaDaGravacao> {
  const ref = doc(db, 'relatorios', id);
  if ((await getDoc(ref)).exists()) return 'ja existia';
  try {
    await setDoc(ref, { ...dados, id, versao: 1, criadoEm: serverTimestamp() });
    return 'gravado';
  } catch (e) {
    // A regra nega update: se outra passada criou no meio, isto e "ja gravado".
    try {
      if ((await getDoc(ref)).exists()) return 'ja existia';
    } catch {
      // segue para o erro original
    }
    throw e;
  }
}

interface FabricaLida {
  projeto: string | null;
  nome: string | null;
  agente: string | null;
  consumoPorDia: Record<string, Record<string, number>>;
}

async function lerFabrica(db: Firestore, fabricaId: string): Promise<FabricaLida> {
  const d = await getDoc(doc(db, 'fabricas', fabricaId));
  const f = (d.exists() ? d.data() : {}) as Record<string, unknown>;
  const txt = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null);
  const cpd = f['consumoPorDia'];
  return {
    projeto: txt(f['projeto']),
    nome: txt(f['nome']),
    agente: txt(f['agente']),
    consumoPorDia: typeof cpd === 'object' && cpd !== null ? (cpd as Record<string, Record<string, number>>) : {},
  };
}

function comparavel(c: string): string {
  // Windows: minusculo e barra invertida. Linux, OST 14: como veio, porque la
  // maiuscula conta. Veja plataforma.ts.
  return caminhoComparavel(c);
}

/**
 * Condicao c: o projeto esta em projetosIgnorados, relido do ganchos.json AGORA,
 * por fronteira de caminho? Falha fechada: arquivo ausente ou ilegivel vale como
 * ignorado, e nenhum relatorio sai.
 */
export function projetoIgnorado(projetos: Array<string | null>, pastaLocal = PASTA_DOS_GANCHOS): boolean {
  let lista: unknown;
  try {
    lista = (JSON.parse(lerTexto(join(pastaLocal, 'ganchos.json'))) as Record<string, unknown>)['projetosIgnorados'];
  } catch {
    return true;
  }
  if (lista === undefined) return false;
  if (!Array.isArray(lista)) return true;
  for (const p of projetos) {
    if (p === null) continue;
    const c = comparavel(p);
    for (const alvo of lista) {
      if (typeof alvo !== 'string' || alvo.length === 0) continue;
      const a = comparavel(alvo);
      if (c === a || c.startsWith(prefixoDaPasta(a))) return true;
    }
  }
  return false;
}

export interface FimDeRodadaDaMao {
  fabricaId: string;
  maquinaId: string;
  sid: string;
  evento: string;
  subagente: string | null;
  /** O valor CRU de `conteudo` da linha. So `true` exato conta. */
  conteudo: unknown;
  resposta: string | null;
  /** Hora t da linha Stop. */
  t: string;
  transcricao: string | null;
  projetoDaLinha: string | null;
  rodadaInicio: string | null;
}

/**
 * O texto do fim da rodada na fabrica aberta na mao. Sem base: a prova chama
 * direto, com um leitor de mentira, para ver que resposta sem corte nem abre a
 * transcricao. Quem chama ja conferiu Stop, conteudo === true e subagente.
 */
export function textoDoFimDaMao(
  resposta: string,
  transcricao: string | null,
  sid: string,
  t: string,
  casa: string,
  ler: typeof lerTextoDoFechamento = lerTextoDoFechamento
): { texto: string; fonte: 'transcricao' | 'gancho'; cortado: boolean } {
  // Resposta sem corte: o texto do gancho ja e inteiro, e a transcricao nem abre.
  if (!resposta.endsWith(SUFIXO_DE_CORTE)) return { texto: resposta, fonte: 'gancho', cortado: false };
  const trecho = resposta.slice(0, -SUFIXO_DE_CORTE.length);
  // Caminho fora da regra (condicao b): nao abre, e grava o do gancho, cortado.
  if (transcricao === null || !caminhoDeTranscricaoAceito(transcricao, sid, casa)) {
    return { texto: trecho, fonte: 'gancho', cortado: true };
  }
  const achado = ler(transcricao, trecho, t);
  if (achado.texto === null) return { texto: trecho, fonte: 'gancho', cortado: true };
  return { texto: achado.texto, fonte: 'transcricao', cortado: achado.cortado };
}

/**
 * Fechamento da fabrica aberta na mao. Devolve um motivo curto para o registro,
 * sem texto. Lanca so em falha de base.
 */
export async function fechamentoDaMao(db: Firestore, e: FimDeRodadaDaMao, casa = casaDoDiretor()): Promise<string> {
  if (e.evento !== 'Stop') return 'nao e Stop';
  // §A.23 e condicao da seguranca: sem conteudo === true, nao existe fechamento.
  if (e.conteudo !== true) return 'sem conteudo liberado';
  if (e.resposta === null || e.resposta.length === 0) return 'sem resposta';
  const fab = await lerFabrica(db, e.fabricaId);
  if (!ehFimDaSessaoPrincipal(e.evento, e.subagente, fab.agente)) return 'linha de subagente';
  if (projetoIgnorado([e.projetoDaLinha, fab.projeto])) return 'projeto ignorado ou lista ilegivel';

  // Linux, OST 14: a transcricao e lida como o diretor, antes, e o resultado entra
  // pelo mesmo leitor injetavel. As condicoes continuam todas em textoDoFimDaMao.
  let ler: typeof lerTextoDoFechamento = lerTextoDoFechamento;
  if (usuarioDasFabricas() !== null && e.resposta.endsWith(SUFIXO_DE_CORTE) && e.transcricao !== null) {
    const achado = caminhoDeTranscricaoAceito(e.transcricao, e.sid, casa)
      ? await lerTextoDoFechamentoDaSessao(e.transcricao, e.resposta.slice(0, -SUFIXO_DE_CORTE.length), e.t)
      : null;
    ler = () => achado ?? { texto: null, cortado: false, motivo: 'caminho fora da regra' };
  }
  const { texto, fonte, cortado } = textoDoFimDaMao(e.resposta, e.transcricao, e.sid, e.t, casa, ler);
  const v = avaliarFechamento(texto);
  if (!v.fechamento) return `nao e fechamento, ${v.motivo}`;
  const id = idDoFechamento(e.fabricaId, e.sid, e.t);
  const saida = await gravarRelatorio(db, id, {
    tipo: 'fechamento',
    fabricaId: e.fabricaId,
    maquinaId: e.maquinaId,
    projeto: fab.projeto ?? e.projetoDaLinha,
    titulo: fab.nome,
    texto: mascarar(texto).texto,
    rodadaInicio: e.rodadaInicio,
    rodadaFim: e.t,
    dia: diaDeBrasilia(e.t),
    origem: 'mao',
    fonteDoTexto: fonte,
    cortado,
    marcas: v.marcas,
  });
  return `fechamento ${id} ${saida}, fonte ${fonte}${cortado ? ', cortado' : ''}`;
}

export interface FimDeRodadaDoPainel {
  fabricaId: string;
  maquinaId: string;
  /** Sessao do kit (conversa), ou o id da fabrica quando o kit nao deu. */
  sessao: string;
  /** Resultado final do agente principal, pelo kit. */
  texto: string;
  inicio: string | null;
  fim: string;
  cwd: string;
}

/** Fechamento da fabrica aberta pelo painel. O texto vem inteiro do kit. */
export async function fechamentoDoPainel(
  db: Firestore,
  e: FimDeRodadaDoPainel,
  pastaLocal: string = PASTA_DOS_GANCHOS
): Promise<string> {
  const v = avaliarFechamento(e.texto);
  if (!v.fechamento) return `nao e fechamento, ${v.motivo}`;
  // Ressalva da seguranca: a fabrica do painel tambem respeita projetosIgnorados,
  // com a mesma funcao e a mesma falha fechada. Primeiro pelo cwd, antes de
  // tocar a base; depois pelo projeto gravado na fabrica.
  if (projetoIgnorado([e.cwd], pastaLocal)) return 'projeto ignorado ou lista ilegivel';
  const fab = await lerFabrica(db, e.fabricaId);
  if (projetoIgnorado([fab.projeto], pastaLocal)) return 'projeto ignorado ou lista ilegivel';
  const id = idDoFechamento(e.fabricaId, e.sessao, e.fim);
  const marcas: GrupoDoCriterio[] = v.marcas;
  const saida = await gravarRelatorio(db, id, {
    tipo: 'fechamento',
    fabricaId: e.fabricaId,
    maquinaId: e.maquinaId,
    projeto: fab.projeto ?? e.cwd,
    titulo: fab.nome,
    texto: mascarar(e.texto).texto,
    rodadaInicio: e.inicio,
    rodadaFim: e.fim,
    dia: diaDeBrasilia(e.fim),
    origem: 'painel',
    fonteDoTexto: 'kit',
    cortado: false,
    marcas,
  });
  return `fechamento ${id} ${saida}, fonte kit`;
}

/**
 * Uma passada do diario. Gera o que estiver devido para "agora" e devolve
 * quantos gravou. Erro de uma fabrica nao impede as outras, e o diario que falhou
 * fica para a proxima passada.
 */
export async function passadaDoDiario(
  db: Firestore,
  maquinaId: string,
  agora: Date,
  registrar: (l: string) => void
): Promise<number> {
  const livro = livroDaPonte();
  podarLivro(livro, agora);
  let n = 0;
  for (const a of diariosAFazer(livro, agora)) {
    try {
      const fab = await lerFabrica(db, a.fabricaId);
      const docs = await getDocs(query(collection(db, 'relatorios'), where('fabricaId', '==', a.fabricaId)));
      const fechamentos = docs.docs
        .map((d) => d.data() as Record<string, unknown>)
        // Pela JANELA do diario, nao pelo dia do calendario: montarDiario filtra
        // pela hora do fim da rodada. Aqui so tira o que nao e fechamento.
        .filter((r) => r['tipo'] === 'fechamento' && typeof r['texto'] === 'string')
        .map((r) => ({
          relatorioId: String(r['id'] ?? ''),
          rodadaFim: String(r['rodadaFim'] ?? ''),
          texto: String(r['texto']),
        }));
      const consumo = fab.consumoPorDia[a.dia];
      const montado = montarDiario({
        fabricaId: a.fabricaId,
        maquinaId,
        dia: a.dia,
        projeto: fab.projeto,
        titulo: fab.nome,
        fechamentos,
        rodadas: livro.fabricas[a.fabricaId]?.[a.dia]?.rodadas ?? [],
        consumoDoDia: consumo !== undefined && Object.keys(consumo).length > 0 ? consumo : null,
        geradoAtrasado: a.geradoAtrasado,
        parcialDesde: a.parcialDesde,
        agora,
      });
      const { id, ...dados } = montado;
      const saida = await gravarRelatorio(db, id, dados);
      livro.gerados[id] = agora.toISOString();
      marcarLivroSujo();
      if (saida === 'gravado') n++;
      registrar(`diario ${id}: ${saida}${montado.cortado ? ', cortado pelo teto' : ''}`);
    } catch (e) {
      registrar(`diario de ${a.fabricaId} em ${a.dia} nao saiu agora, fica para a proxima passada (${e instanceof Error ? e.message.slice(0, 160) : 'erro'})`);
    }
  }
  try {
    marcarLivroSujo();
    salvarLivro();
  } catch {
    registrar('livro do dia nao foi gravado agora');
  }
  return n;
}

/** Liga o diario em laco de um minuto, e roda uma passada logo na subida (maquina que acordou). */
export function iniciarDiario(db: Firestore, maquinaId: string, registrar: (l: string) => void): { parar(): void } {
  let rodando = false;
  const passada = (): void => {
    if (rodando) return;
    rodando = true;
    void passadaDoDiario(db, maquinaId, new Date(), registrar)
      .catch(() => 0)
      .finally(() => {
        rodando = false;
      });
  };
  const primeira = setTimeout(passada, 20000);
  const t = setInterval(passada, 60000);
  primeira.unref?.();
  t.unref?.();
  return {
    parar: (): void => {
      clearTimeout(primeira);
      clearInterval(t);
    },
  };
}
