<?php
// server/api/employee/marketplace.php — E06 Innovation Marketplace.
// GET : the numbers of the quarter, the featured idea, PulseAI's matches for its open roles, the opportunity list.
// POST: {"action":"join","code":"IDEA-117"} -> I join an idea as a contributor.
// PRIVACY: matches never include a person with burnout risk above 50%. No scores of other people are shown.
require __DIR__ . '/../../employee_data.php';

$user = require_role(['employee']);
$eid = my_employee_id($user);
$dates = app_dates();
$quarter = quarter_start($dates['as_of']);
$year = substr($dates['as_of'], 0, 4) . '-01-01';
$p = load_person($eid);

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $body = read_json();
    if (($body['action'] ?? '') !== 'join') { send_json(['error' => 'bad_action'], 400); }
    $idea = query('SELECT id, status, open_roles FROM ideas WHERE code = ?', [(string) ($body['code'] ?? '')])->fetch();
    if (!$idea || !in_array($idea['status'], ['approved', 'in_build'], true) || !$idea['open_roles']) { send_json(['error' => 'not_open'], 400); }
    $has = query('SELECT 1 FROM idea_members WHERE idea_id = ? AND employee_id = ?', [$idea['id'], $eid])->fetch();
    if (!$has) { query('INSERT INTO idea_members (idea_id, employee_id, role) VALUES (?, ?, ?)', [$idea['id'], $eid, 'contributor']); }
    send_json(['ok' => true, 'joined' => true]);
}

// ----- The five numbers -----
$submitted = (int) query('SELECT COUNT(*) AS n FROM ideas WHERE submitted_at >= ?', [$quarter])->fetch()['n'];
$approved = (int) query("SELECT COUNT(*) AS n FROM ideas WHERE decided_at >= ? AND status IN ('approved','in_build','implemented')", [$quarter])->fetch()['n'];
$in_build = (int) query("SELECT COUNT(*) AS n FROM ideas WHERE status = 'in_build'")->fetch()['n'];
$contrib = (int) query("SELECT COUNT(DISTINCT m.employee_id) AS n FROM idea_members m JOIN ideas i ON i.id = m.idea_id WHERE i.status = 'in_build'")->fetch()['n'];
$implemented = (int) query("SELECT COUNT(*) AS n FROM ideas WHERE status = 'implemented' AND implemented_at >= ?", [$year])->fetch()['n'];
$savings = (int) query("SELECT COALESCE(SUM(realized_savings_sar), 0) AS s FROM ideas WHERE status = 'implemented' AND verified_at IS NOT NULL AND implemented_at >= ?", [$year])->fetch()['s'];
$stats = ['quarter' => (int) floor(((int) substr($quarter, 5, 2) + 2) / 3), 'year' => (int) substr($quarter, 0, 4), 'submitted' => $submitted, 'approved' => $approved, 'approval_rate' => $submitted ? (int) round($approved / $submitted * 100) : 0,
          'in_build' => $in_build, 'contributors' => $contrib, 'implemented' => $implemented, 'savings_sar' => $savings];

// ----- The opportunity list: ideas decided this quarter (approved, in build, implemented) -----
$rows = query("SELECT i.id, i.code, i.title, i.status, i.note, i.open_roles, i.expected_savings_sar, i.realized_savings_sar,
                      i.cost_sar, i.progress_pct, i.verified_at, i.owner_id, d.name AS department
               FROM ideas i JOIN departments d ON d.id = i.department_id
               WHERE i.decided_at >= ? AND i.status IN ('approved','in_build','implemented')", [$quarter])->fetchAll();
$list = [];
$matches = 0;
foreach ($rows as $r) {
    $roles = open_roles_list($r['open_roles']);
    $fits = false;
    foreach ($roles as $role) { if (role_fits($role, $p['job_title'])) { $fits = true; } }
    $member = (bool) query('SELECT 1 FROM idea_members WHERE idea_id = ? AND employee_id = ?', [$r['id'], $eid])->fetch();
    $open = $r['status'] !== 'implemented' && count($roles) > 0;
    $kind = $r['status'] === 'implemented' ? 'implemented' : ($r['status'] === 'approved' ? 'recruiting' : (strcasecmp((string) $r['note'], 'Pilot') === 0 ? 'pilot' : 'in_build'));
    if ($fits && $open && !$member) { $matches++; }
    $list[] = ['code' => $r['code'], 'title' => $r['title'], 'kind' => $kind, 'department' => $r['department'],
               'progress' => (int) $r['progress_pct'], 'roles' => $roles, 'open' => $open, 'member' => $member,
               'mine' => (int) $r['owner_id'] === $eid, 'fits' => $fits && $open, 'verified' => $r['verified_at'] !== null,
               'sar' => $r['status'] === 'implemented' ? (int) $r['realized_savings_sar'] : (int) $r['expected_savings_sar']];
}
$rank = ['pilot' => 0, 'in_build' => 0, 'recruiting' => 1, 'implemented' => 2];
usort($list, function ($a, $b) use ($rank) {
    return [$rank[$a['kind']], -$a['progress'], -$a['sar']] <=> [$rank[$b['kind']], -$b['progress'], -$b['sar']];
});
// the order of the design: building ideas, recruiting ideas, then implemented ones; but a recruiting idea needs a place in the first row
$counts = ['all' => count($list), 'recruiting' => 0, 'in_build' => 0, 'implemented' => 0, 'matches' => $matches];
foreach ($list as $l) {
    if ($l['kind'] === 'recruiting') { $counts['recruiting']++; }
    elseif ($l['kind'] === 'implemented') { $counts['implemented']++; }
    else { $counts['in_build']++; }
}

// ----- The featured idea: the approved idea whose open roles fit me, else the newest approved idea with open roles -----
$feat = null;
foreach (query("SELECT i.*, d.name AS department FROM ideas i JOIN departments d ON d.id = i.department_id
                WHERE i.status = 'approved' AND i.open_roles IS NOT NULL AND i.owner_id <> ? ORDER BY i.decided_at DESC, i.id DESC", [$eid])->fetchAll() as $c) {
    foreach (open_roles_list($c['open_roles']) as $role) { if (role_fits($role, $p['job_title'])) { $feat = $c; break 2; } }
    if ($feat === null) { $feat = $c; }
}
$featured = null; $recommend = [];
if ($feat) {
    $detail = query('SELECT solution, duration_weeks FROM idea_details WHERE idea_id = ?', [$feat['id']])->fetch();
    $team = [];
    foreach (query('SELECT e.id, e.full_name FROM idea_members m JOIN employees e ON e.id = m.employee_id WHERE m.idea_id = ?
                    ORDER BY (CASE WHEN m.role = ? THEN 0 ELSE 1 END), e.full_name', [$feat['id'], 'owner'])->fetchAll() as $m) {
        $team[] = ['name' => $m['full_name'], 'initials' => initials_of($m['full_name'])];
    }
    $starts = null;
    if ($feat['note'] && preg_match('/starts\s+(\d{1,2})\s+([A-Za-z]{3})/i', $feat['note'], $m)) { $starts = ['day' => (int) $m[1], 'month' => strtolower($m[2])]; }
    $cost = (int) $feat['cost_sar']; $sav = (int) $feat['expected_savings_sar'];
    $roles = open_roles_list($feat['open_roles']);
    $featured = ['code' => $feat['code'], 'title' => $feat['title'], 'department' => $feat['department'],
                 'text' => $detail ? $detail['solution'] : null, 'savings_sar' => $sav, 'cost_sar' => $cost,
                 'roi' => $cost ? round($sav / $cost, 1) : null, 'weeks' => $detail ? (int) $detail['duration_weeks'] : null,
                 'starts' => $starts, 'team' => array_slice($team, 0, 2), 'roles' => $roles];
    // PulseAI's match for each open role: the best fit among people whose title fits, burnout risk 50% or less, not yet in the team.
    $taken = [];
    foreach ($roles as $role) {
        $best = null;
        foreach (role_patterns($role) as $pattern) {      // the first pattern that finds anyone decides (ML Engineer before Data Scientist)
            $found = query('SELECT e.id, e.full_name, e.job_title, d.name AS department, c.burnout_risk_pct, c.workload_index
                            FROM employees e JOIN employee_current c ON c.employee_id = e.id JOIN departments d ON d.id = e.department_id
                            WHERE e.job_title LIKE ? AND c.burnout_risk_pct <= 50 AND e.app_role = ?
                              AND e.id NOT IN (SELECT employee_id FROM idea_members WHERE idea_id = ?)
                              AND e.id NOT IN (SELECT employee_id FROM user_settings WHERE setting_key = \'pulseai_suggest\' AND setting_value = 0)', [$pattern, 'employee', $feat['id']])->fetchAll();
            foreach ($found as $f) {
                if (isset($taken[$f['id']])) { continue; }
                $score = fit_score((int) $f['id']);
                if ($best === null || $score > $best['fit']) { $best = ['fit' => $score, 'row' => $f]; }
            }
            if ($best !== null) { break; }
        }
        if ($best === null) { continue; }
        $f = $best['row'];
        $taken[$f['id']] = true;
        $trait = strongest_trait((int) $f['id']);
        $weak = (int) $f['id'] === $eid ? weakest_trait($eid) : null;
        $recommend[] = ['id' => (int) $f['id'], 'name' => $f['full_name'], 'initials' => initials_of($f['full_name']), 'you' => (int) $f['id'] === $eid,
                        'job_title' => $f['job_title'], 'department' => $f['department'], 'fit' => $best['fit'], 'role' => $role,
                        'trait' => $trait ? $trait['key'] : null, 'trait_value' => $trait ? $trait['value'] : null,
                        'wants' => $weak ? $weak['key'] : null,
                        'capacity' => (int) (round((100 - (float) $f['workload_index']) / 5) * 5)];
    }
    usort($recommend, function ($a, $b) { return $b['fit'] <=> $a['fit']; });
    $recommend = array_slice($recommend, 0, 3);
}

send_json(['who' => who_block($p), 'stats' => $stats, 'featured' => $featured, 'recommend' => $recommend, 'counts' => $counts, 'list' => $list,
           'my_title' => role_of($p['job_title'])]);
