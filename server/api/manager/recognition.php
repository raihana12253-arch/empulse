<?php
// server/api/manager/recognition.php — M08 Recognition (manager).
// GET : the team's recognition coverage (days since each person was last recognized, longest gap first - not by merit),
//       the badge list, recent team recognition and a prepared suggestion (and the saved draft).
// POST: {"action":"send","receiver_id":367,"category":"Performance Star","message":"...","link_outcome":true}  -> gives the recognition
//       {"action":"draft", ...same fields}                                                                    -> saves the draft
// Only for the manager's own direct reports. Recognition never changes an EMPULSE Score directly.
require __DIR__ . '/../../manager_data.php';

const AWARD_CATEGORIES = ['Performance Star', 'Innovation Champion', 'Collaboration Hero', 'Digital Pioneer', 'Team Supporter', 'Growth Champion'];

$user = require_role(['manager']);
$mid = my_employee_id($user);
$dates = app_dates();
$asOf = $dates['as_of'];
$me = load_person($mid);
$team = team_of($mid);
$teamInfo = team_name_of($mid);
$n = count($team);

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $body = read_json();
    $action = (string) ($body['action'] ?? '');
    $receiver = (int) ($body['receiver_id'] ?? 0);
    $category = (string) ($body['category'] ?? '');
    $message = trim((string) ($body['message'] ?? ''));
    $link = !empty($body['link_outcome']);
    if (!is_my_report($mid, $receiver)) { send_json(['error' => 'bad_receiver'], 400); }
    if (!in_array($category, AWARD_CATEGORIES, true)) { send_json(['error' => 'bad_category'], 400); }
    if ($action === 'draft') {
        if (mb_strlen($message) > 300) { send_json(['error' => 'bad_message'], 400); }
        query('DELETE FROM recognition_drafts WHERE manager_id = ?', [$mid]);
        query('INSERT INTO recognition_drafts (manager_id, receiver_id, category, message, link_outcome, saved_at) VALUES (?, ?, ?, ?, ?, ?)',
              [$mid, $receiver, $category, $message, $link ? 1 : 0, $asOf . ' 12:00:00']);
        send_json(['ok' => true, 'draft' => true]);
    }
    if ($action === 'send') {
        if (mb_strlen($message) < 10 || mb_strlen($message) > 300) { send_json(['error' => 'bad_message'], 400); }
        $outcome = null;
        if ($link) {
            $f = facts_of($receiver);
            $outcome = $f['rec_outcome'] ?? null;          // the outcome prepared for this person (never typed by the browser)
        }
        $next = (int) query('SELECT MAX(id) AS m FROM recognitions')->fetch()['m'] + 1;
        query('INSERT INTO recognitions (id, giver_id, giver_name, receiver_id, kind, category, message, linked_outcome, is_public, created_at, voices)
               VALUES (?, ?, NULL, ?, ?, ?, ?, ?, 1, ?, 0)', [$next, $mid, $receiver, 'award', $category, $message, $outcome, $asOf]);
        query('UPDATE employee_current SET last_recognized_at = ?, recognition_90d = recognition_90d + 1 WHERE employee_id = ?', [$asOf, $receiver]);
        query('DELETE FROM recognition_drafts WHERE manager_id = ? AND receiver_id = ?', [$mid, $receiver]);
        $name = query('SELECT full_name FROM employees WHERE id = ?', [$receiver])->fetch();
        send_json(['ok' => true, 'receiver' => $name['full_name'], 'id' => $next]);
    }
    send_json(['error' => 'bad_action'], 400);
}

$base = manager_frame($me, $team, $teamInfo, $mid);

// coverage: longest gap first
$coverage = []; $ids = [];
foreach ($team as $p) {
    $ids[] = (int) $p['id'];
    $days = $p['last_recognized_at'] ? (int) floor((strtotime($asOf) - strtotime($p['last_recognized_at'])) / 86400) : null;
    $coverage[] = ['id' => (int) $p['id'], 'name' => $p['full_name'], 'first_name' => explode(' ', $p['full_name'])[0], 'initials' => initials_of($p['full_name']), 'days' => $days];
}
usort($coverage, function ($a, $b) { return ($b['days'] ?? 9999) <=> ($a['days'] ?? 9999); });

// recent awards given to the team
$marks = implode(',', array_fill(0, $n, '?'));
$recent = [];
foreach (query('SELECT r.id, r.receiver_id, r.giver_id, r.giver_name, r.category, r.linked_outcome, r.message, r.created_at, e.full_name AS receiver
                FROM recognitions r JOIN employees e ON e.id = r.receiver_id
                WHERE r.receiver_id IN (' . $marks . ') AND r.kind = ? ORDER BY r.created_at DESC, r.id DESC LIMIT 3', array_merge($ids, ['award']))->fetchAll() as $r) {
    $giver = $r['giver_name'];
    if ($r['giver_id']) { $g = query('SELECT full_name FROM employees WHERE id = ?', [(int) $r['giver_id']])->fetch(); $giver = $g ? $g['full_name'] : null; }
    $recent[] = ['receiver' => $r['receiver'], 'category' => $r['category'], 'what' => $r['linked_outcome'] ? trim(explode(' · ', $r['linked_outcome'])[0]) : $r['message'],
                 'from' => $giver, 'date' => $r['created_at']];
}
$monthStart = substr($asOf, 0, 7) . '-01';
$month = (int) query('SELECT COUNT(*) AS c FROM recognitions WHERE receiver_id IN (' . $marks . ') AND created_at >= ?', array_merge($ids, [$monthStart]))->fetch()['c'];
$facts = facts_of($mid);

// prepared suggestions (display texts of the design) and the saved draft
$suggest = [];
foreach ($ids as $id) {
    $s = notes_of($id, 'rec_suggest');
    if (count($s)) {
        $f = facts_of($id);
        $suggest[$id] = ['category' => $s[0]['title'], 'message' => $s[0]['detail'], 'outcome' => $f['rec_outcome'] ?? null, 'outcome_long' => $f['rec_outcome_long'] ?? null];
    }
}
$draft = null;
$d = try_query('SELECT receiver_id, category, message, link_outcome FROM recognition_drafts WHERE manager_id = ?', [$mid]);
if (count($d)) { $draft = ['receiver_id' => (int) $d[0]['receiver_id'], 'category' => $d[0]['category'], 'message' => $d[0]['message'], 'link_outcome' => (int) $d[0]['link_outcome'] === 1]; }

send_json($base + ['categories' => AWARD_CATEGORIES, 'coverage' => $coverage, 'recent' => $recent, 'month' => $month,
    'gap_pct' => isset($facts['m03_recog_gap_pct']) ? (int) $facts['m03_recog_gap_pct'] : null, 'suggest' => $suggest, 'draft' => $draft]);
