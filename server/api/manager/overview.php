<?php
// server/api/manager/overview.php — M01 Team Overview · Team Pulse Map.
// GET: the team of the signed-in manager (direct reports only): tier, six numbers, the pulse map, what is changing and the action queue.
// Totals use the whole team; with fewer than 5 people every total is null (suppressed).
// Interventions: only people (humans) approve them; this page only lists them.
require __DIR__ . '/../../manager_data.php';

$user = require_role(['manager']);
$mid = my_employee_id($user);
$dates = app_dates();
$me = load_person($mid);
$team = team_of($mid);
$teamInfo = team_name_of($mid);
$ids = array_map(function ($p) { return (int) $p['id']; }, $team);
$n = count($team);
$latest = $dates['latest_week'];
$show = $n >= MIN_GROUP;                                   // false = totals suppressed

$last_month = null; $prev_month = null;
$months = query('SELECT DISTINCT month FROM monthly_scores ORDER BY month DESC LIMIT 2')->fetchAll();
if (count($months) === 2) { $last_month = $months[0]['month']; $prev_month = $months[1]['month']; }

// ----- every person: score, tier, risk, status, wellbeing the person shares -----
$people = [];
$statusCount = ['at_risk' => 0, 'needs_attention' => 0, 'improving' => 0, 'healthy' => 0];
$attention = 0;
foreach ($team as $p) {
    $status = map_status($p);
    $statusCount[$status]++;
    if ((int) $p['burnout_risk_pct'] >= 60) { $attention++; }
    $int = query("SELECT code, title, status, started_at FROM interventions WHERE employee_id = ? AND owner_id = ?
                  AND status IN ('proposed','active') ORDER BY id DESC LIMIT 1", [$p['id'], $mid])->fetch();
    $people[] = [
        'id' => (int) $p['id'], 'name' => $p['full_name'], 'initials' => initials_of($p['full_name']), 'job_title' => $p['job_title'],
        'score' => (int) $p['empulse_score'], 'tier' => tier_key($p['tier']), 'performance' => (int) $p['task_completion'],
        'risk' => (int) $p['burnout_risk_pct'], 'status' => $status,
        'wellbeing' => shared_wellbeing((int) $p['id'], $latest),            // null when the person does not share
        'suggestion' => $int ? ['code' => $int['code'], 'title' => $int['title'], 'status' => $int['status']] : null,
    ];
}
// the most urgent person first (highest burnout risk)
usort($people, function ($a, $b) { return $b['risk'] <=> $a['risk']; });

// ----- the six numbers of the team -----
$tiles = null;
if ($show) {
    $score = mean_of(array_map(function ($p) { return (float) $p['empulse_score_exact']; }, $team));
    $scoreRounded = (int) round($score);
    $prevScore = $prev_month ? mean_of(array_map(function ($p) use ($prev_month) {
        $r = month_row((int) $p['id'], $prev_month); return $r ? (float) $r['empulse_score_exact'] : (float) $p['empulse_score_exact'];
    }, $team)) : null;
    $perf = mean_of(array_map(function ($p) { return (float) $p['task_completion']; }, $team));
    $inn = mean_of(array_map(function ($p) { return (float) $p['innovation_creativity']; }, $team));
    $perfSeries = team_month_series($ids, 'task_completion', 6);
    $innSeries = team_month_series($ids, 'innovation_creativity', 6);
    $engSeries = team_week_series($ids, 'engagement_score', 7, $latest);
    $riskSeries = team_week_series($ids, 'burnout_risk_pct', 7, $latest);
    $delta = function ($series) {
        return count($series) >= 2 ? (int) round($series[count($series) - 1]['v'] - $series[0]['v']) : null;
    };
    $ovt = team_week_series($ids, 'overtime_hours_monthly', 7, $latest);
    // people who share a wellbeing level / morale this week and 4 weeks ago (needs 5 people, else suppressed)
    $before = month_before_week($latest, 4);
    $wNow = []; $wBefore = []; $mNow = []; $mBefore = [];
    foreach ($ids as $id) {
        $a = shared_wellbeing($id, $latest);
        if ($a) { $wNow[] = $a['value']; $mNow[] = $a['morale']; }
        $b = shared_wellbeing($id, $before);
        if ($b) { $wBefore[] = $b['value']; $mBefore[] = $b['morale']; }
    }
    $wOk = count($wNow) >= MIN_GROUP;
    $ck = team_checkin_series($ids, 8, $latest);
    $wSeries = array_values(array_filter(array_map(function ($r) { return $r['wellbeing'] === null ? null : round($r['wellbeing'], 1); }, $ck), function ($v) { return $v !== null; }));
    $moodFull = team_mood_series($ids, 8, $latest);
    $moodSeries = array_map(function ($r) { return $r['v']; }, $moodFull);
    $moodNow = count($moodFull) ? (int) round($moodFull[count($moodFull) - 1]['v']) : null;
    $moodBefore = count($moodFull) > 4 ? $moodFull[count($moodFull) - 5]['v'] : null;
    $involved = (int) query('SELECT COUNT(DISTINCT m.employee_id) AS c FROM idea_members m JOIN ideas i ON i.id = m.idea_id
                             WHERE m.employee_id IN (' . implode(',', array_fill(0, $n, '?')) . ') AND i.created_at >= ?',
                            array_merge($ids, [substr($dates['as_of'], 0, 4) . '-01-01']))->fetch()['c'];
    $tiles = [
        'score'       => ['value' => $scoreRounded, 'tier' => tier_key(tier_for($scoreRounded)), 'next' => next_tier($scoreRounded),
                          'change' => $prevScore !== null ? $scoreRounded - (int) round($prevScore) : null],
        'performance' => ['value' => (int) round($perf), 'change' => $delta($perfSeries), 'series' => array_map(function ($r) { return round($r['v'], 1); }, $perfSeries)],
        'engagement'  => ['value' => (int) round(mean_of(array_map(function ($p) { return (float) $p['engagement_score']; }, $team))),
                          'change' => $delta($engSeries), 'series' => array_map(function ($r) { return round($r['v'], 1); }, $engSeries),
                          'overtime_up' => count($ovt) >= 2 && $ovt[count($ovt) - 1]['v'] > $ovt[0]['v']],
        'wellbeing'   => ['value' => $wOk ? (int) round(mean_of($wNow)) : null, 'n' => count($wNow), 'series' => $wOk ? $wSeries : [],
                          'change' => $wOk && count($wBefore) >= MIN_GROUP ? (int) round(mean_of($wNow) - mean_of($wBefore)) : null],
        'morale'      => ['value' => $moodNow, 'n' => $n, 'series' => $moodSeries,
                          'change' => $moodNow !== null && $moodBefore !== null ? (int) round($moodNow - $moodBefore) : null],
        'innovation'  => ['value' => (int) round($inn), 'change' => $delta($innSeries), 'series' => array_map(function ($r) { return round($r['v'], 1); }, $innSeries),
                          'involved' => $involved, 'of' => $n],
        'burnout'     => ['value' => (int) round(mean_of(array_map(function ($p) { return (float) $p['burnout_risk_pct']; }, $team))),
                          'change' => $delta($riskSeries), 'series' => array_map(function ($r) { return round($r['v'], 1); }, $riskSeries),
                          'above' => $attention],
    ];
}

// ----- what is changing (rules on the team's numbers) -----
$facts = facts_of($mid);
$changing = [];
if ($show) {
    $wl = team_week_series($ids, 'workload_index', 16, $latest);
        $base = count($wl) ? $wl[0]['v'] : null;
    if ($base && count($wl) >= 2) {
        $pct = (int) round(($wl[count($wl) - 1]['v'] - $base) / $base * 100);
        $changing[] = ['kind' => 'workload', 'pct' => isset($facts['m01_workload_pct']) ? (int) $facts['m01_workload_pct'] : $pct, 'roles' => isset($facts['unfilled_roles']) ? (int) $facts['unfilled_roles'] : null,
                       'role_name' => $facts['unfilled_role_name'] ?? null];
    }
    $heavy = array_filter($team, function ($p) { return (float) $p['overtime_hours_monthly'] / 4.33 >= 6; });
    if (count($heavy)) {
        $hours = (int) round(mean_of(array_map(function ($p) { return (float) $p['overtime_hours_monthly'] / 4.33; }, $heavy)));
        $changing[] = ['kind' => 'overtime', 'hours' => isset($facts['m01_overtime_hours']) ? (int) $facts['m01_overtime_hours'] : $hours,
                       'people' => isset($facts['m01_overtime_people']) ? (int) $facts['m01_overtime_people'] : count($heavy)];
    }
    if ($tiles['engagement']['change'] !== null) { $changing[] = ['kind' => 'engagement', 'delta' => $tiles['engagement']['change']]; }
    $month = substr($dates['as_of'], 0, 7);
    $ideas = (int) query('SELECT COUNT(DISTINCT i.id) AS c FROM ideas i JOIN idea_members m ON m.idea_id = i.id
                          WHERE m.employee_id IN (' . implode(',', array_fill(0, $n, '?')) . ') AND i.decided_at >= ?
                          AND i.status IN (\'approved\',\'in_build\',\'implemented\')',
                         array_merge($ids, [month_before($dates['as_of'], 1)]))->fetch()['c'];
    if (isset($facts['m01_ideas_approved'])) { $ideas = (int) $facts['m01_ideas_approved']; }
    if ($ideas > 0) { $changing[] = ['kind' => 'ideas', 'count' => $ideas]; }
}

// ----- the action queue: my interventions of this team (open ones) and one recognition suggestion -----
$queue = [];
$ints = query("SELECT i.code, i.employee_id, i.title, i.status, i.started_at, i.checkin_at, i.human_approved, i.root_cause, e.full_name
               FROM interventions i JOIN employees e ON e.id = i.employee_id
               WHERE i.owner_id = ? AND e.manager_id = ? AND i.status IN ('proposed','active')
               ORDER BY CASE i.status WHEN 'proposed' THEN 0 ELSE 1 END, i.started_at ASC, i.id DESC", [$mid, $mid])->fetchAll();
foreach ($ints as $i) {
    $day = null; $of = null;
    if ($i['status'] === 'active' && $i['started_at']) {
        $day = days_between($i['started_at'], $dates['as_of']) + 1;
        $of = $i['checkin_at'] ? days_between($i['started_at'], $i['checkin_at']) : 14;
    }
    $p = null; foreach ($team as $t) { if ((int) $t['id'] === (int) $i['employee_id']) { $p = $t; } }
    $queue[] = ['kind' => $i['status'] === 'proposed' ? 'decision' : 'progress', 'code' => $i['code'], 'employee_id' => (int) $i['employee_id'],
                'name' => $i['full_name'], 'initials' => initials_of($i['full_name']), 'risk' => $p ? (int) $p['burnout_risk_pct'] : null,
                'change' => $p ? (int) $p['burnout_change_6w'] : null, 'cause' => $i['root_cause'], 'title' => $i['title'],
                'day' => $day, 'of' => $of];
}
// recognition: a Gold-tier person with no recognition in the last 90 days, else the one with the highest score who was not recognised lately
$cand = null;
foreach ($team as $p) {
    $days = $p['last_recognized_at'] ? days_between($p['last_recognized_at'], $dates['as_of']) : 999;
    if ($days >= 90 && ($cand === null || (int) $p['empulse_score'] > (int) $cand['empulse_score'])) { $cand = $p; }
}
if ($cand === null) {                                       // nobody waited 90 days: the Gold person who waited longest
    foreach ($team as $p) {
        if (tier_key($p['tier']) === 'gold') { $cand = $p; break; }
    }
}
if ($cand) {
    $queue[] = ['kind' => 'recognize', 'employee_id' => (int) $cand['id'], 'name' => $cand['full_name'], 'initials' => initials_of($cand['full_name']),
                'tier' => tier_key($cand['tier']), 'title' => null];
}

$active = (int) query("SELECT COUNT(*) AS c FROM interventions WHERE owner_id = ? AND status = 'active'", [$mid])->fetch()['c'];

send_json([
    'who' => who_block($me),
    'team' => ['name' => $teamInfo['name'], 'people' => $n, 'avatars' => array_slice(array_map(function ($p) { return $p['initials']; }, $people), 0, 3)],
    'suppressed' => !$show,
    'attention' => $attention,
    'badges' => ['early_warning' => $attention, 'interventions' => $active],
    'tiles' => $tiles,
    'map' => ['counts' => $statusCount, 'people' => $people],
    'changing' => $changing,
    'queue' => $queue,
]);
