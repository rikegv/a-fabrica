/* StateIcon, portado de bundle.js. Cada estado tem forma propria, para ler sem a cor. */
import type { ReactNode } from 'react';
import type { FactoryState } from './tipos';

export interface StateIconProps {
  state: FactoryState;
  size?: number;
}

export function StateIcon({ state, size = 12 }: StateIconProps) {
  const cor = 'currentColor';
  let filhos: ReactNode;

  if (state === 'running') {
    filhos = (
      <>
        <circle cx={6} cy={6} r={5.25} fill="none" stroke={cor} strokeWidth={1.5} className="gf-pulse" />
        <circle cx={6} cy={6} r={2.75} fill={cor} />
      </>
    );
  } else if (state === 'approval') {
    filhos = <path d="M6 .8 11.2 6 6 11.2.8 6Z" fill={cor} />;
  } else if (state === 'idle') {
    filhos = <circle cx={6} cy={6} r={4.5} fill="none" stroke={cor} strokeWidth={1.6} />;
  } else if (state === 'done') {
    filhos = (
      <>
        <circle cx={6} cy={6} r={5.5} fill={cor} />
        <path
          d="M3.4 6.2 5.2 8l3.4-3.6"
          fill="none"
          stroke="var(--bg-100)"
          strokeWidth={1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </>
    );
  } else if (state === 'failed') {
    filhos = <path d="M2.2 2.2l7.6 7.6M9.8 2.2 2.2 9.8" stroke={cor} strokeWidth={2.2} strokeLinecap="round" />;
  } else {
    filhos = (
      <>
        <circle cx={6} cy={6} r={4.8} fill="none" stroke={cor} strokeWidth={1.5} strokeDasharray="2.2 1.8" />
        <path d="M1.5 10.5 10.5 1.5" stroke={cor} strokeWidth={1.5} strokeLinecap="round" />
      </>
    );
  }

  return (
    <svg width={size} height={size} viewBox="0 0 12 12" aria-hidden className="gf-icon">
      {filhos}
    </svg>
  );
}
