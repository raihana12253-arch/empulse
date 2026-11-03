// =====================================================================
// e04-innovation-dna.js — E04 My Innovation DNA (pages/employee/innovation-dna.html)
// The data comes from server/api/employee/innovation.php. The company median is a total of all
// people (never one person's row). The signature name is a RULE on the two strongest traits.
// =====================================================================

document.addEventListener('DOMContentLoaded', function () {
  startEmployeePage({ active: 'innovation_dna', api: 'employee/innovation.php', crumb: 'e04.crumb', render: render });
});

// The six steps every idea follows.
const IDEA_STEPS = ['idea', 'analysis', 'approval', 'team', 'build', 'impact'];

function render(d) {
  const traits = d.traits;
  const weakest = traits.filter(function (x) { return x.key === d.signature.weakest; })[0];
  document.querySelector('main').innerHTML =
    '<header class="page-header"><div class="copy"><h1>' + esc(t('e04.title')) + '</h1><p>' + esc(t('e04.subtitle')) + '</p></div>' +
      '<div class="actions">' +
        '<button class="btn" type="button" data-soon="1">' + ICONS.user + '<span>' + esc(tf('e04.grow_button', { trait: t('dnal.' + weakest.key) })) + '</span></button>' +
        '<button class="btn primary" type="button" data-soon="1">' + ICONS.spark + '<span>' + esc(t('e04.explore')) + '</span></button>' +
      '</div></header>' +
    '<div class="dashboard">' +
      '<div class="row row-dna">' + dnaCardHTML(d) + signatureCardHTML(d) + '</div>' +
      '<div class="row row-insights">' + strengthCardHTML(d) + opportunityCardHTML(d, weakest) + '</div>' +
      ideasCardHTML(d) +
    '</div>';
  wire(d);
}


// ---------- Your Innovation DNA ----------

const ROW_HEIGHT = 300 / 7;       // the helix and the list use the same row height

// The helix: one rung for each trait. Even rungs are wide, odd rungs narrow (the strands cross).
// The coloured part of a wide rung grows with the value.
function helixHTML(values) {
  let rungs = '';
  values.forEach(function (value, i) {
    const y = ROW_HEIGHT * i + ROW_HEIGHT / 2;
    const wide = i % 2 === 0;
    const left = wide ? 18 : 84, right = wide ? 182 : 116;
    const reach = left + (right - left) * value / 100;
    rungs += '<line x1="' + left + '" x2="' + right + '" y1="' + y + '" y2="' + y + '" class="rung"/>' +
             '<line x1="' + left + '" x2="' + reach.toFixed(1) + '" y1="' + y + '" y2="' + y + '" class="rung-fill"/>' +
             '<circle cx="' + left + '" cy="' + y + '" r="11" class="dot-a"/><circle cx="' + right + '" cy="' + y + '" r="11" class="dot-b"/>';
  });
  return '<svg viewBox="0 0 200 300" class="helix" aria-hidden="true">' + rungs + '</svg>';
}

function dnaCardHTML(d) {
  return '<section class="card dna-card">' +
    cardHeadHTML(t('e04.dna_title'), esc(t('e04.dna_sub'))) +
    '<div class="tabs" role="tablist">' +
      '<button type="button" class="tab active" data-mode="mine" role="tab" aria-selected="true">' + esc(t('e04.tab_mine')) + '</button>' +
      '<button type="button" class="tab" data-mode="median" role="tab" aria-selected="false">' + esc(t('e04.tab_median')) + '</button></div>' +
    '<div class="dna-body">' + helixHTML(d.traits.map(function (x) { return x.value; })) + '<div class="dna-rows" id="dna-rows">' + rowsHTML(d.traits, 'mine') + '</div></div>' +
  '</section>';
}

// The seven rows: name, bar, number. mode = 'mine' (your values) or 'median' (the company median).
function rowsHTML(traits, mode) {
  return traits.map(function (x) {
    const value = mode === 'mine' ? x.value : x.median;
    return '<div class="dna-row" style="height:' + ROW_HEIGHT.toFixed(2) + 'px"><span>' + esc(t('dna.' + x.key)) + '</span>' +
      '<div class="track"><i class="fill ' + mode + '" style="width:' + value + '%"></i></div><b dir="ltr">' + num(value) + '</b></div>';
  }).join('');
}


// ---------- Your signature ----------

function signatureCardHTML(d) {
  const sig = d.signature;
  const name = th('e04.sig.name', { adjective: t('e04.sig.adj.' + sig.second), noun: t('e04.sig.noun.' + sig.top) });
  // The description: a sentence written for this pair of traits when there is one, else a general sentence.
  const pairKey = 'e04.sig.pair.' + sig.top + '.' + sig.second;
  const body = (texts[pairKey] ? esc(t(pairKey)) : esc(tf('e04.sig.generic', { a: t('e04.sig.top.' + sig.top), b: t('e04.sig.second.' + sig.second) }))) +
    ' ' + esc(tf('e04.sig.next', { next: t('e04.sig.leap.' + sig.weakest) }));
  let growth = '';
  if (d.growth) {
    const label = d.growth.dna ? t('e04.growth_q1') : tf('e04.growth_since', { month: monthName(d.growth.compare || '2026-06-01') });
    const trait = d.growth.dna ? t('dna.' + d.growth.key) : t('crit.' + d.growth.key);
    growth = '<div class="growth"><span class="mono">' + esc(label) + '</span><b dir="auto">' + (d.growth.delta >= 0 ? '+' : '−') + '<bdi dir="ltr">' + Math.abs(d.growth.delta) + '</bdi> ' + esc(trait) + '</b></div>';
  }
  return '<section class="card dark signature">' +
    '<span class="badge violet-on-dark">' + esc(t('e04.signature')) + '</span>' +
    '<span class="sig-icon">' + ICONS.diamond + '</span>' +
    '<h2>' + name + '</h2><p>' + body + '</p>' + growth + '</section>';
}


// ---------- Strength and development opportunity ----------

function strengthCardHTML(d) {
  const order = ['idea_generation', 'problem_solving', 'experimentation', 'collaboration', 'digital_innovation', 'implementation', 'business_impact'];
  // The two strongest traits, listed in the usual order.
  const best = d.traits.slice().sort(function (a, b) { return b.value - a.value; }).slice(0, 2)
    .sort(function (a, b) { return order.indexOf(a.key) - order.indexOf(b.key); });
  const a = best[0], b = best[1];
  const top = Math.max(a.top, b.top);
  const params = { a: t('dna.' + a.key), va: a.value, b: t('dna.' + b.key), vb: b.value, top: top, n: d.strength.cited_by_teams === null ? '' : d.strength.cited_by_teams };
  let body;
  if (top <= 50) {
    body = th(d.strength.cited_by_teams !== null ? 'e04.strength.body_cited' : 'e04.strength.body_top', params);
  } else {
    body = th('e04.strength.body_plain', params);
  }
  const chips = [];
  if (a.top <= 50) { chips.push(badgeHTML(tf('e04.chip_top', { top: a.top, trait: t('dnal.' + a.key) }), 'teal')); }
  chips.push(badgeHTML(tf('e04.chip_ideas', { n: d.strength.submitted }), 'violet'));
  return '<section class="card">' +
    cardHeadHTML(tf('e04.strength.title', { a: t('dnal.' + a.key), b: t('dnal.' + b.key) }), body) +
    '<div class="chips">' + chips.join('') + '</div></section>';
}

function opportunityCardHTML(d, weakest) {
  const impl = weakest.key === 'implementation';
  const title = impl ? t('e04.dev.title_implementation') : tf('e04.dev.title', { trait: t('dnal.' + weakest.key) });
  const below = weakest.value < weakest.median;
  const body = th(below ? (impl ? 'e04.dev.body_implementation' : 'e04.dev.body_below') : 'e04.dev.body_lowest',
                  { trait: t('dna.' + weakest.key), value: weakest.value, median: num(weakest.median) });
  return '<section class="card">' + cardHeadHTML(title, body) +
    '<div class="actions">' +
      '<button class="btn small violet" type="button" data-soon="1">' + esc(t(impl ? 'e04.dev.join' : 'e04.dev.explore')) + '</button>' +
      (impl ? '<button class="btn small" type="button" data-soon="1">' + esc(t('e04.dev.course')) + '</button>' : '') +
    '</div></section>';
}


// ---------- Your ideas, from spark to impact ----------

function ideaSub(i) {
  if (i.status === 'implemented' && i.saving_sar > 0) { return th('e04.idea.saving', { amount: fmtSar(i.saving_sar) }); }
  if ((i.status === 'approved' || i.status === 'in_build') && i.open_role) { return th('e04.idea.team_forming', { role: dt(i.open_role) }); }
  if (i.status === 'draft') { return esc(t('e04.idea.draft_in_lab')); }
  return esc(t('e04.status.' + i.status));
}

function ideasCardHTML(d) {
  const stages = IDEA_STEPS.map(function (key, i) {
    return '<span class="stage' + (i === 5 ? ' last' : '') + '">' + esc(t('e04.stage.' + key)) + '</span>';
  }).join('');
  const kinds = { implemented: 'teal', approved: 'violet', draft: '' };
  const list = d.ideas.map(function (i) {
    return '<div class="idea"><span class="idea-icon ' + (i.status === 'implemented' ? 'teal' : (i.status === 'draft' ? 'grey' : 'violet')) + '">' + ICONS.idea + '</span>' +
      '<div class="idea-text"><span class="mono" dir="ltr">' + esc(i.code) + '</span><b>' + esc(dt(i.title)) + '</b><small>' + ideaSub(i) + '</small></div>' +
      badgeHTML(t('e04.status.' + i.status), kinds[i.status] || '') + '</div>';
  }).join('');
  return '<section class="card">' +
    cardHeadHTML(t('e04.ideas_title'), esc(t('e04.ideas_sub')), actionHTML(t('e04.submit_idea'))) +
    '<div class="stages">' + stages + '</div>' +
    (list ? '<div class="ideas">' + list + '</div>' : '<p class="empty">' + esc(t('e04.ideas_empty')) + '</p>') + '</section>';
}


// ---------- Buttons ----------

function wire(d) {
  // "Your score" / "Organization median": the bars show your values or the company median.
  document.querySelectorAll('.tab').forEach(function (tab) {
    tab.addEventListener('click', function () {
      document.querySelectorAll('.tab').forEach(function (other) {
        other.classList.toggle('active', other === tab);
        other.setAttribute('aria-selected', String(other === tab));
      });
      document.getElementById('dna-rows').innerHTML = rowsHTML(d.traits, tab.dataset.mode);
    });
  });
}
