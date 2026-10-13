/* @ds-bundle: {"format":4,"namespace":"Fabricas","components":[{"name":"Sidebar"},{"name":"KpiTile"},{"name":"ApprovalDeck"},{"name":"AlertBanner"},{"name":"StateBadge"},{"name":"BridgeStatus"},{"name":"FactoryCard"},{"name":"FactoryHeader"},{"name":"ApprovalItem"},{"name":"RiskTag"},{"name":"Button"},{"name":"Tabs"},{"name":"ActivityTimeline"},{"name":"CommandBox"},{"name":"TaskRow"},{"name":"ChangeRow"},{"name":"ReportView"},{"name":"Segmented"},{"name":"Toggle"},{"name":"Pager"},{"name":"BarChart"},{"name":"MobileNav"}]} */
(function () {
  var R = window.React, h = R.createElement, useState = R.useState, useRef = R.useRef, useEffect = R.useEffect;
  function cx() { return Array.prototype.filter.call(arguments, Boolean).join(' '); }

  var STATES = {
    running: { label: 'Em execução' },
    approval: { label: 'Aguardando aprovação' },
    idle: { label: 'Aguardando comando' },
    done: { label: 'Concluída' },
    failed: { label: 'Falhou' },
    offline: { label: 'Ponte offline' }
  };

  /* Each state has its own shape, so it reads even without color. */
  function StateIcon(p) {
    var s = p.state, z = p.size || 12, c = 'currentColor';
    var kids;
    if (s === 'running') kids = [h('circle', { key: 1, cx: 6, cy: 6, r: 5.25, fill: 'none', stroke: c, strokeWidth: 1.5, className: 'gf-pulse' }), h('circle', { key: 2, cx: 6, cy: 6, r: 2.75, fill: c })];
    else if (s === 'approval') kids = [h('path', { key: 1, d: 'M6 .8 11.2 6 6 11.2.8 6Z', fill: c })];
    else if (s === 'idle') kids = [h('circle', { key: 1, cx: 6, cy: 6, r: 4.5, fill: 'none', stroke: c, strokeWidth: 1.6 })];
    else if (s === 'done') kids = [h('circle', { key: 1, cx: 6, cy: 6, r: 5.5, fill: c }), h('path', { key: 2, d: 'M3.4 6.2 5.2 8l3.4-3.6', fill: 'none', stroke: 'var(--bg-100)', strokeWidth: 1.6, strokeLinecap: 'round', strokeLinejoin: 'round' })];
    else if (s === 'failed') kids = [h('path', { key: 1, d: 'M2.2 2.2l7.6 7.6M9.8 2.2 2.2 9.8', stroke: c, strokeWidth: 2.2, strokeLinecap: 'round' })];
    else kids = [h('circle', { key: 1, cx: 6, cy: 6, r: 4.8, fill: 'none', stroke: c, strokeWidth: 1.5, strokeDasharray: '2.2 1.8' }), h('path', { key: 2, d: 'M1.5 10.5 10.5 1.5', stroke: c, strokeWidth: 1.5, strokeLinecap: 'round' })];
    return h('svg', { width: z, height: z, viewBox: '0 0 12 12', 'aria-hidden': true, className: 'gf-icon' }, kids);
  }

  function StateBadge(p) {
    var s = p.state || 'idle';
    return h('span', { className: cx('gf-badge', 'gf-s-' + s, p.size === 'lg' && 'gf-badge-lg', 'caption') },
      h(StateIcon, { state: s, size: p.size === 'lg' ? 14 : 12 }), h('span', null, p.label || STATES[s].label));
  }

  function Button(p) {
    var v = p.variant || 'secondary', rest = {};
    for (var k in p) if (k !== 'variant' && k !== 'size' && k !== 'icon' && k !== 'block' && k !== 'className') rest[k] = p[k];
    rest.className = cx('gf-btn', 'gf-btn-' + v, p.size === 'touch' && 'gf-btn-touch', p.block && 'gf-btn-block', 'body-strong', p.className);
    if (!rest.type) rest.type = 'button';
    return h('button', rest, p.icon || null, p.children);
  }

  function AlertBanner(p) {
    var tone = p.tone || 'approval';
    return h('div', { className: cx('gf-banner', 'gf-banner-' + tone), role: tone === 'approval' ? 'status' : 'alert' },
      h('span', { className: 'gf-banner-icon' }, h(StateIcon, { state: tone, size: 16 })),
      h('div', { className: 'gf-banner-text' },
        h('div', { className: 'title-sm' }, p.title),
        p.detail ? h('div', { className: 'caption gf-banner-detail' }, p.detail) : null),
      p.actionLabel ? h('button', { type: 'button', className: 'gf-btn gf-banner-btn body-strong', onClick: p.onAction }, p.actionLabel) : null);
  }

  function BridgeStatus(p) {
    var on = p.online !== false;
    return h('span', { className: cx('gf-bridge', on ? 'gf-bridge-on' : 'gf-bridge-off', 'caption'), title: p.machine || '' },
      on ? h('span', { className: 'gf-bridge-dot' }) : h(StateIcon, { state: 'offline', size: 12 }),
      h('span', null, on ? 'Ponte conectada' : 'Ponte offline'),
      p.detail ? h('span', { className: 'gf-bridge-detail' }, p.detail) : null);
  }

  function FactoryCard(p) {
    var s = p.state || 'idle';
    var Tag = p.onOpen ? 'button' : 'div';
    return h(Tag, { type: p.onOpen ? 'button' : undefined, onClick: p.onOpen, className: cx('gf-card', 'gf-glass', 'gf-fcard', 'gf-fcard-' + s) },
      h('div', { className: 'gf-fcard-top' },
        h(StateBadge, { state: s }),
        p.onOpen ? h('span', { className: 'gf-faint gf-fcard-go' }, h(Icon, { name: 'chevronRight', size: 16 })) : null),
      h('div', null, h('div', { className: 'title-sm gf-fcard-project' }, p.project), h('div', { className: 'caption gf-faint' }, p.agent)),
      h('div', { className: 'body gf-fcard-doing' }, p.doing),
      p.pending ? h('div', { className: 'caption gf-fcard-pending' }, h(StateIcon, { state: 'approval', size: 10 }), p.pending) : null,
      h('div', { className: 'caption gf-fcard-foot' },
        h('span', { className: 'mono gf-fcard-nums' }, p.elapsed),
        h('span', { className: 'mono gf-fcard-nums' }, p.usage)));
  }

  function FactoryHeader(p) {
    var s = p.state || 'running';
    var paused = s === 'idle';
    return h('header', { className: 'gf-fhead' },
      h('div', { className: 'gf-fhead-main' },
        h('div', { className: 'gf-fhead-title' },
          h('h1', { className: 'title-lg' }, p.project),
          h(StateBadge, { state: s, size: 'lg' })),
        h('div', { className: 'caption gf-fhead-meta' },
          h('span', null, p.agent),
          h('span', { className: 'mono' }, p.elapsed),
          h('span', { className: 'mono' }, p.usage))),
      h('div', { className: 'gf-fhead-actions' },
        h(Button, { variant: 'secondary', onClick: p.onPause }, paused ? 'Retomar' : 'Pausar'),
        h(Button, { variant: 'secondary', onClick: p.onRestart }, 'Reiniciar'),
        h(Button, { variant: 'danger', onClick: p.onStop }, 'Encerrar')));
  }

  var RISK = { low: 'Risco baixo', medium: 'Risco médio', high: 'Risco alto' };
  function RiskTag(p) {
    var l = p.level || 'low', n = l === 'low' ? 1 : l === 'medium' ? 2 : 3;
    return h('span', { className: cx('gf-risk', 'gf-risk-' + l, 'caption') },
      h('svg', { width: 12, height: 12, viewBox: '0 0 12 12', 'aria-hidden': true, className: 'gf-icon' },
        [0, 1, 2].map(function (i) { return h('rect', { key: i, x: 1 + i * 4, y: 8 - i * 3, width: 2.5, height: 3 + i * 3, rx: .5, fill: 'currentColor', opacity: i < n ? 1 : .28 }); })),
      RISK[l]);
  }

  function Block(label, body) {
    return h('div', { className: 'gf-ap-block' }, h('div', { className: 'label gf-muted' }, label), h('div', { className: 'body' }, body));
  }

  var DECISION = { approved: 'Aprovado', rejected: 'Recusado', noted: 'Aprovado com observação' };
  function ApprovalItem(p) {
    var st = useState(null), mode = st[0], setMode = st[1];
    var tx = useState(''), text = tx[0], setText = tx[1];
    var risk = p.risk || 'low';
    if (p.decision) {
      return h('div', { className: 'gf-card gf-glass gf-ap gf-ap-done' },
        h('div', { className: 'gf-ap-row' },
          h('span', { className: cx('caption', 'gf-dec', 'gf-dec-' + p.decision) }, DECISION[p.decision]),
          h('span', { className: 'title-sm gf-ap-donetitle' }, p.title),
          h('span', { className: 'caption gf-faint gf-push' }, p.decidedAt)),
        p.note ? h('div', { className: 'caption gf-muted gf-ap-note' }, 'Observação: ' + p.note) : null);
    }
    function confirm() {
      if (mode === 'reject' && p.onReject) p.onReject(text.trim());
      if (mode === 'note' && p.onApproveWithNote) p.onApproveWithNote(text.trim());
      setMode(null); setText('');
    }
    var info = [
      h('div', { key: 'r', className: 'gf-ap-row' },
        h(RiskTag, { level: risk }),
        h('span', { className: 'caption gf-muted' }, p.project, p.task ? ' · ' + p.task : ''),
        h('span', { className: cx('caption', 'gf-push', p.stale ? 'gf-wait-stale' : 'gf-faint') }, h(StateIcon, { state: 'approval', size: 10 }), ' parado há ' + p.waiting)),
      h('h3', { key: 't', className: 'title-sm gf-ap-title' }, p.title),
      h('div', { key: 'g', className: 'gf-ap-grid' },
        Block('Por que', p.why),
        Block('Impacto', p.impact)),
      p.touches && p.touches.length ? h('div', { key: 'o', className: 'gf-ap-block' },
        h('div', { className: 'label gf-muted' }, 'O que será tocado'),
        h('ul', { className: 'gf-touch' }, p.touches.map(function (t, i) { return h('li', { key: i, className: 'mono' }, t); }))) : null];
    var sz = p.touch ? 'touch' : undefined;
    var actions = mode ? h('div', { className: 'gf-ap-reason' },
        h('label', { className: 'caption gf-muted' }, mode === 'reject' ? 'Motivo da recusa (opcional)' : 'Observação para a fábrica'),
        h('textarea', { className: 'gf-input body', rows: 2, value: text, autoFocus: true, onChange: function (e) { setText(e.target.value); }, placeholder: mode === 'reject' ? 'Ex.: não mexa no banco de produção.' : 'Ex.: pode seguir, mas faça backup antes.' }),
        h('div', { className: 'gf-ap-actions' },
          h(Button, { variant: mode === 'reject' ? 'danger' : 'primary', size: sz, onClick: confirm }, mode === 'reject' ? 'Confirmar recusa' : 'Aprovar com observação'),
          h(Button, { variant: 'ghost', size: sz, onClick: function () { setMode(null); setText(''); } }, 'Cancelar')))
      : h('div', { className: 'gf-ap-actions' },
          h(Button, { variant: 'primary', size: sz, onClick: p.onApprove }, 'Aprovar'),
          h(Button, { variant: 'secondary', size: sz, onClick: function () { setMode('note'); } }, p.touch ? 'Com observação' : 'Aprovar com observação'),
          h(Button, { variant: 'danger', size: sz, onClick: function () { setMode('reject'); } }, 'Recusar'));
    if (p.flat) {
      /* In the deck the actions stay pinned; on a short phone only the details above them scroll. */
      return h('article', { className: cx('gf-ap-flat', 'gf-ap', 'gf-ap-' + risk) },
        h('div', { className: 'gf-ap-content' }, info),
        h('div', { className: 'gf-ap-foot' }, actions));
    }
    return h('article', { className: cx('gf-card gf-glass', 'gf-ap', 'gf-ap-' + risk) }, info, actions);
  }

  function Tabs(p) {
    return h('div', { className: 'gf-tabs', role: 'tablist' }, (p.tabs || []).map(function (t) {
      var on = t.id === p.value;
      return h('button', { key: t.id, type: 'button', role: 'tab', 'aria-selected': on, className: cx('gf-tab', 'body-strong', on && 'gf-tab-on'), onClick: function () { p.onChange && p.onChange(t.id); } },
        t.label, t.count != null ? h('span', { className: 'gf-count caption' }, t.count) : null);
    }));
  }

  function ActivityTimeline(p) {
    var items = p.items || [];
    return h('ol', { className: 'gf-tl' }, items.map(function (it, i) {
      var kind = it.kind || 'step';
      var latest = i === 0 && p.live;
      return h('li', { key: i, className: cx('gf-tl-item', 'gf-tl-' + kind, latest && 'gf-tl-latest') },
        h('span', { className: 'mono gf-tl-time' }, it.time),
        h('span', { className: 'gf-tl-mark' }, h(StateIcon, { state: latest ? 'running' : kind === 'error' ? 'failed' : kind === 'approval' ? 'approval' : kind === 'done' ? 'done' : 'idle', size: latest ? 12 : 10 })),
        h('div', { className: 'gf-tl-body' },
          h('div', { className: latest ? 'body-strong' : 'body' }, it.text),
          it.detail ? h('div', { className: 'mono gf-muted gf-tl-detail' }, it.detail) : null));
    }));
  }

  function CommandBox(p) {
    var st = useState(p.defaultValue || ''), v = st[0], setV = st[1];
    var ref = useRef(null);
    useEffect(function () { var el = ref.current; if (el) { el.style.height = 'auto'; el.style.height = Math.min(el.scrollHeight, 160) + 'px'; } }, [v]);
    var off = !!p.disabledReason;
    function send() { if (!v.trim() || off) return; p.onSend && p.onSend(v.trim()); setV(''); }
    return h('div', { className: cx('gf-cmd', off && 'gf-cmd-off') },
      h('textarea', { ref: ref, rows: 1, className: 'gf-cmd-input body', value: v, disabled: off, placeholder: off ? p.disabledReason : (p.placeholder || 'Escreva uma ordem para esta fábrica'),
        onChange: function (e) { setV(e.target.value); },
        onKeyDown: function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } } }),
      h('div', { className: 'gf-cmd-bar' },
        p.onSaved ? h('button', { type: 'button', className: 'gf-linkbtn caption', onClick: p.onSaved, disabled: off }, 'Comandos salvos') : h('span'),
        h('span', { className: 'caption gf-faint gf-cmd-hint' }, 'Enter envia. Shift + Enter quebra a linha.'),
        h(Button, { variant: 'primary', onClick: send, disabled: off || !v.trim() }, 'Enviar')));
  }

  function TaskRow(p) {
    return h('div', { className: 'gf-row' },
      h(StateBadge, { state: p.state || 'idle', label: p.stateLabel }),
      h('div', { className: 'gf-row-main' },
        h('div', { className: 'body' }, p.title),
        p.agent ? h('div', { className: 'caption gf-muted' }, p.agent) : null),
      h('span', { className: 'mono gf-faint' }, p.elapsed));
  }

  var KIND = { added: 'Novo', modified: 'Alterado', removed: 'Removido' };
  function ChangeRow(p) {
    var k = p.kind || 'modified';
    return h('div', { className: 'gf-row gf-change' },
      h('span', { className: cx('gf-kind', 'gf-kind-' + k, 'caption') }, KIND[k]),
      h('span', { className: 'mono gf-change-path' }, p.path),
      h('span', { className: 'mono gf-change-diff' },
        p.add != null ? h('span', { className: 'gf-add' }, '+' + p.add) : null,
        p.del != null ? h('span', { className: 'gf-del' }, '-' + p.del) : null));
  }

  function ReportView(p) {
    return h('article', { className: 'gf-report' },
      h('header', { className: 'gf-report-head' },
        h('div', { className: 'caption gf-muted' }, p.meta),
        h('h1', { className: 'title-lg' }, p.title)),
      h('div', { className: 'gf-prose prose' }, p.children));
  }


  var ICONS = {
    overview: 'M3.5 3.5h5.5v5.5H3.5zM11 3.5h5.5v5.5H11zM3.5 11h5.5v5.5H3.5zM11 11h5.5v5.5H11z',
    factories: 'M10 2.8 17 6.5 10 10.2 3 6.5ZM3 10l7 3.7 7-3.7M3 13.5l7 3.7 7-3.7',
    approvals: 'M10 2.5 17.5 10 10 17.5 2.5 10Z',
    reports: 'M5 2.5h7l3.5 3.5v11.5H5zM8 9h5M8 12h5M8 15h3',
    metrics: 'M3.5 16.5h13M5.5 13.5v-3M9 13.5V6.5M12.5 13.5v-5M16 13.5V4',
    settings: 'M4 5.5h7M14 5.5h2M4 10h2M9 10h7M4 14.5h9M16 14.5h0M12.5 4v3M7.5 8.5v3M14.5 13v3',
    plus: 'M10 4v12M4 10h12',
    more: 'M5 10h.01M10 10h.01M15 10h.01',
    chevronLeft: 'M12 5l-5 5 5 5',
    search: 'M9 15a6 6 0 1 0 0-12 6 6 0 0 0 0 12ZM13.5 13.5 17 17',
    folder: 'M2.5 5.5a1 1 0 0 1 1-1h4l2 2h7a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1Z',
    pause: 'M7 4.5v11M13 4.5v11',
    back: 'M15 10H5M9 5l-5 5 5 5',
    copy: 'M7 7h9v9H7zM4 13V4h9',
    chevronRight: 'M8 5l5 5-5 5'
  };
  function Icon(p) {
    return h('svg', { width: p.size || 20, height: p.size || 20, viewBox: '0 0 20 20', fill: 'none', stroke: 'currentColor', strokeWidth: p.name === 'more' ? 3 : 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, className: 'gf-icon' }, h('path', { d: ICONS[p.name] || ICONS.more }));
  }

  function Sidebar(p) {
    var col = !!p.collapsed;
    return h('aside', { className: cx('gf-side', 'gf-glass', col && 'gf-side-col') },
      h('div', { className: 'gf-side-brand' },
        h('span', { className: 'gf-side-mark', 'aria-hidden': true }, h('span'), h('span'), h('span'), h('span')),
        col ? null : h('div', null, h('div', { className: 'title-sm' }, p.brand || 'Fábricas'), p.owner ? h('div', { className: 'caption gf-faint' }, p.owner) : null)),
      h('nav', { className: 'gf-side-nav' }, (p.items || []).map(function (it) {
        var on = it.id === p.value;
        return h('button', { key: it.id, type: 'button', title: col ? it.label : undefined, className: cx('gf-side-item', 'body-strong', on && 'gf-side-on'), 'aria-current': on ? 'page' : undefined, onClick: function () { p.onChange && p.onChange(it.id); } },
          h(Icon, { name: it.icon || it.id }),
          col ? null : h('span', { className: 'gf-side-label' }, it.label),
          it.count ? h('span', { className: cx('gf-side-count', 'caption', it.alert && 'gf-side-alert') }, it.count) : null);
      })),
      p.projects && !col ? h('div', { className: 'gf-side-sec' },
        h('div', { className: 'label gf-faint gf-side-sectitle' }, 'Projetos'),
        p.projects.map(function (pr, i) {
          return h('div', { key: i, className: 'gf-side-proj body' }, h('span', { className: 'gf-s-' + (pr.state || 'idle'), style: { color: 'var(--s)', display: 'flex' } }, h(StateIcon, { state: pr.state || 'idle', size: 10 })), h('span', { className: 'gf-side-projname' }, pr.name), pr.count ? h('span', { className: 'caption gf-faint' }, pr.count) : null);
        })) : null,
      h('div', { className: 'gf-side-foot' }, p.bridge ? h(p.onBridge ? 'button' : 'div', { type: p.onBridge ? 'button' : undefined, className: 'gf-side-bridgebtn', onClick: p.onBridge }, col ? h('span', { className: cx('gf-side-bdot', p.bridge.online === false && 'gf-side-bdot-off'), title: p.bridge.online === false ? 'Ponte offline' : 'Ponte conectada' }) : h(BridgeStatus, p.bridge)) : null));
  }

  function spark(series, w, hgt) {
    var min = Math.min.apply(null, series), max = Math.max.apply(null, series), r = (max - min) || 1, n = series.length - 1;
    var pts = series.map(function (v, i) { return [(i / n) * w, hgt - 3 - ((v - min) / r) * (hgt - 6)]; });
    var line = pts.map(function (q, i) { return (i ? 'L' : 'M') + q[0].toFixed(1) + ' ' + q[1].toFixed(1); }).join(' ');
    return { line: line, area: line + ' L' + w + ' ' + hgt + ' L0 ' + hgt + ' Z', last: pts[n] };
  }
  function KpiTile(p) {
    var sp = p.series && p.series.length > 1 ? spark(p.series, 120, 36) : null;
    var d = p.delta;
    return h('div', { className: cx('gf-kpi', 'gf-glass') },
      h('div', { className: 'label gf-muted' }, p.label),
      h('div', { className: 'gf-kpi-val' },
        h('span', { className: 'kpi gf-num' }, p.value),
        p.unit ? h('span', { className: 'kpi-unit gf-faint' }, p.unit) : null),
      sp ? h('svg', { className: 'gf-kpi-spark', viewBox: '0 0 120 36', preserveAspectRatio: 'none', 'aria-hidden': true },
        h('path', { d: sp.area, fill: 'var(--chart-fill)' }),
        h('path', { d: sp.line, fill: 'none', stroke: 'var(--chart-line)', strokeWidth: 1.5, vectorEffect: 'non-scaling-stroke', strokeLinejoin: 'round' })) : null,
      p.progress != null ? h('div', { className: 'gf-kpi-track' }, h('span', { style: { width: Math.round(p.progress * 100) + '%' } })) : null,
      h('div', { className: 'gf-kpi-foot caption' },
        d ? h('span', { className: cx('gf-kpi-delta', d.tone ? 'gf-kpi-' + d.tone : null) }, (d.dir === 'up' ? '↑ ' : d.dir === 'down' ? '↓ ' : '') + d.text) : null,
        p.hint ? h('span', { className: 'gf-faint' }, p.hint) : null));
  }

  function ApprovalDeck(p) {
    var items = p.items || [];
    var st = useState(0), i = Math.min(st[0], Math.max(items.length - 1, 0)), setI = st[1];
    var cur = items[i];
    function wrap(fn) { return function (x) { if (fn) fn(cur, x); }; }
    return h('section', { className: cx('gf-deck', 'gf-glass') },
      h('header', { className: 'gf-deck-head' },
        h('span', { className: 'gf-deck-count title-sm' }, items.length),
        h('div', { className: 'gf-deck-title' }, h('div', { className: 'title-md' }, items.length ? 'Aguardando você' : 'Nada esperando você'), items.length ? h('div', { className: 'caption gf-muted' }, 'Mais antiga primeiro') : null),
        items.length > 1 ? h('div', { className: 'gf-deck-nav' },
          h('span', { className: 'caption gf-muted gf-num' }, (i + 1) + ' de ' + items.length),
          h('button', { type: 'button', className: 'gf-iconbtn', 'aria-label': 'Anterior', disabled: i === 0, onClick: function () { setI(i - 1); } }, h(Icon, { name: 'chevronLeft', size: 16 })),
          h('button', { type: 'button', className: 'gf-iconbtn', 'aria-label': 'Próxima', disabled: i >= items.length - 1, onClick: function () { setI(i + 1); } }, h(Icon, { name: 'chevronRight', size: 16 }))) : null),
      cur ? h(ApprovalItem, Object.assign({ key: cur.id || cur.title, flat: true, touch: p.touch }, cur, { onApprove: wrap(p.onApprove), onReject: wrap(p.onReject), onApproveWithNote: wrap(p.onApproveWithNote) }))
        : h('div', { className: 'gf-deck-empty body gf-muted' }, 'Quando uma fábrica pedir aprovação, o pedido aparece aqui.'),
      items.length > 1 ? h('div', { className: 'gf-deck-dots', 'aria-hidden': true }, items.map(function (_, k) { return h('span', { key: k, className: k === i ? 'gf-dot-on' : '' }); })) : null);
  }


  function Segmented(p) {
    return h('div', { className: cx('gf-seg', p.block && 'gf-seg-block'), role: 'radiogroup' }, (p.options || []).map(function (o) {
      var id = typeof o === 'string' ? o : o.id, label = typeof o === 'string' ? o : o.label, on = id === p.value;
      return h('button', { key: id, type: 'button', role: 'radio', 'aria-checked': on, disabled: o.disabled, className: cx('gf-seg-opt', 'caption', on && 'gf-seg-on'), onClick: function () { p.onChange && p.onChange(id); } }, label, o.hint ? h('span', { className: 'gf-seg-hint' }, o.hint) : null);
    }));
  }

  function Toggle(p) {
    return h('label', { className: cx('gf-toggle', p.disabled && 'gf-toggle-off') },
      h('span', { className: 'gf-toggle-text' }, h('span', { className: 'body' }, p.label), p.hint ? h('span', { className: 'caption gf-muted' }, p.hint) : null),
      h('input', { type: 'checkbox', checked: !!p.checked, disabled: p.disabled, onChange: function (e) { p.onChange && p.onChange(e.target.checked); } }),
      h('span', { className: 'gf-toggle-track', 'aria-hidden': true }, h('span')));
  }

  function Pager(p) {
    var page = p.page || 1, total = p.total || 1;
    return h('div', { className: 'gf-pager' },
      h('span', { className: 'caption gf-muted gf-num' }, p.label || (page + ' de ' + total)),
      h('button', { type: 'button', className: 'gf-iconbtn', 'aria-label': 'Página anterior', disabled: page <= 1, onClick: function () { p.onChange && p.onChange(page - 1); } }, h(Icon, { name: 'chevronLeft', size: 16 })),
      h('button', { type: 'button', className: 'gf-iconbtn', 'aria-label': 'Próxima página', disabled: page >= total, onClick: function () { p.onChange && p.onChange(page + 1); } }, h(Icon, { name: 'chevronRight', size: 16 })));
  }

  /* Single-series bars, neutral ink. Hover shows the exact value. */
  function BarChart(p) {
    var data = p.data || [], max = Math.max.apply(null, data.map(function (d) { return d.value; }).concat([1]));
    var ticks = p.ticks || [max / 2, max];
    if (p.ticks) max = Math.max(max, ticks[ticks.length - 1]);
    if (p.horizontal) {
      return h('div', { className: 'gf-hbars' }, data.map(function (d, i) {
        return h('div', { key: i, className: 'gf-hbar', title: d.label + ': ' + (d.display || d.value) },
          h('span', { className: 'caption gf-hbar-label' }, d.label),
          h('span', { className: 'gf-hbar-track' }, h('span', { className: 'gf-hbar-fill', style: { width: Math.max(2, d.value / max * 100) + '%' } })),
          h('span', { className: 'mono gf-hbar-val' }, d.display || d.value));
      }));
    }
    var every = p.labelEvery || 1;
    return h('div', { className: 'gf-vbars', style: { height: p.height || 180 } },
      h('div', { className: 'gf-vbars-plot' },
        ticks.map(function (t) { return h('span', { key: t, className: 'gf-vbars-grid', style: { bottom: (t / max * 100) + '%' } }, h('span', { className: 'caption gf-faint' }, p.format ? p.format(t) : Math.round(t))); }),
        data.map(function (d, i) {
          return h('div', { key: i, className: cx('gf-vbar', p.highlightLast && i === data.length - 1 && 'gf-vbar-last'), tabIndex: 0 },
            h('span', { className: 'gf-vbar-fill', style: { height: Math.max(1.5, d.value / max * 100) + '%' } }),
            h('span', { className: 'gf-tip caption' }, h('b', null, d.display || d.value), h('span', null, d.label)));
        })),
      h('div', { className: 'gf-vbars-x' }, data.map(function (d, i) { return h('span', { key: i, className: 'caption gf-faint' }, i % every === 0 || i === data.length - 1 ? (d.short || d.label) : ''); })));
  }

  var NAV_ICONS = {
    approvals: 'M10 2.5 17.5 10 10 17.5 2.5 10Z',
    factories: 'M3 3.5h6v6H3zM11 3.5h6v6h-6zM3 11.5h6v6H3zM11 11.5h6v6h-6z',
    reports: 'M5 2.5h7l3.5 3.5v11.5H5zM8 9h5M8 12h5M8 15h3',
    more: 'M5 10h.01M10 10h.01M15 10h.01'
  };
  function MobileNav(p) {
    return h('nav', { className: 'gf-mnav gf-glass-strong' }, (p.items || []).map(function (it) {
      var on = it.id === p.value;
      return h('button', { key: it.id, type: 'button', className: cx('gf-mnav-item', on && 'gf-mnav-on'), 'aria-current': on ? 'page' : undefined, onClick: function () { p.onChange && p.onChange(it.id); } },
        h('span', { className: 'gf-mnav-icon' },
          h('svg', { width: 20, height: 20, viewBox: '0 0 20 20', fill: 'none', stroke: 'currentColor', strokeWidth: it.id === 'more' ? 3 : 1.6, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true }, h('path', { d: NAV_ICONS[it.icon || it.id] || NAV_ICONS.more })),
          it.count ? h('span', { className: 'gf-mnav-count caption' }, it.count) : null),
        h('span', { className: 'caption' }, it.label));
    }));
  }

  window.Fabricas = Object.assign(window.Fabricas || {}, {
    AlertBanner: AlertBanner, StateBadge: StateBadge, StateIcon: StateIcon, BridgeStatus: BridgeStatus,
    FactoryCard: FactoryCard, FactoryHeader: FactoryHeader, ApprovalItem: ApprovalItem, RiskTag: RiskTag,
    Button: Button, Tabs: Tabs, ActivityTimeline: ActivityTimeline, CommandBox: CommandBox,
    TaskRow: TaskRow, ChangeRow: ChangeRow, ReportView: ReportView, MobileNav: MobileNav,
    Sidebar: Sidebar, KpiTile: KpiTile, ApprovalDeck: ApprovalDeck, Icon: Icon,
    Segmented: Segmented, Toggle: Toggle, Pager: Pager, BarChart: BarChart,
    STATES: STATES
  });
})();
