"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActivityTimeline = ActivityTimeline;
/* ActivityTimeline, portado de bundle.js. Mais recente em cima, em destaque. */
const StateIcon_1 = require("./StateIcon");
const tipos_1 = require("./tipos");
function ActivityTimeline({ live, items }) {
    return (<ol className="gf-tl">
      {(items ?? []).map((it, i) => {
            const tipo = it.kind ?? 'step';
            const atual = i === 0 && Boolean(live);
            const estado = atual
                ? 'running'
                : tipo === 'error'
                    ? 'failed'
                    : tipo === 'approval'
                        ? 'approval'
                        : tipo === 'done'
                            ? 'done'
                            : 'idle';
            return (<li key={i} className={(0, tipos_1.cx)('gf-tl-item', 'gf-tl-' + tipo, atual && 'gf-tl-latest')}>
            <span className="mono gf-tl-time">{it.time}</span>
            <span className="gf-tl-mark">
              <StateIcon_1.StateIcon state={estado} size={atual ? 12 : 10}/>
            </span>
            <div className="gf-tl-body">
              <div className={atual ? 'body-strong' : 'body'}>{it.text}</div>
              {it.detail ? <div className="mono gf-muted gf-tl-detail">{it.detail}</div> : null}
            </div>
          </li>);
        })}
    </ol>);
}
