// relatorios.ts, OST 13: fechamento por rodada e diario por dia, a parte PURA.
//
// Tudo aqui e funcao pura ou quase (o livro do dia grava um arquivo local so de
// METADADO: dia, contagem de passos e horas das rodadas). Nada aqui fala com a
// base; quem grava e relatoriosBase.ts. Separado assim para a prova cobrir o
// criterio, o dia de Brasilia e a montagem do diario sem esperar o relogio.
//
// O contrato e docs/ost13-contrato.md, com as condicoes da seguranca passadas
// pelo coordenador na mesma OST (id do fechamento sem o texto, teto de 1 MiB no
// diario, conferencia exata da transcricao).

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { PASTA_LOCAL } from './config.js';

// ---------------------------------------------------------------------------
// Relogio de Brasilia
// ---------------------------------------------------------------------------

/** Brasilia, UTC menos 3, fixo. O Brasil nao tem horario de verao desde 2019. */
export const FUSO_BRASILIA_MINUTOS = -180;
/** Hora do diario, no relogio de Brasilia. */
export const HORA_DO_DIARIO = { hora: 20, minuto: 0 } as const;
/** Ate quantos dias para tras a ponte gera diario que ficou para tras. */
export const DIAS_DE_ATRASO_ACEITOS = 7;

function emBrasilia(quando: Date): Date {
  return new Date(quando.getTime() + FUSO_BRASILIA_MINUTOS * 60000);
}

function p2(n: number): string {
  return String(n).padStart(2, '0');
}

/** AAAA-MM-DD do calendario de Brasilia. Hora ilegivel devolve null. */
export function diaDeBrasilia(quando: Date | string): string | null {
  const d = typeof quando === 'string' ? new Date(quando) : quando;
  if (!Number.isFinite(d.getTime())) return null;
  const b = emBrasilia(d);
  return `${b.getUTCFullYear()}-${p2(b.getUTCMonth() + 1)}-${p2(b.getUTCDate())}`;
}

/** "24/11/2026 as 20:03", no relogio de Brasilia. */
export function horaDeBrasiliaPorExtenso(quando: Date | string): string {
  const d = typeof quando === 'string' ? new Date(quando) : quando;
  if (!Number.isFinite(d.getTime())) return 'hora desconhecida';
  const b = emBrasilia(d);
  return `${p2(b.getUTCDate())}/${p2(b.getUTCMonth() + 1)}/${b.getUTCFullYear()} às ${p2(b.getUTCHours())}:${p2(b.getUTCMinutes())}`;
}

function horaCurta(quando: string): string {
  const d = new Date(quando);
  if (!Number.isFinite(d.getTime())) return 'hora desconhecida';
  const b = emBrasilia(d);
  return `${p2(b.getUTCHours())}:${p2(b.getUTCMinutes())}`;
}

/**
 * JANELA DO DIARIO, decisao do coordenador na OST 13: o diario do dia D cobre de
 * 20h00 de D-1 ate 20h00 de D, horario de Brasilia, e e gerado logo depois das
 * 20h00 de D. O diretor trabalha a noite, e assim o que acontece depois das 20h
 * entra no diario seguinte em vez de ficar de fora. Rodadas, tempo, passos e
 * consumoPorDia usam a MESMA janela.
 *
 * O dia D da janela que contem o instante: e o dia de Brasilia do instante
 * adiantado de 24h menos a hora do diario (4h, com o diario as 20h00).
 */
export function diaDaJanela(quando: Date | string): string | null {
  const d = typeof quando === 'string' ? new Date(quando) : quando;
  if (!Number.isFinite(d.getTime())) return null;
  const avanco = (24 * 60 - (HORA_DO_DIARIO.hora * 60 + HORA_DO_DIARIO.minuto)) * 60000;
  return diaDeBrasilia(new Date(d.getTime() + avanco));
}

/** Inicio e fim, em ISO, da janela do diario do dia D. Fim exclusivo. */
export function janelaDoDia(dia: string): { inicio: string; fim: string } {
  const hm = `${p2(HORA_DO_DIARIO.hora)}:${p2(HORA_DO_DIARIO.minuto)}:00`;
  const fuso = `-${p2(Math.abs(FUSO_BRASILIA_MINUTOS) / 60)}:00`;
  const fim = new Date(`${dia}T${hm}${fuso}`);
  const inicio = new Date(fim.getTime() - 24 * 3600000);
  return { inicio: inicio.toISOString(), fim: fim.toISOString() };
}

/** "23/11 às 20h00", para a janela por extenso. */
function horaDaJanelaPorExtenso(iso: string): string {
  const b = emBrasilia(new Date(iso));
  return `${p2(b.getUTCDate())}/${p2(b.getUTCMonth() + 1)} às ${p2(b.getUTCHours())}h${p2(b.getUTCMinutes())}`;
}

/** O dia do calendario somado de n dias, em AAAA-MM-DD. */
export function somarDias(dia: string, n: number): string {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`;
}

function diaPorExtenso(dia: string): string {
  const [a, m, d] = dia.split('-');
  return `${d}/${m}/${a}`;
}

// ---------------------------------------------------------------------------
// Criterio do fechamento, item 13 do contrato
// ---------------------------------------------------------------------------

export type GrupoDoCriterio = 'FEITO' | 'FALTA' | 'PEDIDO' | 'DECISOES' | 'ARQUIVOS' | 'PROBLEMAS' | 'PROXIMO' | 'QUEM';

/**
 * Os titulos de cada grupo, ja sem acento e em minusculo. A ordem importa so
 * dentro de cada grupo: o mais longo primeiro, para "decisoes tomadas" ganhar de
 * "decisoes".
 *
 * Decisao da ponte, dita no relatorio: "decisoes tomadas durante a execucao" e
 * "proximo passo recomendado" entram como forma longa, porque sao exatamente os
 * titulos do §A.16. Sem isso, o fechamento escrito no formato do proprio §A.16
 * perderia dois grupos, ja que o contrato pede o titulo seguido de pontuacao.
 */
const TITULOS: Record<GrupoDoCriterio, string[]> = {
  FEITO: ['o que foi feito'],
  FALTA: ['o que ficou faltando', 'o que ficou pendente', 'o que falta', 'pendencias'],
  PEDIDO: ['o que foi solicitado', 'o que foi pedido'],
  DECISOES: ['decisoes tomadas durante a execucao', 'decisoes tomadas', 'decisoes que tomei', 'decisoes'],
  ARQUIVOS: ['arquivos e areas alteradas', 'arquivos alterados'],
  PROBLEMAS: ['problemas encontrados'],
  PROXIMO: ['proximo passo recomendado', 'proximo passo'],
  QUEM: ['quem trabalhou', 'quem fez o que', 'quem fez'],
};

const GRUPOS = Object.keys(TITULOS) as GrupoDoCriterio[];

/** Minusculo e sem acento. Nao muda o comprimento de letra comum do portugues. */
function normalizar(t: string): string {
  return t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

function escapar(t: string): string {
  return t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Um titulo no COMECO da linha: com ou sem "#", "**" ou numero na frente, e
 * seguido de ":", ".", "**" ou fim de linha. Linha ja normalizada.
 * Grupo 1 e o titulo achado; o fim do casamento e onde comeca o corpo.
 */
const REGRA_DE_TITULO = new RegExp(
  '^\\s*(?:#{1,6}\\s*)?(?:\\d{1,2}[.)]\\s*)?(?:\\*\\*|__)?\\s*(?:\\d{1,2}[.)]\\s*)?(' +
    GRUPOS.flatMap((g) => TITULOS[g])
      .sort((a, b) => b.length - a.length)
      .map(escapar)
      .join('|') +
    ')\\s*(?:\\*\\*|__|[:.?]|$)'
);

function grupoDoTitulo(titulo: string): GrupoDoCriterio | null {
  for (const g of GRUPOS) if (TITULOS[g].includes(titulo)) return g;
  return null;
}

/** O titulo desta linha, se a linha e titulo de algum grupo. */
export function tituloDaLinha(linha: string): { grupo: GrupoDoCriterio; fimDoTitulo: number } | null {
  const m = REGRA_DE_TITULO.exec(normalizar(linha));
  if (m === null || m[1] === undefined) return null;
  const grupo = grupoDoTitulo(m[1]);
  return grupo === null ? null : { grupo, fimDoTitulo: m[0].length };
}

export interface VereditoDoCriterio {
  fechamento: boolean;
  marcas: GrupoDoCriterio[];
  motivo: string;
}

/**
 * Aplica o criterio ao TEXTO. Quem chama garante a parte 1 do criterio (e o fim
 * de rodada da sessao principal); aqui valem as partes 2, 3 e 4.
 */
export function avaliarFechamento(texto: string): VereditoDoCriterio {
  // Parte 2, condicao da seguranca: a exclusao vale para o texto INTEIRO.
  if (/<task-notification[\s>]|<system-reminder[\s>]/i.test(texto)) {
    return { fechamento: false, marcas: [], motivo: 'aviso automatico' };
  }
  const achados = new Set<GrupoDoCriterio>();
  for (const linha of texto.split(/\r?\n/)) {
    const t = tituloDaLinha(linha);
    if (t !== null) achados.add(t.grupo);
  }
  const marcas = GRUPOS.filter((g) => achados.has(g));
  const temBase = achados.has('FEITO') && achados.has('FALTA');
  const outros = marcas.filter((g) => g !== 'FEITO' && g !== 'FALTA').length;
  if (!temBase) return { fechamento: false, marcas, motivo: 'faltam os titulos de feito e de faltando' };
  if (outros < 2) return { fechamento: false, marcas, motivo: 'menos de quatro grupos' };
  return { fechamento: true, marcas, motivo: 'fechamento' };
}

/**
 * Parte 1 do criterio na fabrica aberta na mao: so Stop, e sem subagente. Sem
 * subagente quer dizer subagente nulo, OU igual ao agente principal da fabrica
 * (sessao aberta com --agent manda agent_type tambem no Stop principal).
 */
export function ehFimDaSessaoPrincipal(evento: string, subagente: string | null, principal: string | null): boolean {
  if (evento !== 'Stop') return false;
  if (subagente === null) return true;
  return principal !== null && subagente === principal;
}

/** As secoes de pendencia do fechamento, copiadas sem reescrever. */
export function extrairPendencias(texto: string): string[] {
  const linhas = texto.split(/\r?\n/);
  const saida: string[] = [];
  let atual: string[] | null = null;
  const fechar = (): void => {
    if (atual === null) return;
    while (atual.length > 0 && (atual[0] ?? '').trim() === '') atual.shift();
    while (atual.length > 0 && (atual[atual.length - 1] ?? '').trim() === '') atual.pop();
    if (atual.length > 0) saida.push(atual.join('\n'));
    atual = null;
  };
  for (const linha of linhas) {
    const t = tituloDaLinha(linha);
    if (t !== null || /^\s*#{1,6}\s/.test(linha)) {
      fechar();
      if (t !== null && t.grupo === 'FALTA') {
        // O que vier na propria linha do titulo, depois dele, ja e pendencia.
        const resto = linha.slice(t.fimDoTitulo).replace(/^[\s*_:.?]+/, '');
        atual = resto.length > 0 ? [resto] : [];
      }
      continue;
    }
    if (atual !== null) atual.push(linha);
  }
  fechar();
  return saida;
}

// ---------------------------------------------------------------------------
// Identificadores
// ---------------------------------------------------------------------------

function hashCurto(...partes: string[]): string {
  return createHash('sha256').update(partes.join('\u0000')).digest('hex').slice(0, 16);
}

/**
 * Id do fechamento, SEM o texto (condicao da seguranca, muda o contrato): da
 * fabrica aberta na mao, sid e hora t da linha Stop; da fabrica do painel, a
 * sessao do kit e a hora do fim. A mesma rodada nunca grava duas vezes.
 */
export function idDoFechamento(fabricaId: string, sessao: string, horaDoFim: string): string {
  return `fech-${fabricaId}-${hashCurto(sessao, horaDoFim)}`;
}

export function idDoDiario(fabricaId: string, dia: string): string {
  return `diario-${fabricaId}-${dia}`;
}

// ---------------------------------------------------------------------------
// Consumo por dia
// ---------------------------------------------------------------------------

/**
 * O que soma no campo consumoPorDia da fabrica, por campo, ja sem zero. Pura:
 * quem grava troca cada numero por increment do Firestore.
 */
export function somaDoDia(acrescimo: Record<string, number>, dia: string): Record<string, Record<string, number>> {
  const doDia: Record<string, number> = {};
  for (const [c, v] of Object.entries(acrescimo)) {
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) doDia[c] = v;
  }
  return Object.keys(doDia).length > 0 ? { [dia]: doDia } : {};
}

// ---------------------------------------------------------------------------
// Livro do dia: metadado local para o diario
// ---------------------------------------------------------------------------

export interface RodadaDoLivro {
  inicio: string | null;
  fim: string;
}

export interface DiaDoLivro {
  passos: number;
  rodadas: RodadaDoLivro[];
}

export interface Livro {
  versao: 1;
  /** fabricaId, depois o dia D da janela do diario (veja diaDaJanela). */
  fabricas: Record<string, Record<string, DiaDoLivro>>;
  /** Diarios ja gravados ou confirmados na base, id para hora. */
  gerados: Record<string, string>;
  /**
   * Desde quando este livro anota. Janela em que o livro comecou no meio gera o
   * diario, mas o texto diz desde quando a ponte anotou, para o diario nao dizer
   * menos rodada e menos tempo do que houve sem avisar. Achado ao vivo na subida
   * da OST 13: dois diarios de 24/11 sairam quase vazios, sem esse aviso.
   */
  desde: string;
}

export function livroVazio(desde: Date = new Date()): Livro {
  return { versao: 1, fabricas: {}, gerados: {}, desde: desde.toISOString() };
}

export function anotarPasso(livro: Livro, fabricaId: string, quando: string): void {
  const dia = diaDaJanela(quando);
  if (dia === null) return;
  const f = (livro.fabricas[fabricaId] ??= {});
  const d = (f[dia] ??= { passos: 0, rodadas: [] });
  d.passos++;
}

/** Rodada repetida (fila relida depois de queda) nao conta duas vezes. */
export function anotarRodada(livro: Livro, fabricaId: string, inicio: string | null, fim: string): void {
  const dia = diaDaJanela(fim);
  if (dia === null) return;
  const f = (livro.fabricas[fabricaId] ??= {});
  const d = (f[dia] ??= { passos: 0, rodadas: [] });
  if (d.passos === 0) d.passos = 1;
  if (d.rodadas.some((r) => r.fim === fim && r.inicio === inicio)) return;
  d.rodadas.push({ inicio, fim });
}

/** Esquece o que ja passou do prazo de atraso, para o arquivo nao crescer sem fim. */
export function podarLivro(livro: Livro, agora: Date): void {
  const hoje = diaDaJanela(agora);
  if (hoje === null) return;
  const limite = somarDias(hoje, -(DIAS_DE_ATRASO_ACEITOS + 1));
  for (const [fid, dias] of Object.entries(livro.fabricas)) {
    for (const dia of Object.keys(dias)) if (dia < limite) delete dias[dia];
    if (Object.keys(dias).length === 0) delete livro.fabricas[fid];
  }
  for (const id of Object.keys(livro.gerados)) {
    const dia = id.slice(-10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(dia) && dia < limite) delete livro.gerados[id];
  }
}

export interface DiarioAFazer {
  fabricaId: string;
  dia: string;
  geradoAtrasado: boolean;
  /** Hora em que o livro comecou, quando foi DENTRO da janela; senao null. */
  parcialDesde: string | null;
}

/**
 * Quais diarios esta passada deve gerar. Pura, recebe "agora".
 *
 * O diario de D sai quando a janela dele fechou (20h00 de D, Brasilia). Janela
 * fechada ha mais tempo, ate sete dias, sai na primeira passada (a maquina dormiu
 * as 20h), marcada como atrasada quando ja e o dia seguinte no calendario. Janela
 * sem passo nao gera. Janela que acabou antes de o livro comecar nao gera.
 */
export function diariosAFazer(livro: Livro, agora: Date): DiarioAFazer[] {
  const aberta = diaDaJanela(agora);
  const hojeCalendario = diaDeBrasilia(agora);
  if (aberta === null || hojeCalendario === null) return [];
  const maisVelho = somarDias(aberta, -DIAS_DE_ATRASO_ACEITOS);
  // Livro sem hora de comeco legivel vale como comecado agora: falha fechada.
  const desdeMs = new Date(livro.desde).getTime();
  const desde = Number.isFinite(desdeMs) ? desdeMs : agora.getTime();
  const saida: DiarioAFazer[] = [];
  for (const [fabricaId, dias] of Object.entries(livro.fabricas)) {
    for (const [dia, d] of Object.entries(dias)) {
      if (d.passos <= 0 && d.rodadas.length === 0) continue;
      // So janela ja fechada: a aberta agora ainda esta acontecendo.
      if (dia >= aberta || dia < maisVelho) continue;
      const j = janelaDoDia(dia);
      if (desde >= new Date(j.fim).getTime()) continue;
      if (livro.gerados[idDoDiario(fabricaId, dia)] !== undefined) continue;
      saida.push({
        fabricaId,
        dia,
        geradoAtrasado: hojeCalendario > dia,
        parcialDesde: desde > new Date(j.inicio).getTime() ? new Date(desde).toISOString() : null,
      });
    }
  }
  return saida.sort((a, b2) => (a.dia < b2.dia ? -1 : a.dia > b2.dia ? 1 : a.fabricaId.localeCompare(b2.fabricaId)));
}

const CAMINHO_LIVRO = join(
  ((): string => {
    const bruto = (process.env.PONTE_PASTA_FILA_GANCHOS ?? '').trim();
    return bruto.length > 0 ? bruto : PASTA_LOCAL;
  })(),
  'relatorios-livro-do-dia.json'
);

let livroEmMemoria: Livro | null = null;
let livroSujo = false;

/** O livro desta ponte. Arquivo ilegivel vale como livro vazio: pior caso, um diario a menos. */
export function livroDaPonte(): Livro {
  if (livroEmMemoria !== null) return livroEmMemoria;
  livroEmMemoria = livroVazio();
  if (existsSync(CAMINHO_LIVRO)) {
    try {
      const j = JSON.parse(readFileSync(CAMINHO_LIVRO, 'utf8')) as Partial<Livro>;
      if (typeof j.fabricas === 'object' && j.fabricas !== null) livroEmMemoria.fabricas = j.fabricas;
      if (typeof j.gerados === 'object' && j.gerados !== null) livroEmMemoria.gerados = j.gerados;
      // Livro de antes deste campo: vale como comecado agora, e o dia de hoje nao gera.
      if (typeof j.desde === 'string') livroEmMemoria.desde = j.desde;
      else livroSujo = true;
    } catch {
      // segue vazio
    }
  }
  return livroEmMemoria;
}

export function marcarLivroSujo(): void {
  livroSujo = true;
}

/** Grava o livro se mudou. Troca atomica, como o arquivo de marcas. */
export function salvarLivro(): void {
  if (!livroSujo || livroEmMemoria === null) return;
  mkdirSync(join(CAMINHO_LIVRO, '..'), { recursive: true });
  const temporario = `${CAMINHO_LIVRO}.novo`;
  writeFileSync(temporario, JSON.stringify(livroEmMemoria, null, 2), { encoding: 'utf8', mode: 0o600 });
  renameSync(temporario, CAMINHO_LIVRO);
  livroSujo = false;
}

// ---------------------------------------------------------------------------
// Montagem do diario
// ---------------------------------------------------------------------------

/** Teto do documento no Firestore e 1 MiB. Fica folga para nomes de campo e metadado. */
export const TETO_BYTES_DO_DIARIO = 1_000_000;

export interface FechamentoDoDia {
  relatorioId: string;
  rodadaFim: string;
  texto: string;
}

export interface EntradaDoDiario {
  fabricaId: string;
  maquinaId: string;
  dia: string;
  projeto: string | null;
  titulo: string | null;
  fechamentos: FechamentoDoDia[];
  rodadas: RodadaDoLivro[];
  consumoDoDia: Record<string, number> | null;
  geradoAtrasado: boolean;
  /** Hora em que a ponte passou a anotar, quando foi dentro da janela. */
  parcialDesde?: string | null;
  agora: Date;
}

export interface DiarioMontado {
  id: string;
  tipo: 'diario';
  fabricaId: string;
  maquinaId: string;
  projeto: string | null;
  titulo: string | null;
  texto: string;
  versao: 1;
  dia: string;
  /** A janela que este diario cobre, ISO: de 20h00 de D-1 ate 20h00 de D, Brasilia. */
  janelaInicio: string;
  janelaFim: string;
  fechamentos: Array<{ relatorioId: string; rodadaFim: string }>;
  pendencias: string[];
  rodadas: number;
  tempoMs: number | null;
  consumoDoDia: Record<string, number> | null;
  geradoAtrasado: boolean;
  cortado: boolean;
}

function duracaoPorExtenso(ms: number): string {
  const min = Math.round(ms / 60000);
  if (min < 1) return 'menos de 1 minuto';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

function numeroPorExtenso(n: number): string {
  return Math.round(n).toLocaleString('pt-BR');
}

function consumoPorExtenso(c: Record<string, number> | null): string {
  if (c === null) return 'não medido';
  const partes: string[] = [];
  const rotulo: Record<string, string> = {
    input_tokens: 'entrada',
    output_tokens: 'saída',
    cache_read_input_tokens: 'cache lido',
    cache_creation_input_tokens: 'cache criado',
  };
  let total = 0;
  for (const [campo, nome] of Object.entries(rotulo)) {
    const v = c[campo];
    if (typeof v === 'number' && v > 0) {
      partes.push(`${nome} ${numeroPorExtenso(v)}`);
      total += v;
    }
  }
  if (partes.length === 0) return 'não medido';
  return `${numeroPorExtenso(total)} tokens (${partes.join(', ')})`;
}

/**
 * Monta o diario. Pura: recebe tudo e "agora". Sem travessao em nada que ela
 * escreve, §A.11; o texto dos fechamentos e copiado como veio.
 */
export function montarDiario(e: EntradaDoDiario): DiarioMontado {
  const janela = janelaDoDia(e.dia);
  const iniJ = new Date(janela.inicio).getTime();
  const fimJ = new Date(janela.fim).getTime();
  const naJanela = (iso: string): boolean => {
    const t = new Date(iso).getTime();
    return Number.isFinite(t) && t >= iniJ && t < fimJ;
  };
  const fechamentos = [...e.fechamentos].filter((f) => naJanela(f.rodadaFim)).sort((a, b) => (a.rodadaFim < b.rodadaFim ? -1 : 1));
  const pendencias = fechamentos.flatMap((f) => extrairPendencias(f.texto));
  const rodadas = e.rodadas.filter((r) => naJanela(r.fim));
  const comInicio = rodadas.filter((r) => r.inicio !== null && Number.isFinite(new Date(r.inicio).getTime()));
  const tempoMs =
    comInicio.length > 0
      ? comInicio.reduce((s, r) => s + Math.max(0, new Date(r.fim).getTime() - new Date(r.inicio as string).getTime()), 0)
      : null;
  const nome = e.titulo ?? e.projeto ?? e.fabricaId;

  const cabeca: string[] = [];
  cabeca.push(`Diário de ${diaPorExtenso(e.dia)}, ${nome}`);
  cabeca.push(`Janela: de ${horaDaJanelaPorExtenso(janela.inicio)} até ${horaDaJanelaPorExtenso(janela.fim)}, horário de Brasília.`);
  if (e.parcialDesde) {
    cabeca.push(
      `A ponte só passou a anotar em ${horaDeBrasiliaPorExtenso(e.parcialDesde)}. O que aconteceu antes disso, nesta janela, não está neste diário.`
    );
  }
  cabeca.push(
    `Gerado em ${horaDeBrasiliaPorExtenso(e.agora)}, horário de Brasília.` +
      (e.geradoAtrasado ? ' Gerado com atraso: quando a janela fechou, a máquina estava desligada ou dormindo.' : '')
  );
  cabeca.push('');
  cabeca.push(`Rodadas no dia: ${rodadas.length}`);
  cabeca.push(
    `Tempo das rodadas: ${tempoMs === null ? 'não medido' : duracaoPorExtenso(tempoMs)}` +
      (tempoMs !== null && comInicio.length < rodadas.length
        ? `, somando ${comInicio.length} de ${rodadas.length} rodadas, as outras sem hora de começo`
        : '')
  );
  cabeca.push(`Consumo do dia: ${consumoPorExtenso(e.consumoDoDia)}`);
  cabeca.push(`Fechamentos no dia: ${fechamentos.length}`);

  const corpoPendencias: string[] = ['', 'O que ficou pendente'];
  if (pendencias.length === 0) corpoPendencias.push('Nenhuma pendência escrita nos fechamentos do dia.');
  else for (const p of pendencias) corpoPendencias.push('', p);

  const corpoFechamentos: string[] = [];
  fechamentos.forEach((f, i) => {
    corpoFechamentos.push('', `Fechamento ${i + 1}, às ${horaCurta(f.rodadaFim)}`, '', f.texto);
  });

  let texto = [...cabeca, ...corpoPendencias, ...corpoFechamentos].join('\n');
  let pendenciasFinais = pendencias;
  let cortado = false;

  const montado = (): DiarioMontado => ({
    id: idDoDiario(e.fabricaId, e.dia),
    tipo: 'diario',
    fabricaId: e.fabricaId,
    maquinaId: e.maquinaId,
    projeto: e.projeto,
    titulo: e.titulo,
    texto,
    versao: 1,
    dia: e.dia,
    janelaInicio: janela.inicio,
    janelaFim: janela.fim,
    fechamentos: fechamentos.map((f) => ({ relatorioId: f.relatorioId, rodadaFim: f.rodadaFim })),
    pendencias: pendenciasFinais,
    rodadas: rodadas.length,
    tempoMs,
    consumoDoDia: e.consumoDoDia,
    geradoAtrasado: e.geradoAtrasado,
    cortado,
  });

  // Teto de 1 MiB, condicao da seguranca: corta, marca e diz no proprio texto.
  const bytes = (): number => Buffer.byteLength(JSON.stringify(montado()), 'utf8');
  if (bytes() > TETO_BYTES_DO_DIARIO) {
    cortado = true;
    const aviso =
      '\n\n[diário cortado: o texto passou do tamanho que a base aceita num documento. Os fechamentos inteiros continuam, cada um, no seu próprio relatório.]';
    // As pendencias tambem estao no texto; na lista ficam ate um quarto do teto.
    let somaP = 0;
    pendenciasFinais = [];
    for (const p of pendencias) {
      somaP += Buffer.byteLength(p, 'utf8');
      if (somaP > TETO_BYTES_DO_DIARIO / 4) break;
      pendenciasFinais.push(p);
    }
    texto = '';
    const semTexto = bytes();
    const cabe = TETO_BYTES_DO_DIARIO - semTexto - Buffer.byteLength(aviso, 'utf8') - 1024;
    const completo = [...cabeca, ...corpoPendencias, ...corpoFechamentos].join('\n');
    // Corte por bytes, sem partir caractere ao meio.
    let fatia = Buffer.from(completo, 'utf8').subarray(0, Math.max(0, cabe)).toString('utf8');
    if (fatia.endsWith('�')) fatia = fatia.slice(0, -1);
    texto = fatia + aviso;
  }
  return montado();
}
