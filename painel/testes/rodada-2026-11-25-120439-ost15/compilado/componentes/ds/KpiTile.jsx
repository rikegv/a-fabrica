"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KpiTile = KpiTile;
/* KpiTile, portado de bundle.js. Numero grande em peso leve, sparkline neutro. */
const tipos_1 = require("./tipos");
function sparkline(serie, largura, altura) {
    const min = Math.min(...serie);
    const max = Math.max(...serie);
    const faixa = max - min || 1;
    const n = serie.length - 1;
    const pontos = serie.map((v, i) => [(i / n) * largura, altura - 3 - ((v - min) / faixa) * (altura - 6)]);
    const linha = pontos.map((q, i) => (i ? 'L' : 'M') + q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join(' ');
    return { linha, area: linha + ' L' + largura + ' ' + altura + ' L0 ' + altura + ' Z' };
}
function KpiTile({ label, value, unit, series, progress, delta, hint }) {
    const sp = series && series.length > 1 ? sparkline(series, 120, 36) : null;
    return (<div className={(0, tipos_1.cx)('gf-kpi', 'gf-glass')}>
      <div className="label gf-muted">{label}</div>
      <div className="gf-kpi-val">
        <span className="kpi gf-num">{value}</span>
        {unit ? <span className="kpi-unit gf-faint">{unit}</span> : null}
      </div>
      {sp ? (<svg className="gf-kpi-spark" viewBox="0 0 120 36" preserveAspectRatio="none" aria-hidden>
          <path d={sp.area} fill="var(--chart-fill)"/>
          <path d={sp.linha} fill="none" stroke="var(--chart-line)" strokeWidth={1.5} vectorEffect="non-scaling-stroke" strokeLinejoin="round"/>
        </svg>) : null}
      {progress != null ? (<div className="gf-kpi-track">
          <span style={{ width: Math.round(progress * 100) + '%' }}/>
        </div>) : null}
      <div className="gf-kpi-foot caption">
        {delta ? (<span className={(0, tipos_1.cx)('gf-kpi-delta', delta.tone ? 'gf-kpi-' + delta.tone : null)}>
            {(delta.dir === 'up' ? '↑ ' : delta.dir === 'down' ? '↓ ' : '') + delta.text}
          </span>) : null}
        {hint ? <span className="gf-faint">{hint}</span> : null}
      </div>
    </div>);
}
