<?php
// server/api/manager/matrix.php — M05 Performance-Wellbeing (the 2x2 of the team).
// GET: every direct report on two axes - performance (task completion) and the wellbeing signal (100 - burnout risk) -
// with the place they had last quarter. Decision support, not a diagnosis; only the manager's direct reports.
require __DIR__ . '/../../manager_data.php';

$user = require_role(['manager']);
$mid = my_employee_id($user);
$dates = app_dates();
$me = load_person($mid);
$team = team_of($mid);
$teamInfo = team_name_of($mid);
$base = manager_frame($me, $team, $teamInfo, $mid);

if (count($team) < MIN_GROUP) { send_json($base + ['suppressed' => true]); }

$q2 = month_before($dates['as_of'], 3);          // end of last quarter (month row)
$people = []; $counts = ['thriving' => 0, 'burnout_risk' => 0, 'development' => 0, 'critical' => 0];
$up = 0; $down = 0;
foreach ($team as $p) {
    $id = (int) $p['id'];
    $perf = (int) $p['task_completion']; $well = 100 - (int) $p['burnout_risk_pct'];
    $quad = quadrant_of($perf, $well);
    $counts[$quad]++;
    $then = month_row($id, $q2);
    $prev = null; $moved = null;
    if ($then) {
        $pp = (int) $then['task_completion']; $pw = (int) $then['job_burnout'];
        $pq = quadrant_of($pp, $pw);
        $prev = ['perf' => $pp, 'well' => $pw, 'quad' => $pq];
        if ($pq !== $quad) {
            $moved = quadrant_rank($quad) > quadrant_rank($pq) ? 'up' : 'down';
            if ($moved === 'up') { $up++; } else { $down++; }
        }
    }
    $people[] = ['id' => $id, 'name' => $p['full_name'], 'first_name' => explode(' ', $p['full_name'])[0], 'initials' => initials_of($p['full_name']),
                 'job_title' => $p['job_title'], 'perf' => $perf, 'well' => $well, 'risk' => (int) $p['burnout_risk_pct'], 'quad' => $quad, 'prev' => $prev, 'moved' => $moved];
}
usort($people, function ($a, $b) { return $a['well'] <=> $b['well']; });     // lowest wellbeing first (who needs support first)

// the playbook of the burnout-risk group: the numbers of the first person who has a projection (display values of the design)
$playbook = null;
foreach ($people as $pe) {
    if ($pe['quad'] !== 'burnout_risk') { continue; }
    $f = facts_of($pe['id']);
    if (isset($f['proj_cases_n'])) {
        $playbook = ['n' => (int) $f['proj_cases_n'], 'total' => (int) $f['proj_cases_total'], 'drop' => (int) $f['proj_cases_drop'], 'weeks' => (int) $f['proj_cases_weeks']];
        break;
    }
}

send_json($base + ['suppressed' => false, 'cuts' => ['perf' => MATRIX_PERF_CUT, 'well' => MATRIX_WELL_CUT],
    'prev_month' => $q2, 'now_month' => substr($dates['as_of'], 0, 7) . '-01',
    'counts' => $counts, 'moved' => ['n' => $up + $down, 'up' => $up, 'down' => $down], 'people' => $people, 'playbook' => $playbook]);
