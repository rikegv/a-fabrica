'use client';

/*
 * Tela 2, Aprovacoes, no computador. F3 do catalogo, §A.5. Montagem portada de
 * prototipo/computador.js: a fila na esquerda, um pedido por vez e completo, e o
 * historico das respostas na direita.
 *
 * Na Onda 1 este destino existia e ficava inerte, dizendo que responder, com
 * historico e filtro, entrava na Onda 2. Entrou aqui, e e o que esta tela faz.
 *
 * O historico sai do MESMO ouvinte da fila, sem leitura nova na base: o painel
 * le aprovacoes uma vez e separa pendentes de respondidas em memoria.
 *
 * Resposta tardia nao existe: pedido respondido nao aceita segunda resposta, e
 * quem garante isso e a regra do Firestore, nao a tela.
 */

import { useState } from 'react';
import { ApprovalDeck, ApprovalItem, Pager, Segmented } from '@/componentes/ds';
import type { EstadoDoPainel } from '@/dados/painel';
import { plural } from '@/formato';
import { Panel, Vazio } from './pecas';
import { paraPedidoDeTela, type EstadoDaResposta } from './pedido';

const POR_PAGINA = 5;

type Filtro = 'todas' | 'aprovadas' | 'recusadas';

export function Aprovacoes({
  estado,
  resposta
}: {
  estado: EstadoDoPainel;
  resposta: EstadoDaResposta;
}) {
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [pagina, setPagina] = useState(1);

  const historico = estado.decisoes.filter((d) =>
    filtro === 'todas' ? true : filtro === 'recusadas' ? d.resposta === 'rejected' : d.resposta !== 'rejected'
  );
  const total = Math.max(1, Math.ceil(historico.length / POR_PAGINA));
  const atual = Math.min(pagina, total);
  const visiveis = historico.slice((atual - 1) * POR_PAGINA, atual * POR_PAGINA);

  return (
    <div className="gf-body" style={{ gridTemplateColumns: 'minmax(0, 1.15fr) minmax(0, 1fr)' }}>
      <ApprovalDeck
        items={estado.aprovacoes.map((p) => paraPedidoDeTela(p, resposta))}
        readOnlyReason={resposta.motivo}
        onApprove={(item) => resposta.aprovar({ id: item.id ?? '' })}
        onReject={(item, motivoDaRecusa) => resposta.recusar({ id: item.id ?? '' }, motivoDaRecusa)}
        onApproveWithNote={(item, observacao) => resposta.aprovarComObservacao({ id: item.id ?? '' }, observacao)}
        emptyText={
          estado.ponte.situacao === 'sem maquina'
            ? 'Nenhuma ponte pareada ainda. Quando uma fábrica pedir aprovação, o pedido aparece aqui.'
            : 'Nada parado esperando você. Quando uma fábrica pedir aprovação, o pedido aparece aqui, ao vivo.'
        }
      />

      <Panel
        title="Histórico"
        sub={estado.decisoes.length ? plural(estado.decisoes.length, 'resposta sua', 'respostas suas') : undefined}
        right={
          estado.decisoes.length ? (
            <Segmented
              label="Filtro do histórico"
              value={filtro}
              onChange={(id) => {
                setFiltro(id as Filtro);
                setPagina(1);
              }}
              options={[
                { id: 'todas', label: 'Todas' },
                { id: 'aprovadas', label: 'Aprovadas' },
                { id: 'recusadas', label: 'Recusadas' }
              ]}
            />
          ) : undefined
        }
      >
        {visiveis.length === 0 ? (
          <Vazio
            titulo={estado.decisoes.length ? 'Nenhuma resposta com este filtro' : 'Você ainda não respondeu nada'}
            detalhe={
              estado.decisoes.length
                ? 'Troque o filtro para ver as outras respostas.'
                : 'Cada resposta sua fica registrada aqui, com a hora e a observação que você escreveu. A trilha não se apaga.'
            }
          />
        ) : (
          <>
            <div className="gf-panel-body" style={{ gap: 'var(--space-2)' }}>
              {visiveis.map((d) => (
                <ApprovalItem
                  key={d.id}
                  title={d.title}
                  decision={d.resposta}
                  decidedAt={d.quando}
                  note={d.observacao ?? undefined}
                />
              ))}
            </div>
            {historico.length > POR_PAGINA ? (
              <div className="flex justify-end">
                <Pager page={atual} total={total} onChange={setPagina} />
              </div>
            ) : null}
          </>
        )}
      </Panel>
    </div>
  );
}
