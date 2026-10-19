<?php
// server/api/me.php — who is signed in?
// Answers: 200 {"id": 1, "email": "...", "role": "employee", "full_name": "Layla Haddad"}
//          401 {"error": "not_signed_in"}
require __DIR__ . '/../functions.php';

$user = require_role(['employee', 'manager', 'hr', 'executive', 'admin']);
send_json($user);
