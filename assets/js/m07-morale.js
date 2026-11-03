// =====================================================================
// m07-morale.js — M07 Team Morale (pages/manager/morale.html)
// Data: server/api/manager/morale.php — team numbers only: the median of the weekly check-ins (anonymous, needs 5+ people),
// the themes of anonymous comments (shown only when 5+ people wrote comments). No names, no individual answers.
// =====================================================================

document.addEventListener('DOMContentLoaded', function () {
  startManagerPage({ active: 'morale', api: 'manager/morale.php', crumb: 'm07.crumb', render: render });
});

function isoWeek(iso) {
  const p = iso.slice(0, 10).split('-').map(Number), d = new Date(Date.UTC(p[0], p[1] - 1, p[2]));
  const day = d.getUTCDay() || 7; d.setUTCDate(d.getUTCDate() + 4 - day);
  return Math.ceil(((d - Date.UTC(d.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7);
}

function render(d) {
  document.querySelector('main').innerHTML =
    '<header class="page-header"><div class="copy"><h1>' + esc(t('m07.title')) + '</h1><p>' + esc(t('m07.subtitle')) + '</p></div>' +
      '<div class="actions">' + soonBtn('', ICONS.spark + esc(t('m07.factors'))) + '</div></header>' +
    '<div class="dashboard">' + (d.suppressed ? '<section class="card"><p class="empty">' + esc(t('m01.suppressed')) + '</p></section>' :
      '<div class="row m07-top"><section class="card">' + cardHeadHTML(t('m07.chart'), esc(tf('m07.chart_sub', { n: d.n })), '') + chartSVG(d) + '</section><section class="card sigs">' + signalsHTML(d) + '</section></div>' +
      '<div class="row m07-bottom"><section class="card say">' + sayHTML(d) + '</section><section class="card lift">' + liftHTML(d) + '</section></div>') + '</div>';
}

function chartSVG(d) {
  const pts = d.chart.points, W = 860, H = 380, L = 56, R = 28, T = 48, B = 46;
  if (pts.length < 2) { return '<p class="empty">' + esc(t('m07.no_chart')) + '</p>'; }
  const lo = Math.floor((Math.min.apply(null, pts.map(function (p) { return p.v; })) - 6) / 10) * 10, hi = Math.ceil((Math.max.apply(null, pts.map(function (p) { return p.v; })) + 4) / 10) * 10;
  const X = function (i) { return L + i / (pts.length - 1) * (W - L - R); }, Y = function (v) { return T + (hi - v) / (hi - lo) * (H - T - B); };
  let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="mchart" role="img" aria-label="' + esc(t('m07.chart')) + '">';
  for (let v = lo; v <= hi; v += 10) { s += '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + Y(v) + '" y2="' + Y(v) + '" stroke="#eef1f5"/><text x="' + (L - 14) + '" y="' + (Y(v) + 4) + '" text-anchor="end" class="yl">' + v + '</text>'; }
  const line = pts.map(function (p, i) { return (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(p.v).toFixed(1); }).join(' ');
  s += '<path d="' + line + ' L' + X(pts.length - 1) + ' ' + Y(lo) + ' L' + X(0) + ' ' + Y(lo) + ' Z" fill="#fdf3e6"/><path d="' + line + '" fill="none" stroke="#b45309" stroke-width="2.6" stroke-linejoin="round"/>';
  d.chart.events.forEach(function (e) {
    s += '<line x1="' + X(e.index) + '" x2="' + X(e.index) + '" y1="' + (T - 14) + '" y2="' + Y(lo) + '" stroke="#e0503c" stroke-dasharray="3 4"/><text x="' + (X(e.index) + 5) + '" y="' + (T - 6) + '" class="ev">' + esc(dt(e.title).toUpperCase()) + '</text>';
  });
  const last = pts.length - 1;
  s += '<circle cx="' + X(last) + '" cy="' + Y(pts[last].v) + '" r="6" fill="#b45309"/>';
  [0, 3, 6, 9, last].filter(function (v, i, a) { return a.indexOf(v) === i; }).forEach(function (i) { s += '<text x="' + X(i) + '" y="' + (H - 14) + '" text-anchor="middle" class="xl">' + esc(t('m07.wk')) + ' ' + isoWeek(pts[i].week) + '</text>'; });
  return s + '</svg>';
}

function signalsHTML(d) {
  const rows = d.signals.map(function (s) {
    let chg = '';
    if (s.change === null || s.change === undefined) { chg = '<span class="cg n">—</span>'; }
    else if (s.change === 0) { chg = '<span class="cg n" dir="ltr">±0</span>'; }
    else { const good = (s.change > 0) === s.good_up; chg = '<span class="cg ' + (good ? 'good' : 'bad') + '" dir="ltr">' + (s.change > 0 ? '↑ ' : '↓ ') + Math.abs(s.change) + '</span>'; }
    return '<div class="sr"><span>' + esc(t('m07.s.' + s.key)) + '</span><b dir="ltr">' + (s.value === null ? '—' : s.value + (s.pct ? '%' : '')) + '</b>' + chg + '</div>';
  }).join('');
  return '<h2>' + ICONS.pulse + ' ' + esc(t('m07.signals')) + '</h2>' + rows;
}

function sayHTML(d) {
  const items = d.themes.map(function (x) {
    return '<div class="th t-' + x.tone + '"><i></i><span>“' + esc(dt(x.text)) + '”</span><small dir="ltr">' + esc(tf('m07.mentions', { n: x.mentions })) + '</small></div>';
  }).join('');
  return cardHeadHTML(t('m07.say'), esc(t('m07.say_sub')), '') + (d.themes_hidden ? '<p class="empty">' + esc(t('m07.hidden')) + '</p>' : (items || '<p class="empty">' + esc(t('m07.no_themes')) + '</p>'));
}

function liftHTML(d) {
  const items = d.lift.map(function (x, i) { return '<p class="li"><b dir="ltr">' + String(i + 1).padStart(2, '0') + '</b><span>' + esc(dt(x)) + '</span></p>'; }).join('');
  return '<span class="kick">' + ICONS.spark + ' ' + esc(t('m07.lift')) + '</span>' + (items || '<p class="empty">' + esc(t('m07.no_lift')) + '</p>') +
    '<div class="btns">' + soonBtn('primary', '<span class="bolt">' + micon('bolt') + '</span>' + esc(t('m07.plan')) + ' ' + ARW) + '<a class="btn" href="recognition.html">' + micon('award') + esc(t('m07.recognize')) + '</a></div>';
}
