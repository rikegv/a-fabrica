function fmtMi(v) { return v.toFixed(1).replace('.', ',') + ' mi'; }

function Topbar(p) {
  return h('header', { className: 'gf-topbar' },
    p.back ? h('button', { type: 'button', className: 'gf-iconbtn', 'aria-label': 'Voltar', onClick: p.back, style: { width: 36, height: 36 } }, h(F.Icon, { name: 'back', size: 18 })) : null,
    h('div', { className: 'gf-topbar-title' }, h('h1', { className: 'title-lg' }, p.title), p.sub ? h('div', { className: 'caption gf-muted' }, p.sub) : null),
    p.right);
}

function Panel(p) {
  return h('section', { className: 'gf-panel ' + (p.solid ? 'gf-panel-solid' : 'gf-glass'), style: p.style },
    p.title ? h('div', { className: 'gf-panel-head' }, h('h2', { className: 'title-md' }, p.title), p.sub ? h('span', { className: 'caption gf-muted' }, p.sub) : null, h('span', { className: 'gf-push' }), p.right) : null,
    p.children);
}

/* ---------- Screens ---------- */

function Overview(s) {
  var list = s.factories.slice(0, 6);
  return [
    h('div', { key: 'k', className: 'gf-kpis' },
      h(F.KpiTile, { label: 'Em execução', value: '3', unit: 'de ' + s.factories.length, progress: 3 / s.factories.length, hint: '2 paradas, 1 ociosa' }),
      h(F.KpiTile, { label: 'Agentes ativos', value: '9', unit: 'em ' + s.factories.length + ' fábricas', series: [4, 5, 5, 7, 6, 8, 9], delta: { dir: 'up', text: '3 desde 9h' } }),
      h(F.KpiTile, { label: 'Tempo hoje', value: '7h 18', unit: 'min', series: [2, 3, 3, 5, 4, 6, 7, 6, 8, 9], delta: { dir: 'up', text: '12% vs. ontem' } }),
      h(F.KpiTile, { label: 'Consumo hoje', value: '2,4', unit: 'mi tokens', series: [4, 5, 4, 6, 8, 7, 9, 8, 10, 12], delta: { dir: 'up', text: '18% vs. ontem', tone: 'bad' } }),
      h(F.KpiTile, { label: 'Tarefas concluídas', value: '23', unit: 'em 7 dias', series: [1, 3, 2, 4, 3, 5, 5], delta: { dir: 'up', text: '5 a mais', tone: 'good' } })),
    h('div', { key: 'b', className: 'gf-body' },
      h(Panel, { title: 'Fábricas', sub: 'Mais urgente primeiro', right: h(F.Button, { variant: 'ghost', onClick: function () { s.go('factories'); } }, 'Ver todas') },
        h('div', { className: 'gf-fgrid' }, list.map(function (f) { return h(F.FactoryCard, Object.assign({ key: f.id, onOpen: function () { s.openFactory(f.id); } }, f, { agent: f.agent + ' · ' + f.model })); }))),
      h(F.ApprovalDeck, { items: s.approvals, onApprove: s.approve, onReject: s.reject, onApproveWithNote: s.approveNote }))
  ];
}

function Factories(s) {
  var st = useState('all'), filter = st[0], setFilter = st[1];
  var list = s.factories.filter(function (f) {
    if (filter === 'me') return f.state === 'approval' || f.state === 'failed';
    if (filter === 'run') return f.state === 'running';
    if (filter === 'stop') return f.state === 'idle' || f.state === 'done';
    return true;
  });
  return h(Panel, { title: 'Todas as fábricas', sub: s.factories.length + ' ativas', 
    right: h(F.Segmented, { value: filter, onChange: setFilter, options: [{ id: 'all', label: 'Todas' }, { id: 'me', label: 'Precisam de mim' }, { id: 'run', label: 'Rodando' }, { id: 'stop', label: 'Paradas' }] }) },
    h('div', { className: 'gf-fgrid', style: { gridTemplateRows: 'repeat(2, minmax(0, 1fr))' } }, list.map(function (f) { return h(F.FactoryCard, Object.assign({ key: f.id, onOpen: function () { s.openFactory(f.id); } }, f, { agent: f.agent + ' · ' + f.model })); })),
    list.length === 0 ? h('div', { className: 'body gf-muted' }, 'Nenhuma fábrica neste filtro.') : null);
}

function Factory(s) {
  var f = s.factories.filter(function (x) { return x.id === s.factoryId; })[0] || s.factories[0];
  var tab = s.tab, pend = s.approvals.filter(function (a) { return a.factory === f.id; });
  var content;
  if (tab === 'atividade') content = h('div', { className: 'gf-panel-body' }, h(F.ActivityTimeline, { live: f.state === 'running' || f.state === 'approval', items: TIMELINE.slice(0, 6) }), h('button', { type: 'button', className: 'gf-linkbtn caption', style: { alignSelf: 'flex-start', marginLeft: 12 } }, 'Ver histórico completo (48 passos)'));
  else if (tab === 'tarefas') content = h('div', { className: 'gf-panel-body' }, h('div', { className: 'gf-card gf-glass' }, TASKS.map(function (t, i) { return h(F.TaskRow, Object.assign({ key: i }, t)); })));
  else if (tab === 'relatorios') content = h('div', { className: 'gf-panel-body' }, h('div', { className: 'gf-list' }, REPORTS.filter(function (r) { return r.factory === f.id || (!r.factory && r.id === 'r0'); }).concat(REPORTS.slice(5, 6)).map(function (r) {
    return h('button', { key: r.id, type: 'button', className: 'gf-li', onClick: function () { s.openReport(r.id); } }, h(F.Icon, { name: 'reports', size: 18 }), h('div', { className: 'gf-li-main' }, h('div', { className: 'body-strong' }, r.title), h('div', { className: 'caption gf-muted' }, r.meta)), h('span', { className: 'gf-faint' }, h(F.Icon, { name: 'chevronRight', size: 16 })));
  })));
  else content = h('div', { className: 'gf-panel-body' },
    h('div', { className: 'caption gf-muted', style: { display: 'flex', gap: 16 } }, h('span', null, '7 arquivos'), h('span', { className: 'mono', style: { color: 'var(--diff-add)' } }, '+348'), h('span', { className: 'mono', style: { color: 'var(--diff-del)' } }, '-132')),
    h('div', { className: 'gf-card gf-glass' }, CHANGES.map(function (c, i) { return h(F.ChangeRow, Object.assign({ key: i }, c)); })));

  return h('div', { className: 'gf-body', style: { gridTemplateColumns: 'minmax(0,1fr) 340px' } },
    h('section', { className: 'gf-panel gf-glass' },
      h(F.FactoryHeader, { project: f.project, agent: f.agent + ' · ' + f.model + ' · ' + f.folder, state: f.state, elapsed: f.elapsed, usage: f.usage }),
      h('div', null, h(F.Tabs, { value: tab, onChange: s.setTab, tabs: [{ id: 'atividade', label: 'Atividade' }, { id: 'tarefas', label: 'Tarefas', count: TASKS.length }, { id: 'relatorios', label: 'Relatórios', count: 2 }, { id: 'alteracoes', label: 'Alterações', count: CHANGES.length }] })),
      content,
      h(F.CommandBox, { onSend: function (t) { s.toast('Ordem enviada para ' + f.project + '.'); }, onSaved: noop, disabledReason: s.online ? null : 'A ponte está offline. Comandos voltam quando ela reconectar.' })),
    h('div', { style: { display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 } },
      pend.length ? h('section', { className: 'gf-panel gf-glass', style: { gap: 10, padding: 18, borderColor: 'var(--state-approval)' } },
        h('div', { className: 'caption', style: { color: 'var(--state-approval)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 } }, h(F.StateIcon, { state: 'approval', size: 10 }), 'Esta fábrica espera você há ' + pend[0].waiting),
        h('div', { className: 'title-sm' }, pend[0].title),
        h('div', { style: { display: 'flex', gap: 8 } }, h(F.Button, { variant: 'primary', onClick: function () { s.approve(pend[0]); } }, 'Aprovar'), h(F.Button, { variant: 'secondary', onClick: function () { s.go('approvals'); } }, 'Ver detalhes'))) : null,
      h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 } },
        h(F.KpiTile, { label: 'Tempo', value: f.elapsed, hint: 'desde a abertura' }),
        h(F.KpiTile, { label: 'Consumo', value: f.usage.split(' ')[0], unit: f.usage.split(' ')[1], hint: 'tokens' }),
        h(F.KpiTile, { label: 'Agentes', value: String(f.agents), unit: 'agora' }),
        h(F.KpiTile, { label: 'Tarefas', value: String(f.tasksDone), unit: 'concluídas' })),
      h(Panel, { title: 'Agentes nesta fábrica' },
        h('div', { className: 'gf-list' },
          [['Fábrica principal', 'approval', 'Esperando aprovação'], ['Subagente de testes', 'running', 'Escrevendo testes'], ['Subagente de validação', 'running', 'Validando formatos']].slice(0, Math.max(f.agents, 1)).map(function (a, i) {
            return h('div', { key: i, className: 'gf-li', style: { cursor: 'default' } }, h('span', { className: 'gf-s-' + a[1], style: { color: 'var(--s)', display: 'flex' } }, h(F.StateIcon, { state: a[1], size: 12 })), h('div', { className: 'gf-li-main' }, h('div', { className: 'body-strong' }, a[0]), h('div', { className: 'caption gf-muted' }, a[2])));
          })))));
}

function Approvals(s) {
  var fs = useState('all'), filt = fs[0], setFilt = fs[1];
  var ps = useState(1), page = ps[0], setPage = ps[1];
  var hist = s.history.filter(function (x) { return filt === 'all' || (filt === 'ok' ? x.decision !== 'rejected' : x.decision === 'rejected'); });
  var per = 6, total = Math.max(1, Math.ceil(hist.length / per)), pg = Math.min(page, total);
  return h('div', { className: 'gf-body', style: { gridTemplateColumns: 'minmax(0, 1.15fr) minmax(0, 1fr)' } },
    h(F.ApprovalDeck, { items: s.approvals, onApprove: s.approve, onReject: s.reject, onApproveWithNote: s.approveNote }),
    h(Panel, { title: 'Histórico', sub: s.history.length + ' respostas', right: h(F.Segmented, { value: filt, onChange: function (v) { setFilt(v); setPage(1); }, options: [{ id: 'all', label: 'Todas' }, { id: 'ok', label: 'Aprovadas' }, { id: 'no', label: 'Recusadas' }] }) },
      h('div', { className: 'gf-panel-body', style: { gap: 8 } }, hist.slice((pg - 1) * per, pg * per).map(function (x, i) { return h(F.ApprovalItem, Object.assign({ key: x.title + i }, x)); })),
      h('div', { style: { display: 'flex', justifyContent: 'flex-end' } }, h(F.Pager, { page: pg, total: total, onChange: setPage }))));
}

function NewFactory(s) {
  var a = useState('vagas'), proj = a[0], setProj = a[1];
  var b = useState('Opus'), model = b[0], setModel = b[1];
  var c = useState(''), cmd = c[0], setCmd = c[1];
  var projects = s.factories.map(function (f) { return { id: f.id, name: f.project, folder: f.folder }; }).concat([{ id: 'novo', name: 'Painel Financeiro', folder: '~/projetos/painel-financeiro' }]);
  return h('div', { className: 'gf-body', style: { gridTemplateColumns: 'minmax(0,1fr) 360px' } },
    h(Panel, {},
      h('div', { className: 'gf-field' }, h('div', { className: 'label gf-muted' }, '1. Projeto'),
        h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 10 } }, projects.map(function (p) {
          return h('button', { key: p.id, type: 'button', className: 'gf-pick' + (proj === p.id ? ' gf-pick-on' : ''), onClick: function () { setProj(p.id); } }, h('span', { className: 'title-sm' }, p.name), h('span', { className: 'mono gf-faint', style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, p.folder));
        }))),
      h('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 20 } },
        h('div', { className: 'gf-field' }, h('div', { className: 'label gf-muted' }, '2. Agente'), h(F.Segmented, { block: true, value: 'cc', options: [{ id: 'cc', label: 'Claude Code' }] }), h('span', { className: 'caption gf-faint' }, 'Outros agentes entram em Configurações.')),
        h('div', { className: 'gf-field' }, h('div', { className: 'label gf-muted' }, 'Modelo'), h(F.Segmented, { block: true, value: model, onChange: setModel, options: [{ id: 'Opus', label: 'Opus', hint: 'mais capaz' }, { id: 'Sonnet', label: 'Sonnet', hint: 'equilibrado' }, { id: 'Haiku', label: 'Haiku', hint: 'mais econômico' }] }))),
      h('div', { className: 'gf-field', style: { flex: 1, minHeight: 0 } }, h('div', { className: 'label gf-muted' }, '3. Comando inicial'),
        h('textarea', { className: 'gf-input body', style: { flex: 1, minHeight: 120 }, value: cmd, onChange: function (e) { setCmd(e.target.value); }, placeholder: 'Diga o que a fábrica deve fazer primeiro. Ex.: implemente o upload de documentos do candidato e me peça aprovação antes de mexer no banco.' })),
      h('div', { style: { display: 'flex', gap: 8, justifyContent: 'flex-end' } },
        h(F.Button, { variant: 'ghost', onClick: function () { s.go('overview'); } }, 'Cancelar'),
        h(F.Button, { variant: 'primary', disabled: !cmd.trim() || !s.online, onClick: function () { s.toast('Fábrica aberta em ' + projects.filter(function (p) { return p.id === proj; })[0].name + '.'); s.go('overview'); } }, s.online ? 'Abrir fábrica' : 'Ponte offline'))),
    h(Panel, { title: 'Comandos salvos', sub: 'Clique para usar' },
      h('div', { className: 'gf-list' }, SAVED.map(function (x, i) {
        return h('button', { key: i, type: 'button', className: 'gf-li', onClick: function () { setCmd(x.text); }, style: { alignItems: 'flex-start' } }, h('div', { className: 'gf-li-main' }, h('div', { className: 'body-strong' }, x.name), h('div', { className: 'caption gf-muted', style: { whiteSpace: 'normal' } }, x.text)));
      }))));
}

function Reports(s) {
  var a = useState('7'), period = a[0], setPeriod = a[1];
  var q = useState(''), query = q[0], setQuery = q[1];
  var pr = useState(0), pct = pr[0], setPct = pr[1];
  var list = REPORTS.filter(function (r) { return !query || (r.title + r.meta).toLowerCase().indexOf(query.toLowerCase()) >= 0; });
  var cur = REPORTS.filter(function (r) { return r.id === s.reportId; })[0] || REPORTS[1];
  return h('div', { className: 'gf-body', style: { gridTemplateColumns: '380px minmax(0,1fr)' } },
    h(Panel, {},
      h('label', { className: 'gf-search' }, h(F.Icon, { name: 'search', size: 16 }), h('input', { value: query, onChange: function (e) { setQuery(e.target.value); }, placeholder: 'Buscar por projeto, fábrica ou assunto' })),
      h('div', { style: { display: 'flex', gap: 8, alignItems: 'center' } }, h(F.Segmented, { value: period, onChange: setPeriod, options: [{ id: '1', label: 'Hoje' }, { id: '7', label: '7 dias' }, { id: '30', label: '30 dias' }] }), h('span', { className: 'gf-push' }), h(F.Button, { variant: 'ghost' }, 'Projeto')),
      h('div', { className: 'gf-panel-body' }, h('div', { className: 'gf-list' }, list.slice(0, 8).map(function (r) {
        return h('button', { key: r.id, type: 'button', className: 'gf-li' + (r.id === cur.id ? ' gf-li-on' : ''), onClick: function () { s.openReport(r.id); setPct(0); } },
          h('span', { className: 'gf-faint', style: { display: 'flex' } }, h(F.Icon, { name: r.daily ? 'overview' : 'reports', size: 18 })),
          h('div', { className: 'gf-li-main' }, h('div', { className: 'body-strong' }, r.title), h('div', { className: 'caption gf-muted' }, r.meta)));
      })))),
    h('section', { className: 'gf-reader gf-panel-solid', style: { position: 'relative' } },
      h('div', { className: 'gf-reader-bar' },
        h('div', { style: { flex: 1, minWidth: 0 } }, h('div', { className: 'caption gf-muted' }, cur.meta), h('div', { className: 'title-md' }, cur.title)),
        h('span', { className: 'caption gf-faint gf-num' }, pct + '% lido'),
        h(F.Button, { variant: 'secondary', icon: h(F.Icon, { name: 'copy', size: 16 }) }, 'Copiar'),
        cur.factory ? h(F.Button, { variant: 'secondary', onClick: function () { s.openFactory(cur.factory); } }, 'Abrir fábrica') : null,
        h('span', { className: 'gf-reader-progress', style: { width: pct + '%' } })),
      h('div', { className: 'gf-reader-scroll', onScroll: function (e) { var el = e.target; setPct(Math.round(el.scrollTop / Math.max(1, el.scrollHeight - el.clientHeight) * 100)); } },
        h('div', { className: 'gf-report' }, h('div', { className: 'gf-prose prose' }, REPORT_BODY))),
      pct < 98 ? h('span', { className: 'gf-reader-fade' }) : null));
}

function Metrics(s) {
  var a = useState('14'), period = a[0], setPeriod = a[1];
  var days = period === '7' ? DAYS.slice(-7) : DAYS;
  return [
    h('div', { key: 'k', className: 'gf-kpis' },
      h(F.KpiTile, { label: 'Fábricas em execução', value: '3', unit: 'de 6', progress: .5, hint: 'agora' }),
      h(F.KpiTile, { label: 'Agentes por fábrica', value: '1,5', unit: 'em média', series: [1, 1.2, 1.1, 1.4, 1.3, 1.6, 1.5], hint: 'pico de 3' }),
      h(F.KpiTile, { label: 'Tempo acumulado', value: '41h 06', unit: 'min', series: [3, 5, 4, 6, 5, 7, 7], hint: 'em 7 dias' }),
      h(F.KpiTile, { label: 'Consumo no período', value: '25,5', unit: 'mi tokens', series: DAYS.map(function (d) { return d[1]; }), delta: { dir: 'up', text: '9% vs. período anterior', tone: 'bad' } }),
      h(F.KpiTile, { label: 'Tarefas concluídas', value: '23', unit: 'em 7 dias', series: [1, 3, 2, 4, 3, 5, 5], delta: { dir: 'up', text: '5 a mais', tone: 'good' } })),
    h('div', { key: 'b', style: { display: 'grid', gridTemplateColumns: 'minmax(0,1.5fr) minmax(0,1fr)', gridTemplateRows: 'minmax(0,1fr) minmax(0,1fr)', gap: 12, minHeight: 0 } },
      h(Panel, { title: 'Consumo por dia', sub: 'milhões de tokens', right: h(F.Segmented, { value: period, onChange: setPeriod, options: [{ id: '7', label: '7 dias' }, { id: '14', label: '14 dias' }] }) },
        h('div', { style: { flex: 1, minHeight: 0, display: 'flex', paddingTop: 30 } }, h('div', { style: { flex: 1 } }, h(F.BarChart, { height: '100%', highlightLast: true, ticks: [1, 2, 3], labelEvery: period === '7' ? 1 : 2, format: function (v) { return v + ' mi'; }, data: days.map(function (d) { return { label: d[0], short: d[0], value: d[1], display: fmtMi(d[1]) + ' tokens' }; }) })))),
      h(Panel, { title: 'Consumo por projeto', sub: '14 dias' },
        h(F.BarChart, { horizontal: true, data: [{ label: 'Portal de Vagas', value: 9.8, display: '9,8 mi' }, { label: 'Folha Integração', value: 6.1, display: '6,1 mi' }, { label: 'App do Colaborador', value: 4.4, display: '4,4 mi' }, { label: 'Triagem Inteligente', value: 2.9, display: '2,9 mi' }, { label: 'Base de Conhecimento', value: 1.4, display: '1,4 mi' }, { label: 'Site Institucional', value: 0.9, display: '0,9 mi' }] })),
      h(Panel, { title: 'Por fábrica', sub: 'hoje' },
        h('table', { className: 'gf-table body' },
          h('thead', null, h('tr', { className: 'label gf-muted' }, h('th', null, 'Fábrica'), h('th', null, 'Estado'), h('th', { className: 'gf-r' }, 'Agentes'), h('th', { className: 'gf-r' }, 'Tempo'), h('th', { className: 'gf-r' }, 'Consumo'))),
          h('tbody', null, s.factories.map(function (f) { return h('tr', { key: f.id }, h('td', null, f.project), h('td', null, h(F.StateBadge, { state: f.state, label: F.STATES[f.state].label.replace('Aguardando aprovação', 'Aprovação').replace('Aguardando comando', 'Ociosa') })), h('td', { className: 'gf-r mono' }, f.agents), h('td', { className: 'gf-r mono' }, f.elapsed), h('td', { className: 'gf-r mono' }, f.usage.replace(' tokens', ''))); })))),
      h(Panel, { title: 'Tarefas concluídas', sub: 'por dia, 7 dias' },
        h('div', { style: { flex: 1, minHeight: 0, display: 'flex', paddingTop: 30 } }, h('div', { style: { flex: 1 } }, h(F.BarChart, { height: '100%', highlightLast: true, ticks: [2, 4, 6], data: [['5/10', 1], ['6/10', 3], ['7/10', 2], ['8/10', 4], ['9/10', 3], ['10/10', 5], ['11/10', 5]].map(function (d) { return { label: d[0], value: d[1], display: d[1] + ' tarefas' }; }) })))))
  ];
}

function Settings(s) {
  var n = s.notif;
  function set(k) { return function (v) { var o = Object.assign({}, n); o[k] = v; s.setNotif(o); }; }
  return h('div', { style: { display: 'grid', gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr) minmax(0,1fr)', gap: 12, minHeight: 0 } },
    h(Panel, { title: 'Projetos', sub: '7 cadastrados', right: h(F.Button, { variant: 'secondary', icon: h(F.Icon, { name: 'plus', size: 16 }) }, 'Adicionar') },
      h('div', { className: 'gf-list' }, s.factories.map(function (f) { return { name: f.project, folder: f.folder, n: 1 }; }).concat([{ name: 'Painel Financeiro', folder: '~/projetos/painel-financeiro', n: 0 }]).map(function (p, i) {
        return h('div', { key: i, className: 'gf-li', style: { cursor: 'default' } }, h('span', { className: 'gf-faint', style: { display: 'flex' } }, h(F.Icon, { name: 'folder', size: 18 })), h('div', { className: 'gf-li-main' }, h('div', { className: 'body-strong' }, p.name), h('div', { className: 'mono gf-faint' }, p.folder)), h('span', { className: 'caption gf-muted' }, p.n ? '1 fábrica' : 'sem fábrica'));
      }))),
    h(Panel, { title: 'Ponte local' },
      h('div', { style: { display: 'flex', alignItems: 'center', gap: 14 } },
        h('span', { className: 'gf-s-' + (s.online ? 'done' : 'offline'), style: { display: 'flex', width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', background: 'var(--s-bg)', color: 'var(--s)' } }, h(F.StateIcon, { state: s.online ? 'done' : 'offline', size: 18 })),
        h('div', null, h('div', { className: 'title-md' }, s.online ? 'Conectada' : 'Offline'), h('div', { className: 'caption gf-muted' }, s.online ? 'Último sinal há 2 s' : 'Sem resposta há 4 min'))),
      h('div', null, [['Máquina', 'mac-rike'], ['Versão da ponte', '0.9.4'], ['Latência', s.online ? '38 ms' : 'sem sinal'], ['Fábricas atendidas', '6'], ['Conectada desde', 'hoje, 08:12']].map(function (r, i) { return h('div', { key: i, className: 'gf-stat-row body' }, h('span', { className: 'gf-muted' }, r[0]), h('span', { className: 'mono' }, r[1])); })),
      h('div', { style: { display: 'flex', gap: 8, marginTop: 'auto' } }, h(F.Button, { variant: 'secondary', onClick: function () { s.setOnline(!s.online); } }, s.online ? 'Simular queda' : 'Reconectar'), h(F.Button, { variant: 'ghost', icon: h(F.Icon, { name: 'copy', size: 16 }) }, 'Copiar instalação'))),
    h(Panel, { title: 'Avisos no celular' },
      h('div', null,
        h(F.Toggle, { label: 'Pedido de aprovação', hint: 'Assim que uma fábrica parar esperando você.', checked: n.ap, onChange: set('ap') }),
        h(F.Toggle, { label: 'Fábrica falhou', checked: n.fail, onChange: set('fail') }),
        h(F.Toggle, { label: 'Ponte offline', hint: 'Depois de 1 min sem resposta.', checked: n.bridge, onChange: set('bridge') }),
        h(F.Toggle, { label: 'Fábrica concluiu', checked: n.done, onChange: set('done') }),
        h(F.Toggle, { label: 'Relatório do dia pronto', checked: n.daily, onChange: set('daily') }),
        h(F.Toggle, { label: 'Silêncio das 22h às 7h', hint: 'Aprovação de risco alto toca mesmo assim.', checked: n.quiet, onChange: set('quiet') }))));
}

/* ---------- App ---------- */

var TITLES = { overview: ['Visão geral', 'Domingo, 11 de outubro · 6 fábricas ativas'], factories: ['Fábricas', 'Clique em uma fábrica para abrir o posto de comando'], factory: ['Fábrica', ''], approvals: ['Aprovações', 'Mais antiga primeiro'], new: ['Nova fábrica', 'Escolha o projeto, o modelo e diga o que fazer'], reports: ['Relatórios', 'Fechamentos e consolidado diário'], metrics: ['Indicadores', 'Últimos 14 dias'], settings: ['Configurações', 'Projetos, ponte e avisos'] };

function App() {
  var A = useState(window.START || 'overview'), screen = A[0], setScreen = A[1];
  var B = useState('vagas'), factoryId = B[0], setFactoryId = B[1];
  var C = useState('atividade'), tab = C[0], setTab = C[1];
  var D = useState(APPROVALS), approvals = D[0], setApprovals = D[1];
  var E = useState(HISTORY), history = E[0], setHistory = E[1];
  var G = useState(true), online = G[0], setOnline = G[1];
  var I = useState('r1'), reportId = I[0], setReportId = I[1];
  var J = useState({ ap: true, fail: true, bridge: true, done: false, daily: true, quiet: true }), notif = J[0], setNotif = J[1];
  var K = useState(null), toastMsg = K[0], setToast = K[1];
  var factories = FACTORIES.map(function (f) {
    var p = approvals.filter(function (a) { return a.factory === f.id; });
    if (f.state === 'approval' && !p.length) return Object.assign({}, f, { state: 'running', pending: null, doing: 'Retomou depois da aprovação. Rodando a migração em homologação.' });
    return f;
  });
  function toast(m) { setToast(m); setTimeout(function () { setToast(null); }, 2400); }
  function decide(a, decision, note) { setApprovals(function (l) { return l.filter(function (x) { return x.id !== a.id; }); }); setHistory(function (l) { return [{ decision: decision, title: a.title, decidedAt: 'agora', note: note }].concat(l); }); }
  var s = {
    factories: factories, approvals: approvals, history: history, online: online, setOnline: setOnline, reportId: reportId, notif: notif, setNotif: setNotif, factoryId: factoryId, tab: tab, setTab: setTab, toast: toast,
    go: function (x) { setScreen(x); },
    openFactory: function (id) { setFactoryId(id); setTab('atividade'); setScreen('factory'); },
    openReport: function (id) { setReportId(id); setScreen('reports'); },
    approve: function (a) { decide(a, 'approved'); toast('Aprovado. A fábrica já retomou.'); },
    reject: function (a, why) { decide(a, 'rejected', why || null); toast('Recusado. A fábrica vai buscar outro caminho.'); },
    approveNote: function (a, note) { decide(a, 'noted', note || null); toast('Aprovado com observação.'); }
  };
  var f = factories.filter(function (x) { return x.id === factoryId; })[0];
  var t = TITLES[screen];
  var title = screen === 'factory' ? 'Posto de comando' : t[0], sub = screen === 'factory' ? 'Fábricas  ›  ' + f.project : t[1];
  var right = screen === 'overview' || screen === 'factories' ? h(F.Button, { variant: 'primary', icon: h(F.Icon, { name: 'plus', size: 16 }), onClick: function () { setScreen('new'); } }, 'Abrir nova fábrica') : null;
  var body = screen === 'overview' ? Overview(s) : screen === 'factories' ? h(Factories, s) : screen === 'factory' ? Factory(s) : screen === 'approvals' ? h(Approvals, s) : screen === 'new' ? h(NewFactory, s) : screen === 'reports' ? h(Reports, s) : screen === 'metrics' ? h(Metrics, s) : h(Settings, s);
  var nav = screen === 'factory' ? 'factories' : screen === 'new' ? null : screen;
  return h('div', { className: 'gf-app' },
    h(F.Sidebar, { brand: 'Fábricas', owner: 'Operação de Rike', value: nav, onChange: setScreen, onBridge: function () { setOnline(!online); },
      items: [{ id: 'overview', label: 'Visão geral' }, { id: 'approvals', label: 'Aprovações', count: approvals.length || null, alert: true }, { id: 'factories', label: 'Fábricas', count: factories.length }, { id: 'reports', label: 'Relatórios' }, { id: 'metrics', label: 'Indicadores' }, { id: 'settings', label: 'Configurações' }],
      projects: factories.map(function (x) { return { name: x.project, state: online ? x.state : 'offline' }; }), bridge: { online: online, detail: online ? 'mac-rike' : 'há 4 min' } }),
    h('main', { className: 'gf-main', style: { gridTemplateRows: online ? (screen === 'overview' || screen === 'metrics' ? 'var(--size-topbar) auto minmax(0,1fr)' : 'var(--size-topbar) minmax(0,1fr)') : (screen === 'overview' || screen === 'metrics' ? 'var(--size-topbar) auto auto minmax(0,1fr)' : 'var(--size-topbar) auto minmax(0,1fr)') } },
      h(Topbar, { title: title, sub: sub, right: right, back: screen === 'factory' ? function () { setScreen('factories'); } : null }),
      online ? null : h(F.AlertBanner, { tone: 'offline', title: 'A ponte está offline', detail: 'Sem resposta da máquina local há 4 min. As fábricas não recebem comandos até ela voltar.', actionLabel: 'Reconectar', onAction: function () { setOnline(true); } }),
      body),
    toastMsg ? h('div', { className: 'gf-glass-strong body-strong', style: { position: 'fixed', left: '50%', bottom: 28, transform: 'translateX(-50%)', padding: '12px 18px', borderRadius: 12, zIndex: 9 } }, toastMsg) : null);
}
ReactDOM.createRoot(document.getElementById('root')).render(h(App));
