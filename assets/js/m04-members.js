// =====================================================================
// m04-members.js — M04 Team Members (pages/manager/members.html)
// Data: server/api/manager/members.php — direct reports, sorted by who needs support first (never by score).
// =====================================================================

let FILTER = 'all', QUERY = '', D = null;
const STATUS_PILL = { at_risk: 'coral', needs_attention: 'amber', improving: 'teal', healthy: 'blue' };

document.addEventListener('DOMContentLoaded', function () {
  startManagerPage({ active: 'members', api: 'manager/members.php', crumb: 'm04.crumb', render: render });
});

function trendArrow(tr) {
  const m = { up: ['↗', 'up'], down: ['↘', 'down'], flat: ['→', 'flat'] }[tr] || ['→', 'flat'];
  return '<i class="tr ' + m[1] + '" aria-hidden="true">' + m[0] + '</i>';
}

function render(d) {
  D = d;
  const c = d.counts, total = d.people.length;
  const chips = [['all', total]].concat(['at_risk', 'needs_attention', 'improving', 'healthy'].map(function (k) { return [k, c[k]]; })).map(function (p) {
    return '<button type="button" class="chip' + (p[0] === FILTER ? ' on' : '') + '" data-f="' + p[0] + '">' + esc(t('m04.f_' + p[0])) + ' <b dir="ltr">' + p[1] + '</b></button>';
  }).join('');
  document.querySelector('main').innerHTML =
    '<header class="page-header"><div class="copy"><h1>' + esc(t('m04.title')) + '</h1><p>' + esc(t('m04.subtitle')) + '</p></div>' +
      '<div class="actions"><a class="btn primary" href="recognition.html"><span class="bolt">' + ICONS.diamond + '</span>' + esc(t('m04.recognize_someone')) + ' ' + ARW + '</a></div></header>' +
    '<div class="dashboard"><div class="chips-row"><div class="chips">' + chips + '</div><label class="search">' + ICONS.spark + '<input id="q" type="search" placeholder="' + esc(t('m04.search')) + '" value="' + esc(QUERY) + '"></label></div>' +
    '<div class="sorted">' + ICONS.check + '<p><b>' + esc(t('m04.sorted_b')) + '</b> ' + esc(tf('m04.sorted', { n: total })) + '</p></div>' +
    '<div class="cards" id="cards"></div></div>';
  document.querySelectorAll('.chip').forEach(function (b) { b.addEventListener('click', function () { FILTER = b.getAttribute('data-f'); render(D); }); });
  const q = document.getElementById('q');
  q.addEventListener('input', function () { QUERY = q.value.trim().toLowerCase(); drawCards(); });
  drawCards();
}

function drawCards() {
  const list = D.people.filter(function (p) { return (FILTER === 'all' || p.status === FILTER) && (!QUERY || p.name.toLowerCase().indexOf(QUERY) >= 0); });
  document.getElementById('cards').innerHTML = list.length ? list.map(card).join('') : '<p class="empty">' + esc(t('m04.none')) + '</p>';
}

function recText(p) {
  if (p.recommended) { return esc(dt(p.recommended)); }
  const k = { at_risk: 'm04.rec_at_risk', needs_attention: 'm04.rec_attention', improving: 'm04.rec_improving', healthy: 'm04.rec_healthy' }[p.status];
  return esc(t(k));
}

function card(p) {
  const tag = (p.score_delta && p.score_delta > 0 ? '<sup class="up" dir="ltr">+' + p.score_delta + '</sup>' : '') + (p.promoted ? '<sup class="star">★</sup>' : '') + (p.alert ? '<i class="adot"></i>' : '');
  const href = 'member.html?id=' + p.id;
  return '<article class="mcard st-' + p.status + '"><div class="mh"><span class="av">' + esc(p.initials) + '</span><div class="mn"><b><bdi>' + esc(p.name) + '</bdi></b><small>' + esc(dt(p.job_title)) + '</small></div>' +
      '<span class="pill ' + STATUS_PILL[p.status] + '"><i class="pdot2"></i>' + esc(t('m01.st.' + p.status)) + '</span></div>' +
    '<span class="tchip tc-' + p.tier + '"><i></i>' + esc(tierName(p.tier)) + ' <b dir="ltr">' + p.score + '</b>' + tag + '</span>' +
    '<div class="mstats"><div><span class="mono">' + esc(t('m04.performance')) + '</span><b dir="ltr">' + p.performance + '</b>' + trendArrow(p.performance_trend) + '</div>' +
      '<div><span class="mono">' + esc(t('m04.engagement')) + '</span><b dir="ltr">' + p.engagement + '</b>' + trendArrow(p.engagement_trend) + '</div>' +
      '<div class="burn b-' + p.status + '"><span class="mono">' + esc(t('m04.burnout')) + '</span><b dir="ltr">' + p.risk + '%</b></div></div>' +
    '<div class="rec"><b>' + esc(t('m04.recommended')) + '</b> ' + recText(p) + '</div>' +
    '<div class="links"><a class="lk main" href="' + href + '">' + esc(t('m04.profile')) + ' ' + ARW + '</a>' +
      '<a class="lk" href="#" data-soon="1">' + micon('bolt') + esc(t('m04.intervene')) + '</a><a class="lk" href="recognition.html?id=' + p.id + '">' + ICONS.diamond + esc(t('m04.recognize')) + '</a><a class="lk" href="#" data-soon="1">' + ICONS.arrowUp + esc(t('m04.develop')) + '</a></div></article>';
}
