'use client';

/*
 * Raiz do painel. Uma rota, uma tela, sem rolagem da pagina.
 *
 * Ordem: barreira de entrada, §A.6 (o painel nao abre sem login), e so depois
 * os ouvintes ao vivo da base. No celular e no computador o endereco e o mesmo;
 * o desenho e que muda.
 *
 * Aqui tambem nasce o CONTEXTO DE ESCRITA, que a camada de escrita exige para
 * deixar qualquer ordem sair: a base ligada, o usuario autenticado, a maquina
 * pareada, a ponte viva e de onde a ordem veio. Sem usuario, o contexto nasce
 * sem usuario e nenhuma escrita passa.
 */

import { useMemo } from 'react';
import { Celular } from '@/telas/Celular';
import { Computador } from '@/telas/Computador';
import { Barreira } from '@/telas/Barreira';
import { usarEntrada } from '@/dados/autenticacao';
import type { ContextoDeEscrita } from '@/dados/escritas';
import { usarPainel } from '@/dados/painel';
import { usarTamanhoDaTela } from '@/usarTamanhoDaTela';

export default function Pagina() {
  const entrada = usarEntrada();
  const dentro = entrada.situacao === 'dentro';
  const base = dentro ? entrada.base : null;
  const estado = usarPainel(base);
  const tela = usarTamanhoDaTela();

  const escrita = useMemo<ContextoDeEscrita>(
    () => ({
      base,
      usuario: dentro ? entrada.usuario : null,
      maquinaId: estado.ponte.maquinaId,
      pontePronta: estado.ponte.online,
      celular: tela.celular
    }),
    [base, dentro, entrada.usuario, estado.ponte.maquinaId, estado.ponte.online, tela.celular]
  );

  if (!dentro) return <Barreira entrada={entrada} />;

  /* Enquanto o navegador nao disse o tamanho, o painel fica no fundo de
     ambiente, sem piscar um desenho que vai trocar no instante seguinte. */
  if (!tela.pronto) return <div className="h-full" />;

  return tela.celular ? (
    <Celular base={base} estado={estado} escrita={escrita} entrada={entrada} />
  ) : (
    <Computador
      base={base}
      estado={estado}
      escrita={escrita}
      entrada={entrada}
      menuRecolhido={tela.menuRecolhido}
    />
  );
}
