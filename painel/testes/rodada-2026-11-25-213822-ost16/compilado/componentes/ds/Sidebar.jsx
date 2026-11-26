"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Sidebar = Sidebar;
/* Sidebar, portado de bundle.js. Menu lateral de vidro do computador.
   Adicional do painel: rodape, que entra acima do indicador da ponte.

   OST 9, pedido do diretor: o menu fica RECOLHIDO no trilho de icones e abre ao
   passar o mouse, POR CIMA da tela, sem empurrar o conteudo. Abre tambem quando
   o teclado entra nele, para quem navega com Tab, e fecha quando o foco sai. */
const react_1 = require("react");
const BridgeStatus_1 = require("./BridgeStatus");
const Icon_1 = require("./Icon");
const StateIcon_1 = require("./StateIcon");
const tipos_1 = require("./tipos");
function Sidebar({ items, value, onChange, projects, bridge, bridges, brand, owner, collapsed, expandOnHover, footer }) {
    const [aberto, setAberto] = (0, react_1.useState)(false);
    const flutua = Boolean(collapsed && expandOnHover);
    const recolhido = Boolean(collapsed) && !(flutua && aberto);
    const aoSairDoFoco = (e) => {
        if (!e.currentTarget.contains(e.relatedTarget))
            setAberto(false);
    };
    const menu = (<aside className={(0, tipos_1.cx)('gf-side', 'gf-glass', recolhido && 'gf-side-col', flutua && aberto && 'gf-side-float')}>
      <div className="gf-side-brand">
        <span className="gf-side-mark" aria-hidden>
          <span />
          <span />
          <span />
          <span />
        </span>
        {recolhido ? null : (<div>
            <div className="title-sm">{brand ?? 'Fábricas'}</div>
            {owner ? <div className="caption gf-faint">{owner}</div> : null}
          </div>)}
      </div>
      <nav className="gf-side-nav">
        {(items ?? []).map((it) => {
            const ativo = it.id === value;
            return (<button key={it.id} type="button" title={recolhido ? it.label : undefined} className={(0, tipos_1.cx)('gf-side-item', 'body-strong', ativo && 'gf-side-on')} aria-current={ativo ? 'page' : undefined} onClick={() => onChange?.(it.id)}>
              <Icon_1.Icon name={(it.icon ?? it.id)}/>
              {recolhido ? null : <span className="gf-side-label">{it.label}</span>}
              {it.count ? (<span className={(0, tipos_1.cx)('gf-side-count', 'caption', it.alert && 'gf-side-alert')}>{it.count}</span>) : null}
            </button>);
        })}
      </nav>
      {projects && projects.length && !recolhido ? (<div className="gf-side-sec">
          <div className="label gf-faint gf-side-sectitle">Projetos</div>
          {projects.map((pr, i) => (<div key={i} className="gf-side-proj body">
              <span className={'gf-s-' + (pr.state ?? 'idle')} style={{ color: 'var(--s)', display: 'flex' }}>
                <StateIcon_1.StateIcon state={pr.state ?? 'idle'} size={10}/>
              </span>
              <span className="gf-side-projname">{pr.name}</span>
              {pr.count ? <span className="caption gf-faint">{pr.count}</span> : null}
            </div>))}
        </div>) : null}
      <div className="gf-side-foot flex flex-col gap-2">
        {recolhido ? null : footer}
        {bridges && bridges.length ? (recolhido ? (<span className={(0, tipos_1.cx)('gf-side-bdot', bridges.some((b) => b.online === false) && 'gf-side-bdot-off')} title={bridges.map((b) => b.label ?? (b.online === false ? 'Ponte offline' : 'Ponte conectada')).join(', ')}/>) : (<BridgeStatus_1.BridgeList items={bridges}/>)) : bridge ? (recolhido ? (<span className={(0, tipos_1.cx)('gf-side-bdot', bridge.online === false && 'gf-side-bdot-off')} title={bridge.online === false ? 'Ponte offline' : 'Ponte conectada'}/>) : (<BridgeStatus_1.BridgeStatus {...bridge}/>)) : null}
      </div>
    </aside>);
    if (!flutua)
        return menu;
    return (<div className="gf-side-wrap" onMouseEnter={() => setAberto(true)} onMouseLeave={() => setAberto(false)} onFocus={() => setAberto(true)} onBlur={aoSairDoFoco}>
      {menu}
    </div>);
}
