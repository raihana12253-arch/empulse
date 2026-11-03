// =====================================================================
// e05-innovation-lab.js — E05 Innovation Lab (pages/employee/innovation-lab.html)
// The data comes from server/api/employee/innovation_lab.php (my newest draft idea).
// The ROI is calculated in the browser while you type (savings ÷ cost); PulseAI's own estimate is saved with the draft.
// Rules: you stay the author; nothing is sent to the Innovation Council until you press Submit.
// =====================================================================

document.addEventListener('DOMContentLoaded', function () {
  startEmployeePage({ active: 'innovation_lab', api: 'employee/innovation_lab.php', crumb: 'e05.crumb', render: render });
});

const STEPS = ['idea', 'analysis', 'council', 'team', 'build', 'impact'];
const DIMS = ['novelty', 'feasibility', 'value', 'impact'];
const UP_ARROW = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17 17 7M8 7h9v9"/></svg>';
const UPLOAD = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V5M7.5 9.5 12 5l4.5 4.5M5 19h14"/></svg>';
const FILE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="5.5"/><path d="m15.5 15.5 4 4"/></svg>';

let draft = null;

function render(d) {
  draft = d.draft || { title: '', problem: '', solution: '', benefit: '', cost: 0, savings: 0, weeks: 8, roi: null,
                       scores: {}, readiness: null, analysis: {}, tips: [], estimate: null, evidence: [], saved_at: null };
  const weeks = draft.weeks;
  document.querySelector('main').innerHTML =
    '<header class="page-header"><div class="copy"><h1>' + esc(t('e05.title')) + '</h1><p>' + esc(t('e05.subtitle')) + '</p></div>' +
      '<div class="actions">' +
        '<a class="btn" href="innovation-dna.html">' + ICONS.user + '<span>' + th('e05.my_ideas', { n: d.my_ideas }) + '</span></a>' +
        '<button class="btn primary" type="button" id="shape">' + ICONS.spark + '<span>' + esc(t('e05.shape')) + '</span></button>' +
      '</div></header>' +
    '<div class="dashboard">' + stepsHTML(weeks) +
      '<div class="lab-layout"><div class="lab-form">' + sparkHTML() + valueHTML() + evidenceHTML() + '</div>' +
      '<aside class="lab-side">' + analysisHTML() + scoresHTML() + roiHTML() + tipsHTML() + '</aside></div></div>';
  wire();
}

function stepsHTML(weeks) {
  const subs = [t('e05.here'), t('e05.live'), t('e05.days'), t('e05.marketplace'), tf('e05.weeks', { n: weeks }), t('e05.monthly')];
  return '<nav class="steps card">' + STEPS.map(function (s, i) {
    return '<div class="step' + (i === 0 ? ' on' : '') + '"><b>0' + (i + 1) + ' · ' + esc(t('e05.step_' + s)) + '</b><small>' + esc(subs[i]) + '</small></div>';
  }).join('') + '</nav>';
}

function field(id, label, value, tag, rows) {
  const control = tag === 'textarea'
    ? '<textarea id="' + id + '" rows="' + rows + '" maxlength="400">' + esc(value) + '</textarea>'
    : '<input id="' + id + '" type="text" value="' + esc(value) + '" maxlength="300">';
  return '<label class="field" for="' + id + '"><span>' + esc(label) + '</span>' + control + '</label>';
}

function sparkHTML() {
  return '<section class="card"><h2>1 · ' + esc(t('e05.spark')) + '</h2>' +
    field('f-title', t('e05.f_name'), dt(draft.title), 'input') +
    field('f-problem', t('e05.f_problem'), dt(draft.problem), 'textarea', 3) +
    field('f-solution', t('e05.f_solution'), dt(draft.solution), 'textarea', 3) +
    field('f-benefit', t('e05.f_benefit'), dt(draft.benefit), 'input') + '</section>';
}

function sarText(n) { return 'SAR ' + Number(n).toLocaleString('en-US'); }

function valueHTML() {
  return '<section class="card"><h2>2 · ' + esc(t('e05.value')) + '</h2><div class="three">' +
    '<label class="field" for="f-cost"><span>' + esc(t('e05.f_cost')) + '</span><input id="f-cost" type="text" inputmode="numeric" dir="ltr" value="' + esc(sarText(draft.cost)) + '"></label>' +
    '<label class="field" for="f-savings"><span>' + esc(t('e05.f_savings')) + '</span><input id="f-savings" type="text" inputmode="numeric" dir="ltr" value="' + esc(sarText(draft.savings)) + '"></label>' +
    '<label class="field" for="f-weeks"><span>' + esc(t('e05.f_weeks')) + '</span><input id="f-weeks" type="text" inputmode="numeric" value="' + esc(tf('e05.weeks', { n: draft.weeks })) + '"></label></div>' +
    '<div class="roi-band"><span>' + esc(t('e05.expected_roi')) + '</span><b dir="ltr" id="roi-big">' + roiText(draft.roi) + '</b><small class="mono">' + esc(t('e05.auto')) + '</small></div></section>';
}

function roiText(v) { return v === null || !isFinite(v) ? '—' : (Math.round(v * 100) / 100) + '×'; }

function evidenceHTML() {
  const files = draft.evidence.map(function (f) {
    return '<span class="file">' + FILE + '<span>' + esc(f.file_name) + (f.size_label ? ' · <span dir="ltr">' + esc(f.size_label) + '</span>' : '') + '</span></span>';
  }).join('');
  const saved = draft.saved_at ? th('e05.saved_at', { date: fmtDate(draft.saved_at), time: draft.saved_at.slice(11, 16) }) : esc(t('e05.not_saved'));
  return '<section class="card"><h2>3 · ' + esc(t('e05.evidence')) + '</h2>' +
    '<div class="drop" id="drop">' + UPLOAD + '<b>' + esc(t('e05.drop')) + '</b><small>' + esc(t('e05.drop_sub')) + '</small></div>' +
    '<div class="files">' + files + '</div><p class="form-error" id="lab-error" hidden></p>' +
    '<div class="lab-foot"><span class="saved" id="saved">' + saved + '</span><div class="actions">' +
      '<button class="btn" type="button" id="save">' + esc(t('e05.save')) + '</button>' +
      '<button class="btn primary" type="button" id="submit">' + esc(t('e05.submit')) + '</button></div></div></section>';
}

// ---------- PulseAI side ----------

function levelOf(score) { return score >= 75 ? 'strong' : (score >= 60 ? 'promising' : 'early'); }

function analysisHTML() {
  const r = draft.readiness;
  const ring = r === null ? '' : '<svg viewBox="0 0 100 100" class="ring"><circle cx="50" cy="50" r="44" class="ring-bg"/><circle cx="50" cy="50" r="44" class="ring-fg" ' +
    'stroke-dasharray="' + (2 * Math.PI * 44 * r / 100).toFixed(1) + ' 999" transform="rotate(-90 50 50)"/></svg>';
  const level = r === null ? '' : levelOf(r);
  return '<section class="card dark ai"><div class="ai-top"><h2>' + ICONS.spark + esc(t('e05.ai_title')) + '</h2><span class="upd">' + esc(t('e05.updating')) + '</span></div>' +
    '<div class="ai-body"><div class="ring-wrap">' + ring + '<b dir="ltr">' + (r === null ? '—' : r) + '</b></div><div><h3>' +
    (r === null ? esc(t('e05.no_analysis')) : esc(tf('e05.readiness', { level: t('e05.lvl_' + level) }))) + '</h3><p>' + esc(t(r === null ? 'e05.no_analysis_sub' : 'e05.lvl_text_' + level)) + '</p></div></div></section>';
}

function scoresHTML() {
  return '<section class="card scores">' + DIMS.map(function (k) {
    const v = draft.scores[k];
    const note = draft.analysis[k];
    return '<div class="score"><div class="score-top"><b>' + esc(t('e05.d_' + k)) + '</b><span dir="ltr">' + (v === null || v === undefined ? '—' : v) + '</span></div>' +
      '<div class="bar"><i style="width:' + (v || 0) + '%"></i></div>' + (note ? '<p>' + esc(dt(note)) + '</p>' : '') + '</div>';
  }).join('') + '</section>';
}

function roiHTML() {
  const e = draft.estimate;
  return '<section class="card"><h2>' + esc(t('e05.your_roi')) + '</h2><div class="two">' +
    '<div class="roi-tile teal"><span>' + esc(t('e05.your_roi')) + '</span><b dir="ltr" id="roi-mine">' + roiText(draft.roi) + '</b></div>' +
    '<div class="roi-tile violet"><span>' + esc(t('e05.ai_estimate')) + '</span><b dir="ltr">' + (e ? roiText(e.value) : '—') + '</b>' +
      (e ? '<small class="mono" dir="ltr">' + e.low + '× – ' + e.high + '×</small>' : '') + '</div></div>' +
    (e ? '<p class="note">' + th('e05.roi_note', { weeks: e.ramp_weeks, cost: fmtSar(e.ramp_cost), pct: e.adoption }) + '</p>' : '') + '</section>';
}

function tipsHTML() {
  if (!draft.tips.length) { return ''; }
  return '<section class="card tips"><h2>' + esc(t('e05.strengthen')) + '</h2>' +
    draft.tips.map(function (tip) { return '<p><i>' + UP_ARROW + '</i><span>' + esc(dt(tip)) + '</span></p>'; }).join('') + '</section>';
}

// ---------- Actions ----------

function digits(id) { return Number((document.getElementById(id).value || '').replace(/[^\d]/g, '')) || 0; }

function recalc() {
  const cost = digits('f-cost'), savings = digits('f-savings');
  const roi = cost > 0 ? savings / cost : null;
  document.getElementById('roi-big').textContent = roiText(roi);
  document.getElementById('roi-mine').textContent = roiText(roi);
}

function collect() {
  return { title: document.getElementById('f-title').value.trim(), problem: document.getElementById('f-problem').value.trim(),
           solution: document.getElementById('f-solution').value.trim(), benefit: document.getElementById('f-benefit').value.trim(),
           cost: digits('f-cost'), savings: digits('f-savings'), weeks: digits('f-weeks') };
}

async function store(action) {
  const error = document.getElementById('lab-error');
  const body = collect();
  body.action = action;
  if (!body.title) { error.textContent = t('e05.err_title'); error.hidden = false; return; }
  if (action === 'submit' && (!body.problem || !body.solution)) { error.textContent = t('e05.err_incomplete'); error.hidden = false; return; }
  if (body.weeks < 1 || body.weeks > 104) { error.textContent = t('e05.err_weeks'); error.hidden = false; return; }
  error.hidden = true;
  const r = await api('employee/innovation_lab.php', body);
  if (r.status !== 200 || !r.data.ok) { error.textContent = t('e05.err_server'); error.hidden = false; return; }
  if (action === 'submit') { showToast(t('e05.submitted')); render(r.data); return; }
  showToast(t('e05.saved_toast'));
  document.getElementById('saved').textContent = t('e05.saved_now');
}

function wire() {
  ['f-cost', 'f-savings'].forEach(function (id) {
    const el = document.getElementById(id);
    el.addEventListener('input', recalc);
    el.addEventListener('blur', function () { el.value = sarText(digits(id)); });
  });
  const weeks = document.getElementById('f-weeks');
  weeks.addEventListener('blur', function () { weeks.value = tf('e05.weeks', { n: digits('f-weeks') }); });
  document.getElementById('save').addEventListener('click', function () { store('save'); });
  document.getElementById('submit').addEventListener('click', function () { store('submit'); });
  document.getElementById('shape').addEventListener('click', function () { document.getElementById('f-problem').focus(); showToast(t('e05.shape_hint')); });
  document.getElementById('drop').addEventListener('click', function () { showToast(t('e05.upload_later')); });
}
