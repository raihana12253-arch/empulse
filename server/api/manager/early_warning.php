<?php
// server/api/manager/early_warning.php — M06 Burnout Early Warning.
// GET ?id= : the people with elevated burnout risk (60%+) as cards, and the five-step view of one of them
// (risk, root causes, evidence, recommended action, follow-up) with the trajectory and the signal strengths.
// Only direct reports. Risk is decision support, not a diagnosis. Forecasts and projections are labelled "projected".
// Interventions start only after a human approves them (human_approved = 1) - this screen never starts one.
require __DIR__ . '/../../manager_data.php';

$user = require_role(['manager']);
$mid = my_employee_id($user);
$dates = app_dates();
$latest = $dates['latest_week'];
$asOf = $dates['as_of'];
$me = load_person($mid);
$team = team_of($mid);
$teamInfo = team_name_of($mid);
$base = manager_frame($me, $team, $teamInfo, $mid);
$n = count($team);

// the cards: elevated risk first
$cards = []; $watch = 0; $healthy = 0;
foreach ($team as $p) {
    $st = map_status($p);
    if ($st === 'needs_attention') { $watch++; }
    if ($st === 'improving' || $st === 'healthy') { $healthy++; }
    if ((int) $p['burnout_risk_pct'] >= 60) {
        $cards[] = ['id' => (int) $p['id'], 'name' => $p['full_name'], 'initials' => initials_of($p['full_name']), 'job_title' => $p['job_title'],
                    'risk' => (int) $p['burnout_risk_pct'], 'change' => (int) $p['burnout_change_6w']];
    }
}
usort($cards, function ($a, $b) { return $b['risk'] <=> $a['risk']; });
$base += ['cards' => $cards, 'watch' => $watch, 'healthy' => $healthy, 'of' => $n];
if (!count($cards)) { send_json($base + ['detail' => null]); }

$sel = (int) ($_GET['id'] ?? 0);
$ids = array_map(function ($c) { return $c['id']; }, $cards);
if (!in_array($sel, $ids, true)) { $sel = $ids[0]; }
$p = null;
foreach ($team as $t) { if ((int) $t['id'] === $sel) { $p = $t; } }
$id = $sel;
$f = facts_of($id);
$risk = (int) $p['burnout_risk_pct'];
$tier = tier_key($p['tier']);

// ----- weekly history -----
$hist = week_series('weekly_metrics', 'burnout_risk_pct', $id, $latest, 12);
$wk6 = month_before_week($latest, 6);
$risk6 = week_value('weekly_metrics', 'burnout_risk_pct', $id, $wk6);
if ($risk6 === null) { $risk6 = $risk - (int) $p['burnout_change_6w']; }
$risk6 = (int) $risk6;
$change = $risk - $risk6;

// ----- who and when it was detected -----
$int = query('SELECT * FROM interventions WHERE employee_id = ? ORDER BY detected_at DESC, id DESC LIMIT 1', [$id])->fetch();
$detected = $int ? $int['detected_at'] : null;
if (!$detected) { foreach ($hist as $h) { if ($h['v'] >= 60) { $detected = $h['week']; break; } } }
$mgr = query('SELECT full_name FROM employees WHERE id = ?', [(int) $p['manager_id']])->fetch();
$team_row = query('SELECT t.name AS name FROM employees e LEFT JOIN teams t ON t.id = e.team_id WHERE e.id = ?', [$id])->fetch();
$person = ['id' => $id, 'name' => $p['full_name'], 'first_name' => explode(' ', $p['full_name'])[0], 'initials' => initials_of($p['full_name']), 'job_title' => $p['job_title'],
           'team' => $team_row ? $team_row['name'] : $teamInfo['name'], 'manager' => $mgr ? $mgr['full_name'] : $me['full_name'], 'detected' => $detected,
           'tier' => $tier, 'score' => (int) $p['empulse_score'], 'similar' => isset($f['ew_similar']) ? (int) $f['ew_similar'] : null];

// ----- 1. risk -----
$riskBlock = ['now' => $risk, 'six_weeks_ago' => $risk6, 'change' => $change, 'level' => $risk >= 60 ? 'elevated' : 'watch', 'rising_fast' => $change >= 10,
              'forecast' => isset($f['forecast_pct']) ? ['pct' => (int) $f['forecast_pct'], 'weeks' => (int) ($f['forecast_weeks'] ?? 3)] : null,
              'horizon' => isset($f['proj_horizon_weeks']) ? (int) $f['proj_horizon_weeks'] : null, 'confidence' => $f['proj_confidence'] ?? null];

// ----- 2. root causes: the rise since 6 weeks ago split over the drivers -----
$causes = [];
if ($change > 0) {
    if (isset($f['rc_workload'])) {
        $raw = ['workload' => (float) $f['rc_workload'], 'overtime' => (float) $f['rc_overtime'], 'engagement' => (float) $f['rc_engagement'], 'recognition' => (float) $f['rc_recognition']];
    } else {
        $map = ['workload_index' => 'workload', 'overtime_hours_monthly' => 'overtime', 'engagement_score' => 'engagement', 'recognition_90d' => 'recognition'];
        $raw = ['workload' => 0.0, 'overtime' => 0.0, 'engagement' => 0.0, 'recognition' => 0.0, 'other' => 0.0];
        $dr = json_decode($p['burnout_drivers'], true);
        foreach (($dr['increasing'] ?? []) as $d) { $raw[$map[$d['feature']] ?? 'other'] += max(0.0, (float) $d['impact_pts']); }
    }
    $sum = array_sum($raw);
    if ($sum > 0) {
        $alloc = []; $rem = [];
        foreach ($raw as $k => $v) { $x = $v / $sum * $change; $alloc[$k] = (int) floor($x); $rem[$k] = $x - floor($x); }
        arsort($rem);
        $left = $change - array_sum($alloc);
        foreach (array_keys($rem) as $k) { if ($left <= 0) { break; } $alloc[$k]++; $left--; }
        foreach (['workload', 'overtime', 'engagement', 'recognition', 'other'] as $k) { if (isset($alloc[$k]) && $alloc[$k] > 0) { $causes[] = ['key' => $k, 'pts' => $alloc[$k]]; } }
    }
}

// ----- 3. evidence -----
$wl12 = week_series('weekly_metrics', 'workload_index', $id, month_before_week($latest, 1), 12);
$wlAvg = count($wl12) ? mean_of(array_map(function ($r) { return $r['v']; }, $wl12)) : null;
$wlNow = week_value('weekly_metrics', 'workload_index', $id, $latest);
$wlPct = isset($f['ind_workload_pct']) ? (int) $f['ind_workload_pct'] : ($wlAvg && $wlNow !== null ? (int) round(($wlNow / $wlAvg - 1) * 100) : null);
$hours = week_series('weekly_activity', 'work_hours', $id, $latest, 7);
$after = week_series('weekly_activity', 'after_hours', $id, $latest, 7);
$engS = week_series('weekly_metrics', 'engagement_score', $id, $latest, 7);
$otHours = isset($f['ind_overtime_hours']) ? (int) $f['ind_overtime_hours'] : (count($hours) ? max(0, (int) round($hours[count($hours) - 1]['v'] - 40)) : null);
$line = function ($s) { return count($s) ? ['from' => (int) round($s[0]['v']), 'to' => (int) round($s[count($s) - 1]['v']), 'series' => array_map(function ($r) { return round($r['v'], 1); }, $s)] : null; };
$fixLine = function ($ln, $a, $b) use ($f) { if ($ln && isset($f[$a]) && isset($f[$b])) { $ln['from'] = (int) $f[$a]; $ln['to'] = (int) $f[$b]; } return $ln; };
$evidence = ['hours' => $fixLine($line($hours), 'ew_hours_from', 'ew_hours_to'), 'after_hours' => $fixLine($line($after), 'ew_after_from', 'ew_after_to'), 'engagement' => $line($engS),
             'open_tasks' => isset($f['ew_open_from']) ? ['from' => (int) $f['ew_open_from'], 'to' => (int) $f['ew_open_to']] : null,
             'energy' => energy_of($id)];
$recogDays = $p['last_recognized_at'] ? (int) floor((strtotime($asOf) - strtotime($p['last_recognized_at'])) / 86400) : null;
if (isset($f['recog_days'])) { $recogDays = (int) $f['recog_days']; }
foreach ($causes as &$c) {
    if ($c['key'] === 'workload') { $c['pct'] = $wlPct; }
    if ($c['key'] === 'overtime') { $c['hours'] = $otHours; $c['weekends'] = isset($f['ew_weekends']) ? (int) $f['ew_weekends'] : null; }
    if ($c['key'] === 'engagement') { $c['pct'] = $evidence['engagement'] ? $evidence['engagement']['to'] - $evidence['engagement']['from'] : null; }
    if ($c['key'] === 'recognition') { $c['days'] = $recogDays; }
}
unset($c);

// ----- 4. recommended action (notes of the design, otherwise rule-based) -----
$notes = notes_of($id, 'ew_action');
$actions = [];
if (count($notes)) {
    foreach ($notes as $a) { $actions[] = ['title' => $a['title'], 'lines' => $a['detail'] ? explode('|', $a['detail']) : [], 'pts' => $a['num'] === null ? null : (int) $a['num']]; }
} else {
    $top = count($causes) ? $causes[0]['key'] : 'workload';
    $actions = [['k' => 'ew.a_' . $top, 'pts' => null], ['k' => 'ew.a_checkin', 'pts' => null], ['k' => 'ew.a_review', 'pts' => null]];
}
$projection = isset($f['proj_risk']) ? ['from' => $risk, 'to' => (int) $f['proj_risk'], 'weeks' => 4] : null;
$pending = $int ? ['code' => $int['code'], 'status' => $int['status'], 'approved' => (int) $int['human_approved'] === 1] : null;

// ----- 5. follow-up -----
$steps = [];
$fu = notes_of($id, 'ew_followup');
if (count($fu)) {
    foreach ($fu as $s) { $steps[] = ['title' => $s['title'], 'detail' => $s['detail'], 'date' => $s['footer'], 'done' => $s['footer'] <= $asOf]; }
} elseif ($int) {
    foreach ([['Detected', 'detected_at'], ['Proposed', 'proposed_at'], ['Approved', 'approved_at'], ['Check-in', 'checkin_at'], ['Review', 'followup_at'], ['Outcome', 'measured_at']] as $pair) {
        if ($int[$pair[1]]) { $steps[] = ['k' => 'ew.fu_' . $pair[1], 'date' => $int[$pair[1]], 'done' => $int[$pair[1]] <= $asOf]; }
    }
}

usort($steps, function ($a, $b) { return strcmp($a['date'], $b['date']); });

// ----- trajectory: 12 weeks and two futures (only when the design/ML forecast exists) -----
$trajectory = ['history' => $hist, 'forecast' => $riskBlock['forecast'] ? ['nothing' => $riskBlock['forecast']['pct'], 'plan' => $projection ? $projection['to'] : null, 'weeks' => 4] : null];

// ----- signal strengths (1-5 bars) -----
$bars = function ($value, $full) { return $value === null || $value <= 0 ? 0 : (int) min(5, max(1, ceil($value / $full * 5))); };
$engDrop = $evidence['engagement'] ? max(0, $evidence['engagement']['from'] - $evidence['engagement']['to']) : null;
$perfNow = (int) $p['task_completion'];
$thenRow = month_row($id, month_before($asOf, 3));
$perfDrop = $thenRow ? max(0, (int) $thenRow['task_completion'] - $perfNow) : 0;
$signals = [
    ['key' => 'workload', 'value' => $wlPct, 'bars' => $bars($wlPct, 15)],
    ['key' => 'overtime', 'value' => $otHours, 'bars' => $bars($otHours, 10)],
    ['key' => 'engagement', 'value' => $engDrop === null ? null : -$engDrop, 'bars' => $bars($engDrop, 18)],
    ['key' => 'recognition', 'value' => $recogDays, 'bars' => $bars($recogDays, 120)],
];
if ($evidence['open_tasks']) { $signals[] = ['key' => 'tasks', 'value' => $evidence['open_tasks']['to'], 'bars' => $bars($evidence['open_tasks']['to'], 20)]; }
if ($evidence['energy']) { $signals[] = ['key' => 'motivation', 'value' => null, 'bars' => min(5, (int) $evidence['energy']['low_weeks'])]; }
$signals[] = ['key' => 'performance', 'value' => $perfNow, 'bars' => max(1, $bars($perfDrop, 20)), 'tier' => $tier];

send_json($base + ['detail' => ['person' => $person, 'risk' => $riskBlock, 'causes' => $causes, 'evidence' => $evidence, 'actions' => $actions,
    'projection' => $projection, 'intervention' => $pending, 'steps' => $steps, 'trajectory' => $trajectory, 'signals' => $signals]]);
