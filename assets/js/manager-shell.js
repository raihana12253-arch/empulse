// =====================================================================
// manager-shell.js — used by the manager screens M01-M13 (after shared.js and employee-shell.js).
// The frame of a manager page (sidebar with the team card, top bar) and startManagerPage().
// It reuses the helpers of employee-shell.js (esc, th, ICONS, fmtDate ...).
// =====================================================================

// Sidebar of the manager. ready: false = built in a later phase (a short message is shown).
const MNAV = [
  { key: 'overview',    file: 'overview.html', ready: true,  icon: 'home',   text: 'Team Overview' },
  { key: 'performance', file: 'performance.html', ready: true, icon: 'trend',  text: 'Team Performance' },
  { key: 'pulse',       file: 'pulse.html', ready: true, icon: 'pulse',  text: 'Team Pulse' },
  { key: 'members',     file: 'members.html', ready: true, icon: 'people', text: 'Team Members' },
  { key: 'perfwell',    file: 'perfwell.html', ready: true, icon: 'grid',   text: 'Performance-Wellbeing' },
  { key: 'earlywarn',   file: 'earlywarn.html', ready: true, icon: 'alert',  text: 'Burnout Early Warning', badge: 'early_warning' },
  { key: 'morale',      file: 'morale.html', ready: true, icon: 'heart',  text: 'Team Morale' },
  { key: 'recognition', file: 'recognition.html', ready: true, icon: 'award',  text: 'Recognition' },
  { key: 'innovation',  ready: false, icon: 'bulb',   text: 'Innovation' },
  { key: 'interventions', ready: false, icon: 'bolt', text: 'Interventions', badge: 'interventions' },
  { key: 'reports',     ready: false, icon: 'doc',    text: 'Team Reports' },
  { key: 'pulseai',     ready: false, icon: 'spark',  text: 'PulseAI' },
];

const MICONS = {
  home: '<path d="M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4v-5H9v5H5a1 1 0 0 1-1-1v-7.5Z"/>',
  trend: '<path d="m4 16 5-5 4 3 7-8M15 6h5v5"/>',
  pulse: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  people: '<circle cx="9" cy="8" r="3.2"/><path d="M3 19c0-3.2 2.7-5.2 6-5.2s6 2 6 5.2"/><path d="M16 5.2a3 3 0 0 1 0 5.6M18 14.2c1.8.6 3 2 3 4.3"/>',
  grid: '<rect x="4" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5"/><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5"/><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5"/>',
  alert: '<path d="M12 4 3.5 19h17L12 4Z"/><path d="M12 10v4.5M12 17h.01"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10A4.2 4.2 0 0 1 12 7.6 4.2 4.2 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10Z"/>',
  award: '<circle cx="12" cy="9" r="4.5"/><path d="m9 13 -1.5 7L12 17.5 16.5 20 15 13"/>',
  bulb: '<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3Z"/>',
  bolt: '<path d="M13 3 5 13.5h6L10 21l8-10.5h-6L13 3Z"/>',
  doc: '<path d="M7 3.5h7l4 4V20H7V3.5Z"/><path d="M14 3.5V8h4M9.5 13h6M9.5 16.5h6"/>',
  spark: '<path d="M12 3c.5 4.6 2.4 8.4 8 9-5.6.6-7.5 4.4-8 9-.5-4.6-2.4-8.4-8-9 5.6-.6 7.5-4.4 8-9Z"/>',
  ring: '<circle cx="12" cy="12" r="7.5"/>',
  help: '<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8h.01"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/>',
};
function micon(name) {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + MICONS[name] + '</svg>';
}

function buildManagerShell(active, user) {
  const links = MNAV.map(function (item) {
    const on = item.key === active ? ' active' : '';
    const soon = item.ready ? '' : ' soon';
    return '<a class="nav-item' + on + soon + '" href="' + (item.ready ? item.file : '#') + '" data-nav="' + item.key + '">' +
      '<span class="ni">' + micon(item.icon) + '</span><span class="nt" data-i18n="mnav.' + item.key + '">' + item.text + '</span>' +
      (item.badge ? '<span class="nbadge" id="badge-' + item.badge + '" hidden></span>' : '') + '</a>';
  }).join('');

  document.getElementById('sidebar').innerHTML =
    '<div class="identity"><span class="brand"><span class="brand-mark">' + ICONS.logo + '</span><span class="brand-name" dir="ltr">EMPULSE</span></span>' +
      '<span class="space-label" data-i18n="mshell.space">MANAGER · MY TEAM</span></div>' +
    '<button class="team-card" type="button" id="team-card"><span class="avs" id="team-avs" dir="ltr"></span>' +
      '<span class="tc-text"><b id="team-name" dir="auto"></b><small id="team-count"></small></span>' + ICONS.chevron + '</button>' +
    '<nav class="nav" aria-label="Manager navigation">' + links + '</nav>' +
    '<div class="sidebar-footer"><div class="nav-bottom">' +
      '<a class="nav-item soon" href="#" data-soon="1"><span class="ni">' + micon('help') + '</span><span class="nt" data-i18n="mshell.help">Help</span></a>' +
      '<a class="nav-item soon" href="#" data-soon="1"><span class="ni">' + micon('gear') + '</span><span class="nt" data-i18n="shell.menu_settings">Settings</span></a></div>' +
      '<div class="profile-wrap"><button class="profile" id="profile-button" aria-haspopup="true" aria-expanded="false">' +
        '<span class="avatar" dir="ltr" id="profile-initials"></span><span class="profile-text"><b id="profile-name" dir="auto"></b><small id="profile-role" dir="auto"></small></span></button>' +
        '<div class="profile-menu" id="profile-menu" hidden><a href="../role.html" data-i18n="shell.menu_role">Choose experience</a>' +
        '<button type="button" id="sign-out" data-i18n="shell.menu_signout">Sign out</button></div></div></div>';

  document.getElementById('topbar').innerHTML =
    '<nav class="breadcrumb" id="breadcrumb" aria-label="Breadcrumb"></nav>' +
    '<div class="utilities"><span class="lang-switch"><button lang="en" type="button">EN</button><span>|</span><button lang="ar" type="button">العربية</button></span>' +
      '<span class="util attn" id="attn" hidden>' + micon('alert') + '<span id="attn-text"></span></span>' +
      '<button class="util search" id="pulseai-search" type="button">' + ICONS.spark + '<span data-i18n="mshell.ask">Ask about your team or find a team…</span><kbd dir="ltr">Ctrl K</kbd></button>' +
      '<button class="util period" id="period-button" type="button">' + ICONS.calendar + '<span data-i18n="mshell.period">Last 4 weeks</span>' + ICONS.chevron + '</button>' +
      '<button class="util bell" id="bell-button" type="button" aria-label="Notifications">' + ICONS.bell + '<i class="reddot"></i></button></div>';

  document.getElementById('profile-name').textContent = user.full_name;
  document.getElementById('profile-initials').textContent = user.full_name.split(' ').map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase();
  const button = document.getElementById('profile-button'), menu = document.getElementById('profile-menu');
  button.addEventListener('click', function (e) { e.stopPropagation(); menu.hidden = !menu.hidden; button.setAttribute('aria-expanded', String(!menu.hidden)); });
  document.addEventListener('click', function () { menu.hidden = true; button.setAttribute('aria-expanded', 'false'); });
  document.getElementById('sign-out').addEventListener('click', function () { signOut(); });
  document.addEventListener('click', function (e) {
    if (e.target.closest('.soon, [data-soon]')) { e.preventDefault(); showToast(t('shell.soon')); }
  });
  ['pulseai-search', 'period-button', 'bell-button', 'team-card'].forEach(function (id) {
    document.getElementById(id).addEventListener('click', function () { showToast(id === 'period-button' ? t('shell.period_note') : (id === 'bell-button' ? t('shell.bell_note') : t('shell.soon'))); });
  });
}

// After the data arrived: team card, badges, the "N need attention" pill, the breadcrumb.
function fillManager(d, crumbKey, extraCrumb) {
  document.getElementById('profile-name').textContent = d.who.name;
  document.getElementById('profile-role').textContent = dt(d.who.job_title);
  document.getElementById('team-name').textContent = dt(d.team.name);
  document.getElementById('team-count').textContent = tf('mshell.reports', { n: d.team.people });
  document.getElementById('team-avs').innerHTML = d.team.avatars.map(function (i) { return '<i>' + esc(i) + '</i>'; }).join('');
  Object.keys(d.badges || {}).forEach(function (k) {
    const el = document.getElementById('badge-' + k);
    if (el && d.badges[k] > 0) { el.hidden = false; el.textContent = d.badges[k]; }
  });
  if (d.attention > 0) {
    document.getElementById('attn').hidden = false;
    document.getElementById('attn-text').textContent = tf('mshell.attention', { n: d.attention });
  }
  document.getElementById('breadcrumb').innerHTML =
    '<bdi>' + esc(dt(d.team.name)) + ' · ' + esc(tf('mshell.people', { n: d.team.people })) + '</bdi><span class="sep">/</span>' +
    (extraCrumb ? '<a href="members.html">' + esc(t(crumbKey)) + '</a><span class="sep">/</span><span><bdi>' + esc(extraCrumb) + '</bdi></span>' : '<span>' + esc(t(crumbKey)) + '</span>');
}

async function startManagerPage(page) {
  const query = page.query ? page.query() : '';
  const user = await requireRole(['manager']);
  if (user === null) { return; }
  buildManagerShell(page.active, user);
  await loadTexts();
  const result = await api(page.api + query);
  if (result.status !== 200 || !result.data || result.data.error) {
    document.querySelector('main').innerHTML = '<p class="load-error">' + esc(t('shell.error_load')) + '</p>';
    return;
  }
  fillManager(result.data, page.crumb, page.extraCrumb ? page.extraCrumb(result.data) : null);
  page.render(result.data);
}


// ---------- parts used by the manager screens of Phase 4 ----------

// A message { k, p } from the server -> HTML. Values that are messages are resolved first;
// 'crit' = a criterion key, 'tier' / 'to' = a tier key, 'text' parameters are shown as they are.
function MR(o) {
  if (o === null || o === undefined) { return ''; }
  const params = {};
  Object.keys(o.p || {}).forEach(function (name) {
    const v = o.p[name];
    if (v !== null && typeof v === 'object' && 'k' in v) { params[name] = { html: MR(v) }; }
    else if (name === 'crit') { params[name] = { html: esc(t('crit.' + v)) }; }
    else if (name === 'tier' && typeof v === 'string') { params[name] = { html: esc(tierName(v)) }; }
    else { params[name] = v; }
  });
  return th(o.k, params);
}

// The navy tier card of the team (M01, M02): ring with the score.
function teamTierCardHTML(s, noteHtml) {
  const R = 62, C = 2 * Math.PI * R, pct = Math.min(1, s.value / 100);
  const chg = s.change ? '<span class="chg ' + (s.change > 0 ? 'up' : 'down') + '" dir="ltr">' + (s.change > 0 ? '↑ ' : '↓ ') + Math.abs(s.change) + '</span>' : '';
  return '<div class="tier-card team-tier tier-' + s.tier + '"><div class="tier-head"><span class="mono">' + esc(t('m01.tier')) + '</span>' + chg + '</div>' +
    '<div class="ringbox"><svg viewBox="0 0 150 150"><circle cx="75" cy="75" r="' + R + '" fill="none" stroke="#1d4166" stroke-width="7"/><circle cx="75" cy="75" r="' + R + '" fill="none" stroke="#2cc6b4" stroke-width="7" stroke-linecap="round" stroke-dasharray="' + (C * pct).toFixed(1) + ' ' + C.toFixed(1) + '" transform="rotate(-90 75 75)"/></svg>' +
    '<div class="ring-in"><b dir="ltr">' + s.value + '</b><span class="mono">' + esc(tierName(s.tier)) + '</span></div></div>' +
    '<b class="tname">' + esc(tierName(s.tier)) + '</b><p>' + esc(t('tier.summary.' + s.tier)) + '</p>' + (noteHtml ? '<small>' + noteHtml + '</small>' : '') + '</div>';
}

// A soft button that shows the "later" message.
function soonBtn(cls, html) { return '<button class="btn ' + cls + '" type="button" data-soon="1">' + html + '</button>'; }

// Arrow that mirrors in Arabic (RTL).
const ARW = ICONS.arrow.replace('<svg', '<svg class="flip-in-rtl"');
