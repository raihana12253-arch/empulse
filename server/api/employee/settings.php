<?php
// server/api/employee/settings.php — E11 Settings: my privacy, who can see what, how my score is calculated.
// GET : toggles, visibility table, weights.   GET ?export=1 : everything stored about me (my own data only).
// POST: {"key":"share_wellbeing","value":0|1}. share_tier is required and cannot be changed.
require __DIR__ . '/../../employee_data.php';

$user = require_role(['employee']);
$eid = my_employee_id($user);
$p = load_person($eid);
const TOGGLES = ['share_wellbeing' => 1, 'public_recognition' => 1, 'pulseai_suggest' => 1, 'weekly_digest' => 0];

function settings_of($eid)
{
    $out = TOGGLES;
    foreach (query('SELECT setting_key, setting_value FROM user_settings WHERE employee_id = ?', [$eid])->fetchAll() as $r) {
        if (array_key_exists($r['setting_key'], TOGGLES)) { $out[$r['setting_key']] = (int) $r['setting_value']; }
    }
    return $out;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $b = read_json();
    $key = $b['key'] ?? '';
    if (!array_key_exists($key, TOGGLES)) { send_json(['error' => 'locked'], 400); }
    $v = !empty($b['value']) ? 1 : 0;
    query('DELETE FROM user_settings WHERE employee_id = ? AND setting_key = ?', [$eid, $key]);
    query('INSERT INTO user_settings (employee_id, setting_key, setting_value) VALUES (?, ?, ?)', [$eid, $key, $v]);
    send_json(['ok' => true, 'settings' => settings_of($eid)]);
}

if (!empty($_GET['export'])) {
    $tables = ['employee_current' => 'employee_id', 'monthly_scores' => 'employee_id', 'checkins' => 'employee_id',
               'user_settings' => 'employee_id', 'pulseai_log' => 'employee_id', 'report_shares' => 'employee_id'];
    $out = ['exported_for' => $p['full_name'], 'as_of' => app_dates()['as_of']];
    foreach ($tables as $t => $col) { $out[$t] = query("SELECT * FROM $t WHERE $col = ?", [$eid])->fetchAll(); }
    $out['recognitions_received'] = query('SELECT category, message, created_at FROM recognitions WHERE receiver_id = ?', [$eid])->fetchAll();
    header('Content-Disposition: attachment; filename="empulse-my-data.json"');
    send_json($out);
}

$hr = query("SELECT e.full_name FROM employees e WHERE e.job_title = 'HR Business Partner' ORDER BY (e.department_id = ?) DESC, e.id LIMIT 1", [$p['department_id'] ?? 0])->fetch();
$weights = [];
foreach ($GLOBALS['CONFIG']['criteria'] as $key => $c) { $weights[] = ['key' => $key, 'weight' => (int) $c['weight']]; }
send_json(['who' => who_block($p), 'settings' => settings_of($eid), 'hr_partner' => $hr ? $hr['full_name'] : null,
           'manager' => $p['manager_name'], 'weights' => $weights]);
