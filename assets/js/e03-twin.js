// =====================================================================
// e03-twin.js — E03 My Digital Twin (pages/employee/twin.html)
// The data comes from server/api/employee/twin.php. Strengths, risks, next steps and the
// "did it work?" answer are RULES on the stored data (see the PHP file): no language model.
// =====================================================================

document.addEventListener('DOMContentLoaded', function () {
  startEmployeePage({ active: 'twin', api: 'employee/twin.php', crumb: 'e03.crumb', render: render });
});

// The eight chapters of the page: [text key, id of the section].
const CHAPTERS = [['who', 'who'], ['score', 'doing'], ['tier', 'why'], ['why', 'changed'],
                  ['strengths', 'strengths'], ['risks', 'risks'], ['grow', 'grow'], ['worked', 'worked']];

function render(d) {
  document.querySelector('main').innerHTML =
    '<header class="page-header"><div class="copy"><h1>' + esc(t('e03.title')) + '</h1><p>' + esc(t('e03.subtitle')) + '</p></div>' +
      '<div class="actions">' +
        '<button class="btn" type="button" id="download">' + ICONS.download + '<span>' + esc(t('e03.download')) + '</span></button>' +
        '<button class="btn primary" type="button" data-soon="1">' + ICONS.spark + '<span>' + esc(t('e03.ask_twin')) + '</span></button>' +
      '</div></header>' +
    '<div class="dashboard">' +
      chaptersHTML() +
      '<div class="row row-who" id="who">' + whoCardHTML(d) + tierCardHTML(d.score, d.compare_month) + '</div>' +
      doingCardHTML(d) +
      '<div class="row row-why" id="why">' + whyCardHTML(d) + profileCardHTML(d) + '</div>' +
      changedCardHTML(d) +
      '<div class="row row-three">' + strengthsCardHTML(d) + developmentCardHTML(d) + risksCardHTML(d) + '</div>' +
      growCardHTML(d) +
      stepsCardHTML(d) +
      workedCardHTML(d) +
    '</div>';
  wire(d);
}


// ---------- The eight chapters ----------

function chaptersHTML() {
  const items = CHAPTERS.map(function (c, i) {
    return '<a class="chapter' + (i === 0 ? ' active' : '') + '" href="#' + c[1] + '" data-target="' + c[1] + '">' +
      '<span class="chapter-no" dir="ltr">' + (i + 1) + '</span><span>' + esc(t('e03.chapter.' + c[0])) + '</span></a>';
  }).join('');
  return '<nav class="chapters card" aria-label="' + esc(t('e03.chapters_aria')) + '">' + items + '</nav>';
}


// ---------- 1. Who ----------

function whoCardHTML(d) {
  const w = d.who;
  const badges = w.badges.map(function (b) {
    return '<span class="badge ' + (b === 'Innovation Champion' ? 'violet' : 'teal') + '">' + esc(t('recog.' + b)) + '</span>';
  }).join('');
  return '<section class="card who-card">' +
    '<div class="who-top"><span class="avatar big" dir="ltr">' + esc(w.initials) + '</span><div class="who-text">' +
      '<h2>' + esc(w.name) + '</h2>' +
      '<p>' + esc(dt(w.job_title)) + ' · ' + esc(dt(w.team)) + '</p>' +
      '<p class="muted">' + th('e03.tenure', { years: num(w.tenure_years), manager: w.manager_name }) + '</p></div></div>' +
    (badges ? '<div class="badges">' + badges + '</div>' : '') +
    '<div class="sync"><span class="sync-icon">' + ICONS.reset + '</span><span class="mono">' + esc(t('e03.synced')) + '</span></div>' +
  '</section>';
}


// ---------- 2. How am I doing right now? ----------

function doingCardHTML(d) {
  const doing = d.doing;
  const s = d.score;
  const trend = s.change === null || s.change === 0 ? 'steady' : (s.change > 0 ? 'rising' : 'falling');
  const sub = th('e03.doing_sub', { summary: t('tier.summary.' + s.tier), tier: tierName(s.tier), trend: t('e03.trend.' + trend),
                                    risk: t('e03.riskphrase.' + doing.risk.level) });
  const strongest = '<div class="tile teal"><span class="mono">' + esc(t('e03.strongest')) + '</span><b>' +
    th('e03.area_value', { name: t('crit.' + doing.strongest.key), score: doing.strongest.score }) + '</b></div>';
  const oppKey = 'e03.opportunity_text.' + (doing.opportunity.key === 'innovation_creativity' ? 'innovation_creativity' : 'other');
  const opportunity = '<div class="tile violet"><span class="mono">' + esc(t('e03.opportunity')) + '</span><b>' +
    th('e03.area_value', { name: t('crit.' + doing.opportunity.key), score: doing.opportunity.score }) + '</b><small>' + esc(t(oppKey)) + '</small></div>';
  const best = s.rounded >= d.best_score ? t('e03.personal_best') : tf('e03.best_was', { n: d.best_score });
  const gold = s.next ?
    '<div class="tile dark"><b class="big" dir="ltr">' + s.next.points + '</b><span>' + th('e03.points_to_label', { tier: tierName(s.next.key) }) + '</span><small class="mint">' + esc(best) + '</small></div>' :
    '<div class="tile dark"><b class="big">✓</b><span>' + esc(t('e03.top_tier')) + '</span></div>';
  const line = d.pulse.map(function (p) {
    const kind = p.before === null || p.before === p.now ? 'same' : (p.now > p.before ? 'up' : 'down');
    return '<span>' + esc(t('crit.' + p.key)) + ' <b dir="ltr">' + p.now + '</b> <i class="arrow ' + kind + '">' + arrowOf(kind) + '</i></span>';
  }).join('<span class="dotsep">·</span>');
  const risk = doing.risk;
  const ok = risk.level === 'low';
  const status = '<div class="risk-status ' + (ok ? 'ok' : 'warn') + '"><span class="ok-icon">' + (ok ? ICONS.check : ICONS.bell) + '</span><span>' +
    th(ok ? 'e03.risk_ok' : 'e03.risk_warn', { pct: risk.pct, level: t('e03.risk_level.' + risk.level), trend: t('e03.risk_trend.' + risk.trend) }) + '</span></div>';
  return '<section class="card" id="doing">' + cardHeadHTML(t('e03.doing_title'), sub) +
    '<div class="summary">' + strongest + opportunity + gold + '</div>' +
    '<div class="pulse-line">' + line + '</div>' + status + '</section>';
}


// ---------- 3. Why this score / Pulse profile ----------

function whyCardHTML(d) {
  return '<section class="card">' +
    cardHeadHTML(t('e03.why_title'), esc(t('e03.why_sub')), actionHTML(t('e03.governance'))) +
    calcBodyHTML(d.score, d.doing.risk.pct) + '</section>';
}

function profileCardHTML(d) {
  const fell = d.burnout_june !== null && d.burnout_june - d.doing.risk.pct >= 10;
  const code = d.intervention ? d.intervention.code : null;
  let comment = pulseSummaryText(d.pulse_summary, d.compare_month);
  if (fell) {
    comment += ' ' + (code ? th('e03.pulse_fell_after', { from: d.burnout_june, to: d.doing.risk.pct, code: code })
                           : th('e03.pulse_fell', { from: d.burnout_june, to: d.doing.risk.pct }));
  }
  const badge = fell ? '<span class="badge teal"><i class="dot-sm"></i>' + esc(t('e03.recovered')) + '</span>'
                     : '<span class="badge">' + esc(t('e01.status.' + d.doing.status)) + '</span>';
  return '<section class="card">' +
    cardHeadHTML(t('e03.profile_title'), th('e03.profile_sub', { month: monthName(d.compare_month) })) +
    pulseHTML(d.pulse, { width: 440, height: 200 }) +
    '<div class="comment"><p>' + comment + '</p>' + badge + '</div></section>';
}


// ---------- 4. What changed - living state timeline ----------

function changedCardHTML(d) {
  const weeks = d.timeline;
  // The bands: one band for each run of weeks in the same state.
  const runs = [];
  weeks.forEach(function (w) {
    const last = runs[runs.length - 1];
    if (last && last.state === w.state) { last.count++; } else { runs.push({ state: w.state, count: 1 }); }
  });
  const bands = runs.map(function (r) {
    return '<span class="band ' + r.state + '" style="flex:' + r.count + '">' + esc(t('e03.state.' + r.state)) + '</span>';
  }).join('');
  // The signal: one bar for each week (workload), coloured by the state of the week.
  const loads = weeks.map(function (w) { return w.workload; });
  const low = Math.min.apply(null, loads) - 4, high = Math.max.apply(null, loads);
  const bars = weeks.map(function (w) {
    const height = 12 + (w.workload - low) / (high - low) * 100;
    return '<i class="sig ' + w.state + '" style="height:' + Math.round(height) + 'px" title="' + esc(fmtDate(w.week)) + ' · ' + w.workload + '"></i>';
  }).join('');
  const events = d.events.map(function (e) {
    return '<div class="event"><i></i><b class="mono" dir="ltr">' + esc(fmtDate(e.date)) + '</b><span>' + eventText(e) + '</span></div>';
  }).join('');
  const taskRow = d.score.rows.filter(function (r) { return r.key === 'task_completion'; })[0];
  const stateLine = th('e03.state_line', { task: taskRow.score, engagement: d.doing.engagement, workload: d.doing.workload, risk: d.doing.risk.pct });
  const first = weeks[0].week, last = weeks[weeks.length - 1].week;
  return '<section class="card" id="changed">' +
    cardHeadHTML(t('e03.changed_title'), th('e03.changed_sub', { from: t('month.' + Number(first.slice(5, 7))), to: t('month.' + Number(last.slice(5, 7))), year: last.slice(0, 4) })) +
    '<div class="timeline"><div class="bands">' + bands + '</div>' +
      '<div class="signal">' + bars + '</div>' +
      '<p class="mono state-line">' + stateLine + '</p>' +
      '<div class="events">' + events + '</div></div></section>';
}

// The text of one event of the timeline.
function eventText(e) {
  const p = e.params || {};
  if (e.key === 'tier_change') {
    return th('e03.ev.tier_change', { tier: t('tier_title.' + p.tier), score: p.score });
  }
  if (e.key === 'award') {
    return esc(t('recog.' + p.category));
  }
  if (e.key.indexOf('idea_') === 0) {
    return esc(t('e03.ev.' + e.key));
  }
  return th('e03.ev.' + e.key, { code: p.code || '', pct: p.pct || '' });
}


// ---------- 5. Strengths, development areas, risks ----------

function strengthsCardHTML(d) {
  const items = d.strengths.map(function (s) {
    const p = s.params;
    let text;
    if (s.key === 'criterion') {
      text = p.top <= 50 ? th('e03.strength.criterion', { name: t('crit.' + p.criterion), score: p.score, top: p.top })
                         : th('e03.strength.criterion_plain', { name: t('crit.' + p.criterion), score: p.score });
    } else if (s.key === 'ideas') {
      text = th('e03.strength.ideas', { count: p.count, implemented: p.implemented });
    } else {
      text = th('e03.strength.colleagues', { count: p.count });
    }
    return '<li><span class="mark">' + ICONS.check + '</span><span>' + text + '</span></li>';
  }).join('');
  return '<section class="card list-card" id="strengths">' + cardHeadHTML(t('e03.strengths_title')) + '<ul class="marks">' + items + '</ul></section>';
}

function developmentCardHTML(d) {
  const items = d.development.map(function (x) {
    const p = x.params;
    let text;
    if (x.key === 'criterion') {
      text = th(p.criterion === 'innovation_creativity' ? 'e03.dev.innovation' : 'e03.dev.criterion', { name: t('crit.' + p.criterion), score: p.score });
    } else if (x.key === 'fact') {
      text = esc(t('e03.dev.fact.' + p.area));
    } else if (x.key === 'dna') {
      text = th('e03.dev.dna', { name: t('dna.' + p.trait), value: p.value, median: p.median });
    } else {
      text = th('e03.dev.skill', { skill: dt(p.skill), level: p.level });
    }
    return '<li><span class="mark violet">↗</span><span>' + text + '</span></li>';
  }).join('');
  return '<section class="card list-card">' + cardHeadHTML(t('e03.dev_title')) + '<ul class="marks">' + items + '</ul></section>';
}

function risksCardHTML(d) {
  const items = d.risks.map(function (r) {
    const p = r.params;
    let head, sub = '';
    if (r.key === 'relapse') {
      head = th('e03.risk.relapse', { limit: p.limit });
      if (p.rise > 0 && d.peak_week) {
        // the month of the peak week (Thursday of that week)
        const day = new Date(d.peak_week + 'T00:00:00Z'); day.setUTCDate(day.getUTCDate() + 3);
        sub = th('e03.risk.relapse_sub', { month: t('monthlong.' + (day.getUTCMonth() + 1)), rise: p.rise });
      }
    } else if (r.key === 'meetings') {
      head = th('e03.risk.meetings', { pct: p.pct });
    } else {
      head = th('e03.risk.overtime', { hours: p.hours, typical: p.typical });
    }
    return '<li><span class="level ' + r.level + '">' + esc(t('e03.level.' + r.level)) + '</span><span>' + head +
      (sub ? '<small>' + sub + '</small>' : '') + '</span></li>';
  }).join('');
  return '<section class="card list-card" id="risks">' + cardHeadHTML(t('e03.risks_title'), esc(t('e03.risks_sub'))) + '<ul class="risks">' + items + '</ul></section>';
}


// ---------- 6. How can I grow? ----------

function growCardHTML(d) {
  const s = d.score;
  const next = s.next;
  const goal = next ? tierName(next.key) : tierName(s.tier);
  const lines = d.planner.map(function (x) {
    return '<div class="grow-line"><span>' + esc(t('crit.' + x.key)) + '</span><b dir="ltr">' + x.from + ' → ' + x.to + '</b>' +
      '<span class="mono" dir="ltr">+' + x.points.toFixed(2) + '</span></div>';
  }).join('');
  const gain = d.planner.reduce(function (sum, x) { return sum + x.points; }, 0);
  const total = Math.round((s.exact + gain) * 100) / 100;
  const projected = Math.round(total);
  let tier = s.tier;
  const limits = [['gold', 90], ['silver', 80], ['bronze', 70]];
  for (let i = 0; i < limits.length; i++) {
    if (projected >= limits[i][1]) { tier = limits[i][0]; break; }
  }
  return '<section class="card" id="grow">' +
    cardHeadHTML(tf('e03.grow_title', { tier: goal }),
      next ? th('e03.grow_sub', { score: s.rounded, n: next.points, tier: goal }) : esc(t('e03.grow_top'))) +
    '<div class="grow">' +
      '<div class="grow-score"><b dir="ltr">' + s.rounded + '</b><span class="mono">' + esc(tierName(s.tier)) + (s.change !== null ? ' · ↑' + s.change : '') + '</span></div>' +
      '<div class="grow-middle">' + tierBandHTML(s.rounded, s.tier) + lines + '</div>' +
      '<div class="grow-result"><span class="mono" dir="ltr">' + num(s.exact) + ' + ' + num(Math.round(gain * 100) / 100) + ' = ' + num(total) + '</span>' +
        '<b dir="ltr">' + projected + ' · ' + esc(tierName(tier)) + '</b><small>' + esc(t('e03.realistic')) + '</small></div>' +
    '</div></section>';
}


// ---------- 7. Next steps ----------

function stepsCardHTML(d) {
  const items = d.steps.map(function (x, i) {
    const p = x.params || {};
    let title = p.title ? dt(p.title) : '';
    if (x.key === 'pair' && getLang() === 'en') { title = title.charAt(0).toLowerCase() + title.slice(1); }
    const text = th('e03.step.' + x.key, { title: title, progress: p.progress === undefined ? '' : p.progress });
    return '<li><b class="mono" dir="ltr">' + String(i + 1).padStart(2, '0') + '</b><span>' + text + '</span></li>';
  }).join('');
  return '<section class="card" id="steps">' + cardHeadHTML(t('e03.steps_title')) +
    (items ? '<ol class="steps">' + items + '</ol>' : '<p class="empty">' + esc(t('e03.steps_empty')) + '</p>') + '</section>';
}


// ---------- 8. Did previous interventions work? ----------

function workedCardHTML(d) {
  const i = d.intervention;
  if (!i) {
    return '<section class="card dark" id="worked">' + cardHeadHTML(t('e03.worked_title'), esc(t('e03.worked_none'))) + '</section>';
  }
  const parts = [th('e03.worked_risk', { from: i.risk_before, to: i.risk_after })];
  if (i.engagement_before !== null) { parts.push(th('e03.worked_engagement', { from: i.engagement_before, to: i.engagement_after })); }
  if (i.task_before !== null)       { parts.push(th('e03.worked_task', { from: i.task_before, to: i.task_after })); }
  if (i.score_before !== null)      { parts.push(th('e03.worked_score', { from: i.score_before, to: i.score_after })); }
  const month = monthName(i.started_at);
  const answer = i.improved
    ? th('e03.worked_yes', { month: month, from: i.risk_before, to: i.risk_after, score_from: i.score_before === null ? '' : i.score_before, score_to: i.score_after === null ? '' : i.score_after })
    : th('e03.worked_not_yet', { month: month });
  return '<section class="card dark" id="worked">' +
    cardHeadHTML(t('e03.worked_title'), '<bdi dir="ltr">' + esc(i.code) + '</bdi> · <bdi>' + esc(dt(i.title)) + '</bdi>') +
    '<p class="worked-numbers mono">' + parts.join('<span class="dotsep">·</span>') + '</p>' +
    '<p class="worked-answer">' + answer + '</p></section>';
}


// ---------- Buttons ----------

function wire(d) {
  // "Download my data": the employee can always take everything the twin shows (a JSON file).
  document.getElementById('download').addEventListener('click', function () {
    const blob = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'my-empulse-data.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    showToast(t('e03.downloaded'));
  });

  // The chapter bar: smooth scroll, and the chapter of the visible section is highlighted.
  const links = document.querySelectorAll('.chapter');
  links.forEach(function (link) {
    link.addEventListener('click', function (event) {
      event.preventDefault();
      const target = document.getElementById(link.dataset.target);
      if (target) { target.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    });
  });
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          links.forEach(function (l) { l.classList.toggle('active', l.dataset.target === entry.target.id); });
        }
      });
    }, { rootMargin: '-20% 0px -65% 0px' });
    CHAPTERS.forEach(function (c) {
      const section = document.getElementById(c[1]);
      if (section) { observer.observe(section); }
    });
  }
}
