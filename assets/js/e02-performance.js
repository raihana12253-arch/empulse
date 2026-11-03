// =====================================================================
// e02-performance.js — E02 My Performance (pages/employee/performance.html)
// The data comes from server/api/employee/performance.php.
// The tier planner (sliders) is a private "what if": nothing is saved or shared.
// =====================================================================

document.addEventListener('DOMContentLoaded', function () {
  startEmployeePage({ active: 'performance', api: 'employee/performance.php', crumb: 'e02.crumb', render: render });
});

function render(d) {
  document.querySelector('main').innerHTML =
    '<header class="page-header"><div class="copy"><h1>' + esc(t('e02.title')) + '</h1><p>' + esc(t('e02.subtitle')) + '</p></div>' +
      '<div class="actions">' +
        '<button class="btn" type="button" data-soon="1">' + ICONS.user + '<span>' + esc(t('e02.share_manager')) + '</span></button>' +
        '<button class="btn primary" type="button" id="explain">' + ICONS.spark + '<span>' + esc(t('e02.explain')) + '</span></button>' +
      '</div></header>' +
    '<div class="dashboard">' +
      '<div class="row row-calc">' +
        '<div class="column">' + tierCardHTML(d.score, d.compare_month) +
          '<div class="card note-card"><span class="ok">' + ICONS.check + '</span><p>' + esc(t('e02.tier_privacy')) + '</p></div></div>' +
        calcCardHTML(d) +
      '</div>' +
      '<div class="row row-identity">' + identityCardHTML(d) + journeyCardHTML(d) + '</div>' +
      trendsCardHTML(d) +
      plannerCardHTML(d) +
    '</div>';
  wirePlanner(d);
  document.getElementById('explain').addEventListener('click', function () {
    const card = document.getElementById('calc');
    card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    card.classList.add('flash');
    setTimeout(function () { card.classList.remove('flash'); }, 1600);
  });
  // A link such as performance.html#planner opens at that card.
  if (window.location.hash) {
    const target = document.getElementById(window.location.hash.slice(1));
    if (target) { target.scrollIntoView(); }
  }
}


// ---------- How was my score calculated? ----------

function calcCardHTML(d) {
  return '<section class="card" id="calc">' +
    cardHeadHTML(t('e02.calc_title'), esc(t('e02.calc_sub')), actionHTML(t('e02.see_weights'))) +
    calcBodyHTML(d.score, d.burnout_risk) + '</section>';
}


// ---------- Professional identity and score journey ----------

function identityCardHTML(d) {
  const s = d.score;
  const change = s.change === null ? '' : '<span class="chip-up" dir="ltr">' + (s.change >= 0 ? '↑ +' : '↓ −') + Math.abs(s.change) + '</span>';
  const badges = d.badges.map(function (b) {
    return '<span class="badge ' + (b === 'Innovation Champion' ? 'violet' : 'teal') + '">' + esc(t('recog.' + b)) + '</span>';
  }).join('');
  return '<section class="card dark identity-card">' +
    '<div class="identity-score"><b dir="ltr">' + s.rounded + '</b>' + change + '</div>' +
    '<span class="mono tier-word">' + esc(tierName(s.tier)) + '</span>' +
    '<h2>' + esc(t('tier.summary.' + s.tier)) + '</h2>' +
    (badges ? '<div class="badges">' + badges + '</div>' : '') +
    '<p>' + esc(t('e02.identity_text')) + '</p></section>';
}

function journeyCardHTML(d) {
  const j = d.journey;
  const first = j[0], last = j[j.length - 1];
  const gain = last.empulse_score - first.empulse_score;
  const low = Math.min.apply(null, j.map(function (x) { return x.empulse_score; })) - 6;
  const high = Math.max.apply(null, j.map(function (x) { return x.empulse_score; }));
  const bars = j.map(function (x, i) {
    const height = 28 + (x.empulse_score - low) / (high - low) * 80;
    const now = i === j.length - 1;
    return '<div class="bar-col"><b dir="ltr">' + x.empulse_score + '</b><i class="' + (now ? 'now' : '') + '" style="height:' + Math.round(height) + 'px"></i>' +
      '<span class="mono">' + esc(t('month.' + Number(x.month.slice(5, 7)))) + '</span></div>';
  }).join('');
  const best = last.empulse_score >= d.best_score ? t('e02.best_today') : tf('e02.best_was', { n: d.best_score });
  const sub = th('e02.journey_sub', { gain: (gain >= 0 ? '+' : '−') + Math.abs(gain), month: monthName(first.month), best: best });
  return '<section class="card">' + cardHeadHTML(t('e02.journey_title'), sub) +
    '<div class="bars">' + bars + '</div>' + tierBandHTML(d.score.rounded, d.score.tier) + '</section>';
}


// ---------- Dimension trends ----------

function trendsCardHTML(d) {
  const items = d.trends.map(function (x) {
    return '<span class="trend"><span>' + esc(t('crit.' + x.key)) + ':</span> <b dir="ltr">' + x.score + '</b> ' +
      '<i class="arrow ' + x.arrow + '">' + arrowOf(x.arrow) + '</i></span>';
  }).join('<span class="dotsep">·</span>');
  return '<section class="card">' +
    cardHeadHTML(t('e02.trends_title'), th('e02.trends_sub', { first: monthName(d.journey[0].month), compare: monthName(d.compare_month) })) +
    '<div class="trends">' + items + '</div></section>';
}


// ---------- Tier planner ----------

function plannerCardHTML(d) {
  const next = d.score.next;
  const goal = next ? tierName(next.key) : tierName(d.score.tier);
  const rows = d.planner.map(function (item, i) {
    return '<div class="slider-row"><div class="slider-top"><span>' + esc(t('crit.' + item.key)) + '</span>' +
      '<span class="mono" dir="ltr" id="slider-text-' + i + '"></span></div>' +
      '<input type="range" class="slider" id="slider-' + i + '" min="' + item.from + '" max="100" value="' + item.to + '" ' +
      'aria-label="' + esc(t('crit.' + item.key)) + '"></div>';
  }).join('');
  let advice = '';
  if (d.advice) {
    advice = '<div class="advice"><span class="advice-icon">' + ICONS.spark + '</span><p>' +
      th('e02.advice', { gain: d.advice.gain, points: d.advice.points.toFixed(2) }) + '</p>' +
      (d.advice.idea ? '<button class="btn small violet" type="button" data-soon="1">' + esc(tf('e02.join', { title: dt(d.advice.idea) })) + '</button>' : '') + '</div>';
  }
  return '<section class="card planner" id="planner">' +
    '<div class="card-head"><div class="copy"><h2>' + esc(tf('e02.planner_title', { tier: goal })) + '</h2><p class="sub">' + esc(t('e02.planner_sub')) + '</p></div>' +
      '<button class="btn small" type="button" id="planner-reset">' + ICONS.reset + '<span>' + esc(t('e02.reset')) + '</span></button></div>' +
    '<div class="planner-body"><div class="sliders">' + rows + '</div>' +
      '<div class="projection" id="projection"></div></div>' +
    tierBandHTML(d.score.rounded, d.score.tier) + advice + '</section>';
}

function wirePlanner(d) {
  const s = d.score;
  function update() {
    let exact = s.exact;
    d.planner.forEach(function (item, i) {
      const to = Number(document.getElementById('slider-' + i).value);
      const points = (to - item.from) * item.weight / 100;
      exact += points;
      document.getElementById('slider-text-' + i).textContent =
        item.from + ' → ' + to + ' · ' + (points >= 0 ? '+' : '−') + Math.abs(points).toFixed(2) + ' ' + t('e02.score_points');
    });
    exact = Math.round(exact * 100) / 100;
    const rounded = Math.round(exact);
    // The tier of the projected score, from the limits in server/config.php.
    let tier = d.tier_limits[d.tier_limits.length - 1].key;
    for (let k = 0; k < d.tier_limits.length; k++) {
      if (rounded >= d.tier_limits[k].min) { tier = d.tier_limits[k].key; break; }
    }
    const nextAbove = d.tier_limits.filter(function (x) { return x.min > rounded; }).pop();
    const badge = nextAbove ? th('tier.points_to', { n: nextAbove.min - rounded, tier: tierName(nextAbove.key) }) : esc(t('e02.top_reached'));
    document.getElementById('projection').innerHTML =
      '<span class="mono small">' + esc(t('e02.projected')) + '</span><b class="big" dir="ltr">' + rounded + '</b>' +
      '<span class="mono tier-word ' + tier + '">' + esc(tierName(tier)) + '</span>' +
      '<span class="badge teal">' + badge + '</span>' +
      '<span class="mono small" dir="ltr">' + th('e02.exact', { exact: exact.toFixed(2), n: rounded }) + '</span>';
  }
  d.planner.forEach(function (item, i) {
    document.getElementById('slider-' + i).addEventListener('input', update);
  });
  document.getElementById('planner-reset').addEventListener('click', function () {
    d.planner.forEach(function (item, i) { document.getElementById('slider-' + i).value = item.to; });
    update();
  });
  update();
}
