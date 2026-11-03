// =====================================================================
// e10-reports.js — E10 My Reports (pages/employee/reports.html)
// Data: server/api/employee/reports.php (my own data only). Download PDF = print of the report card.
// =====================================================================

document.addEventListener('DOMContentLoaded', function () {
  startEmployeePage({ active: 'reports', api: 'employee/reports.php', crumb: 'e10.crumb', render: render });
});

let D = null;
let current = 'quarterly';

function R(o) {
  if (o === null || o === undefined) { return ''; }
  const params = {};
  Object.keys(o.p || {}).forEach(function (name) {
    const v = o.p[name];
    if (v !== null && typeof v === 'object' && 'k' in v) { params[name] = { html: R(v) }; }
    else if ((name === 'tier' || name === 'to') && typeof v === 'string' && /^[a-z]+$/.test(v)) { params[name] = { html: esc(tierName(v)) }; }
    else if (name === 'title' || name === 'module') { params[name] = { html: '<bdi>' + esc(dt(v)) + '</bdi>' }; }
    else { params[name] = v; }
  });
  return th(o.k, params);
}

const LIST_ICONS = { quarterly: 'person', score_history: 'up', recognition: 'ring', ideas: 'ring', learning: 'doc' };

function render(d) {
  D = d;
  document.querySelector('main').innerHTML =
    '<header class="page-header"><div class="copy"><h1>' + esc(t('e10.title')) + '</h1><p>' + esc(t('e10.subtitle')) + '</p></div></header>' +
    '<div class="rep-layout"><nav class="rep-list"><h3 class="mono cap">' + esc(t('e10.list')) + '</h3><div id="list"></div></nav>' +
    '<section class="card paper" id="paper"></section>' +
    '<aside class="rep-side"><section class="card"><h2>' + ICONS.up + ' ' + esc(t('e10.export')) + '</h2>' +
      '<button class="btn primary wide" id="pdf" type="button"><span class="dl">' + ICONS.download + '</span>' + esc(t('e10.pdf')) + ' ' + ICONS.arrow + '</button>' +
      (d.manager ? '<button class="btn wide" id="share" type="button">' + ICONS.person + esc(t('e10.share')) + '</button>' : '') +
      '<p class="shared" id="shared"></p></section>' +
      '<section class="card"><h2>' + ICONS.up + ' ' + esc(t('e10.not')) + '</h2><p class="muted">' + esc(t('e10.not_text')) + '</p></section></aside></div>';
  drawList(); drawPaper(); drawShared();
  document.getElementById('list').addEventListener('click', function (e) {
    const b = e.target.closest('[data-r]');
    if (b) { current = b.getAttribute('data-r'); drawList(); drawPaper(); }
  });
  document.getElementById('pdf').addEventListener('click', function () { window.print(); });
  const share = document.getElementById('share');
  if (share) {
    share.addEventListener('click', async function () {
      const r = await api('employee/reports.php', { action: 'share', report: current });
      if (r.status === 200 && r.data && r.data.ok) {
        D.shared.unshift({ report_key: current, shared_with: r.data.shared_with, shared_at: D.dates.as_of });
        drawShared();
        showToast(tf('e10.shared_toast', { name: r.data.shared_with }));
      } else { showToast(t('shell.error_load')); }
    });
  }
}

function drawList() {
  document.getElementById('list').innerHTML = D.reports.map(function (k) {
    return '<button type="button" class="rep-item' + (k === current ? ' on' : '') + '" data-r="' + k + '"><span>' + ICONS[LIST_ICONS[k]] + '</span>' + esc(t('e10.r.' + k)) + '</button>';
  }).join('');
}

function drawShared() {
  const mine = D.shared.filter(function (s) { return s.report_key === current; })[0];
  document.getElementById('shared').textContent = mine ? tf('e10.shared_line', { name: mine.shared_with, date: fmtDate(mine.shared_at) }) : '';
}

function head(titleKey) {
  return '<div class="paper-top"><span class="brand"><span class="brand-mark">' + ICONS.logo + '</span><span class="brand-name" dir="ltr">EMPULSE</span></span>' +
    '<span class="mono muted" dir="ltr">' + esc(t('e10.private')) + ' · Q3 2026</span></div>' +
    '<span class="mono kicker"><bdi>' + esc(D.who.name.toUpperCase()) + '</bdi> · ' + esc(t(titleKey)) + '</span>';
}

function drawPaper() {
  drawShared();
  const el = document.getElementById('paper');
  if (current === 'quarterly') { el.innerHTML = quarterly(); return; }
  let body = '';
  if (current === 'score_history') {
    body = '<h2 class="rtitle">' + esc(t('e10.r.score_history')) + '</h2><table class="rt"><thead><tr><th>' + esc(t('e10.col_month')) + '</th><th>' + esc(t('e10.col_score')) + '</th><th>' + esc(t('e10.col_tier')) + '</th></tr></thead><tbody>' +
      D.history.map(function (h) { return '<tr><td>' + esc(monthName(h.month)) + '</td><td dir="ltr">' + h.score + '</td><td>' + esc(tierName(h.tier.toLowerCase())) + '</td></tr>'; }).join('') + '</tbody></table>';
  } else if (current === 'recognition') {
    body = '<h2 class="rtitle">' + esc(t('e10.r.recognition')) + '</h2>' + (D.recognition.length ? D.recognition.map(function (r) {
      return '<div class="rl"><b>' + esc(dt(r.category)) + '</b><span class="muted">' + (r.from ? '<bdi>' + esc(r.from) + '</bdi> · ' : '') + esc(fmtDate(r.date)) + '</span><p>' + esc(r.message) + '</p></div>';
    }).join('') : '<p class="muted">' + esc(t('e10.empty')) + '</p>');
  } else if (current === 'ideas') {
    body = '<h2 class="rtitle">' + esc(t('e10.r.ideas')) + '</h2>' + (D.ideas.length ? D.ideas.map(function (i) {
      return '<div class="rl"><b><bdi>' + esc(dt(i.title)) + '</bdi></b><span class="muted"><bdi dir="ltr">' + esc(i.code) + '</bdi> · ' + esc(t('e10.status.' + i.status)) + (i.savings ? ' · ' + esc(fmtSar(i.savings)) : '') + '</span></div>';
    }).join('') : '<p class="muted">' + esc(t('e10.empty')) + '</p>');
  } else {
    const L = D.learning;
    body = '<h2 class="rtitle">' + esc(t('e10.r.learning')) + '</h2>' +
      (L.hours !== null ? '<p class="rl"><b>' + th('e07.hours', { n: L.hours }) + '</b> <span class="muted">' + esc(t('e10.this_quarter')) + '</span></p>' : '') +
      (L.module ? '<p class="rl"><b><bdi>' + esc(dt(L.module.title)) + '</bdi></b> <span class="muted" dir="ltr">' + L.module.progress + '%</span></p>' : '') +
      L.skills.map(function (s) { return '<div class="rl sk"><span><bdi>' + esc(dt(s.skill)) + '</bdi></span><span class="bar"><i style="width:' + Math.min(100, s.value / Math.max(1, s.target) * 100) + '%"></i></span><b dir="ltr">' + s.value + ' / ' + s.target + '</b></div>'; }).join('');
  }
  el.innerHTML = head('e10.r.' + current) + body + '<p class="paper-foot">' + esc(t('e10.foot')) + '</p>';
}

function quarterly() {
  const q = D.quarterly, s = q.score;
  const labels = ['sections'];
  const rows = q.sections.map(function (r) {
    return '<div class="sec"><b>' + esc(t('e10.sec.' + r.key)) + '</b><p>' + R(r.text) + '</p></div>';
  }).join('');
  const change = s.from === null ? '' : s.value - s.from;
  return head('e10.kicker') + '<h2 class="headline">' + R(q.headline) + '</h2>' +
    '<div class="score-row"><div class="score-box"><span class="circle" dir="ltr">' + s.value + '</span><div><span class="mono muted">' + esc(tierName(s.tier)) + '</span><b>' + esc(t('tier.summary.' + s.tier)) + '</b>' +
      (change !== '' ? '<span class="up" dir="ltr">' + (change >= 0 ? '↑ +' : '↓ −') + Math.abs(change) + '</span>' : '') + '</div></div>' +
    '<div class="score-band">' + tierBandHTML(s.value, s.tier) + '</div></div>' +
    '<div class="secs">' + rows + '</div><p class="paper-foot">' + esc(t('e10.foot')) + '</p>';
}
