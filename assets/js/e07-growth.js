// =====================================================================
// e07-growth.js — E07 My Growth Path (pages/employee/growth.html)
// The data comes from server/api/employee/growth.php (own data only).
// The journey line is drawn through the milestone points: solid = achieved, dashed = planned with the manager.
// =====================================================================

document.addEventListener('DOMContentLoaded', function () {
  startEmployeePage({ active: 'growth', api: 'employee/growth.php', crumb: 'e07.crumb', render: render });
});

let g = null;
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function render(d) {
  g = d;
  const s = d.stats;
  document.querySelector('main').innerHTML =
    '<header class="page-header"><div class="copy"><h1>' + esc(t('e07.title')) + '</h1><p>' + esc(t('e07.subtitle')) + '</p></div>' +
      '<div class="actions"><button class="btn" type="button" data-soon="1">' + esc(t('e07.share')) + '</button>' +
      '<a class="btn primary" href="performance.html">' + esc(t('e07.improve')) + '</a></div></header>' +
    '<div class="dashboard">' +
      '<div class="row row-top"><section class="card stats3">' +
        stat(t('e07.s_learning'), th('e07.hours', { n: s.hours }), s.hours_delta === null ? '' : th('e07.s_delta', { n: (s.hours_delta >= 0 ? '+' : '−') + Math.abs(s.hours_delta) })) +
        stat(t('e07.s_goals'), th('e07.of', { a: s.goals_on_track, b: s.goals_total }), th('e07.s_ready', { n: s.goals_total - s.goals_on_track })) +
        stat(t('e07.s_miles'), th('e07.of', { a: s.milestones_reached, b: s.milestones_total }), s.since ? th('e07.s_since', { year: s.since }) : '') +
      '</section>' + nudgeHTML(d) + '</div>' +
      journeyHTML(d) +
      '<div class="row row-bottom">' + skillsHTML(d) + learningHTML(d) + '<div class="col">' + mentorsHTML(d) + projectsHTML(d) + '</div></div>' +
    '</div>';
  wire();
}

function stat(label, value, sub) {
  return '<div class="st"><span class="mono">' + esc(label) + '</span><b>' + value + '</b><small>' + sub + '</small></div>';
}

function gapWord(skill) { return texts['data.gap.' + skill] || skill; }

function nudgeHTML(d) {
  if (!d.nudge) { return '<section class="card nudge"><p>' + esc(t('e07.nudge_none')) + '</p></section>'; }
  return '<section class="card nudge" id="nudge"><div class="nudge-main"><p>' + th('e07.nudge', { gap: gapWord(d.nudge.gap), manager: d.nudge.manager || t('e07.your_manager') }) +
    '</p><button class="btn small" type="button" id="draft">' + esc(t('e07.draft')) + '</button></div><div id="draft-box"></div></section>';
}

// ---------- Journey ----------

// A smooth line through the points (Catmull-Rom turned into Bezier curves).
function curve(pts) {
  let path = 'M' + pts[0].x + ' ' + pts[0].y;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
    path += ' C' + c1x.toFixed(1) + ' ' + c1y.toFixed(1) + ' ' + c2x.toFixed(1) + ' ' + c2y.toFixed(1) + ' ' + p2.x + ' ' + p2.y;
  }
  return path;
}

function msTitle(p) { return /^\d{4}$/.test(p.title) ? p.title : dt(p.title); }
function msSub(p) {
  let m = /^([A-Z]{3}) (\d+)$/.exec(p.sub);
  if (m) { return t('month.' + (MONTHS.indexOf(m[1]) + 1)).toUpperCase() + ' ' + m[2]; }
  m = /^(\d+)% completed$/.exec(p.sub);
  if (m) { return tf('e07.pct_completed', { n: m[1] }); }
  return dt(p.sub);
}

function journeyHTML(d) {
  const j = d.journey;
  const pts = j.points;
  const done = pts.filter(function (p) { return p.state === 'done'; });
  const lastDone = done[done.length - 1];
  // the line starts a little before the first point and ends at the last one
  const all = [{ x: 0, y: pts[0].y + 6 }].concat(pts);
  const split = all.indexOf(lastDone);
  const solid = curve(all.slice(0, split + 1)), dashed = curve(all.slice(split));
  const marks = pts.map(function (p) {
    return '<div class="ms ' + p.state + '" style="left:' + (p.x / 10) + '%;top:' + (p.y / 300 * 100) + '%"><i></i><b>' + esc(msTitle(p)) + '</b><small>' + esc(msSub(p)) + '</small></div>';
  }).join('');
  const last = pts[pts.length - 1];
  const goal = j.goal ? '<div class="goal" style="left:' + (last.x / 10) + '%;top:' + (last.y / 300 * 100) + '%"><span>' + esc(dt(j.goal)) + '</span></div>' : '';
  const sub = j.plan_month ? th('e07.journey_sub', { manager: j.manager || t('e07.your_manager'), month: t('monthlong.' + j.plan_month) })
                            : esc(t('e07.journey_sub_plain'));
  return '<section class="card journey"><div class="card-head"><div class="copy"><h2>' + th('e07.journey', { goal: dt(j.goal || '') }) + '</h2><p class="sub">' + sub + '</p></div>' +
    '<div class="j-actions">' + (j.ready === null ? '' : '<span class="ready">' + th('e07.ready', { n: j.ready }) + '</span>') +
    '<button class="btn small" type="button" data-soon="1">' + esc(t('e07.change_dest')) + '</button></div></div>' +
    '<div class="chart"><svg viewBox="0 0 1000 300" preserveAspectRatio="none" aria-hidden="true">' +
      '<path d="' + dashed + '" class="line dash"/><path d="' + solid + '" class="line solid"/></svg>' + marks + goal + '</div></section>';
}

// ---------- Bottom row ----------

function skillsHTML(d) {
  const rows = d.skills.map(function (s) {
    const bar = s.met
      ? '<i class="v met" style="width:' + s.value + '%"></i>'
      : '<i class="v" style="width:' + s.value + '%"></i><i class="gap" style="inset-inline-start:' + s.value + '%;width:' + (s.target - s.value) + '%"></i>';
    return '<div class="skill"><div class="sk-top"><b>' + esc(dt(s.skill)) + '</b><span dir="ltr">' + s.value + ' / ' + s.target + '</span>' +
      (s.met ? '<em>' + esc(t('e07.target_met')) + '</em>' : '') + '</div><div class="sk-bar">' + bar + '</div></div>';
  }).join('');
  return '<section class="card"><h2>' + esc(t('e07.skills')) + '</h2>' + rows + '</section>';
}

function learningHTML(d) {
  const m = d.learning.module;
  const mod = m ? '<div class="lrn mod"><div class="lrn-top"><b>' + esc(dt(m.title)) + '</b><span class="mono violet">' + th('e07.module', { a: m.seq, b: m.total }) + '</span></div>' +
    '<p>' + esc(dt(m.description)) + '</p><div class="mbar"><div class="bar"><i style="width:' + m.progress + '%"></i></div><span dir="ltr">' + m.progress + '%</span></div></div>' : '';
  const items = d.learning.items.map(function (i) {
    return '<div class="lrn"><b>' + esc(dt(i.title)) + '</b><p>' + esc(learnDetail(i.detail)) + '</p></div>';
  }).join('');
  return '<section class="card"><h2>' + esc(t('e07.learning')) + '</h2>' + mod + items + '</section>';
}
function learnDetail(text) {
  let m = /^Live cohort starts (\d+) ([A-Za-z]{3})$/.exec(text);
  if (m) { return tf('e07.cohort', { day: m[1], month: t('month.' + (MONTHS.indexOf(m[2].toUpperCase()) + 1)) }); }
  m = /^On-demand course \(estimated (\d+) hours\)$/.exec(text);
  if (m) { return tf('e07.on_demand', { n: m[1] }); }
  return dt(text);
}

function mentorsHTML(d) {
  const rows = d.mentors.map(function (m, i) {
    return '<div class="mentor"><span class="avatar c' + i + '" dir="ltr">' + esc(m.initials) + '</span><div><b><bdi>' + esc(m.name) + '</bdi></b><small>' + esc(dt(m.job_title)) + '</small></div></div>';
  }).join('');
  return '<section class="card"><h2>' + esc(t('e07.mentors')) + '</h2>' + (rows || '<p class="empty">' + esc(t('e07.no_mentors')) + '</p>') + '</section>';
}

function projectsHTML(d) {
  const rows = d.projects.map(function (p) {
    return '<div class="proj"><div><b>' + esc(dt(p.title)) + '</b><small>' + esc(dt(p.sub)) + '</small></div><a href="marketplace.html">' + esc(t('e07.view')) + '</a></div>';
  }).join('');
  return '<section class="card"><h2>' + esc(t('e07.projects')) + '</h2>' + (rows || '<p class="empty">' + esc(t('e07.no_projects')) + '</p>') + '</section>';
}

// ---------- Draft a note (nothing is sent) ----------

function wire() {
  const b = document.getElementById('draft');
  if (!b) { return; }
  b.addEventListener('click', async function () {
    const r = await api('employee/growth.php', { action: 'draft_note' });
    if (r.status !== 200 || !r.data.ok) { showToast(t('e07.error')); return; }
    const text = tf(r.data.project ? 'e07.note_text' : 'e07.note_text_plain', { manager: r.data.manager || '', project: r.data.project ? dt(r.data.project) : '', gap: gapWord(r.data.gap || '') });
    document.getElementById('draft-box').innerHTML = '<textarea id="note" rows="5">' + esc(text) + '</textarea>' +
      '<div class="note-actions"><small>' + esc(t('e07.note_hint')) + '</small><button type="button" class="btn small" id="copy">' + esc(t('e07.copy')) + '</button></div>';
    document.getElementById('copy').addEventListener('click', function () {
      const area = document.getElementById('note');
      area.select();
      try { navigator.clipboard.writeText(area.value); } catch (e) { document.execCommand('copy'); }
      showToast(t('e07.copied'));
    });
  });
}
