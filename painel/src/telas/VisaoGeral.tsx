'use client';

/*
 * Tela 1, Visao geral, no computador. Montagem portada de
 * prototipo/computador.js: linha de indicadores, painel Fabricas na esquerda e
 * painel Aguardando voce na direita.
 *
 * Onda 2: o pedido parado no painel Aguardando voce responde de verdade, com as
 * tres respostas. A mecanica da resposta mora em pedido.tsx, porque e a mesma
 * aqui, na tela de Aprovacoes, na tela da fabrica e no celular.
 */

import { useState } from 'react';
import { ApprovalDeck, FactoryCard, KpiTile, Pager } from '@/componentes/ds';
import type { EstadoDoPainel } from '@/dados/painel';
import { consumoEmPartes, plural, tempoEmPartes } from '@/formato';
import { Falha, Panel, Vazio } from './pecas';
import { paraPedidoDeTela, type EstadoDaResposta } from './pedido';

/* OST 9: cartões compactos, cabem mais na mesma altura. Quatro colunas por três
   linhas no computador largo, três por quatro no estreito. */
const POR_PAGINA = 12;

export function LinhaDeIndicadores({ estado }: { estado: EstadoDoPainel }) {
  const { contagem, aprovacoes } = estado;
  const tarefa = tempoEmPartes(contagem.tarefaMaisLongaMs);
  const uso = consumoEmPartes(contagem.tokens);
  const maisAntigo = aprovacoes[0];

  return (
    <div className="gf-kpis">
      <KpiTile
        label="Em execução"
        value={String(contagem.emExecucao)}
        unit={`de ${contagem.total}`}
        progress={contagem.total ? contagem.emExecucao / contagem.total : 0}
        hint={contagem.fechadas ? `${plural(contagem.fechadas, 'em Fábricas fechadas', 'em Fábricas fechadas')}` : 'nenhuma fechada ainda'}
      />
      <KpiTile
        label="Aguardando você"
        value={String(contagem.aguardandoAprovacao)}
        unit={contagem.aguardandoAprovacao === 1 ? 'pedido' : 'pedidos'}
        hint={maisAntigo ? `mais antigo há ${maisAntigo.waiting}` : 'nada parado'}
      />
      {/* OST 9: o tempo somado saiu. No lugar, a tarefa em execução: quanto tempo
          anda a tarefa que está rodando agora. Com mais de uma, a mais longa. */}
      <KpiTile
        label="Tarefa em execução"
        value={contagem.tarefaMaisLongaMs === null ? 'nenhuma' : tarefa.valor}
        unit={contagem.tarefaMaisLongaMs === null ? undefined : tarefa.unidade}
        hint={
          contagem.tarefasAndando > 1
            ? `a mais longa de ${contagem.tarefasAndando} andando agora`
            : contagem.tarefasAndando === 1
              ? 'andando agora'
              : 'nenhuma tarefa andando agora'
        }
      />
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
  resposta,
  abrirFabrica
}: {
  estado: EstadoDoPainel;
  resposta: EstadoDaResposta;
  abrirFabrica: (id: string) => void;
}) {
  const [pagina, setPagina] = useState(1);
  const total = Math.max(1, Math.ceil(estado.fabricasAbertas.length / POR_PAGINA));
  const atual = Math.min(pagina, total);
  const visiveis = estado.fabricasAbertas.slice((atual - 1) * POR_PAGINA, atual * POR_PAGINA);

  return (
    <div className="gf-body">
      <Panel
        title="Fábricas"
        sub={
          /* A grade esconde as fábricas de rodada de teste, e DIZ que esconde e
             quantas. Filtro calado seria o mesmo pecado do botão que não responde,
             §A.22: o diretor precisa saber que existe coisa fora da lista. */
          estado.fabricasAbertas.length
            ? `${plural(estado.fabricasAbertas.length, 'fábrica aberta', 'fábricas abertas')} · mais urgente primeiro${
                estado.contagem.fechadas
                  ? ` · ${plural(estado.contagem.fechadas, 'fechada', 'fechadas')} em Fábricas fechadas`
                  : ''
              }${
                estado.contagem.deTeste
                  ? ` · ${plural(estado.contagem.deTeste, 'fábrica de teste escondida', 'fábricas de teste escondidas')}`
                  : ''
              }`
            : estado.contagem.deTeste
              ? `${plural(estado.contagem.deTeste, 'fábrica de teste escondida', 'fábricas de teste escondidas')}`
              : undefined
        }
        right={
          estado.fabricasAbertas.length > POR_PAGINA ? (
            <Pager page={atual} total={total} onChange={setPagina} />
          ) : undefined
        }
      >
        {estado.erro ? (
          <Falha mensagem={estado.erro} />
        ) : estado.fabricasAbertas.length === 0 ? (
          <Vazio
            titulo={estado.carregando ? 'Lendo a base' : 'Nenhuma fábrica aberta agora'}
            detalhe={
              estado.carregando
                ? 'O painel está abrindo os ouvintes ao vivo da base.'
                : estado.contagem.fechadas
                  ? 'Aqui ficam a fábrica ativa e a que perdeu a conexão nas últimas 24 horas. As concluídas estão em Fábricas fechadas, no menu.'
                  : 'A ponte ainda não abriu nenhuma fábrica. Quando abrir a primeira, o cartão aparece aqui, ao vivo, sem recarregar a página.'
            }
          />
        ) : (
          <div className="gf-fgrid gf-fgrid-compact">
            {visiveis.map((f) => (
              <FactoryCard
                key={f.id}
                project={f.project}
                agent={`${f.projeto} · ${f.model}`}
                compact
                state={f.state}
                doing={f.doing}
                elapsed={f.elapsed}
                usage={f.usage}
                pending={f.pending ?? undefined}
                opened={f.abertaEm}
                onOpen={() => abrirFabrica(f.id)}
              />
            ))}
          </div>
        )}
      </Panel>

      <ApprovalDeck
        items={estado.aprovacoes.map((p) => paraPedidoDeTela(p, resposta))}
        readOnlyReason={resposta.motivo}
        onApprove={(item) => resposta.aprovar({ id: item.id ?? '' })}
        onReject={(item, motivoDaRecusa) => resposta.recusar({ id: item.id ?? '' }, motivoDaRecusa)}
        onApproveWithNote={(item, observacao) => resposta.aprovarComObservacao({ id: item.id ?? '' }, observacao)}
        emptyText={
          estado.ponte.situacao === 'sem maquina'
            ? 'Nenhuma ponte pareada ainda. Quando uma fábrica pedir aprovação, o pedido aparece aqui.'
            : 'Nada parado esperando você. Quando uma fábrica pedir aprovação, o pedido aparece aqui.'
        }
      />
    </div>
  );
}
