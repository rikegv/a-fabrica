'use client';

/*
 * Raiz do painel. Uma rota, uma tela, sem rolagem da pagina.
 *
 * Ordem: barreira de entrada, §A.6 (o painel nao abre sem login), e so depois
 * os ouvintes ao vivo da base. No celular e no computador o endereco e o mesmo;
 * o desenho e que muda.
 */

import { Celular } from '@/telas/Celular';
import { Computador } from '@/telas/Computador';
import { Barreira } from '@/telas/Barreira';
import { usarEntrada } from '@/dados/autenticacao';
import { usarPainel } from '@/dados/painel';
import { usarTamanhoDaTela } from '@/usarTamanhoDaTela';

export default function Pagina() {
  const entrada = usarEntrada();
  const dentro = entrada.situacao === 'dentro';
  const base = dentro ? entrada.base : null;
  const estado = usarPainel(base);
  const tela = usarTamanhoDaTela();

  if (!dentro) return <Barreira entrada={entrada} />;

  /* Enquanto o navegador nao disse o tamanho, o painel fica no fundo de
     ambiente, sem piscar um desenho que vai trocar no instante seguinte. */
  if (!tela.pronto) return <div className="h-full" />;

  return tela.celular ? (
    <Celular base={base} estado={estado} entrada={entrada} />
  ) : (
    <Computador base={base} estado={estado} entrada={entrada} menuRecolhido={tela.menuRecolhido} />
  );
}
