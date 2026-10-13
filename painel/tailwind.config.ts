import type { Config } from 'tailwindcss';
import {
  cores,
  desfoques,
  espacos,
  fontes,
  raios,
  sombras,
  tamanhos,
  textos
} from './src/tema/tokens.gerado';

/*
 * Tema do Tailwind gerado de tokens.json.
 *
 * Nenhum valor de cor, raio, espaco, sombra ou tamanho aparece aqui a mao:
 * tudo vem de src/tema/tokens.gerado.ts, que o script gerar-estilos.mjs
 * escreve a partir de gerenciador-de-fabricas/design-system/tokens.json, e
 * aponta para a variavel CSS do token. Mudar tokens.json muda a tela.
 */

type Escala = Record<string, string>;
type EscalaDeTexto = Record<
  string,
  [string, { lineHeight: string; fontWeight: string; letterSpacing?: string }]
>;

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: { ...cores } as Escala,
      borderColor: { ...cores } as Escala,
      spacing: { ...espacos } as Escala,
      borderRadius: { ...raios } as Escala,
      boxShadow: { ...sombras } as Escala,
      backdropBlur: { ...desfoques } as Escala,
      blur: { ...desfoques } as Escala,
      fontFamily: { sans: [...fontes.sans], mono: [...fontes.mono] },
      fontSize: { ...textos } as unknown as EscalaDeTexto,
      width: { ...tamanhos } as Escala,
      height: { ...tamanhos } as Escala,
      minHeight: { ...tamanhos } as Escala,
      maxWidth: { ...tamanhos } as Escala
    }
  },
  plugins: []
};

export default config;
