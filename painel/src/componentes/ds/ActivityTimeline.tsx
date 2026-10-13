/* ActivityTimeline, portado de bundle.js. Mais recente em cima, em destaque. */
import { StateIcon } from './StateIcon';
import { cx, type FactoryState } from './tipos';

export interface ActivityTimelineItem {
  time: string;
  text: string;
  detail?: string;
  kind?: 'step' | 'approval' | 'error' | 'done';
}

export interface ActivityTimelineProps {
  live?: boolean;
  items: ActivityTimelineItem[];
}

export function ActivityTimeline({ live, items }: ActivityTimelineProps) {
  return (
    <ol className="gf-tl">
      {(items ?? []).map((it, i) => {
        const tipo = it.kind ?? 'step';
        const atual = i === 0 && Boolean(live);
        const estado: FactoryState = atual
          ? 'running'
          : tipo === 'error'
            ? 'failed'
            : tipo === 'approval'
              ? 'approval'
              : tipo === 'done'
                ? 'done'
                : 'idle';
        return (
          <li key={i} className={cx('gf-tl-item', 'gf-tl-' + tipo, atual && 'gf-tl-latest')}>
            <span className="mono gf-tl-time">{it.time}</span>
            <span className="gf-tl-mark">
              <StateIcon state={estado} size={atual ? 12 : 10} />
            </span>
            <div className="gf-tl-body">
              <div className={atual ? 'body-strong' : 'body'}>{it.text}</div>
              {it.detail ? <div className="mono gf-muted gf-tl-detail">{it.detail}</div> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
