/* Pager, portado de bundle.js. Paginacao compacta: e o que substitui a rolagem. */
import { Icon } from './Icon';

export interface PagerProps {
  page: number;
  total: number;
  onChange?: (page: number) => void;
  label?: string;
}

export function Pager({ page = 1, total = 1, onChange, label }: PagerProps) {
  return (
    <div className="gf-pager">
      <span className="caption gf-muted gf-num">{label ?? page + ' de ' + total}</span>
      <button
        type="button"
        className="gf-iconbtn"
        aria-label="Página anterior"
        disabled={page <= 1}
        onClick={() => onChange?.(page - 1)}
      >
        <Icon name="chevronLeft" size={16} />
      </button>
      <button
        type="button"
        className="gf-iconbtn"
        aria-label="Próxima página"
        disabled={page >= total}
        onClick={() => onChange?.(page + 1)}
      >
        <Icon name="chevronRight" size={16} />
      </button>
    </div>
  );
}
