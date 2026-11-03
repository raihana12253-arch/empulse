<?php
// server/api/employee/pulseai.php — E09 PulseAI, personal assistant (own data only).
// GET : context, recent questions, the suggested questions and the answer to the latest question.
// POST: {"question":"..."} or {"intent":"reach_gold"} -> an answer. {"intent":"plan"} -> a two-week plan (a draft, private until shared).
//       {"action":"helpful","id":5,"value":1} -> was this helpful?   {"action":"save_plan"} -> keep the plan as a note in my log.
// PulseAI here is RULE-BASED: every sentence comes from a rule on the person's own numbers (no language model).
// It never uses check-in answers; it detects and proposes, a person decides. Texts are returned as keys + values and written in the browser (EN/AR).
require __DIR__ . '/../../employee_data.php';

$user = require_role(['employee']);
$eid = my_employee_id($user);
$dates = app_dates();
$p = load_person($eid);
$facts = facts_of($eid);

const INTENTS = ['reach_gold', 'innovation_drop', 'course', 'lead_ready', 'summary'];
const INTENT_QUESTIONS = [
    'reach_gold'      => 'How can I reach Gold this quarter?',
    'innovation_drop' => 'Why did my innovation score drop?',
    'course'          => 'Which course should I take next?',
    'lead_ready'      => 'Am I ready for Lead Data Analyst?',
    'summary'         => 'Summarise my progress this quarter',
];

// A message: a language key with values. The browser turns it into text.
function m($key, $params = [])
{
    return ['k' => $key, 'p' => $params];
}

// ----- the numbers every answer can use (all of them belong to the signed-in person) -----
function my_numbers($eid, $p, $facts, $dates)
{
    $score = score_block($p, month_row($eid, month_before($dates['as_of'], 3)));
    $dna = query('SELECT * FROM innovation_dna WHERE employee_id = ?', [$eid])->fetch() ?: [];
    $months = month_scores($eid, 6);
    $ideas = query("SELECT i.status, i.open_roles, i.title, i.code FROM ideas i JOIN idea_members m ON m.idea_id = i.id
                    WHERE m.employee_id = ? AND i.status <> 'draft'", [$eid])->fetchAll();
    $shipped = 0; $waiting = 0;
    foreach ($ideas as $i) {
        if ($i['status'] === 'implemented') { $shipped++; }
        if ($i['status'] === 'approved' && $i['open_roles']) { $waiting++; }
    }
    $checkin = query('SELECT energy, morale FROM checkins WHERE employee_id = ? ORDER BY week_start DESC LIMIT 1', [$eid])->fetch();
    $wellbeing = isset($facts['wellbeing_now']) ? (int) $facts['wellbeing_now']
        : ($checkin ? (int) round((($checkin['energy'] - 1) / 4 * 100 + $checkin['morale']) / 2) : null);
    $module = growth_of($eid);
    $project = query('SELECT i.title FROM growth_projects g JOIN ideas i ON i.id = g.idea_id WHERE g.employee_id = ? ORDER BY g.idea_id DESC LIMIT 1', [$eid])->fetch();
    $mentor = query('SELECT e.full_name FROM mentors m JOIN employees e ON e.id = m.mentor_id WHERE m.employee_id = ? ORDER BY m.mentor_id DESC LIMIT 1', [$eid])->fetch();
    return ['score' => $score, 'dna' => $dna, 'months' => $months, 'ideas' => count($ideas), 'shipped' => $shipped, 'waiting' => $waiting,
            'wellbeing' => $wellbeing, 'module' => $module, 'project' => $project ? $project['title'] : null,
            'mentor' => $mentor ? explode(' ', $mentor['full_name'])[0] : null,
            'hours' => isset($facts['learning_hours']) ? (int) $facts['learning_hours'] : null];
}

function strongest_criterion($p)
{
    $best = null;
    foreach (CRITERIA_ORDER as $key) {
        if ($key === 'job_burnout') { continue; }
        if ($best === null || (int) $p[$key] > (int) $p[$best]) { $best = $key; }
    }
    return $best;
}

function bars_of($values) { return array_map('intval', $values); }

function confidence_of($n)
{
    $months = count($n['months']);
    return ['level' => $months >= 6 ? 'high' : ($months >= 3 ? 'medium' : 'low'), 'months' => $months];
}

// ----- the answers -----
function answer_for($intent, $eid, $p, $facts, $dates)
{
    $n = my_numbers($eid, $p, $facts, $dates);
    $s = $n['score'];
    $manager = $p['manager_name'] ? explode(' ', $p['manager_name'])[0] : null;
    $base = ['intent' => $intent, 'question' => INTENT_QUESTIONS[$intent], 'confidence' => confidence_of($n),
             'period' => ['from' => $n['months'] ? $n['months'][0]['month'] : null, 'to' => $dates['latest_week']]];
    $trendRisk = (int) $p['burnout_change_6w'];
    $riskWord = $trendRisk < 0 ? 'falling' : ($trendRisk > 2 ? 'rising' : 'stable');

    if ($intent === 'reach_gold') {
        $strong = strongest_criterion($p);
        $all = org_values('employee_current', $strong);
        $top = top_percent($all, (int) $p[$strong]);
        $minRecent = null;
        foreach ($n['months'] as $mrow) { $row = month_row($eid, $mrow['month']); if ($row) { $v = (int) $row[$strong]; $minRecent = $minRecent === null ? $v : min($minRecent, $v); } }
        $strongTrait = strongest_trait($eid); $weakTrait = weakest_trait($eid);
        $next = $s['next'];
        $data = [
            ['label' => m('e09.d_task', ['n' => (int) $p['task_completion']])],
            ['label' => m('e09.d_innovation', ['n' => (int) $p['innovation_creativity']])],
            ['label' => m('e09.d_ideas', ['a' => $n['ideas'], 'b' => $n['shipped']])],
        ];
        if ($n['wellbeing'] !== null) { $data[] = ['label' => m('e09.d_wellbeing', ['n' => $n['wellbeing']])]; }
        if ($n['hours'] !== null) { $data[] = ['label' => m('e09.d_learning', ['n' => $n['hours']])]; }
        $f3 = (int) $p['burnout_risk_pct'] < 45
            ? m('e09.f3_ok', ['risk' => (int) $p['burnout_risk_pct'], 'trend' => m('e09.trend_' . $riskWord), 'w' => $n['wellbeing'] ?? '—'])
            : m('e09.f3_care', ['risk' => (int) $p['burnout_risk_pct']]);
        return $base + [
            'headline' => $next ? m('e09.h_gold', ['points' => $next['points'], 'tier' => $next['key'], 'score' => $s['rounded'], 'min' => $next['min'],
                                                    'shipped' => $n['shipped'], 'total' => $n['ideas']])
                                : m('e09.h_top', ['score' => $s['rounded']]),
            'data' => $data,
            'findings' => [
                ['title' => m('e09.f1_t', ['crit' => m('crit.' . $strong)]),
                 'text' => m('e09.f1_x', ['crit' => m('crit.' . $strong), 'n' => (int) $p[$strong], 'top' => $top, 'min' => $minRecent ?? (int) $p[$strong]]),
                 'bars' => bars_of(array_map(function ($mm) use ($eid, $strong) { $r = month_row($eid, $mm['month']); return $r ? $r[$strong] : 0; }, array_slice($n['months'], -4)))],
                ['title' => m('e09.f2_t', ['gap' => m('dna.' . $weakTrait['key']), 'strong' => m('dna.' . $strongTrait['key'])]),
                 'text' => m('e09.f2_x', ['a' => m('dna.' . $strongTrait['key']), 'av' => $strongTrait['value'], 'b' => m('dna.' . $weakTrait['key']), 'bv' => $weakTrait['value'], 'waiting' => $n['waiting']]),
                 'bars' => bars_of([$n['dna']['idea_generation'] ?? 0, $n['dna']['problem_solving'] ?? 0, $n['dna']['experimentation'] ?? 0, $n['dna']['implementation'] ?? 0]), 'warm' => true],
                ['title' => m('e09.f3_t'), 'text' => $f3,
                 'bars' => bars_of(array_map(function ($mm) use ($eid) { $r = month_row($eid, $mm['month']); return $r ? $r['burnout_risk_pct'] : 0; }, array_slice($n['months'], -4))), 'cool' => true],
            ],
            'recommendation' => $n['project']
                ? m('e09.rec_gold', ['project' => $n['project'], 'manager' => $manager ?? '', 'crit' => m('crit.innovation_creativity'), 'inn' => (int) $p['innovation_creativity'],
                                     'points' => $next ? $next['points'] : 0, 'tier' => $next ? $next['key'] : 'gold', 'module' => $n['module'] ? $n['module']['title'] : ''])
                : m('e09.rec_gold_plain', ['points' => $next ? $next['points'] : 0, 'tier' => $next ? $next['key'] : 'gold']),
            'actions' => ['plan', 'join', 'share'],
            'numbers' => [
                ['label' => m('e09.n_score'), 'value' => $s['exact'] . ' → ' . $s['rounded']],
                ['label' => m('e09.n_next'), 'value' => $next ? ($next['min'] . ' (+' . $next['points'] . ')') : '—'],
                ['label' => m('crit.' . $strong), 'value' => (int) $p[$strong]],
                ['label' => m('crit.innovation_creativity'), 'value' => (int) $p['innovation_creativity']],
                ['label' => m('dna.' . $weakTrait['key']), 'value' => $weakTrait['value']],
                ['label' => m('e09.n_risk'), 'value' => (int) $p['burnout_risk_pct'] . '%'],
            ],
        ];
    }

    if ($intent === 'innovation_drop') {
        $then = month_row($eid, month_before($dates['as_of'], 3));
        $now = (int) $p['innovation_creativity']; $was = $then ? (int) $then['innovation_creativity'] : null;
        $diff = $was === null ? null : $now - $was;
        $weak = weakest_trait($eid);
        return $base + [
            'headline' => $diff !== null && $diff < 0 ? m('e09.id_drop', ['a' => $was, 'b' => $now]) : m('e09.id_nodrop', ['a' => $was ?? $now, 'b' => $now]),
            'data' => [['label' => m('e09.d_innovation', ['n' => $now])], ['label' => m('e09.d_ideas', ['a' => $n['ideas'], 'b' => $n['shipped']])]],
            'findings' => [
                ['title' => m('e09.id_f1_t'), 'text' => m('e09.id_f1_x', ['a' => $n['ideas'], 'b' => $n['shipped']]),
                 'bars' => bars_of(array_map(function ($mm) use ($eid) { $r = month_row($eid, $mm['month']); return $r ? $r['innovation_creativity'] : 0; }, array_slice($n['months'], -4)))],
                ['title' => m('e09.id_f2_t'), 'text' => m('e09.id_f2_x', ['trait' => m('dna.' . $weak['key']), 'v' => $weak['value'], 'waiting' => $n['waiting']]),
                 'bars' => bars_of([$n['dna']['idea_generation'] ?? 0, $n['dna']['experimentation'] ?? 0, $n['dna']['digital_innovation'] ?? 0, $n['dna']['implementation'] ?? 0]), 'warm' => true],
            ],
            'recommendation' => m('e09.id_rec'), 'actions' => ['plan', 'join'],
            'numbers' => [['label' => m('crit.innovation_creativity'), 'value' => ($was ?? '—') . ' → ' . $now], ['label' => m('dna.' . $weak['key']), 'value' => $weak['value']]],
        ];
    }

    if ($intent === 'course') {
        $gaps = query('SELECT skill, value, target FROM growth_skills WHERE employee_id = ? AND value < target ORDER BY (target - value) DESC LIMIT 3', [$eid])->fetchAll();
        $mod = $n['module'];
        return $base + [
            'headline' => $mod ? m('e09.co_h', ['title' => $mod['title'], 'pct' => $mod['progress']]) : m('e09.co_h_none'),
            'data' => array_map(function ($g) { return ['label' => m('e09.d_skill', ['skill' => $g['skill'], 'a' => (int) $g['value'], 'b' => (int) $g['target']])]; }, $gaps),
            'findings' => array_map(function ($g, $i) {
                return ['title' => m('e09.co_f_t', ['skill' => $g['skill']]), 'text' => m('e09.co_f_x', ['a' => (int) $g['value'], 'b' => (int) $g['target'], 'gap' => (int) $g['target'] - (int) $g['value']]),
                        'bars' => [$g['value'], $g['target']]];
            }, $gaps, array_keys($gaps)),
            'recommendation' => $mod ? m('e09.co_rec', ['title' => $mod['title']]) : m('e09.co_rec_none'), 'actions' => ['plan'],
            'numbers' => array_map(function ($g) { return ['label' => $g['skill'], 'value' => (int) $g['value'] . ' / ' . (int) $g['target']]; }, $gaps),
        ];
    }

    if ($intent === 'lead_ready') {
        $skills = query('SELECT skill, value, target FROM growth_skills WHERE employee_id = ?', [$eid])->fetchAll();
        $met = 0; $sum = 0;
        foreach ($skills as $sk) { if ((int) $sk['value'] >= (int) $sk['target']) { $met++; } $sum += min(1, $sk['value'] / max(1, $sk['target'])) * 100; }
        $ready = isset($facts['growth_ready_pct']) ? (int) $facts['growth_ready_pct'] : ($skills ? (int) round($sum / count($skills)) : 0);
        $goal = query("SELECT title FROM growth_milestones WHERE employee_id = ? AND state = 'goal' LIMIT 1", [$eid])->fetch();
        usort($skills, function ($a, $b) { return ($b['target'] - $b['value']) <=> ($a['target'] - $a['value']); });
        $gap = $skills ? $skills[0] : null;
        return $base + [
            'headline' => m('e09.lr_h', ['ready' => $ready, 'goal' => $goal ? $goal['title'] : '']),
            'data' => [['label' => m('e09.d_met', ['a' => $met, 'b' => count($skills)])], ['label' => m('e09.d_risk', ['n' => (int) $p['burnout_risk_pct']])]],
            'findings' => [
                ['title' => m('e09.lr_f1_t'), 'text' => m('e09.lr_f1_x', ['a' => $met, 'b' => count($skills)]), 'bars' => [$ready, 100]],
                ['title' => m('e09.lr_f2_t'), 'text' => $gap ? m('e09.lr_f2_x', ['skill' => $gap['skill'], 'a' => (int) $gap['value'], 'b' => (int) $gap['target']]) : m('e09.lr_f2_none'),
                 'bars' => $gap ? [$gap['value'], $gap['target']] : [100], 'warm' => true],
            ],
            'recommendation' => m('e09.lr_rec'), 'actions' => ['plan', 'share'],
            'numbers' => array_map(function ($sk) { return ['label' => $sk['skill'], 'value' => (int) $sk['value'] . ' / ' . (int) $sk['target']]; }, $skills),
        ];
    }

    // summary
    $june = month_row($eid, month_before($dates['as_of'], 3));
    $awards = awards_of($eid, quarter_start($dates['as_of']), 20);
    return $base + [
        'headline' => m('e09.su_h', ['score' => $s['rounded'], 'tier' => $s['tier'], 'change' => ($s['change'] === null ? 0 : $s['change'])]),
        'data' => [['label' => m('e09.d_task', ['n' => (int) $p['task_completion']])], ['label' => m('e09.d_innovation', ['n' => (int) $p['innovation_creativity']])],
                   ['label' => m('e09.d_recognition', ['n' => count($awards)])]],
        'findings' => [
            ['title' => m('e09.su_f1_t'), 'text' => m('e09.su_f1_x', ['a' => $june ? (int) $june['empulse_score'] : $s['rounded'], 'b' => $s['rounded']]),
             'bars' => bars_of(array_map(function ($mm) { return $mm['empulse_score']; }, array_slice($n['months'], -4)))],
            ['title' => m('e09.su_f2_t'), 'text' => m('e09.su_f2_x', ['n' => count($awards), 'ideas' => $n['ideas'], 'shipped' => $n['shipped']]), 'bars' => [count($awards), $n['shipped']], 'warm' => true],
        ],
        'recommendation' => m('e09.su_rec'), 'actions' => ['plan'],
        'numbers' => [['label' => m('e09.n_score'), 'value' => ($june ? (int) $june['empulse_score'] : '—') . ' → ' . $s['rounded']]],
    ];
}

// ----- the two-week plan -----
function plan_for($eid, $p, $facts, $dates)
{
    $n = my_numbers($eid, $p, $facts, $dates);
    $s = $n['score'];
    $manager = $p['manager_name'] ? explode(' ', $p['manager_name'])[0] : '';
    $start = $dates['as_of'];
    $d = function ($days) use ($start) { return date('Y-m-d', strtotime($start . ' +' . $days . ' days')); };
    $draft = query("SELECT title FROM ideas WHERE owner_id = ? AND status = 'draft' ORDER BY id DESC LIMIT 1", [$eid])->fetch();
    $items = [];
    if ($n['project']) { $items[] = ['date' => $d(1), 'text' => m('e09.pl_note', ['manager' => $manager, 'project' => $n['project']])]; }
    if ($draft) { $items[] = ['date' => $d(2), 'text' => m('e09.pl_proto', ['idea' => $draft['title'], 'team' => $p['team'] ?: $p['department']])]; }
    if ($n['mentor']) { $items[] = ['date' => $d(4), 'text' => m('e09.pl_mentor', ['mentor' => $n['mentor']])]; }
    if ($n['module']) { $items[] = ['date' => $d(5), 'text' => m('e09.pl_module', ['title' => $n['module']['title']])]; }
    $items[] = ['date' => $d(11), 'text' => m('e09.pl_demo')];
    $target = (int) $s['rounded'] + 3;
    $items[] = ['date' => $d(14), 'text' => m('e09.pl_check', ['target' => $target])];
    $weak = weakest_trait($eid);
    return ['title' => m('e09.pl_title', ['name' => $p['full_name']]), 'items' => $items,
            'expected' => m('e09.pl_expected', ['a' => $s['rounded'], 'b' => $target, 'trait' => m('dna.' . $weak['key']), 'x' => $weak['value'], 'y' => min(100, $weak['value'] + 5)]),
            'owner' => $p['full_name'], 'followup' => $d(14)];
}

function classify($text)
{
    $t = strtolower($text);
    if (preg_match('/plan/', $t)) { return 'plan'; }
    if (preg_match('/gold|tier|reach/', $t)) { return 'reach_gold'; }
    if (preg_match('/innovation|drop/', $t)) { return 'innovation_drop'; }
    if (preg_match('/course|learn|study/', $t)) { return 'course'; }
    if (preg_match('/lead|ready/', $t)) { return 'lead_ready'; }
    if (preg_match('/summar|progress|quarter/', $t)) { return 'summary'; }
    return null;
}

function recent_of($eid)
{
    $rows = query('SELECT id, intent, question, asked_at FROM pulseai_log WHERE employee_id = ? AND intent <> ? AND intent <> ? ORDER BY asked_at DESC, id DESC LIMIT 20',
                  [$eid, 'plan', 'plan_saved'])->fetchAll();
    $seen = []; $out = [];
    foreach ($rows as $r) {
        if (isset($seen[$r['intent']])) { continue; }
        $seen[$r['intent']] = true;
        $out[] = ['id' => (int) $r['id'], 'intent' => $r['intent'], 'question' => $r['question']];
        if (count($out) >= 6) { break; }
    }
    return $out;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $b = read_json();
    if (($b['action'] ?? '') === 'helpful') {
        query('UPDATE pulseai_log SET helpful = ? WHERE id = ? AND employee_id = ?', [(int) !!($b['value'] ?? 0), (int) ($b['id'] ?? 0), $eid]);
        send_json(['ok' => true]);
    }
    if (($b['action'] ?? '') === 'save_plan') {
        query('INSERT INTO pulseai_log (employee_id, intent, question, asked_at) VALUES (?, ?, ?, ?)',
              [$eid, 'plan_saved', 'Two-week growth plan saved', $dates['as_of'] . ' ' . date('H:i:s')]);
        send_json(['ok' => true]);
    }
    $intent = $b['intent'] ?? null;
    $text = trim((string) ($b['question'] ?? ''));
    if ($text !== '' && mb_strlen($text) > 200) { send_json(['error' => 'too_long'], 400); }
    if ($intent === null && $text !== '') { $intent = classify($text); }
    $asked = $text !== '' ? $text : ($intent === 'plan' ? 'Create a two-week plan to reach Gold.' : (INTENT_QUESTIONS[$intent] ?? ''));
    if ($intent === 'plan') {
        query('INSERT INTO pulseai_log (employee_id, intent, question, asked_at) VALUES (?, ?, ?, ?)', [$eid, 'plan', $asked, $dates['as_of'] . ' ' . date('H:i:s')]);
        $id = (int) query('SELECT MAX(id) AS m FROM pulseai_log WHERE employee_id = ?', [$eid])->fetch()['m'];
        send_json(['id' => $id, 'intent' => 'plan', 'question' => $asked, 'plan' => plan_for($eid, $p, $facts, $dates), 'recent' => recent_of($eid)]);
    }
    if (!in_array($intent, INTENTS, true)) {
        send_json(['intent' => 'unknown', 'question' => $text, 'unknown' => true, 'recent' => recent_of($eid)]);
    }
    query('INSERT INTO pulseai_log (employee_id, intent, question, asked_at) VALUES (?, ?, ?, ?)', [$eid, $intent, $asked, $dates['as_of'] . ' ' . date('H:i:s')]);
    $id = (int) query('SELECT MAX(id) AS m FROM pulseai_log WHERE employee_id = ?', [$eid])->fetch()['m'];
    $a = answer_for($intent, $eid, $p, $facts, $dates);
    $a['id'] = $id; $a['question'] = $asked; $a['recent'] = recent_of($eid);
    send_json($a);
}

$recent = recent_of($eid);
$latest = 'reach_gold';   // the screen opens with the first question of the design
$first = answer_for($latest, $eid, $p, $facts, $dates);
$first['id'] = 0;
foreach ($recent as $r) { if ($r['intent'] === $latest) { $first['id'] = $r['id']; } }
$sc = score_block($p, month_row($eid, month_before($dates['as_of'], 3)));
send_json([
    'who' => who_block($p), 'recent' => $recent, 'suggest' => array_slice(INTENTS, 1, 4),
    'questions' => INTENT_QUESTIONS, 'first' => $first, 'pill' => $sc['next'] ? ['points' => $sc['next']['points'], 'tier' => $sc['next']['key']] : null,
    'context' => ['name' => $p['full_name'], 'fresh' => '06:00'],
]);
