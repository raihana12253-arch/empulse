<?php
// server/api/employee/performance.php — E02 My Performance (Professional Tier).
require __DIR__ . '/../../employee_data.php';

$user = require_role(['employee']);
$eid = my_employee_id($user);
$dates = app_dates();
$p = load_person($eid);

$compare_month = month_before($dates['as_of'], 3);               // arrows compare with June
$june = month_row($eid, $compare_month);
$score = score_block($p, $june);

// Score journey: the last 7 month-end scores (Mar ... Sep).
$journey = month_scores($eid, 7);
$best_row = query('SELECT MAX(empulse_score) AS best FROM monthly_scores WHERE employee_id = ?', [$eid])->fetch();

// Dimension trends: arrow = compared with June.
$trends = [];
foreach (pulse_view($p, $june) as $d) {
    $arrow = 'same';
    if ($d['before'] !== null && $d['now'] > $d['before']) { $arrow = 'up'; }
    if ($d['before'] !== null && $d['now'] < $d['before']) { $arrow = 'down'; }
    $trends[] = ['key' => $d['key'], 'score' => $d['now'], 'arrow' => $arrow];
}

// Recognition badges: the two most recent different award categories of the last 12 months.
$awards = awards_of($eid, date('Y-m-d', strtotime('-12 months', strtotime($dates['as_of']))), 8);
$badges = [];
foreach ($awards as $a) {
    if ($a['category'] && !in_array($a['category'], $badges, true)) { $badges[] = $a['category']; }
    if (count($badges) === 2) { break; }
}

// Planner: default gains. The page lets the person move them (nothing is saved).
$planner = planner_defaults($score['rows']);
$best = null;
foreach ($planner as $item) {
    if ($best === null || $item['points'] > $best['points']) { $best = $item; }
}

// Advice for the planner: innovation is the dimension a person can realistically grow; the fastest route is
// co-leading a build, so the advice names an open idea that needs the person's role.
$advice = null;
foreach ($planner as $item) {
    if ($item['key'] === 'innovation_creativity') {
        $join = joinable_idea($eid, $p['job_title']);
        $advice = ['key' => 'innovation_creativity', 'gain' => $item['to'] - $item['from'], 'points' => $item['points'],
                   'idea' => $join ? $join['title'] : null];
    }
}

// The tier limits (from server/config.php) so the planner can name the projected tier.
$limits = [];
foreach ($CONFIG['tiers'] as $tier) { $limits[] = ['key' => tier_key($tier['name']), 'min' => $tier['min']]; }

send_json([
    'as_of'         => $dates['as_of'],
    'who'           => who_block($p),
    'compare_month' => $compare_month,
    'score'         => $score,
    'burnout_risk'  => (int) $p['burnout_risk_pct'],
    'journey'       => $journey,
    'best_score'    => (int) $best_row['best'],
    'trends'        => $trends,
    'badges'        => $badges,
    'planner'       => $planner,
    'planner_best'  => $best ? $best['key'] : null,
    'advice'        => $advice,
    'tier_limits'   => $limits,
]);
