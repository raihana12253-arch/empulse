// =====================================================================
// e11-settings.js — E11 Settings (pages/employee/settings.html)
// Data: server/api/employee/settings.php. Toggles are saved at once. "Share my tier" is required and cannot be switched off.
// =====================================================================

document.addEventListener('DOMContentLoaded', function () {
  startEmployeePage({ active: 'settings', api: 'employee/settings.php', crumb: 'e11.crumb', render: render });
});

let D = null;
const ORDER = ['task_completion', 'attendance_discipline', 'professional_behavior', 'innovation_creativity', 'teamwork', 'technology_adoption', 'job_burnout'];

function toggleRow(key, label, on, locked, note) {
  return '<div class="trow"><div><span>' + label + '</span>' + (note ? '<small>' + esc(note) + '</small>' : '') + '</div>' +
    '<button type="button" class="switch' + (on ? ' on' : '') + (locked ? ' locked' : '') + '" role="switch" aria-checked="' + (on ? 'true' : 'false') + '" data-key="' + key + '"' +
    (locked ? ' disabled' : '') + ' aria-label="' + esc(label.replace(/<[^>]+>/g, '')) + '"><i></i></button></div>';
}

function render(d) {
  D = d;
  const s = d.settings, mgr = d.manager ? d.manager.split(' ')[0] : t('e07.your_manager');
  const weights = {};
  d.weights.forEach(function (w) { weights[w.key] = w.weight; });
  const bars = ORDER.map(function (k) {
    return '<div class="wrow"><span>' + esc(t('crit.' + k)) + '</span><span class="track"><i style="width:' + Math.round(weights[k] / 25 * 100) + '%"></i></span><b dir="ltr">' + weights[k] + '%</b></div>';
  }).join('');
  const who = function (name, text) { return '<li><span class="pawn">' + ICONS.person + '</span><div><b>' + name + '</b><small>' + esc(text) + '</small></div></li>'; };
  document.querySelector('main').innerHTML =
    '<header class="page-header"><div class="copy"><h1>' + esc(t('e11.title')) + '</h1><p>' + esc(t('e11.subtitle')) + '</p></div></header>' +
    '<div class="dashboard"><div class="set-top">' +
      '<section class="card"><div class="ch">' + ICONS.pulse + '<div><h2>' + esc(t('e11.privacy')) + '</h2><p class="sub teal">' + esc(t('e11.privacy_sub')) + '</p></div></div>' +
        '<div class="toggles">' +
        toggleRow('share_wellbeing', th('e11.t_wellbeing', { name: mgr }), !!s.share_wellbeing, false) +
        toggleRow('share_tier', esc(t('e11.t_tier')), true, true, t('e11.t_tier_note')) +
        toggleRow('public_recognition', esc(t('e11.t_public')), !!s.public_recognition, false) +
        toggleRow('pulseai_suggest', esc(t('e11.t_suggest')), !!s.pulseai_suggest, false) +
        toggleRow('weekly_digest', esc(t('e11.t_digest')), !!s.weekly_digest, false) +
        '</div></section>' +
      '<section class="card"><div class="ch">' + ICONS.pulse + '<h2>' + esc(t('e11.who')) + '</h2></div><ul class="who">' +
        who(esc(t('e11.you')), t('e11.you_t')) +
        (d.manager ? who('<bdi>' + esc(d.manager) + '</bdi> (' + esc(t('e11.manager')) + ')', t('e11.manager_t')) : '') +
        (d.hr_partner ? who('<bdi>' + esc(d.hr_partner) + '</bdi> (' + esc(t('e11.hr')) + ')', t('e11.hr_t')) : '') +
        who(esc(t('e11.colleagues')), t('e11.colleagues_t')) + '</ul>' +
        '<a class="dlall" href="#" id="export">' + ICONS.download + esc(t('e11.download')) + '</a></section></div>' +
      '<section class="card"><div class="ch">' + ICONS.pulse + '<div><h2>' + esc(t('e11.calc')) + '</h2><p class="sub teal">' + esc(t('e11.calc_sub')) + '</p></div></div>' +
        '<div class="weights">' + bars + '</div><p class="note faint">' + esc(t('e11.calc_note')) + '</p></section></div>';
  document.querySelector('.toggles').addEventListener('click', async function (e) {
    const b = e.target.closest('.switch');
    if (!b || b.disabled) { return; }
    const on = !b.classList.contains('on');
    b.classList.toggle('on', on); b.setAttribute('aria-checked', on ? 'true' : 'false');
    const r = await api('employee/settings.php', { key: b.getAttribute('data-key'), value: on ? 1 : 0 });
    if (r.status === 200 && r.data && r.data.ok) { showToast(t('e11.saved')); }
    else { b.classList.toggle('on', !on); showToast(t('shell.error_load')); }
  });
  document.getElementById('export').addEventListener('click', async function (e) {
    e.preventDefault();
    const r = await fetch(APP + 'server/api/employee/settings.php?export=1', { credentials: 'same-origin' });
    if (!r.ok) { showToast(t('shell.error_load')); return; }
    const blob = await r.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'empulse-my-data.json';
    document.body.appendChild(a); a.click(); a.remove();
  });
}
