"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BridgeStatus = BridgeStatus;
exports.BridgeList = BridgeList;
/* BridgeStatus, portado de bundle.js. Indicador da ponte local, §A.10.

   OST 15: com mais de uma ponte, cada máquina tem o seu indicador, com a frase
   dela ("Notebook conectada", "Nuvem offline"), em `label`. Sem `label`, a frase
   de antes. BridgeList empilha os indicadores, um por máquina. */
const StateIcon_1 = require("./StateIcon");
const tipos_1 = require("./tipos");
function BridgeStatus({ online, detail, machine, label }) {
    const ligada = online !== false;
    return (<span className={(0, tipos_1.cx)('gf-bridge', ligada ? 'gf-bridge-on' : 'gf-bridge-off', 'caption')} title={machine ?? label ?? ''}>
      {ligada ? <span className="gf-bridge-dot"/> : <StateIcon_1.StateIcon state="offline" size={12}/>}
      <span className="gf-bridge-label">{label ?? (ligada ? 'Ponte conectada' : 'Ponte offline')}</span>
      {detail ? <span className="gf-bridge-detail">{detail}</span> : null}
    </span>);
}
function BridgeList({ items, compact }) {
    if (items.length === 1)
        return <BridgeStatus {...items[0]}/>;
    return (<span className={(0, tipos_1.cx)('gf-bridges', compact && 'gf-bridges-compact')}>
      {items.map((b, i) => (<BridgeStatus key={`${b.label ?? ''}-${i}`} {...b}/>))}
    </span>);
}
