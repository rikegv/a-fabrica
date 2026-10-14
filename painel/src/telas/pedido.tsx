'use client';

/*
 * O pedido de aprovacao, da base para a tela, num lugar so: a Visao geral, a
 * tela de Aprovacoes, a tela da fabrica e o celular mostram o MESMO pedido, com
 * a mesma marcacao e as mesmas tres respostas.
 *
 * MARCACAO DE HONESTIDADE, aprovada na OST 2 e exigida pelo contrato da Onda 2:
 * cada campo do pacote mostra se e fato capturado pelo portao ou leitura da
 * ponte sobre o que viu. Isso nao se esconde e nao se resume: e o que permite ao
 * diretor decidir sabendo o que e observacao e o que e deducao.
 *
 * TRES RESPOSTAS, nem mais nem menos, §A.6: aprovar, recusar com motivo
 * opcional, aprovar com observacao obrigatoria. Nao existe aprovacao
 * automatica, e nao existe botao que dispense o portao.
 */

import { useCallback, useState } from 'react';
import type { ApprovalItemProps } from '@/componentes/ds';
import { impedimentoDaEscrita, responderAprovacao, type ContextoDeEscrita } from '@/dados/escritas';
import type { Aprovacao } from '@/dados/tradutor';
import { MarcaDeOrigem } from './pecas';
import { AVISOS, EXPLICACAO_DA_ORIGEM, motivoDaDecisao } from './textos';
import { usarOrdem, type Ordem } from './usarOrdem';

export interface EstadoDaResposta {
  /* Motivo para os botoes nascerem desabilitados, ou null quando estao vivos. */
  motivo: string | null;
  ordem: Ordem;
  /* Qual pedido esta sendo respondido agora. */
  respondendo: string | null;
  aprovar: (pedido: { id: string }) => void;
  recusar: (pedido: { id: string }, motivoDaRecusa: string) => void;
  aprovarComObservacao: (pedido: { id: string }, observacao: string) => void;
}

export function usarResposta(escrita: ContextoDeEscrita, avisar: (mensagem: string) => void): EstadoDaResposta {
  const ordem = usarOrdem(avisar);
  const [respondendo, setRespondendo] = useState<string | null>(null);
  const motivo = motivoDaDecisao(impedimentoDaEscrita(escrita));

  const responder = useCallback(
    (id: string, resposta: 'aprovado' | 'recusado' | 'aprovado com observacao', observacao: string, aviso: string) => {
      setRespondendo(id);
      void ordem
        .enviar(() => responderAprovacao(escrita, { aprovacaoId: id, resposta, observacao }), aviso)
        .finally(() => setRespondendo(null));
    },
    [escrita, ordem]
  );

  return {
    motivo,
    ordem,
    respondendo,
    aprovar: (pedido) => responder(pedido.id, 'aprovado', '', AVISOS.aprovado),
    recusar: (pedido, motivoDaRecusa) => responder(pedido.id, 'recusado', motivoDaRecusa, AVISOS.recusado),
    aprovarComObservacao: (pedido, observacao) =>
      responder(pedido.id, 'aprovado com observacao', observacao, AVISOS.aprovadoComObservacao)
  };
}

/* Um pedido da base no formato que o componente do pacote espera, com a
   marcacao de origem de cada campo e o estado da escrita em curso. */
export function paraPedidoDeTela(pedido: Aprovacao, resposta: EstadoDaResposta): ApprovalItemProps {
  const respondendoEste = resposta.respondendo === pedido.id;
  return {
    id: pedido.id,
    title: pedido.title,
    why: pedido.why,
    impact: pedido.impact,
    touches: pedido.touches,
    risk: pedido.risk,
    project: pedido.project,
    task: pedido.task,
    waiting: pedido.waiting,
    stale: pedido.stale,
    tool: pedido.tool,
    agentSaid: pedido.agentSaid,
    readOnlyReason: resposta.motivo,
    busy: respondendoEste && resposta.ordem.ocupado,
    error: respondendoEste ? resposta.ordem.erro : null,
    onDismissError: resposta.ordem.limparErro,
    originsHint: EXPLICACAO_DA_ORIGEM,
    origins: {
      title: <MarcaDeOrigem marca={pedido.origens.title} />,
      why: <MarcaDeOrigem marca={pedido.origens.why} />,
      impact: <MarcaDeOrigem marca={pedido.origens.impact} />,
      touches: <MarcaDeOrigem marca={pedido.origens.touches} />,
      risk: <MarcaDeOrigem marca={pedido.origens.risk} />,
      agentSaid: <MarcaDeOrigem marca={pedido.origens.agentSaid} />
    }
  };
}
