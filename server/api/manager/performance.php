<?php
// server/api/manager/performance.php — M02 Team Performance.
// GET ?back=1|3|6 : the team by dimension this month against 1, 3 or 6 months ago, the tier mix, the score trend and how the score is built.
// Team numbers only (no individual ranking). With fewer than 5 people everything is suppressed.
require __DIR__ . '/../../manager_data.php';

$user = require_role(['manager']);
$mid = my_employee_id($user);
$dates = app_dates();
$me = load_person($mid);
$team = team_of($mid);
$teamInfo = team_name_of($mid);
$ids = team_ids($team);
$n = count($team);
$latest = $dates['latest_week'];
$back = (int) ($_GET['back'] ?? 1);
if (!in_array($back, [1, 3, 6], true)) { $back = 1; }

$base = ['who' => who_block($me), 'team' => ['name' => $teamInfo['name'], 'people' => $n, 'avatars' => array_map(function ($p) { return initials_of($p['full_name']); }, array_slice($team, 0, 3))],
         'badges' => ['early_warning' => count(array_filter($team, function ($p) { return (int) $p['burnout_risk_pct'] >= 60; })), 'interventions' => 0],
         'attention' => count(array_filter($team, function ($p) { return (int) $p['burnout_risk_pct'] >= 60; })), 'back' => $back];
$base['badges']['interventions'] = (int) query("SELECT COUNT(*) AS c FROM interventions WHERE owner_id = ? AND status = 'active'", [$mid])->fetch()['c'];
if ($n < MIN_GROUP) { send_json($base + ['suppressed' => true]); }

$thisMonth = query('SELECT MAX(month) AS m FROM monthly_scores')->fetch()['m'];
$thenMonth = month_before($thisMonth, $back);
$now = criteria_avgs($ids, null);
$then = criteria_avgs($ids, $thenMonth);
$weights = criteria_weights();

// rows: this month against the comparison month
$rows = [];
foreach (CRITERIA_ORDER as $key) {
    $a = $now[$key]; $b = $then ? $then[$key] : null;
    $rows[] = ['key' => $key, 'now' => (int) round($a), 'before' => $b === null ? null : (int) round($b), 'change' => $b === null ? null : (int) round($a) - (int) round($b)];
}
// wellbeing: a check-in signal, not scored; only when 5 or more people shared (else null)
$wm = wellbeing_by_month($ids, $latest);
$wNow = $wm[substr($thisMonth, 0, 7)] ?? null;
$wThen = $wm[substr($thenMonth, 0, 7)] ?? null;
$wellbeing = $wNow === null ? null : ['now' => (int) round($wNow), 'before' => $wThen === null ? null : (int) round($wThen),
                                      'change' => $wThen === null ? null : (int) round($wNow) - (int) round($wThen)];

// the sentence at the top: a rule on the changes
$worst = null; $best = null; $task = null;
foreach ($rows as $r) {
    if ($r['change'] === null) { continue; }
    if ($r['key'] === 'task_completion') { $task = $r['change']; }
    if ($worst === null || $r['change'] < $worst['change']) { $worst = $r; }
    if ($best === null || $r['change'] > $best['change']) { $best = $r; }
}
$insight = ['kind' => 'steady'];
if ($worst && $worst['change'] <= -2 && $worst['key'] !== 'task_completion' && ($task === null || $task > $worst['change'])) {
    $insight = ['kind' => 'holding', 'key' => $worst['key'], 'delta' => abs($worst['change']), 'task' => $task];
} elseif ($worst && $worst['change'] >= 0 && $best && $best['change'] > 0) {
    $insight = ['kind' => 'improving', 'key' => $best['key'], 'delta' => $best['change']];
}

// score, tier, change
$scoreNow = (int) round($now['empulse_score_exact']);
$scoreThen = $then ? (int) round($then['empulse_score_exact']) : null;
$mix = tier_counts($team);
$mixPct = [];
foreach ($mix as $k => $c) { $mixPct[$k] = (int) round($c / $n * 100); }

// trend: monthly average of the team score, 6 months
$trend = array_map(function ($r) { return ['month' => $r['month'], 'v' => round((float) $r['v'], 1)]; }, team_month_series($ids, 'empulse_score_exact', 6));
$tiers = array_map(function ($t) { return tier_key(tier_for((int) round($t['v']))); }, $trend);
$stable = count(array_unique($tiers)) === 1;

// how the team score is built (team averages x published weights)
$built = []; $sum = 0.0;
foreach (CRITERIA_ORDER as $key) {
    $v = $now[$key]; $pts = $v * $weights[$key] / 100; $sum += $pts;
    $built[] = ['key' => $key, 'value' => (int) round($v), 'weight' => $weights[$key], 'points' => round($pts, 2)];
}

send_json($base + ['suppressed' => false,
    'compare' => ['this' => $thisMonth, 'then' => $thenMonth],
    'rows' => $rows, 'wellbeing' => $wellbeing, 'insight' => $insight,
    'score' => ['value' => $scoreNow, 'tier' => tier_key(tier_for($scoreNow)), 'change' => $scoreThen === null ? null : $scoreNow - $scoreThen, 'exact' => round($sum, 1)],
    'mix' => ['counts' => $mix, 'pct' => $mixPct],
    'trend' => ['points' => $trend, 'stable' => $stable, 'tier' => $tiers ? $tiers[count($tiers) - 1] : null],
    'built' => ['rows' => $built, 'exact' => round($sum, 1), 'total' => (int) round($sum)]]);
