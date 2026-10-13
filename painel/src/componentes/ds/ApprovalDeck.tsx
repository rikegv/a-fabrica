'use client';

/* ApprovalDeck, portado de bundle.js. Painel Aguardando voce: um pedido por
   vez, completo, com navegacao 1 de N. Sem pedidos, o painel fica no lugar com
   uma frase curta, para o layout nao pular. */
import { useState } from 'react';
import { ApprovalItem, type ApprovalItemProps } from './ApprovalItem';
import { Icon } from './Icon';
import { cx } from './tipos';

export interface ApprovalDeckProps {
  items: ApprovalItemProps[];
  touch?: boolean;
  onApprove?: (item: ApprovalItemProps) => void;
  onReject?: (item: ApprovalItemProps, reason: string) => void;
  onApproveWithNote?: (item: ApprovalItemProps, note: string) => void;
  readOnlyReason?: string;
  emptyText?: string;
}

export function ApprovalDeck({
  items,
  touch,
  onApprove,
  onReject,
  onApproveWithNote,
  readOnlyReason,
  emptyText
}: ApprovalDeckProps) {
  const [indice, setIndice] = useState(0);
  const lista = items ?? [];
  const i = Math.min(indice, Math.max(lista.length - 1, 0));
  const atual = lista[i];

  return (
    <section className={cx('gf-deck', 'gf-glass')}>
      <header className="gf-deck-head">
        <span className="gf-deck-count title-sm">{lista.length}</span>
        <div className="gf-deck-title">
          <div className="title-md">{lista.length ? 'Aguardando você' : 'Nada esperando você'}</div>
          {lista.length ? <div className="caption gf-muted">Mais antiga primeiro</div> : null}
        </div>
        {lista.length > 1 ? (
          <div className="gf-deck-nav">
            <span className="caption gf-muted gf-num">{i + 1 + ' de ' + lista.length}</span>
            <button
              type="button"
              className="gf-iconbtn"
              aria-label="Anterior"
              disabled={i === 0}
              onClick={() => setIndice(i - 1)}
            >
              <Icon name="chevronLeft" size={16} />
            </button>
            <button
              type="button"
              className="gf-iconbtn"
              aria-label="Próxima"
              disabled={i >= lista.length - 1}
              onClick={() => setIndice(i + 1)}
            >
              <Icon name="chevronRight" size={16} />
            </button>
          </div>
        ) : null}
      </header>
      {atual ? (
        <ApprovalItem
          key={atual.id ?? atual.title}
          {...atual}
          flat
          touch={touch}
          readOnlyReason={readOnlyReason}
          onApprove={readOnlyReason ? undefined : () => onApprove?.(atual)}
          onReject={readOnlyReason ? undefined : (motivo: string) => onReject?.(atual, motivo)}
          onApproveWithNote={readOnlyReason ? undefined : (obs: string) => onApproveWithNote?.(atual, obs)}
        />
      ) : (
        <div className="gf-deck-empty body gf-muted">
          {emptyText ?? 'Quando uma fábrica pedir aprovação, o pedido aparece aqui.'}
        </div>
      )}
    </section>
  );
}
