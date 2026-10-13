/* Sidebar, portado de bundle.js. Menu lateral de vidro do computador.
   Adicional do painel: rodape, que entra acima do indicador da ponte. */
import type { ReactNode } from 'react';
import { BridgeStatus, type BridgeStatusProps } from './BridgeStatus';
import { Icon, type IconName } from './Icon';
import { StateIcon } from './StateIcon';
import { cx, type FactoryState } from './tipos';

export interface SidebarProps {
  items: { id: string; label: string; icon?: IconName; count?: number | null; alert?: boolean }[];
  value: string | null;
  onChange?: (id: string) => void;
  projects?: { name: string; state: FactoryState; count?: number }[];
  bridge?: BridgeStatusProps;
  brand?: string;
  owner?: string;
  collapsed?: boolean;
  footer?: ReactNode;
}

export function Sidebar({
  items,
  value,
  onChange,
  projects,
  bridge,
  brand,
  owner,
  collapsed,
  footer
}: SidebarProps) {
  const recolhido = Boolean(collapsed);
  return (
    <aside className={cx('gf-side', 'gf-glass', recolhido && 'gf-side-col')}>
      <div className="gf-side-brand">
        <span className="gf-side-mark" aria-hidden>
          <span />
          <span />
          <span />
          <span />
        </span>
        {recolhido ? null : (
          <div>
            <div className="title-sm">{brand ?? 'Fábricas'}</div>
            {owner ? <div className="caption gf-faint">{owner}</div> : null}
          </div>
        )}
      </div>
      <nav className="gf-side-nav">
        {(items ?? []).map((it) => {
          const ativo = it.id === value;
          return (
            <button
              key={it.id}
              type="button"
              title={recolhido ? it.label : undefined}
              className={cx('gf-side-item', 'body-strong', ativo && 'gf-side-on')}
              aria-current={ativo ? 'page' : undefined}
              onClick={() => onChange?.(it.id)}
            >
              <Icon name={(it.icon ?? (it.id as IconName)) as IconName} />
              {recolhido ? null : <span className="gf-side-label">{it.label}</span>}
              {it.count ? (
                <span className={cx('gf-side-count', 'caption', it.alert && 'gf-side-alert')}>{it.count}</span>
              ) : null}
            </button>
          );
        })}
      </nav>
      {projects && projects.length && !recolhido ? (
        <div className="gf-side-sec">
          <div className="label gf-faint gf-side-sectitle">Projetos</div>
          {projects.map((pr, i) => (
            <div key={i} className="gf-side-proj body">
              <span className={'gf-s-' + (pr.state ?? 'idle')} style={{ color: 'var(--s)', display: 'flex' }}>
                <StateIcon state={pr.state ?? 'idle'} size={10} />
              </span>
              <span className="gf-side-projname">{pr.name}</span>
              {pr.count ? <span className="caption gf-faint">{pr.count}</span> : null}
            </div>
          ))}
        </div>
      ) : null}
      <div className="gf-side-foot flex flex-col gap-2">
        {recolhido ? null : footer}
        {bridge ? (
          recolhido ? (
            <span
              className={cx('gf-side-bdot', bridge.online === false && 'gf-side-bdot-off')}
              title={bridge.online === false ? 'Ponte offline' : 'Ponte conectada'}
            />
          ) : (
            <BridgeStatus {...bridge} />
          )
        ) : null}
      </div>
    </aside>
  );
}
