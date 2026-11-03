// =====================================================================
// m08-recognition.js — M08 Recognition (pages/manager/recognition.html?id=)
// Data: server/api/manager/recognition.php — GET the coverage, POST send / save a draft (own direct reports only).
// Coverage is sorted by the longest gap, never by merit. Recognition never changes an EMPULSE Score directly.
// =====================================================================

let D = null;
const FORM = { id: null, category: 'Performance Star', message: '', link: false };
const WANT = Number(new URLSearchParams(location.search).get('id')) || 0;

document.addEventListener('DOMContentLoaded', function () {
  startManagerPage({ active: 'recognition', api: 'manager/recognition.php', crumb: 'm08.crumb', render: render });
});

function person(id) { return D.coverage.filter(function (c) { return c.id === id; })[0]; }

function choose(id) {
  FORM.id = id;
  const s = D.suggest[id];
  if (D.draft && D.draft.receiver_id === id) { FORM.category = D.draft.category; FORM.message = D.draft.message; FORM.link = D.draft.link_outcome; }
  else if (s) { FORM.category = s.category; FORM.message = s.message; FORM.link = !!s.outcome; }
  else { FORM.category = 'Performance Star'; FORM.message = ''; FORM.link = false; }
}

function render(d) {
  D = d;
  const start = WANT && person(WANT) ? WANT : (d.draft && person(d.draft.receiver_id) ? d.draft.receiver_id : d.coverage[0].id);
  if (FORM.id === null || !person(FORM.id)) { choose(start); }
  document.querySelector('main').innerHTML =
    '<header class="page-header"><div class="copy"><h1>' + esc(t('m08.title')) + '</h1><p>' + esc(t('m08.subtitle')) + '</p></div><div class="actions">' + soonBtn('', ICONS.spark + esc(t('m08.who'))) + '</div></header>' +
    '<div class="dashboard"><div class="row m08-top"><section class="card form" id="form"></section><section class="card prev" id="prev"></section></div>' +
    '<div class="row m08-bottom"><section class="card cov">' + coverageHTML() + '</section><section class="card recent">' + recentHTML() + '</section></div></div>';
  drawForm(); drawPreview();
  document.querySelectorAll('[data-rec]').forEach(function (a) { a.addEventListener('click', function (e) { e.preventDefault(); choose(Number(a.getAttribute('data-rec'))); drawForm(); drawPreview(); window.scrollTo({ top: 0, behavior: 'smooth' }); }); });
}

function lastText(p) { return p.days === null ? t('m08.never') : tf('m08.last', { n: p.days }); }

function drawForm() {
  const p = person(FORM.id), s = D.suggest[FORM.id];
  const opts = D.coverage.map(function (c) { return '<option value="' + c.id + '"' + (c.id === FORM.id ? ' selected' : '') + '>' + esc(c.name) + '</option>'; }).join('');
  const cats = D.categories.map(function (c) { return '<button type="button" class="cat' + (c === FORM.category ? ' on' : '') + '" data-cat="' + esc(c) + '">' + micon('award') + esc(dt(c)) + '</button>'; }).join('');
  document.getElementById('form').innerHTML =
    '<h2>' + ICONS.pulse + ' ' + esc(t('m08.form')) + '</h2>' +
    '<label class="who"><span class="av">' + esc(p.initials) + '</span><select id="who">' + opts + '</select><small>' + esc(lastText(p)) + '</small></label>' +
    '<div class="cats">' + cats + '</div>' +
    '<textarea id="msg" maxlength="300" placeholder="' + esc(t('m08.placeholder')) + '">' + esc(FORM.message) + '</textarea>' +
    (s && s.outcome_long ? '<label class="lk"><input type="checkbox" id="lnk"' + (FORM.link ? ' checked' : '') + '><span>' + esc(tf('m08.link', { outcome: dt(s.outcome_long) })) + '</span></label>' : '') +
    '<div class="btns"><button type="button" class="btn primary" id="send"><span class="bolt">' + micon('award') + '</span><span id="send-t"></span> ' + ARW + '</button><button type="button" class="btn" id="draft">' + esc(t('m08.draft')) + '</button></div><p class="msgerr" id="err" hidden></p>';
  document.getElementById('who').addEventListener('change', function (e) { choose(Number(e.target.value)); drawForm(); drawPreview(); });
  document.querySelectorAll('.cat').forEach(function (b) { b.addEventListener('click', function () { FORM.category = b.getAttribute('data-cat'); document.querySelectorAll('.cat').forEach(function (x) { x.classList.toggle('on', x === b); }); drawPreview(); }); });
  document.getElementById('msg').addEventListener('input', function (e) { FORM.message = e.target.value; drawPreview(); });
  const l = document.getElementById('lnk'); if (l) { l.addEventListener('change', function () { FORM.link = l.checked; drawPreview(); }); }
  document.getElementById('send').addEventListener('click', send);
  document.getElementById('draft').addEventListener('click', saveDraft);
  sendLabel();
}

function sendLabel() {
  const p = person(FORM.id);
  document.getElementById('send-t').textContent = tf('m08.send', { first: p.first_name, cat: dt(FORM.category) });
  document.getElementById('send').disabled = FORM.message.trim().length < 10;
}

function drawPreview() {
  const p = person(FORM.id), s = D.suggest[FORM.id];
  const outcome = FORM.link && s && s.outcome ? '<div class="thread">' + ICONS.check + '<b>' + esc(t('m08.thread')) + '</b> ' + esc(dt(s.outcome)) + '</div>' : '';
  document.getElementById('prev').innerHTML =
    '<h2>' + ICONS.pulse + ' ' + esc(tf('m08.how', { first: p.first_name })) + '</h2><p class="sub">' + esc(t('m08.how_sub')) + '</p>' +
    '<div class="pcard"><div class="ph"><span class="hex">' + micon('award') + '</span><div><span class="mono">' + esc(dt(FORM.category).toUpperCase()) + '</span><b><bdi>' + esc(p.name) + '</bdi></b></div></div>' +
    '<p class="q">' + (FORM.message.trim() ? '“' + esc(FORM.message.trim()) + '”' : '<em>' + esc(t('m08.empty_msg')) + '</em>') + '</p><small>— ' + esc(D.who.name) + '</small>' + outcome + '</div>' +
    '<p class="note">' + esc(t('m08.note')) + '</p>';
  sendLabel();
}

async function post(action) {
  const r = await api('manager/recognition.php', { action: action, receiver_id: FORM.id, category: FORM.category, message: FORM.message.trim(), link_outcome: FORM.link });
  const err = document.getElementById('err');
  if (r.status !== 200 || !r.data || !r.data.ok) { err.hidden = false; err.textContent = t('m08.err'); return null; }
  err.hidden = true;
  return r.data;
}

async function send() {
  const p = person(FORM.id);
  const r = await post('send');
  if (!r) { return; }
  showToast(tf('m08.sent', { name: p.name }));
  FORM.message = ''; FORM.id = null;
  const again = await api('manager/recognition.php');
  if (again.status === 200 && again.data && !again.data.error) { D = again.data; D.draft = null; render(D); }
}

async function saveDraft() {
  const r = await post('draft');
  if (r) { D.draft = { receiver_id: FORM.id, category: FORM.category, message: FORM.message.trim(), link_outcome: FORM.link }; showToast(t('m08.draft_saved')); }
}

function coverageHTML() {
  const rows = D.coverage.map(function (c) {
    const d = c.days, hot = d !== null && d >= 60;
    return '<div class="cr"><span class="av">' + esc(c.initials) + '</span><span class="nm"><bdi>' + esc(c.name) + '</bdi></span><span class="bar"><i class="' + (hot ? 'hot' : '') + '" style="width:' + Math.min(100, (d === null ? 100 : d) / 90 * 100) + '%"></i></span><b class="days' + (hot ? ' hot' : '') + '" dir="ltr">' + (d === null ? '—' : d + ' ' + esc(t('m08.days'))) + '</b>' +
      (d === null || d >= 30 ? '<a class="rl" href="#" data-rec="' + c.id + '">' + esc(t('m08.recognize')) + ' ' + ARW + '</a>' : '<span class="rl"></span>') + '</div>';
  }).join('');
  return '<h2>' + ICONS.pulse + ' ' + esc(t('m08.coverage')) + '</h2><p class="sub">' + esc(t('m08.coverage_sub')) + '</p>' + rows;
}

function recentHTML() {
  const rows = D.recent.map(function (r) {
    return '<div class="rr"><span class="hex">' + micon('award') + '</span><div><b><bdi>' + esc(r.receiver) + '</bdi> · <em>' + esc(dt(r.category)) + '</em></b><span>' + esc(dt(r.what)) + '</span><small><bdi>' + esc(r.from || '') + '</bdi> · ' + esc(fmtDate(r.date)) + '</small></div></div>';
  }).join('');
  return '<h2>' + ICONS.pulse + ' ' + esc(t('m08.recent')) + '</h2><p class="sub">' + esc(D.gap_pct !== null ? tf('m08.recent_sub', { n: D.month, pct: D.gap_pct }) : tf('m08.recent_sub2', { n: D.month })) + '</p>' + rows;
}
