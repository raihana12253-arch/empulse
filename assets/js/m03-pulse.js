// =====================================================================
// m03-pulse.js — M03 Team Pulse (pages/manager/pulse.html)
// Data: server/api/manager/pulse.php — the seven criteria of the team, now vs. last quarter (Q2).
// Explanation texts are rule-based (no LLM); numbers are the team's, never one person's.
// =====================================================================

document.addEventListener('DOMContentLoaded', function () {
  startManagerPage({ active: 'pulse', api: 'manager/pulse.php', crumb: 'm03.crumb', render: render });
});

function dot(v) { return v >= 80 ? '#14b8a6' : (v >= 60 ? '#f59e0b' : '#ef5a48'); }

function render(d) {
  document.querySelector('main').innerHTML =
    '<header class="page-header"><div class="copy"><h1>' + esc(t('m03.title')) + '</h1><p>' + esc(t('m03.subtitle')) + '</p></div>' +
      '<div class="actions">' + soonBtn('', ICONS.spark + esc(t('m03.explain'))) + '</div></header>' +
    '<div class="dashboard">' + (d.suppressed ? '<section class="card"><p class="empty">' + esc(t('m01.suppressed')) + '</p></section>' :
      '<div class="row m03-top"><section class="card">' + chartHead(d) + chartSVG(d) + '</section><section class="card nums">' + numsHTML(d) + '</section></div>' +
      '<div class="row m03-bottom"><section class="card why">' + whyHTML(d) + '</section><section class="card dept">' + deptHTML(d) + '</section></div>') + '</div>';
}

function chartHead(d) {
  const low = d.pulse.some(function (p) { return p.key === 'job_burnout' && p.now < 60; });
  return cardHeadHTML(t('m03.chart'), esc(t('m03.chart_sub')), low ? '<span class="pill coral"><i class="pdot"></i>' + esc(t('m03.chip')) + '</span>' : '');
}

function chartSVG(d) {
  const W = 760, H = 340, L = 30, R = 30, T = 24, B = 44, n = d.pulse.length;
  const x = function (i) { return L + (i + .5) * (W - L - R) / n; };
  const y = function (v) { return T + (100 - v) / 60 * (H - T - B); };   // 40..100
  const line = function (key) { return d.pulse.map(function (p, i) { return (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(p[key]).toFixed(1); }).join(' '); };
  let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="pulse-svg" role="img" aria-label="' + esc(t('m03.chart')) + '">' +
    '<rect x="' + L + '" y="' + y(100) + '" width="' + (W - L - R) + '" height="' + (y(80) - y(100)) + '" fill="#e9f7f4"/>' +
    '<text x="' + (W - R - 8) + '" y="' + (y(100) + 18) + '" text-anchor="end" class="zone">' + esc(t('m03.zone')) + '</text>' +
    '<line x1="' + L + '" x2="' + (W - R) + '" y1="' + y(50) + '" y2="' + y(50) + '" stroke="#e2e8f0"/>' +
    '<path d="' + line('before') + '" fill="none" stroke="#94a3b8" stroke-width="1.8" stroke-dasharray="5 4"/>' +
    '<path d="' + line('now') + '" fill="none" stroke="#0e2944" stroke-width="2.4"/>';
  d.pulse.forEach(function (p, i) {
    s += '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(p.now).toFixed(1) + '" r="7" fill="#fff" stroke="' + dot(p.now) + '" stroke-width="3"/>' +
         '<text x="' + x(i).toFixed(1) + '" y="' + (y(p.now) - 14).toFixed(1) + '" text-anchor="middle" class="pv' + (p.now < 60 ? ' low' : '') + '">' + p.now + '</text>' +
         '<text x="' + x(i).toFixed(1) + '" y="' + (H - 12) + '" text-anchor="middle" class="xl">' + esc(t('m03.ax.' + p.key)) + '</text>';
  });
  return s + '</svg>';
}

function numsHTML(d) {
  const rows = d.pulse.map(function (p) {
    return '<tr><td>' + esc(t('crit.' + p.key)) + '</td><td dir="ltr" class="q">' + p.before + '</td><td dir="ltr" class="nw' + (p.now < 60 ? ' low' : '') + '">' + p.now + '</td></tr>';
  }).join('');
  return '<h2>' + ICONS.pulse + ' ' + esc(t('m03.numbers')) + '</h2><table><thead><tr><th>' + esc(t('m03.c_pulse')) + '</th><th>Q2</th><th>' + esc(t('m03.c_now')) + '</th></tr></thead><tbody>' + rows + '</tbody></table>';
}

function whyHTML(d) {
  const w = d.why;
  const dr = {};
  w.drivers.forEach(function (x) { dr[x.key] = x; });
  const bar = function (title, sub, effect) {
    return '<div class="drv"><div class="dh"><b>' + title + '</b><small>' + sub + '</small></div><span class="track"><i style="width:' + Math.min(100, effect * 9.5) + '%"></i></span><b class="eff" dir="ltr">−' + effect + '</b></div>';
  };
  const wl = dr.workload, ot = dr.overtime, rc = dr.recognition;
  return '<div class="kick">' + ICONS.pulse + ' ' + esc(t('m03.why_kick')) + '</div><h2 class="big-h">' + esc(t('m03.why_head')) + '</h2>' +
    '<p class="lead">' + th('m03.why_text', { fall: w.fall, share: w.share }) + (w.innovation_up ? ' ' + esc(t('m03.why_inn')) : '') + '</p>' +
    (wl ? bar(th('m03.d_workload', { pct: wl.pct }), th('m03.d_workload_s', { n: wl.roles, role: dt(wl.role_name || 'SRE') }), wl.effect) : '') +
    (ot ? bar(th('m03.d_overtime', { hours: ot.hours, people: ot.people }), esc(dt(ot.note || '')), ot.effect) : '') +
    (rc ? bar(esc(t('m03.d_recog')), th('m03.d_recog_s', { pct: rc.pct }), rc.effect) : '') +
    '<p class="proj">' + esc(t('m03.projected')) + '</p>' +
    '<div class="btns"><a class="btn primary" href="#" data-soon="1"><span class="bolt">' + micon('bolt') + '</span>' + esc(t('m03.plan')) + ' ' + ARW + '</a>' + soonBtn('', ICONS.diamond + esc(t('m03.recognize'))) + '</div>';
}

function deptHTML(d) {
  const rows = d.dept.rows.map(function (r) {
    const lo = Math.min(r.team, r.dept) - 6, hi = Math.max(r.team, r.dept) + 6;
    return '<div class="dr"><span>' + esc(t('crit.' + r.key)) + '</span><span class="dl"><i class="tick" style="inset-inline-start:' + r.dept + '%"></i><i class="dt" style="inset-inline-start:' + r.team + '%"></i></span>' +
      '<span class="dn" dir="ltr"><b>' + r.team + '</b> · ' + esc(t('m03.dept')) + ' ' + r.dept + '</span></div>';
  }).join('');
  return '<h2>' + ICONS.pulse + ' ' + esc(tf('m03.vs', { dept: dt(d.dept.name) })) + '</h2><p class="sub">' + esc(tf('m03.vs_sub', { n: d.dept.people })) + '</p>' + rows;
}
