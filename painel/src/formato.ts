/*
 * Formatos de texto do manual do design system, em pt-BR.
 *
 * Tempo: "1h 12min", "34min". Consumo: "412 mil tokens", "1,2 mi tokens".
 * Datas: "hoje, 10:42", "ontem, 17:15". Espera: "18 min", "2 h".
 * Sem travessão em nenhum deles, §A.11.
 */

export function tempoDecorrido(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return 'sem tempo';
  const minutos = Math.floor(ms / 60000);
  if (minutos < 1) return 'menos de 1min';
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  if (horas < 1) return `${minutos}min`;
  return `${horas}h ${String(resto).padStart(2, '0')}min`;
}

/* Tempo parado, como o pedido de aprovação escreve: "18 min", "2 h 10 min". */
export function tempoParado(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return 'pouco tempo';
  const minutos = Math.floor(ms / 60000);
  if (minutos < 1) return 'menos de 1 min';
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  if (horas < 1) return `${minutos} min`;
  if (!resto) return `${horas} h`;
  return `${horas} h ${resto} min`;
}

function comVirgula(valor: number, casas: number): string {
  return valor.toFixed(casas).replace('.', ',');
}

/* "412 mil tokens", "1,2 mi tokens", "0 tokens". */
/*
 * NÃO MEDIDO não é ZERO, e essa diferença estava escondida na tela.
 *
 * Fábrica que o diretor abre na mão não tem contagem de token: o gancho do Claude
 * Code não entrega essa informação. A tela mostrava "0 tokens", que afirma que
 * ela não gastou nada, e é falso. Agora nulo aparece como não medido.
 */
export function consumo(tokens: number | null | undefined): string {
  if (tokens == null || !Number.isFinite(tokens)) return 'consumo não medido';
  const n = Number(tokens);
  if (n >= 1_000_000) return `${comVirgula(n / 1_000_000, 1)} mi tokens`;
  if (n >= 1_000) return `${Math.round(n / 1_000)} mil tokens`;
  return `${n} tokens`;
}

/* Valor e unidade separados, para o KpiTile. */
export function consumoEmPartes(tokens: number | null | undefined): { valor: string; unidade: string } {
  if (tokens == null || !Number.isFinite(tokens)) return { valor: 'não', unidade: 'medido' };
  const n = Number(tokens);
  if (n >= 1_000_000) return { valor: comVirgula(n / 1_000_000, 1), unidade: 'mi tokens' };
  if (n >= 1_000) return { valor: String(Math.round(n / 1_000)), unidade: 'mil tokens' };
  return { valor: String(n), unidade: 'tokens' };
}

export function tempoEmPartes(ms: number | null | undefined): { valor: string; unidade: string } {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return { valor: '0', unidade: 'min' };
  const minutos = Math.floor(ms / 60000);
  const horas = Math.floor(minutos / 60);
  if (horas < 1) return { valor: String(minutos), unidade: 'min' };
  return { valor: `${horas}h ${String(minutos % 60).padStart(2, '0')}`, unidade: 'min' };
}

const DOIS = (n: number) => String(n).padStart(2, '0');

export function horaCurta(data: Date | null): string {
  if (!data) return '';
  return `${DOIS(data.getHours())}:${DOIS(data.getMinutes())}`;
}

export function horaComSegundos(data: Date | null): string {
  if (!data) return '';
  return `${DOIS(data.getHours())}:${DOIS(data.getMinutes())}:${DOIS(data.getSeconds())}`;
}

/* "hoje, 10:42", "ontem, 17:15", "11/10, 08:03". */
export function dataAmigavel(data: Date | null, agora: Date = new Date()): string {
  if (!data) return 'sem data';
  const dia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diferenca = (dia(agora) - dia(data)) / 86_400_000;
  const hora = horaCurta(data);
  if (diferenca === 0) return `hoje, ${hora}`;
  if (diferenca === 1) return `ontem, ${hora}`;
  return `${DOIS(data.getDate())}/${DOIS(data.getMonth() + 1)}, ${hora}`;
}

const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const MESES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro'
];

/* "Segunda, 13 de outubro" */
export function diaPorExtenso(data: Date): string {
  return `${DIAS[data.getDay()]}, ${data.getDate()} de ${MESES[data.getMonth()]}`;
}

/* "há 12 s", "há 4 min", "há 2 h" */
export function desdeQuando(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return 'sem sinal';
  const segundos = Math.floor(ms / 1000);
  if (segundos < 60) return `há ${segundos} s`;
  const minutos = Math.floor(segundos / 60);
  if (minutos < 60) return `há ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `há ${horas} h`;
  return `há ${Math.floor(horas / 24)} d`;
}

export function plural(n: number, singular: string, plural_: string): string {
  return `${n} ${n === 1 ? singular : plural_}`;
}
