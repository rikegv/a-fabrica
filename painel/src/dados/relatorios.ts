/*
 * OST 13, Onda 3, RELATÓRIOS. Cálculo puro, sem React e sem base, para poder
 * ser provado sozinho.
 *
 * O texto do fechamento é mostrado INTEIRO, sem resumir nem reescrever. Ele é
 * markdown simples (títulos ##, negrito **, listas). Aqui ele vira uma lista de
 * blocos e de trechos de texto, e a tela monta elementos React com esses
 * trechos. Nunca vira HTML: o texto pode trazer conteúdo copiado de arquivo de
 * projeto, e HTML cru no painel seria porta para script, condição da segurança
 * na OST 13. Também não existe link: nenhum endereço do texto vira href.
 */

import type { HoraDaBase, RelatorioBase } from './tipos';
import { paraData, somarTokens } from './tradutor';

/* Brasília é UTC menos 3, sem horário de verão, como a ponte calcula. */
const BRASILIA_MS = 3 * 60 * 60 * 1000;
const DIA_MS = 24 * 60 * 60 * 1000;

export function diaDeBrasilia(data: Date | null): string | null {
  if (!data) return null;
  const d = new Date(data.getTime() - BRASILIA_MS);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/* Meia-noite de Brasília do dia AAAA-MM-DD. Nulo quando o texto não é dia. */
export function inicioDoDiaDeBrasilia(dia: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dia);
  if (!m) return null;
  return new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) + BRASILIA_MS);
}

/* O diário de um dia pode ser gerado até 7 dias depois, se a máquina dormiu.
   A faixa de busca por data cobre isso, e o filtro fino é pelo campo dia. */
export function faixaDoDia(dia: string): { de: Date; ate: Date } | null {
  const de = inicioDoDiaDeBrasilia(dia);
  return de ? { de, ate: new Date(de.getTime() + 8 * DIA_MS) } : null;
}

/* "24/11/2026" a partir de "2026-11-24". */
export function diaLegivel(dia: string | null): string {
  const m = dia ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(dia) : null;
  return m ? `${m[3]}/${m[2]}/${m[1]}` : 'sem dia';
}

export interface Relatorio {
  id: string;
  tipo: 'fechamento' | 'diario';
  fabricaId: string | null;
  /* Nome gravado pela ponte, ou o nome da pasta do projeto. */
  tituloGravado: string | null;
  projeto: string | null;
  texto: string;
  criadoEm: Date | null;
  dia: string | null;
  origem: 'mao' | 'painel' | null;
  cortado: boolean;
  rodadas: number | null;
  tempoMs: number | null;
  /* Nulo quer dizer não medido, nunca zero. */
  tokensDoDia: number | null;
  pendencias: string[];
  geradoAtrasado: boolean;
  fechamentos: number;
}

function texto(valor: unknown): string | null {
  return typeof valor === 'string' && valor.trim() ? valor.trim() : null;
}

function nomeDaPasta(caminho: string | null): string | null {
  if (!caminho) return null;
  const partes = caminho.split(/[\\/]+/).filter(Boolean);
  return partes[partes.length - 1] ?? null;
}

export function traduzirRelatorio(doc: RelatorioBase): Relatorio {
  const criadoEm = paraData(doc.criadoEm as HoraDaBase);
  const tipo = doc.tipo === 'diario' ? 'diario' : 'fechamento';
  const rodadaFim = texto(doc.rodadaFim);
  return {
    id: doc.id,
    tipo,
    fabricaId: texto(doc.fabricaId),
    tituloGravado: texto(doc.titulo),
    projeto: texto(doc.projeto),
    /* Inteiro, como veio. Só o texto ausente vira frase. */
    texto: typeof doc.texto === 'string' && doc.texto.trim() ? doc.texto : '',
    criadoEm,
    dia: texto(doc.dia) ?? diaDeBrasilia(rodadaFim ? new Date(rodadaFim) : criadoEm),
    origem: doc.origem === 'mao' || doc.origem === 'painel' ? doc.origem : null,
    cortado: doc.cortado === true,
    rodadas: typeof doc.rodadas === 'number' ? doc.rodadas : null,
    tempoMs: typeof doc.tempoMs === 'number' ? doc.tempoMs : null,
    tokensDoDia: doc.consumoDoDia ? somarTokens(doc.consumoDoDia) : null,
    pendencias: Array.isArray(doc.pendencias) ? doc.pendencias.filter((p) => typeof p === 'string') : [],
    geradoAtrasado: doc.geradoAtrasado === true,
    fechamentos: Array.isArray(doc.fechamentos) ? doc.fechamentos.length : 0
  };
}

/* O nome que a tela mostra: o da fábrica no painel, o gravado, a pasta. */
export function nomeDoRelatorio(r: Relatorio, nomes: Map<string, string>): string {
  return (r.fabricaId ? nomes.get(r.fabricaId) : undefined) ?? r.tituloGravado ?? nomeDaPasta(r.projeto) ?? 'Fábrica sem nome';
}

/* Mais novo em cima. */
export function ordenarRelatorios(lista: Relatorio[]): Relatorio[] {
  return [...lista].sort(
    (a, b) =>
      (b.criadoEm?.getTime() ?? 0) - (a.criadoEm?.getTime() ?? 0) ||
      (b.dia ?? '').localeCompare(a.dia ?? '') ||
      a.id.localeCompare(b.id)
  );
}

export function filtrarRelatorios(lista: Relatorio[], filtro: { fabricaId?: string | null; dia?: string | null }): Relatorio[] {
  return lista.filter(
    (r) => (!filtro.fabricaId || r.fabricaId === filtro.fabricaId) && (!filtro.dia || r.dia === filtro.dia)
  );
}

/* ---------- texto em blocos, sem HTML ---------- */

export interface Trecho {
  texto: string;
  forte?: boolean;
  codigo?: boolean;
}

export type BlocoDoTexto =
  | { tipo: 'titulo'; nivel: number; trechos: Trecho[] }
  | { tipo: 'item'; marca: string; recuo: number; trechos: Trecho[] }
  | { tipo: 'paragrafo'; trechos: Trecho[] }
  | { tipo: 'codigo'; texto: string }
  | { tipo: 'regra' }
  | { tipo: 'vazio' };

export function trechosDaLinha(linha: string): Trecho[] {
  const trechos: Trecho[] = [];
  const padrao = /\*\*([^*]+?)\*\*|`([^`]+?)`/g;
  let ultimo = 0;
  for (let m = padrao.exec(linha); m; m = padrao.exec(linha)) {
    if (m.index > ultimo) trechos.push({ texto: linha.slice(ultimo, m.index) });
    if (m[1] !== undefined) trechos.push({ texto: m[1], forte: true });
    else trechos.push({ texto: m[2], codigo: true });
    ultimo = m.index + m[0].length;
  }
  if (ultimo < linha.length) trechos.push({ texto: linha.slice(ultimo) });
  return trechos;
}

export function blocosDoTexto(fonte: string): BlocoDoTexto[] {
  const blocos: BlocoDoTexto[] = [];
  const linhas = fonte.replace(/\r\n?/g, '\n').split('\n');
  let codigo: string[] | null = null;
  for (const linha of linhas) {
    if (/^\s*```/.test(linha)) {
      if (codigo) {
        blocos.push({ tipo: 'codigo', texto: codigo.join('\n') });
        codigo = null;
      } else codigo = [];
      continue;
    }
    if (codigo) {
      codigo.push(linha);
      continue;
    }
    if (!linha.trim()) {
      if (blocos.length && blocos[blocos.length - 1].tipo !== 'vazio') blocos.push({ tipo: 'vazio' });
      continue;
    }
    const titulo = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/.exec(linha);
    if (titulo) {
      blocos.push({ tipo: 'titulo', nivel: titulo[1].length, trechos: trechosDaLinha(titulo[2]) });
      continue;
    }
    if (/^\s{0,3}([-*_])(\s*\1){2,}\s*$/.test(linha)) {
      blocos.push({ tipo: 'regra' });
      continue;
    }
    const item = /^(\s*)([-*+]|\d{1,3}[.)])\s+(.*)$/.exec(linha);
    if (item) {
      const marca = /^\d/.test(item[2]) ? item[2] : '•';
      blocos.push({ tipo: 'item', marca, recuo: Math.min(4, Math.floor(item[1].replace(/\t/g, '  ').length / 2)), trechos: trechosDaLinha(item[3]) });
      continue;
    }
    blocos.push({ tipo: 'paragrafo', trechos: trechosDaLinha(linha) });
  }
  /* Bloco de código sem fecho: mostra o que veio, inteiro. */
  if (codigo) blocos.push({ tipo: 'codigo', texto: codigo.join('\n') });
  while (blocos.length && blocos[blocos.length - 1].tipo === 'vazio') blocos.pop();
  return blocos;
}
