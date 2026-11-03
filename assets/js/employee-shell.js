// =====================================================================
// employee-shell.js — used by the employee screens E01-E11 (after shared.js).
//   1. The frame of every employee page: sidebar, top bar, profile menu
//   2. startEmployeePage(): sign-in check, texts, loading the data of the page
//   3. Small helpers: text with numbers (th), dates, a short message (toast)
//   4. Parts that several pages use: tier card, tier band, pulse chart
// Each page has its own file: e01-overview.js, e02-performance.js, ...
// =====================================================================


// ---------- 1. The frame of the page ----------

// The sidebar links of "MY SPACE". ready: false = the screen is built in a later phase.
const NAV = [
  { key: 'overview',       file: 'overview.html',       ready: true,  text: 'My Overview' },
  { key: 'performance',    file: 'performance.html',    ready: true,  text: 'My Performance' },
  { key: 'twin',           file: 'twin.html',           ready: true,  text: 'My Digital Twin' },
  { key: 'innovation_dna', file: 'innovation-dna.html', ready: true,  text: 'My Innovation DNA' },
  { key: 'innovation_lab', file: 'innovation-lab.html', ready: true,  text: 'Innovation Lab' },
  { key: 'marketplace',    file: 'marketplace.html',    ready: true,  text: 'Innovation Marketplace' },
  { key: 'growth',         file: 'growth.html',         ready: true,  text: 'My Growth Path' },
  { key: 'recognition',    file: 'recognition.html',    ready: true,  text: 'Recognition' },
  { key: 'pulseai',        file: 'pulseai.html',        ready: true,  text: 'PulseAI' },
  { key: 'reports',        file: 'reports.html',        ready: true,  text: 'My Reports' },
  { key: 'settings',       file: 'settings.html',       ready: true,  text: 'Settings', hidden: true },   // shown only on its own page
];

// Small drawings (the design uses text symbols for them).
const ICONS = {
  target: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.5"/></svg>',
  arrowUp: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M6 11l6-6 6 6"/></svg>',
  up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V6M7 11l5-5 5 5"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
  ring: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="6.5"/></svg>',
  pulse: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>',
  person: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="7" r="3.6"/><path d="M5 21c0-4.2 3.1-7 7-7s7 2.8 7 7H5Z"/></svg>',
  doc: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3.5h7l4 4V20H7V3.5Z"/><path d="M14 3.5V8h4M9.5 13h6M9.5 16.5h6"/></svg>',
  logo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.9" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>',
  sprout: '<svg viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M9.6 13.3c-.6.8-1.6 1.3-2.7 1.3a3.2 3.2 0 1 1 .9-6.3 3.4 3.4 0 1 1 6.4 0 3.2 3.2 0 1 1 .9 6.3c-1.1 0-2.1-.5-2.7-1.3.1 1.9.6 3.4 1.6 4.4H8c1-1 1.5-2.5 1.6-4.4Z"/></svg>',
  ban: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="m5.6 5.6 12.8 12.8"/></svg>',
  spark: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5c.5 4.6 2.4 8.9 9.5 9.5-7.1.6-9 4.9-9.5 9.5-.5-4.6-2.4-8.9-9.5-9.5 7.1-.6 9-4.9 9.5-9.5Z"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.6"/><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="5" width="16" height="15" rx="2.5"/><path d="M4 10h16M9 3v4M15 3v4"/></svg>',
  bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15L6 16Z"/><path d="M10 20.5a2 2 0 0 0 4 0"/></svg>',
  chevron: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  reset: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12a8 8 0 1 0 2.6-5.9M4 4v4.5h4.5"/></svg>',
  diamond: '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M24 6 42 24 24 42 6 24 24 6Z"/><path d="M24 14l10 10-10 10-10-10 10-10Z" opacity=".55"/></svg>',
  idea: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.5c.4 3.6 1.9 5.1 5.5 5.5-3.6.4-5.1 1.9-5.5 5.5-.4-3.6-1.9-5.1-5.5-5.5 3.6-.4 5.1-1.9 5.5-5.5Z"/><path d="M18 15c.2 1.9 1 2.7 2.9 2.9-1.9.2-2.7 1-2.9 2.9-.2-1.9-1-2.7-2.9-2.9 1.9-.2 2.7-1 2.9-2.9Z"/></svg>',
};

// Draw the sidebar and the top bar. "active" is the key of the page in NAV.
function buildShell(active, user) {
  const links = NAV.filter(function (item) { return !item.hidden || item.key === active; }).map(function (item) {
    const current = item.key === active ? ' active' : '';
    const soon = item.ready ? '' : ' soon';
    const href = item.ready ? item.file : '#';
    return '<a class="nav-item' + current + soon + '" href="' + href + '" data-nav="' + item.key + '">' +
           (current ? '<span class="dot">●</span>' : '') +
           '<span data-i18n="nav.' + item.key + '">' + item.text + '</span></a>';
  }).join('');

  document.getElementById('sidebar').innerHTML =
    '<div class="identity">' +
      '<span class="brand"><span class="brand-mark">' + ICONS.logo + '</span><span class="brand-name" dir="ltr">EMPULSE</span></span>' +
      '<span class="space-label" data-i18n="shell.space">MY SPACE</span>' +
    '</div>' +
    '<div class="role-promise"><span class="rp-icon">' + ICONS.sprout + '</span><span data-i18n="shell.promise">How am I doing, and how can I grow?</span></div>' +
    '<nav class="nav" aria-label="Employee navigation">' + links + '</nav>' +
    '<div class="sidebar-footer">' +
      '<div class="privacy-note"><span class="pn-icon">' + ICONS.ban + '</span><p data-i18n="shell.privacy">Your data, your growth. You see only your own data. Check-ins stay private unless you share.</p></div>' +
      '<div class="profile-wrap">' +
        '<button class="profile" id="profile-button" aria-haspopup="true" aria-expanded="false">' +
          '<span class="avatar" dir="ltr" id="profile-initials"></span>' +
          '<span class="profile-text"><b id="profile-name" dir="auto"></b><small id="profile-role" dir="auto"></small></span>' +
        '</button>' +
        '<div class="profile-menu" id="profile-menu" hidden>' +
          '<a href="../role.html" data-i18n="shell.menu_role">Choose experience</a>' +
          '<a href="settings.html" data-i18n="shell.menu_settings">Settings</a>' +
          '<button type="button" id="sign-out" data-i18n="shell.menu_signout">Sign out</button>' +
        '</div>' +
      '</div>' +
    '</div>';

  document.getElementById('topbar').innerHTML =
    '<nav class="breadcrumb" id="breadcrumb" aria-label="Breadcrumb"></nav>' +
    '<div class="utilities">' +
      '<span class="lang-switch"><button lang="en" type="button">EN</button><span>|</span><button lang="ar" type="button">العربية</button></span>' +
      '<button class="util search" id="pulseai-search" type="button">' + ICONS.spark +
        '<span data-i18n="shell.ask_placeholder">Ask PulseAI about your growth…</span><kbd dir="ltr">Ctrl K</kbd></button>' +
      '<button class="util period" id="period-button" type="button">' + ICONS.calendar +
        '<span data-i18n="shell.period">This quarter</span>' + ICONS.chevron + '</button>' +
      '<button class="util bell" id="bell-button" type="button" aria-label="Notifications">' + ICONS.bell + '</button>' +
    '</div>';

  // Name in the profile (the page fills the job title when its data arrives).
  document.getElementById('profile-name').textContent = user.full_name;
  document.getElementById('profile-initials').textContent = user.full_name.split(' ').map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase();

  // Profile menu
  const button = document.getElementById('profile-button');
  const menu = document.getElementById('profile-menu');
  button.addEventListener('click', function (event) {
    event.stopPropagation();
    menu.hidden = !menu.hidden;
    button.setAttribute('aria-expanded', String(!menu.hidden));
  });
  document.addEventListener('click', function () { menu.hidden = true; button.setAttribute('aria-expanded', 'false'); });
  document.getElementById('sign-out').addEventListener('click', function () { signOut(); });

  // Links to screens that are built in a later phase, and the small buttons: a short message.
  document.addEventListener('click', function (event) {
    const soon = event.target.closest('.soon, [data-soon]');
    if (soon) {
      event.preventDefault();
      showToast(t('shell.soon'));
    }
  });
  document.getElementById('pulseai-search').addEventListener('click', function () { location.href = 'pulseai.html'; });
  document.getElementById('period-button').addEventListener('click', function () { showToast(t('shell.period_note')); });
  document.getElementById('bell-button').addEventListener('click', function () { showToast(t('shell.bell_note')); });
  document.addEventListener('keydown', function (event) {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      location.href = 'pulseai.html';
    }
  });
}

// After the data arrived: name, job title and the breadcrumb "Layla Haddad · Customer Insights / Overview".
function fillWho(who, crumbKey) {
  document.getElementById('profile-name').textContent = who.name;
  document.getElementById('profile-role').textContent = dt(who.job_title);
  document.getElementById('breadcrumb').innerHTML =
    '<bdi>' + esc(who.name) + ' · ' + esc(dt(who.team || who.department)) + '</bdi><span class="sep">/</span><span>' + esc(t(crumbKey)) + '</span>';
}


// ---------- 2. Start a page ----------

// Every employee page calls this once:
//   startEmployeePage({ active: 'overview', api: 'employee/overview.php', crumb: 'e01.crumb', render: function (data) {...} })
async function startEmployeePage(page) {
  const user = await requireRole(['employee']);
  if (user === null) {
    return;
  }
  buildShell(page.active, user);
  await loadTexts();                         // texts of the page and of the frame; also shows the page

  const result = await api(page.api);
  if (result.status !== 200 || !result.data || result.data.error) {
    document.querySelector('main').innerHTML = '<p class="load-error">' + esc(t('shell.error_load')) + '</p>';
    return;
  }
  fillWho(result.data.who, page.crumb);
  page.render(result.data);
}


// ---------- 3. Helpers ----------

// Make text safe to put inside HTML.
function esc(value) {
  return String(value === null || value === undefined ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// A number or code that must stay left-to-right in Arabic text.
function ltr(value) {
  return '<bdi dir="ltr">' + esc(value) + '</bdi>';
}

// Text of the language file with values inside, as HTML:
//   th('e01.path_sub', { score: 84, tier: 'GOLD' })
// Numbers are kept left-to-right; names and titles from the database are isolated (<bdi>).
// A value written as { html: '...' } is used as it is.
function th(key, params) {
  const safe = {};
  Object.keys(params || {}).forEach(function (name) {
    const value = params[name];
    if (value !== null && typeof value === 'object' && 'html' in value) {
      safe[name] = value.html;
    } else if (typeof value === 'number' || /^[-+−]?[\d.,]+%?$/.test(String(value))) {
      safe[name] = ltr(value);
    } else {
      safe[name] = '<bdi>' + esc(value) + '</bdi>';
    }
  });
  return tf(key, safe);
}

// "2026-09-24" -> "24 Sep"    (with { weekday: true } -> "Thu 24 Sep")
function fmtDate(iso, options) {
  const parts = iso.slice(0, 10).split('-').map(Number);
  const date = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  let text = parts[2] + ' ' + t('month.' + parts[1]);
  if (options && options.weekday) {
    text = t('weekday.' + date.getUTCDay()) + ' ' + text;
  }
  return text;
}

// "2026-06-01" -> "June" (long month name)
function monthName(iso) {
  return t('monthlong.' + Number(iso.slice(5, 7)));
}

// Text that comes from the database (job titles, idea titles ...). English is shown as it is;
// Arabic uses the language file when it has a translation under "data.<the English text>".
function dt(text) {
  if (text === null || text === undefined || text === '') {
    return '';
  }
  return texts['data.' + text] || text;
}

// "All dimensions are above June" - one sentence about the pulse compared with the comparison month.
function pulseSummaryText(summary, compareMonth) {
  const month = monthName(compareMonth);
  const total = summary.above + summary.same + summary.below;
  if (summary.below === 0 && summary.same === 0) {
    return th('pulse.all_above', { month: month });
  }
  if (summary.below === 0) {
    return th('pulse.none_below', { above: summary.above, total: total, month: month });
  }
  return th('pulse.some_below', { above: summary.above, below: summary.below, month: month });
}

// An arrow for a change: 'up' -> '↑', 'down' -> '↓', 'same' -> '→'.
function arrowOf(kind) {
  return kind === 'up' ? '↑' : (kind === 'down' ? '↓' : '→');
}

// A short message at the bottom of the page.
let toastTimer = null;
function showToast(message) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    toast.setAttribute('role', 'status');
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { toast.classList.remove('show'); }, 3200);
}

// 180000 -> "SAR 180K"
function fmtSar(amount) {
  if (amount >= 1000000) { return 'SAR ' + (amount / 1000000).toFixed(1).replace(/\.0$/, '') + 'M'; }
  if (amount >= 1000)    { return 'SAR ' + Math.round(amount / 1000) + 'K'; }
  return 'SAR ' + amount;
}

// 1.35 -> "1.35",  90 -> "90",  83.75 -> "83.75"
function num(value) {
  return String(Math.round(value * 100) / 100);
}

// Tier name in the current language: tierName('gold') -> "GOLD" / "الذهبي"
function tierName(key) {
  return t('tier.' + key);
}


// ---------- 4. Parts used by several pages ----------

// The navy tier card of E01, E02 and E03.
function tierCardHTML(score, compareMonth) {
  let change = '';
  if (score.change !== null) {
    const arrow = score.change > 0 ? '↑ +' + score.change : (score.change < 0 ? '↓ −' + Math.abs(score.change) : '→ 0');
    change = '<span class="tier-change" title="' + esc(tf('tier.change_hint', { month: monthName(compareMonth) })) + '" dir="ltr">' + arrow + '</span>';
  }
  const nextTxt = score.next ? th('tier.points_to', { n: score.next.points, tier: tierName(score.next.key) }) : esc(t('tier.top_reached'));
  const next = '<span>' + nextTxt + '</span><span class="mono gold-text" dir="ltr">' + score.rounded + ' / 100</span>';
  return '<div class="tier-card tier-' + score.tier + '">' +
    '<div class="tier-head"><span class="mono">' + esc(t('tier.label')) + '</span>' + change + '</div>' +
    '<div class="medallion"><span class="tier-name mono">' + esc(tierName(score.tier)) + '</span><span class="tier-score" dir="ltr">' + score.rounded + '</span></div>' +
    '<p class="tier-summary">' + th('tier.summary', { summary: t('tier.summary.' + score.tier), score: score.rounded }) + '</p>' +
    '<div class="tier-next">' + next + '</div>' +
  '</div>';
}

// The Bronze | Silver | Gold band with a marker for the score.
function tierBandHTML(score, tierKey) {
  // Three equal parts: Bronze (70-80), Silver (80-90), Gold (90+). The marker moves inside its part.
  let position = 0;
  if (score >= 90)      { position = 2 / 3 + Math.min(score - 90, 10) / 10 / 3; }
  else if (score >= 80) { position = 1 / 3 + (score - 80) / 10 / 3; }
  else if (score >= 70) { position = (score - 70) / 10 / 3; }
  const percent = Math.round(position * 1000) / 10;
  // The "YOU" label goes on a second line when it would touch another label.
  const touches = [0, 33.3, 100].some(function (p) { return Math.abs(p - percent) < 14; });
  return '<div class="band">' +
    '<div class="band-bar"><i class="bronze"></i><i class="silver"></i><i class="gold"></i>' +
      '<b class="marker" style="inset-inline-start:' + percent + '%"></b></div>' +
    '<div class="band-labels' + (touches ? ' two-lines' : '') + '">' +
      '<span class="b1">' + th('band.bronze', { n: 70 }) + '</span>' +
      '<span class="b2">' + th('band.silver', { n: 80 }) + '</span>' +
      '<span class="b3">' + th('band.gold', { n: 90 }) + '</span>' +
      '<span class="b-you" style="inset-inline-start:' + percent + '%">' + th('band.you', { n: score }) + '</span>' +
    '</div></div>';
}

// The "heartbeat" chart: one beat per criterion, the height of the peak = the score.
// Solid teal = now, dashed = the comparison month. width/height are the size of the drawing.
function pulseHTML(pulse, size) {
  const W = size.width, H = size.height;
  const top = 16;                                  // y of score 100
  const k = size.height === 200 ? 1.7 : 1.45;       // pixels per score point
  const base = H - 30;                              // the quiet line
  const column = W / pulse.length;
  const y = function (score) { return Math.max(4, top + (100 - score) * k); };

  // One heartbeat around x = cx: small bump, dip, tall peak, dip, small bump.
  function beat(cx, score, first) {
    const w = Math.min(34, column / 2.4);
    const peak = y(score);
    let d = first ? 'M0 ' + base + ' L' + (cx - w) + ' ' + base : 'L' + (cx - w) + ' ' + base;
    d += ' C' + (cx - w * 0.75) + ' ' + (base - 7) + ' ' + (cx - w * 0.45) + ' ' + (base - 7) + ' ' + (cx - w * 0.25) + ' ' + base;
    d += ' L' + (cx - w * 0.12) + ' ' + (base + 9);
    d += ' L' + cx + ' ' + peak;
    d += ' L' + (cx + w * 0.14) + ' ' + (base + 20);
    d += ' L' + (cx + w * 0.3) + ' ' + base;
    d += ' C' + (cx + w * 0.55) + ' ' + (base - 8) + ' ' + (cx + w * 0.85) + ' ' + (base - 8) + ' ' + (cx + w) + ' ' + base;
    return d;
  }
  function trace(valueOf) {
    let d = '';
    pulse.forEach(function (item, i) {
      const value = valueOf(item);
      d += beat(column * (i + 0.5), value === null ? 0 : value, i === 0);
    });
    return d + ' L' + W + ' ' + base;
  }

  let grid = '';
  for (let g = 1; g <= 4; g++) {
    const gy = Math.round(top + 20 * k + g * (base - top - 20 * k) / 5);
    grid += '<line x1="0" x2="' + W + '" y1="' + gy + '" y2="' + gy + '" class="grid"/>';
  }
  // The "thriving zone": scores from 80 to 100.
  const zone = '<rect x="0" y="' + top + '" width="' + W + '" height="' + Math.round(20 * k) + '" rx="6" class="zone"/>';
  const hasBefore = pulse.some(function (p) { return p.before !== null; });

  const labels = pulse.map(function (item) {
    return '<div class="pulse-dim"><b dir="ltr">' + item.now + '</b><span class="mono">' + esc(t('crits.' + item.key)) + '</span></div>';
  }).join('');

  return '<div class="pulse-chart">' +
    '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" class="pulse-svg" role="img" aria-label="' + esc(t('pulse.aria')) + '">' +
      zone + grid +
      (hasBefore ? '<path d="' + trace(function (p) { return p.before; }) + '" class="trace before"/>' : '') +
      '<path d="' + trace(function (p) { return p.now; }) + '" class="trace now"/>' +
    '</svg>' +
    '<div class="pulse-dims" style="grid-template-columns:repeat(' + pulse.length + ',1fr)">' + labels + '</div>' +
  '</div>';
}

// The top of a card: title, a line under it, and an optional link on the other side.
//   cardHeadHTML('Balance this week', 'Planned 40 h', '<a class="action" href="#">Growth path</a>')
// title is plain text; sub and action are HTML (use th() / esc() inside them).
function cardHeadHTML(title, sub, action) {
  return '<div class="card-head"><div class="copy"><h2>' + esc(title) + '</h2>' +
         (sub ? '<p class="sub">' + sub + '</p>' : '') + '</div>' + (action || '') + '</div>';
}

// A link in a card head. If the target screen is not built yet, a short message is shown instead.
function actionHTML(text, href) {
  if (href) {
    return '<a class="action" href="' + href + '">' + esc(text) + '</a>';
  }
  return '<a class="action" href="#" data-soon="1">' + esc(text) + '</a>';
}

// The score calculation: the formula line, the table of seven dimensions and the note about Job Burnout.
// Used by E02 (My Performance) and E03 (My Digital Twin).
function calcBodyHTML(score, burnoutRisk) {
  const rows = score.rows.map(function (r) {
    return '<tr><td>' + esc(t('crit.' + r.key)) + '</td><td dir="ltr">' + r.score + '</td><td dir="ltr">×' + r.weight + '%</td>' +
           '<td dir="ltr">' + r.points.toFixed(2) + '</td></tr>';
  }).join('');
  const burnout = score.rows.filter(function (r) { return r.key === 'job_burnout'; })[0];
  return '<div class="formula"><span class="mono">' + th('e02.formula', { exact: score.exact.toFixed(2) }) + '</span><b dir="ltr">' + score.rounded + '</b></div>' +
    '<div class="calc-table"><table><thead><tr><th>' + esc(t('e02.col_dimension')) + '</th><th>' + esc(t('e02.col_value')) + '</th><th>' +
      esc(t('e02.col_weight')) + '</th><th>' + esc(t('e02.col_points')) + '</th></tr></thead><tbody>' + rows + '</tbody></table></div>' +
    '<p class="note">' + th('e02.burnout_note', { risk: burnoutRisk, score: burnout.score }) + '</p>';
}

// A small pill: "Thriving", "Implemented" ...
function badgeHTML(text, kind) {
  return '<span class="badge ' + (kind || '') + '">' + esc(text) + '</span>';
}
