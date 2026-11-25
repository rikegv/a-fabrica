/* BridgeStatus, portado de bundle.js. Indicador da ponte local, §A.10.

   OST 15: com mais de uma ponte, cada máquina tem o seu indicador, com a frase
   dela ("Notebook conectada", "Nuvem offline"), em `label`. Sem `label`, a frase
   de antes. BridgeList empilha os indicadores, um por máquina. */
import { StateIcon } from './StateIcon';
import { cx } from './tipos';

export interface BridgeStatusProps {
  online: boolean;
  detail?: string;
  machine?: string;
  /* OST 15: a frase da máquina. Entra só como texto. */
  label?: string;
}

export function BridgeStatus({ online, detail, machine, label }: BridgeStatusProps) {
  const ligada = online !== false;
  return (
    <span className={cx('gf-bridge', ligada ? 'gf-bridge-on' : 'gf-bridge-off', 'caption')} title={machine ?? label ?? ''}>
      {ligada ? <span className="gf-bridge-dot" /> : <StateIcon state="offline" size={12} />}
      <span className="gf-bridge-label">{label ?? (ligada ? 'Ponte conectada' : 'Ponte offline')}</span>
      {detail ? <span className="gf-bridge-detail">{detail}</span> : null}
    </span>
  );
}

export function BridgeList({ items, compact }: { items: BridgeStatusProps[]; compact?: boolean }) {
  if (items.length === 1) return <BridgeStatus {...items[0]} />;
  return (
    <span className={cx('gf-bridges', compact && 'gf-bridges-compact')}>
      {items.map((b, i) => (
        <BridgeStatus key={`${b.label ?? ''}-${i}`} {...b} />
      ))}
    </span>
  );
}
