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
 *
 * OST 13: sai o título grande. No topo, uma linha fina com voltar, nome,
 * situação, consumo, as abas (Ao vivo e Relatórios) e os botões. O corpo ao vivo
 * tem o chat na esquerda, um terço, e o time na direita, dois terços.
 */

import { useState } from 'react';
import type { Firestore } from 'firebase/firestore';
import { Button, Icon, RiskTag, StateBadge, StateIcon, Tabs } from '@/componentes/ds';
import {
  encerrarFabrica,
  impedimentoDaEscrita,
  mandarComando,
  pausarFabrica,
  reiniciarFabrica,
  type ContextoDeEscrita
} from '@/dados/escritas';
import { usarRelatoriosDaFabrica } from '@/dados/ouvintes';
import type { EstadoDoPainel } from '@/dados/painel';
import type { Fabrica } from '@/dados/tradutor';
import { ChatComCoordenador, PalcoDoTime, RodapeDaFabrica, SemFabrica, usarTimeDaFabrica } from './FabricaViva';
import { RelatoriosDaFabrica } from './Relatorios';
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
  voltar,
  pedidaEm = null
}: {
  base: Firestore | null;
  estado: EstadoDoPainel;
  escrita: ContextoDeEscrita;
  fabricaId: string;
  resposta: EstadoDaResposta;
  avisar: (mensagem: string) => void;
  verPedido: () => void;
  voltar: () => void;
  /** Quando a ordem de abrir ESTA fabrica foi aceita, se foi nesta visita. §A.22. */
  pedidaEm?: Date | null;
}) {
  const fabrica = estado.fabricas.find((f) => f.id === fabricaId) ?? null;
  const pedidos = estado.porFabrica.get(fabricaId) ?? [];
  const pedido = pedidos[0];

  const vivo = usarTimeDaFabrica(base, fabrica);
  const acoes = usarAcoesDaFabrica(escrita, fabrica, avisar);
  const caixa = usarCaixaDeComando(escrita, fabrica, avisar);
  const [aba, setAba] = useState<'vivo' | 'relatorios'>('vivo');
  /* A escuta dos relatórios vive enquanto a tela da fábrica está aberta, e se
     encerra ao sair dela. A conta aparece na aba. */
  const relatorios = usarRelatoriosDaFabrica(base, fabrica ? fabricaId : null);

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
        <header className="gf-fv-topo">
          <button type="button" className="gf-iconbtn" aria-label="Voltar" onClick={voltar} style={{ width: 32, height: 32 }}>
            <Icon name="back" size={16} />
          </button>
          <TituloEditavel fabrica={fabrica} escrita={escrita} avisar={avisar} pequeno />
          <StateBadge state={fabrica.state} />
          <span className="gf-fv-topo-meta caption gf-muted">
            {fabrica.pausada ? <span>pausada por você</span> : null}
            <span className="mono">{fabrica.usage}</span>
            <span className="mono">{fabrica.elapsed}</span>
            <span className="gf-faint">{[fabrica.projeto, fabrica.model].filter(Boolean).join(' · ')}</span>
          </span>
          <Tabs
            value={aba}
            onChange={(id) => setAba(id as 'vivo' | 'relatorios')}
            tabs={[
              { id: 'vivo', label: 'Ao vivo' },
              { id: 'relatorios', label: 'Relatórios', count: relatorios.itens.length || undefined }
            ]}
          />
          <span className="gf-fv-topo-acoes">
            {acoes.motivo ? (
              <span className="caption gf-faint gf-fv-topo-motivo" title={acoes.motivo}>
                {acoes.motivo}
              </span>
            ) : null}
            <Button
              variant="secondary"
              disabled={Boolean(acoes.motivo) || acoes.ordem.ocupado}
              onClick={fabrica.pausada ? acoes.retomar : acoes.pausar}
            >
              {fabrica.pausada ? 'Retomar' : 'Pausar'}
            </Button>
            <Button variant="secondary" disabled={Boolean(acoes.motivo) || acoes.ordem.ocupado} onClick={acoes.reiniciar}>
              Reiniciar
            </Button>
            <Button
              variant="danger"
              disabled={Boolean(acoes.motivo) || acoes.ordem.ocupado}
              onClick={acoes.pedirConfirmacaoDeEncerramento}
            >
              Encerrar
            </Button>
          </span>
        </header>
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
        {aba === 'relatorios' ? (
          <RelatoriosDaFabrica leitura={relatorios} estado={estado} />
        ) : (
          <div className="gf-fv-corpo">
            <ChatComCoordenador dados={vivo} coordenador="Coordenador" caixa={caixa} />
            {vivo.time ? <PalcoDoTime time={vivo.time} agora={vivo.agora} /> : <SemFabrica carregando={vivo.dados.carregando} />}
          </div>
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
