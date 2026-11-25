"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskRow = TaskRow;
/* TaskRow, portado de bundle.js. Linha da aba Tarefas. */
const StateBadge_1 = require("./StateBadge");
function TaskRow({ state = 'idle', title, agent, elapsed, stateLabel }) {
    return (<div className="gf-row">
      <StateBadge_1.StateBadge state={state} label={stateLabel}/>
      <div className="gf-row-main">
        <div className="body">{title}</div>
        {agent ? <div className="caption gf-muted">{agent}</div> : null}
      </div>
      <span className="mono gf-faint">{elapsed}</span>
    </div>);
}
