"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StateBadge = StateBadge;
/* StateBadge, portado de bundle.js. Cor, forma e palavra, nunca so a cor. */
const StateIcon_1 = require("./StateIcon");
const tipos_1 = require("./tipos");
function StateBadge({ state = 'idle', label, size }) {
    return (<span className={(0, tipos_1.cx)('gf-badge', 'gf-s-' + state, size === 'lg' && 'gf-badge-lg', 'caption')}>
      <StateIcon_1.StateIcon state={state} size={size === 'lg' ? 14 : 12}/>
      <span>{label ?? tipos_1.ESTADOS[state].label}</span>
    </span>);
}
