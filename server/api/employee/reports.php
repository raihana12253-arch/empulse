<?php
// server/api/employee/reports.php — E10 My Reports. Reports about ME, built from my own numbers (rule-based text).
// GET : the report list and the quarterly growth report.   POST: {"action":"share","report":"quarterly"} -> share with my manager (logged).
// Not included: private check-in answers, other people's scores, comparisons with named colleagues.
require __DIR__ . '/../../employee_data.php';

$user = require_role(['employee']);
$eid = my_employee_id($user);
$dates = app_dates();
$p = load_person($eid);
$facts = facts_of($eid);
const REPORTS = ['quarterly', 'score_history', 'recognition', 'ideas', 'learning'];

function m($key, $params = []) { return ['k' => $key, 'p' => $params]; }

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $b = read_json();
    $r = $b['report'] ?? 'quarterly';
    if (($b['action'] ?? '') !== 'share' || !in_array($r, REPORTS, true) || !$p['manager_name']) { send_json(['error' => 'bad_request'], 400); }
    query('INSERT INTO report_shares (employee_id, report_key, shared_with, shared_at) VALUES (?, ?, ?, ?)', [$eid, $r, $p['manager_name'], $dates['as_of']]);
    send_json(['ok' => true, 'shared_with' => $p['manager_name']]);
}

$qs = quarter_start($dates['as_of']);
$prev = month_row($eid, month_before($dates['as_of'], 3));
$s = score_block($p, $prev);
$months = month_scores($eid, 6);
$awards = awards_of($eid, $qs, 50);
$ideas = ideas_of($eid);
$shipped = array_values(array_filter($ideas, function ($i) { return $i['status'] === 'implemented'; }));
$strong = null; $weak = null;
foreach (CRITERIA_ORDER as $k) {
    if ($k === 'job_burnout') { continue; }
    if ($strong === null || $p[$k] > $p[$strong]) { $strong = $k; }
    if ($weak === null || $p[$k] < $p[$weak]) { $weak = $k; }
}
$module = growth_of($eid);
$wb_now = isset($facts['wellbeing_now']) ? (int) $facts['wellbeing_now'] : null;
$wb_start = isset($facts['wellbeing_start']) ? (int) $facts['wellbeing_start'] : null;
$peer = isset($facts['peer_coaching_named']) ? (int) $facts['peer_coaching_named'] : count($awards);
$firstShipped = $shipped ? $shipped[0] : null;
$nums = $firstShipped ? idea_note_numbers($firstShipped['note']) : ['requests_pct' => null, 'teams' => null];
$tier = $s['tier'];
$next = $s['next'];

$band = ['growth' => 69, 'bronze' => 79, 'silver' => 89, 'gold' => 100];
$quarterly = [
    'headline' => $next ? m('e10.h_next', ['tier' => $tier, 'points' => $next['points'], 'to' => $next['key']]) : m('e10.h_top', ['tier' => $tier]),
    'score' => ['value' => $s['rounded'], 'from' => $prev ? (int) $prev['empulse_score'] : null, 'tier' => $tier, 'next' => $next],
    'sections' => [
        ['key' => 'strengths', 'text' => m('e10.s_strengths', ['crit' => m('crit.' . $strong), 'n' => (int) $p[$strong], 'ideas' => count($ideas), 'shipped' => count($shipped)])],
        ['key' => 'development', 'text' => m('e10.s_development', ['crit' => m('crit.' . $weak), 'n' => (int) $p[$weak], 'module' => $module ? $module['title'] : ''])],
        ['key' => 'wellbeing', 'text' => $wb_now !== null && $wb_start !== null
            ? m('e10.s_wellbeing', ['from' => $wb_start, 'to' => $wb_now, 'risk' => (int) $p['burnout_risk_pct']])
            : m('e10.s_wellbeing_plain', ['risk' => (int) $p['burnout_risk_pct']])],
        ['key' => 'recognition', 'text' => m('e10.s_recognition', ['n' => count($awards), 'peers' => $peer])],
        ['key' => 'impact', 'text' => $firstShipped
            ? m('e10.s_impact', ['title' => $firstShipped['title'], 'pct' => $nums['requests_pct'] === null ? 0 : abs($nums['requests_pct']), 'teams' => $nums['teams'] ?? 0])
            : m('e10.s_impact_none')],
        ['key' => 'worked', 'text' => m('e10.s_worked', ['crit' => m('crit.' . $strong)])],
    ],
    'period' => ['from' => $qs, 'to' => $dates['as_of']],
];

$history = array_map(function ($r) { return ['month' => $r['month'], 'score' => (int) $r['empulse_score'], 'tier' => $r['tier']]; }, $months);
$rec = array_map(function ($a) { return ['category' => $a['category'], 'from' => $a['from'], 'message' => $a['message'], 'date' => $a['created_at']]; }, $awards);
$ideaList = array_map(function ($i) { return ['code' => $i['code'], 'title' => $i['title'], 'status' => $i['status'], 'savings' => $i['realized_savings_sar']]; }, $ideas);
$skills = query('SELECT skill, value, target FROM growth_skills WHERE employee_id = ?', [$eid])->fetchAll();
$learning = ['hours' => isset($facts['learning_hours']) ? (int) $facts['learning_hours'] : null,
             'module' => $module ? ['title' => $module['title'], 'progress' => $module['progress']] : null,
             'skills' => array_map(function ($k) { return ['skill' => $k['skill'], 'value' => (int) $k['value'], 'target' => (int) $k['target']]; }, $skills)];

$shared = query('SELECT report_key, shared_with, shared_at FROM report_shares WHERE employee_id = ? ORDER BY shared_at DESC, id DESC', [$eid])->fetchAll();
send_json(['who' => who_block($p), 'reports' => REPORTS, 'quarterly' => $quarterly, 'history' => $history, 'recognition' => $rec,
           'ideas' => $ideaList, 'learning' => $learning, 'manager' => $p['manager_name'], 'shared' => $shared,
           'dates' => ['as_of' => $dates['as_of'], 'quarter_start' => $qs]]);
