<?php
// server/api/login.php — sign in.
// JavaScript sends: {"email": "...", "password": "...", "remember": true}
// Answers: 200 {"ok": true, "user": {...}}   400 {"error": "missing"}   401 {"error": "invalid"}
require __DIR__ . '/../functions.php';

$body = read_json();
$email = strtolower(trim($body['email'] ?? ''));
$password = $body['password'] ?? '';
$remember = !empty($body['remember']);

if ($email === '' || $password === '') {
    send_json(['error' => 'missing'], 400);
}

// Slow down someone who keeps guessing passwords.
$fails = $_SESSION['login_fails'] ?? 0;
if ($fails >= 5) {
    sleep(2);
}

// Find the user and check the password (the database keeps only a hash of it).
$user = query('SELECT id, email, password_hash, role, full_name FROM users WHERE email = ? AND is_active = 1', [$email])->fetch();

if (!$user || !password_verify($password, $user['password_hash'])) {
    $_SESSION['login_fails'] = $fails + 1;
    send_json(['error' => 'invalid'], 401);
}

// Correct: start a fresh session for this user.
session_regenerate_id(true);
$_SESSION['user'] = [
    'id'        => (int) $user['id'],
    'email'     => $user['email'],
    'role'      => $user['role'],
    'full_name' => $user['full_name'],
];
unset($_SESSION['login_fails']);

// "Keep me signed in": the cookie stays after the browser is closed.
if ($remember) {
    setcookie(session_name(), session_id(), [
        'expires' => time() + $CONFIG['remember_days'] * 86400,
        'path' => '/', 'httponly' => true, 'samesite' => 'Lax',
    ]);
}

query('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?', [$user['id']]);
send_json(['ok' => true, 'user' => $_SESSION['user']]);
