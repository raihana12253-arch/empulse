// =====================================================================
// m04b-member.js — M04b Team member profile (pages/manager/member.html?id=)
// Data: server/api/manager/member.php — ONLY a direct report (403 otherwise).
// Private check-in answers are never shown; wellbeing/energy appear only if the person chose to share them.
// All "what could happen" numbers are projections, labelled as such. Risk = decision support, not diagnosis.
// =====================================================================

const PID = new URLSearchParams(location.search).get('id') || '';
let D = null;

document.addEventListener('DOMContentLoaded', function () {
  startManagerPage({
    active: 'members', api: 'manager/member.php', crumb: 'm04.crumb', render: render,
    query: function () { return '?id=' + encodeURIComponent(PID); },
    extraCrumb: function () { return PID ? '' : ''; }
  });
});

const STATE_COLOR = { thriving: '#14b8a6', stretched: '#f59e0b', burnout: '#ef5a48' };

function render(d) {
  D = d;
  const p = d.person, f = p.first_name;
  document.getElementById('breadcrumb').innerHTML = '<bdi>' + esc(dt(d.team.name)) + ' · ' + esc(tf('mshell.people', { n: d.team.people })) + '</bdi><span class="sep">/</span><a href="members.html">' + esc(t('m04.crumb')) + '</a><span class="sep">/</span><span><bdi>' + esc(p.name) + '</bdi></span>';
  const tabs = ['who', 'score', 'tier', 'why', 'strengths', 'risks', 'grow', 'did'].map(function (k, i) {
    return '<a href="#s-' + k + '" class="tab' + (i === 0 ? ' on' : '') + '">' + esc(t('m4b.tab.' + k)) + ' <sup dir="ltr">' + (i + 1) + '</sup></a>';
  }).join('');
  document.querySelector('main').innerHTML =
    '<header class="page-header"><div class="copy"><h1><bdi>' + esc(p.name) + '</bdi> · ' + esc(t('m4b.title')) + '</h1><p>' + esc(t('m4b.subtitle')) + '</p></div>' +
      '<div class="actions">' + soonBtn('', ICONS.spark + esc(t('m4b.prepare'))) + soonBtn('danger', micon('bolt') + esc(t('m4b.start'))) + '</div></header>' +
    '<div class="dashboard"><nav class="tabs">' + tabs + '</nav>' +
    '<div class="row m4-top" id="s-who">' + identityHTML(d) + tierHTML(d) + '<div class="col">' + nowHTML(d) + pastHTML(d) + '</div></div>' +
    bannerHTML(d) +
    '<div class="row m4-why" id="s-why"><section class="card" id="s-score">' + calcHTML(d) + '</section><section class="card" id="s-tier">' + pulseHTML(d) + '</section></div>' +
    timelineHTML(d) +
    '<div class="row m4-sr" id="s-strengths"><section class="card">' + strengthsHTML(d) + '</section><section class="card" id="s-risks">' + risksHTML(d) + '</section></div>' +
    growHTML(d) + actionsHTML(d) + didHTML(d) +
    '<div class="signals"><span>' + ICONS.check + '</span><p><b>' + esc(t('m4b.sig_b')) + '</b> ' + esc(tf('m4b.sig', { first: f })) + '</p></div></div>';
  document.querySelectorAll('.tab').forEach(function (a) { a.addEventListener('click', function () { document.querySelectorAll('.tab').forEach(function (x) { x.classList.remove('on'); }); a.classList.add('on'); }); });
}

function chip(c) { return '<span class="chp">' + esc(dt(c)) + '</span>'; }

function identityHTML(d) {
  const p = d.person, s = d.score;
  return '<section class="card ident"><span class="bigav">' + esc(p.initials) + '</span><b class="nm"><bdi>' + esc(p.name) + '</bdi></b><small>' + esc(dt(p.job_title)) + ' · ' + esc(dt(p.team)) + '</small><small>' + esc(tf('m4b.reports_to', { name: p.manager })) + '</small>' +
    '<div class="meta mono" dir="ltr">' + esc(tf('m4b.tenure', { n: p.tenure })) + '</div>' +
    '<div class="chps">' + p.chips.map(chip).join('') + '</div>' +
    (s.alert ? '<div class="alertbar">' + ICONS.up + ' ' + esc(tf('m4b.alert_bar', { risk: s.risk })) + '</div>' : '') +
    '<a class="lnk" href="#s-risks">' + esc(t('m4b.root')) + ' ' + ARW + '</a></section>';
}

function tierHTML(d) {
  const s = d.score, R = 62, C = 2 * Math.PI * R;
  return '<section class="tier-card team-tier tier-' + s.tier + ' m4tier"><div class="tier-head"><span class="mono">' + esc(t('m4b.tier')) + '</span>' + (s.alert ? '<span class="pill coral">' + esc(t('m4b.burnout_pill')) + '</span>' : '') + '</div>' +
    '<div class="ringbox"><svg viewBox="0 0 150 150"><circle cx="75" cy="75" r="' + R + '" fill="none" stroke="#1d4166" stroke-width="7"/><circle cx="75" cy="75" r="' + R + '" fill="none" stroke="#2cc6b4" stroke-width="7" stroke-linecap="round" stroke-dasharray="' + (C * s.value / 100).toFixed(1) + ' ' + C.toFixed(1) + '" transform="rotate(-90 75 75)"/></svg><div class="ring-in"><b dir="ltr">' + s.value + '</b><span class="mono">' + esc(tierName(s.tier)) + '</span></div></div>' +
    '<b class="tname">' + esc(tierName(s.tier)) + '</b><p>' + esc(t('tier.summary.' + s.tier)) + '</p>' +
    (s.next ? '<small>' + th('tier.points_to', { n: s.next.points, tier: tierName(s.next.key) }) + '</small>' : '') + '</section>';
}

function nowHTML(d) {
  return '<section class="card now"><h3>' + esc(tf('m4b.how_now', { first: d.person.first_name })) + '</h3><ul>' + d.now.map(function (m) { return '<li>' + MR(m) + '</li>'; }).join('') + '</ul>' +
    '<div class="btns">' + soonBtn('danger small', esc(t('m4b.start'))) + '<a class="lnk" href="#s-risks">' + esc(t('m4b.root')) + ' ' + ARW + '</a></div></section>';
}

function pastHTML(d) {
  const s = d.score;
  const rows = [['performance', s.performance], ['engagement', s.engagement]].map(function (r) { return '<tr><td>' + esc(t('m4b.p_' + r[0])) + '</td><td dir="ltr"><b>' + r[1] + '</b></td><td><span class="bar"><i style="width:' + r[1] + '%"></i></span></td></tr>'; }).join('');
  const wb = d.wellbeing ? '<tr><td>' + esc(t('m4b.p_wellbeing')) + '</td><td dir="ltr"><b class="low">' + d.wellbeing.value + '</b></td><td><span class="bar"><i class="c" style="width:' + d.wellbeing.value + '%"></i></span></td></tr>' : '';
  return '<section class="card past"><table><thead><tr><th>' + esc(t('m4b.c_signals')) + '</th><th>' + esc(t('m03.c_now')) + '</th><th>' + esc(t('m4b.c_how')) + '</th></tr></thead><tbody>' + rows + wb + '</tbody></table></section>';
}

function bannerHTML(d) {
  const b = d.banner;
  if (!b) { return ''; }
  return '<div class="m4banner"><span class="pill gold-p">' + esc(tierName(b.tier)) + '</span><p><b>' + esc(t('m4b.ban_h')) + '</b> ' + th('m4b.ban_x', { perf: b.perf, tier: tierName(b.tier), workload: b.workload, overtime: b.overtime }) + '</p>' + soonBtn('danger small', esc(t('m4b.start'))) + '</div>';
}

function calcHTML(d) {
  const rows = d.calc.map(function (r) {
    const cls = r.change > 0 ? 'up' : (r.change < 0 ? 'down' : 'n');
    return '<tr><td><b>' + esc(t('crit.' + r.key)) + '</b></td><td dir="ltr" class="w">' + r.weight + '%</td><td dir="ltr"><b' + (r.score < 60 ? ' class="low"' : '') + '>' + r.score + '</b></td><td dir="ltr" class="q">' + r.before + '</td><td dir="ltr" class="chg2 ' + cls + '">' + (r.change > 0 ? '+' : (r.change < 0 ? '−' : '')) + Math.abs(r.change) + '</td><td><span class="bar"><i class="' + (r.score < 60 ? 'c' : '') + '" style="width:' + r.score + '%"></i></span></td></tr>';
  }).join('');
  return '<h2 class="sq">' + esc(t('m4b.why_h')) + '</h2><p class="sub">' + esc(t('m4b.why_sub')) + '</p><table class="calc"><thead><tr><th>' + esc(t('m4b.c_signal')) + '</th><th>' + esc(t('m02.c_weight')) + '</th><th>' + esc(t('m4b.c_score')) + '</th><th>' + esc(t('m4b.c_base')) + '</th><th>' + esc(t('m02.c_change')) + '</th><th></th></tr></thead><tbody>' + rows + '</tbody></table>' +
    '<div class="total"><b>' + esc(t('m4b.total')) + '</b><b dir="ltr">' + d.score.value + '</b></div>' +
    '<div class="tiernote"><b>' + esc(tierName(d.score.tier)) + ' · <span dir="ltr">' + d.score.value + '</span></b>' + (d.team_top ? '<small>' + th('m4b.team_top', { n: d.team_top, team: dt(d.team.name) }) + '</small>' : '') + '</div><p class="note">' + esc(t('m4b.wb_note')) + '</p>';
}

function pulseHTML(d) {
  const pl = d.pulse, W = 420, H = 150, n = pl.weeks.length;
  const x = function (i) { return 14 + i * (W - 28) / (n - 1); }, y = function (v) { return 10 + (100 - v) / 100 * (H - 20); };
  let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="wk" role="img" aria-label="' + esc(t('m4b.pulse')) + '"><rect x="0" y="' + y(40) + '" width="' + W + '" height="' + (y(0) - y(40)) + '" fill="#f6fbfa"/>';
  pl.weeks.forEach(function (w, i) { s += '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(w.risk).toFixed(1) + '" r="4.5" fill="' + (w.risk >= 60 ? '#ef5a48' : (w.risk >= 45 ? '#f59e0b' : '#14b8a6')) + '"/>'; });
  s += '</svg>';
  const en = pl.energy ? '<p class="en">' + esc(tf('m4b.energy', { first: d.person.first_name, level: t('m4b.lv.' + pl.energy.level), n: pl.energy.n, of: pl.energy.of })) + '</p>' : '';
  return '<h2>' + esc(t('m4b.pulse')) + '</h2><p class="sub">' + esc(t('m4b.pulse_sub')) + '</p>' +
    '<div class="big4"><div><span class="mono">' + esc(t('m04.burnout')) + '</span><b dir="ltr">' + pl.risk + '%</b></div><div><span class="mono">' + esc(t('m04.engagement')) + '</span><b dir="ltr">' + pl.engagement + '</b></div>' + (pl.wellbeing !== null && pl.wellbeing !== undefined ? '<div><span class="mono">' + esc(t('m4b.p_wellbeing')) + '</span><b dir="ltr" class="low">' + pl.wellbeing + '</b></div>' : '') + '</div>' +
    '<span class="mono lbl">' + esc(t('m4b.weekly')) + '</span>' + s + '<div class="wx mono" dir="ltr"><span>' + fmtDate(pl.weeks[0].week) + '</span><span>' + fmtDate(pl.weeks[n - 1].week) + '</span></div>' +
    (pl.outlier ? '<p class="note">' + esc(t('m4b.outlier')) + '</p>' : '') + en;
}

function timelineHTML(d) {
  const ms = d.timeline.months, n = ms.length, W = 900, H = 290, L = 90, R = 20;
  const x = function (i) { return L + i * (W - L - R) / (n - 1); };
  const rows = [['performance', 'm4b.p_performance', false], ['engagement', 'm4b.p_engagement', false]];
  if (ms.some(function (m) { return m.wellbeing !== null && m.wellbeing !== undefined; })) { rows.push(['wellbeing', 'm4b.p_wellbeing', false]); }
  rows.push(['risk', 'm04.burnout', true]);
  const rh = (H - 60) / rows.length;
  let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="tl-svg" role="img" aria-label="' + esc(t('m4b.tl')) + '">';
  rows.forEach(function (r, ri) {
    const top = 10 + ri * rh, y = function (v) { return top + 14 + (100 - v) / 100 * (rh - 30); };
    s += '<text x="0" y="' + (top + rh / 2) + '" class="rl">' + esc(t(r[1]).toUpperCase()) + '</text><line x1="' + L + '" x2="' + (W - R) + '" y1="' + (top + rh - 6) + '" y2="' + (top + rh - 6) + '" stroke="#e2e8f0"/>';
    const pts = ms.filter(function (m) { return m[r[0]] !== null && m[r[0]] !== undefined; });
    s += '<path d="' + ms.map(function (m, i) { return m[r[0]] === null || m[r[0]] === undefined ? '' : 'L' + x(i).toFixed(1) + ' ' + y(m[r[0]]).toFixed(1); }).join(' ').replace(/^L/, 'M') + '" fill="none" stroke="#cbd5e1" stroke-width="1.4"/>';
    ms.forEach(function (m, i) { if (m[r[0]] !== null && m[r[0]] !== undefined) { s += '<circle cx="' + x(i).toFixed(1) + '" cy="' + y(m[r[0]]).toFixed(1) + '" r="4.5" fill="' + STATE_COLOR[m.state] + '"/>'; } });
    const last = ms[n - 1][r[0]];
    if (last !== null && last !== undefined) { s += '<text x="' + (W - R) + '" y="' + (y(last) - 8) + '" text-anchor="end" class="lv">' + last + (r[2] ? '%' : '') + '</text>'; }
  });
  ms.forEach(function (m, i) { if (i % 2 === 0 || i === n - 1) { s += '<text x="' + x(i).toFixed(1) + '" y="' + (H - 28) + '" text-anchor="middle" class="xl">' + esc(t('month.' + Number(m.month.slice(5, 7))).slice(0, 3).toUpperCase()) + '</text>'; } });
  const ev = d.timeline.events || [];
  ev.forEach(function (e, i) { s += '<text x="' + (L + (i + .5) * (W - L - R) / ev.length).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle" class="ev">' + esc(dt(e)) + '</text>'; });
  s += '</svg>';
  const lg = ['thriving', 'stretched', 'burnout'].map(function (k) { return '<span><i style="background:' + STATE_COLOR[k] + '"></i>' + esc(t('m4b.st_' + k)) + '</span>'; }).join('');
  return '<section class="card tl" id="s-timeline"><h2 class="sq">' + esc(t('m4b.tl')) + '</h2><p class="sub">' + esc(t('m4b.tl_sub')) + '</p><div class="lg3">' + lg + '</div>' + s + '</section>';
}

function strengthsHTML(d) {
  const st = d.strengths.map(function (x) { return '<li class="g">' + th('m4b.s_item', { crit: { html: esc(t('crit.' + x.crit)) }, v: x.v }) + '</li>'; }).join('');
  const dv = d.development.map(function (x) { return '<li class="a">' + esc(dt(x.text)) + (x.detail ? ' — ' + esc(dt(x.detail)) : '') + '</li>'; }).join('');
  return '<h3>' + ICONS.arrowUp + ' ' + esc(t('m4b.strengths')) + '</h3><ul class="bl">' + st + '</ul><h3>' + ICONS.pulse + ' ' + esc(t('m4b.dev')) + '</h3><ul class="bl">' + (dv || '<li class="a">' + esc(t('m4b.dev_none')) + '</li>') + '</ul>';
}

function risksHTML(d) {
  return '<h3>' + ICONS.up + ' ' + esc(t('m4b.risks')) + '</h3><p class="sub">' + esc(t('m4b.risks_sub')) + '</p>' + d.risks.map(function (r) {
    return '<div class="rk"><span class="lvl ' + r.level + '">' + esc(t('m4b.lvl.' + r.level)) + '</span><p>' + MR(r) + (r.p && r.p.ot ? ' ' + esc(t('m4b.r_ot')) : '') + '</p></div>';
  }).join('');
}

function growHTML(d) {
  const g = d.grow;
  const lo = 60, hi = 100, pos = function (v) { return Math.max(0, Math.min(100, (v - lo) / (hi - lo) * 100)); };
  const prot = '<div class="prot"><span class="mono">' + esc(t('m4b.protects')) + '</span><div><span>' + esc(t('crit.job_burnout')) + ' <em>(' + esc(t('m4b.scored')) + ')</em></span><b dir="ltr">' + g.burnout_now + ' → +' + g.burnout_gain + '</b></div>' +
    (g.wellbeing_now !== null && g.wellbeing_now !== undefined ? '<div><span>' + esc(t('m4b.p_wellbeing')) + ' <em>(' + esc(t('m4b.not_scored')) + ')</em></span><b dir="ltr" class="low">' + g.wellbeing_now + ' → +' + g.wellbeing_gain + '</b></div>' : '') + '<small>' + esc(t('m4b.projected')) + '</small></div>';
  return '<section class="card grow" id="s-grow"><h2 class="sq">' + esc(g.next ? tf('m4b.grow_h', { first: d.person.first_name }) : tf('m4b.grow_top', { first: d.person.first_name })) + '</h2>' +
    '<div class="gwrap"><div class="band"><i class="seg b" style="width:' + pos(80) + '%"></i><i class="seg s" style="width:' + (pos(90) - pos(80)) + '%"></i><i class="seg g" style="width:' + (100 - pos(90)) + '%"></i><i class="mk" style="inset-inline-start:' + pos(g.score) + '%"></i></div>' +
    '<div class="scale mono"><span>' + esc(tierName('bronze')) + ' 70</span><span>' + esc(tierName('silver')) + ' 80</span><span>' + esc(tierName('gold')) + ' 90</span></div>' +
    '<p class="you" dir="ltr">' + esc(t('m4b.score')) + ' ' + g.score + '</p></div>' + prot + '</section>';
}

function actionsHTML(d) {
  if (!d.actions.length) { return ''; }
  return '<section class="acts" id="s-actions"><span class="mono">' + esc(t('m4b.rec_actions')) + '</span><div class="three">' + d.actions.map(function (a) {
    return '<article class="card act"><div class="ah"><b>' + esc(dt(a.title)) + '</b><span class="pts" dir="ltr">−' + a.pts + ' ' + esc(t('m4b.pts_risk')) + '</span></div>' + a.lines.map(function (l) { return '<p>' + esc(dt(l)) + '</p>'; }).join('') +
      '<div class="af">' + soonBtn('primary small', esc(t('m4b.plan')) + ' ' + ARW) + '<small>' + esc(dt(a.footer)) + '</small></div></article>';
  }).join('') + '</div></section>';
}

function didHTML(d) {
  const pr = d.projection;
  let left = '<p class="empty">' + esc(t('m4b.did_none')) + '</p>', right = '';
  if (pr) {
    const row = function (k, a, b) { return '<tr><td>' + esc(t(k)) + '</td><td><span class="pill amber">' + esc(t('m4b.projected_short')) + '</span></td><td dir="ltr">' + a + '</td><td dir="ltr" class="aft">' + b + '</td></tr>'; };
    left = '<table class="calc"><thead><tr><th>' + esc(t('m4b.c_interv')) + '</th><th>' + esc(t('m4b.c_outcome')) + '</th><th>' + esc(t('m4b.c_before')) + '</th><th>' + esc(t('m4b.c_after')) + '</th></tr></thead><tbody>' +
      row('m4b.o_burnout', d.score.risk + '%', pr.risk_to + '%') + row('m4b.p_engagement', d.score.engagement, pr.engagement_to) + (pr.wellbeing_from !== null && pr.wellbeing_from !== undefined ? row('m4b.p_wellbeing', pr.wellbeing_from, pr.wellbeing_to) : '') + '</tbody></table>' +
      '<p class="note">' + esc(tf('m4b.proj_note', { n: pr.cases_n, total: pr.cases_total, drop: pr.drop, weeks: pr.case_weeks })) + '</p>';
    right = '<section class="card proj"><b class="pk">' + esc(t('m4b.proj_k')) + '</b><h3>' + esc(tf('m4b.proj_h', { w: pr.horizon })) + '</h3>' +
      '<div class="pf"><span dir="ltr" class="a">' + d.score.risk + '%</span><span class="ar">' + ARW + '</span><span dir="ltr" class="b">' + pr.risk_to + '%</span></div><small>' + esc(tf('m4b.proj_in', { w: pr.horizon })) + '</small>' +
      '<p class="note">' + esc(tf('m4b.proj_conf', { c: pr.confidence, w: pr.horizon, drop: pr.drop, weeks: pr.case_weeks, n: pr.cases_n, total: pr.cases_total })) + '</p>' + soonBtn('danger', micon('bolt') + esc(t('m4b.start'))) + '</section>';
  }
  return '<div class="row m4-did" id="s-did"><section class="card"><h2 class="sq">' + esc(t('m4b.did_h')) + '</h2>' + left + '</section>' + right + '</div>';
}
