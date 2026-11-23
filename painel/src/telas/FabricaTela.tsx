'use client';

/*
 * Tela 3, Fabrica (posto de comando), no computador. Montagem portada de
 * prototipo/computador.js: cabecalho, abas, corpo e caixa de comando no pe; na
 * direita o pedido parado desta fabrica e os indicadores dela.
 *
 * Onda 2, o painel comanda:
 *  - caixa de comando viva, que escreve na fila da ponte;
 *  - pausar, reiniciar e encerrar vivos no cabecalho;
 *  - encerrar SEMPRE com confirmacao, porque nao tem volta;
 *  - o pedido parado desta fabrica responde aqui mesmo, com as tres respostas.
 *
 * O painel nunca fala com a fabrica, §A.3: todo botao daqui escreve em comandos
 * ou em aprovacoes, e a ponte le.
 *
 * OST 11: o corpo virou a FÁBRICA VIVA (FabricaViva.tsx): chat com o
 * coordenador no topo, coordenador no centro, um cartão por agente embaixo,
 * ligados por linhas de luz. A lista por ordem de hora e os cartões grandes da
 * direita saíram; tempo da rodada, consumo e máquina viraram o rodapé.
 */

import { useState } from 'react';
import type { Firestore } from 'firebase/firestore';
import { Button, FactoryHeader, RiskTag, StateIcon } from '@/componentes/ds';
import {
  encerrarFabrica,
  impedimentoDaEscrita,
  mandarComando,
  pausarFabrica,
  reiniciarFabrica,
  type ContextoDeEscrita
} from '@/dados/escritas';
import type { EstadoDoPainel } from '@/dados/painel';
import type { Fabrica } from '@/dados/tradutor';
import { ChatComCoordenador, PalcoDoTime, RodapeDaFabrica, SemFabrica, usarTimeDaFabrica } from './FabricaViva';
import { TituloEditavel } from './renomear';
import { Confirmacao, ErroDeEscrita, EsperandoNascer, MarcaDeOrigem, Panel, PRAZO_PARA_NASCER_MS, Vazio } from './pecas';
import { type EstadoDaResposta } from './pedido';
import { AVISOS, CONFIRMAR_ENCERRAR, motivoDaCaixaDeComando, motivoDasAcoesDaFabrica } from './textos';
import { usarOrdem, type Ordem } from './usarOrdem';


/* As ordens de ciclo de vida da fabrica, no computador e no celular. Uma
   mecanica, dois desenhos. */
export function usarAcoesDaFabrica(
  escrita: ContextoDeEscrita,
  fabrica: Fabrica | null,
  avisar: (mensagem: string) => void
) {
  const ordem = usarOrdem(avisar);
  const [confirmando, setConfirmando] = useState(false);
  const motivo = motivoDasAcoesDaFabrica(impedimentoDaEscrita(escrita));
  const alvo = fabrica
    ? { fabricaId: fabrica.id, maquinaId: fabrica.maquinaId, conversationId: fabrica.conversationId }
    : null;

  return {
    ordem,
    motivo,
    confirmando,
    pedirConfirmacaoDeEncerramento: () => {
      ordem.limparErro();
      setConfirmando(true);
    },
    desistirDoEncerramento: () => setConfirmando(false),
    pausar: () => {
      if (!alvo) return;
      void ordem.enviar(() => pausarFabrica(escrita, alvo), AVISOS.pausada);
    },
    retomar: () => {
      if (!alvo) return;
      void ordem.enviar(() => reiniciarFabrica(escrita, { ...alvo, pausada: true }), AVISOS.retomada);
    },
    reiniciar: () => {
      if (!alvo) return;
      void ordem.enviar(() => reiniciarFabrica(escrita, { ...alvo, pausada: false }), AVISOS.reiniciada);
    },
    encerrar: () => {
      if (!alvo) return;
      void ordem.enviar(() => encerrarFabrica(escrita, alvo), AVISOS.encerrada).then((deuCerto) => {
        if (deuCerto) setConfirmando(false);
      });
    }
  };
}

export type AcoesDaFabrica = ReturnType<typeof usarAcoesDaFabrica>;

/* Caixa de comando viva. O texto so e limpo quando a ordem entrou na fila. */
export function usarCaixaDeComando(
  escrita: ContextoDeEscrita,
  fabrica: Fabrica | null,
  avisar: (mensagem: string) => void
) {
  const ordem: Ordem = usarOrdem(avisar);
  const motivo = motivoDaCaixaDeComando(impedimentoDaEscrita(escrita));

  async function enviar(texto: string): Promise<boolean> {
    if (!fabrica) return false;
    return ordem.enviar(
      () =>
        mandarComando(escrita, {
          fabricaId: fabrica.id,
          maquinaId: fabrica.maquinaId,
          conversationId: fabrica.conversationId,
          texto
        }),
      AVISOS.comandoEnviado
    );
  }

  return { ordem, motivo, enviar };
}

export function FabricaTela({
  base,
  estado,
  escrita,
  fabricaId,
  resposta,
  avisar,
  verPedido,
  pedidaEm = null
}: {
  base: Firestore | null;
  estado: EstadoDoPainel;
  escrita: ContextoDeEscrita;
  fabricaId: string;
  resposta: EstadoDaResposta;
  avisar: (mensagem: string) => void;
  verPedido: () => void;
  /** Quando a ordem de abrir ESTA fabrica foi aceita, se foi nesta visita. §A.22. */
  pedidaEm?: Date | null;
}) {
  const fabrica = estado.fabricas.find((f) => f.id === fabricaId) ?? null;
  const pedidos = estado.porFabrica.get(fabricaId) ?? [];
  const pedido = pedidos[0];

  const vivo = usarTimeDaFabrica(base, fabrica);
  const acoes = usarAcoesDaFabrica(escrita, fabrica, avisar);
  const caixa = usarCaixaDeComando(escrita, fabrica, avisar);

  if (!fabrica) {
    // §A.22: "ainda nao nasceu" e "nao esta mais aqui" sao coisas diferentes e
    // nao podem ter a mesma frase. Quando o painel acabou de registrar a ordem de
    // abrir, ele passa `pedidaEm`, e ai a tela espera em vez de dar por perdida.
    const esperando = pedidaEm !== null;
    const ms = esperando ? Math.max(0, estado.agora.getTime() - pedidaEm.getTime()) : 0;
    return (
      <div className="gf-body" style={{ gridTemplateColumns: 'minmax(0,1fr)' }}>
        <Panel>
          {esperando ? (
            <EsperandoNascer
              segundos={Math.round(ms / 1000)}
              passouDoPrazo={ms > PRAZO_PARA_NASCER_MS}
              pontePronta={escrita.pontePronta}
            />
          ) : (
            <Vazio
              titulo="Esta fábrica não está mais no painel"
              detalhe="A ponte removeu ou encerrou a fábrica. Volte para a Visão geral para ver o que está aberto agora."
            />
          )}
        </Panel>
      </div>
    );
  }

  return (
    <div className="gf-body" style={{ gridTemplateColumns: 'minmax(0,1fr)' }}>
      <section className="gf-panel gf-glass gf-fv">
        <FactoryHeader
          project={fabrica.project}
          titleNode={<TituloEditavel fabrica={fabrica} escrita={escrita} avisar={avisar} />}
          agent={[fabrica.projeto, fabrica.model].filter(Boolean).join(' · ')}
          state={fabrica.state}
          elapsed={fabrica.elapsed}
          usage={fabrica.usage}
          paused={fabrica.pausada}
          busy={acoes.ordem.ocupado}
          actionsDisabledReason={acoes.motivo}
          onPause={fabrica.pausada ? acoes.retomar : acoes.pausar}
          onRestart={acoes.reiniciar}
          onStop={acoes.pedirConfirmacaoDeEncerramento}
        />
        {acoes.ordem.erro && !acoes.confirmando ? (
          <ErroDeEscrita mensagem={acoes.ordem.erro} aoFechar={acoes.ordem.limparErro} />
        ) : null}
        {fabrica.erro ? (
          <div className="caption gf-muted">{`A ponte registrou uma falha nesta fábrica: ${fabrica.erro}`}</div>
        ) : null}
        {pedido ? (
          /* Ação acima de informação: o pedido parado desta fábrica fica acima do
             chat. O pacote inteiro mora na fila de aprovações, que tem a tela
             toda para o diretor ler antes de liberar risco. */
          <div className="gf-fv-pedido gf-glass">
            <span className="caption flex items-center gap-2" style={{ color: 'var(--state-approval)', fontWeight: 700 }}>
              <StateIcon state="approval" size={10} />
              {`Esta fábrica espera você há ${pedido.waiting}`}
            </span>
            <RiskTag level={pedido.risk} />
            <MarcaDeOrigem marca={pedido.origens.risk} />
            <span className="body-strong gf-fv-pedido-titulo">{pedido.title}</span>
            {resposta.respondendo === pedido.id && resposta.ordem.erro ? (
              <ErroDeEscrita mensagem={resposta.ordem.erro} aoFechar={resposta.ordem.limparErro} />
            ) : null}
            <Button
              variant="primary"
              disabled={Boolean(resposta.motivo) || resposta.ordem.ocupado}
              onClick={() => resposta.aprovar(pedido)}
            >
              {resposta.ordem.ocupado ? 'Registrando...' : 'Aprovar'}
            </Button>
            <Button variant="secondary" onClick={verPedido}>
              Ver o pedido inteiro
            </Button>
          </div>
        ) : null}
        <ChatComCoordenador dados={vivo} coordenador="Coordenador" caixa={caixa} />
        {vivo.time ? (
          <PalcoDoTime time={vivo.time} agora={vivo.agora} semRegistro={vivo.time.semRegistro} />
        ) : (
          <SemFabrica carregando={vivo.dados.carregando} />
        )}
        <RodapeDaFabrica fabrica={fabrica} estado={estado} time={vivo.time} />
      </section>

      {acoes.confirmando ? (
        <Confirmacao
          titulo={CONFIRMAR_ENCERRAR.titulo(fabrica.project)}
          detalhe={CONFIRMAR_ENCERRAR.detalhe}
          rotuloDoBotao={CONFIRMAR_ENCERRAR.botao}
          rotuloDeCancelar={CONFIRMAR_ENCERRAR.cancelar}
          perigo
          ocupado={acoes.ordem.ocupado}
          erro={acoes.ordem.erro}
          aoConfirmar={acoes.encerrar}
          aoCancelar={acoes.desistirDoEncerramento}
        />
      ) : null}
    </div>
  );
}
