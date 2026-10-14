/* FactoryHeader, portado de bundle.js. Cabecalho da tela Fabrica.

   Adicionais do painel:

   - actionsDisabledReason deixa os tres controles visiveis e desabilitados,
     dizendo por que, por exemplo com a ponte offline. Sem a prop, o componente
     se comporta como no pacote.
   - paused manda a palavra do primeiro botao, Pausar ou Retomar. O pacote
     deduzia isso do estado idle; na base, pausada e campo proprio e nao estado,
     porque §A.4 fecha a lista de estados (ver seção 3 do contrato da Onda 2).
   - busy desabilita os tres enquanto a ordem anterior esta sendo registrada, e
     assim a mesma ordem nao entra duas vezes na fila. */
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
  actionsDisabledReason?: string | null;
  paused?: boolean;
  busy?: boolean;
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
  actionsDisabledReason,
  paused,
  busy
}: FactoryHeaderProps) {
  const pausada = paused ?? state === 'idle';
  const off = Boolean(actionsDisabledReason) || busy === true;
  return (
    <header className="gf-fhead">
      <div className="gf-fhead-main">
        <div className="gf-fhead-title">
          <h1 className="title-lg">{project}</h1>
          <StateBadge state={state} size="lg" />
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
        {actionsDisabledReason ? (
          <span className="caption gf-faint gf-motivo text-right">{actionsDisabledReason}</span>
        ) : null}
      </div>
    </header>
  );
}
