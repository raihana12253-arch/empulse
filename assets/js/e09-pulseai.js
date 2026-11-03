// =====================================================================
// e09-pulseai.js — E09 PulseAI (pages/employee/pulseai.html)
// Data: server/api/employee/pulseai.php. Rule-based answers (no language model) about MY OWN data.
// The API sends texts as { k: key, p: params }; R() turns them into text in the current language.
// =====================================================================

document.addEventListener('DOMContentLoaded', function () {
  startEmployeePage({ active: 'pulseai', api: 'employee/pulseai.php', crumb: 'e09.crumb', render: render });
});

let D = null;          // data of the page
let busy = false;

// A message { k, p } -> HTML. Values that are messages themselves are resolved first.
function R(o) {
  if (o === null || o === undefined) { return ''; }
  if (typeof o !== 'object') { return esc(o); }
  const params = {};
  Object.keys(o.p || {}).forEach(function (name) {
    const v = o.p[name];
    if (v !== null && typeof v === 'object' && 'k' in v) { params[name] = { html: R(v) }; }
    else if ((name === 'tier' || name === 'to') && typeof v === 'string' && /^[a-z]+$/.test(v)) { params[name] = { html: esc(tierName(v)) }; }
    else if (name === 'skill' || name === 'title' || name === 'project' || name === 'idea' || name === 'module' || name === 'goal') { params[name] = { html: '<bdi>' + esc(dt(v)) + '</bdi>' }; }
    else { params[name] = v; }
  });
  return th(o.k, params);
}
function RT(o) { const d = document.createElement('div'); d.innerHTML = R(o); return d.textContent; }

function dayOf(iso) {
  const p = iso.slice(0, 10).split('-').map(Number);
  return t('weekday.' + new Date(Date.UTC(p[0], p[1] - 1, p[2])).getUTCDay()) + ' ' + p[2];
}

function render(d) {
  D = d;
  // Top bar of this screen: the "points to Gold" pill and "Last 4 weeks".
  const util = document.querySelector('.utilities');
  if (d.pill) {
    util.insertAdjacentHTML('afterbegin', '<span class="util pill-gold">' + ICONS.target + '<span>' + th('e09.pill', { n: d.pill.points, tier: { html: esc(tierName(d.pill.tier)) } }) + '</span></span>');
  }
  const period = document.querySelector('#period-button span');
  if (period) { period.textContent = t('e09.last4'); }
  document.querySelector('main').innerHTML =
    '<div class="pai">' +
      '<section class="pai-left">' + leftHTML() + '</section>' +
      '<section class="pai-centre"><div class="thread" id="thread"></div>' +
        '<form class="ask" id="ask" autocomplete="off"><span class="ask-spark">' + ICONS.spark + '</span>' +
        '<input id="ask-input" maxlength="200" placeholder="' + esc(t('e09.input')) + '"><button class="send" type="submit" aria-label="' + esc(t('e09.send')) + '">' + ICONS.arrowUp + '</button></form>' +
      '</section>' +
      '<aside class="pai-right">' + rightHTML() + '</aside>' +
    '</div>';
  addTurn(d.first.question, d.first);
  wire();
}

function leftHTML() {
  return '<h1>' + esc(t('e09.title')) + '</h1><p class="intro">' + esc(t('e09.intro')) + '</p>' +
    '<button class="btn primary wide" type="button" id="new-q"><span class="sp">' + ICONS.spark + '</span>' + esc(t('e09.new')) + '</button>' +
    '<h3 class="mono cap">' + esc(t('e09.recent')) + '</h3><div class="recent" id="recent">' + recentHTML() + '</div>';
}
function questionText(intent, fallback) {
  const key = 'e09.q.' + intent;
  return texts[key] || fallback;
}
function recentHTML(activeIntent) {
  activeIntent = activeIntent || D.first.intent;
  return D.recent.map(function (r, i) {
    const on = activeIntent === r.intent ? ' on' : '';
    return '<button type="button" class="recent-item' + on + '" data-intent="' + esc(r.intent) + '">' + esc(questionText(r.intent, r.question)) + '</button>';
  }).join('');
}
function rightHTML() {
  return '<div class="r-history"><span>' + ICONS.clock + esc(t('e09.history')) + '</span></div>' +
    '<h3 class="r-title"><i>~</i> ' + esc(t('e09.context')) + '</h3>' +
    '<dl class="ctx"><dt>' + esc(t('e09.scope')) + '</dt><dd><bdi>' + esc(D.context.name) + '</bdi></dd>' +
    '<dt>' + esc(t('e09.access')) + '</dt><dd>' + esc(t('e09.access_v')) + '</dd>' +
    '<dt>' + esc(t('e09.fresh')) + '</dt><dd>' + th('e09.fresh_v', { time: D.context.fresh }) + '</dd></dl>' +
    '<h3 class="mono cap">' + esc(t('e09.never')) + '</h3><ul class="never">' +
    ['e09.never1', 'e09.never2', 'e09.never3', 'e09.never4'].map(function (k) { return '<li><span>' + ICONS.ban + '</span>' + esc(t(k)) + '</li>'; }).join('') + '</ul>' +
    '<h3 class="mono cap">' + esc(t('e09.try')) + '</h3><div class="try">' +
    D.suggest.map(function (i) { return '<button type="button" class="try-item" data-intent="' + i + '"><span>' + ICONS.spark + '</span>' + esc(questionText(i, D.questions[i])) + '</button>'; }).join('') + '</div>';
}

// ---------- The thread ----------

function bubble(text) { return '<div class="bubble">' + esc(text) + '</div>'; }

function steps() {
  return '<div class="steps"><span class="on">' + ICONS.spark + esc(t('e09.s_ai')) + '</span><span>' + esc(t('e09.s_q')) + '</span><span>' + esc(t('e09.s_data')) + '</span>' +
         '<span>' + esc(t('e09.s_find')) + '</span><span>' + esc(t('e09.s_rec')) + '</span></div>';
}

function miniBars(values, tone) {
  const max = Math.max.apply(null, values.concat([1]));
  const colors = { warm: ['#f0bf9a', '#f0bf9a', '#ef5a48', '#ef5a48'], cool: ['#475d78', '#475d78', '#8da0b8', '#c1ccd9'], def: ['#efd37f', '#f0bf9a', '#f0bf9a', '#ef5a48'] }[tone || 'def'];
  return '<span class="mini" dir="ltr">' + values.map(function (v, i) {
    return '<i style="height:' + Math.max(8, Math.round(v / max * 34)) + 'px;background:' + (tone === 'warm' && i === 0 ? '#14b8a6' : colors[i % colors.length]) + '"></i>';
  }).join('') + '</span>';
}

function answerHTML(a) {
  if (a.unknown) { return '<div class="card answer"><p class="headline">' + esc(t('e09.unknown')) + '</p></div>'; }
  const chips = a.data.map(function (c) { return '<span class="chip"><i></i><span>' + R(c.label) + '</span></span>'; }).join('');
  const finds = a.findings.map(function (f, i) {
    return '<div class="find"><span class="n">' + (i + 1) + '</span><div><b>' + R(f.title) + '</b><p>' + R(f.text) + '</p></div>' + miniBars(f.bars, f.warm ? 'warm' : (f.cool ? 'cool' : 'def')) + '</div>';
  }).join('');
  const acts = a.actions.map(function (k) {
    if (k === 'plan') { return '<button type="button" class="btn primary small" data-act="plan"><span class="sp">' + ICONS.spark + '</span>' + esc(t('e09.a_plan')) + ' ' + ICONS.arrow + '</button>'; }
    if (k === 'join') { return '<button type="button" class="btn small" data-act="join">' + ICONS.ring + esc(t('e09.a_join')) + '</button>'; }
    return '<button type="button" class="btn small" data-act="share">' + ICONS.up + esc(t('e09.a_share')) + '</button>';
  }).join('');
  const nums = a.numbers.map(function (n) { return '<div><span>' + R(n.label) + '</span><b dir="ltr">' + esc(n.value) + '</b></div>'; }).join('');
  return '<div class="card answer">' + steps() + '<p class="headline">' + R(a.headline) + '</p>' +
    '<h4 class="mono cap">' + esc(t('e09.relevant')) + '</h4><div class="chips">' + chips + '</div>' +
    '<p class="scope-line">' + th('e09.period', { from: a.period.from ? monthName(a.period.from) : '', to: monthName(a.period.to) }) + '</p>' +
    '<h4 class="mono cap">' + esc(t('e09.findings')) + '</h4>' + finds +
    '<div class="rec"><b>✓ ' + esc(t('e09.recommendation')) + '</b><p>' + R(a.recommendation) + '</p></div>' +
    '<div class="acts"><span class="mono cap">' + esc(t('e09.actions')) + '</span>' + acts + '</div>' +
    '<div class="foot"><span>' + th('e09.confidence', { level: t('e09.conf_' + a.confidence.level), n: a.confidence.months }) + '</span>' +
      '<button type="button" class="link" data-act="numbers">' + esc(t('e09.show_numbers')) + '</button>' +
      '<span class="helpful">' + esc(t('e09.helpful')) + ' <button type="button" data-help="1" data-id="' + a.id + '">' + esc(t('e09.yes')) + '</button><button type="button" data-help="0" data-id="' + a.id + '">' + esc(t('e09.no')) + '</button></span></div>' +
    '<div class="numbers" hidden>' + nums + '</div></div>';
}

function planHTML(plan) {
  const items = plan.items.map(function (it, i) {
    return '<div class="pl-item"><span class="date mono d' + (i % 3) + '" dir="ltr">' + esc(dayOf(it.date)) + '</span><p>' + R(it.text) + '</p></div>';
  }).join('');
  return '<div class="card plan"><div class="plan-head"><span class="pl-icon">' + ICONS.spark + '</span><b>' + R(plan.title) + '</b>' +
    '<span class="draft"><i></i>' + esc(t('e09.draft')) + '</span></div><div class="pl-grid">' + items + '</div>' +
    '<div class="pl-meta"><span><b>' + esc(t('e09.expected')) + ':</b> ' + R(plan.expected) + '</span>' +
    '<span><b>' + esc(t('e09.owner')) + ':</b> <bdi>' + esc(plan.owner) + '</bdi></span><span><b>' + esc(t('e09.followup')) + ':</b> ' + esc(fmtDate(plan.followup)) + '</span></div>' +
    '<div class="pl-actions"><button type="button" class="btn coral" data-act="save-plan"><span class="sp">' + ICONS.spark + '</span>' + esc(t('e09.add_path')) + '</button>' +
    '<button type="button" class="btn" data-act="edit-plan">' + esc(t('e09.edit')) + '</button></div></div>';
}

function addTurn(question, a) {
  const thread = document.getElementById('thread');
  thread.insertAdjacentHTML('beforeend', bubble(a.plan ? t('e09.q.plan') : (questionText(a.intent, question))) + (a.plan ? planHTML(a.plan) : answerHTML(a)));
  const last = thread.lastElementChild;
  if (last && last.scrollIntoView) { last.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
}

async function ask(body) {
  if (busy) { return; }
  busy = true;
  const r = await api('employee/pulseai.php', body);
  busy = false;
  if (r.status !== 200 || !r.data || r.data.error) { showToast(t('shell.error_load')); return; }
  const a = r.data;
  D.recent = a.recent || D.recent;
  document.getElementById('recent').innerHTML = recentHTML(a.intent === 'plan' || a.unknown ? undefined : a.intent);
  if (a.unknown) {
    const thread = document.getElementById('thread');
    thread.insertAdjacentHTML('beforeend', bubble(body.question || '') + answerHTML(a));
    return;
  }
  document.getElementById('thread').innerHTML = a.plan ? document.getElementById('thread').innerHTML : '';
  addTurn(a.question, a);
}

function wire() {
  document.getElementById('ask').addEventListener('submit', function (e) {
    e.preventDefault();
    const input = document.getElementById('ask-input');
    const text = input.value.trim();
    if (!text) { return; }
    input.value = '';
    ask({ question: text });
  });
  document.getElementById('new-q').addEventListener('click', function () { document.getElementById('ask-input').focus(); });
  document.querySelector('main').addEventListener('click', async function (e) {
    const intentBtn = e.target.closest('[data-intent]');
    if (intentBtn) { ask({ intent: intentBtn.getAttribute('data-intent') }); return; }
    const act = e.target.closest('[data-act]');
    if (act) {
      const k = act.getAttribute('data-act');
      if (k === 'plan') { ask({ intent: 'plan' }); }
      else if (k === 'join') { location.href = 'marketplace.html'; }
      else if (k === 'share') { showToast(t('e09.share_note')); }
      else if (k === 'numbers') { const box = act.closest('.answer').querySelector('.numbers'); box.hidden = !box.hidden; }
      else if (k === 'save-plan') {
        await api('employee/pulseai.php', { action: 'save_plan' });
        act.disabled = true; act.classList.add('done');
        showToast(t('e09.added'));
      } else if (k === 'edit-plan') { showToast(t('shell.soon')); }
      return;
    }
    const help = e.target.closest('[data-help]');
    if (help) {
      await api('employee/pulseai.php', { action: 'helpful', id: Number(help.getAttribute('data-id')), value: Number(help.getAttribute('data-help')) });
      help.parentNode.innerHTML = esc(t('e09.thanks'));
    }
  });
}
