/* FactoryCard, portado de bundle.js. Cartao de uma fabrica na Visao geral. */
import { Icon } from './Icon';
import { StateBadge } from './StateBadge';
import { StateIcon } from './StateIcon';
import { cx, type FactoryState } from './tipos';

export interface FactoryCardProps {
  project: string;
  agent: string;
  state: FactoryState;
  doing: string;
  elapsed: string;
  usage: string;
  pending?: string;
  onOpen?: () => void;
}

export function FactoryCard({
  project,
  agent,
  state = 'idle',
  doing,
  elapsed,
  usage,
  pending,
  onOpen
}: FactoryCardProps) {
  const conteudo = (
    <>
      <div className="gf-fcard-top">
        <StateBadge state={state} />
        {onOpen ? (
          <span className="gf-faint gf-fcard-go">
            <Icon name="chevronRight" size={16} />
          </span>
        ) : null}
      </div>
      <div>
        <div className="title-sm gf-fcard-project">{project}</div>
        <div className="caption gf-faint gf-fcard-agent">{agent}</div>
      </div>
      <div className="body gf-fcard-doing">{doing}</div>
      {pending ? (
        <div className="caption gf-fcard-pending">
          <StateIcon state="approval" size={10} />
          {pending}
        </div>
      ) : null}
      <div className="caption gf-fcard-foot">
        <span className="mono gf-fcard-nums">{elapsed}</span>
        <span className="mono gf-fcard-nums">{usage}</span>
      </div>
    </>
  );

  const classe = cx('gf-card', 'gf-glass', 'gf-fcard', 'gf-fcard-' + state);

  if (onOpen) {
    return (
      <button type="button" onClick={onOpen} className={classe}>
        {conteudo}
      </button>
    );
  }
  return <div className={classe}>{conteudo}</div>;
}
