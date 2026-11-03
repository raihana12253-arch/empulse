<?php
// server/api/employee/growth.php — E07 My Growth Path (own data only).
// GET : numbers, journey milestones, readiness by skill, learning, mentors, growth projects.
// POST: {"action":"draft_note"} -> a short note to my manager proposing a co-lead role, built from my own gap (nothing is sent).
// Numbers of the design (hours, goals, milestones) come from demo_facts when a person has them; otherwise they are calculated.
require __DIR__ . '/../../employee_data.php';

$user = require_role(['employee']);
$eid = my_employee_id($user);
$dates = app_dates();
$p = load_person($eid);
$facts = facts_of($eid);

$skills = query('SELECT skill, value, target FROM growth_skills WHERE employee_id = ? ORDER BY seq', [$eid])->fetchAll();
$gap = null;                                                // the biggest gap between target and value
foreach ($skills as &$s) {
    $s['value'] = (int) $s['value']; $s['target'] = (int) $s['target'];
    $s['met'] = $s['value'] >= $s['target'];
    $diff = $s['target'] - $s['value'];
    if ($diff > 0 && ($gap === null || $diff > $gap['diff'])) { $gap = ['skill' => $s['skill'], 'diff' => $diff]; }
}
unset($s);
$manager_first = $p['manager_name'] ? explode(' ', $p['manager_name'])[0] : null;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $b = read_json();
    if (($b['action'] ?? '') !== 'draft_note') { send_json(['error' => 'bad_action'], 400); }
    $proj = query('SELECT i.title FROM growth_projects g JOIN ideas i ON i.id = g.idea_id WHERE g.employee_id = ? ORDER BY g.idea_id DESC LIMIT 1', [$eid])->fetch();
    send_json(['ok' => true, 'manager' => $manager_first, 'project' => $proj ? $proj['title'] : null, 'gap' => $gap ? $gap['skill'] : null]);
}

$ms = query('SELECT state, title, sub, pos_x, pos_y FROM growth_milestones WHERE employee_id = ? ORDER BY seq', [$eid])->fetchAll();
$goal = null; $points = [];
foreach ($ms as $m) {
    if ($m['state'] === 'goal') { $goal = $m['title']; continue; }
    $points[] = ['state' => $m['state'], 'title' => $m['title'], 'sub' => $m['sub'], 'x' => (int) $m['pos_x'], 'y' => (int) $m['pos_y']];
}
$done = 0; foreach ($points as $pt) { if ($pt['state'] === 'done') { $done++; } }
$ready = isset($facts['growth_ready_pct']) ? (int) $facts['growth_ready_pct'] : null;
if ($ready === null && $skills) {
    $sum = 0; foreach ($skills as $s) { $sum += min(1, $s['value'] / max(1, $s['target'])) * 100; }
    $ready = (int) round($sum / count($skills));
}
$module = growth_of($eid);
$goals_total = isset($facts['goals_total']) ? (int) $facts['goals_total'] : ($goal ? 1 : 0);
$goals_on = isset($facts['goals_on_track']) ? (int) $facts['goals_on_track'] : 0;

$mentors = [];
foreach (query('SELECT e.full_name, e.job_title FROM mentors m JOIN employees e ON e.id = m.mentor_id WHERE m.employee_id = ? ORDER BY m.mentor_id', [$eid])->fetchAll() as $m) {
    $mentors[] = ['name' => $m['full_name'], 'initials' => initials_of($m['full_name']), 'job_title' => $m['job_title']];
}
$projects = query('SELECT i.code, i.title, g.sub FROM growth_projects g JOIN ideas i ON i.id = g.idea_id WHERE g.employee_id = ? ORDER BY g.idea_id DESC', [$eid])->fetchAll();

send_json([
    'who' => who_block($p),
    'stats' => [
        'hours' => isset($facts['learning_hours']) ? (int) $facts['learning_hours'] : 0,
        'hours_delta' => isset($facts['learning_hours_delta']) ? (int) $facts['learning_hours_delta'] : null,
        'goals_total' => $goals_total, 'goals_on_track' => $goals_on,
        'milestones_reached' => isset($facts['milestones_reached']) ? (int) $facts['milestones_reached'] : $done,
        'milestones_total' => isset($facts['milestones_total']) ? (int) $facts['milestones_total'] : count($ms),
        'since' => isset($facts['joined_year']) ? (int) $facts['joined_year'] : null,
    ],
    'nudge' => $gap ? ['gap' => $gap['skill'], 'manager' => $manager_first] : null,
    'journey' => ['goal' => $goal, 'ready' => $ready, 'manager' => $manager_first,
                  'plan_month' => isset($facts['plan_month']) ? (int) $facts['plan_month'] : null, 'points' => $points],
    'skills' => $skills,
    'learning' => ['module' => $module, 'items' => query('SELECT title, detail FROM learning_items WHERE employee_id = ? ORDER BY seq', [$eid])->fetchAll()],
    'mentors' => $mentors,
    'projects' => $projects,
]);
