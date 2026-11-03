// =====================================================================
// e01-overview.js — E01 My Overview (pages/employee/overview.html)
// The data comes from server/api/employee/overview.php (only the signed-in employee's own data).
// The page is drawn in parts, one function per card.
// =====================================================================

document.addEventListener('DOMContentLoaded', function () {
  startEmployeePage({ active: 'overview', api: 'employee/overview.php', crumb: 'e01.crumb', render: render });
});

// The check-in answers: 1 = Drained ... 5 = Energised.
const ENERGY_KEYS = ['drained', 'low', 'okay', 'good', 'energised'];

function render(d) {
  document.querySelector('main').innerHTML =
    headerHTML(d) +
    '<div class="dashboard">' +
      '<div class="row row-pulse">' + pulseCardHTML(d) + tierCardHTML(d.score, d.compare_month) + '</div>' +
      '<div class="row row-changes">' + changesCardHTML(d) + pathCardHTML(d) + '</div>' +
      '<div class="row row-trio">' + balanceCardHTML(d) + checkinCardHTML(d) + growthCardHTML(d) + '</div>' +
      '<div class="row row-mentor">' + mentorCardHTML(d) + recognitionCardHTML(d) + '</div>' +
      '<div class="row row-idea">' + ideaCardHTML(d) + insightCardHTML(d) + '</div>' +
    '</div>';
  wire(d);
}


// ---------- Header ----------

function headerHTML(d) {
  return '<header class="page-header">' +
    '<div class="copy"><h1>' + th('e01.greeting', { name: d.who.first_name }) + '</h1>' +
      '<p>' + esc(t('e01.subtitle.' + d.status)) + '</p></div>' +
    '<div class="actions">' +
      '<button class="btn" type="button" data-soon="1">' + ICONS.user + '<span>' + esc(t('e01.ask_pulseai')) + '</span></button>' +
      '<button class="btn primary" type="button" id="share-checkin">' + ICONS.spark + '<span>' + esc(t('e01.share_checkin')) + '</span></button>' +
    '</div></header>';
}


// ---------- My Pulse ----------

function pulseCardHTML(d) {
  return '<section class="card pulse-card">' +
    cardHeadHTML(t('e01.pulse_title'), th('e01.pulse_sub', { month: monthName(d.compare_month) }),
                 actionHTML(t('e01.how_measured'), 'performance.html#calc')) +
    pulseHTML(d.pulse, { width: 738, height: 200 }) +
    '<div class="status-row">' + badgeHTML(t('e01.status.' + d.status), d.status === 'burnout_risk' ? 'coral' : (d.status === 'stretched' ? 'amber' : 'teal')) +
      '<span class="muted">' + pulseSummaryText(d.pulse_summary, d.compare_month) + '</span></div>' +
  '</section>';
}


// ---------- What changed since June ----------

function changesCardHTML(d) {
  if (!d.changes.length) {
    return '<section class="card">' + cardHeadHTML(tf('e01.changed_title', { month: monthName(d.compare_month) }), esc(t('e01.changed_empty'))) + '</section>';
  }
  const tiles = d.changes.map(function (c) {
    const delta = c.to - c.from;
    const unit = c.key === 'burnout_risk' || c.key === 'workload' ? '%' : '';
    const good = (c.good_when === 'down' && delta < 0) || (c.good_when === 'up' && delta > 0);
    const arrow = delta === 0 ? '→ 0' : (delta > 0 ? '↑ ' : '↓ ') + Math.abs(delta) + (c.key === 'engagement' || c.key === 'innovation' ? '' : ' ' + t('e01.pts'));
    return '<div class="stat"><span class="stat-label">' + esc(t('e01.change.' + c.key)) + '</span>' +
      '<b class="stat-value" dir="ltr">' + c.from + unit + ' → ' + c.to + unit + '</b>' +
      '<span class="stat-delta ' + (delta === 0 ? '' : (good ? 'good' : 'bad')) + '" dir="ltr">' + arrow + '</span></div>';
  }).join('');
  // The line under the title: good news when burnout fell and engagement rose.
  const burnout = d.changes[0], engagement = d.changes[1];
  const recovering = burnout.to < burnout.from && engagement.to > engagement.from;
  return '<section class="card">' +
    cardHeadHTML(tf('e01.changed_title', { month: monthName(d.compare_month) }), esc(t(recovering ? 'e01.changed_sub_recovery' : 'e01.changed_sub'))) +
    '<div class="stats">' + tiles + '</div></section>';
}


// ---------- Path to the next tier ----------

function pathCardHTML(d) {
  const next = d.score.next;
  if (!next) {
    return '<section class="card">' + cardHeadHTML(t('e01.path_title_top'), esc(t('e01.path_top_sub'))) + tierBandHTML(d.score.rounded, d.score.tier) + '</section>';
  }
  const items = d.path.map(function (item) {
    return '<div class="focus"><span class="focus-name">' + esc(t('crit.' + item.key)) + '</span>' +
      '<b dir="ltr">' + item.from + ' → ' + item.to + '</b>' +
      '<span class="focus-gain mono" dir="ltr">+' + item.points.toFixed(2) + '</span></div>';
  }).join('');
  return '<section class="card">' +
    cardHeadHTML(tf('e01.path_title', { tier: tierName(next.key) }),
                 th('e01.path_sub', { score: d.score.rounded, n: next.points, tier: tierName(next.key) }),
                 actionHTML(t('e01.open_planner'), 'performance.html#planner')) +
    tierBandHTML(d.score.rounded, d.score.tier) +
    '<div class="focus-row">' + items + '</div></section>';
}


// ---------- Balance this week ----------

function balanceCardHTML(d) {
  const a = d.activity;
  if (!a) {
    return '<section class="card">' + cardHeadHTML(t('e01.balance_title'), esc(t('e01.balance_empty'))) + '</section>';
  }
  // Healthy range: up to 10% above the plan. Recovery: after-hours work.
  const ratio = a.work / a.planned;
  const range = ratio <= 1.1 ? 'healthy' : (ratio <= 1.25 ? 'above' : 'high');
  const recovery = a.after_hours <= 2 ? 'good' : (a.after_hours <= 5 ? 'fair' : 'low');
  const circle = 2 * Math.PI * 38;
  const filled = Math.min(ratio, 1) * circle;
  return '<section class="card">' +
    cardHeadHTML(t('e01.balance_title'), th('e01.balance_sub', { planned: num(a.planned), range: t('e01.range.' + range) })) +
    '<div class="balance">' +
      '<div class="ring"><svg viewBox="0 0 96 96"><circle cx="48" cy="48" r="38" class="ring-bg"/>' +
        '<circle cx="48" cy="48" r="38" class="ring-fg" stroke-dasharray="' + filled.toFixed(1) + ' ' + circle.toFixed(1) + '" transform="rotate(-90 48 48)"/></svg>' +
        '<div class="ring-text"><b dir="ltr">' + num(a.work) + ' ' + esc(t('e01.hour_short')) + '</b><span class="mono">' + esc(t('e01.work_caption')) + '</span></div></div>' +
      '<dl class="facts">' +
        '<div><dt>' + esc(t('e01.recovery')) + '</dt><dd class="teal">' + esc(t('e01.recovery.' + recovery)) + '</dd></div>' +
        '<div><dt>' + esc(t('e01.focus')) + '</dt><dd dir="ltr">' + num(a.focus) + ' ' + esc(t('e01.hour_short')) + '</dd></div>' +
        '<div><dt>' + esc(t('e01.meetings')) + '</dt><dd dir="ltr">' + num(a.meetings) + ' ' + esc(t('e01.hour_short')) + '</dd></div>' +
        '<div><dt>' + esc(t('e01.after_hours')) + '</dt><dd dir="ltr">' + num(a.after_hours) + ' ' + esc(t('e01.hour_short')) + '</dd></div>' +
      '</dl></div></section>';
}


// ---------- Private check-in ----------

// Small round symbols for the five energy levels (a quarter, half ... full circle, then a spark).
function energyIcon(level) {
  if (level === 5) {
    return ICONS.spark;
  }
  const r = 8, c = 12;
  const angle = level / 4 * 2 * Math.PI;
  const x = c + r * Math.sin(angle), y = c - r * Math.cos(angle);
  const large = level > 2 ? 1 : 0;
  const slice = level === 4 ? '' : '<path d="M12 12 V4 A8 8 0 ' + large + ' 1 ' + x.toFixed(2) + ' ' + y.toFixed(2) + ' Z" fill="currentColor"/>';
  return '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="' + (level === 4 ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="1.6"/>' + slice + '</svg>';
}

function checkinFooterHTML(c) {
  const text = c.share_trend ? 'e01.checkin_shared' : 'e01.checkin_not_shared';
  return th(text, { n: c.streak_weeks, change: { html: '<a href="#" id="share-toggle" class="inline-link">' + esc(t('e01.change')) + '</a>' } });
}

function checkinCardHTML(d) {
  const c = d.checkin;
  const options = ENERGY_KEYS.map(function (key, i) {
    const on = c.energy === i + 1 ? ' selected' : '';
    return '<button type="button" class="energy' + on + '" data-energy="' + (i + 1) + '" aria-pressed="' + (c.energy === i + 1) + '">' +
      energyIcon(i + 1) + '<span>' + esc(t('e01.energy.' + key)) + '</span></button>';
  }).join('');
  return '<section class="card" id="checkin-card">' +
    cardHeadHTML(t('e01.checkin_title'), esc(t('e01.checkin_sub'))) +
    '<div class="energies">' + options + '</div>' +
    '<p class="note" id="checkin-footer">' + checkinFooterHTML(c) + '</p></section>';
}


// ---------- Next growth step ----------

function growthCardHTML(d) {
  const g = d.growth;
  if (!g) {
    return '<section class="card">' + cardHeadHTML(t('e01.growth_title'), esc(t('e01.growth_empty'))) + '</section>';
  }
  return '<section class="card">' +
    cardHeadHTML(t('e01.growth_title'), th('e01.growth_sub', { goal: dt(g.goal) }), actionHTML(t('e01.growth_link'))) +
    '<div class="module"><span class="mono module-tag">' + th('e01.module_of', { n: g.seq, total: g.total }) + '</span>' +
      '<b class="module-title">' + esc(dt(g.title)) + '</b>' +
      '<span class="module-desc">' + esc(dt(g.description)) + '</span>' +
      '<div class="progress"><i style="width:' + g.progress + '%"></i></div>' +
      '<span class="mono module-pct" dir="ltr">' + g.progress + '%</span></div></section>';
}


// ---------- Mentor session ----------

function mentorCardHTML(d) {
  const m = d.mentor;
  if (!m) {
    return '<section class="card">' + cardHeadHTML(t('e01.mentor_empty_title'), esc(t('e01.mentor_empty'))) + '</section>';
  }
  const time = m.at.slice(11, 16);
  return '<section class="card">' +
    cardHeadHTML(tf('e01.mentor_title', { name: m.mentor }), '<bdi dir="ltr">' + esc(fmtDate(m.at, { weekday: true }) + ' · ' + time) + '</bdi>') +
    '<div class="mentor"><span class="avatar soft" dir="ltr">' + esc(m.initials) + '</span><span class="quote">“' + esc(dt(m.topic)) + '”</span></div>' +
    '<div><button class="btn small" type="button" data-soon="1">' + ICONS.calendar + '<span>' + esc(t('e01.view_session')) + '</span></button></div>' +
  '</section>';
}


// ---------- Recognition received ----------

function recognitionCardHTML(d) {
  const r = d.recognition;
  const cards = r.awards.map(function (a, i) {
    const kind = a.category === 'Innovation Champion' ? 'violet' : 'teal';
    return '<div class="award ' + kind + '"><span class="award-icon">' + ICONS.spark + '</span><div>' +
      '<b>' + esc(t('recog.' + a.category)) + '</b>' +
      '<small>' + th('e01.from', { name: dt(a.from) }) + '</small>' +
      '<p>' + esc(dt(a.message)) + '</p></div></div>';
  }).join('');
  return '<section class="card">' +
    cardHeadHTML(t('e01.recognition_title'), th('e01.recognition_sub', { n: r.quarter_count }), actionHTML(t('e01.wall'))) +
    (cards ? '<div class="awards">' + cards + '</div>' : '<p class="empty">' + esc(t('e01.recognition_empty')) + '</p>') +
  '</section>';
}


// ---------- Idea journey ----------

function ideaCardHTML(d) {
  const idea = d.idea;
  if (!idea) {
    return '<section class="card">' + cardHeadHTML(t('e01.idea_title'), esc(t('e01.idea_empty')), actionHTML(t('e01.submit_idea'))) + '</section>';
  }
  const steps = ['idea', 'review', 'approved', 'team', 'built', 'impact'].map(function (key, i) {
    const done = i + 1 <= idea.stage;
    const last = i === 5;
    return '<div class="step ' + (done ? 'done' : '') + '"><span class="step-dot">' + (last ? ICONS.check : ICONS.arrow.replace('<svg', '<svg class="flip-in-rtl"')) + '</span>' +
      '<small>' + esc(t('e01.step.' + key)) + '</small></div>';
  });
  const joined = steps.join('<i class="step-line"></i>');
  const tiles = [];
  if (idea.realized_savings_sar > 0) { tiles.push(['e01.impact_saving', fmtSar(idea.realized_savings_sar)]); }
  if (idea.requests_pct !== null)    { tiles.push(['e01.impact_requests', (idea.requests_pct < 0 ? '−' : '+') + Math.abs(idea.requests_pct) + '%']); }
  if (idea.teams !== null)           { tiles.push(['e01.impact_adopted', null, idea.teams]); }
  const impact = tiles.map(function (x) {
    const value = x[1] !== null ? '<bdi dir="ltr">' + esc(x[1]) + '</bdi>' : th('e01.n_teams', { n: x[2] });
    return '<div class="impact"><span class="mono">' + esc(t(x[0])) + '</span><b>' + value + '</b></div>';
  }).join('');
  return '<section class="card">' +
    cardHeadHTML(t('e01.idea_title'), '<bdi>' + esc(dt(idea.title)) + '</bdi> · <bdi dir="ltr">' + esc(idea.code) + '</bdi>', actionHTML(t('e01.submit_idea'))) +
    '<div class="journey">' + joined + '</div>' +
    (impact ? '<div class="impacts">' + impact + '</div>' : '') + '</section>';
}


// ---------- PulseAI for you (a rule on the data, no language model) ----------

function insightCardHTML(d) {
  const i = d.insight;
  let head = '', body = '';
  if (i.type === 'pattern') {
    head = th('e01.insight.pattern.head', { days: t('e01.days.' + i.params.days) });
    body = th('e01.insight.pattern.body', { pct: i.params.pct });
  } else if (i.type === 'recovery') {
    head = th('e01.insight.recovery.head', { points: i.params.points });
    body = th('e01.insight.recovery.body', { from: i.params.from, to: i.params.to });
  } else if (i.type === 'watch') {
    head = th('e01.insight.watch.head', { risk: i.params.risk });
    body = esc(t('e01.insight.watch.body'));
  } else {
    head = th('e01.insight.steady.head', { criterion: t('crit.' + i.params.key), score: i.params.score });
    body = esc(t('e01.insight.steady.body'));
  }
  return '<section class="card dark insight">' +
    '<div class="insight-head"><span class="spark">' + ICONS.spark + '</span><b>' + esc(t('e01.insight.title')) + '</b></div>' +
    '<h2>' + head + '</h2><p>' + body + '</p>' +
    '<div class="insight-actions"><button class="btn small light" type="button" data-soon="1">' + esc(t('e01.protect_focus')) + '</button>' +
    '<button class="link-light" type="button" id="not-now">' + esc(t('e01.not_now')) + '</button></div></section>';
}


// ---------- Buttons ----------

function wire(d) {
  // "Share a check-in" goes to the check-in card.
  document.getElementById('share-checkin').addEventListener('click', function () {
    const card = document.getElementById('checkin-card');
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    card.classList.add('flash');
    setTimeout(function () { card.classList.remove('flash'); }, 1600);
  });

  // The five energy buttons save this week's answer (private).
  document.querySelectorAll('.energy').forEach(function (button) {
    button.addEventListener('click', async function () {
      const level = Number(button.dataset.energy);
      const result = await api('employee/checkin.php', { energy: level });
      if (result.status !== 200 || !result.data.ok) {
        showToast(t('e01.checkin_error'));
        return;
      }
      d.checkin = result.data.checkin;
      document.querySelectorAll('.energy').forEach(function (b) {
        const on = Number(b.dataset.energy) === level;
        b.classList.toggle('selected', on);
        b.setAttribute('aria-pressed', String(on));
      });
      refreshFooter(d);
      showToast(t('e01.checkin_saved'));
    });
  });
  bindShareToggle(d);

  document.getElementById('not-now').addEventListener('click', function () {
    showToast(t('e01.not_now_note'));
  });
}

// "change": share the TREND of the check-ins with the manager (never the answers), or stop sharing.
function bindShareToggle(d) {
  const link = document.getElementById('share-toggle');
  if (!link) { return; }
  link.addEventListener('click', async function (event) {
    event.preventDefault();
    const result = await api('employee/checkin.php', { share_trend: !d.checkin.share_trend });
    if (result.status === 200 && result.data.ok) {
      d.checkin = result.data.checkin;
      refreshFooter(d);
      showToast(t(d.checkin.share_trend ? 'e01.share_on' : 'e01.share_off'));
    }
  });
}

function refreshFooter(d) {
  document.getElementById('checkin-footer').innerHTML = checkinFooterHTML(d.checkin);
  bindShareToggle(d);
}
