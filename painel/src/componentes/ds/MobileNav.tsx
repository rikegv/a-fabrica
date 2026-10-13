/* MobileNav, portado de bundle.js. Barra inferior do celular, ordem fixa:
   Aprovações, Fábricas, Relatórios, Mais. Todo alvo com 44px. */
import { cx } from './tipos';

const TRACOS: Record<string, string> = {
  approvals: 'M10 2.5 17.5 10 10 17.5 2.5 10Z',
  factories: 'M3 3.5h6v6H3zM11 3.5h6v6h-6zM3 11.5h6v6H3zM11 11.5h6v6h-6z',
  reports: 'M5 2.5h7l3.5 3.5v11.5H5zM8 9h5M8 12h5M8 15h3',
  more: 'M5 10h.01M10 10h.01M15 10h.01'
};

export interface MobileNavProps {
  items: { id: string; label: string; count?: number | null; icon?: 'approvals' | 'factories' | 'reports' | 'more' }[];
  value: string;
  onChange?: (id: string) => void;
}

export function MobileNav({ items, value, onChange }: MobileNavProps) {
  return (
    <nav className="gf-mnav gf-glass-strong">
      {(items ?? []).map((it) => {
        const ativo = it.id === value;
        return (
          <button
            key={it.id}
            type="button"
            className={cx('gf-mnav-item', ativo && 'gf-mnav-on')}
            aria-current={ativo ? 'page' : undefined}
            onClick={() => onChange?.(it.id)}
          >
            <span className="gf-mnav-icon">
              <svg
                width={20}
                height={20}
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth={it.id === 'more' ? 3 : 1.6}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d={TRACOS[it.icon ?? it.id] ?? TRACOS.more} />
              </svg>
              {it.count ? <span className="gf-mnav-count caption">{it.count}</span> : null}
            </span>
            <span className="caption">{it.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
