<?php
// server/api/employee/recognition.php — E08 Recognition, Wall of Impact.
// GET : the wall (public awards of this quarter), the counts, my identity, who I can recognize.
// POST: {"action":"voice","id":3638}                         -> add my voice to a recognition (once)
//       {"action":"send","receiver_id":10,"category":"Team Supporter","message":"...","outcome":"..."} -> recognize a colleague
// PRIVACY: only public awards are shown. No ranking, no scores or tiers of other people.
require __DIR__ . '/../../employee_data.php';

$user = require_role(['employee']);
$eid = my_employee_id($user);
$dates = app_dates();
$quarter = quarter_start($dates['as_of']);
const AWARD_CATEGORIES = ['Performance Star', 'Innovation Champion', 'Collaboration Hero', 'Digital Pioneer', 'Team Supporter', 'Growth Champion'];

// People I may recognize: my team and the people who worked on my ideas (never myself).
function colleagues_of($eid)
{
    $me = query('SELECT team_id FROM employees WHERE id = ?', [$eid])->fetch();
    $ids = [];
    if ($me && $me['team_id']) {
        foreach (query('SELECT id FROM employees WHERE team_id = ? AND id <> ?', [$me['team_id'], $eid])->fetchAll() as $r) { $ids[(int) $r['id']] = 0; }
    }
    $shared = query('SELECT m2.employee_id AS id, COUNT(*) AS n FROM idea_members m1
                     JOIN idea_members m2 ON m2.idea_id = m1.idea_id AND m2.employee_id <> m1.employee_id
                     WHERE m1.employee_id = ? GROUP BY m2.employee_id', [$eid])->fetchAll();
    foreach ($shared as $r) { $ids[(int) $r['id']] = (int) $r['n']; }
    unset($ids[$eid]);
    return $ids;                                                       // id => number of shared ideas
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $body = read_json();
    $action = $body['action'] ?? '';
    if ($action === 'voice') {
        $id = (int) ($body['id'] ?? 0);
        $r = query('SELECT id, voices FROM recognitions WHERE id = ? AND is_public = 1 AND kind = ?', [$id, 'award'])->fetch();
        if (!$r) { send_json(['error' => 'not_found'], 404); }
        $has = query('SELECT 1 FROM recognition_voices WHERE recognition_id = ? AND employee_id = ?', [$id, $eid])->fetch();
        if (!$has) {
            query('INSERT INTO recognition_voices (recognition_id, employee_id) VALUES (?, ?)', [$id, $eid]);
            query('UPDATE recognitions SET voices = voices + 1 WHERE id = ?', [$id]);
        }
        $r = query('SELECT voices FROM recognitions WHERE id = ?', [$id])->fetch();
        send_json(['ok' => true, 'voices' => (int) $r['voices'], 'voiced' => true]);
    }
    if ($action === 'send') {
        $receiver = (int) ($body['receiver_id'] ?? 0);
        $category = (string) ($body['category'] ?? '');
        $message = trim((string) ($body['message'] ?? ''));
        $outcome = trim((string) ($body['outcome'] ?? ''));
        if (!array_key_exists($receiver, colleagues_of($eid))) { send_json(['error' => 'bad_receiver'], 400); }
        if (!in_array($category, AWARD_CATEGORIES, true)) { send_json(['error' => 'bad_category'], 400); }
        if (mb_strlen($message) < 10 || mb_strlen($message) > 300) { send_json(['error' => 'bad_message'], 400); }
        if (mb_strlen($outcome) > 160) { $outcome = mb_substr($outcome, 0, 160); }
        $next = (int) query('SELECT MAX(id) AS m FROM recognitions')->fetch()['m'] + 1;
        query('INSERT INTO recognitions (id, giver_id, giver_name, receiver_id, kind, category, message, linked_outcome, is_public, created_at, voices)
               VALUES (?, ?, NULL, ?, ?, ?, ?, ?, 1, ?, 0)',
              [$next, $eid, $receiver, 'award', $category, $message, $outcome === '' ? null : $outcome, $dates['as_of']]);
        query('UPDATE employee_current SET last_recognized_at = ? WHERE employee_id = ?', [$dates['as_of'], $receiver]);
        $name = query('SELECT full_name FROM employees WHERE id = ?', [$receiver])->fetch();
        send_json(['ok' => true, 'receiver' => $name['full_name'], 'counts' => category_counts($quarter)]);
    }
    send_json(['error' => 'bad_action'], 400);
}

function category_counts($quarter)
{
    $counts = array_fill_keys(AWARD_CATEGORIES, 0);
    foreach (query('SELECT category, COUNT(*) AS n FROM recognitions WHERE kind = ? AND is_public = 1 AND created_at >= ? GROUP BY category',
                   ['award', $quarter])->fetchAll() as $r) {
        if (isset($counts[$r['category']])) { $counts[$r['category']] = (int) $r['n']; }
    }
    $out = [];
    foreach ($counts as $k => $n) { $out[] = ['category' => $k, 'count' => $n]; }
    return $out;
}

// The wall: public awards of this quarter that carry a story or an impact line, most voices first (no rank is shown).
$rows = query('SELECT r.id, r.category, r.message, r.linked_outcome, r.voices, r.giver_id, r.giver_name, r.receiver_id,
                      s.story, s.impact, e.full_name AS receiver_name
               FROM recognitions r
               JOIN employees e ON e.id = r.receiver_id
               LEFT JOIN recognition_stories s ON s.recognition_id = r.id
               WHERE r.kind = ? AND r.is_public = 1 AND r.created_at >= ? AND (s.story IS NOT NULL OR r.linked_outcome IS NOT NULL)
                 AND (r.receiver_id = ? OR r.receiver_id NOT IN (SELECT employee_id FROM user_settings WHERE setting_key = \'public_recognition\' AND setting_value = 0))
               ORDER BY (CASE WHEN s.story IS NULL THEN 1 ELSE 0 END), r.voices DESC, r.id DESC LIMIT 6', ['award', $quarter, $eid])->fetchAll();
$wall = [];
foreach ($rows as $r) {
    $from = $r['giver_name'];
    if ($r['giver_id']) {
        $g = query('SELECT full_name FROM employees WHERE id = ?', [$r['giver_id']])->fetch();
        $from = $g ? $g['full_name'] : null;
    }
    $voiced = (bool) query('SELECT 1 FROM recognition_voices WHERE recognition_id = ? AND employee_id = ?', [$r['id'], $eid])->fetch();
    $wall[] = ['id' => (int) $r['id'], 'category' => $r['category'], 'receiver' => $r['receiver_name'],
               'initials' => initials_of($r['receiver_name']), 'mine' => (int) $r['receiver_id'] === $eid,
               'story' => $r['story'] ?: $r['message'], 'from' => $from,
               'impact' => $r['impact'] ?: $r['linked_outcome'], 'voices' => (int) $r['voices'], 'voiced' => $voiced];
}

// My identity block: the score and the badges (recognition of the last 12 months).
$p = load_person($eid);
$dates_back = month_before($dates['as_of'], 12);
$badges = [];
foreach (awards_of($eid, $dates_back, 20) as $a) {
    if ($a['category'] && !in_array($a['category'], $badges, true)) { $badges[] = $a['category']; }
}
$june = month_row($eid, month_before($dates['as_of'], 3));
$score = score_block($p, $june);

// People I may recognize, and three suggestions (shared projects first, then who has waited longest).
$people = [];
$suggest = [];
foreach (colleagues_of($eid) as $id => $shared_n) {
    $row = query('SELECT e.full_name, e.job_title, c.last_recognized_at FROM employees e
                  LEFT JOIN employee_current c ON c.employee_id = e.id WHERE e.id = ?', [$id])->fetch();
    if (!$row) { continue; }
    $days = $row['last_recognized_at'] ? days_between($row['last_recognized_at'], $dates['as_of']) : 999;
    $people[] = ['id' => $id, 'name' => $row['full_name'], 'initials' => initials_of($row['full_name']), 'job_title' => $row['job_title']];
    if ($shared_n > 0) {
        $idea = query('SELECT i.title FROM idea_members a JOIN idea_members b ON b.idea_id = a.idea_id
                       JOIN ideas i ON i.id = a.idea_id WHERE a.employee_id = ? AND b.employee_id = ? ORDER BY i.id DESC LIMIT 1',
                      [$id, $eid])->fetch();
        $suggest[] = ['id' => $id, 'name' => $row['full_name'], 'initials' => initials_of($row['full_name']),
                      'idea' => $idea ? $idea['title'] : null, 'days' => $days >= 999 ? null : $days, 'shared' => $shared_n];
    }
}
usort($people, function ($a, $b) { return strcmp($a['name'], $b['name']); });
usort($suggest, function ($a, $b) {
    return [$b['shared'], $b['days'] ?? 999] <=> [$a['shared'], $a['days'] ?? 999];
});
$facts = facts_of($eid);

send_json([
    'who'           => who_block($p),
    'quarter_start' => $quarter,
    'counts'        => category_counts($quarter),
    'wall'          => $wall,
    'identity'      => ['score' => $score, 'badges' => array_slice($badges, 0, 2)],
    'people'        => $people,
    'suggestions'   => array_slice($suggest, 0, 3),
    'outcome'       => $facts['recognize_outcome'] ?? null,
]);
