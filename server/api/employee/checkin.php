<?php
// server/api/employee/checkin.php — save the private check-in (E01).
// JavaScript sends: {"energy": 4}                 -> this week's energy (1 Drained ... 5 Energised)
//              or:  {"share_trend": true|false}   -> share the TREND (never the answers) with the manager
// The answers are private. A manager can only ever see a trend of 5 or more people.
require __DIR__ . '/../../employee_data.php';

$user = require_role(['employee']);
$eid = my_employee_id($user);
$body = read_json();
$dates = app_dates();
$week = monday_of($dates['as_of']);

$existing = query('SELECT share_trend FROM checkins WHERE employee_id = ? AND week_start = ?', [$eid, $week])->fetch();
$last = query('SELECT share_trend FROM checkins WHERE employee_id = ? ORDER BY week_start DESC LIMIT 1', [$eid])->fetch();

if (isset($body['energy'])) {
    $energy = (int) $body['energy'];
    if ($energy < 1 || $energy > 5) {
        send_json(['error' => 'bad_energy'], 400);
    }
    $morale = (int) round(($energy - 1) / 4 * 100);                   // a simple 0-100 proxy of the energy
    if ($existing) {
        query('UPDATE checkins SET energy = ?, morale = ? WHERE employee_id = ? AND week_start = ?', [$energy, $morale, $eid, $week]);
    } else {
        $share = $last ? (int) $last['share_trend'] : 0;               // keep the person's choice
        query('INSERT INTO checkins (employee_id, week_start, energy, morale, share_trend) VALUES (?, ?, ?, ?, ?)',
              [$eid, $week, $energy, $morale, $share]);
    }
}

if (array_key_exists('share_trend', $body)) {
    $share = $body['share_trend'] ? 1 : 0;
    // The choice is kept on the person's latest check-in.
    $target = query('SELECT week_start FROM checkins WHERE employee_id = ? ORDER BY week_start DESC LIMIT 1', [$eid])->fetch();
    if ($target) {
        query('UPDATE checkins SET share_trend = ? WHERE employee_id = ? AND week_start = ?', [$share, $eid, $target['week_start']]);
    }
}

send_json(['ok' => true, 'checkin' => checkin_state($eid, $dates['as_of'])]);
