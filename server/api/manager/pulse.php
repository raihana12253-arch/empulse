<?php
// server/api/manager/pulse.php — M03 Team Pulse.
// GET: the seven pulses of the team now and at the end of last quarter, why the pulse changed, and the team against its department.
// Team numbers only. With fewer than 5 people everything is suppressed. The explanation is a rule on the numbers (no language model).
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
$facts = facts_of($mid);
$attention = count(array_filter($team, function ($p) { return (int) $p['burnout_risk_pct'] >= 60; }));

$base = ['who' => who_block($me), 'team' => ['name' => $teamInfo['name'], 'people' => $n, 'avatars' => array_map(function ($p) { return initials_of($p['full_name']); }, array_slice($team, 0, 3))],
         'badges' => ['early_warning' => $attention, 'interventions' => (int) query("SELECT COUNT(*) AS c FROM interventions WHERE owner_id = ? AND status = 'active'", [$mid])->fetch()['c']],
         'attention' => $attention];
if ($n < MIN_GROUP) { send_json($base + ['suppressed' => true]); }

$q2 = month_before($dates['as_of'], 3);                      // end of last quarter (June)
$now = criteria_avgs($ids, null);
$then = criteria_avgs($ids, $q2);
$pulse = [];
foreach (CRITERIA_ORDER as $key) {
    $pulse[] = ['key' => $key, 'now' => (int) round($now[$key]), 'before' => $then ? (int) round($then[$key]) : null];
}

// ----- why the pulse changed -----
$wl = team_week_series($ids, 'workload_index', 16, $latest);
$wlPct = count($wl) >= 2 && $wl[0]['v'] ? (int) round(($wl[count($wl) - 1]['v'] - $wl[0]['v']) / $wl[0]['v'] * 100) : null;
$heavy = array_filter($team, function ($p) { return (float) $p['overtime_hours_monthly'] / 4.33 >= 6; });
$otHours = count($heavy) ? (int) round(mean_of(array_map(function ($p) { return (float) $p['overtime_hours_monthly'] / 4.33; }, $heavy))) : null;
$gap = count(array_filter($team, function ($p) use ($dates) { $d = days_ago($p['last_recognized_at'], $dates['as_of']); return $d === null || $d > 60; }));
$gapPct = (int) round($gap / $n * 100);
$wm = wellbeing_by_month($ids, $latest);
$wbNow = $wm[substr($dates['as_of'], 0, 7)] ?? null; $wbThen = $wm[substr($q2, 0, 7)] ?? null;
$fall = isset($facts['m03_fall_pts']) ? (int) $facts['m03_fall_pts'] : ($wbNow !== null && $wbThen !== null ? (int) round($wbThen - $wbNow) : null);
$drivers = [
    ['key' => 'workload', 'pct' => isset($facts['m01_workload_pct']) ? (int) $facts['m01_workload_pct'] : $wlPct, 'roles' => isset($facts['unfilled_roles']) ? (int) $facts['unfilled_roles'] : null,
     'role_name' => $facts['unfilled_role_name'] ?? null, 'effect' => isset($facts['m03_workload_effect']) ? (int) $facts['m03_workload_effect'] : null],
    ['key' => 'overtime', 'hours' => isset($facts['m01_overtime_hours']) ? (int) $facts['m01_overtime_hours'] : $otHours,
     'people' => isset($facts['m01_overtime_people']) ? (int) $facts['m01_overtime_people'] : count($heavy), 'note' => $facts['m03_overtime_note'] ?? null,
     'effect' => isset($facts['m03_overtime_effect']) ? (int) $facts['m03_overtime_effect'] : null],
    ['key' => 'recognition', 'pct' => isset($facts['m03_recog_gap_pct']) ? (int) $facts['m03_recog_gap_pct'] : $gapPct, 'effect' => isset($facts['m03_recog_effect']) ? (int) $facts['m03_recog_effect'] : null],
];
$drivers = array_values(array_filter($drivers, function ($d) { return ($d['key'] === 'recognition') ? $d['pct'] > 0 : (($d['pct'] ?? $d['hours'] ?? 0) > 0); }));
$why = ['fall' => $fall, 'share' => isset($facts['m03_workload_share']) ? (int) $facts['m03_workload_share'] : null, 'drivers' => $drivers,
        'innovation_up' => $then ? ((int) round($now['innovation_creativity']) > (int) round($then['innovation_creativity'])) : false];

// ----- the team against its department (a group of 5 or more people) -----
$dept = query('SELECT d.id, d.name FROM employees e JOIN departments d ON d.id = e.department_id WHERE e.id = ?', [$mid])->fetch();
$deptIds = array_map(function ($r) { return (int) $r['id']; }, query('SELECT id FROM employees WHERE department_id = ?', [$dept['id']])->fetchAll());
$deptAvg = count($deptIds) >= MIN_GROUP ? criteria_avgs($deptIds, null) : null;
$vs = [];
if ($deptAvg) {
    foreach (['task_completion', 'job_burnout', 'teamwork', 'innovation_creativity', 'professional_behavior'] as $key) {
        $vs[] = ['key' => $key, 'team' => (int) round($now[$key]), 'dept' => (int) round($deptAvg[$key])];
    }
}

send_json($base + ['suppressed' => false, 'q2' => $q2, 'pulse' => $pulse, 'why' => $why,
    'dept' => ['name' => $dept['name'], 'people' => count($deptIds), 'rows' => $vs]]);
