"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RiskTag = RiskTag;
/* RiskTag, portado de bundle.js. Barras crescentes alem da cor. */
const tipos_1 = require("./tipos");
const RISCO = {
    low: 'Risco baixo',
    medium: 'Risco médio',
    high: 'Risco alto'
};
function RiskTag({ level = 'low' }) {
    const acesas = level === 'low' ? 1 : level === 'medium' ? 2 : 3;
    return (<span className={(0, tipos_1.cx)('gf-risk', 'gf-risk-' + level, 'caption')}>
      <svg width={12} height={12} viewBox="0 0 12 12" aria-hidden className="gf-icon">
        {[0, 1, 2].map((i) => (<rect key={i} x={1 + i * 4} y={8 - i * 3} width={2.5} height={3 + i * 3} rx={0.5} fill="currentColor" opacity={i < acesas ? 1 : 0.28}/>))}
      </svg>
      {RISCO[level]}
    </span>);
}
