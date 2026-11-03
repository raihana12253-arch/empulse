// =====================================================================
// m02-performance.js — M02 Team Performance (pages/manager/performance.html)
// Data: server/api/manager/performance.php — team averages by dimension; no individual ranking.
// =====================================================================

let BACK = 1;
document.addEventListener('DOMContentLoaded', function () {
  startManagerPage({ active: 'performance', api: 'manager/performance.php', crumb: 'm02.crumb', render: render, query: function () { return '?back=' + BACK; } });
});

let D = null;
const TIER_COLORS = { gold: '#d9a93f', silver: '#95a3b3', bronze: '#c47f4c', growth: '#d9e1ea' };

function render(d) {
  D = d;
  document.querySelector('main').innerHTML =
    '<header class="page-header"><div class="copy"><h1>' + esc(t('m02.title')) + '</h1><p>' + esc(t('m02.subtitle')) + '</p></div>' +
      '<div class="actions">' + soonBtn('', ICONS.download + esc(t('m02.export'))) + '<a class="btn primary" href="pulse.html">' + ICONS.pulse + esc(t('m02.to_pulse')) + ' ' + ARW + '</a></div></header>' +
    '<div class="dashboard">' + filtersHTML() + (d.suppressed ? '<section class="card"><p class="empty">' + esc(t('m01.suppressed')) + '</p></section>' : body(d)) + '</div>';
  const sel = document.getElementById('f-time');
  if (sel) { sel.addEventListener('change', function () { BACK = Number(sel.value); reload(); }); }
  document.querySelectorAll('.flt.soon-f').forEach(function (el) { el.addEventListener('click', function () { showToast(t('shell.soon')); }); });
}

async function reload() {
  const r = await api('manager/performance.php?back=' + BACK);
  if (r.status === 200 && r.data && !r.data.error) { render(r.data); }
}

function filtersHTML() {
  return '<div class="filters"><label class="flt"><span>' + esc(t('m02.f_time')) + '</span><select id="f-time">' +
    [1, 3, 6].map(function (b) { return '<option value="' + b + '"' + (b === BACK ? ' selected' : '') + '>' + esc(t('m02.t' + b)) + '</option>'; }).join('') + '</select></label>' +
    '<label class="flt"><span>' + esc(t('m02.f_team')) + '</span><select disabled><option><bdi>' + esc(dt(D.team.name)) + '</bdi></option></select></label>' +
    '<label class="flt soon-f"><span>' + esc(t('m02.f_role')) + '</span><b>' + esc(t('m02.all_roles')) + '</b>' + ICONS.chevron + '</label>' +
    '<label class="flt soon-f"><span>' + esc(t('m02.f_area')) + '</span><b>' + esc(t('m02.all_areas')) + '</b>' + ICONS.chevron + '</label></div>';
}

function insightHTML(i) {
  let head, text;
  if (i.kind === 'holding') {
    head = t('m02.in_hold_h').replace('{crit}', t('crit.' + i.key));
    text = th('m02.in_hold_x', { crit: { html: '<bdi>' + esc(t('crit.' + i.key)) + '</bdi>' }, d: i.delta, task: i.task === null ? 0 : Math.abs(i.task) });
  } else if (i.kind === 'improving') {
    head = t('m02.in_up_h'); text = th('m02.in_up_x', { crit: { html: '<bdi>' + esc(t('crit.' + i.key)) + '</bdi>' }, d: i.delta });
  } else { head = t('m02.in_steady_h'); text = esc(t('m02.in_steady_x')); }
  return '<div class="insight">' + ICONS.pulse + '<p><b>' + esc(head) + '</b> ' + text + '</p>' + soonBtn('small', esc(t('m02.ask_why'))) + '</div>';
}

function signed(n) { return n === null ? '—' : (n > 0 ? '+' + n : (n < 0 ? '−' + Math.abs(n) : '±0')); }

function compareHTML(d) {
  const from = monthName(d.compare.then).slice(0, 3).toUpperCase(), to = monthName(d.compare.this).slice(0, 3).toUpperCase();
  const row = function (label, r, muted) {
    const cls = r.change === null || r.change === 0 ? 'n' : (r.change > 0 ? 'up' : 'down');
    return '<div class="cmp-row' + (muted ? ' muted' : '') + '"><span class="nm">' + label + '</span><span class="track"><i class="fill ' + cls + '" style="width:' + r.now + '%"></i>' +
      (r.before === null ? '' : '<i class="hollow" style="inset-inline-start:' + r.before + '%"></i>') + '<i class="solid ' + cls + '" style="inset-inline-start:' + r.now + '%"></i></span>' +
      '<span class="nums" dir="ltr">' + (r.before === null ? '' : r.before + ' → ') + '<b>' + r.now + '</b></span><span class="chg2 ' + cls + '" dir="ltr">' + signed(r.change) + '</span></div>';
  };
  const rows = d.rows.map(function (r) { return row(esc(t('crit.' + r.key)), r, false); }).join('');
  const wb = d.wellbeing ? row(esc(t('m02.wellbeing')) + ' <em>' + esc(t('m02.not_scored')) + '</em>', d.wellbeing, true)
                         : '<div class="cmp-row muted"><span class="nm">' + esc(t('m02.wellbeing')) + ' <em>' + esc(t('m02.not_scored')) + '</em></span><span class="hidden-note">' + esc(t('m01.s_hidden')) + '</span></div>';
  return '<section class="card cmp">' + cardHeadHTML(t('m02.cmp_title_' + BACK), esc(t('m02.cmp_sub')), '') +
    '<div class="cmp-head"><span>' + esc(t('m02.c_dim')) + '</span><span class="axis" dir="ltr"><i>0</i><i>100</i></span><span dir="ltr">' + from + ' → ' + to + '</span><span>' + esc(t('m02.c_change')) + '</span></div>' +
    rows + wb + '<div class="legend2"><span><i class="o"></i>' + esc(t('m02.lg_then')) + '</span><span><i class="s"></i>' + esc(t('m02.lg_now')) + '</span></div></section>';
}

function mixHTML(d) {
  const keys = ['gold', 'silver', 'bronze', 'growth'];
  const segs = keys.filter(function (k) { return d.mix.counts[k] > 0; }).map(function (k) {
    return '<i style="flex:' + d.mix.counts[k] + ';background:' + TIER_COLORS[k] + '" dir="ltr">' + (d.mix.pct[k] >= 15 ? d.mix.pct[k] + '%' : '') + '</i>';
  }).join('');
  const labels = keys.map(function (k) { return '<span><b dir="ltr">' + d.mix.counts[k] + '</b> ' + esc(tierName(k)) + '</span>'; }).join('');
  return '<section class="card mix"><h2>' + ICONS.pulse + ' ' + esc(t('m02.mix')) + '</h2><p class="sub">' + esc(t('m02.mix_sub')) + '</p>' +
    '<div class="mixbar">' + segs + '</div><div class="mixlbl">' + labels + '</div><p class="note">' + esc(t('m02.mix_note')) + '</p></section>';
}

function trendHTML(d) {
  const W = 640, H = 300, L = 50, R = 30, T = 20, B = 40, min = 65, max = 100;
  const pts = d.trend.points;
  const x = function (i) { return L + i * (W - L - R) / Math.max(1, pts.length - 1); };
  const y = function (v) { return T + (max - v) / (max - min) * (H - T - B); };
  let bands = '';
  [[100, 90, '#fbf3df', 'gold'], [90, 80, '#eef2f6', 'silver'], [80, 70, '#fcebdd', 'bronze']].forEach(function (b) {
    bands += '<rect x="' + L + '" y="' + y(b[0]) + '" width="' + (W - L - R) + '" height="' + (y(b[1]) - y(b[0])) + '" fill="' + b[2] + '"/>' +
             '<text x="' + (W - R - 6) + '" y="' + (y(b[0]) + 14) + '" class="bl" text-anchor="end">' + esc(tierName(b[3])) + '</text>';
  });
  const line = pts.map(function (p, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(p.v).toFixed(1); }).join(' ');
  const dots = pts.map(function (p, i) {
    return '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(p.v).toFixed(1) + '" r="4.5" fill="#0e2944"/><text x="' + x(i).toFixed(1) + '" y="' + (y(p.v) - 10).toFixed(1) + '" class="pv" text-anchor="middle">' + Math.round(p.v) + '</text>' +
           '<text x="' + x(i).toFixed(1) + '" y="' + (H - 12) + '" class="xl" text-anchor="middle">' + esc(t('month.' + Number(p.month.slice(5, 7))).toUpperCase()) + '</text>';
  }).join('');
  const sub = d.trend.stable ? tf('m02.trend_stable', { tier: tierName(d.trend.tier) }) : t('m02.trend_moving');
  return '<section class="card trend">' + cardHeadHTML(t('m02.trend'), esc(sub + ' — ' + t('m02.trend_tail')), '') +
    '<svg viewBox="0 0 ' + W + ' ' + H + '" class="trend-svg" role="img" aria-label="' + esc(t('m02.trend')) + '">' + bands + '<path d="' + line + '" fill="none" stroke="#0e2944" stroke-width="2.4"/>' + dots + '</svg></section>';
}

function builtHTML(d) {
  const rows = d.built.rows.map(function (r) {
    return '<tr><td><b>' + esc(t('crit.' + r.key)) + '</b><small>→ ' + esc(t('m02.sub.' + r.key)) + '</small></td><td><span class="bar"><i style="width:' + r.value + '%"></i></span></td>' +
           '<td dir="ltr">' + r.value + ' <span class="w">×' + r.weight + '%</span></td><td dir="ltr" class="pts">' + r.points.toFixed(2) + '</td></tr>';
  }).join('');
  return '<section class="card built"><h2>' + ICONS.pulse + ' ' + esc(t('m02.built')) + '</h2>' +
    '<div class="formula-d"><span class="mono" dir="ltr">' + th('m02.formula', { exact: d.built.exact.toFixed(1) }) + '</span><b dir="ltr">' + d.built.total + '</b></div>' +
    '<table><thead><tr><th>' + esc(t('m02.c_dim')) + '</th><th>' + esc(t('m02.c_value')) + '</th><th>' + esc(t('m02.c_weight')) + '</th><th>' + esc(t('m02.c_points')) + '</th></tr></thead><tbody>' + rows + '</tbody></table>' +
    '<div class="total"><b>' + esc(t('m02.total')) + '</b><b dir="ltr">' + d.built.total + '</b></div><p class="note">' + esc(t('m02.wb_note')) + '</p></section>';
}

function body(d) {
  return insightHTML(d.insight) +
    '<div class="row m02-top">' + compareHTML(d) + '<div class="col">' + teamTierCardHTML(d.score, th('m02.tier_note', { score: d.score.value })) + mixHTML(d) + '</div></div>' +
    '<div class="row m02-bottom">' + trendHTML(d) + builtHTML(d) + '</div>';
}
