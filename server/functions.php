<?php
// =====================================================================
// server/functions.php — every API file starts with:
//     require __DIR__ . '/../functions.php';
// It loads the settings, starts the session and gives these functions:
//   1. send_json(), read_json()        answer / read JSON
//   2. db(), query()                   MySQL with PDO (prepared statements only)
//   3. current_user(), require_role()  who is signed in, role check
//   4. empulse_score(), tier_for()     the EMPULSE score
// =====================================================================

$CONFIG = require __DIR__ . '/config.php';

// Optional: server/config.local.php can change settings on your own computer.
if (file_exists(__DIR__ . '/config.local.php')) {
    $CONFIG = array_merge($CONFIG, require __DIR__ . '/config.local.php');
}

// ---------- Session (remembers who is signed in) ----------
// We use our own cookie name. The cookie cannot be read by JavaScript (httponly).
session_name('EMPULSE_SESSION');
session_set_cookie_params(['lifetime' => 0, 'path' => '/', 'httponly' => true, 'samesite' => 'Lax']);
ini_set('session.gc_maxlifetime', (string) ($CONFIG['remember_days'] * 86400));
session_start();


// ---------- 1. JSON ----------

// Send an answer to JavaScript as JSON and stop.
function send_json($data, $status = 200)
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}

// Read the JSON that JavaScript sent with fetch().
// Only "application/json" is accepted: a form on another website cannot send it,
// so this also blocks CSRF attacks.
function read_json()
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        send_json(['error' => 'use_post'], 405);
    }
    if (stripos($_SERVER['CONTENT_TYPE'] ?? '', 'application/json') !== 0) {
        send_json(['error' => 'json_only'], 415);
    }
    $data = json_decode(file_get_contents('php://input'), true);
    return is_array($data) ? $data : [];
}


// ---------- 2. Database ----------

// One PDO connection, created the first time it is needed.
function db()
{
    global $CONFIG;
    static $pdo = null;
    if ($pdo === null) {
        $dsn = $CONFIG['db_dsn'] ?? "mysql:host={$CONFIG['db_host']};dbname={$CONFIG['db_name']};charset=utf8mb4";
        $pdo = new PDO($dsn, $CONFIG['db_user'], $CONFIG['db_pass'], [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
    }
    return $pdo;
}

// Run a prepared query. Values go in $params, never inside the SQL text.
// Example: query('SELECT * FROM users WHERE email = ?', [$email])->fetch();
function query($sql, $params = [])
{
    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    return $stmt;
}


// ---------- 3. Sign-in and roles ----------

// The signed-in user (array) or null.
function current_user()
{
    return $_SESSION['user'] ?? null;
}

// Stop with 401 if nobody is signed in, or 403 if the role is not allowed.
// Every API file that returns data calls this first.
// Example: $user = require_role(['manager']);
function require_role($roles)
{
    $user = current_user();
    if ($user === null) {
        send_json(['error' => 'not_signed_in'], 401);
    }
    if (!in_array($user['role'], $roles)) {
        send_json(['error' => 'forbidden'], 403);
    }
    return $user;
}


// ---------- 4. EMPULSE score ----------

// $values = ['task_completion' => 94, ..., 'job_burnout' => 36 (the burnout risk %)]
// Returns ['total' => 83.75, 'rounded' => 84, 'rows' => [...]]
function empulse_score($values)
{
    global $CONFIG;
    $total = 0;
    $rows = [];
    foreach ($CONFIG['criteria'] as $key => $c) {
        $score = $c['inverse'] ? 100 - $values[$key] : $values[$key];
        $points = $score * $c['weight'] / 100;
        $total += $points;
        $rows[$key] = ['name' => $c['name'], 'score' => $score, 'weight' => $c['weight'], 'points' => $points];
    }
    return ['total' => round($total, 2), 'rounded' => (int) round($total), 'rows' => $rows];
}

// Tier name of a score: 90+ Gold, 80-89 Silver, 70-79 Bronze, below 70 Growth Needed.
function tier_for($score)
{
    global $CONFIG;
    foreach ($CONFIG['tiers'] as $tier) {
        if ($score >= $tier['min']) {
            return $tier['name'];
        }
    }
}
