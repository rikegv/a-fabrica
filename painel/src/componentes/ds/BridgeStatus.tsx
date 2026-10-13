/* BridgeStatus, portado de bundle.js. Indicador da ponte local, §A.10. */
import { StateIcon } from './StateIcon';
import { cx } from './tipos';

export interface BridgeStatusProps {
  online: boolean;
  detail?: string;
  machine?: string;
}

export function BridgeStatus({ online, detail, machine }: BridgeStatusProps) {
  const ligada = online !== false;
  return (
    <span className={cx('gf-bridge', ligada ? 'gf-bridge-on' : 'gf-bridge-off', 'caption')} title={machine ?? ''}>
      {ligada ? <span className="gf-bridge-dot" /> : <StateIcon state="offline" size={12} />}
      <span>{ligada ? 'Ponte conectada' : 'Ponte offline'}</span>
      {detail ? <span className="gf-bridge-detail">{detail}</span> : null}
    </span>
  );
}
