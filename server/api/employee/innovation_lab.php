<?php
// server/api/employee/innovation_lab.php — E05 Innovation Lab (my draft idea + PulseAI's live analysis).
// GET : my newest draft (or an empty form), its PulseAI analysis, ROI and tips.
// POST: {"action":"save"|"submit","title":..,"problem":..,"solution":..,"benefit":..,"cost":..,"savings":..,"weeks":..}
//   save   = keep the draft   |   submit = send it to PulseAI review (status ai_reviewed, stage 2). A person owns only their own ideas.
// The analysis texts and scores are rules on the draft: scores are stored on the idea by the PulseAI review.
require __DIR__ . '/../../employee_data.php';

$user = require_role(['employee']);
$eid = my_employee_id($user);
$dates = app_dates();
$p = load_person($eid);

function draft_of($eid)
{
    return query("SELECT i.* FROM ideas i WHERE i.owner_id = ? AND i.status = 'draft' ORDER BY i.id DESC LIMIT 1", [$eid])->fetch();
}

function lab_view($eid, $p, $dates)
{
    $idea = draft_of($eid);
    $mine = (int) query('SELECT COUNT(*) AS n FROM idea_members WHERE employee_id = ?', [$eid])->fetch()['n'];
    $out = ['who' => who_block($p), 'my_ideas' => $mine, 'draft' => null];
    if (!$idea) { return $out; }
    $d = query('SELECT * FROM idea_details WHERE idea_id = ?', [$idea['id']])->fetch() ?: [];
    $notes = query('SELECT kind, dim, note FROM idea_notes WHERE idea_id = ? ORDER BY kind, seq', [$idea['id']])->fetchAll();
    $analysis = []; $tips = [];
    foreach ($notes as $n) { if ($n['kind'] === 'analysis') { $analysis[$n['dim']] = $n['note']; } else { $tips[] = $n['note']; } }
    $scores = ['novelty' => $idea['novelty'], 'feasibility' => $idea['feasibility'], 'value' => $idea['value_score'], 'impact' => $idea['impact_score']];
    $have = array_filter($scores, function ($v) { return $v !== null; });
    $readiness = $have ? (int) round(array_sum($have) / count($have)) : null;
    $cost = (int) $idea['cost_sar']; $sav = (int) $idea['expected_savings_sar'];
    $out['draft'] = [
        'code' => $idea['code'], 'title' => $idea['title'],
        'problem' => $d['problem'] ?? '', 'solution' => $d['solution'] ?? '', 'benefit' => $d['benefit'] ?? '',
        'cost' => $cost, 'savings' => $sav, 'weeks' => isset($d['duration_weeks']) ? (int) $d['duration_weeks'] : 8,
        'roi' => $cost > 0 ? round($sav / $cost, 2) : null,
        'scores' => $scores, 'readiness' => $readiness, 'analysis' => $analysis, 'tips' => $tips,
        'estimate' => isset($d['roi_estimate']) ? ['value' => (float) $d['roi_estimate'], 'low' => (float) $d['roi_low'], 'high' => (float) $d['roi_high'],
                       'ramp_weeks' => (int) $d['ramp_weeks'], 'ramp_cost' => (int) $d['ramp_cost_sar'], 'adoption' => (int) $d['adoption_pct']] : null,
        'evidence' => query('SELECT file_name, size_label FROM idea_evidence WHERE idea_id = ? ORDER BY seq', [$idea['id']])->fetchAll(),
        'saved_at' => $d['saved_at'] ?? null,
    ];
    return $out;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $b = read_json();
    $action = $b['action'] ?? '';
    if (!in_array($action, ['save', 'submit'], true)) { send_json(['error' => 'bad_action'], 400); }
    $title = trim((string) ($b['title'] ?? ''));
    $problem = trim((string) ($b['problem'] ?? ''));
    $solution = trim((string) ($b['solution'] ?? ''));
    $benefit = trim((string) ($b['benefit'] ?? ''));
    $cost = (int) ($b['cost'] ?? 0); $sav = (int) ($b['savings'] ?? 0); $weeks = (int) ($b['weeks'] ?? 0);
    if ($title === '' || mb_strlen($title) > 120) { send_json(['error' => 'bad_title'], 400); }
    if (mb_strlen($problem) > 400 || mb_strlen($solution) > 400 || mb_strlen($benefit) > 300) { send_json(['error' => 'too_long'], 400); }
    if ($cost < 0 || $cost > 100000000 || $sav < 0 || $sav > 100000000 || $weeks < 1 || $weeks > 104) { send_json(['error' => 'bad_number'], 400); }
    if ($action === 'submit' && ($problem === '' || $solution === '')) { send_json(['error' => 'incomplete'], 400); }

    $idea = draft_of($eid);
    if (!$idea) {                                           // a new draft
        $id = (int) query('SELECT MAX(id) AS m FROM ideas')->fetch()['m'] + 1;
        $num = (int) query("SELECT MAX(CAST(SUBSTR(code, 6) AS UNSIGNED)) AS m FROM ideas")->fetch()['m'] + 1;
        query('INSERT INTO ideas (id, code, title, department_id, team_id, owner_id, status, category, created_at, expected_savings_sar, cost_sar)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
              [$id, sprintf('IDEA-%03d', $num), $title, $p['department_id'], $p['team_id'], $eid, 'draft', 'Product', $dates['as_of'], $sav, $cost]);
        query('INSERT INTO idea_members (idea_id, employee_id, role) VALUES (?, ?, ?)', [$id, $eid, 'owner']);
        query('INSERT INTO idea_details (idea_id, problem, solution, benefit, duration_weeks) VALUES (?, ?, ?, ?, ?)', [$id, '', '', '', 8]);
        $idea = ['id' => $id];
    }
    query('UPDATE ideas SET title = ?, expected_savings_sar = ?, cost_sar = ? WHERE id = ?', [$title, $sav, $cost, $idea['id']]);
    query('UPDATE idea_details SET problem = ?, solution = ?, benefit = ?, duration_weeks = ?, saved_at = ? WHERE idea_id = ?',
          [$problem, $solution, $benefit, $weeks, $dates['as_of'] . ' ' . date('H:i:s'), $idea['id']]);
    if ($action === 'submit') {
        query("UPDATE ideas SET status = 'ai_reviewed', submitted_at = ? WHERE id = ?", [$dates['as_of'], $idea['id']]);
    }
    $view = lab_view($eid, $p, $dates);
    $view['ok'] = true; $view['action'] = $action;
    send_json($view);
}

send_json(lab_view($eid, $p, $dates));
