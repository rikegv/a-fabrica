'use client';

/* ApprovalItem, portado de bundle.js. Um pedido de aprovacao completo.
   Adicional do painel: readOnlyReason. Com ele, os tres botoes aparecem
   desabilitados de verdade (sem onClick, com disabled), o campo de motivo nunca
   abre e nada pode ser escrito na base. E assim que a Onda 1 mostra a decisao
   que entra na Onda 2. */
import { useState, type ReactNode } from 'react';
import { Button } from './Button';
import { RiskTag } from './RiskTag';
import { StateIcon } from './StateIcon';
import { cx, type RiskLevel } from './tipos';

export interface ApprovalItemProps {
  title: string;
  why?: ReactNode;
  impact?: ReactNode;
  touches?: string[];
  risk?: RiskLevel;
  project?: string;
  task?: string;
  waiting?: string;
  stale?: boolean;
  touch?: boolean;
  flat?: boolean;
  onApprove?: () => void;
  onReject?: (reason: string) => void;
  onApproveWithNote?: (note: string) => void;
  decision?: 'approved' | 'rejected' | 'noted';
  decidedAt?: string;
  note?: string;
  readOnlyReason?: string;
  id?: string;
}

const DECISAO: Record<'approved' | 'rejected' | 'noted', string> = {
  approved: 'Aprovado',
  rejected: 'Recusado',
  noted: 'Aprovado com observação'
};

function Bloco({ rotulo, corpo }: { rotulo: string; corpo: ReactNode }) {
  return (
    <div className="gf-ap-block">
      <div className="label gf-muted">{rotulo}</div>
      <div className="body">{corpo}</div>
    </div>
  );
}

export function ApprovalItem(props: ApprovalItemProps) {
  const [modo, setModo] = useState<'reject' | 'note' | null>(null);
  const [texto, setTexto] = useState('');
  const risco = props.risk ?? 'low';
  const somenteLeitura = Boolean(props.readOnlyReason);

  if (props.decision) {
    return (
      <div className="gf-card gf-glass gf-ap gf-ap-done">
        <div className="gf-ap-row">
          <span className={cx('caption', 'gf-dec', 'gf-dec-' + props.decision)}>{DECISAO[props.decision]}</span>
          <span className="title-sm gf-ap-donetitle">{props.title}</span>
          <span className="caption gf-faint gf-push">{props.decidedAt}</span>
        </div>
        {props.note ? <div className="caption gf-muted gf-ap-note">{'Observação: ' + props.note}</div> : null}
      </div>
    );
  }

  function confirmar() {
    if (somenteLeitura) return;
    if (modo === 'reject' && props.onReject) props.onReject(texto.trim());
    if (modo === 'note' && props.onApproveWithNote) props.onApproveWithNote(texto.trim());
    setModo(null);
    setTexto('');
  }

  const informacao = (
    <>
      <div className="gf-ap-row">
        <RiskTag level={risco} />
        <span className="caption gf-muted">
          {props.project}
          {props.task ? ' · ' + props.task : ''}
        </span>
        <span className={cx('caption', 'gf-push', props.stale ? 'gf-wait-stale' : 'gf-faint')}>
          <StateIcon state="approval" size={10} />
          {' parado há ' + (props.waiting ?? '')}
        </span>
      </div>
      <h3 className="title-sm gf-ap-title">{props.title}</h3>
      <div className="gf-ap-grid">
        <Bloco rotulo="Por que" corpo={props.why} />
        <Bloco rotulo="Impacto" corpo={props.impact} />
      </div>
      {props.touches && props.touches.length ? (
        <div className="gf-ap-block">
          <div className="label gf-muted">O que será tocado</div>
          <ul className="gf-touch">
            {props.touches.map((t, i) => (
              <li key={i} className="mono">
                {t}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );

  const tamanho = props.touch ? 'touch' : undefined;

  let acoes: ReactNode;
  if (somenteLeitura) {
    acoes = (
      <>
        <div className="gf-ap-actions">
          <Button variant="primary" size={tamanho} disabled>
            Aprovar
          </Button>
          <Button variant="secondary" size={tamanho} disabled>
            {props.touch ? 'Com observação' : 'Aprovar com observação'}
          </Button>
          <Button variant="danger" size={tamanho} disabled>
            Recusar
          </Button>
        </div>
        <div className="caption gf-faint">{props.readOnlyReason}</div>
      </>
    );
  } else if (modo) {
    acoes = (
      <div className="gf-ap-reason">
        <label className="caption gf-muted">
          {modo === 'reject' ? 'Motivo da recusa (opcional)' : 'Observação para a fábrica'}
        </label>
        <textarea
          className="gf-input body"
          rows={2}
          value={texto}
          autoFocus
          onChange={(e) => setTexto(e.target.value)}
          placeholder={
            modo === 'reject' ? 'Ex.: não mexa no banco de produção.' : 'Ex.: pode seguir, mas faça backup antes.'
          }
        />
        <div className="gf-ap-actions">
          <Button variant={modo === 'reject' ? 'danger' : 'primary'} size={tamanho} onClick={confirmar}>
            {modo === 'reject' ? 'Confirmar recusa' : 'Aprovar com observação'}
          </Button>
          <Button
            variant="ghost"
            size={tamanho}
            onClick={() => {
              setModo(null);
              setTexto('');
            }}
          >
            Cancelar
          </Button>
        </div>
      </div>
    );
  } else {
    acoes = (
      <div className="gf-ap-actions">
        <Button variant="primary" size={tamanho} onClick={props.onApprove}>
          Aprovar
        </Button>
        <Button variant="secondary" size={tamanho} onClick={() => setModo('note')}>
          {props.touch ? 'Com observação' : 'Aprovar com observação'}
        </Button>
        <Button variant="danger" size={tamanho} onClick={() => setModo('reject')}>
          Recusar
        </Button>
      </div>
    );
  }

  if (props.flat) {
    /* No deck as acoes ficam fixas; so os detalhes acima delas rolam, no
       celular baixo, como o manual autoriza. */
    return (
      <article className={cx('gf-ap-flat', 'gf-ap', 'gf-ap-' + risco)}>
        <div className="gf-ap-content">{informacao}</div>
        <div className="gf-ap-foot">{acoes}</div>
      </article>
    );
  }

  return (
    <article className={cx('gf-card gf-glass', 'gf-ap', 'gf-ap-' + risco)}>
      {informacao}
      {acoes}
    </article>
  );
}
