"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BridgeStatus = BridgeStatus;
/* BridgeStatus, portado de bundle.js. Indicador da ponte local, §A.10. */
const StateIcon_1 = require("./StateIcon");
const tipos_1 = require("./tipos");
function BridgeStatus({ online, detail, machine }) {
    const ligada = online !== false;
    return (<span className={(0, tipos_1.cx)('gf-bridge', ligada ? 'gf-bridge-on' : 'gf-bridge-off', 'caption')} title={machine ?? ''}>
      {ligada ? <span className="gf-bridge-dot"/> : <StateIcon_1.StateIcon state="offline" size={12}/>}
      <span>{ligada ? 'Ponte conectada' : 'Ponte offline'}</span>
      {detail ? <span className="gf-bridge-detail">{detail}</span> : null}
    </span>);
}
