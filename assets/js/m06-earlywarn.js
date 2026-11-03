// =====================================================================
// m06-earlywarn.js — M06 Burnout Early Warning (pages/manager/earlywarn.html?id=)
// Data: server/api/manager/early_warning.php — people with 60%+ burnout risk (direct reports only) and the five steps of one:
// risk · root causes · evidence · recommended action · follow-up. Risk is decision support, not a diagnosis.
// Forecasts and projections are labelled "projected". Nothing here starts an intervention without a human approval.
// =====================================================================

let D = null, SEL = Number(new URLSearchParams(location.search).get('id')) || 0;

document.addEventListener('DOMContentLoaded', function () {
  startManagerPage({ active: 'earlywarn', api: 'manager/early_warning.php', crumb: 'm06.crumb', render: render, query: function () { return SEL ? '?id=' + SEL : ''; } });
});

function spark(series, color) {
  if (!series || series.length < 2) { return '<span class="spark"></span>'; }
  const min = Math.min.apply(null, series), max = Math.max.apply(null, series), span = (max - min) || 1;
  const pts = series.map(function (v, i) { return (i / (series.length - 1) * 100).toFixed(1) + ',' + (24 - (v - min) / span * 20).toFixed(1); }).join(' ');
  return '<svg class="spark" viewBox="0 0 100 28" preserveAspectRatio="none" aria-hidden="true"><polyline points="' + pts + '" fill="none" stroke="' + color + '" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>' +
    '<i class="sdot" style="background:' + color + '"></i>';
}

function render(d) {
  D = d;
  const k = d.cards.length;
  document.querySelector('main').innerHTML =
    '<header class="page-header"><div class="copy"><h1>' + esc(t('m06.title')) + '</h1><p>' + esc(t('m06.subtitle')) + ' ' + esc(tf('m06.need', { n: k })) + '</p></div>' +
      '<div class="actions">' + soonBtn('', ICONS.bell + esc(t('m06.notify'))) + soonBtn('', ICONS.spark + esc(t('m06.explain'))) + '</div></header>' +
    '<div class="dashboard">' + (d.detail === null ? '<section class="card"><p class="empty">' + esc(t('m06.none')) + '</p></section>' : cardsHTML(d) + detailHTML(d.detail) + lowerHTML(d.detail) +
      '<div class="signals"><span>' + ICONS.check + '</span><p><b>' + esc(t('m4b.sig_b')) + '</b> ' + esc(tf('m4b.sig', { first: d.detail.person.first_name })) + '</p></div>') + '</div>';
  document.querySelectorAll('[data-card]').forEach(function (c) { c.addEventListener('click', function () { pick(Number(c.getAttribute('data-card'))); }); });
}

async function pick(id) {
  SEL = id;
  history.replaceState(null, '', '?id=' + id);
  const r = await api('manager/early_warning.php?id=' + id);
  if (r.status === 200 && r.data && !r.data.error) { render(r.data); }
}

function cardsHTML(d) {
  const cs = d.cards.map(function (c) {
    return '<button type="button" class="wc' + (c.id === d.detail.person.id ? ' on' : '') + '" data-card="' + c.id + '"><span class="av">' + esc(c.initials) + '</span><span class="nm"><b><bdi>' + esc(c.name) + '</bdi></b><small>' + esc(dt(c.job_title)) + '</small></span>' +
      '<span class="rk"><b dir="ltr">' + c.risk + '%</b><small dir="ltr">' + (c.change >= 0 ? '+' : '−') + Math.abs(c.change) + ' ' + esc(t('m06.in6')) + '</small></span></button>';
  }).join('');
  return '<div class="wrow">' + cs + '<div class="wside"><div><span class="mono">' + esc(t('m06.watch')) + '</span><b dir="ltr">' + d.watch + '</b></div><div><span class="mono">' + esc(t('m06.healthy')) + '</span><b dir="ltr">' + d.healthy + '</b></div><p>' + esc(tf('m06.of', { n: d.of })) + '</p></div></div>';
}

function detailHTML(x) {
  const p = x.person;
  const head = '<div class="dh"><span class="av big">' + esc(p.initials) + '</span><div class="dn"><b><bdi>' + esc(p.name) + '</bdi> · ' + esc(t('m06.ew')) + '</b><small>' + esc(dt(p.job_title)) + ' · <bdi>' + esc(dt(p.team)) + '</bdi> · ' + esc(tf('m06.mgr', { name: p.manager })) + (p.detected ? ' · ' + esc(tf('m06.detected', { date: fmtDate(p.detected) })) : '') + '</small></div>' +
    '<span class="tchip tc-' + p.tier + '"><i></i>' + esc(tierName(p.tier)) + ' <b dir="ltr">' + p.score + '</b><i class="adot"></i></span><small class="tn">' + esc(tf('m06.tier_alert', { tier: tierName(p.tier) })) + '</small>' +
    (p.similar ? '<span class="sim">' + esc(tf('m06.similar', { n: p.similar })) + '</span>' : '') + '<a class="lnk" href="#" data-soon="1">' + esc(t('m06.twin')) + ' ' + ARW + '</a></div>';
  return '<section class="card five">' + head + '<div class="cols">' + riskCol(x) + causesCol(x) + evidenceCol(x) + actionCol(x) + followCol(x) + '</div></section>';
}

function num(n, cls) { return '<span class="num ' + (cls || '') + '">' + n + '</span>'; }

function riskCol(x) {
  const r = x.risk, H = 320, y = function (v) { return 8 + (100 - v) / 100 * (H - 16); };
  let s = '<svg viewBox="0 0 250 ' + H + '" class="gauge" role="img" aria-label="' + esc(t('m06.risk')) + '"><g transform="translate(60 0)">';
  [[100, 80, '#f3d2cc', 'critical'], [80, 60, '#f08d7e', 'elevated'], [60, 40, '#ee6d5a', 'watch'], [40, 0, '#e48070', 'low']].forEach(function (z) {
    s += '<rect x="0" y="' + y(z[0]) + '" width="36" height="' + (y(z[1]) - y(z[0])) + '" fill="' + z[2] + '"/><text x="-10" y="' + ((y(z[0]) + y(z[1])) / 2) + '" text-anchor="middle" class="zl" transform="rotate(-90 -10 ' + ((y(z[0]) + y(z[1])) / 2) + ')">' + esc(t('m06.z.' + z[3])) + '</text>';
  });
  s += '<line x1="-2" x2="40" y1="' + y(r.now) + '" y2="' + y(r.now) + '" stroke="#b3261e" stroke-width="2.5"/><text x="46" y="' + (y(r.now) + 4) + '" class="gl now">' + esc(t('m06.now')) + ' · ' + r.now + '%</text>';
  if (r.forecast) { s += '<line x1="-2" x2="40" y1="' + y(r.forecast.pct) + '" y2="' + y(r.forecast.pct) + '" stroke="#b3261e" stroke-width="1.8" stroke-dasharray="2 3"/><text x="46" y="' + (y(r.forecast.pct) + 4) + '" class="gl fc">' + esc(tf('m06.in_w', { n: r.forecast.weeks })) + ' · ' + r.forecast.pct + '%</text>'; }
  s += '<line x1="-2" x2="40" y1="' + y(r.six_weeks_ago) + '" y2="' + y(r.six_weeks_ago) + '" stroke="#64748b" stroke-width="2"/><text x="46" y="' + (y(r.six_weeks_ago) + 4) + '" class="gl old">' + esc(tf('m06.wks_ago', { n: 6 })) + ' · ' + r.six_weeks_ago + '%</text>';
  s += '<path d="M40 ' + y(r.six_weeks_ago) + ' Q74 ' + ((y(r.six_weeks_ago) + y(r.now)) / 2) + ' 40 ' + y(r.now) + '" fill="none" stroke="#b3261e" stroke-width="1.4" stroke-dasharray="3 3"/></g></svg>';
  return '<div class="col1"><h3>' + num(1, 'c1') + esc(t('m06.risk')) + '</h3><div class="big"><b dir="ltr">' + r.now + '</b><span>%</span></div><p class="lv">' + esc(t('m06.lv.' + r.level)) + (r.rising_fast ? ' · ' + esc(t('m06.rising')) : '') + '</p>' + s +
    (r.horizon ? '<div class="hz"><span>' + esc(t('m06.horizon')) + ' <b>' + esc(tf('m06.weeks', { n: r.horizon })) + '</b></span><span>' + esc(t('m06.confidence')) + ' <b dir="ltr">' + esc(r.confidence) + '</b></span><small>' + esc(t('m06.projected')) + '</small></div>' : '') + '</div>';
}

function causeDetail(c) {
  if (c.key === 'workload') { return c.pct === null ? '' : tf('m06.cd_workload', { pct: c.pct }); }
  if (c.key === 'overtime') { return c.hours === null ? '' : (c.weekends ? tf('m06.cd_overtime_w', { h: c.hours, w: c.weekends }) : tf('m06.cd_overtime', { h: c.hours })); }
  if (c.key === 'engagement') { return c.pct === null ? '' : tf('m06.cd_engagement', { pct: Math.abs(c.pct) }); }
  if (c.key === 'recognition') { return c.days === null ? '' : tf('m06.cd_recognition', { days: c.days }); }
  return t('m06.cd_other');
}

function causesCol(x) {
  const r = x.risk;
  let at = r.six_weeks_ago;
  const rows = x.causes.map(function (c) {
    const left = at; at += c.pts;
    return '<div class="cs"><div class="ch"><b>' + esc(t('m06.c.' + c.key)) + '</b><span class="pts" dir="ltr">+' + c.pts + ' ' + esc(t('m06.pts')) + '</span></div><span class="track"><i style="inset-inline-start:' + left + '%;width:' + Math.max(c.pts, 2) + '%"></i></span><small>' + esc(causeDetail(c)) + '</small></div>';
  }).join('');
  return '<div class="col2"><h3>' + num(2, 'c1') + esc(t('m06.causes')) + '</h3><div class="cs base"><div class="ch"><b>' + esc(t('m06.baseline')) + '</b><span class="pts" dir="ltr">' + r.six_weeks_ago + ' ' + esc(t('m06.pts')) + '</span></div><span class="track"><i class="g" style="inset-inline-start:0;width:' + r.six_weeks_ago + '%"></i></span><small>' + esc(tf('m06.wks_ago', { n: 6 })) + '</small></div>' + rows +
    '<div class="cur"><span>' + esc(t('m06.current')) + '</span><b dir="ltr">' + r.now + '%</b></div></div>';
}

function evidenceCol(x) {
  const e = x.evidence;
  const row = function (label, o, color, unit) {
    if (!o) { return ''; }
    return '<div class="ev"><div class="evl"><span>' + esc(label) + '</span><b dir="ltr">' + o.from + ' → ' + o.to + (unit ? ' ' + unit : '') + '</b></div>' + spark(o.series, color) + '</div>';
  };
  const open = e.open_tasks ? '<div class="ev"><div class="evl"><span>' + esc(t('m06.e_open')) + '</span><b dir="ltr">' + e.open_tasks.from + ' → ' + e.open_tasks.to + '</b></div>' + spark([e.open_tasks.from, e.open_tasks.to], '#f59e0b') + '</div>' : '';
  const en = e.energy ? '<div class="energy">' + ICONS.doc + '<p>' + esc(tf('m06.energy', { first: x.person.first_name, level: t('m4b.lv.' + e.energy.level), n: e.energy.n, of: e.energy.of })) + '</p></div>' : '';
  return '<div class="col3"><h3>' + num(3, 'c2') + esc(t('m06.evidence')) + '</h3>' + row(t('m06.e_hours'), e.hours, '#f59e0b', 'h') + open + row(t('m06.e_eng'), e.engagement, '#ef5a48', '') + row(t('m06.e_after'), e.after_hours, '#f59e0b', '') + en + '</div>';
}

function actionCol(x) {
  const acts = x.actions.map(function (a) {
    const title = a.title ? dt(a.title) : t(a.k);
    const lines = a.lines ? a.lines.map(function (l) { return '<small>' + esc(dt(l)) + '</small>'; }).join('') : '<small>' + esc(t(a.k + '_s')) + '</small>';
    return '<label class="act"><input type="checkbox" checked><span class="at"><b>' + esc(title) + '</b>' + (a.pts ? '<em dir="ltr">−' + a.pts + ' ' + esc(t('m06.pts')) + '</em>' : '') + '</span>' + lines + '</label>';
  }).join('');
  const pr = x.projection ? '<div class="proj"><span>' + esc(tf('m06.proj_in', { n: x.projection.weeks })) + '</span><b dir="ltr"><i class="a">' + x.projection.from + '%</i> ' + ARW + ' <i class="b">' + x.projection.to + '%</i></b></div>' : '';
  const status = x.intervention && x.intervention.approved ? '<p class="appr">' + esc(tf('m06.approved', { code: x.intervention.code })) + '</p>' : soonBtn('danger wide', micon('bolt') + esc(t('m06.start')));
  return '<div class="col4"><h3>' + num(4, 'c3') + esc(t('m06.action')) + '</h3>' + acts + pr + status + soonBtn('wide', ICONS.diamond + esc(t('m06.simulate'))) + '</div>';
}

function followCol(x) {
  const st = x.steps.map(function (s) {
    const title = s.title ? dt(s.title) : t(s.k);
    return '<div class="step ' + (s.done ? 'done' : '') + '"><i></i><div><b>' + esc(title) + '</b> <small dir="ltr">' + esc(fmtDate(s.date)) + '</small>' + (s.detail ? '<span>' + esc(dt(s.detail)) + '</span>' : '') + '</div></div>';
  }).join('');
  return '<div class="col5"><h3>' + num(5, 'c3') + esc(t('m06.follow')) + '</h3>' + (st || '<p class="empty">' + esc(t('m06.no_follow')) + '</p>') + '</div>';
}

function lowerHTML(x) {
  return '<div class="row m06-low"><section class="card">' + trajectoryHTML(x) + '</section><section class="card sig">' + signalsHTML(x) + '</section></div>';
}

function trajectoryHTML(x) {
  const tr = x.trajectory, h = tr.history, W = 760, H = 340, L = 50, R = 170, T = 30, B = 40;
  const n = h.length, fc = tr.forecast, span = n - 1 + (fc ? fc.weeks : 0);
  const X = function (i) { return L + i / Math.max(1, span) * (W - L - R); }, Y = function (v) { return T + (90 - v) / 60 * (H - T - B); };
  let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="traj" role="img" aria-label="' + esc(t('m06.traj')) + '">';
  [80, 60, 40].forEach(function (v) { s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(v) + '" y2="' + Y(v) + '" stroke="#e2e8f0" stroke-dasharray="3 3"/><text x="' + (L - 12) + '" y="' + (Y(v) + 4) + '" text-anchor="end" class="yl">' + v + '</text>'; });
  if (fc) { s += '<rect x="' + X(n - 1) + '" y="' + T + '" width="' + (W - R - X(n - 1)) + '" height="' + (H - T - B) + '" fill="#f6f8fb"/><text x="' + (X(n - 1) + 10) + '" y="' + (T + 16) + '" class="fl">' + esc(tf('m06.forecast_w', { n: fc.weeks })) + '</text>'; }
  s += '<path d="' + h.map(function (p, i) { return (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(p.v).toFixed(1); }).join(' ') + '" fill="none" stroke="#0e2944" stroke-width="2.4"/>';
  const x0 = X(n - 1), y0 = Y(h[n - 1].v);
  if (fc) {
    const x1 = W - R, a = Y(fc.nothing), b = Y(fc.plan);
    s += '<polygon points="' + x0 + ',' + y0 + ' ' + x1 + ',' + (a - 28) + ' ' + x1 + ',' + (a + 10) + '" fill="#f6d5d0" opacity=".8"/><polygon points="' + x0 + ',' + y0 + ' ' + x1 + ',' + (b - 12) + ' ' + x1 + ',' + (b + 30) + '" fill="#cdeee9" opacity=".9"/>' +
      '<line x1="' + x0 + '" y1="' + y0 + '" x2="' + x1 + '" y2="' + a + '" stroke="#e0503c" stroke-width="2" stroke-dasharray="5 4"/><line x1="' + x0 + '" y1="' + y0 + '" x2="' + x1 + '" y2="' + b + '" stroke="#14b8a6" stroke-width="2" stroke-dasharray="5 4"/>' +
      '<text x="' + (x1 + 10) + '" y="' + (a + 4) + '" class="tl bad">' + esc(tf('m06.if_nothing', { n: fc.nothing })) + '</text><text x="' + (x1 + 10) + '" y="' + (b + 4) + '" class="tl good">' + esc(tf('m06.with_plan', { n: fc.plan })) + '</text>';
  }
  s += '<circle cx="' + x0 + '" cy="' + y0 + '" r="6" fill="#e0503c"/>';
  [0, Math.floor((n - 1) / 3), Math.floor(2 * (n - 1) / 3)].forEach(function (i) { s += '<text x="' + X(i) + '" y="' + (H - 12) + '" text-anchor="middle" class="xl">' + esc(fmtDate(h[i].week)) + '</text>'; });
  s += '<text x="' + x0 + '" y="' + (H - 12) + '" text-anchor="middle" class="xl now">' + esc(t('m06.today')) + '</text>';
  return cardHeadHTML(t('m06.traj'), esc(t(fc ? 'm06.traj_sub' : 'm06.traj_sub_nf')), '') + s + '</svg>';
}

function signalsHTML(x) {
  const val = function (s) {
    if (s.key === 'workload') { return '+' + s.value + '%'; }
    if (s.key === 'overtime') { return '+' + s.value + ' ' + t('m06.hwk'); }
    if (s.key === 'engagement') { return '−' + Math.abs(s.value) + '%'; }
    if (s.key === 'recognition') { return s.value + ' ' + t('m06.days'); }
    if (s.key === 'tasks') { return s.value + ' ' + t('m06.open'); }
    if (s.key === 'motivation') { return t('m06.checkins'); }
    return s.value + ' · ' + tf('m06.still', { tier: tierName(s.tier) });
  };
  const rows = x.signals.map(function (s) {
    let b = '';
    for (let i = 1; i <= 5; i++) { b += '<i class="b' + (i <= s.bars ? ' on' : '') + '" style="height:' + (6 + i * 3) + 'px"></i>'; }
    return '<div class="sg"><span>' + esc(t('m06.sg.' + s.key)) + '</span><b dir="ltr">' + esc(val(s)) + '</b><span class="bars">' + b + '</span></div>';
  }).join('');
  const perf = x.signals.filter(function (s) { return s.key === 'performance'; })[0];
  return '<h2>' + ICONS.pulse + ' ' + esc(t('m06.signals')) + '</h2><p class="sub">' + esc(tf('m06.signals_sub', { first: x.person.first_name })) + '</p>' + rows +
    (perf && perf.value >= 85 ? '<p class="mask">' + esc(tf('m06.mask', { perf: perf.value, tier: tierName(perf.tier) })) + '</p>' : '');
}
