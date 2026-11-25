"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FactoryHeader = FactoryHeader;
const Button_1 = require("./Button");
const StateBadge_1 = require("./StateBadge");
function FactoryHeader({ project, agent, state = 'running', elapsed, usage, onPause, onRestart, onStop, actionsDisabledReason, paused, busy, titleNode }) {
    const pausada = paused ?? state === 'idle';
    const off = Boolean(actionsDisabledReason) || busy === true;
    return (<header className="gf-fhead">
      <div className="gf-fhead-main">
        <div className="gf-fhead-title">
          {titleNode ?? <h1 className="title-lg">{project}</h1>}
          <StateBadge_1.StateBadge state={state} size="lg"/>
          {paused ? <span className="caption gf-muted">pausada por você</span> : null}
        </div>
        <div className="caption gf-fhead-meta">
          <span>{agent}</span>
          <span className="mono">{elapsed}</span>
          <span className="mono">{usage}</span>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1">
        <div className="gf-fhead-actions">
          <Button_1.Button variant="secondary" onClick={off ? undefined : onPause} disabled={off}>
            {pausada ? 'Retomar' : 'Pausar'}
          </Button_1.Button>
          <Button_1.Button variant="secondary" onClick={off ? undefined : onRestart} disabled={off}>
            Reiniciar
          </Button_1.Button>
          <Button_1.Button variant="danger" onClick={off ? undefined : onStop} disabled={off}>
            Encerrar
          </Button_1.Button>
        </div>
        {actionsDisabledReason ? (<span className="caption gf-faint gf-motivo text-right">{actionsDisabledReason}</span>) : null}
      </div>
    </header>);
}
