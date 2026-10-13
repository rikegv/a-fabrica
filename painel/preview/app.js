/* Pre-visualizacao da Onda 1, MODO LEITURA. Duas telas: Visao geral e Fabrica,
   no computador e no celular. Reusa os componentes do designer (window.Fabricas)
   e os tokens. Comandar e aprovar/recusar aparecem DESABILITADOS: entram na Onda 2.
   Dados de exemplo (dados.js). A base real continua trancada; estes dados nao vem dela. */
var F = window.Fabricas, h = React.createElement, useState = React.useState, useEffect = React.useEffect;
var MOTIVO_ONDA2 = 'Entra na Onda 2';

function Banner() {
  return h('div', { className: 'gf-glass-strong caption', style: { position: 'fixed', top: 10, left: '50%', transform: 'translateX(-50%)', padding: '6px 14px', borderRadius: 999, zIndex: 20 } },
    'Pre-visualizacao · modo leitura · dados de exemplo · comandar e aprovar entram na Onda 2');
}

function AprovacaoLeitura(p) {
  var a = p.item;
  return h('section', { className: 'gf-panel gf-glass', style: { gap: 10, padding: 18, borderColor: 'var(--state-approval)' } },
    h('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } },
      h(F.StateIcon, { state: 'approval', size: 10 }),
      h('span', { className: 'caption', style: { color: 'var(--state-approval)', fontWeight: 700 } }, 'Esta fabrica espera voce ha ' + a.waiting),
      h('span', { className: 'gf-push' }), h(F.RiskTag, { level: a.risk })),
    h('div', { className: 'title-sm' }, a.title),
    h('div', { className: 'caption gf-muted' }, 'Por que: ' + a.why),
    h('div', { className: 'caption gf-muted' }, 'Impacto: ' + a.impact),
    h('div', { className: 'caption gf-faint mono', style: { whiteSpace: 'normal' } }, 'Toca: ' + a.touches.join(', ')),
    h('div', { style: { display: 'flex', gap: 8, marginTop: 4 } },
      h(F.Button, { variant: 'primary', disabled: true }, 'Aprovar'),
      h(F.Button, { variant: 'secondary', disabled: true }, 'Recusar'),
      h('span', { className: 'caption gf-faint', style: { alignSelf: 'center' } }, MOTIVO_ONDA2)));
}

function Kpis() {
  return h('div', { className: 'gf-kpis' },
    h(F.KpiTile, { label: 'Em execucao', value: '3', unit: 'de 6', progress: 0.5, hint: '2 paradas, 1 ociosa' }),
    h(F.KpiTile, { label: 'Agentes ativos', value: '9', unit: 'em 6 fabricas', series: [4, 5, 5, 7, 6, 8, 9] }),
    h(F.KpiTile, { label: 'Tempo hoje', value: '7h 18', unit: 'min', series: [2, 3, 3, 5, 4, 6, 7, 6, 8, 9] }),
    h(F.KpiTile, { label: 'Consumo hoje', value: '2,4', unit: 'mi tokens', series: [4, 5, 4, 6, 8, 7, 9, 8, 10, 12] }),
    h(F.KpiTile, { label: 'Tarefas concluidas', value: '23', unit: 'em 7 dias', series: [1, 3, 2, 4, 3, 5, 5] }));
}

function Overview(s) {
  var pend = APPROVALS;
  return h(React.Fragment, null,
    h(Kpis, null),
    h('div', { className: 'gf-body' },
      h('section', { className: 'gf-panel gf-glass' },
        h('div', { className: 'gf-panel-head' }, h('h2', { className: 'title-md' }, 'Fabricas'), h('span', { className: 'caption gf-muted' }, 'Mais urgente primeiro')),
        h('div', { className: 'gf-fgrid' }, FACTORIES.slice(0, 6).map(function (f) {
          return h(F.FactoryCard, Object.assign({ key: f.id, onOpen: function () { s.openFactory(f.id); } }, f, { agent: f.agent + ' · ' + f.model }));
        }))),
      h('div', { style: { display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0, overflow: 'auto' } },
        h('div', { className: 'label gf-muted' }, 'Aprovacoes pendentes'),
        pend.map(function (a) { return h(AprovacaoLeitura, { key: a.id, item: a }); }))));
}

function Factory(s) {
  var f = FACTORIES.filter(function (x) { return x.id === s.factoryId; })[0] || FACTORIES[0];
  var tab = s.tab, pend = APPROVALS.filter(function (a) { return a.factory === f.id; });
  var content;
  if (tab === 'atividade') content = h('div', { className: 'gf-panel-body' }, h(F.ActivityTimeline, { live: f.state === 'running' || f.state === 'approval', items: TIMELINE.slice(0, 7) }));
  else if (tab === 'tarefas') content = h('div', { className: 'gf-panel-body' }, h('div', { className: 'gf-card gf-glass' }, TASKS.map(function (t, i) { return h(F.TaskRow, Object.assign({ key: i }, t)); })));
  else if (tab === 'relatorios') content = h('div', { className: 'gf-panel-body' }, h('div', { className: 'body gf-muted' }, 'Os relatorios entram na Onda 3.'));
  else content = h('div', { className: 'gf-panel-body' }, h('div', { className: 'gf-card gf-glass' }, CHANGES.map(function (c, i) { return h(F.ChangeRow, Object.assign({ key: i }, c)); })));
  return h('div', { className: 'gf-body', style: { gridTemplateColumns: s.mobile ? '1fr' : 'minmax(0,1fr) 340px' } },
    h('section', { className: 'gf-panel gf-glass' },
      h(F.FactoryHeader, { project: f.project, agent: f.agent + ' · ' + f.model + ' · ' + f.folder, state: f.state, elapsed: f.elapsed, usage: f.usage }),
      h(F.Tabs, { value: tab, onChange: s.setTab, tabs: [{ id: 'atividade', label: 'Atividade' }, { id: 'tarefas', label: 'Tarefas', count: TASKS.length }, { id: 'relatorios', label: 'Relatorios' }, { id: 'alteracoes', label: 'Alteracoes', count: CHANGES.length }] }),
      content,
      h(F.CommandBox, { disabledReason: MOTIVO_ONDA2 + ': comandar a fabrica' })),
    s.mobile ? null : h('div', { style: { display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0, overflow: 'auto' } },
      pend.length ? h(AprovacaoLeitura, { item: pend[0] }) : null,
      h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 } },
        h(F.KpiTile, { label: 'Tempo', value: f.elapsed, hint: 'desde a abertura' }),
        h(F.KpiTile, { label: 'Consumo', value: f.usage.split(' ')[0], unit: f.usage.split(' ')[1] }),
        h(F.KpiTile, { label: 'Agentes', value: String(f.agents), unit: 'agora' }),
        h(F.KpiTile, { label: 'Tarefas', value: String(f.tasksDone), unit: 'concluidas' }))));
}

function App() {
  var A = useState('overview'), screen = A[0], setScreen = A[1];
  var B = useState('vagas'), factoryId = B[0], setFactoryId = B[1];
  var C = useState('atividade'), tab = C[0], setTab = C[1];
  var M = useState(window.matchMedia('(max-width:560px)').matches), mobile = M[0], setMobile = M[1];
  useEffect(function () { var mq = window.matchMedia('(max-width:560px)'); var on = function () { setMobile(mq.matches); }; mq.addEventListener('change', on); return function () { mq.removeEventListener('change', on); }; }, []);
  var s = { factoryId: factoryId, tab: tab, setTab: setTab, mobile: mobile, openFactory: function (id) { setFactoryId(id); setTab('atividade'); setScreen('factory'); } };
  var body = screen === 'overview' ? h(Overview, s) : h(Factory, s);
  var titulo = screen === 'overview' ? ['Visao geral', 'Domingo, 11 de outubro · 6 fabricas ativas'] : ['Posto de comando', 'Fabricas  ›  ' + (FACTORIES.filter(function (x) { return x.id === factoryId; })[0] || {}).project];

  if (mobile) {
    return h('div', { className: 'gf-app gf-mobile' },
      h(Banner, null),
      h('main', { className: 'gf-m-main', style: { padding: 12, paddingTop: 48, paddingBottom: 72, overflow: 'auto', height: '100vh' } },
        screen === 'factory' ? h('button', { type: 'button', className: 'gf-linkbtn caption', onClick: function () { setScreen('overview'); }, style: { marginBottom: 8 } }, 'Voltar') : null,
        h('h1', { className: 'title-lg', style: { marginBottom: 2 } }, titulo[0]),
        h('div', { className: 'caption gf-muted', style: { marginBottom: 12 } }, titulo[1]),
        body),
      h(F.MobileNav, { value: screen === 'factory' ? 'factories' : 'overview', onChange: function (v) { setScreen(v === 'factories' ? 'overview' : 'overview'); },
        items: [{ id: 'approvals', label: 'Aprovacoes', count: APPROVALS.length }, { id: 'factories', label: 'Fabricas' }, { id: 'reports', label: 'Relatorios' }, { id: 'more', label: 'Mais' }] }));
  }

  return h('div', { className: 'gf-app' },
    h(Banner, null),
    h(F.Sidebar, { brand: 'Fabricas', owner: 'Operacao de Rike', value: screen === 'factory' ? 'factories' : 'overview',
      onChange: function (v) { setScreen(v === 'factories' ? 'overview' : v); },
      items: [{ id: 'overview', label: 'Visao geral' }, { id: 'approvals', label: 'Aprovacoes', count: APPROVALS.length, alert: true }, { id: 'factories', label: 'Fabricas', count: FACTORIES.length }],
      projects: FACTORIES.map(function (x) { return { name: x.project, state: x.state }; }), bridge: { online: true, detail: 'mac-rike' } }),
    h('main', { className: 'gf-main', style: { gridTemplateRows: 'var(--size-topbar) auto minmax(0,1fr)' } },
      h('header', { className: 'gf-topbar' },
        screen === 'factory' ? h('button', { type: 'button', className: 'gf-iconbtn', 'aria-label': 'Voltar', onClick: function () { setScreen('overview'); }, style: { width: 36, height: 36 } }, h(F.Icon, { name: 'back', size: 18 })) : null,
        h('div', { className: 'gf-topbar-title' }, h('h1', { className: 'title-lg' }, titulo[0]), h('div', { className: 'caption gf-muted' }, titulo[1])),
        h('span', { className: 'gf-push' }),
        h('span', { className: 'caption gf-muted', style: { display: 'flex', alignItems: 'center', gap: 6 } }, h(F.StateIcon, { state: 'done', size: 10 }), 'Ponte conectada')),
      body));
}
ReactDOM.createRoot(document.getElementById('root')).render(h(App));
