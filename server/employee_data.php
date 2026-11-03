<?php
// =====================================================================
// server/employee_data.php — shared by the employee screens E01-E04.
// Each API file (server/api/employee/*.php) starts with:
//     require __DIR__ . '/../../employee_data.php';
//     $user = require_role(['employee']);
//     $eid  = my_employee_id($user);
// PRIVACY: everything here reads ONE person's own data (the signed-in employee).
// Company-wide numbers (median, "top 10%") are only totals, never other people's rows.
//
// The queries use only plain SQL (no MySQL-only functions) and PDO prepared statements.
// Dates are calculated in PHP.
// =====================================================================

require_once __DIR__ . '/functions.php';

// The seven criteria in the order the design lists them in the score table.
const CRITERIA_ORDER = ['task_completion', 'attendance_discipline', 'professional_behavior',
                        'innovation_creativity', 'teamwork', 'technology_adoption', 'job_burnout'];

// The seven Innovation DNA traits (columns of the table innovation_dna).
const DNA_TRAITS = ['idea_generation', 'problem_solving', 'experimentation', 'collaboration',
                    'digital_innovation', 'implementation', 'business_impact'];


// ---------- Who and when ----------

// The employee row that belongs to the signed-in account (users.employee_id).
function my_employee_id($user)
{
    $row = query('SELECT employee_id FROM users WHERE id = ?', [$user['id']])->fetch();
    if (!$row || !$row['employee_id']) {
        send_json(['error' => 'no_employee_record'], 404);
    }
    return (int) $row['employee_id'];
}

// The demo "today" (table app_settings): as_of = the date, latest_week = Monday of the last full week.
function app_dates()
{
    $dates = ['as_of' => '2026-09-21', 'latest_week' => '2026-09-14'];
    foreach (query('SELECT setting_key, setting_value FROM app_settings')->fetchAll() as $row) {
        if ($row['setting_key'] === 'as_of_date')   { $dates['as_of'] = $row['setting_value']; }
        if ($row['setting_key'] === 'latest_week')  { $dates['latest_week'] = $row['setting_value']; }
    }
    return $dates;
}

// Monday of the week of a date ('2026-09-21' -> '2026-09-21').
function monday_of($date)
{
    $time = strtotime($date);
    $back = (int) date('N', $time) - 1;
    return date('Y-m-d', strtotime("-$back days", $time));
}

// First day of the month, some months before a date.
function month_before($date, $months)
{
    return date('Y-m-01', strtotime(date('Y-m-01', strtotime($date)) . " -$months months"));
}

// First day of the month after a date's month.
function month_after($date)
{
    return date('Y-m-01', strtotime(date('Y-m-01', strtotime($date)) . ' +1 month'));
}

function initials_of($name)
{
    $parts = preg_split('/\s+/', trim($name));
    return strtoupper(substr($parts[0], 0, 1) . substr(end($parts), 0, 1));
}


// ---------- The person ----------

function load_person($eid)
{
    $sql = 'SELECT e.id, e.employee_code, e.full_name, e.job_title, e.job_level, e.tenure_years, e.team_id,
                   e.department_id, d.name AS department, t.name AS team, m.full_name AS manager_name,
                   c.burnout_risk_pct, c.burnout_change_6w, c.attrition_risk_pct, c.engagement_score,
                   c.workload_index, c.overtime_hours_monthly,
                   c.attendance_discipline, c.task_completion, c.innovation_creativity, c.teamwork,
                   c.professional_behavior, c.technology_adoption, c.job_burnout,
                   c.empulse_score_exact, c.empulse_score, c.tier, c.development_plan
            FROM employees e
            JOIN employee_current c ON c.employee_id = e.id
            JOIN departments d ON d.id = e.department_id
            LEFT JOIN teams t ON t.id = e.team_id
            LEFT JOIN employees m ON m.id = e.manager_id
            WHERE e.id = ?';
    $person = query($sql, [$eid])->fetch();
    if (!$person) {
        send_json(['error' => 'no_data'], 404);
    }
    return $person;
}

// The "who" block shown in the page.
function who_block($p)
{
    return [
        'name'          => $p['full_name'],
        'first_name'    => explode(' ', $p['full_name'])[0],
        'initials'      => initials_of($p['full_name']),
        'job_title'     => $p['job_title'],
        'department'    => $p['department'],
        'team'          => $p['team'],
        'manager_name'  => $p['manager_name'],
        'tenure_years'  => (float) $p['tenure_years'],
    ];
}


// ---------- The score ----------

// The seven criteria as a list: key, name, score (0-100), weight, points.
// The score is calculated with the weights in server/config.php.
function criteria_rows($p)
{
    global $CONFIG;
    // empulse_score() wants the burnout RISK for job_burnout (it turns it into 100 - risk).
    $values = [];
    foreach ($CONFIG['criteria'] as $key => $c) {
        $values[$key] = ($key === 'job_burnout') ? (int) $p['burnout_risk_pct'] : (int) $p[$key];
    }
    $result = empulse_score($values);
    $rows = [];
    foreach (CRITERIA_ORDER as $key) {
        $r = $result['rows'][$key];
        $rows[] = ['key' => $key, 'name' => $r['name'], 'score' => (int) $r['score'],
                   'weight' => (int) $r['weight'], 'points' => round($r['points'], 2)];
    }
    return ['rows' => $rows, 'exact' => $result['total'], 'rounded' => $result['rounded']];
}

function tier_key($name)
{
    return ['Gold' => 'gold', 'Silver' => 'silver', 'Bronze' => 'bronze', 'Growth Needed' => 'growth'][$name];
}

// The next tier above this score: ['key' => 'gold', 'min' => 90, 'points' => 6] or null for Gold.
function next_tier($score)
{
    global $CONFIG;
    $tiers = $CONFIG['tiers'];                       // high to low
    foreach ($tiers as $i => $tier) {
        if ($score >= $tier['min']) {
            if ($i === 0) {
                return null;
            }
            $next = $tiers[$i - 1];
            return ['key' => tier_key($next['name']), 'min' => $next['min'], 'points' => $next['min'] - $score];
        }
    }
    return null;
}

// Score card shared by E01, E02 and E03.
function score_block($p, $june)
{
    $calc = criteria_rows($p);
    $score = $calc['rounded'];
    $tier = tier_for($score);
    return [
        'exact'          => $calc['exact'],
        'rounded'        => $score,
        'tier'           => tier_key($tier),
        'next'           => next_tier($score),
        'change'         => $june ? $score - (int) $june['empulse_score'] : null,   // since June
        'rows'           => $calc['rows'],
    ];
}

// The last N month-end scores of a person, oldest first.
function month_scores($eid, $count)
{
    $sql = 'SELECT month, empulse_score, empulse_score_exact, tier FROM monthly_scores
            WHERE employee_id = ? ORDER BY month DESC LIMIT ' . (int) $count;
    return array_reverse(query($sql, [$eid])->fetchAll());
}

function month_row($eid, $month)
{
    $row = query('SELECT * FROM monthly_scores WHERE employee_id = ? AND month = ?', [$eid, $month])->fetch();
    return $row ?: null;
}

// Pulse: the seven criteria now and in the comparison month (June).
function pulse_view($p, $june)
{
    $out = [];
    foreach (CRITERIA_ORDER as $key) {
        $now = (int) $p[$key];
        $before = $june ? (int) $june[$key] : null;
        $out[] = ['key' => $key, 'now' => $now, 'before' => $before];
    }
    return $out;
}

// How many dimensions are above / equal / below the comparison month.
function pulse_summary($pulse)
{
    $s = ['above' => 0, 'same' => 0, 'below' => 0];
    foreach ($pulse as $d) {
        if ($d['before'] === null || $d['now'] === $d['before']) { $s['same']++; }
        elseif ($d['now'] > $d['before'])                        { $s['above']++; }
        else                                                     { $s['below']++; }
    }
    return $s;
}

// One word for how the person is doing. A rule on the score and the burnout risk.
function status_key($p)
{
    if ($p['burnout_risk_pct'] >= 60) { return 'burnout_risk'; }
    if ($p['burnout_risk_pct'] >= 45) { return 'stretched'; }
    if ($p['empulse_score'] >= 80)    { return 'thriving'; }
    return 'steady';
}

// The what-if planner: three dimensions with a realistic default gain.
function planner_defaults($rows)
{
    $gains = ['innovation_creativity' => 9, 'teamwork' => 6, 'job_burnout' => 15];
    $items = [];
    foreach ($rows as $r) {
        if (isset($gains[$r['key']])) {
            $to = min(100, $r['score'] + $gains[$r['key']]);
            if ($to > $r['score']) {
                $items[] = ['key' => $r['key'], 'weight' => $r['weight'], 'from' => $r['score'], 'to' => $to,
                            'points' => round(($to - $r['score']) * $r['weight'] / 100, 2)];
            }
        }
    }
    return $items;
}


// ---------- Company totals (never other people's rows) ----------

// All values of one column (whitelisted names only, so the SQL text is safe).
function org_values($table, $column)
{
    $allowed = [
        'employee_current'  => ['task_completion', 'attendance_discipline', 'professional_behavior',
                                'innovation_creativity', 'teamwork', 'technology_adoption', 'job_burnout'],
        'innovation_dna'    => DNA_TRAITS,
    ];
    if (!isset($allowed[$table]) || !in_array($column, $allowed[$table], true)) {
        send_json(['error' => 'bad_column'], 400);
    }
    $values = [];
    foreach (query("SELECT $column AS v FROM $table")->fetchAll() as $row) {
        $values[] = (int) $row['v'];
    }
    sort($values);
    return $values;
}

function median_of($sorted)
{
    $n = count($sorted);
    if ($n === 0) { return null; }
    $mid = intdiv($n, 2);
    return $n % 2 ? $sorted[$mid] : ($sorted[$mid - 1] + $sorted[$mid]) / 2;
}

// "Top N%": the share of people with a higher value, rounded up to 10, 25 or 50 (100 = not in the top half).
function top_percent($sorted, $value)
{
    $n = count($sorted);
    $higher = 0;
    foreach ($sorted as $v) {
        if ($v > $value) { $higher++; }
    }
    $share = $n ? ($higher + 1) / $n * 100 : 100;
    foreach ([10, 25, 50] as $bucket) {
        if ($share <= $bucket) { return $bucket; }
    }
    return 100;
}


// ---------- Recognition and ideas of one person ----------

function awards_of($eid, $since, $limit)
{
    $sql = 'SELECT category, giver_id, giver_name, message, linked_outcome, created_at
            FROM recognitions WHERE receiver_id = ? AND kind = ? AND created_at >= ?
            ORDER BY created_at DESC, id DESC LIMIT ' . (int) $limit;
    $rows = query($sql, [$eid, 'award', $since])->fetchAll();
    foreach ($rows as &$r) {
        $r['from'] = $r['giver_name'];
        if ($r['giver_id']) {
            $g = query('SELECT full_name FROM employees WHERE id = ?', [$r['giver_id']])->fetch();
            $r['from'] = $g ? $g['full_name'] : null;
        }
        unset($r['giver_id'], $r['giver_name']);
    }
    return $rows;
}

// Ideas the person leads or joined, newest first, with a stage number 1-6.
function ideas_of($eid)
{
    $sql = 'SELECT i.code, i.title, i.status, i.note, i.open_roles, i.realized_savings_sar,
                   i.expected_savings_sar, i.created_at
            FROM ideas i JOIN idea_members m ON m.idea_id = i.id
            WHERE m.employee_id = ? ORDER BY i.created_at DESC, i.id DESC LIMIT 6';
    $stage = ['draft' => 1, 'ai_reviewed' => 2, 'approved' => 3, 'in_build' => 5, 'implemented' => 6];
    $ideas = query($sql, [$eid])->fetchAll();
    foreach ($ideas as &$idea) {
        $idea['stage'] = $stage[$idea['status']] ?? 1;
        $idea['realized_savings_sar'] = (int) $idea['realized_savings_sar'];
        $idea['expected_savings_sar'] = (int) $idea['expected_savings_sar'];
    }
    return $ideas;
}

// Numbers written inside an idea's note: "Report requests -38% · adopted by 5 teams".
function idea_note_numbers($note)
{
    $out = ['requests_pct' => null, 'teams' => null];
    if ($note && preg_match('/([-\x{2212}]\d+)\s*%/u', $note, $m)) {
        $out['requests_pct'] = (int) str_replace("\u{2212}", '-', $m[1]);
    }
    if ($note && preg_match('/(\d+)\s+teams/i', $note, $m)) {
        $out['teams'] = (int) $m[1];
    }
    return $out;
}


// ---------- Private check-in ----------

// The check-in state of a person (E01 "Private check-in"). The answers are private:
// this is only used for the person's own screen.
function checkin_state($eid, $as_of)
{
    $this_week = monday_of($as_of);
    $rows = query('SELECT week_start, energy, share_trend FROM checkins WHERE employee_id = ?
                   ORDER BY week_start DESC LIMIT 60', [$eid])->fetchAll();
    $weeks = [];
    foreach ($rows as $r) {
        $weeks[$r['week_start']] = $r;
    }
    $answered_now = isset($weeks[$this_week]);
    // Streak: consecutive weeks with a check-in. The current week may still be open.
    $cursor = $answered_now ? $this_week : date('Y-m-d', strtotime('-7 days', strtotime($this_week)));
    $streak = 0;
    while (isset($weeks[$cursor])) {
        $streak++;
        $cursor = date('Y-m-d', strtotime('-7 days', strtotime($cursor)));
    }
    $last = $rows ? $rows[0] : null;
    return [
        'this_week'       => $this_week,
        'answered_now'    => $answered_now,
        'energy'          => $last ? (int) $last['energy'] : null,    // 1 Drained ... 5 Energised
        'last_week'       => $last ? $last['week_start'] : null,
        'streak_weeks'    => $streak,
        'share_trend'     => $last ? (int) $last['share_trend'] === 1 : false,
    ];
}


// ---------- Small extras (tables from server/phase1.sql, filled for the demo employee) ----------
// If the table does not exist yet (phase1.sql not imported) the card is simply empty.

function try_query($sql, $params = [])
{
    try {
        return query($sql, $params)->fetchAll();
    } catch (PDOException $e) {
        return [];
    }
}

function activity_of($eid, $latest_week)
{
    $rows = try_query('SELECT week_start, planned_hours, work_hours, focus_hours, meeting_hours, after_hours
                       FROM weekly_activity WHERE employee_id = ? AND week_start <= ?
                       ORDER BY week_start DESC LIMIT 1', [$eid, $latest_week]);
    if (!$rows) { return null; }
    $r = $rows[0];
    return ['week' => $r['week_start'], 'planned' => (float) $r['planned_hours'], 'work' => (float) $r['work_hours'],
            'focus' => (float) $r['focus_hours'], 'meetings' => (float) $r['meeting_hours'],
            'after_hours' => (float) $r['after_hours']];
}

function mentor_of($eid, $as_of)
{
    $rows = try_query('SELECT mentor_name, session_at, topic FROM mentor_sessions
                       WHERE employee_id = ? AND session_at >= ? ORDER BY session_at LIMIT 1', [$eid, $as_of . ' 00:00:00']);
    if (!$rows) { return null; }
    return ['mentor' => $rows[0]['mentor_name'], 'at' => $rows[0]['session_at'], 'topic' => $rows[0]['topic'],
            'initials' => initials_of($rows[0]['mentor_name'])];
}

// The growth path: the goal and the module in progress (the first one below 100%).
function growth_of($eid)
{
    $rows = try_query('SELECT goal_title, seq, total, title, description, progress_pct
                       FROM growth_modules WHERE employee_id = ? ORDER BY seq', [$eid]);
    if (!$rows) { return null; }
    $current = null;
    foreach ($rows as $r) {
        if ((int) $r['progress_pct'] < 100) { $current = $r; break; }
    }
    if ($current === null) { $current = end($rows); }
    return ['goal' => $current['goal_title'], 'seq' => (int) $current['seq'], 'total' => (int) $current['total'],
            'title' => $current['title'], 'description' => $current['description'],
            'progress' => (int) $current['progress_pct']];
}


// ---------- Demo facts and workload (table demo_facts from server/phase1.sql) ----------

// The facts of one person as a map: ['workload_june_pct' => '122', ...]. Empty if the person has none.
function facts_of($eid)
{
    $facts = [];
    foreach (try_query('SELECT fact_key, fact_value FROM demo_facts WHERE employee_id = ?', [$eid]) as $row) {
        $facts[$row['fact_key']] = $row['fact_value'];
    }
    return $facts;
}

// Workload as a percentage of the person's own usual level (100% = their normal).
// "from" = the comparison month, "to" = now, "limit" = the level to stay under,
// "rise" = the biggest rise before the peak burnout week. A fact of the person wins; otherwise it is calculated.
function workload_view($eid, $p, $facts, $compare_month)
{
    $all = query('SELECT AVG(workload_index) AS a FROM weekly_metrics WHERE employee_id = ?', [$eid])->fetch();
    $baseline = $all && $all['a'] ? (float) $all['a'] : (float) $p['workload_index'];
    $month = query('SELECT AVG(workload_index) AS a FROM weekly_metrics WHERE employee_id = ? AND week_start >= ? AND week_start < ?',
                   [$eid, $compare_month, month_after($compare_month)])->fetch();
    $from = $month && $month['a'] !== null ? (int) round((float) $month['a'] / $baseline * 100) : null;
    $to = (int) round((float) $p['workload_index'] / $baseline * 100);
    $rise = $from !== null && $from > 0 ? max(0, (int) round(($from - 100))) : 0;
    return [
        'from'  => isset($facts['workload_june_pct']) ? (int) $facts['workload_june_pct'] : $from,
        'to'    => isset($facts['workload_now_pct']) ? (int) $facts['workload_now_pct'] : $to,
        'limit' => isset($facts['workload_limit_pct']) ? (int) $facts['workload_limit_pct'] : 105,
        'rise'  => isset($facts['workload_rise_pct']) ? (int) $facts['workload_rise_pct'] : $rise,
    ];
}


// An approved idea (of someone else) that still needs the person's role, e.g. "Data Analyst".
// The role is taken from the job title without a level word ("Senior Data Analyst" -> "Data Analyst").
function joinable_idea($eid, $job_title)
{
    $role = trim(preg_replace('/^(Senior|Lead|Junior|Principal|Staff|Chief)\s+/i', '', $job_title));
    $rows = try_query("SELECT code, title FROM ideas WHERE status IN ('approved', 'in_build') AND owner_id <> ?
                       AND open_roles LIKE ? ORDER BY decided_at DESC, id DESC LIMIT 1", [$eid, '%' . $role . '%']);
    return $rows ? $rows[0] : null;
}


// ---------- Helpers for E05-E08 (see server/phase2.sql) ----------

// First day of the quarter of a date ('2026-09-21' -> '2026-07-01').
function quarter_start($date)
{
    $month = (int) substr($date, 5, 2);
    $first = (int) (floor(($month - 1) / 3) * 3 + 1);
    return substr($date, 0, 4) . '-' . str_pad((string) $first, 2, '0', STR_PAD_LEFT) . '-01';
}

// "Senior Data Analyst" -> "Data Analyst" (a role without its level word).
function role_of($job_title)
{
    return trim(preg_replace('/^(Senior|Lead|Junior|Principal|Staff|Chief)\s+/i', '', $job_title));
}

// Text that a job title must contain to fill an open role ("AI Specialist" is filled by ML / data science titles).
function role_patterns($role)
{
    $role = trim($role);
    if (stripos($role, 'AI Specialist') !== false) { return ['%ML Engineer%', '%Data Scientist%', '%AI %']; }
    return ['%' . $role . '%'];
}

// Open roles of an idea as a list: "Data Analyst, UX Designer" or "Data Engineer · Analyst".
function open_roles_list($text)
{
    if (!$text) { return []; }
    $parts = preg_split('/\s*[,·]\s*/u', $text);
    return array_values(array_filter(array_map('trim', $parts), 'strlen'));
}

// Does an open role fit this job title?
function role_fits($role, $job_title)
{
    foreach (role_patterns($role) as $pattern) {
        $needle = trim($pattern, '%');
        if ($needle !== '' && stripos($job_title, $needle) !== false) { return true; }
    }
    return stripos($job_title, $role) !== false;
}

// A fit score 0-100 between a person and a project role. A rule on the person's own data:
// 50% problem solving / implementation / digital innovation, 30% skill levels, 20% low burnout risk, +10 for a matching job title.
function fit_score($eid)
{
    $dna = query('SELECT problem_solving, implementation, digital_innovation FROM innovation_dna WHERE employee_id = ?', [$eid])->fetch();
    $dna_avg = $dna ? ($dna['problem_solving'] + $dna['implementation'] + $dna['digital_innovation']) / 3 : 60;
    $sk = query('SELECT AVG(level) AS a FROM skills WHERE employee_id = ?', [$eid])->fetch();
    $skill_avg = $sk && $sk['a'] ? (float) $sk['a'] * 20 : 60;
    $risk = query('SELECT burnout_risk_pct FROM employee_current WHERE employee_id = ?', [$eid])->fetch();
    $risk_pct = $risk ? (int) $risk['burnout_risk_pct'] : 50;
    return (int) min(99, round(0.5 * $dna_avg + 0.3 * $skill_avg + 0.2 * (100 - $risk_pct) + 10));
}

// The strongest DNA trait of a person: ['key' => 'problem_solving', 'value' => 91].
function strongest_trait($eid)
{
    $dna = query('SELECT * FROM innovation_dna WHERE employee_id = ?', [$eid])->fetch();
    if (!$dna) { return null; }
    $best = null;
    foreach (DNA_TRAITS as $t) {
        if ($best === null || (int) $dna[$t] > $best['value']) { $best = ['key' => $t, 'value' => (int) $dna[$t]]; }
    }
    return $best;
}

function weakest_trait($eid)
{
    $dna = query('SELECT * FROM innovation_dna WHERE employee_id = ?', [$eid])->fetch();
    if (!$dna) { return null; }
    $low = null;
    foreach (DNA_TRAITS as $t) {
        if ($low === null || (int) $dna[$t] < $low['value']) { $low = ['key' => $t, 'value' => (int) $dna[$t]]; }
    }
    return $low;
}

// Days between two dates 'YYYY-MM-DD'.
function days_between($from, $to)
{
    return (int) round((strtotime($to) - strtotime($from)) / 86400);
}
