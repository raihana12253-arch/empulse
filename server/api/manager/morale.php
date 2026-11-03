<?php
// server/api/manager/morale.php — M07 Team Morale.
// GET: the team's mood over 12 weeks (median of the weekly check-ins, anonymous), the signals around it, the themes of the
// anonymous check-in comments (only when 5 or more people wrote comments) and what would lift morale fastest.
// Nothing here points to one person: no names, no individual answers.
require __DIR__ . '/../../manager_data.php';

$user = require_role(['manager']);
$mid = my_employee_id($user);
$dates = app_dates();
$latest = $dates['latest_week'];
$me = load_person($mid);
$team = team_of($mid);
$teamInfo = team_name_of($mid);
$base = manager_frame($me, $team, $teamInfo, $mid);
$n = count($team);
if ($n < MIN_GROUP) { send_json($base + ['suppressed' => true]); }
$ids = team_ids($team);
$facts = facts_of($mid);

// chart: median mood per week, 12 weeks
$series = team_mood_series($ids, 12, $latest);
$points = array_map(function ($r) { return ['week' => $r['week'], 'v' => (int) round($r['v'])]; }, $series);
$events = [];
foreach (notes_of($mid, 'team_event') as $e) {
    // put the event on the nearest week of the chart
    $best = null;
    foreach ($points as $i => $pt) {
        $d = abs(strtotime($pt['week']) - strtotime($e['detail']));
        if ($best === null || $d < $best[1]) { $best = [$i, $d]; }
    }
    if ($best !== null && $best[1] <= 7 * 86400) { $events[] = ['title' => $e['title'], 'index' => $best[0], 'date' => $e['detail']]; }
}
$moraleNow = count($points) ? $points[count($points) - 1]['v'] : null;
$moraleThen = count($points) ? $points[0]['v'] : null;

// signals (team numbers; change = since the start of the 12 weeks)
$thisM = query('SELECT MAX(month) AS m FROM monthly_scores')->fetch()['m'];
$thenM = month_before($thisM, 3);
$aNow = criteria_avgs($ids, null); $aThen = criteria_avgs($ids, $thenM);      // now against the end of last quarter (June), like M03
$engNow = (int) round($aNow['engagement_score']);
$engThen = $aThen ? (int) round($aThen['engagement_score']) : null;
$riskNow = (int) round(mean_of(array_map(function ($p) { return (float) $p['burnout_risk_pct']; }, $team)));
$riskThen = $aThen ? (int) round($aThen['burnout_risk_pct']) : null;
$collabNow = (int) round($aNow['teamwork']);
$collabThen = $aThen ? (int) round($aThen['teamwork']) : null;
// people in at least one idea this year (like M01), against the same count 90 days ago
$involved = function ($before) use ($ids, $dates) {
    return (int) query('SELECT COUNT(DISTINCT m.employee_id) AS c FROM idea_members m JOIN ideas i ON i.id = m.idea_id
                        WHERE m.employee_id IN (' . implode(',', array_fill(0, count($ids), '?')) . ') AND i.created_at >= ? AND i.created_at < ?',
                       array_merge($ids, [substr($dates['as_of'], 0, 4) . '-01-01', $before]))->fetch()['c'];
};
$innNow = (int) round($involved(date('Y-m-d', strtotime($dates['as_of'] . ' +1 day'))) / $n * 100);
$innThen = (int) round($involved(date('Y-m-d', strtotime($dates['as_of'] . ' -90 days'))) / $n * 100);
$recogGap = isset($facts['m03_recog_gap_pct']) ? (int) $facts['m03_recog_gap_pct'] : null;
$wl = isset($facts['m07_workload_level']) ? (int) $facts['m07_workload_level'] : null;
$d = function ($a, $b) { return $a === null || $b === null ? null : $a - $b; };
$signals = [
    ['key' => 'morale', 'value' => $moraleNow, 'change' => $d($moraleNow, $moraleThen), 'good_up' => true],
    ['key' => 'engagement', 'value' => $engNow, 'change' => $d($engNow, $engThen), 'good_up' => true],
    ['key' => 'recognition', 'value' => $recogGap === null ? null : 100 - $recogGap, 'change' => isset($facts['m07_recog_change']) ? -(int) $facts['m07_recog_change'] : null, 'good_up' => true],
    ['key' => 'collaboration', 'value' => $collabNow, 'change' => $d($collabNow, $collabThen), 'good_up' => true],
    ['key' => 'innovation', 'value' => $innNow, 'change' => isset($facts['m07_inn_change']) ? (int) $facts['m07_inn_change'] : $d($innNow, $innThen), 'good_up' => true],
    ['key' => 'workload', 'value' => $wl, 'change' => isset($facts['m01_workload_pct']) ? (int) $facts['m01_workload_pct'] : null, 'good_up' => false, 'pct' => true],
    ['key' => 'burnout', 'value' => $riskNow, 'change' => $d($riskNow, $riskThen), 'good_up' => false, 'pct' => true],
];

// themes of the anonymous comments of the last 12 weeks: identical comments are one theme.
// Shown only when 5 or more different people wrote comments, and a theme needs 3 or more mentions. Never who wrote them.
$since = month_before_week($latest, 12);
$rows = try_query('SELECT c.note AS note, COUNT(*) AS mentions, COALESCE(MIN(t.tone), ?) AS tone FROM checkins c
                   LEFT JOIN checkin_themes t ON t.note = c.note
                   WHERE c.employee_id IN (' . implode(',', array_fill(0, $n, '?')) . ') AND c.week_start > ? AND c.note IS NOT NULL AND c.note <> ?
                   GROUP BY c.note ORDER BY mentions DESC, c.note', array_merge(['watch'], $ids, [$since, '']));
$writers = try_query('SELECT COUNT(DISTINCT employee_id) AS c FROM checkins WHERE employee_id IN (' . implode(',', array_fill(0, $n, '?')) . ') AND week_start > ? AND note IS NOT NULL AND note <> ?',
                     array_merge($ids, [$since, '']));
$writerCount = $writers ? (int) $writers[0]['c'] : 0;
$themes = [];
if ($writerCount >= MIN_GROUP) {
    foreach ($rows as $r) {
        if ((int) $r['mentions'] >= 3) { $themes[] = ['text' => $r['note'], 'mentions' => (int) $r['mentions'], 'tone' => $r['tone']]; }
    }
}
$lift = array_map(function ($x) { return $x['title']; }, notes_of($mid, 'morale_lift'));

send_json($base + ['suppressed' => false, 'n' => $n, 'chart' => ['points' => $points, 'events' => $events],
    'signals' => $signals, 'themes' => $themes, 'themes_hidden' => $writerCount < MIN_GROUP, 'lift' => $lift]);
