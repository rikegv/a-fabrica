/* FactoryHeader, portado de bundle.js. Cabecalho da tela Fabrica.
   Adicional do painel: actionsDisabledReason deixa os tres controles visiveis e
   desabilitados, dizendo por que, porque pausar, reiniciar e encerrar entram na
   Onda 2. Sem a prop, o componente se comporta como no pacote. */
import { Button } from './Button';
import { StateBadge } from './StateBadge';
import type { FactoryState } from './tipos';

export interface FactoryHeaderProps {
  project: string;
  agent: string;
  state: FactoryState;
  elapsed: string;
  usage: string;
  onPause?: () => void;
  onRestart?: () => void;
  onStop?: () => void;
  actionsDisabledReason?: string;
}

export function FactoryHeader({
  project,
  agent,
  state = 'running',
  elapsed,
  usage,
  onPause,
  onRestart,
  onStop,
  actionsDisabledReason
}: FactoryHeaderProps) {
  const pausada = state === 'idle';
  const off = Boolean(actionsDisabledReason);
  return (
    <header className="gf-fhead">
      <div className="gf-fhead-main">
        <div className="gf-fhead-title">
          <h1 className="title-lg">{project}</h1>
          <StateBadge state={state} size="lg" />
        </div>
        <div className="caption gf-fhead-meta">
          <span>{agent}</span>
          <span className="mono">{elapsed}</span>
          <span className="mono">{usage}</span>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1">
        <div className="gf-fhead-actions">
          <Button variant="secondary" onClick={off ? undefined : onPause} disabled={off}>
            {pausada ? 'Retomar' : 'Pausar'}
          </Button>
          <Button variant="secondary" onClick={off ? undefined : onRestart} disabled={off}>
            Reiniciar
          </Button>
          <Button variant="danger" onClick={off ? undefined : onStop} disabled={off}>
            Encerrar
          </Button>
        </div>
        {off ? <span className="caption gf-faint text-right">{actionsDisabledReason}</span> : null}
      </div>
    </header>
  );
}
