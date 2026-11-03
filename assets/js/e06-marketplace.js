// =====================================================================
// e06-marketplace.js — E06 Innovation Marketplace (pages/employee/marketplace.html)
// The data comes from server/api/employee/marketplace.php. PulseAI's matches are a RULE
// (job title, innovation DNA, skills, capacity); people with burnout risk above 50% are never matched.
// =====================================================================

document.addEventListener('DOMContentLoaded', function () {
  startEmployeePage({ active: 'marketplace', api: 'employee/marketplace.php', crumb: 'e06.crumb', render: render });
});

let data = null;
let filter = 'all';

function render(d) {
  data = d;
  document.querySelector('main').innerHTML =
    '<header class="page-header"><div class="copy"><h1>' + esc(t('e06.title')) + '</h1><p>' + esc(t('e06.subtitle')) + '</p></div>' +
      '<div class="actions">' +
        '<button class="btn" type="button" data-soon="1">' + ICONS.user + '<span>' + esc(t('e06.missing_skills')) + '</span></button>' +
        '<a class="btn primary" href="innovation-lab.html">' + ICONS.spark + '<span>' + esc(t('e06.submit_idea')) + '</span></a>' +
      '</div></header>' +
    '<div class="dashboard">' + statsHTML(d.stats) +
      '<div class="row row-feature">' + featuredHTML(d) + recommendHTML(d) + '</div>' +
      '<section class="opps"><div class="opps-head"><div><h2>' + esc(t('e06.opps_title')) + '</h2><p>' + esc(t('e06.opps_sub')) + '</p></div>' +
        '<div class="filters" id="filters"></div></div><div class="opp-grid" id="opp-grid"></div></section>' +
    '</div>';
  drawList();
  wire();
}

function statCard(label, value, sub, cls) {
  return '<div class="card stat"><span class="mono">' + esc(label) + '</span><b class="' + (cls || '') + '" dir="ltr">' + esc(value) + '</b><small>' + sub + '</small></div>';
}
function statsHTML(s) {
  return '<div class="stat-row">' +
    statCard(t('e06.s_submitted'), s.submitted, th('e06.s_quarter', { q: s.quarter, year: s.year })) +
    statCard(t('e06.s_approved'), s.approved, th('e06.s_rate', { n: s.approval_rate })) +
    statCard(t('e06.s_build'), s.in_build, th('e06.s_contrib', { n: s.contributors })) +
    statCard(t('e06.s_impl'), s.implemented, esc(t('e06.s_year'))) +
    statCard(t('e06.s_savings'), fmtSar(s.savings_sar), esc(t('e06.s_verified')), 'violet') + '</div>';
}

function initialsOfRole(d, role) {
  const m = d.recommend.filter(function (r) { return r.role === role; })[0];
  return m ? m.initials : '';
}

function featuredHTML(d) {
  const f = d.featured;
  if (!f) { return '<section class="card feature"><p class="empty">' + esc(t('e06.no_feature')) + '</p></section>'; }
  const start = f.starts ? '<span dir="ltr">' + th('e06.starts', { day: f.starts.day, month: t('month.' + monthIndex(f.starts.month)) }) + '</span>' : '';
  const team = f.team.map(function (m) { return '<span class="chip-t"><b dir="ltr">' + esc(m.initials) + '</b>' + esc(m.name) + '</span>'; }).join('') +
    f.roles.map(function (r) { return '<span class="chip-t"><b dir="ltr">' + esc(initialsOfRole(d, r)) + '</b>' + esc(dt(r)) + '</span>'; }).join('');
  return '<section class="card feature" id="feature">' +
    '<div class="feat-top"><span class="status-pill">' + esc(t('e06.recruiting_full')) + '</span><span class="mono dim">' + esc(dt(f.department)) + ' · ' + esc(f.code) + '</span></div>' +
    '<h2>' + esc(dt(f.title)) + '</h2>' + (f.text ? '<p class="feat-text">' + esc(dt(f.text)) + '</p>' : '') +
    '<div class="tiles">' +
      tile(t('e06.t_savings'), fmtSar(f.savings_sar), t('e06.per_year')) +
      tile(t('e06.t_cost'), fmtSar(f.cost_sar), f.roi ? tf('e06.roi', { n: f.roi.toFixed(1) }) : '') +
      tile(t('e06.t_timeline'), f.weeks ? tf('e06.weeks', { n: f.weeks }) : '—', start ? start.replace(/<[^>]+>/g, '') : '') + '</div>' +
    '<div class="team"><span class="dim">' + esc(t('e06.team')) + '</span>' + team + '</div></section>';
}
function tile(label, value, sub) {
  return '<div class="tile"><span>' + esc(label) + '</span><b dir="ltr">' + esc(value) + '</b><small class="mono" dir="auto">' + esc(sub) + '</small></div>';
}
function monthIndex(abbr) {
  return ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'].indexOf(abbr) + 1;
}

function recommendHTML(d) {
  const rows = d.recommend.map(function (r) {
    const detail = r.you && r.wants
      ? th('e06.detail_you', { trait: t('dna.' + r.trait), value: r.trait_value, want: t('dnal.' + r.wants) })
      : th('e06.detail_other', { trait: t('dna.' + r.trait), value: r.trait_value, n: r.capacity });
    return '<div class="match"><span class="avatar ' + (r.you ? 'mine' : 'c1') + '" dir="ltr">' + esc(r.initials) + '</span>' +
      '<div><b><bdi>' + esc(r.name) + '</bdi>' + (r.you ? ' · ' + esc(t('e06.you')) : '') + '</b>' +
      '<small>' + esc(dt(r.job_title)) + ' · ' + esc(dt(r.department)) + '</small><small>' + detail + '</small></div>' +
      '<div class="fit"><b dir="ltr">' + r.fit + '%</b><span class="mono">' + esc(t('e06.fit')) + '</span></div></div>';
  }).join('');
  const canJoin = d.featured && !data.recommend.every(function (r) { return !r.you; });
  return '<aside class="card recommend"><h2>' + esc(t('e06.rec_title')) + '</h2>' + (rows || '<p class="empty">' + esc(t('e06.no_match')) + '</p>') +
    '<div class="rec-actions"><button type="button" class="btn violet" id="join-feature"' + (d.featured ? '' : ' disabled') + '>' + esc(t('e06.join')) + '</button>' +
    '<button type="button" class="btn" data-soon="1">' + esc(t('e06.suggest')) + '</button></div>' +
    '<p class="foot">' + esc(t('e06.rec_note')) + '</p></aside>';
}

function filterCounts() {
  const c = data.counts;
  return [['all', c.all], ['recruiting', c.recruiting], ['in_build', c.in_build], ['implemented', c.implemented], ['matches', c.matches]];
}
function drawList() {
  document.getElementById('filters').innerHTML = filterCounts().map(function (f) {
    return '<button type="button" class="fchip' + (filter === f[0] ? ' on' : '') + '" data-filter="' + f[0] + '">' + esc(t('e06.f_' + f[0])) + ' <span dir="ltr">' + f[1] + '</span></button>';
  }).join('');
  const shown = data.list.filter(function (o) {
    if (filter === 'all') { return true; }
    if (filter === 'recruiting') { return o.kind === 'recruiting'; }
    if (filter === 'in_build') { return o.kind === 'in_build' || o.kind === 'pilot'; }
    if (filter === 'implemented') { return o.kind === 'implemented'; }
    return o.fits && !o.member;
  });
  document.getElementById('opp-grid').innerHTML = shown.map(oppHTML).join('') || '<p class="empty">' + esc(t('e06.none')) + '</p>';
}

function oppHTML(o) {
  const done = o.kind === 'implemented';
  const right = done ? t(o.verified ? 'e06.verified' : 'e06.pending') : (o.roles.length ? o.roles.map(dt).join(' · ') : t('e06.team_complete'));
  const money = done ? tf('e06.sar_realized', { amount: fmtSar(o.sar) }) : tf('e06.sar_year', { amount: fmtSar(o.sar) });
  const width = done ? 85 : Math.max(4, o.progress);
  let button;
  if (o.mine && o.open) { button = '<span class="joined">' + esc(t('e06.your_idea')) + '</span>'; }
  else if (o.member && o.open) { button = '<span class="joined">' + ICONS.check + esc(t('e06.joined')) + '</span>'; }
  else if (o.open) { button = '<button type="button" class="btn violet small" data-join="' + esc(o.code) + '">' + esc(t('e06.join')) + '</button>'; }
  else { button = '<button type="button" class="btn small" data-soon="1">' + esc(t('e06.see_impact')) + '</button>'; }
  return '<article class="opp"><div class="opp-top"><span class="tag ' + o.kind + '">' + esc(t('e06.k_' + o.kind)) + '</span><span class="mono dim">' + esc(dt(o.department)) + '</span></div>' +
    '<h3>' + esc(dt(o.title)) + '</h3><div class="bar ' + (done ? 'done' : '') + '"><i style="width:' + width + '%"></i></div>' +
    '<div class="opp-mid"><b dir="ltr">' + esc(money) + '</b><span>' + esc(right) + '</span></div>' + button + '</article>';
}

async function join(code) {
  const r = await api('employee/marketplace.php', { action: 'join', code: code });
  if (r.status !== 200 || !r.data.ok) { showToast(t('e06.error')); return; }
  showToast(t('e06.joined_toast'));
  const again = await api('employee/marketplace.php');
  if (again.status === 200) { render(again.data); }
}

function wire() {
  document.getElementById('filters').addEventListener('click', function (e) {
    const b = e.target.closest('[data-filter]');
    if (b) { filter = b.dataset.filter; drawList(); }
  });
  document.getElementById('opp-grid').addEventListener('click', function (e) {
    const b = e.target.closest('[data-join]');
    if (b) { join(b.dataset.join); }
  });
  const j = document.getElementById('join-feature');
  if (j && data.featured) { j.addEventListener('click', function () { join(data.featured.code); }); }
}
