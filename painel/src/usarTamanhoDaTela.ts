'use client';

/*
 * Tamanho da tela, como o manual do design system define:
 *
 *   ate 560px   celular, com desenho proprio e navegacao na base
 *   ate 1279px  computador com o menu lateral recolhido no trilho de icones
 *   acima       computador com o menu lateral aberto
 *
 * Decidido no navegador, nunca no servidor: a saida e estatica, e o HTML
 * entregue e o mesmo para os dois. Enquanto nao decide, "pronto" e falso.
 */

import { useEffect, useState } from 'react';

export interface TamanhoDaTela {
  pronto: boolean;
  celular: boolean;
  menuRecolhido: boolean;
}

export function usarTamanhoDaTela(): TamanhoDaTela {
  const [tamanho, setTamanho] = useState<TamanhoDaTela>({ pronto: false, celular: false, menuRecolhido: false });

  useEffect(() => {
    const celular = window.matchMedia('(max-width: 560px)');
    const recolhido = window.matchMedia('(max-width: 1279px)');
    const medir = () =>
      setTamanho({ pronto: true, celular: celular.matches, menuRecolhido: recolhido.matches });
    medir();
    celular.addEventListener('change', medir);
    recolhido.addEventListener('change', medir);
    return () => {
      celular.removeEventListener('change', medir);
      recolhido.removeEventListener('change', medir);
    };
  }, []);

  return tamanho;
}
