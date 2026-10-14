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
  fabricas: Fabrica[];
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
    emExecucao: number;
    aguardandoAprovacao: number;
    falharam: number;
    concluidas: number;
    tokens: number;
    tempoMs: number;
  };
}

export function usarPainel(base: Firestore | null): EstadoDoPainel {
  const agora = usarRelogio(15_000);
  const maquinas = usarMaquinas(base);
  const fabricas = usarFabricas(base);
  const aprovacoes = usarAprovacoes(base);

  return useMemo(() => {
    const ponte = avaliarPonte(maquinas.itens, agora);
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

    const contagem = {
      total: lista.length,
      emExecucao: lista.filter((f) => f.state === 'running').length,
      aguardandoAprovacao: pendentes.length,
      falharam: lista.filter((f) => f.state === 'failed').length,
      concluidas: lista.filter((f) => f.state === 'done').length,
      tokens: lista.reduce((soma, f) => soma + f.tokens, 0),
      tempoMs: lista.reduce((soma, f) => soma + f.elapsedMs, 0)
    };

    return {
      ponte,
      fabricas: lista,
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
