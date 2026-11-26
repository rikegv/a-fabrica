"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Tabs = Tabs;
/* Tabs, portado de bundle.js. Abas da tela Fabrica. */
const tipos_1 = require("./tipos");
function Tabs({ tabs, value, onChange }) {
    return (<div className="gf-tabs" role="tablist">
      {(tabs ?? []).map((t) => {
            const ativa = t.id === value;
            return (<button key={t.id} type="button" role="tab" aria-selected={ativa} className={(0, tipos_1.cx)('gf-tab', 'body-strong', ativa && 'gf-tab-on')} onClick={() => onChange?.(t.id)}>
            {t.label}
            {t.count != null ? <span className="gf-count caption">{t.count}</span> : null}
          </button>);
        })}
    </div>);
}
