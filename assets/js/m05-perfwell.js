// =====================================================================
// m05-perfwell.js — M05 Performance–Wellbeing · your team (pages/manager/perfwell.html)
// Data: server/api/manager/matrix.php — performance (task completion) against the wellbeing signal (100 − burnout risk).
// Dotted arcs show where a person was last quarter. Decision support, not a diagnosis.
// =====================================================================

document.addEventListener('DOMContentLoaded', function () {
  startManagerPage({ active: 'perfwell', api: 'manager/matrix.php', crumb: 'm05.crumb', render: render });
});

let D = null, group = null, picked = null;
const QUADS = ['thriving', 'burnout_risk', 'development', 'critical'];
const QFILL = { thriving: '#e6f5f2', burnout_risk: '#fcebe8', development: '#fdf1de', critical: '#fadcd8' };
const QDOT = { thriving: '#14b8a6', burnout_risk: '#ef5a48', development: '#f59e0b', critical: '#c2392b' };
const W = 920, H = 800;

function render(d) {
  D = d;
  const m = d.moved;
  document.querySelector('main').innerHTML =
    '<header class="page-header"><div class="copy"><h1>' + esc(t('m05.title')) + '</h1><p>' + esc(t('m05.subtitle')) + '</p></div>' +
      '<div class="actions">' + soonBtn('', ICONS.spark + esc(t('m05.who_first'))) + soonBtn('primary', '<span class="bolt">' + micon('grid') + '</span>' + esc(t('m05.simulate')) + ' ' + ARW) + '</div></header>' +
    '<div class="dashboard">' + (d.suppressed ? '<section class="card"><p class="empty">' + esc(t('m01.suppressed')) + '</p></section>' :
      '<section class="card sumbar"><div class="st"><span class="mono">' + esc(t('m05.plotted')) + '</span><b dir="ltr">' + d.people.length + '</b><small>' + esc(t('m05.direct')) + '</small></div>' +
        '<div class="st"><span class="mono">' + esc(t('m05.moved')) + '</span><b dir="ltr">' + m.n + '</b><small>' + th('m05.moved_s', { up: m.up, down: m.down }) + '</small></div>' +
        '<p class="hint">' + esc(t('m05.hint')) + '<br>' + esc(t('m05.signal_note')) + '</p>' +
        '<span class="teamchip">' + ICONS.person + '<bdi>' + esc(dt(d.team.name)) + '</bdi> · <b dir="ltr">' + d.team.people + '</b></span></section>' +
      '<div class="qtabs" id="qtabs"></div><div class="row m05-main"><section class="card plot" id="plot"></section><div class="col" id="side"></div></div>') + '</div>';
  if (d.suppressed) { return; }
  group = QUADS.filter(function (q) { return d.counts[q] > 0; })[0] || 'thriving';
  picked = (d.people.filter(function (p) { return p.quad === group; })[0] || {}).id || null;
  paint();
}

function paint() {
  const c = D.counts;
  document.getElementById('qtabs').innerHTML = QUADS.map(function (q) {
    return '<button type="button" class="qt q-' + q + (q === group ? ' on' : '') + '" data-q="' + q + '">' + esc(t('m05.q.' + q)) + ' <b dir="ltr">' + c[q] + '</b></button>';
  }).join('');
  document.querySelectorAll('.qt').forEach(function (b) { b.addEventListener('click', function () {
    group = b.getAttribute('data-q');
    picked = (D.people.filter(function (p) { return p.quad === group; })[0] || {}).id || null;
    paint();
  }); });
  drawPlot(); drawSide();
}

// piecewise scales: the dividing lines are in the middle of the plot
function sx(v) { const c = D.cuts.well; return v < c ? Math.max(0, (v - 20) / (c - 20)) * 0.5 : 0.5 + Math.min(1, (v - c) / (100 - c)) * 0.5; }
function sy(v) { const c = D.cuts.perf; return v >= c ? 0.5 - Math.min(1, (v - c) / (100 - c)) * 0.5 : 0.5 + Math.min(1, (c - v) / (c - 60)) * 0.5; }

function drawPlot() {
  const L = 70, R = 24, T = 30, B = 70, pw = W - L - R, ph = H - T - B;
  const X = function (v) { return L + sx(v) * pw; }, Y = function (v) { return T + sy(v) * ph; };
  const half = function (x, y, w, h, q, label, desc, anchor) {
    const on = q === group;
    return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + QFILL[q] + '" class="qr" data-q="' + q + '"' + (on ? ' stroke="' + QDOT[q] + '" stroke-width="2"' : '') + '/>' +
      '<text x="' + (anchor === 'end' ? x + w - 14 : x + 14) + '" y="' + (label[1] === 'b' ? y + h - 30 : y + 26) + '" text-anchor="' + anchor + '" class="ql" fill="' + QDOT[q] + '">' + esc(t('m05.q.' + q)) + '</text>' +
      '<text x="' + (anchor === 'end' ? x + w - 14 : x + 14) + '" y="' + (label[1] === 'b' ? y + h - 12 : y + 44) + '" text-anchor="' + anchor + '" class="qd">' + esc(t('m05.qd.' + q)) + '</text>';
  };
  const mx = L + pw / 2, my = T + ph / 2;
  let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="mx" role="img" aria-label="' + esc(t('m05.title')) + '">' +
    half(L, T, pw / 2, ph / 2, 'burnout_risk', 'tl', '', 'start') + half(mx, T, pw / 2, ph / 2, 'thriving', 'tr', '', 'end') +
    half(L, my, pw / 2, ph / 2, 'critical', 'bl', '', 'start') + half(mx, my, pw / 2, ph / 2, 'development', 'br', '', 'end') +
    '<line x1="' + mx + '" x2="' + mx + '" y1="' + T + '" y2="' + (T + ph) + '" stroke="#fff" stroke-width="2"/><line x1="' + L + '" x2="' + (L + pw) + '" y1="' + my + '" y2="' + my + '" stroke="#fff" stroke-width="2"/>' +
    '<text x="' + (L - 28) + '" y="' + (T + ph / 2) + '" class="ax" text-anchor="middle" transform="rotate(-90 ' + (L - 28) + ' ' + (T + ph / 2) + ')">' + esc(t('m05.ax_y')) + '</text>' +
    '<text x="' + L + '" y="' + (H - 22) + '" class="ax">' + esc(t('m05.low')) + '</text><text x="' + mx + '" y="' + (H - 22) + '" class="ax" text-anchor="middle">' + esc(t('m05.ax_x')) + '</text><text x="' + (L + pw) + '" y="' + (H - 22) + '" class="ax" text-anchor="end">' + esc(t('m05.high')) + '</text>';
  // the arc of the picked person (where they were last quarter)
  const sel = D.people.filter(function (p) { return p.id === picked; })[0];
  if (sel && sel.prev && sel.moved) {
    const x1 = X(sel.prev.well), y1 = Y(sel.prev.perf), x2 = X(sel.well), y2 = Y(sel.perf);
    const cx = (x1 + x2) / 2, cy = Math.min(y1, y2) - 70, col = sel.moved === 'up' ? '#14b8a6' : '#ef5a48';
    s += '<path d="M' + x1.toFixed(1) + ' ' + y1.toFixed(1) + ' Q' + cx.toFixed(1) + ' ' + cy.toFixed(1) + ' ' + x2.toFixed(1) + ' ' + y2.toFixed(1) + '" fill="none" stroke="' + col + '" stroke-width="2" stroke-dasharray="5 5"/>' +
      '<circle cx="' + x1.toFixed(1) + '" cy="' + y1.toFixed(1) + '" r="13" fill="#fff" fill-opacity=".6" stroke="' + col + '" stroke-width="2" stroke-dasharray="3 3"/>' +
      '<text x="' + cx.toFixed(1) + '" y="' + (cy + 22).toFixed(1) + '" text-anchor="middle" class="arc-l" fill="' + col + '">' + esc(sel.first_name.toUpperCase()) + ' · ' + esc(monthName(D.prev_month).slice(0, 3).toUpperCase()) + ' → ' + esc(monthName(D.now_month).slice(0, 3).toUpperCase()) + '</text>';
  }
  D.people.forEach(function (p) {
    const on = p.quad === group, cur = p.id === picked;
    s += '<g class="nd' + (cur ? ' cur' : '') + '" data-id="' + p.id + '" tabindex="0" role="button" aria-label="' + esc(p.name) + '" opacity="' + (on ? 1 : 0.4) + '">' +
      '<circle cx="' + X(p.well).toFixed(1) + '" cy="' + Y(p.perf).toFixed(1) + '" r="' + (on ? 19 : 16) + '" fill="#fff" stroke="' + QDOT[p.quad] + '" stroke-width="' + (cur ? 4 : 2.5) + '"/>' +
      '<text x="' + X(p.well).toFixed(1) + '" y="' + (Y(p.perf) + 4.5).toFixed(1) + '" text-anchor="middle" class="ni">' + esc(p.initials) + '</text></g>';
  });
  document.getElementById('plot').innerHTML = s + '</svg>';
  document.getElementById('plot').onclick = function (e) {
    const n = e.target.closest('[data-id]'), r = e.target.closest('[data-q]');
    if (n) { picked = Number(n.getAttribute('data-id')); group = D.people.filter(function (p) { return p.id === picked; })[0].quad; paint(); }
    else if (r) { group = r.getAttribute('data-q'); picked = (D.people.filter(function (p) { return p.quad === group; })[0] || {}).id || null; paint(); }
  };
}

function drawSide() {
  const list = D.people.filter(function (p) { return p.quad === group; });
  const rows = list.map(function (p) {
    return '<a class="pr' + (p.id === picked ? ' cur' : '') + '" href="#" data-pick="' + p.id + '"><span class="av q-' + p.quad + '">' + esc(p.initials) + '</span><span class="nm"><b><bdi>' + esc(p.name) + '</bdi></b><small>' + esc(dt(D.team.name)) + '</small></span>' +
      '<span class="pw" dir="ltr">' + esc(t('m05.p')) + ' ' + p.perf + ' · ' + esc(t('m05.w')) + ' ' + p.well + '</span></a>';
  }).join('');
  const pb = group === 'burnout_risk' && D.playbook ? '<p class="stat">' + th('m05.pb_stat', { n: D.playbook.n, total: D.playbook.total, drop: D.playbook.drop, weeks: D.playbook.weeks }) + '</p>' : '';
  document.getElementById('side').innerHTML =
    '<section class="card grp"><h2><i class="gd" style="background:' + QDOT[group] + '"></i>' + esc(t('m05.q.' + group)) + ' <small class="mono">' + esc(tf('m05.people_n', { n: list.length })) + '</small></h2>' +
      '<p class="desc">' + esc(t('m05.desc.' + group)) + '</p><div class="plist">' + (rows || '<p class="empty">' + esc(t('m05.none')) + '</p>') + '</div></section>' +
    '<section class="card pb"><span class="kick">' + ICONS.spark + ' ' + esc(t('m05.playbook')) + '</span><h3>' + esc(t('m05.pb.' + group)) + '</h3>' + pb +
      (group === 'burnout_risk' || group === 'critical' ? soonBtn('primary', '<span class="bolt">' + micon('bolt') + '</span>' + esc(t('m05.start'))) : '') + '</section>';
  document.querySelectorAll('[data-pick]').forEach(function (a) { a.addEventListener('click', function (e) { e.preventDefault(); picked = Number(a.getAttribute('data-pick')); paint(); }); });
}
