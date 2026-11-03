<?php
// server/api/manager/member.php — M04b Team member profile.
// GET ?id=367 : one DIRECT REPORT of the signed-in manager (anyone else = 403). Why the score is what it is, risks, growth, what to do.
// PRIVACY: private check-in answers are never returned. Wellbeing appears only if the person allows it AND shared the check-in as a trend.
// Texts are returned as keys + values (the browser writes them in English or Arabic). Forecasts are projections: they are labelled so.
require __DIR__ . '/../../manager_data.php';

$user = require_role(['manager']);
$mid = my_employee_id($user);
$id = (int) ($_GET['id'] ?? 0);
if (!$id || !is_my_report($mid, $id)) { send_json(['error' => 'forbidden'], 403); }

$dates = app_dates();
$latest = $dates['latest_week'];
$me = load_person($mid);
$team = team_of($mid);
$teamInfo = team_name_of($mid);
$p = load_person($id);
$facts = facts_of($id);
$attention = count(array_filter($team, function ($t) { return (int) $t['burnout_risk_pct'] >= 60; }));
$first = explode(' ', $p['full_name'])[0];

$june = month_row($id, month_before($dates['as_of'], 3));
$sb = score_block($p, $june);
$tier = $sb['tier'];
$risk = (int) $p['burnout_risk_pct'];
$status = map_status($p + ['burnout_risk_pct' => $risk]);
$wb = shared_wellbeing($id, $latest);                         // null when not shared

// ----- monthly history (12 months) -----
$hist = query('SELECT * FROM monthly_scores WHERE employee_id = ? ORDER BY month', [$id])->fetchAll();
$best = null;
foreach ($hist as $h) { if ($best === null || (int) $h['empulse_score'] > $best) { $best = (int) $h['empulse_score']; } }
$engWeekBefore = query('SELECT engagement_score FROM weekly_metrics WHERE employee_id = ? AND week_start = ?', [$id, month_before_week($latest, 4)])->fetch();
$engDrop = $engWeekBefore ? (int) $engWeekBefore['engagement_score'] - (int) $p['engagement_score'] : 0;

// ----- criteria sorted for strongest / weakest (job burnout is shown separately) -----
$crit = [];
foreach (CRITERIA_ORDER as $k) { $crit[$k] = (int) ($k === 'job_burnout' ? 100 - $risk : $p[$k]); }
$noBurn = $crit; unset($noBurn['job_burnout']);
arsort($noBurn); $top = array_slice($noBurn, 0, 3, true);
asort($crit); $lowKey = array_key_first($crit);
asort($noBurn); $dev = array_slice($noBurn, 0, 2, true);

// ----- right now -----
$now = [];
$now[] = ['k' => ($crit['task_completion'] >= 85 && $risk >= 60) ? 'm4b.n_output_pace' : ($risk >= 60 ? 'm4b.n_risk_high' : ($risk >= 45 ? 'm4b.n_watch' : 'm4b.n_steady')), 'p' => ['tier' => $tier]];
$topKey = array_key_first($top);
$now[] = ['k' => 'm4b.n_strongest', 'p' => ['crit' => $topKey, 'v' => $top[$topKey]]];
$now[] = ['k' => $risk >= 60 ? 'm4b.n_opportunity_alert' : 'm4b.n_opportunity', 'p' => ['crit' => $lowKey, 'v' => $crit[$lowKey], 'risk' => $risk, 'rising' => (int) $p['burnout_change_6w'] > 2]];
if ($best !== null && $best > $sb['rounded']) { $now[] = ['k' => 'm4b.n_below_best', 'p' => ['n' => $best - $sb['rounded'], 'best' => $best, 'eng' => $engDrop >= 3]]; }

// ----- how the score was calculated: now, weights, June -----
$weights = criteria_weights();
$calc = [];
foreach ($sb['rows'] as $r) {
    $b = $june ? (int) $june[$r['key']] : null;
    $calc[] = ['key' => $r['key'], 'weight' => $r['weight'], 'score' => $r['score'], 'before' => $b, 'change' => $b === null ? null : $r['score'] - $b];
}

// ----- weekly burnout pulse (12 weeks) -----
$weeks = array_reverse(query('SELECT week_start, burnout_risk_pct, engagement_score FROM weekly_metrics WHERE employee_id = ? AND week_start <= ? ORDER BY week_start DESC LIMIT 12',
                             [$id, $latest])->fetchAll());
$pulse = array_map(function ($w) { return ['week' => $w['week_start'], 'risk' => (int) $w['burnout_risk_pct'], 'eng' => (int) $w['engagement_score']]; }, $weeks);

// ----- energy trend: only if the person shares it -----
$energy = null;
$off = query('SELECT setting_value FROM user_settings WHERE employee_id = ? AND setting_key = ?', [$id, 'share_wellbeing'])->fetch();
if (!($off && (int) $off['setting_value'] === 0)) {
    $cs = query('SELECT energy FROM checkins WHERE employee_id = ? AND share_trend = 1 ORDER BY week_start DESC LIMIT 4', [$id])->fetchAll();
    if (count($cs) >= 3) {
        $low = count(array_filter($cs, function ($c) { return (int) $c['energy'] <= 2; }));
        $high = count(array_filter($cs, function ($c) { return (int) $c['energy'] >= 4; }));
        $energy = ['level' => $low >= 2 ? 'low' : ($high >= 2 ? 'high' : 'mixed'), 'n' => $low >= 2 ? $low : $high, 'of' => count($cs)];
    }
}
$avgTop = (int) round(mean_of(array_values($noBurn)));
$outlier = $wb && $wb['level'] !== 'high' && $avgTop >= 80;

// ----- timeline: 12 months, states by burnout risk -----
$state = function ($r) { return $r >= 60 ? 'burnout' : ($r >= 45 ? 'stretched' : 'thriving'); };
$wbMonthly = [];
if ($energy !== null) {
    foreach (query('SELECT week_start, energy, morale FROM checkins WHERE employee_id = ? AND share_trend = 1 ORDER BY week_start', [$id])->fetchAll() as $c) {
        $wbMonthly[substr($c['week_start'], 0, 7)][] = wellbeing_value((int) $c['energy'], (int) $c['morale']);
    }
}
$timeline = array_map(function ($h) use ($state, $wbMonthly) {
    $m = substr($h['month'], 0, 7);
    return ['month' => $h['month'], 'performance' => (int) $h['task_completion'], 'engagement' => (int) $h['engagement_score'], 'risk' => (int) $h['burnout_risk_pct'],
            'wellbeing' => isset($wbMonthly[$m]) ? (int) round(mean_of($wbMonthly[$m])) : null, 'state' => $state((int) $h['burnout_risk_pct'])];
}, $hist);
$events = array_map(function ($r) { return $r['title']; }, query('SELECT title FROM manager_notes WHERE employee_id = ? AND kind = ? ORDER BY ord', [$id, 'event'])->fetchAll());

// ----- strengths, development, risks -----
$notesDev = query('SELECT title, detail FROM manager_notes WHERE employee_id = ? AND kind = ? ORDER BY ord', [$id, 'development'])->fetchAll();
$strengths = array_map(function ($k, $v) { return ['crit' => $k, 'v' => $v]; }, array_keys($top), array_values($top));
$development = count($notesDev) ? array_map(function ($r) { return ['text' => $r['title'], 'detail' => $r['detail']]; }, $notesDev)
                                : array_map(function ($k, $v) { return ['crit' => $k, 'v' => $v]; }, array_keys($dev), array_values($dev));
$risks = [];
if ($risk >= 60) { $risks[] = ['level' => 'high', 'k' => 'm4b.r_burnout', 'p' => ['risk' => $risk, 'forecast' => isset($facts['forecast_pct']) ? (int) $facts['forecast_pct'] : null, 'weeks' => isset($facts['forecast_weeks']) ? (int) $facts['forecast_weeks'] : null]]; }
$engThen = $hist && count($hist) >= 3 ? (int) $hist[count($hist) - 3]['engagement_score'] : null;
if ($engThen !== null && $engThen - (int) $p['engagement_score'] >= 5) { $risks[] = ['level' => 'medium', 'k' => 'm4b.r_engagement', 'p' => ['a' => $engThen, 'b' => (int) $p['engagement_score'], 'ot' => (float) $p['overtime_hours_monthly'] / 4.33 >= 6]]; }
$lastRec = query('SELECT last_recognized_at FROM employee_current WHERE employee_id = ?', [$id])->fetch()['last_recognized_at'];
$recDays = isset($facts['recog_days']) ? (int) $facts['recog_days'] : days_ago($lastRec, $dates['as_of']);
if ($recDays === null || $recDays >= 60) { $risks[] = ['level' => 'medium', 'k' => 'm4b.r_recognition', 'p' => ['days' => $recDays, 'tier' => $tier]]; }

// ----- manager actions (notes of the design, or the open intervention) -----
$actions = array_map(function ($r) { return ['title' => $r['title'], 'lines' => array_values(array_filter(explode('|', (string) $r['detail']))), 'footer' => $r['footer'], 'pts' => $r['num'] === null ? null : (int) $r['num']]; },
                     query('SELECT title, detail, footer, num FROM manager_notes WHERE employee_id = ? AND kind = ? ORDER BY ord', [$id, 'action'])->fetchAll());
$open = query("SELECT code, title, root_cause, status, expected_risk_drop, human_approved FROM interventions WHERE employee_id = ? AND owner_id = ? AND status IN ('proposed','active') ORDER BY id DESC LIMIT 1", [$id, $mid])->fetch();
if (!count($actions) && $open) { $actions[] = ['title' => $open['title'], 'lines' => [$open['root_cause']], 'footer' => $open['code'], 'pts' => $open['expected_risk_drop'] === null ? null : (int) $open['expected_risk_drop']]; }

// ----- earlier interventions and the projection -----
$done = query("SELECT code, title, status, baseline_risk_pct, followup_risk_pct, outcome FROM interventions WHERE employee_id = ? AND owner_id = ? AND status IN ('completed','measured') ORDER BY id DESC", [$id, $mid])->fetchAll();
$proj = null;
if (isset($facts['proj_risk'])) {
    $proj = ['risk_to' => (int) $facts['proj_risk'], 'wellbeing_to' => isset($facts['proj_wellbeing_to']) ? (int) $facts['proj_wellbeing_to'] : null,
             'wellbeing_from' => $wb ? $wb['value'] : null, 'engagement_to' => isset($facts['proj_engagement']) ? (int) $facts['proj_engagement'] : null,
             'cases_n' => isset($facts['proj_cases_n']) ? (int) $facts['proj_cases_n'] : null, 'cases_total' => isset($facts['proj_cases_total']) ? (int) $facts['proj_cases_total'] : null,
             'drop' => isset($facts['proj_cases_drop']) ? (int) $facts['proj_cases_drop'] : null, 'case_weeks' => isset($facts['proj_cases_weeks']) ? (int) $facts['proj_cases_weeks'] : null,
             'confidence' => $facts['proj_confidence'] ?? null, 'horizon' => isset($facts['proj_horizon_weeks']) ? (int) $facts['proj_horizon_weeks'] : null,
             'wellbeing_gain' => isset($facts['proj_wellbeing_gain']) ? (int) $facts['proj_wellbeing_gain'] : null];
}

// the banner for a person with high performance and a high burnout risk (workload and overtime: display values of the design when given)
$wlRows = query('SELECT workload_index FROM weekly_metrics WHERE employee_id = ? AND week_start <= ? ORDER BY week_start DESC LIMIT 16', [$id, $latest])->fetchAll();
$wlPct = count($wlRows) >= 2 && (float) $wlRows[count($wlRows) - 1]['workload_index'] ? (int) round(((float) $wlRows[0]['workload_index'] - (float) $wlRows[count($wlRows) - 1]['workload_index']) / (float) $wlRows[count($wlRows) - 1]['workload_index'] * 100) : null;
$banner = ($crit['task_completion'] >= 85 && $risk >= 60) ? ['perf' => (int) $p['task_completion'], 'tier' => $tier,
    'workload' => isset($facts['ind_workload_pct']) ? (int) $facts['ind_workload_pct'] : $wlPct,
    'overtime' => isset($facts['ind_overtime_hours']) ? (int) $facts['ind_overtime_hours'] : (int) round((float) $p['overtime_hours_monthly'] / 4.33)] : null;

$awards = awards_of($id, month_before($dates['as_of'], 12), 12);
$chips = []; foreach ($awards as $a) { if ($a['category'] && !in_array($a['category'], $chips, true)) { $chips[] = $a['category']; } }

// approximate band of this person inside the team (same rule as E03: 10/25/50, no names, no individual ranking)
$teamScores = array_map(function ($t) { return (float) $t['empulse_score_exact']; }, $team);
sort($teamScores);
$myExact = null;
foreach ($team as $t) { if ((int) $t['id'] === $id) { $myExact = (float) $t['empulse_score_exact']; } }
$teamTop = (count($team) >= MIN_GROUP && $myExact !== null) ? top_percent($teamScores, $myExact) : null;
if ($teamTop !== null && $teamTop > 50) { $teamTop = null; }

send_json([
    'who' => who_block($me),
    'team' => ['name' => $teamInfo['name'], 'people' => count($team), 'avatars' => array_map(function ($t) { return initials_of($t['full_name']); }, array_slice($team, 0, 3))],
    'badges' => ['early_warning' => $attention, 'interventions' => (int) query("SELECT COUNT(*) AS c FROM interventions WHERE owner_id = ? AND status = 'active'", [$mid])->fetch()['c']],
    'attention' => $attention,
    'person' => ['id' => $id, 'name' => $p['full_name'], 'first_name' => $first, 'initials' => initials_of($p['full_name']), 'job_title' => $p['job_title'], 'team' => $p['team'],
                 'manager' => $p['manager_name'], 'tenure' => (float) $p['tenure_years'], 'joined' => (int) substr(query('SELECT hire_date FROM employees WHERE id = ?', [$id])->fetch()['hire_date'], 0, 4),
                 'chips' => array_slice($chips, 0, 2), 'status' => $status],
    'score' => ['value' => $sb['rounded'], 'exact' => $sb['exact'], 'tier' => $tier, 'next' => $sb['next'], 'change' => $sb['change'], 'risk' => $risk, 'alert' => $risk >= 60,
                'engagement' => (int) $p['engagement_score'], 'performance' => (int) $p['task_completion']],
    'wellbeing' => $wb, 'now' => $now, 'calc' => $calc,
    'pulse' => ['weeks' => $pulse, 'energy' => $energy, 'outlier' => $outlier, 'wellbeing' => $wb ? $wb['value'] : null, 'engagement' => (int) $p['engagement_score'], 'risk' => $risk],
    'timeline' => ['months' => $timeline, 'events' => $events], 'strengths' => $strengths, 'development' => $development, 'risks' => $risks,
    'team_top' => $teamTop,
    'grow' => ['score' => $sb['rounded'], 'next' => $sb['next'], 'tier' => $tier, 'burnout_now' => 100 - $risk, 'burnout_gain' => $proj ? $risk - $proj['risk_to'] : null,
               'wellbeing_now' => $wb ? $wb['value'] : null, 'wellbeing_gain' => $proj ? $proj['wellbeing_gain'] : null],
    'actions' => $actions, 'done' => $done, 'projection' => $proj, 'open' => $open ? ['code' => $open['code'], 'status' => $open['status']] : null,
    'recommended' => $facts['m04_recommended'] ?? null, 'banner' => $banner,
]);
