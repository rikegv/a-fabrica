function MHead(p) {
  return h('header', { className: 'gf-mhead' },
    p.back ? h('button', { type: 'button', className: 'gf-iconbtn', 'aria-label': 'Voltar', onClick: p.back, style: { width: 44, height: 44 } }, h(F.Icon, { name: 'back', size: 18 })) : null,
    h('div', { style: { flex: 1, minWidth: 0 } }, h('div', { className: 'title-lg', style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, p.title), p.sub ? h('div', { className: 'caption gf-muted', style: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, p.sub) : null),
    p.right);
}
function IconBtn(p) { return h('button', { type: 'button', className: 'gf-iconbtn', 'aria-label': p.label, onClick: p.onClick, style: { width: 44, height: 44 } }, h(F.Icon, { name: p.icon, size: 18 })); }
function Sheet(p) {
  return h('div', { className: 'gf-sheet-wrap', onClick: p.onClose },
    h('div', { className: 'gf-sheet gf-glass-strong', role: 'dialog', 'aria-label': p.title, onClick: function (e) { e.stopPropagation(); } },
      h('span', { className: 'gf-sheet-grip', 'aria-hidden': true }),
      h('div', { className: 'title-md' }, p.title), p.sub ? h('div', { className: 'caption gf-muted' }, p.sub) : null,
      p.children));
}
function short(s) { return F.STATES[s].label.replace('Aguardando aprovação', 'Aprovação').replace('Aguardando comando', 'Ociosa'); }
function paginate(list, per, page) { var total = Math.max(1, Math.ceil(list.length / per)), pg = Math.min(page, total); return { items: list.slice((pg - 1) * per, pg * per), page: pg, total: total }; }

function MApp() {
  var A = useState(window.START || 'approvals'), screen = A[0], setScreen = A[1];
  var B = useState('vagas'), fid = B[0], setFid = B[1];
  var C = useState('atividade'), tab = C[0], setTab = C[1];
  var D = useState(APPROVALS), approvals = D[0], setApprovals = D[1];
  var D2 = useState(HISTORY), history = D2[0], setHistory = D2[1];
  var E = useState('r1'), rid = E[0], setRid = E[1];
  var G = useState(0), pct = G[0], setPct = G[1];
  var K = useState(null), toastMsg = K[0], setToast = K[1];
  var L = useState(true), online = L[0], setOnline = L[1];
  var M = useState(null), sheet = M[0], setSheet = M[1];
  var N = useState({ apTab: 'pend', histPage: 1, fFilter: 'all', fPage: 1, rQuery: '', rPeriod: '7', setTab: 'avisos', proj: 'vagas', model: 'Opus', cmd: '', cmdKey: 0, paused: {} }), ui = N[0], setUi = N[1];
  var O = useState({ ap: true, fail: true, bridge: true, done: false, daily: true, quiet: true }), notif = O[0], setNotif = O[1];
  var P = useState(document.documentElement.getAttribute('data-theme') || 'system'), theme = P[0], setThemeS = P[1];
  function upd(o) { setUi(function (u) { return Object.assign({}, u, o); }); }
  function setTheme(t) { setThemeS(t); if (t === 'system') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t); }
  function toast(m) { setToast(m); clearTimeout(window.__t); window.__t = setTimeout(function () { setToast(null); }, 2200); }
  function decide(a, d, note, msg) { setApprovals(function (l) { return l.filter(function (x) { return x.id !== a.id; }); }); setHistory(function (l) { return [{ decision: d, title: a.title, decidedAt: 'agora', note: note || null }].concat(l); }); toast(msg); }
  function go(s) { setSheet(null); setScreen(s); }

  var factories = FACTORIES.map(function (f) {
    var x = f;
    if (f.state === 'approval' && !approvals.some(function (a) { return a.factory === f.id; })) x = Object.assign({}, f, { state: 'running', pending: null, doing: 'Retomou depois da aprovação.' });
    if (ui.paused[f.id]) x = Object.assign({}, x, { state: 'idle', doing: 'Pausada por você.' });
    if (!online) x = Object.assign({}, x, { state: 'offline' });
    return x;
  });
  var f = factories.filter(function (x) { return x.id === fid; })[0];
  var rep = REPORTS.filter(function (r) { return r.id === rid; })[0];
  var head, body, showNav = true, nav = screen;
  var offBanner = online ? null : h(F.AlertBanner, { key: 'off', tone: 'offline', title: 'A ponte está offline', detail: 'Sem resposta há 4 min.', actionLabel: 'Reconectar', onAction: function () { setOnline(true); toast('Ponte reconectada.'); } });
  var bridgeChip = h('button', { type: 'button', className: 'gf-side-bridgebtn', onClick: function () { setOnline(!online); toast(online ? 'Simulando ponte offline.' : 'Ponte reconectada.'); } }, h(F.BridgeStatus, { online: online }));

  if (screen === 'approvals') {
    head = h(MHead, { title: 'Aprovações', sub: approvals.length ? approvals.length + ' esperando você' : 'Nada esperando você', right: bridgeChip });
    var hp = paginate(history, 5, ui.histPage);
    body = [offBanner,
      h(F.Segmented, { key: 's', block: true, value: ui.apTab, onChange: function (v) { upd({ apTab: v }); }, options: [{ id: 'pend', label: 'Pendentes (' + approvals.length + ')' }, { id: 'hist', label: 'Histórico' }] }),
      ui.apTab === 'pend'
        ? h('div', { key: 'd', style: { flex: 1, minHeight: 0, display: 'flex' } }, h(F.ApprovalDeck, { items: approvals, touch: true, onApprove: function (a) { decide(a, 'approved', null, 'Aprovado. A fábrica já retomou.'); }, onReject: function (a, w) { decide(a, 'rejected', w, 'Recusado.'); }, onApproveWithNote: function (a, n) { decide(a, 'noted', n, 'Aprovado com observação.'); } }))
        : [h('div', { key: 'h', style: { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 8 } }, hp.items.map(function (x, i) { return h(F.ApprovalItem, Object.assign({ key: x.title + i }, x)); })),
           h('div', { key: 'p', style: { display: 'flex', justifyContent: 'flex-end' } }, h(F.Pager, { page: hp.page, total: hp.total, onChange: function (p) { upd({ histPage: p }); } }))]];
  } else if (screen === 'factories') {
    var fl = factories.filter(function (x) { return ui.fFilter === 'all' || (ui.fFilter === 'me' ? (x.state === 'approval' || x.state === 'failed') : x.state === 'running'); });
    var fp = paginate(fl, 4, ui.fPage);
    head = h(MHead, { title: 'Fábricas', sub: factories.length + ' ativas · mais urgente primeiro', right: h(IconBtn, { label: 'Abrir nova fábrica', icon: 'plus', onClick: function () { go('new'); } }) });
    body = [offBanner,
      h(F.Segmented, { key: 's', block: true, value: ui.fFilter, onChange: function (v) { upd({ fFilter: v, fPage: 1 }); }, options: [{ id: 'all', label: 'Todas' }, { id: 'me', label: 'Precisam de mim' }, { id: 'run', label: 'Rodando' }] }),
      h('div', { key: 'l', style: { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', gap: 10 } }, fp.items.length ? fp.items.map(function (x) {
        return h('button', { key: x.id, type: 'button', className: 'gf-glass gf-mrow', onClick: function () { setFid(x.id); setTab('atividade'); go('factory'); }, style: { flexDirection: 'column', alignItems: 'stretch', gap: 6, borderColor: x.state === 'approval' ? 'var(--state-approval)' : x.state === 'failed' ? 'var(--state-failed)' : undefined } },
          h('div', { style: { display: 'flex', alignItems: 'center', gap: 8 } }, h('span', { className: 'title-sm', style: { flex: 1 } }, x.project), h(F.StateBadge, { state: x.state, label: short(x.state) })),
          h('div', { className: 'body gf-muted', style: { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' } }, x.doing),
          h('div', { className: 'mono gf-faint' }, x.elapsed + ' · ' + x.usage));
      }) : h('div', { className: 'body gf-muted', style: { padding: 16 } }, 'Nenhuma fábrica neste filtro.')),
      h('div', { key: 'p', style: { display: 'flex', justifyContent: 'flex-end' } }, h(F.Pager, { page: fp.page, total: fp.total, onChange: function (p) { upd({ fPage: p }); } }))];
  } else if (screen === 'factory') {
    showNav = false; nav = 'factories';
    var paused = !!ui.paused[f.id];
    head = h(MHead, { title: f.project, sub: f.agent + ' · ' + f.model + ' · ' + f.elapsed, back: function () { go('factories'); }, right: h(IconBtn, { label: 'Ações da fábrica', icon: 'more', onClick: function () { setSheet('actions'); } }) });
    var inner;
    if (tab === 'atividade') inner = h(F.ActivityTimeline, { live: f.state === 'running' || f.state === 'approval', items: TIMELINE.slice(0, 4) });
    else if (tab === 'tarefas') inner = h('div', { className: 'gf-card gf-glass' }, TASKS.slice(0, 5).map(function (t, i) { return h(F.TaskRow, Object.assign({ key: i }, t, { agent: null })); }));
    else if (tab === 'relatorios') inner = h('div', { className: 'gf-list' }, REPORTS.slice(0, 3).map(function (r) { return h('button', { key: r.id, type: 'button', className: 'gf-li', style: { minHeight: 56 }, onClick: function () { setRid(r.id); setPct(0); go('report'); } }, h('div', { className: 'gf-li-main' }, h('div', { className: 'body-strong' }, r.title), h('div', { className: 'caption gf-muted' }, r.meta))); }));
    else inner = h('div', { className: 'gf-card gf-glass' }, CHANGES.slice(0, 6).map(function (c, i) { return h(F.ChangeRow, Object.assign({ key: i }, c)); }));
    var pend = approvals.filter(function (a) { return a.factory === f.id; })[0];
    body = [offBanner,
      h('div', { key: 'st', style: { display: 'flex', alignItems: 'center', gap: 8 } }, h(F.StateBadge, { state: f.state, label: short(f.state) }), h('span', { className: 'mono gf-faint' }, f.usage)),
      pend ? h('button', { key: 'p', type: 'button', className: 'gf-glass gf-mrow', onClick: function () { upd({ apTab: 'pend' }); go('approvals'); }, style: { borderColor: 'var(--state-approval)', padding: '10px 14px' } }, h('span', { style: { color: 'var(--state-approval)', display: 'flex' } }, h(F.StateIcon, { state: 'approval', size: 12 })), h('span', { className: 'body-strong', style: { flex: 1 } }, 'Esperando você há ' + pend.waiting), h('span', { className: 'caption gf-muted' }, 'Revisar')) : null,
      h(F.Tabs, { key: 't', value: tab, onChange: setTab, tabs: [{ id: 'atividade', label: 'Atividade' }, { id: 'tarefas', label: 'Tarefas' }, { id: 'relatorios', label: 'Relatórios' }, { id: 'alteracoes', label: 'Alterações' }] }),
      h('div', { key: 'i', style: { flex: 1, minHeight: 0, overflow: 'hidden' } }, inner),
      h(F.CommandBox, { key: 'c' + ui.cmdKey, defaultValue: ui.cmd, onSaved: function () { setSheet('saved'); }, onSend: function () { upd({ cmd: '' }); toast('Ordem enviada para ' + f.project + '.'); }, disabledReason: online ? (paused ? 'Fábrica pausada. Retome para mandar ordens.' : null) : 'Ponte offline. Comandos voltam quando ela reconectar.' })];
    if (sheet === 'actions') body.push(h(Sheet, { key: 'sh', title: f.project, sub: 'O que fazer com esta fábrica', onClose: function () { setSheet(null); } },
      h('div', { className: 'gf-sheet-actions' },
        h(F.Button, { variant: 'secondary', size: 'touch', block: true, onClick: function () { var p = Object.assign({}, ui.paused); p[f.id] = !paused; upd({ paused: p }); setSheet(null); toast(paused ? 'Fábrica retomada.' : 'Fábrica pausada.'); } }, paused ? 'Retomar' : 'Pausar'),
        h(F.Button, { variant: 'secondary', size: 'touch', block: true, onClick: function () { setSheet(null); toast('Fábrica reiniciada.'); } }, 'Reiniciar'),
        h(F.Button, { variant: 'danger', size: 'touch', block: true, onClick: function () { setSheet('confirmStop'); } }, 'Encerrar'),
        h(F.Button, { variant: 'ghost', size: 'touch', block: true, onClick: function () { setSheet(null); } }, 'Cancelar'))));
    if (sheet === 'confirmStop') body.push(h(Sheet, { key: 'sh', title: 'Encerrar ' + f.project + '?', sub: 'A fábrica para agora e não pode ser retomada. O que já foi feito fica salvo.', onClose: function () { setSheet(null); } },
      h('div', { className: 'gf-sheet-actions' },
        h(F.Button, { variant: 'danger', size: 'touch', block: true, onClick: function () { go('factories'); toast('Fábrica encerrada.'); } }, 'Encerrar fábrica'),
        h(F.Button, { variant: 'ghost', size: 'touch', block: true, onClick: function () { setSheet(null); } }, 'Voltar'))));
    if (sheet === 'saved') body.push(h(Sheet, { key: 'sh', title: 'Comandos salvos', sub: 'Toque para colocar na caixa de comando', onClose: function () { setSheet(null); } },
      h('div', { className: 'gf-list' }, SAVED.map(function (x, i) { return h('button', { key: i, type: 'button', className: 'gf-li', style: { minHeight: 56, alignItems: 'flex-start' }, onClick: function () { upd({ cmd: x.text, cmdKey: ui.cmdKey + 1 }); setSheet(null); } }, h('div', { className: 'gf-li-main' }, h('div', { className: 'body-strong' }, x.name), h('div', { className: 'caption gf-muted', style: { whiteSpace: 'normal' } }, x.text))); }))));
  } else if (screen === 'reports') {
    var rl = REPORTS.filter(function (r) { return (!ui.rQuery || (r.title + r.meta).toLowerCase().indexOf(ui.rQuery.toLowerCase()) >= 0) && (ui.rPeriod !== '1' || r.meta.indexOf('Domingo') === 0); });
    head = h(MHead, { title: 'Relatórios', sub: rl.length + ' no período' });
    body = [h('label', { key: 's', className: 'gf-search', style: { height: 44 } }, h(F.Icon, { name: 'search', size: 16 }), h('input', { id: 'busca-relatorio', value: ui.rQuery, onChange: function (e) { upd({ rQuery: e.target.value }); }, placeholder: 'Buscar relatório' })),
      h(F.Segmented, { key: 'p', block: true, value: ui.rPeriod, onChange: function (v) { upd({ rPeriod: v }); }, options: [{ id: '1', label: 'Hoje' }, { id: '7', label: '7 dias' }, { id: '30', label: '30 dias' }] }),
      h('div', { key: 'l', className: 'gf-list', style: { flex: 1, minHeight: 0, overflow: 'hidden' } }, rl.length ? rl.slice(0, 6).map(function (r) {
        return h('button', { key: r.id, type: 'button', className: 'gf-li', style: { minHeight: 56 }, onClick: function () { setRid(r.id); setPct(0); go('report'); } }, h('span', { className: 'gf-faint', style: { display: 'flex' } }, h(F.Icon, { name: r.daily ? 'overview' : 'reports', size: 18 })), h('div', { className: 'gf-li-main' }, h('div', { className: 'body-strong' }, r.title), h('div', { className: 'caption gf-muted' }, r.meta)));
      }) : h('div', { className: 'body gf-muted', style: { padding: 12 } }, 'Nenhum relatório com esse termo.'))];
  } else if (screen === 'report') {
    showNav = false; nav = 'reports';
    head = h(MHead, { title: 'Relatório', sub: pct + '% lido', back: function () { go('reports'); } });
    body = h('section', { className: 'gf-reader gf-panel-solid', style: { flex: 1, position: 'relative' } },
      h('span', { className: 'gf-reader-progress', style: { width: pct + '%', top: 0, bottom: 'auto', zIndex: 1 } }),
      h('div', { className: 'gf-reader-scroll', style: { padding: '20px 18px 56px' }, onScroll: function (e) { var el = e.target; setPct(Math.round(el.scrollTop / Math.max(1, el.scrollHeight - el.clientHeight) * 100)); } },
        h('div', { className: 'caption gf-muted', style: { marginBottom: 6 } }, rep.meta), h('h1', { className: 'title-lg', style: { marginBottom: 16 } }, rep.title),
        h('div', { className: 'gf-prose prose' }, REPORT_BODY)),
      pct < 98 ? h('span', { className: 'gf-reader-fade' }) : null);
  } else if (screen === 'new') {
    showNav = false; nav = 'factories';
    var projs = FACTORIES.slice(0, 3).concat([{ id: 'novo', project: 'Painel Financeiro', folder: '~/projetos/painel-financeiro' }]);
    head = h(MHead, { title: 'Nova fábrica', back: function () { go('factories'); } });
    body = [offBanner,
      h('div', { key: 'p', className: 'gf-field' }, h('div', { className: 'label gf-muted' }, 'Projeto'), h('div', { className: 'gf-list' }, projs.map(function (x) { return h('button', { key: x.id, type: 'button', className: 'gf-li' + (ui.proj === x.id ? ' gf-li-on' : ''), style: { minHeight: 48 }, onClick: function () { upd({ proj: x.id }); } }, h('div', { className: 'gf-li-main' }, h('div', { className: 'body-strong' }, x.project), h('div', { className: 'mono gf-faint' }, x.folder))); }))),
      h('div', { key: 'm', className: 'gf-field' }, h('div', { className: 'label gf-muted' }, 'Modelo'), h(F.Segmented, { block: true, value: ui.model, onChange: function (v) { upd({ model: v }); }, options: [{ id: 'Opus', label: 'Opus', hint: 'mais capaz' }, { id: 'Sonnet', label: 'Sonnet', hint: 'equilibrado' }, { id: 'Haiku', label: 'Haiku', hint: 'econômico' }] })),
      h('div', { key: 'c', className: 'gf-field', style: { flex: 1, minHeight: 0 } }, h('div', { style: { display: 'flex', alignItems: 'center' } }, h('div', { className: 'label gf-muted', style: { flex: 1 } }, 'Comando inicial'), h('button', { type: 'button', className: 'gf-linkbtn caption', style: { minHeight: 32 }, onClick: function () { setSheet('savedNew'); } }, 'Comandos salvos')), h('textarea', { id: 'comando-inicial', className: 'gf-input body', style: { flex: 1, minHeight: 60 }, value: ui.cmd, onChange: function (e) { upd({ cmd: e.target.value }); }, placeholder: 'Diga o que a fábrica deve fazer primeiro.' })),
      h(F.Button, { key: 'b', variant: 'primary', size: 'touch', block: true, disabled: !ui.cmd.trim() || !online, onClick: function () { upd({ cmd: '' }); go('factories'); toast('Fábrica aberta em ' + projs.filter(function (x) { return x.id === ui.proj; })[0].project + '.'); } }, online ? 'Abrir fábrica' : 'Ponte offline')];
    if (sheet === 'savedNew') body.push(h(Sheet, { key: 'sh', title: 'Comandos salvos', onClose: function () { setSheet(null); } },
      h('div', { className: 'gf-list' }, SAVED.map(function (x, i) { return h('button', { key: i, type: 'button', className: 'gf-li', style: { minHeight: 56, alignItems: 'flex-start' }, onClick: function () { upd({ cmd: x.text }); setSheet(null); } }, h('div', { className: 'gf-li-main' }, h('div', { className: 'body-strong' }, x.name), h('div', { className: 'caption gf-muted', style: { whiteSpace: 'normal' } }, x.text))); }))));
  } else if (screen === 'metrics') {
    showNav = false; nav = 'more';
    head = h(MHead, { title: 'Indicadores', sub: 'Últimos 7 dias', back: function () { go('more'); } });
    body = [h('div', { key: 'k', style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 } },
        h(F.KpiTile, { label: 'Tempo', value: '41h', unit: 'em 7 dias', series: [3, 5, 4, 6, 5, 7, 7] }),
        h(F.KpiTile, { label: 'Tarefas', value: '23', unit: 'concluídas', series: [1, 3, 2, 4, 3, 5, 5], delta: { dir: 'up', text: '5 a mais', tone: 'good' } })),
      h('section', { key: 'c', className: 'gf-glass', style: { borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minHeight: 0 } },
        h('div', { style: { display: 'flex', alignItems: 'baseline', gap: 8 } }, h('div', { className: 'title-sm' }, 'Consumo por dia'), h('div', { className: 'caption gf-muted' }, 'tokens')),
        h('div', { style: { flex: 1, minHeight: 0, paddingTop: 26, display: 'flex' } }, h('div', { style: { flex: 1 } }, h(F.BarChart, { height: '100%', highlightLast: true, ticks: [1, 2, 3], format: function (v) { return v + ' mi'; }, data: DAYS.slice(-7).map(function (d) { return { label: d[0], value: d[1], display: d[1].toFixed(1).replace('.', ',') + ' mi tokens' }; }) })))),
      h('section', { key: 'p', className: 'gf-glass', style: { borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 } },
        h('div', { className: 'title-sm' }, 'Consumo por projeto'),
        h(F.BarChart, { horizontal: true, data: [{ label: 'Portal de Vagas', value: 9.8, display: '9,8 mi' }, { label: 'Folha Integração', value: 6.1, display: '6,1 mi' }, { label: 'App do Colaborador', value: 4.4, display: '4,4 mi' }, { label: 'Triagem Intelig.', value: 2.9, display: '2,9 mi' }] }))];
  } else if (screen === 'settings') {
    showNav = false; nav = 'more';
    head = h(MHead, { title: 'Configurações', back: function () { go('more'); } });
    var sc;
    function setN(k) { return function (v) { var o = Object.assign({}, notif); o[k] = v; setNotif(o); }; }
    if (ui.setTab === 'avisos') sc = h('div', { className: 'gf-glass', style: { borderRadius: 16, padding: '4px 16px' } },
      h(F.Toggle, { label: 'Pedido de aprovação', hint: 'Assim que uma fábrica parar esperando você.', checked: notif.ap, onChange: setN('ap') }),
      h(F.Toggle, { label: 'Fábrica falhou', checked: notif.fail, onChange: setN('fail') }),
      h(F.Toggle, { label: 'Ponte offline', hint: 'Depois de 1 min sem resposta.', checked: notif.bridge, onChange: setN('bridge') }),
      h(F.Toggle, { label: 'Fábrica concluiu', checked: notif.done, onChange: setN('done') }),
      h(F.Toggle, { label: 'Relatório do dia pronto', checked: notif.daily, onChange: setN('daily') }),
      h(F.Toggle, { label: 'Silêncio das 22h às 7h', hint: 'Risco alto toca mesmo assim.', checked: notif.quiet, onChange: setN('quiet') }));
    else if (ui.setTab === 'ponte') sc = h('div', { className: 'gf-glass', style: { borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 12 } },
      h('div', { style: { display: 'flex', alignItems: 'center', gap: 12 } }, h('span', { className: 'gf-s-' + (online ? 'done' : 'offline'), style: { display: 'flex', width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', background: 'var(--s-bg)', color: 'var(--s)' } }, h(F.StateIcon, { state: online ? 'done' : 'offline', size: 18 })), h('div', null, h('div', { className: 'title-md' }, online ? 'Conectada' : 'Offline'), h('div', { className: 'caption gf-muted' }, online ? 'Último sinal há 2 s' : 'Sem resposta há 4 min'))),
      h('div', null, [['Máquina', 'mac-rike'], ['Versão', '0.9.4'], ['Latência', online ? '38 ms' : 'sem sinal'], ['Desde', 'hoje, 08:12']].map(function (r, i) { return h('div', { key: i, className: 'gf-stat-row body' }, h('span', { className: 'gf-muted' }, r[0]), h('span', { className: 'mono' }, r[1])); })),
      h(F.Button, { variant: 'secondary', size: 'touch', block: true, onClick: function () { setOnline(!online); toast(online ? 'Simulando ponte offline.' : 'Ponte reconectada.'); } }, online ? 'Simular queda da ponte' : 'Reconectar'));
    else if (ui.setTab === 'projetos') sc = h('div', { className: 'gf-glass', style: { borderRadius: 16, padding: 4 } }, FACTORIES.slice(0, 5).map(function (x) { return h('div', { key: x.id, className: 'gf-li', style: { cursor: 'default' } }, h('span', { className: 'gf-faint', style: { display: 'flex' } }, h(F.Icon, { name: 'folder', size: 18 })), h('div', { className: 'gf-li-main' }, h('div', { className: 'body-strong' }, x.project), h('div', { className: 'mono gf-faint' }, x.folder))); }), h('div', { className: 'caption gf-muted', style: { padding: '8px 12px 12px' } }, 'Adicionar e editar projetos é feito no computador.'));
    else sc = h('div', { className: 'gf-glass', style: { borderRadius: 16, padding: 16, display: 'flex', flexDirection: 'column', gap: 10 } }, h('div', { className: 'body-strong' }, 'Aparência'), h(F.Segmented, { block: true, value: theme, onChange: setTheme, options: [{ id: 'system', label: 'Sistema' }, { id: 'dark', label: 'Escuro' }, { id: 'light', label: 'Claro' }] }), h('div', { className: 'caption gf-muted' }, 'O claro foi pensado para usar no sol.'));
    body = [offBanner, h(F.Segmented, { key: 's', block: true, value: ui.setTab, onChange: function (v) { upd({ setTab: v }); }, options: [{ id: 'avisos', label: 'Avisos' }, { id: 'ponte', label: 'Ponte' }, { id: 'projetos', label: 'Projetos' }, { id: 'tema', label: 'Tema' }] }), h('div', { key: 'c' }, sc)];
  } else {
    head = h(MHead, { title: 'Mais', right: bridgeChip });
    body = [offBanner, h('div', { key: 'k', style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 } },
      h(F.KpiTile, { label: 'Em execução', value: String(factories.filter(function (x) { return x.state === 'running'; }).length), unit: 'de 6', progress: factories.filter(function (x) { return x.state === 'running'; }).length / 6 }),
      h(F.KpiTile, { label: 'Consumo hoje', value: '2,4', unit: 'mi', series: [4, 5, 4, 6, 8, 7, 9, 8, 10, 12] }),
      h(F.KpiTile, { label: 'Tempo hoje', value: '7h 18', unit: 'min', series: [2, 3, 3, 5, 4, 6, 7, 6, 8, 9] }),
      h(F.KpiTile, { label: 'Tarefas', value: '23', unit: '7 dias', series: [1, 3, 2, 4, 3, 5, 5] })),
      h('div', { key: 'l', className: 'gf-glass', style: { borderRadius: 16, padding: 4 } }, [['metrics', 'Indicadores completos', 'metrics'], ['new', 'Abrir nova fábrica', 'plus'], ['settings', 'Configurações', 'settings']].map(function (r) {
        return h('button', { key: r[0], type: 'button', className: 'gf-li', style: { minHeight: 52 }, onClick: function () { go(r[0]); } }, h(F.Icon, { name: r[2], size: 18 }), h('span', { className: 'body-strong gf-li-main' }, r[1]), h('span', { className: 'gf-faint' }, h(F.Icon, { name: 'chevronRight', size: 16 })));
      }))];
  }
  return h('div', { className: 'gf-mapp' }, head, h('div', { className: 'gf-mbody' }, body),
    showNav ? h(F.MobileNav, { value: nav, onChange: go, items: [{ id: 'approvals', label: 'Aprovações', count: approvals.length || null }, { id: 'factories', label: 'Fábricas' }, { id: 'reports', label: 'Relatórios' }, { id: 'more', label: 'Mais' }] }) : null,
    toastMsg ? h('div', { className: 'gf-toast gf-glass-strong body-strong', role: 'status' }, toastMsg) : null);
}
ReactDOM.createRoot(document.getElementById('root')).render(h(MApp));
