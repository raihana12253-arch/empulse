<?php
// server/api/employee/innovation.php — E04 My Innovation DNA.
// The company median is a total of all people (never one person's row).
require __DIR__ . '/../../employee_data.php';

$user = require_role(['employee']);
$eid = my_employee_id($user);
$dates = app_dates();
$p = load_person($eid);

$dna = query('SELECT * FROM innovation_dna WHERE employee_id = ?', [$eid])->fetch();
if (!$dna) {
    send_json(['error' => 'no_data'], 404);
}

// Seven traits: your value, the company median, and "top N%".
$traits = [];
foreach (DNA_TRAITS as $trait) {
    $all = org_values('innovation_dna', $trait);
    $traits[] = ['key' => $trait, 'value' => (int) $dna[$trait], 'median' => median_of($all),
                 'top' => top_percent($all, (int) $dna[$trait])];
}

// Signature: the two strongest traits name the profile; the weakest one is the "next leap".
$sorted = $traits;
usort($sorted, function ($a, $b) { return $b['value'] <=> $a['value']; });
$weakest = $traits[0];
foreach ($traits as $t) {
    if ($t['value'] < $weakest['value']) { $weakest = $t; }
}
$signature = ['top' => $sorted[0]['key'], 'second' => $sorted[1]['key'], 'weakest' => $weakest['key']];

// Growth since Q1: a fact of the person (a trait and its points), else Innovation & Creativity since June.
$facts = facts_of($eid);
$compare_month = month_before($dates['as_of'], 3);
$june = month_row($eid, $compare_month);
$growth = null;
if (isset($facts['dna_growth_trait'], $facts['dna_growth_points'])) {
    $growth = ['key' => $facts['dna_growth_trait'], 'delta' => (int) $facts['dna_growth_points'], 'dna' => true];
} elseif ($june) {
    $growth = ['key' => 'innovation_creativity', 'delta' => (int) $p['innovation_creativity'] - (int) $june['innovation_creativity'], 'dna' => false,
               'compare' => $compare_month];
}

// Ideas of this person and what they achieved.
$ideas = ideas_of($eid);
$submitted = 0; $drafts = 0; $teams = null;
foreach ($ideas as $i) {
    if ($i['status'] === 'draft') { $drafts++; }
    $submitted++;                                           // the design counts every idea of the person (drafts too)
}
$list = [];
foreach ($ideas as $i) {
    $numbers = idea_note_numbers($i['note']);
    if ($numbers['teams'] !== null) { $teams = max((int) $teams, $numbers['teams']); }
    $list[] = ['code' => $i['code'], 'title' => $i['title'], 'status' => $i['status'], 'stage' => $i['stage'],
               'open_role' => $i['open_roles'], 'saving_sar' => $i['realized_savings_sar']];
}

// Most advanced idea first (Implemented, Approved, Draft).
usort($list, function ($a, $b) { return $b['stage'] <=> $a['stage']; });

send_json([
    'as_of'     => $dates['as_of'],
    'who'       => who_block($p),
    'traits'    => $traits,
    'signature' => $signature,
    'growth'    => $growth,
    'strength'  => ['cited_by_teams' => isset($facts['ideas_cited_teams']) ? (int) $facts['ideas_cited_teams'] : null,
                    'submitted' => $submitted, 'drafts' => $drafts],
    'ideas'     => $list,
]);
