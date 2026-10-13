/*
 * Gerador de estilos do painel. Fonte unica: o tokens.json do design system.
 *
 * Roda antes de "next dev" e de "next build" (predev e prebuild no package.json).
 * Le gerenciador-de-fabricas/design-system/tokens.json e escreve tres arquivos
 * gerados, que ninguem edita a mao:
 *
 *   painel/app/tokens.gerado.css        variaveis CSS dos dois temas e classes de texto
 *   painel/app/componentes.gerado.css   copia do CSS dos componentes do pacote
 *   painel/src/tema/tokens.gerado.ts    o mesmo tokens.json virado tema do Tailwind
 *
 * Nenhum valor de cor, tamanho ou raio e repetido a mao no Tailwind: o tema
 * aponta para a variavel CSS, e a variavel sai de tokens.json. Mudar tokens.json
 * e gerar de novo muda a tela inteira.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
const raizPainel = resolve(aqui, '..');
const pacote = resolve(raizPainel, '..', 'gerenciador-de-fabricas', 'design-system');

const tokens = JSON.parse(readFileSync(join(pacote, 'tokens.json'), 'utf8'));
const cssComponentes = readFileSync(join(pacote, 'components', 'bundle.css'), 'utf8');

const aviso = (origem) =>
  `/* Arquivo gerado por painel/scripts/gerar-estilos.mjs a partir de ${origem}. Nao edite a mao. */\n`;

/* ---------- variavel CSS: resolve apelido {outro-token} ---------- */
function valorCss(valor) {
  const casa = /^\{(.+)\}$/.exec(String(valor).trim());
  return casa ? `var(--${casa[1]})` : valor;
}

/* ---------- tokens.gerado.css ---------- */
function blocoDeCores(tema) {
  return tokens.color.tokens
    .map((t) => `  --${t.name}: ${valorCss(t.value[tema])};`)
    .join('\n');
}

function blocoDeSombras(tema) {
  return tokens.shadow.tokens.map((t) => `  --${t.name}: ${t.value[tema]};`).join('\n');
}

function blocoSimples(grupo) {
  return tokens[grupo].tokens.map((t) => `  --${t.name}: ${t.value};`).join('\n');
}

function classesDeTexto() {
  const familias = tokens.type.families;
  const linhas = [];
  for (const grupo of tokens.type.groups) {
    for (const estilo of grupo.styles) {
      const partes = [`font-family: var(--font-${grupo.family === 'mono' ? 'mono' : 'sans'})`];
      partes.push(`font-size: ${estilo.fontSize}`);
      partes.push(`line-height: ${estilo.lineHeight}`);
      partes.push(`font-weight: ${estilo.fontWeight}`);
      if (estilo.letterSpacing) partes.push(`letter-spacing: ${estilo.letterSpacing}`);
      linhas.push(`.${estilo.name} { ${partes.join('; ')}; }`);
    }
  }
  void familias;
  return linhas.join('\n');
}

const tokensCss = [
  aviso('design-system/tokens.json'),
  '/* Tema escuro e o padrao. data-theme="light" no <html> liga o claro. */',
  ':root, [data-theme="dark"] {',
  blocoDeCores('dark'),
  blocoDeSombras('dark'),
  '  color-scheme: dark;',
  '}',
  '[data-theme="light"] {',
  blocoDeCores('light'),
  blocoDeSombras('light'),
  '  color-scheme: light;',
  '}',
  ':root {',
  blocoSimples('spacing'),
  blocoSimples('radius'),
  blocoSimples('size'),
  blocoSimples('blur'),
  `  --font-sans: ${tokens.type.families.sans};`,
  `  --font-mono: ${tokens.type.families.mono};`,
  '}',
  classesDeTexto(),
  ''
].join('\n');

/* ---------- componentes.gerado.css ---------- */
/* As fontes entram no layout, com <link> para o Google Fonts, por isso o
   @import da fonte sai da copia: @import dentro de CSS de modulo quebra a
   ordem do Tailwind. */
const cssSemImportDeFonte = cssComponentes
  .split('\n')
  .filter((linha) => !/^@import url\(/.test(linha.trim()))
  .join('\n')
  .replace(/^\s*\n/, '');

const componentesCss = aviso('design-system/components/bundle.css') + cssSemImportDeFonte;

/* ---------- tokens.gerado.ts, o tema do Tailwind ---------- */
function mapa(lista, chave, valor) {
  const saida = {};
  for (const item of lista) saida[chave(item)] = valor(item);
  return saida;
}

const semPrefixo = (nome, prefixo) => nome.replace(new RegExp(`^${prefixo}-`), '');

const cores = mapa(
  tokens.color.tokens,
  (t) => t.name,
  (t) => `var(--${t.name})`
);
const espacos = mapa(
  tokens.spacing.tokens,
  (t) => semPrefixo(t.name, 'space'),
  (t) => `var(--${t.name})`
);
const raios = mapa(
  tokens.radius.tokens,
  (t) => semPrefixo(t.name, 'radius'),
  (t) => `var(--${t.name})`
);
const tamanhos = mapa(
  tokens.size.tokens,
  (t) => semPrefixo(t.name, 'size'),
  (t) => `var(--${t.name})`
);
const desfoques = mapa(
  tokens.blur.tokens,
  (t) => semPrefixo(t.name, 'blur'),
  (t) => `var(--${t.name})`
);
const sombras = mapa(
  tokens.shadow.tokens,
  (t) => semPrefixo(t.name, 'shadow'),
  (t) => `var(--${t.name})`
);
const textos = {};
for (const grupo of tokens.type.groups) {
  for (const estilo of grupo.styles) {
    textos[estilo.name] = [
      estilo.fontSize,
      {
        lineHeight: estilo.lineHeight,
        fontWeight: String(estilo.fontWeight),
        ...(estilo.letterSpacing ? { letterSpacing: estilo.letterSpacing } : {})
      }
    ];
  }
}

const temaTs =
  aviso('design-system/tokens.json') +
  `
export const cores = ${JSON.stringify(cores, null, 2)} as const;

export const espacos = ${JSON.stringify(espacos, null, 2)} as const;

export const raios = ${JSON.stringify(raios, null, 2)} as const;

export const tamanhos = ${JSON.stringify(tamanhos, null, 2)} as const;

export const desfoques = ${JSON.stringify(desfoques, null, 2)} as const;

export const sombras = ${JSON.stringify(sombras, null, 2)} as const;

export const textos = ${JSON.stringify(textos, null, 2)} as const;

export const fontes = {
  sans: ${JSON.stringify(['var(--font-sans)'])},
  mono: ${JSON.stringify(['var(--font-mono)'])}
} as const;
`;

mkdirSync(join(raizPainel, 'app'), { recursive: true });
mkdirSync(join(raizPainel, 'src', 'tema'), { recursive: true });
writeFileSync(join(raizPainel, 'app', 'tokens.gerado.css'), tokensCss, 'utf8');
writeFileSync(join(raizPainel, 'app', 'componentes.gerado.css'), componentesCss, 'utf8');
writeFileSync(join(raizPainel, 'src', 'tema', 'tokens.gerado.ts'), temaTs, 'utf8');

console.log(
  'Estilos gerados de tokens.json: app/tokens.gerado.css, app/componentes.gerado.css, src/tema/tokens.gerado.ts'
);
