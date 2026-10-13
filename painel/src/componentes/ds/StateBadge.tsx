/* StateBadge, portado de bundle.js. Cor, forma e palavra, nunca so a cor. */
import { StateIcon } from './StateIcon';
import { cx, ESTADOS, type FactoryState } from './tipos';

export interface StateBadgeProps {
  state: FactoryState;
  label?: string;
  size?: 'md' | 'lg';
}

export function StateBadge({ state = 'idle', label, size }: StateBadgeProps) {
  return (
    <span className={cx('gf-badge', 'gf-s-' + state, size === 'lg' && 'gf-badge-lg', 'caption')}>
      <StateIcon state={state} size={size === 'lg' ? 14 : 12} />
      <span>{label ?? ESTADOS[state].label}</span>
    </span>
  );
}
