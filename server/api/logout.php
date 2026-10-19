<?php
// server/api/logout.php — sign out. JavaScript sends {} with POST. Answer: {"ok": true}
require __DIR__ . '/../functions.php';

read_json();                 // POST + JSON only
$_SESSION = [];
setcookie(session_name(), '', ['expires' => time() - 3600, 'path' => '/']);
session_destroy();
send_json(['ok' => true]);
