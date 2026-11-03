// =====================================================================
// m01-overview.js — M01 Team Overview · Team Pulse Map (pages/manager/overview.html)
// Data: server/api/manager/overview.php — the manager's DIRECT REPORTS only.
// Radar: closer to the centre = more urgent (burnout risk), node size = urgency, ring colour = tier.
// Private check-in answers are never shown; wellbeing appears only when the person chose to share it.
// =====================================================================

document.addEventListener('DOMContentLoaded', function () {
  startManagerPage({ active: 'overview', api: 'manager/overview.php', crumb: 'm01.crumb', render: render });
});

let D = null;
let selected = null;
const TIER_RING = { gold: '#d9a93f', silver: '#95a3b3', bronze: '#c47f4c', growth: '#93b9c3' };
const STATUS_FILL = { at_risk: '#fbd9d4', needs_attention: '#fdebd3', improving: '#dff3ef', healthy: '#e5eef9' };

function arrow(change, goodWhenUp) {
  if (change === null || change === undefined || change === 0) { return ''; }
  const up = change > 0;
  const good = goodWhenUp ? up : !up;
  return '<span class="delta ' + (good ? 'good' : 'bad') + '" dir="ltr">' + (up ? '↑ ' : '↓ ') + Math.abs(change) + '</span>';
}

function spark(series, color) {
  if (!series || series.length < 2) { return '<span class="spark"></span>'; }
  const min = Math.min.apply(null, series), max = Math.max.apply(null, series), span = (max - min) || 1;
  const pts = series.map(function (v, i) { return (i / (series.length - 1) * 100).toFixed(1) + ',' + (26 - (v - min) / span * 22).toFixed(1); }).join(' ');
  return '<svg class="spark" viewBox="0 0 100 30" preserveAspectRatio="none" aria-hidden="true"><polyline points="' + pts + '" fill="none" stroke="' + color + '" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>';
}

function tile(labelKey, big, change, goodWhenUp, series, color, sub, bigClass) {
  return '<div class="tile"><span class="mono">' + esc(t(labelKey)) + '</span><div class="big' + (bigClass ? ' ' + bigClass : '') + '"><b dir="ltr">' + big + '</b>' + arrow(change, goodWhenUp) + '</div>' + spark(series, color) + '<small>' + sub + '</small></div>';
}

function render(d) {
  D = d;
  const first = d.who.first_name;
  document.querySelector('main').innerHTML =
    '<header class="page-header"><div class="copy"><h1>' + esc(tf('m01.hello', { name: first })) + '</h1><p>' + th('m01.sub', { team: dt(d.team.name), n: d.team.people }) + '</p></div>' +
      '<div class="actions"><button class="btn" type="button" data-soon="1">' + ICONS.spark + esc(t('m01.why')) + '</button>' +
      '<button class="btn primary" type="button" data-soon="1"><span class="bolt">' + micon('bolt') + '</span>' + esc(t('m01.start')) + ' ' + ARW + '</button></div></header>' +
    '<div class="dashboard">' + (d.suppressed ? '<section class="card"><p class="empty">' + esc(t('m01.suppressed')) + '</p></section>' : tilesHTML(d) +
      '<div class="row map-row"><section class="card map-card">' + mapHeadHTML(d) + '<div id="radar" class="radar"></div></section>' +
      '<div class="col"><section class="card person" id="person"></section><section class="card changing">' + changingHTML(d) + '</section></div></div>' +
      queueHTML(d) +
      '<div class="signals"><span>' + ICONS.check + '</span><p><b>' + esc(t('m01.signals_b')) + '</b> ' + esc(t('m01.signals')) + '</p></div>') + '</div>';
  if (d.suppressed) { return; }
  selected = d.map.people.length ? d.map.people[0].id : null;
  drawRadar(); drawPerson();
  document.getElementById('radar').addEventListener('click', function (e) {
    const n = e.target.closest('[data-id]');
    if (n) { selected = Number(n.getAttribute('data-id')); drawRadar(); drawPerson(); }
  });
}

function tilesHTML(d) {
  const x = d.tiles, s = x.score;
  const burnColor = '#b93a2c';
  const R = 62, C = 2 * Math.PI * R, pct = Math.min(1, s.value / 100);
  const nextTxt = s.next ? th('tier.points_to', { n: s.next.points, tier: tierName(s.next.key) }) : esc(t('tier.top_reached'));
  const next = '<div class="to-next"><span>' + nextTxt + '</span><span class="mono gold-text" dir="ltr">' + s.value + ' / 100</span></div><div class="mini-bar"><i style="width:' + Math.min(100, Math.round(s.value)) + '%"></i></div>';
  const tierCard = '<div class="tier-card team-tier tier-' + s.tier + '"><div class="tier-head"><span class="mono">' + esc(t('m01.tier')) + '</span>' +
      (s.change ? '<span class="chg ' + (s.change > 0 ? 'up' : 'down') + '" dir="ltr">' + (s.change > 0 ? '↑ ' : '↓ ') + Math.abs(s.change) + '</span>' : '') + '</div>' +
    '<div class="ringbox"><svg viewBox="0 0 150 150"><circle cx="75" cy="75" r="' + R + '" fill="none" stroke="#1d4166" stroke-width="7"/><circle cx="75" cy="75" r="' + R + '" fill="none" stroke="#2cc6b4" stroke-width="7" stroke-linecap="round" stroke-dasharray="' + (C * pct).toFixed(1) + ' ' + C.toFixed(1) + '" transform="rotate(-90 75 75)"/></svg>' +
      '<div class="ring-in"><b dir="ltr">' + s.value + '</b><span class="mono">' + esc(tierName(s.tier)) + '</span></div></div>' +
    '<b class="tname">' + esc(tierName(s.tier)) + '</b><p>' + esc(t('tier.summary.' + s.tier)) + '</p>' + next +
    '<small>' + th('m01.tier_note', { n: d.team.people }) + '</small></div>';
  const wb = x.wellbeing, mo = x.morale;
  return '<div class="tiles">' + tierCard + '<div class="tgrid">' +
    tile('m01.t_perf', x.performance.value, x.performance.change, true, x.performance.series, '#0f172a', esc(t('m01.s_perf'))) +
    tile('m01.t_eng', x.engagement.value, x.engagement.change, true, x.engagement.series, '#ef5a48', esc(t(x.engagement.overtime_up && x.engagement.change < 0 ? 'm01.s_eng_fell' : 'm01.s_eng'))) +
    (wb ? tile('m01.t_well', wb.value, wb.change, true, wb.series, '#ef5a48', th('m01.s_well', { n: wb.n })) : tile('m01.t_well', '—', null, true, null, '#ef5a48', esc(t('m01.s_hidden')))) +
    (mo ? tile('m01.t_morale', mo.value, mo.change, true, mo.series, '#f59e0b', th('m01.s_morale', { n: mo.n })) : tile('m01.t_morale', '—', null, true, null, '#f59e0b', esc(t('m01.s_hidden')))) +
    tile('m01.t_inn', x.innovation.value, x.innovation.change, true, x.innovation.series, '#14b8a6', th('m01.s_inn', { a: x.innovation.involved, b: x.innovation.of })) +
    tile('m01.t_burn', x.burnout.value + '%', x.burnout.change, false, x.burnout.series, burnColor, th('m01.s_burn', { n: x.burnout.above }), 'red') +
    '</div></div>';
}

function mapHeadHTML(d) {
  const c = d.map.counts;
  const legend = [['at_risk', 'coral'], ['needs_attention', 'amber'], ['improving', 'teal'], ['healthy', 'blue']].map(function (p) {
    return '<span class="lg"><span class="pill ' + p[1] + '">' + esc(t('m01.st.' + p[0])) + '</span><b dir="ltr">' + c[p[0]] + '</b></span>';
  }).join('');
  return '<div class="card-head"><div class="copy"><h2>' + ICONS.pulse + ' ' + esc(t('m01.map')) + '</h2><p class="sub">' + esc(t('m01.map_sub')) + '</p></div><div class="legend">' + legend + '</div></div>';
}

function drawRadar() {
  const W = 560, H = 520, cx = 280, cy = 262;
  const people = D.map.people;
  const rings = [[96, 'now'], [150, 'watch'], [214, 'steady']];
  let svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="radar-svg" role="img" aria-label="' + esc(t('m01.map')) + '">';
  svg += '<circle cx="' + cx + '" cy="' + cy + '" r="236" fill="#f6f9fc"/>';
  rings.slice().reverse().forEach(function (r, i) { svg += '<circle cx="' + cx + '" cy="' + cy + '" r="' + r[0] + '" fill="' + ['#fcf4f0', '#f7f1ee', '#fbe7e2'][i] + '" opacity="' + [0.8, 0.7, 0.55][i] + '"/>'; });
  svg += '<circle cx="' + cx + '" cy="' + cy + '" r="40" fill="#0e2944"/><text x="' + cx + '" y="' + (cy + 8) + '" text-anchor="middle" class="core-n">' + D.tiles.score.value + '</text><text x="' + cx + '" y="' + (cy + 24) + '" text-anchor="middle" class="core-t">' + esc(tierName(D.tiles.score.tier)) + '</text>';
  rings.forEach(function (r) {
    const label = t('m01.ring.' + r[1]);
    svg += '<text x="' + (cx + r[0] * 0.62 + 40) + '" y="' + (cy - r[0] * 0.62 - 6) + '" class="ring-l" text-anchor="middle" direction="ltr">' + esc(label) + '</text>';
  });
  people.forEach(function (p, i) {
    const dist = 62 + (100 - p.risk) * 1.55;
    const ang = (-130 + i * 137.5) * Math.PI / 180;
    const x = cx + Math.cos(ang) * dist, y = cy + Math.sin(ang) * dist;
    const size = 15 + p.risk / 100 * 15;
    const on = p.id === selected;
    svg += '<g class="node' + (on ? ' on' : '') + '" data-id="' + p.id + '" tabindex="0" role="button" aria-label="' + esc(p.name) + '">' +
      (on ? '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + (size + 6).toFixed(1) + '" fill="none" stroke="#ef5a48" stroke-width="2" opacity=".5"/>' : '') +
      '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + size.toFixed(1) + '" fill="' + STATUS_FILL[p.status] + '" stroke="' + TIER_RING[p.tier] + '" stroke-width="3"/>' +
      '<text x="' + x.toFixed(1) + '" y="' + (y + 4).toFixed(1) + '" text-anchor="middle" class="nd-i">' + esc(p.initials) + '</text>' +
      '<text x="' + x.toFixed(1) + '" y="' + (y + size + 15).toFixed(1) + '" text-anchor="middle" class="nd-s">' + p.score + '</text></g>';
  });
  document.getElementById('radar').innerHTML = svg + '</svg>';
}

function statusPill(status) {
  const kind = { at_risk: 'coral', needs_attention: 'amber', improving: 'teal', healthy: 'blue' }[status];
  return '<span class="pill ' + kind + '">' + esc(t('m01.st.' + status)) + '</span>';
}

function drawPerson() {
  const p = D.map.people.filter(function (x) { return x.id === selected; })[0];
  const el = document.getElementById('person');
  if (!p) { el.innerHTML = '<p class="empty">' + esc(t('m01.none')) + '</p>'; return; }
  const wb = p.wellbeing ? esc(t('m01.lv.' + p.wellbeing.level)) + ' · <span dir="ltr">' + p.wellbeing.value + '</span>' : '<span class="faint">' + esc(t('m01.not_shared')) + '</span>';
  const sug = p.suggestion ? '<div class="suggest">' + ICONS.spark + '<span>' + th('m01.suggested', { text: { html: '<bdi>' + esc(dt(p.suggestion.title)) + '</bdi>' } }) + '</span></div>' : '';
  el.innerHTML = '<div class="p-head"><span class="p-av" style="border-color:' + TIER_RING[p.tier] + '" dir="ltr">' + esc(p.initials) + '</span><div><b><bdi>' + esc(p.name) + '</bdi></b><small>' + esc(dt(p.job_title)) + '</small></div>' + statusPill(p.status) + '</div>' +
    '<div class="p-grid"><div><span class="mono">' + esc(t('m01.p_tier')) + '</span><b><span dir="ltr">' + p.score + '</span> <em class="tier-' + p.tier + '">' + esc(tierName(p.tier)) + '</em></b></div>' +
    '<div><span class="mono">' + esc(t('m01.t_perf')) + '</span><b dir="ltr">' + p.performance + '</b></div>' +
    '<div><span class="mono">' + esc(t('m01.t_well')) + '</span><b>' + wb + '</b></div>' +
    '<div><span class="mono">' + esc(t('m01.p_risk')) + '</span><b class="' + (p.risk >= 60 ? 'red' : '') + '">' + th('m01.burnout_n', { n: p.risk + '%' }) + '</b></div></div>' + sug +
    '<div class="p-actions"><button class="btn primary" type="button" data-soon="1"><span class="bolt">' + micon('bolt') + '</span>' + esc(t('m01.view')) + '</button>' +
    '<a class="btn" href="recognition.html">' + ICONS.ring + esc(t('m01.recognize')) + '</a></div>' +
    '<a class="intervene" href="#" data-soon="1">' + esc(t('m01.intervene')) + ' ' + micon('bolt') + '</a>' +
    '<p class="privacy">' + th('m01.privacy', { name: p.name.split(' ')[0] }) + '</p>';
}

function changingHTML(d) {
  const icons = { workload: ['trend', 'coral'], overtime: ['ring', 'amber'], engagement: ['heart', 'coral'], ideas: ['bulb', 'teal'] };
  const rows = d.changing.map(function (c) {
    let text;
    if (c.kind === 'workload') { text = c.roles ? th('m01.c_workload', { pct: (c.pct >= 0 ? '+' : '−') + Math.abs(c.pct) + '%', roles: c.roles, role: c.role_name || 'SRE' }) : th('m01.c_workload_plain', { pct: (c.pct >= 0 ? '+' : '−') + Math.abs(c.pct) + '%' }); }
    else if (c.kind === 'overtime') { text = th('m01.c_overtime', { hours: c.hours, people: c.people }); }
    else if (c.kind === 'engagement') { text = th('m01.c_engagement', { n: (c.delta >= 0 ? '+' : '−') + Math.abs(c.delta) }); }
    else { text = th('m01.c_ideas', { n: c.count }); }
    return '<li class="' + icons[c.kind][1] + '"><span>' + micon(icons[c.kind][0]) + '</span><p>' + text + '</p></li>';
  }).join('');
  return '<h2>' + ICONS.pulse + ' ' + esc(t('m01.changing')) + '</h2><ul>' + rows + '</ul>';
}

function queueHTML(d) {
  const rows = d.queue.map(function (q) {
    let pill, text, sub;
    if (q.kind === 'decision') { pill = '<span class="pill coral"><i></i>' + esc(t('m01.q_decision')) + '</span>'; sub = th('m01.q_risk', { n: q.risk + '%' }) + ' ' + (q.change > 0 ? '↑' : '↓'); text = dt(q.title); }
    else if (q.kind === 'progress') { pill = '<span class="pill amber"><i></i>' + th('m01.q_progress', { x: { html: ltr(q.day + '/' + q.of) } }) + '</span>'; sub = q.cause ? dt(q.cause) : th('m01.q_risk', { n: q.risk + '%' }); text = dt(q.title); }
    else { pill = '<span class="pill teal"><i></i>' + esc(t('m01.q_suggested')) + '</span>'; sub = th('m01.q_promoted', { tier: tierName(q.tier || 'gold') }); text = t('m01.q_nominate'); }
    return '<div class="qrow"><span class="q-av' + (q.kind === 'decision' ? ' red' : '') + '" dir="ltr">' + esc(q.initials) + '</span><div class="q-who"><b><bdi>' + esc(q.name) + '</bdi></b><small>' + sub + '</small></div>' +
      '<p><bdi>' + esc(text) + '</bdi></p>' + pill + '<a class="open" href="#" data-soon="1">' + esc(t('m01.open')) + ' ' + ARW + '</a></div>';
  }).join('');
  return '<section class="card queue"><div class="card-head"><div class="copy"><h2>' + ICONS.pulse + ' ' + esc(t('m01.week')) + '</h2><p class="sub">' + esc(t('m01.week_sub')) + '</p></div>' +
    '<button class="btn primary" type="button" data-soon="1"><span class="bolt">' + micon('bolt') + '</span>' + esc(t('m01.open_int')) + ' ' + ARW + '</button></div>' + (rows || '<p class="empty">' + esc(t('m01.queue_none')) + '</p>') + '</section>';
}
