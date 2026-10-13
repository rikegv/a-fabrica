/* TaskRow, portado de bundle.js. Linha da aba Tarefas. */
import { StateBadge } from './StateBadge';
import type { FactoryState } from './tipos';

export interface TaskRowProps {
  state: FactoryState;
  title: string;
  agent?: string;
  elapsed?: string;
  stateLabel?: string;
}

export function TaskRow({ state = 'idle', title, agent, elapsed, stateLabel }: TaskRowProps) {
  return (
    <div className="gf-row">
      <StateBadge state={state} label={stateLabel} />
      <div className="gf-row-main">
        <div className="body">{title}</div>
        {agent ? <div className="caption gf-muted">{agent}</div> : null}
      </div>
      <span className="mono gf-faint">{elapsed}</span>
    </div>
  );
}
