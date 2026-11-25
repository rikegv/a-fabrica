"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MobileNav = MobileNav;
/* MobileNav, portado de bundle.js. Barra inferior do celular, ordem fixa:
   Aprovações, Fábricas, Relatórios, Mais. Todo alvo com 44px. */
const tipos_1 = require("./tipos");
const TRACOS = {
    approvals: 'M10 2.5 17.5 10 10 17.5 2.5 10Z',
    factories: 'M3 3.5h6v6H3zM11 3.5h6v6h-6zM3 11.5h6v6H3zM11 11.5h6v6h-6z',
    reports: 'M5 2.5h7l3.5 3.5v11.5H5zM8 9h5M8 12h5M8 15h3',
    more: 'M5 10h.01M10 10h.01M15 10h.01'
};
function MobileNav({ items, value, onChange }) {
    return (<nav className="gf-mnav gf-glass-strong">
      {(items ?? []).map((it) => {
            const ativo = it.id === value;
            return (<button key={it.id} type="button" className={(0, tipos_1.cx)('gf-mnav-item', ativo && 'gf-mnav-on')} aria-current={ativo ? 'page' : undefined} onClick={() => onChange?.(it.id)}>
            <span className="gf-mnav-icon">
              <svg width={20} height={20} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth={it.id === 'more' ? 3 : 1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d={TRACOS[it.icon ?? it.id] ?? TRACOS.more}/>
              </svg>
              {it.count ? <span className="gf-mnav-count caption">{it.count}</span> : null}
            </span>
            <span className="caption">{it.label}</span>
          </button>);
        })}
    </nav>);
}
