'use client';

/*
 * Estado ao vivo do painel: junta maquinas, fabricas e aprovacoes num unico
 * objeto ja traduzido para a tela, com a ponte avaliada pelo heartbeat.
 *
 * Nada aqui e dado de exemplo. Base vazia devolve listas vazias, e as telas
 * dizem o que isso significa.
 */

import { useMemo } from 'react';
import type { Firestore } from 'firebase/firestore';
import {
  aprovacaoPendente,
  avaliarPonte,
  ordenarAprovacoes,
  ordenarDecisoes,
  ordenarFabricas,
  traduzirAprovacao,
  traduzirDecisao,
  traduzirFabrica,
  type Aprovacao,
  type Decisao,
  type Fabrica,
  type Ponte
} from './tradutor';
import { usarAprovacoes, usarFabricas, usarMaquinas, usarRelogio } from './ouvintes';

export interface EstadoDoPainel {
  ponte: Ponte;
  /* TODAS as fábricas, inclusive as de rodada de teste. Serve para abrir uma
     fábrica por identificador, que precisa achar qualquer uma. */
  fabricas: Fabrica[];
  /* As que valem para o dia a dia: sem as de rodada de teste. É esta que a grade
     mostra por padrão. Decisão do diretor: rotular e filtrar, nunca apagar,
     §A.17. Quinze fábricas de teste na frente do trabalho de verdade foi o que
     deixou uma fábrica recém aberta fora da tela. */
  fabricasDeTrabalho: Fabrica[];
  aprovacoes: Aprovacao[];
  /* Pedidos já respondidos, do mais recente para o mais antigo. É o histórico da
     tela de Aprovações, e sai do mesmo ouvinte, sem leitura nova na base. */
  decisoes: Decisao[];
  porFabrica: Map<string, Aprovacao[]>;
  carregando: boolean;
  erro: string | null;
  agora: Date;
  contagem: {
    total: number;
    /* Quantas estão escondidas por serem de rodada de teste. */
    deTeste: number;
    emExecucao: number;
    aguardandoAprovacao: number;
    falharam: number;
    concluidas: number;
    /* Nulo quer dizer que nenhuma fábrica do dia tem medida de consumo. */
    tokens: number | null;
    tempoMs: number;
  };
}

export function usarPainel(base: Firestore | null): EstadoDoPainel {
  const agora = usarRelogio(15_000);
  const maquinas = usarMaquinas(base);
  const fabricas = usarFabricas(base);
  const aprovacoes = usarAprovacoes(base);

  return useMemo(() => {
    /* Maquina de rodada de teste nao conta para o estado da ponte. Ela existe na
       base, rotulada, e fica offline para sempre por natureza; se entrasse na
       conta, a tela poderia dizer que a ponte caiu por causa de uma maquina que
       nunca existiu. §A.17, rotular e filtrar, nunca apagar. */
    const ponte = avaliarPonte(
      maquinas.itens.filter((m) => m.teste !== true),
      agora
    );
    const pontePerdida = !ponte.online;

    const pendentes = ordenarAprovacoes(
      aprovacoes.itens.filter(aprovacaoPendente).map((doc) => traduzirAprovacao(doc, agora))
    );

    const decisoes = ordenarDecisoes(
      aprovacoes.itens
        .filter((doc) => !aprovacaoPendente(doc))
        .map((doc) => traduzirDecisao(doc, agora))
        .filter((d): d is NonNullable<typeof d> => d != null)
    );

    const porFabrica = new Map<string, Aprovacao[]>();
    for (const pedido of pendentes) {
      if (!pedido.factoryId) continue;
      const lista = porFabrica.get(pedido.factoryId) ?? [];
      lista.push(pedido);
      porFabrica.set(pedido.factoryId, lista);
    }

    const lista = ordenarFabricas(
      fabricas.itens.map((doc) => {
        const parado = porFabrica.get(doc.id)?.[0]?.waitingMs ?? null;
        return traduzirFabrica(doc, { pontePerdida, pedidoParado: parado, agora });
      })
    );

    const deTrabalho = lista.filter((f) => !f.teste);

    const contagem = {
      total: deTrabalho.length,
      deTeste: lista.length - deTrabalho.length,
      emExecucao: deTrabalho.filter((f) => f.state === 'running').length,
      aguardandoAprovacao: pendentes.length,
      falharam: deTrabalho.filter((f) => f.state === 'failed').length,
      concluidas: deTrabalho.filter((f) => f.state === 'done').length,
      /* Soma só o que foi MEDIDO. Se nenhuma fábrica tem medida, o total é nulo,
         e a tela diz não medido em vez de zero, que seria afirmar que o dia não
         gastou nada. */
      tokens: deTrabalho.some((f) => f.tokens != null)
        ? deTrabalho.reduce((soma, f) => soma + (f.tokens ?? 0), 0)
        : null,
      tempoMs: deTrabalho.reduce((soma, f) => soma + f.elapsedMs, 0)
    };

    return {
      ponte,
      fabricas: lista,
      fabricasDeTrabalho: deTrabalho,
      aprovacoes: pendentes,
      decisoes,
      porFabrica,
      carregando: maquinas.carregando || fabricas.carregando || aprovacoes.carregando,
      erro: maquinas.erro ?? fabricas.erro ?? aprovacoes.erro,
      agora,
      contagem
    };
  }, [maquinas, fabricas, aprovacoes, agora]);
}
