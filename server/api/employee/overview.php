<?php
// server/api/employee/overview.php — E01 My Overview.
// Answers 200 with everything the page needs (only the signed-in employee's own data).
require __DIR__ . '/../../employee_data.php';

$user = require_role(['employee']);
$eid = my_employee_id($user);
$dates = app_dates();
$p = load_person($eid);

$compare_month = month_before($dates['as_of'], 3);               // "since June"
$june = month_row($eid, $compare_month);
$score = score_block($p, $june);
$pulse = pulse_view($p, $june);
$facts = facts_of($eid);
$workload = workload_view($eid, $p, $facts, $compare_month);

// "What changed since June": burnout risk, engagement (a signal, not scored), workload (% of the person's usual), innovation.
$changes = [];
if ($june) {
    $changes = [
        ['key' => 'burnout_risk', 'from' => (int) $june['burnout_risk_pct'], 'to' => (int) $p['burnout_risk_pct'], 'good_when' => 'down'],
        ['key' => 'engagement',   'from' => (int) $june['engagement_score'], 'to' => (int) $p['engagement_score'], 'good_when' => 'up'],
        ['key' => 'workload',     'from' => $workload['from'], 'to' => $workload['to'], 'good_when' => 'down'],
        ['key' => 'innovation',   'from' => (int) $june['innovation_creativity'], 'to' => (int) $p['innovation_creativity'], 'good_when' => 'up'],
    ];
}

// Path to the next tier: the planner's default gains.
$path = planner_defaults($score['rows']);

// Recognition this quarter (awards get a card, kudos only count).
$quarter_start = month_before($dates['as_of'], 2);              // July 1 when today is in September
$count_row = query('SELECT COUNT(*) AS n FROM recognitions WHERE receiver_id = ? AND created_at >= ?', [$eid, $quarter_start])->fetch();
$awards = awards_of($eid, $quarter_start, 2);

// The most advanced idea (highest stage, then newest).
$ideas = ideas_of($eid);
$idea = null;
foreach ($ideas as $i) {
    if ($idea === null || $i['stage'] > $idea['stage']) { $idea = $i; }
}
if ($idea) {
    $idea = array_merge($idea, idea_note_numbers($idea['note']));
}

// PulseAI "for you": a RULE on the data (no language model).
//   1. the person has a focus pattern (the days when the best work started before noon) -> protect it
//   2. burnout risk fell 10+ points in 6 weeks -> protect the recovery
//   3. burnout risk is high or on watch        -> a supportive step
//   4. otherwise                               -> name the strongest dimension
$strongest = $score['rows'][0];
foreach ($score['rows'] as $r) {
    if ($r['key'] !== 'job_burnout' && $r['score'] > $strongest['score']) { $strongest = $r; }
}
if (isset($facts['focus_days'], $facts['focus_morning_pct'])) {
    $insight = ['type' => 'pattern', 'params' => ['days' => $facts['focus_days'], 'pct' => (int) $facts['focus_morning_pct']]];
} elseif ((int) $p['burnout_change_6w'] <= -10) {
    $insight = ['type' => 'recovery', 'params' => [
        'points' => abs((int) $p['burnout_change_6w']),
        'from'   => (int) $p['burnout_risk_pct'] - (int) $p['burnout_change_6w'],
        'to'     => (int) $p['burnout_risk_pct']]];
} elseif ($p['burnout_risk_pct'] >= 45) {
    $insight = ['type' => 'watch', 'params' => ['risk' => (int) $p['burnout_risk_pct']]];
} else {
    $insight = ['type' => 'steady', 'params' => ['key' => $strongest['key'], 'score' => $strongest['score']]];
}

send_json([
    'as_of'          => $dates['as_of'],
    'who'            => who_block($p),
    'compare_month'  => $compare_month,
    'status'         => status_key($p),
    'score'          => $score,
    'pulse'          => $pulse,
    'pulse_summary'  => pulse_summary($pulse),
    'changes'        => $changes,
    'path'           => $path,
    'activity'       => activity_of($eid, $dates['latest_week']),
    'checkin'        => checkin_state($eid, $dates['as_of']),
    'growth'         => growth_of($eid),
    'mentor'         => mentor_of($eid, $dates['as_of']),
    'recognition'    => ['quarter_count' => (int) $count_row['n'], 'awards' => $awards],
    'idea'           => $idea,
    'insight'        => $insight,
]);
