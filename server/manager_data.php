<?php
// =====================================================================
// server/manager_data.php — shared by the manager screens (M01 ...).
// Each API file (server/api/manager/*.php) starts with:
//     require __DIR__ . '/../../manager_data.php';
//     $user = require_role(['manager']);
//     $mid  = my_employee_id($user);
// PRIVACY (enforced here, not in the browser):
//   - a manager sees only the people who report to them directly (employees.manager_id = the manager);
//   - private check-in answers are never returned; a "wellbeing level" is returned only when the person
//     allows it (user_settings.share_wellbeing is not 0) AND shared that week's check-in (checkins.share_trend = 1);
//   - team numbers are totals; with fewer than 5 people they are suppressed (null).
// =====================================================================

require_once __DIR__ . '/employee_data.php';

const MIN_GROUP = 5;               // groups smaller than this never show totals

// The direct reports of a manager with their current numbers.
function team_of($mid)
{
    $sql = 'SELECT e.id, e.full_name, e.job_title, e.manager_id, c.empulse_score, c.empulse_score_exact, c.tier,
                   c.burnout_risk_pct, c.burnout_change_6w, c.engagement_score, c.task_completion, c.innovation_creativity,
                   c.workload_index, c.overtime_hours_monthly, c.last_recognized_at, c.burnout_drivers
            FROM employees e JOIN employee_current c ON c.employee_id = e.id
            WHERE e.manager_id = ? ORDER BY e.full_name';
    return query($sql, [$mid])->fetchAll();
}

// The one team of this manager: name and id (employees.team_id of the manager).
function team_name_of($mid)
{
    $row = query('SELECT t.id, t.name FROM employees e JOIN teams t ON t.id = e.team_id WHERE e.id = ?', [$mid])->fetch();
    return $row ?: ['id' => null, 'name' => ''];
}

// May this manager see this person? (a direct report only)
function is_my_report($mid, $eid)
{
    return (bool) query('SELECT 1 FROM employees WHERE id = ? AND manager_id = ?', [$eid, $mid])->fetch();
}

// The wellbeing signal of one check-in week, 0-100: half energy (1-5 -> 0-100), half morale. NOT part of the EMPULSE Score.
function wellbeing_value($energy, $morale)
{
    return (int) round((($energy - 1) / 4 * 100 + $morale) / 2);
}

function wellbeing_level($value)
{
    return $value < 40 ? 'low' : ($value < 70 ? 'medium' : 'high');
}

// The wellbeing a person SHARES with the manager for a week: ['value' => 42, 'level' => 'medium'] or null.
function shared_wellbeing($eid, $week)
{
    $off = query('SELECT setting_value FROM user_settings WHERE employee_id = ? AND setting_key = ?', [$eid, 'share_wellbeing'])->fetch();
    if ($off && (int) $off['setting_value'] === 0) { return null; }
    $row = query('SELECT energy, morale, share_trend FROM checkins WHERE employee_id = ? AND week_start = ?', [$eid, $week])->fetch();
    if (!$row || (int) $row['share_trend'] !== 1) { return null; }
    $value = wellbeing_value((int) $row['energy'], (int) $row['morale']);
    return ['value' => $value, 'level' => wellbeing_level($value), 'morale' => (int) $row['morale']];
}

// Average of a list (null for an empty list).
function mean_of($values)
{
    return count($values) ? array_sum($values) / count($values) : null;
}

// The median of a list (null for an empty list).
function median_list($values)
{
    if (!count($values)) { return null; }
    sort($values);
    $n = count($values);
    return $n % 2 ? $values[intdiv($n, 2)] : ($values[$n / 2 - 1] + $values[$n / 2]) / 2;
}

// A week series of one column, averaged over the team: [['week' => '2026-08-03', 'v' => 43.6], ...] oldest first.
function team_week_series($ids, $column, $weeks, $latest)
{
    if (!count($ids)) { return []; }
    $allowed = ['workload_index', 'engagement_score', 'burnout_risk_pct', 'overtime_hours_monthly'];
    if (!in_array($column, $allowed, true)) { return []; }
    $marks = implode(',', array_fill(0, count($ids), '?'));
    $sql = 'SELECT week_start, AVG(' . $column . ') AS v FROM weekly_metrics WHERE employee_id IN (' . $marks . ') AND week_start <= ?
            GROUP BY week_start ORDER BY week_start DESC LIMIT ' . (int) $weeks;
    $rows = query($sql, array_merge($ids, [$latest]))->fetchAll();
    return array_reverse($rows);
}

// A month series of one score column, averaged over the team, oldest first.
function team_month_series($ids, $column, $months)
{
    if (!count($ids)) { return []; }
    $allowed = ['task_completion', 'innovation_creativity', 'empulse_score_exact', 'engagement_score', 'burnout_risk_pct'];
    if (!in_array($column, $allowed, true)) { return []; }
    $marks = implode(',', array_fill(0, count($ids), '?'));
    $sql = 'SELECT month, AVG(' . $column . ') AS v FROM monthly_scores WHERE employee_id IN (' . $marks . ')
            GROUP BY month ORDER BY month DESC LIMIT ' . (int) $months;
    return array_reverse(query($sql, $ids)->fetchAll());
}

// Status of a person on the team map: at_risk = risk 60%+, needs_attention = 45-59%, improving = below 45% and not rising over 6 weeks, else healthy.
function map_status($p)
{
    if ($p['burnout_risk_pct'] >= 60) { return 'at_risk'; }
    if ($p['burnout_risk_pct'] >= 45) { return 'needs_attention'; }
    if ((int) $p['burnout_change_6w'] <= 2) { return 'improving'; }       // risk below 45% and not rising in the last 6 weeks
    return 'healthy';
}

// The Monday N weeks before a Monday ('2026-09-14', 4 -> '2026-08-17').
function month_before_week($monday, $weeks)
{
    return date('Y-m-d', strtotime($monday . ' -' . ((int) $weeks * 7) . ' days'));
}

// ----- weekly series of the signals people share (P3-04) -----
// People who switched sharing off (user_settings.share_wellbeing = 0) are left out.
function sharing_ids($ids)
{
    $out = [];
    foreach ($ids as $id) {
        $off = query('SELECT setting_value FROM user_settings WHERE employee_id = ? AND setting_key = ?', [$id, 'share_wellbeing'])->fetch();
        if (!($off && (int) $off['setting_value'] === 0)) { $out[] = (int) $id; }
    }
    return $out;
}

// Team wellbeing per week from the check-ins that were SHARED as a trend. A week with fewer than 5 sharers has no value (null).
// Returns [['week' => '2026-09-14', 'wellbeing' => 55.2, 'morale' => 60, 'n' => 5], ...] oldest first.
function team_checkin_series($ids, $weeks, $latest)
{
    $ids = sharing_ids($ids);
    if (!count($ids)) { return []; }
    $marks = implode(',', array_fill(0, count($ids), '?'));
    $rows = query('SELECT week_start, energy, morale FROM checkins WHERE employee_id IN (' . $marks . ') AND share_trend = 1 AND week_start <= ?
                   AND week_start > ? ORDER BY week_start', array_merge($ids, [$latest, month_before_week($latest, (int) $weeks)]))->fetchAll();
    $by = [];
    foreach ($rows as $r) { $by[$r['week_start']][] = $r; }
    $out = [];
    for ($i = (int) $weeks - 1; $i >= 0; $i--) {
        $w = month_before_week($latest, $i);
        $list = $by[$w] ?? [];
        if (count($list) >= MIN_GROUP) {
            $out[] = ['week' => $w, 'n' => count($list),
                      'wellbeing' => mean_of(array_map(function ($r) { return wellbeing_value((int) $r['energy'], (int) $r['morale']); }, $list)),
                      'morale' => median_list(array_map(function ($r) { return (int) $r['morale']; }, $list))];
        } else {
            $out[] = ['week' => $w, 'n' => count($list), 'wellbeing' => null, 'morale' => null];
        }
    }
    return $out;
}

// Morale of the team per week: the MEDIAN of the weekly check-ins (checkins.morale, 0-100) of the whole team, oldest first.
// It is an anonymous aggregate: a week with fewer than 5 check-ins is left out, and no answer is ever tied to a person.
function team_mood_series($ids, $weeks, $latest)
{
    if (!count($ids)) { return []; }
    $marks = implode(',', array_fill(0, count($ids), '?'));
    $rows = query('SELECT week_start, morale FROM checkins WHERE employee_id IN (' . $marks . ') AND week_start <= ? AND week_start > ? ORDER BY week_start',
                  array_merge($ids, [$latest, month_before_week($latest, (int) $weeks)]))->fetchAll();
    $by = [];
    foreach ($rows as $r) { $by[$r['week_start']][] = (float) $r['morale']; }
    ksort($by);
    $out = [];
    foreach ($by as $w => $list) { if (count($list) >= MIN_GROUP) { $out[] = ['week' => $w, 'v' => round(median_list($list), 1), 'n' => count($list)]; } }
    return $out;
}

// ----- helpers of Phase 4 (M02-M04b) -----

function team_ids($team)
{
    return array_map(function ($p) { return (int) $p['id']; }, $team);
}

// Average of the seven criteria (and the exact score) of a group of people in one month (monthly_scores) - or NOW (employee_current) when $month is null.
function criteria_avgs($ids, $month)
{
    if (!count($ids)) { return null; }
    $marks = implode(',', array_fill(0, count($ids), '?'));
    $cols = 'AVG(attendance_discipline) AS attendance_discipline, AVG(task_completion) AS task_completion, AVG(innovation_creativity) AS innovation_creativity,
             AVG(teamwork) AS teamwork, AVG(professional_behavior) AS professional_behavior, AVG(technology_adoption) AS technology_adoption,
             AVG(job_burnout) AS job_burnout, AVG(burnout_risk_pct) AS burnout_risk_pct, AVG(engagement_score) AS engagement_score, AVG(empulse_score_exact) AS empulse_score_exact';
    if ($month === null) {
        $row = query("SELECT $cols FROM employee_current WHERE employee_id IN ($marks)", $ids)->fetch();
    } else {
        $row = query("SELECT $cols FROM monthly_scores WHERE employee_id IN ($marks) AND month = ?", array_merge($ids, [$month]))->fetch();
    }
    if (!$row || $row['task_completion'] === null) { return null; }
    foreach ($row as $k => $v) { $row[$k] = (float) $v; }
    return $row;
}

// The criteria in the order of the design, with weights from config.
function criteria_weights()
{
    global $CONFIG;
    $out = [];
    foreach ($CONFIG['criteria'] as $key => $c) { $out[$key] = (int) $c['weight']; }
    return $out;
}

// Wellbeing of the team per calendar month from shared check-ins: ['2026-09' => 55.1, ...]; months with too few sharers are missing.
function wellbeing_by_month($ids, $latest, $weeks = 30)
{
    $series = team_checkin_series($ids, $weeks, $latest);
    $sum = []; $cnt = [];
    foreach ($series as $r) {
        if ($r['wellbeing'] === null) { continue; }
        $m = substr($r['week'], 0, 7);
        $sum[$m] = ($sum[$m] ?? 0) + $r['wellbeing']; $cnt[$m] = ($cnt[$m] ?? 0) + 1;
    }
    $out = [];
    foreach ($sum as $m => $s) { $out[$m] = $s / $cnt[$m]; }
    return $out;
}

// Status word on the team map (see map_status) for a row of employee_current.
function tier_counts($team)
{
    $c = ['gold' => 0, 'silver' => 0, 'bronze' => 0, 'growth' => 0];
    foreach ($team as $p) { $c[tier_key($p['tier'])]++; }
    return $c;
}

// Days since a date (as of the demo date).
function days_ago($date, $asOf)
{
    return $date ? (int) round((strtotime($asOf) - strtotime($date)) / 86400) : null;
}


// ----- helpers of Phase 5 (M05-M08) -----

const MATRIX_PERF_CUT = 80;     // performance (task completion) at or above = "high"
const MATRIX_WELL_CUT = 58;     // wellbeing signal (= 100 - burnout risk) at or above = "high"

// The frame every manager API returns: who, team card, sidebar badges, attention count.
function manager_frame($me, $team, $teamInfo, $mid)
{
    $attention = count(array_filter($team, function ($p) { return (int) $p['burnout_risk_pct'] >= 60; }));
    return ['who' => who_block($me),
            'team' => ['name' => $teamInfo['name'], 'people' => count($team), 'avatars' => array_map(function ($p) { return initials_of($p['full_name']); }, array_slice($team, 0, 3))],
            'badges' => ['early_warning' => $attention, 'interventions' => (int) query("SELECT COUNT(*) AS c FROM interventions WHERE owner_id = ? AND status = 'active'", [$mid])->fetch()['c']],
            'attention' => $attention];
}

function quadrant_of($perf, $well)
{
    $hp = $perf >= MATRIX_PERF_CUT; $hw = $well >= MATRIX_WELL_CUT;
    return $hp && $hw ? 'thriving' : ($hp ? 'burnout_risk' : ($hw ? 'development' : 'critical'));
}

// Which quadrant is better: wellbeing first, then performance.
function quadrant_rank($q)
{
    return ['thriving' => 4, 'development' => 3, 'burnout_risk' => 2, 'critical' => 1][$q];
}

// Notes of the manager_notes table for one person (empty when phase5.sql / phase4.sql is not imported).
function notes_of($eid, $kind)
{
    return try_query('SELECT title, detail, footer, num FROM manager_notes WHERE employee_id = ? AND kind = ? ORDER BY ord', [$eid, $kind]);
}

// Energy of the last 4 shared check-ins, or null when the person does not share (never the answers).
function energy_of($id)
{
    $s = query('SELECT setting_value FROM user_settings WHERE employee_id = ? AND setting_key = ?', [$id, 'share_wellbeing'])->fetch();
    if ($s && (int) $s['setting_value'] === 0) { return null; }
    $cs = query('SELECT energy FROM checkins WHERE employee_id = ? AND share_trend = 1 ORDER BY week_start DESC LIMIT 4', [$id])->fetchAll();
    if (count($cs) < 3) { return null; }
    $low = count(array_filter($cs, function ($c) { return (int) $c['energy'] <= 2; }));
    $high = count(array_filter($cs, function ($c) { return (int) $c['energy'] >= 4; }));
    return ['level' => $low >= 2 ? 'low' : ($high >= 2 ? 'high' : 'mixed'), 'n' => $low >= 2 ? $low : $high, 'of' => count($cs), 'low_weeks' => $low];
}

// One column of weekly_metrics / weekly_activity for one person on one Monday (null when missing).
function week_value($table, $column, $id, $week)
{
    $ok = ['weekly_metrics' => ['burnout_risk_pct', 'engagement_score', 'workload_index', 'overtime_hours_monthly', 'mood_score'],
           'weekly_activity' => ['work_hours', 'after_hours', 'planned_hours']];
    if (!isset($ok[$table]) || !in_array($column, $ok[$table], true)) { return null; }
    $r = query("SELECT $column AS v FROM $table WHERE employee_id = ? AND week_start = ?", [$id, $week])->fetch();
    return $r ? (float) $r['v'] : null;
}

// A column over a number of weeks ending at $latest, oldest first (missing weeks are skipped).
function week_series($table, $column, $id, $latest, $weeks)
{
    $out = [];
    for ($i = $weeks - 1; $i >= 0; $i--) {
        $w = month_before_week($latest, $i);
        $v = week_value($table, $column, $id, $w);
        if ($v !== null) { $out[] = ['week' => $w, 'v' => $v]; }
    }
    return $out;
}
