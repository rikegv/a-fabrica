'use client';

/*
 * Tela 1, Visao geral, no computador. Montagem portada de
 * prototipo/computador.js: linha de indicadores, painel Fabricas na esquerda e
 * painel Aguardando voce na direita.
 *
 * Modo leitura, Onda 1: os botoes de decisao aparecem desabilitados, dizendo em
 * que onda entram. Nada aqui escreve na base.
 */

import { useState } from 'react';
import { ApprovalDeck, FactoryCard, KpiTile, Pager } from '@/componentes/ds';
import type { ApprovalItemProps } from '@/componentes/ds';
import type { EstadoDoPainel } from '@/dados/painel';
import { consumoEmPartes, plural, tempoEmPartes } from '@/formato';
import { Falha, Panel, Vazio } from './pecas';
import { motivoDaDecisao } from './textos';

const POR_PAGINA = 6;

export function paraPedidoDeTela(
  pedido: EstadoDoPainel['aprovacoes'][number],
  motivo: string
): ApprovalItemProps {
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
    readOnlyReason: motivo
  };
}

export function LinhaDeIndicadores({ estado }: { estado: EstadoDoPainel }) {
  const { contagem, aprovacoes } = estado;
  const tempo = tempoEmPartes(contagem.tempoMs);
  const uso = consumoEmPartes(contagem.tokens);
  const maisAntigo = aprovacoes[0];

  return (
    <div className="gf-kpis">
      <KpiTile
        label="Em execução"
        value={String(contagem.emExecucao)}
        unit={`de ${contagem.total}`}
        progress={contagem.total ? contagem.emExecucao / contagem.total : 0}
        hint={contagem.total ? plural(contagem.concluidas, 'concluída', 'concluídas') : 'nenhuma fábrica ainda'}
      />
      <KpiTile
        label="Aguardando você"
        value={String(contagem.aguardandoAprovacao)}
        unit={contagem.aguardandoAprovacao === 1 ? 'pedido' : 'pedidos'}
        hint={maisAntigo ? `mais antigo há ${maisAntigo.waiting}` : 'nada parado'}
      />
      <KpiTile label="Tempo somado" value={tempo.valor} unit={tempo.unidade} hint="desde a abertura de cada fábrica" />
      <KpiTile label="Consumo somado" value={uso.valor} unit={uso.unidade} hint="todas as fábricas do painel" />
      <KpiTile
        label="Falhas"
        value={String(contagem.falharam)}
        unit={contagem.falharam === 1 ? 'fábrica' : 'fábricas'}
        hint="no painel agora"
      />
    </div>
  );
}

export function VisaoGeral({
  estado,
  abrirFabrica
}: {
  estado: EstadoDoPainel;
  abrirFabrica: (id: string) => void;
}) {
  const [pagina, setPagina] = useState(1);
  const total = Math.max(1, Math.ceil(estado.fabricas.length / POR_PAGINA));
  const atual = Math.min(pagina, total);
  const visiveis = estado.fabricas.slice((atual - 1) * POR_PAGINA, atual * POR_PAGINA);
  const motivo = motivoDaDecisao(estado.ponte.situacao);

  return (
    <div className="gf-body">
      <Panel
        title="Fábricas"
        sub={
          estado.fabricas.length
            ? `${plural(estado.fabricas.length, 'fábrica', 'fábricas')} · mais urgente primeiro`
            : undefined
        }
        right={
          estado.fabricas.length > POR_PAGINA ? (
            <Pager page={atual} total={total} onChange={setPagina} />
          ) : undefined
        }
      >
        {estado.erro ? (
          <Falha mensagem={estado.erro} />
        ) : estado.fabricas.length === 0 ? (
          <Vazio
            titulo={estado.carregando ? 'Lendo a base' : 'Nenhuma fábrica no painel'}
            detalhe={
              estado.carregando
                ? 'O painel está abrindo os ouvintes ao vivo da base.'
                : 'A ponte ainda não abriu nenhuma fábrica. Quando abrir a primeira, o cartão aparece aqui, ao vivo, sem recarregar a página.'
            }
          />
        ) : (
          <div className="gf-fgrid">
            {visiveis.map((f) => (
              <FactoryCard
                key={f.id}
                project={f.project}
                agent={`${f.agent} · ${f.model}`}
                state={f.state}
                doing={f.doing}
                elapsed={f.elapsed}
                usage={f.usage}
                pending={f.pending ?? undefined}
                onOpen={() => abrirFabrica(f.id)}
              />
            ))}
          </div>
        )}
      </Panel>

      <ApprovalDeck
        items={estado.aprovacoes.map((p) => paraPedidoDeTela(p, motivo))}
        readOnlyReason={motivo}
        emptyText={
          estado.ponte.situacao === 'sem maquina'
            ? 'Nenhuma ponte pareada ainda. Quando uma fábrica pedir aprovação, o pedido aparece aqui.'
            : 'Nada parado esperando você. Quando uma fábrica pedir aprovação, o pedido aparece aqui.'
        }
      />
    </div>
  );
}
