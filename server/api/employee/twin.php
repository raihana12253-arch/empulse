<?php
// server/api/employee/twin.php — E03 My Digital Twin.
// A private mirror of the employee's own state. Everything is a RULE on the stored data:
// strengths, risks and next steps are not written by hand and not made by a language model.
require __DIR__ . '/../../employee_data.php';

$user = require_role(['employee']);
$eid = my_employee_id($user);
$dates = app_dates();
$p = load_person($eid);

$compare_month = month_before($dates['as_of'], 3);
$june = month_row($eid, $compare_month);
$score = score_block($p, $june);
$pulse = pulse_view($p, $june);
$rows = $score['rows'];
$facts = facts_of($eid);
$workload = workload_view($eid, $p, $facts, $compare_month);

// ----- Who -----
$year_ago = date('Y-m-d', strtotime('-12 months', strtotime($dates['as_of'])));
$awards = awards_of($eid, $year_ago, 8);
$badges = [];
$givers = [];
foreach ($awards as $a) {
    if ($a['category'] && !in_array($a['category'], $badges, true) && count($badges) < 2) { $badges[] = $a['category']; }
    if ($a['from']) { $givers[$a['from']] = true; }
}
$kudos = query('SELECT DISTINCT giver_id FROM recognitions WHERE receiver_id = ? AND giver_id IS NOT NULL AND created_at >= ?', [$eid, $year_ago])->fetchAll();
$colleagues = isset($facts['named_by_colleagues']) ? (int) $facts['named_by_colleagues'] : count($kudos);   // colleagues who recognized the person

// ----- How am I doing right now -----
$strongest = $rows[0];
$opportunity = null;
foreach ($rows as $r) {
    if ($r['key'] !== 'job_burnout' && $r['score'] > $strongest['score']) { $strongest = $r; }
    $gap = (95 - $r['score']) * $r['weight'];                       // the biggest weighted gap to a very good score
    if ($r['key'] === 'job_burnout') { continue; }                  // Job Burnout is a risk, not a skill to "improve"
    if ($opportunity === null || $gap > $opportunity['gap']) { $opportunity = ['key' => $r['key'], 'score' => $r['score'], 'gap' => $gap]; }
}
$risk_pct = (int) $p['burnout_risk_pct'];
$risk_level = $risk_pct >= 60 ? 'high' : ($risk_pct >= 45 ? 'watch' : 'low');
$risk_trend = (int) $p['burnout_change_6w'] <= -3 ? 'falling' : ((int) $p['burnout_change_6w'] >= 3 ? 'rising' : 'steady');

// ----- Weekly timeline (the last 6 months) -----
$window_start = month_before($dates['as_of'], 6);
$weeks = query('SELECT week_start, workload_index, burnout_risk_pct FROM weekly_metrics
                WHERE employee_id = ? AND week_start >= ? ORDER BY week_start', [$eid, $window_start])->fetchAll();
$peak_risk = 0; $peak_week = null; $peak_workload = 0;
foreach ($weeks as $w) {
    if ($w['burnout_risk_pct'] > $peak_risk) { $peak_risk = (int) $w['burnout_risk_pct']; $peak_week = $w['week_start']; }
    $peak_workload = max($peak_workload, (float) $w['workload_index']);
}
// State of each week: burnout (60+), stretched (45-59 before the peak), recovering (after the peak,
// or below 45 within 5 weeks after a burnout week), thriving.
$timeline = [];
$last_burnout = -99;
foreach ($weeks as $i => $w) {
    $risk = (int) $w['burnout_risk_pct'];
    if ($risk >= 60) {
        $state = 'burnout'; $last_burnout = $i;
    } elseif ($risk >= 45) {
        $state = ($peak_risk >= 60 && $peak_week !== null && $w['week_start'] > $peak_week) ? 'recovering' : 'stretched';
    } else {
        $state = ($i - $last_burnout <= 5) ? 'recovering' : 'thriving';
    }
    $timeline[] = ['week' => $w['week_start'], 'state' => $state, 'workload' => round($w['workload_index'], 1), 'risk' => $risk];
}

// Events on the timeline: collect, keep the 6 most important, show them by date.
$events = [];
$add = function ($date, $key, $priority, $params = []) use (&$events, $window_start, $dates) {
    if ($date && $date >= $window_start && $date <= $dates['as_of']) {
        $events[] = ['date' => $date, 'key' => $key, 'priority' => $priority, 'params' => $params];
    }
};
foreach (query('SELECT code, started_at, measured_at FROM interventions WHERE employee_id = ? AND human_approved = 1', [$eid])->fetchAll() as $i) {
    $add($i['started_at'], 'int_started', 10, ['code' => $i['code']]);
    $add($i['measured_at'], 'int_measured', 10, ['code' => $i['code']]);
}
if ($peak_risk >= 60) { $add($peak_week, 'risk_peak', 5, ['pct' => $peak_risk]); }
$months = month_scores($eid, 12);
$last_change = null;                                                // only the most recent tier change is shown
for ($i = 1; $i < count($months); $i++) {
    if ($months[$i]['tier'] !== $months[$i - 1]['tier']) { $last_change = $i; }
}
if ($last_change !== null) {
    $changed_on = date('Y-m-t', strtotime($months[$last_change]['month']));   // the score is the one at the end of the month
    if ($changed_on > $dates['as_of']) { $changed_on = $dates['as_of']; }
    $add($changed_on, 'tier_change', 8, ['tier' => tier_key($months[$last_change]['tier']), 'score' => (int) $months[$last_change]['empulse_score']]);
}
$idea_sql = 'SELECT i.title, i.submitted_at, i.decided_at, i.implemented_at
             FROM ideas i JOIN idea_members m ON m.idea_id = i.id WHERE m.employee_id = ?';
foreach (query($idea_sql, [$eid])->fetchAll() as $i) {
    $add($i['implemented_at'], 'idea_implemented', 7, ['title' => $i['title']]);
    $add($i['decided_at'], 'idea_approved', 4, ['title' => $i['title']]);
    $add($i['submitted_at'], 'idea_submitted', 3, ['title' => $i['title']]);
}
foreach (try_query('SELECT event_date, kind FROM work_events WHERE employee_id = ?', [$eid]) as $e) {
    $add($e['event_date'], 'work_' . $e['kind'], 9);
}
foreach (awards_of($eid, $window_start, 6) as $a) {
    $add($a['created_at'], 'award', 5, ['category' => $a['category']]);
}
usort($events, function ($a, $b) { return $b['priority'] <=> $a['priority'] ?: strcmp($a['date'], $b['date']); });
$events = array_slice($events, 0, 6);
usort($events, function ($a, $b) { return strcmp($a['date'], $b['date']); });

// ----- Strengths, development areas, risks, next steps (rules) -----
$top_values = org_values('employee_current', $strongest['key']);
$strengths = [['key' => 'criterion', 'params' => ['criterion' => $strongest['key'], 'score' => $strongest['score'],
                                                  'top' => top_percent($top_values, $strongest['score'])]]];
$ideas = ideas_of($eid);
$implemented = 0;
foreach ($ideas as $i) { if ($i['status'] === 'implemented') { $implemented++; } }
if (count($ideas) > 0) {
    $strengths[] = ['key' => 'ideas', 'params' => ['count' => count($ideas), 'implemented' => $implemented]];
}
if ($colleagues >= 2) {
    $strengths[] = ['key' => 'colleagues', 'params' => ['count' => $colleagues]];
}

$development = [];
// 1) the lowest of the six performance dimensions (not Job Burnout, which is a risk)
$lowest = null;
foreach ($rows as $r) {
    if ($r['key'] !== 'job_burnout' && ($lowest === null || $r['score'] < $lowest['score'])) { $lowest = $r; }
}
$development[] = ['key' => 'criterion', 'params' => ['criterion' => $lowest['key'], 'score' => $lowest['score']]];
// 2) a development area of the person (a fact), else the weakest Innovation DNA trait below the company median,
//    else the lowest skill level
$dna = query('SELECT * FROM innovation_dna WHERE employee_id = ?', [$eid])->fetch();
$weak = null;
if ($dna) {
    foreach (DNA_TRAITS as $trait) {
        $median = median_of(org_values('innovation_dna', $trait));
        if ((int) $dna[$trait] < $median && ($weak === null || $dna[$trait] < $weak['value'])) {
            $weak = ['trait' => $trait, 'value' => (int) $dna[$trait], 'median' => $median];
        }
    }
}
if (isset($facts['development_area_2'])) {
    $development[] = ['key' => 'fact', 'params' => ['area' => $facts['development_area_2']]];
} elseif ($weak) {
    $development[] = ['key' => 'dna', 'params' => $weak];
} else {
    $skill = query('SELECT skill, level FROM skills WHERE employee_id = ? ORDER BY level, id LIMIT 1', [$eid])->fetch();
    if ($skill) { $development[] = ['key' => 'skill', 'params' => ['skill' => $skill['skill'], 'level' => (int) $skill['level']]]; }
}

$risks = [];
$relapse = $risk_level === 'high' ? 'high' : ($risk_level === 'watch' ? 'watch' : 'low');
$risks[] = ['level' => $relapse, 'key' => 'relapse', 'params' => ['limit' => $workload['limit'], 'rise' => $workload['rise']]];
if (isset($facts['meeting_change_pct']) && (int) $facts['meeting_change_pct'] > 0) {
    $risks[] = ['level' => 'low', 'key' => 'meetings', 'params' => ['pct' => (int) $facts['meeting_change_pct']]];
} else {
    $peer_overtime = [];
    foreach (query('SELECT c.overtime_hours_monthly AS h FROM employee_current c JOIN employees e ON e.id = c.employee_id
                    WHERE e.job_level = ?', [$p['job_level']])->fetchAll() as $o) { $peer_overtime[] = (float) $o['h']; }
    sort($peer_overtime);
    $typical = median_of($peer_overtime);
    $overtime = (float) $p['overtime_hours_monthly'];
    $risks[] = ['level' => $overtime > $typical + 3 ? 'watch' : 'low', 'key' => 'overtime',
                'params' => ['hours' => round($overtime), 'typical' => round($typical)]];
}

// Next steps (three at most): join a build that needs the person's role, pair on an own idea that needs a person,
// protect the recovery, then the growth module and a draft idea.
$growth = growth_of($eid);
$steps = [];
$join = joinable_idea($eid, $p['job_title']);
if ($join) { $steps[] = ['key' => 'join', 'params' => ['title' => $join['title']]]; }
foreach ($ideas as $i) {
    if ($i['open_roles'] && in_array($i['status'], ['approved', 'in_build'], true)) {
        $steps[] = ['key' => 'pair', 'params' => ['title' => $i['title']]]; break;
    }
}
if ((int) $p['burnout_change_6w'] <= -3 || $risk_level !== 'low') {
    $steps[] = ['key' => 'workload', 'params' => []];
}
if ($growth && $growth['progress'] < 100) { $steps[] = ['key' => 'module', 'params' => ['title' => $growth['title'], 'progress' => $growth['progress']]]; }
foreach ($ideas as $i) {
    if ($i['status'] === 'draft') { $steps[] = ['key' => 'draft', 'params' => ['title' => $i['title']]]; break; }
}
$steps = array_slice($steps, 0, 3);

// ----- Did the last intervention work? -----
$intervention = null;
$int = query('SELECT code, title, baseline_risk_pct, followup_risk_pct, current_risk_pct, detected_at, started_at, measured_at, improved
              FROM interventions WHERE employee_id = ? AND human_approved = 1 AND measured_at IS NOT NULL
              ORDER BY measured_at DESC LIMIT 1', [$eid])->fetch();
if ($int) {
    $before = month_row($eid, date('Y-m-01', strtotime($int['detected_at'])));
    $after = month_row($eid, date('Y-m-01', strtotime($int['measured_at'])));
    $intervention = [
        'code' => $int['code'], 'title' => $int['title'], 'improved' => (int) $int['improved'] === 1,
        'risk_before' => (int) $int['baseline_risk_pct'],
        'risk_after'  => (int) ($int['followup_risk_pct'] ?? $int['current_risk_pct']),
        'engagement_before' => $before ? (int) $before['engagement_score'] : null,
        'engagement_after'  => $after ? (int) $after['engagement_score'] : null,
        'task_before' => $before ? (int) $before['task_completion'] : null,
        'task_after'  => $after ? (int) $after['task_completion'] : null,
        'score_before' => $before ? (int) $before['empulse_score'] : null,
        'score_after'  => $after ? (int) $after['empulse_score'] : null,
        'started_at' => $int['started_at'],
    ];
}

send_json([
    'as_of'          => $dates['as_of'],
    'who'            => array_merge(who_block($p), ['badges' => $badges]),
    'compare_month'  => $compare_month,
    'score'          => $score,
    'doing'          => [
        'status'       => status_key($p),
        'strongest'    => ['key' => $strongest['key'], 'score' => $strongest['score']],
        'opportunity'  => ['key' => $opportunity['key'], 'score' => $opportunity['score']],
        'risk'         => ['pct' => $risk_pct, 'level' => $risk_level, 'trend' => $risk_trend],
        'workload'     => $workload['to'],
        'engagement'   => (int) $p['engagement_score'],
    ],
    'pulse'          => $pulse,
    'pulse_summary'  => pulse_summary($pulse),
    'burnout_june'   => $june ? (int) $june['burnout_risk_pct'] : null,
    'peak_week'      => $peak_risk >= 60 ? $peak_week : null,
    'timeline'       => $timeline,
    'events'         => array_map(function ($e) { unset($e['priority']); return $e; }, $events),
    'strengths'      => $strengths,
    'development'    => $development,
    'risks'          => $risks,
    'planner'        => planner_defaults($rows),
    'best_score'     => (int) query('SELECT MAX(empulse_score) AS b FROM monthly_scores WHERE employee_id = ?', [$eid])->fetch()['b'],
    'steps'          => $steps,
    'intervention'   => $intervention,
]);
