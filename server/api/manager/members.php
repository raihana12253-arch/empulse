<?php
// server/api/manager/members.php — M04 Team Members.
// GET: the direct reports of the manager, ordered by who needs support first (burnout risk) - never by score.
// Each card: tier, performance, engagement, burnout risk, status and the one thing that would help most.
require __DIR__ . '/../../manager_data.php';

$user = require_role(['manager']);
$mid = my_employee_id($user);
$dates = app_dates();
$me = load_person($mid);
$team = team_of($mid);
$teamInfo = team_name_of($mid);
$n = count($team);
$latest = $dates['latest_week'];
$attention = count(array_filter($team, function ($p) { return (int) $p['burnout_risk_pct'] >= 60; }));

$months = query('SELECT DISTINCT month FROM monthly_scores ORDER BY month DESC LIMIT 2')->fetchAll();
$thisM = $months[0]['month']; $lastM = isset($months[1]) ? $months[1]['month'] : null;
$before4 = month_before_week($latest, 4);

$trend = function ($d) { return $d === null ? 'flat' : ($d >= 1 ? 'up' : ($d <= -1 ? 'down' : 'flat')); };
$people = []; $counts = ['at_risk' => 0, 'needs_attention' => 0, 'improving' => 0, 'healthy' => 0];
foreach ($team as $p) {
    $id = (int) $p['id'];
    $status = map_status($p);
    $counts[$status]++;
    $f = facts_of($id);
    $now = month_row($id, $thisM); $prev = $lastM ? month_row($id, $lastM) : null;
    $engBefore = query('SELECT engagement_score FROM weekly_metrics WHERE employee_id = ? AND week_start = ?', [$id, $before4])->fetch();
    $tier = tier_key($p['tier']);
    $prevTier = $prev ? tier_key($prev['tier']) : $tier;
    $people[] = [
        'id' => $id, 'name' => $p['full_name'], 'initials' => initials_of($p['full_name']), 'job_title' => $p['job_title'],
        'status' => $status, 'tier' => $tier, 'score' => (int) $p['empulse_score'],
        'score_delta' => $prev ? (int) $p['empulse_score'] - (int) $prev['empulse_score'] : 0,
        'promoted' => $tier === 'gold' && $prevTier !== 'gold',
        'performance' => (int) $p['task_completion'], 'performance_trend' => $trend($prev ? (int) $p['task_completion'] - (int) $prev['task_completion'] : null),
        'engagement' => (int) $p['engagement_score'], 'engagement_trend' => $trend($engBefore ? (int) $p['engagement_score'] - (int) $engBefore['engagement_score'] : null),
        'risk' => (int) $p['burnout_risk_pct'], 'alert' => (int) $p['burnout_risk_pct'] >= 60,
        'recommended' => $f['m04_recommended'] ?? null,
    ];
}
usort($people, function ($a, $b) { return $b['risk'] <=> $a['risk']; });     // who needs support first, never by score

send_json(['who' => who_block($me), 'team' => ['name' => $teamInfo['name'], 'people' => $n, 'avatars' => array_map(function ($p) { return initials_of($p['full_name']); }, array_slice($team, 0, 3))],
           'badges' => ['early_warning' => $attention, 'interventions' => (int) query("SELECT COUNT(*) AS c FROM interventions WHERE owner_id = ? AND status = 'active'", [$mid])->fetch()['c']],
           'attention' => $attention, 'counts' => $counts, 'people' => $people]);
