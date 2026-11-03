// =====================================================================
// e08-recognition.js — E08 Recognition, "Wall of Impact" (pages/employee/recognition.html)
// The data comes from server/api/employee/recognition.php.
// No leaderboards: the wall is stories, nothing is ranked. Tiers never appear on the public wall.
// =====================================================================

document.addEventListener('DOMContentLoaded', function () {
  startEmployeePage({ active: 'recognition', api: 'employee/recognition.php', crumb: 'e08.crumb', render: render });
});

// The six award categories: key in the language file, icon and colour class.
const CATEGORIES = [
  { name: 'Performance Star',    cls: 'perf',  icon: 'spark' },
  { name: 'Innovation Champion', cls: 'innov', icon: 'spark' },
  { name: 'Collaboration Hero',  cls: 'collab', icon: 'spark' },
  { name: 'Digital Pioneer',     cls: 'digital', icon: 'spark' },
  { name: 'Team Supporter',      cls: 'team',  icon: 'heart' },
  { name: 'Growth Champion',     cls: 'growth', icon: 'up' }
];
const ICON8 = {
  heart: '<svg viewBox="0 0 24 24" fill="#d92d20"><path d="M12 20.5s-8-4.9-8-11A4.5 4.5 0 0 1 12 6.6 4.5 4.5 0 0 1 20 9.5c0 6.1-8 11-8 11Z"/></svg>',
  up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M6 11l6-6 6 6"/></svg>',
  thread: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h4l2-5 4 10 2-5h6"/></svg>'
};

let state = null;           // the last data from the server
let chosen = { receiver: null, category: 'Team Supporter' };

function catOf(name) {
  return CATEGORIES.filter(function (c) { return c.name === name; })[0] || CATEGORIES[0];
}
function iconOf(cat) {
  return cat.icon === 'spark' ? ICONS.spark : ICON8[cat.icon];
}

function render(d) {
  state = d;
  if (!chosen.receiver && d.suggestions.length) { chosen.receiver = d.suggestions[0].id; }
  if (!chosen.receiver && d.people.length) { chosen.receiver = d.people[0].id; }
  document.querySelector('main').innerHTML =
    '<header class="page-header"><div class="copy"><h1>' + esc(t('e08.title')) + '</h1><p>' + esc(t('e08.subtitle')) + '</p></div>' +
      '<div class="actions">' +
        '<button class="btn" type="button" data-soon="1">' + ICONS.calendar + '<span>' + esc(t('e08.period')) + '</span>' + ICONS.chevron + '</button>' +
        '<button class="btn primary" type="button" id="go-recognize">' + ICONS.spark + '<span>' + esc(t('e08.recognize_button')) + '</span><i class="flip">' + ICONS.arrow + '</i></button>' +
      '</div></header>' +
    '<div class="dashboard">' +
      '<div class="cat-row">' + d.counts.map(catCardHTML).join('') + '</div>' +
      '<div class="notice">' + ICONS.ban + '<p>' + th('e08.notice', { bold: { html: '<b>' + esc(t('e08.notice_bold')) + '</b>' } }) + '</p></div>' +
      '<div class="wall-layout"><div class="wall" id="wall">' + d.wall.map(wallCardHTML).join('') + '</div>' +
        '<aside class="wall-side">' + identityHTML(d) + formHTML(d) + peopleHTML(d) + '</aside></div>' +
    '</div>';
  wire();
}

function catCardHTML(c) {
  const cat = catOf(c.category);
  return '<div class="cat-card"><span class="cat-icon ' + cat.cls + '">' + iconOf(cat) + '</span><b>' + esc(t('recog.' + c.category)) + '</b>' +
         '<small>' + th('e08.this_quarter', { n: c.count }) + '</small></div>';
}

function impactText(text) {
  return String(text).replace(/ -> /g, ' → ');
}

function wallCardHTML(w) {
  const cat = catOf(w.category);
  const impact = w.impact ? '<div class="thread">' + ICON8.thread + '<span><b>' + esc(t('e08.thread')) + '</b> ' + esc(dt(impactText(w.impact))) + '</span></div>' : '';
  const from = w.from ? '<p class="from">— ' + esc(dt(w.from)) + '</p>' : '';
  return '<article class="wall-card" data-id="' + w.id + '">' +
    '<div class="wc-head"><span class="cat-icon ' + cat.cls + '">' + iconOf(cat) + '</span>' +
      '<div class="wc-name"><span class="mono ' + cat.cls + '-text">' + esc(t('recog.' + w.category)) + '</span><h3><bdi>' + esc(w.receiver) + '</bdi></h3></div>' +
      '<span class="avatar ' + (w.mine ? 'mine' : 'c' + (w.id % 5)) + '" dir="ltr">' + esc(w.initials) + '</span></div>' +
    '<p class="story">“' + esc(dt(w.story)) + '”</p>' + from + impact +
    '<div class="wc-foot"><span class="voices">' + voicesText(w.voices) + '</span>' + voiceButton(w) + '</div></article>';
}
function voicesText(n) { return th('e08.voices', { n: n }); }
function voiceButton(w) {
  return w.voiced
    ? '<span class="voiced">' + esc(t('e08.voice_added')) + '</span>'
    : '<button type="button" class="voice-btn" data-voice="' + w.id + '">+ ' + esc(t('e08.add_voice')) + '</button>';
}

function identityHTML(d) {
  const s = d.identity.score;
  const badges = d.identity.badges.map(function (b) {
    const cat = catOf(b);
    return '<span class="id-badge ' + cat.cls + '">' + esc(t('recog.' + b)) + '</span>';
  }).join('');
  const change = s.change === null ? '' : '<small class="mono" dir="ltr">' + (s.change > 0 ? '↑ +' + s.change : (s.change < 0 ? '↓ −' + Math.abs(s.change) : '→ 0')) + '</small>';
  return '<section class="card identity-card">' + sideHead(t('e08.identity')) +
    '<div class="id-row"><span class="id-score" dir="ltr">' + s.rounded + '</span><div><span class="mono">' + esc(tierName(s.tier)) + '</span>' +
      '<b>' + esc(t('tier.summary.' + s.tier)) + '</b>' + change + '</div></div>' +
    '<div class="id-badges">' + badges + '</div><p class="hint">' + esc(t('e08.identity_note')) + '</p></section>';
}

function sideHead(title) {
  return '<h2 class="side-head"><i>' + ICON8.thread + '</i>' + esc(title) + '</h2>';
}

function formHTML(d) {
  const options = d.people.map(function (p) {
    return '<option value="' + p.id + '"' + (p.id === chosen.receiver ? ' selected' : '') + '>' + esc(p.name) + '</option>';
  }).join('');
  const chips = CATEGORIES.map(function (c) {
    return '<button type="button" class="chip' + (c.name === chosen.category ? ' on' : '') + '" data-cat="' + esc(c.name) + '"><span class="ci ' + c.cls + '">' +
      iconOf(c) + '</span>' + esc(t('recog.' + c.name)) + '</button>';
  }).join('');
  const outcome = d.outcome ? '<label class="link-row"><input type="checkbox" id="link-outcome" checked><span>' + th('e08.link_outcome', { outcome: dt(d.outcome) }) + '</span></label>' : '';
  return '<section class="card form-card" id="form-card">' + sideHead(t('e08.form_title')) +
    '<p class="hint">' + esc(t('e08.who')) + '</p>' +
    '<div class="select"><span class="avatar c1" id="sel-avatar" dir="ltr"></span><select id="receiver" aria-label="' + esc(t('e08.who')) + '">' + options + '</select></div>' +
    '<p class="hint">' + esc(t('e08.kind')) + '</p><div class="chips">' + chips + '</div>' +
    '<p class="hint">' + esc(t('e08.story_label')) + '</p>' +
    '<textarea id="story" rows="3" maxlength="300" placeholder="' + esc(t('e08.story_example')) + '"></textarea>' + outcome +
    '<p class="form-error" id="form-error" hidden></p>' +
    '<button type="button" class="btn primary wide" id="send">' + ICONS.spark + '<span>' + esc(t('e08.send')) + '</span><i class="flip">' + ICONS.arrow + '</i></button></section>';
}

function peopleHTML(d) {
  const rows = d.suggestions.map(function (s) {
    const sub = s.idea ? th('e08.shared_idea', { idea: dt(s.idea) }) : '';
    const since = s.days !== null ? ' · ' + th('e08.days_since', { n: s.days }) : '';
    return '<div class="person"><span class="avatar c2" dir="ltr">' + esc(s.initials) + '</span><div><b><bdi>' + esc(s.name) + '</bdi></b><small>' + sub + since + '</small></div>' +
           '<button type="button" class="thank" data-thank="' + s.id + '">' + esc(t('e08.thank')) + ' <i class="flip">' + ICONS.arrow + '</i></button></div>';
  }).join('');
  return '<section class="card people-card">' + sideHead(t('e08.people_title')) + (rows || '<p class="empty">' + esc(t('e08.no_people')) + '</p>') +
    '<p class="hint">' + esc(t('e08.people_note')) + '</p></section>';
}

function setAvatar() {
  const select = document.getElementById('receiver');
  const person = state.people.filter(function (p) { return String(p.id) === select.value; })[0];
  document.getElementById('sel-avatar').textContent = person ? person.initials : '';
}

function wire() {
  setAvatar();
  document.getElementById('go-recognize').addEventListener('click', function () {
    document.getElementById('form-card').scrollIntoView({ behavior: 'smooth', block: 'center' });
    document.getElementById('story').focus();
  });
  document.getElementById('receiver').addEventListener('change', function (e) { chosen.receiver = Number(e.target.value); setAvatar(); });
  document.querySelectorAll('.chip').forEach(function (b) {
    b.addEventListener('click', function () {
      chosen.category = b.dataset.cat;
      document.querySelectorAll('.chip').forEach(function (x) { x.classList.toggle('on', x === b); });
    });
  });
  document.querySelectorAll('[data-thank]').forEach(function (b) {
    b.addEventListener('click', function () {
      chosen.receiver = Number(b.dataset.thank);
      const select = document.getElementById('receiver');
      select.value = String(chosen.receiver); setAvatar();
      document.getElementById('form-card').scrollIntoView({ behavior: 'smooth', block: 'center' });
      document.getElementById('story').focus();
    });
  });
  document.querySelectorAll('[data-voice]').forEach(function (b) { b.addEventListener('click', function () { addVoice(Number(b.dataset.voice)); }); });
  document.getElementById('send').addEventListener('click', send);
}

async function addVoice(id) {
  const r = await api('employee/recognition.php', { action: 'voice', id: id });
  if (r.status !== 200 || !r.data.ok) { showToast(t('e08.error')); return; }
  const card = document.querySelector('.wall-card[data-id="' + id + '"]');
  card.querySelector('.voices').innerHTML = voicesText(r.data.voices);
  card.querySelector('.wc-foot').lastElementChild.outerHTML = '<span class="voiced">' + esc(t('e08.voice_added')) + '</span>';
}

async function send() {
  const story = document.getElementById('story').value.trim();
  const error = document.getElementById('form-error');
  if (story.length < 10) { error.textContent = t('e08.too_short'); error.hidden = false; return; }
  error.hidden = true;
  const link = document.getElementById('link-outcome');
  const body = { action: 'send', receiver_id: chosen.receiver, category: chosen.category, message: story,
                 outcome: link && link.checked && state.outcome ? state.outcome : '' };
  const r = await api('employee/recognition.php', body);
  if (r.status !== 200 || !r.data.ok) { error.textContent = t('e08.error'); error.hidden = false; return; }
  showToast(tf('e08.sent', { name: r.data.receiver }));
  const again = await api('employee/recognition.php');
  if (again.status === 200) { chosen.receiver = null; render(again.data); }
}
