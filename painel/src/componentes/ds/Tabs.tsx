/* Tabs, portado de bundle.js. Abas da tela Fabrica. */
import { cx } from './tipos';

export interface TabsProps {
  tabs: { id: string; label: string; count?: number }[];
  value: string;
  onChange?: (id: string) => void;
}

export function Tabs({ tabs, value, onChange }: TabsProps) {
  return (
    <div className="gf-tabs" role="tablist">
      {(tabs ?? []).map((t) => {
        const ativa = t.id === value;
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={ativa}
            className={cx('gf-tab', 'body-strong', ativa && 'gf-tab-on')}
            onClick={() => onChange?.(t.id)}
          >
            {t.label}
            {t.count != null ? <span className="gf-count caption">{t.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
