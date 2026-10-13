/* AlertBanner, portado de bundle.js. Faixa do que trava a operacao. */
import type { ReactNode } from 'react';
import { StateIcon } from './StateIcon';
import { cx } from './tipos';

export interface AlertBannerProps {
  tone?: 'approval' | 'offline' | 'failed';
  title: ReactNode;
  detail?: ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  /* Adicional do painel: acao visivel e desabilitada, dizendo por que. */
  actionDisabled?: boolean;
}

export function AlertBanner({
  tone = 'approval',
  title,
  detail,
  actionLabel,
  onAction,
  actionDisabled
}: AlertBannerProps) {
  return (
    <div className={cx('gf-banner', 'gf-banner-' + tone)} role={tone === 'approval' ? 'status' : 'alert'}>
      <span className="gf-banner-icon">
        <StateIcon state={tone} size={16} />
      </span>
      <div className="gf-banner-text">
        <div className="title-sm">{title}</div>
        {detail ? <div className="caption gf-banner-detail">{detail}</div> : null}
      </div>
      {actionLabel ? (
        <button
          type="button"
          className="gf-btn gf-banner-btn body-strong"
          onClick={actionDisabled ? undefined : onAction}
          disabled={actionDisabled}
          aria-disabled={actionDisabled ? true : undefined}
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
