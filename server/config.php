<?php
// =====================================================================
// server/config.php — ALL settings in one place.
//   1. Database connection (XAMPP default: user root, no password)
//   2. The 7 scoring criteria and their weights (supervisor rule)
//   3. Tiers (Gold / Silver / Bronze / Growth Needed)
// Change a value here and the whole app uses the new value.
// =====================================================================

return [

    // ---------- 1. Database ----------
    'db_host' => '127.0.0.1',
    'db_name' => 'empulse',
    'db_user' => 'root',
    'db_pass' => '',

    // "Keep me signed in on this device" = stay signed in for this many days.
    'remember_days' => 30,

    // ---------- 2. The 7 criteria (exact names, weights add up to 100) ----------
    // Job Burnout is "inverse": its score = 100 - burnout risk %.
    // So the lower the burnout risk, the higher the Job Burnout score.
    'criteria' => [
        'attendance_discipline' => ['name' => 'Attendance & Discipline', 'weight' => 10, 'inverse' => false],
        'task_completion'       => ['name' => 'Task Completion',         'weight' => 25, 'inverse' => false],
        'innovation_creativity' => ['name' => 'Innovation & Creativity', 'weight' => 15, 'inverse' => false],
        'teamwork'              => ['name' => 'Teamwork',                'weight' => 15, 'inverse' => false],
        'professional_behavior' => ['name' => 'Professional Behavior',   'weight' => 10, 'inverse' => false],
        'technology_adoption'   => ['name' => 'Technology Adoption',     'weight' => 10, 'inverse' => false],
        'job_burnout'           => ['name' => 'Job Burnout',             'weight' => 15, 'inverse' => true],
    ],

    // ---------- 3. Tiers (the first one whose minimum is reached) ----------
    'tiers' => [
        ['name' => 'Gold',          'min' => 90],
        ['name' => 'Silver',        'min' => 80],
        ['name' => 'Bronze',        'min' => 70],
        ['name' => 'Growth Needed', 'min' => 0],
    ],

    // Burnout risk shown as "High" from this value (decision support, not a diagnosis).
    'high_risk' => 60,

    // Privacy: groups smaller than this are never shown in totals or averages.
    'min_group_size' => 5,
];
