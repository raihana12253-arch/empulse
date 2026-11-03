# Generated data: design check

As of 2026-09-21 (latest week 2026-09-14, 52 weeks). All data is synthetic. Seed 20261011.

## Tables

- `departments`: 6 rows
- `teams`: 31 rows
- `employees`: 1,240 rows
- `employee_current`: 1,240 rows
- `weekly_metrics`: 64,480 rows
- `monthly_scores`: 14,880 rows
- `checkins`: 56,929 rows
- `interventions`: 212 rows
- `ideas`: 209 rows
- `idea_members`: 539 rows
- `recognitions`: 3,895 rows
- `innovation_dna`: 1,240 rows
- `skills`: 7,440 rows
- `economic_items`: 16 rows

## Design numbers changed (cannot be kept exactly)

| Screen | Design | Data | Why |
|---|---|---|---|
| H09 | Operations recognition rate 74% | 73% (233 of 318) | with 81/74/70/66/58/52 the organisation total is at least 800 people = 64.5%, shown as 65%, not 64% |
| M08 | Noura Al-Saud last recognized 44 days ago | 9 days (award on 12 Sep) | the same screen lists her Collaboration Hero award on 12 Sep |
| M02/M04/H04/H05 | Maha Al-Otaibi EMPULSE 93 (Gold) | 91 (Gold) | with Task Completion 90 and burnout risk 35 the highest possible score is 92.25 even with every other criterion at 100 |
| H08 | People participation 37% | 38% (24 of 64) | with 64 people 37% is not possible: 23 = 35.9%, 24 = 37.5% |
| H07 | Finance Ops innovation 24 | 25% (3 of 12) | with 12 people 24% is not possible |
| H07 | Platform Reliability innovation 58 | 56% (5 of 9) | M01 says 5 of 9 people are involved in ideas |
| H12 | Ribbons 2.8M + 0.6M + 0.7M + 0.2M + 0.5M | stored as shown (= SAR 4.8M) | the ribbons add up to 4.8M while the total and the six components are 4.2M - needs a decision |
| H12 | Productivity 3.1% x SAR 52M = SAR 1.62M | stored as 1.62M | 3.1% x 52M is 1.61M; 1.62M keeps the total at 4.20M |
| H01/H02b/H06 | 38 elevated: 9 Gold, 17 Silver, 9 Bronze, 3 Growth | 0 Gold, 20 Silver, 13 Bronze, 5 Growth | Job Burnout (15%) = 100 - risk: with risk 60+ a Gold score needs every other criterion near 99 (decision Q1) |
| M01/M04/M04b/H03/H05 | Khalid Mansour GOLD 91 | SILVER 82 (82.05) | supervisor formula, decision Q1 |
| M04b | Khalid highest recorded score 93 | 86 | his history is recomputed with the new formula |
| E01-E03/H03 | Layla Haddad SILVER 87 | SILVER 84 (83.75) | supervisor formula, decision Q1 |
| M02 | Platform Reliability tier mix 2 Gold / 5 Silver / 2 Bronze | 1 Gold / 6 Silver / 2 Bronze | Khalid is Silver now |
| M01/M02/H04 | Platform Reliability team EMPULSE 85 | 83.6 -> 84 | average of the 9 member scores shown in M04 (with Khalid 82, Maha 91) |
| M02/M03 | Platform Reliability averages: task 88, attendance 95, professional 94, teamwork 90, innovation 78, technology 91 | attendance_discipline 97, task_completion 84, innovation_creativity 85, teamwork 92, professional_behavior 96, technology_adoption 93 | task completion is the average of the 9 PERFORMANCE values in M04 (84.3); the others follow from each member's score |
| M02 | Team score trend Apr-Sep 86 86 87 86 86 85 | 84 84 84 84 83 84 | recomputed with the new formula |
| E02 | Layla score journey Mar-Sep 80 80 81 81 83 85 87 | 81 80 80 77 79 82 84 | Job Burnout drops her June score (risk 68) - the recovery after INT-0392 now shows in the score |
| H04 | IT Services 110 people | 104 members + team lead | the five Technology teams in H04 already add up to 212; team leads and the VP are counted in the department, and a team's people = its members without the lead (Platform Reliability 9 = Yasmin's 9 reports) |
| H04 | App Engineering burnout 44, Security 36 | 49 and 42 | with the H04 team values Technology can only average 47; 49 is shown on H01, H04, H06 and H12, so we kept 49 |
| H04/H07 | Data Platform burnout 38 (H04) / 41 (H07) | 41 | the two screens disagree; 41 keeps Technology at 49 |
| H03 | Customer Insights department | Operations | H03 shows Layla, Aya, Bilal, Hassan and Omar in Operations · Customer Insights |
| H02b | tier labels 90 / 85 / 75 / 64 (average score per tier) | 92.6 / 86.1 / 75.9 / 65.6 | with these averages the organisation score would be 81.8, not 83 (H01, H04); we kept 83 |
| E08/H09 | Team Supporter 28 (E08) / 29 (H09) | 29 | 29 makes the six categories add up to 171 |
| M08 | 41% of the team not recognized in 60 days | 22% (2 of 9) | the per-person list on the same screen has only Khalid (71) and Sami (64) above 60 days |
| H07 | team RECOGNITION column 78 / 71 / 73 / 62 / 44 / 55 | not stored | as 60-day rates most are impossible with 11/12/14/19/9 people; the meaning of this column must be decided in H07 |
| H09 | recognition rate 64% (60 days) and 171 recognitions in Q3 | awards + simple thanks (kudos) | 171 awards cannot reach 64% of 1,240 people in 60 days; the rate counts awards and kudos, the categories count awards only |
| H10 | Detected 9, proposed 6, active 27, measured 58 (= 100) of 212 | plus 100 completed, 7 declined, 5 cancelled | the design does not say what the other 112 are |
| H10/H12 | 71% improved (H12) vs 74% improved (H10) | both kept | 71% = 151 of all 212 have risk 5+ points lower than at detection; 74% = 43 of the 58 formally measured |
| E06 | In build 4 (filter) vs 6 (header and H08) | 6 | two numbers on the same screen; the funnel needs 6 |
| all | today's date | 21 Sep 2026 | M06 'Today 21 Sep', E01 'Thu 24 Sep', heat map ends at week 38 |

## Checks

| Screen | What | Design | Data | Result |
|---|---|---|---|---|
| H01/H03 | people | 1240 | 1240 | PASS |
| H01 | departments / teams | (6, 31) | (6, 31) | PASS |
| H01/H04 | Technology headcount | 212 | 212 | PASS |
| H04/H06 | Technology burnout now | 49 | 49 | PASS |
| H01/M03 | Technology engagement | 71 | 71 | PASS |
| H04/H07 | Platform Reliability people | 9 | 9 | PASS |
| H04/H07 | Data Platform people | 14 | 14 | PASS |
| H04/H07 | App Engineering people | 58 | 58 | PASS |
| H04/H07 | Security people | 21 | 21 | PASS |
| H04/H07 | IT Services people | 104 | 104 | PASS |
| H01/H04 | Operations headcount | 318 | 318 | PASS |
| H04/H06 | Operations burnout now | 31 | 31 | PASS |
| H01/M03 | Operations engagement | 79 | 79 | PASS |
| H04/H07 | Customer Insights people | 11 | 11 | PASS |
| H04/H07 | Field Operations people | 40 | 40 | PASS |
| H04/H07 | Analytics Platform people | 18 | 18 | PASS |
| H04/H07 | Supply Chain people | 62 | 62 | PASS |
| H04/H07 | Logistics Planning people | 60 | 60 | PASS |
| H04/H07 | Procurement people | 60 | 60 | PASS |
| H04/H07 | Facilities & Safety people | 59 | 59 | PASS |
| H01/H04 | Customer Success headcount | 264 | 264 | PASS |
| H04/H06 | Customer Success burnout now | 44 | 44 | PASS |
| H01/M03 | Customer Success engagement | 71 | 71 | PASS |
| H04/H07 | CS · Enterprise people | 19 | 19 | PASS |
| H04/H07 | SMB Success people | 48 | 48 | PASS |
| H04/H07 | Onboarding people | 48 | 48 | PASS |
| H04/H07 | Support Desk people | 48 | 48 | PASS |
| H04/H07 | Renewals people | 47 | 47 | PASS |
| H04/H07 | Customer Care people | 47 | 47 | PASS |
| H01/H04 | Finance headcount | 118 | 118 | PASS |
| H04/H06 | Finance burnout now | 28 | 28 | PASS |
| H01/M03 | Finance engagement | 77 | 77 | PASS |
| H04/H07 | Finance Ops people | 12 | 12 | PASS |
| H04/H07 | Accounting people | 51 | 51 | PASS |
| H04/H07 | Treasury & Risk people | 51 | 51 | PASS |
| H01/H04 | People headcount | 64 | 64 | PASS |
| H04/H06 | People burnout now | 24 | 24 | PASS |
| H01/M03 | People engagement | 84 | 84 | PASS |
| H04/H07 | HRBP people | 12 | 12 | PASS |
| H04/H07 | Talent Acquisition people | 16 | 16 | PASS |
| H04/H07 | Learning & Development people | 15 | 15 | PASS |
| H04/H07 | Employee Experience people | 16 | 16 | PASS |
| H01/H04 | Sales headcount | 264 | 264 | PASS |
| H04/H06 | Sales burnout now | 38 | 38 | PASS |
| H01/M03 | Sales engagement | 74 | 74 | PASS |
| H04/H07 | Enterprise Sales people | 43 | 43 | PASS |
| H04/H07 | SMB Sales people | 43 | 43 | PASS |
| H04/H07 | Partnerships people | 43 | 43 | PASS |
| H04/H07 | Sales Operations people | 43 | 43 | PASS |
| H04/H07 | Digital Channels people | 43 | 43 | PASS |
| H04/H07 | Brand & Content people | 42 | 42 | PASS |
| H04/H06 | Platform Reliability burnout | 51 | 51 | PASS |
| H04/H06 | IT Services burnout | 52 | 52 | PASS |
| H04/H06 | Data Platform burnout | 41 | 41 | PASS |
| H04/H06 | App Engineering burnout | 49 | 49 | PASS |
| H04/H06 | Security burnout | 42 | 42 | PASS |
| H04/H06 | CS · Enterprise burnout | 46 | 46 | PASS |
| H04/H06 | Customer Insights burnout | 33 | 33 | PASS |
| H04/H06 | Finance Ops burnout | 29 | 29 | PASS |
| H04/H06 | Field Operations burnout | 30 | 30 | PASS |
| H07/M01 | Customer Insights engagement | 82 | 82 | PASS |
| H07/M01 | Finance Ops engagement | 76 | 76 | PASS |
| H07/M01 | Field Operations engagement | 78 | 78 | PASS |
| H07/M01 | Data Platform engagement | 72 | 72 | PASS |
| H07/M01 | CS · Enterprise engagement | 63 | 63 | PASS |
| H07/M01 | Platform Reliability engagement | 64 | 64 | PASS |
| H04 | Data Platform EMPULSE | 86 | 86 | PASS |
| H04 | App Engineering EMPULSE | 84 | 84 | PASS |
| H04 | Security EMPULSE | 87 | 87 | PASS |
| H04 | IT Services EMPULSE | 81 | 81 | PASS |
| H01 | organisation EMPULSE | 83 | 83 | PASS |
| H01 | organisation engagement | 75 | 75 | PASS |
| H01/H06 | elevated burnout risk now | 38 | 38 | PASS |
| H06 | share of workforce | 3.1% | 3.1% | PASS |
| H06 | hotspots share of elevated | 42 | 42 | PASS |
| H01 | elevated per month Oct-Sep | [44, 42, 45, 43, 41, 47, 50, 55, 58, 61, 46, 38] | [44, 42, 45, 43, 41, 47, 50, 55, 58, 61, 46, 38] | PASS |
| H06 | heat map Technology W27-W38 | [38, 39, 41, 44, 47, 50, 53, 55, 54, 51, 50, 49] | [38, 39, 41, 44, 47, 50, 53, 55, 54, 51, 50, 49] | PASS |
| H06 | heat map Operations W27-W38 | [30, 31, 33, 36, 39, 41, 40, 37, 34, 32, 31, 31] | [30, 31, 33, 36, 39, 41, 40, 37, 34, 32, 31, 31] | PASS |
| H06 | heat map Customer Success W27-W38 | [40, 41, 41, 42, 44, 46, 47, 47, 46, 45, 44, 44] | [40, 41, 41, 42, 44, 46, 47, 47, 46, 45, 44, 44] | PASS |
| H06 | heat map Finance W27-W38 | [26, 27, 28, 30, 31, 31, 30, 29, 28, 28, 28, 28] | [26, 27, 28, 30, 31, 31, 30, 29, 28, 28, 28, 28] | PASS |
| H06 | heat map People W27-W38 | [22, 23, 23, 24, 25, 25, 25, 24, 24, 24, 24, 24] | [22, 23, 23, 24, 25, 25, 25, 24, 24, 24, 24, 24] | PASS |
| H06 | heat map Sales W27-W38 | [34, 35, 36, 38, 40, 42, 42, 41, 40, 39, 38, 38] | [34, 35, 36, 38, 40, 42, 42, 41, 40, 39, 38, 38] | PASS |
| H02b/H01 | tiers now | {'Gold': 223, 'Silver': 583, 'Bronze': 360, 'Growth Needed': 74} | {'Gold': 223, 'Silver': 583, 'Bronze': 360, 'Growth Needed': 74} | PASS |
| H02b | Technology tiers | {'Gold': 47, 'Silver': 104, 'Bronze': 52, 'Growth Needed': 9} | {'Gold': 47, 'Silver': 104, 'Bronze': 52, 'Growth Needed': 9} | PASS |
| H02b | Operations tiers | {'Gold': 54, 'Silver': 150, 'Bronze': 95, 'Growth Needed': 19} | {'Gold': 54, 'Silver': 150, 'Bronze': 95, 'Growth Needed': 19} | PASS |
| H02b | Customer Success tiers | {'Gold': 29, 'Silver': 108, 'Bronze': 98, 'Growth Needed': 29} | {'Gold': 29, 'Silver': 108, 'Bronze': 98, 'Growth Needed': 29} | PASS |
| H02b | Finance tiers | {'Gold': 24, 'Silver': 58, 'Bronze': 29, 'Growth Needed': 7} | {'Gold': 24, 'Silver': 58, 'Bronze': 29, 'Growth Needed': 7} | PASS |
| H02b | People tiers | {'Gold': 12, 'Silver': 32, 'Bronze': 17, 'Growth Needed': 3} | {'Gold': 12, 'Silver': 32, 'Bronze': 17, 'Growth Needed': 3} | PASS |
| H02b | Sales tiers | {'Gold': 57, 'Silver': 131, 'Bronze': 69, 'Growth Needed': 7} | {'Gold': 57, 'Silver': 131, 'Bronze': 69, 'Growth Needed': 7} | PASS |
| H02b | tiers Q2 | {'Gold': 186, 'Silver': 546, 'Bronze': 397, 'Growth Needed': 111} | {'Gold': 186, 'Silver': 546, 'Bronze': 397, 'Growth Needed': 111} | PASS |
| H02b | moved up / down / Bronze->Silver | (185, 37, 92) | (185, 37, 92) | PASS |
| H03 | development plans active | 214 | 214 | PASS |
| H03 | Growth tier all with a plan | 74 | 74 | PASS |
| named | Khalid Mansour burnout risk | 72 | 72 | PASS |
| named | Khalid Mansour engagement | 71 | 71 | PASS |
| named | Khalid Mansour criteria | {'task_completion': 95, 'attendance_discipline': 98, 'professional_behavior': 90, 'innovation_creativity': 86, 'teamwork': 88, 'technology_adoption': 92} | {'task_completion': 95, 'attendance_discipline': 98, 'professional_behavior': 90, 'innovation_creativity': 86, 'teamwork': 88, 'technology_adoption': 92} | PASS |
| named | Tariq Zaki burnout risk | 66 | 66 | PASS |
| named | Tariq Zaki EMPULSE | 78 | 78 | PASS |
| named | Tariq Zaki engagement | 55 | 55 | PASS |
| named | Tariq Zaki task completion | 79 | 79 | PASS |
| named | Huda Nasser burnout risk | 63 | 63 | PASS |
| named | Huda Nasser EMPULSE | 82 | 82 | PASS |
| named | Huda Nasser engagement | 58 | 58 | PASS |
| named | Huda Nasser task completion | 81 | 81 | PASS |
| named | Sami Youssef burnout risk | 52 | 52 | PASS |
| named | Sami Youssef EMPULSE | 74 | 74 | PASS |
| named | Sami Youssef engagement | 60 | 60 | PASS |
| named | Sami Youssef task completion | 76 | 76 | PASS |
| named | Rami Khoury burnout risk | 47 | 47 | PASS |
| named | Rami Khoury EMPULSE | 84 | 84 | PASS |
| named | Rami Khoury engagement | 63 | 63 | PASS |
| named | Rami Khoury task completion | 83 | 83 | PASS |
| named | Dana Farouk burnout risk | 44 | 44 | PASS |
| named | Dana Farouk EMPULSE | 86 | 86 | PASS |
| named | Dana Farouk engagement | 64 | 64 | PASS |
| named | Dana Farouk task completion | 85 | 85 | PASS |
| named | Noura Al-Saud burnout risk | 41 | 41 | PASS |
| named | Noura Al-Saud EMPULSE | 87 | 87 | PASS |
| named | Noura Al-Saud engagement | 68 | 68 | PASS |
| named | Noura Al-Saud task completion | 84 | 84 | PASS |
| named | Faisal Rahman burnout risk | 38 | 38 | PASS |
| named | Faisal Rahman EMPULSE | 88 | 88 | PASS |
| named | Faisal Rahman engagement | 66 | 66 | PASS |
| named | Faisal Rahman task completion | 86 | 86 | PASS |
| named | Maha Al-Otaibi burnout risk | 35 | 35 | PASS |
| named | Maha Al-Otaibi EMPULSE | 93 | 91 | CHANGED |
| named | Maha Al-Otaibi engagement | 71 | 71 | PASS |
| named | Maha Al-Otaibi task completion | 90 | 90 | PASS |
| named | Yasmin Hadi burnout risk | 30 | 30 | PASS |
| named | Omar Saeed burnout risk | 28 | 28 | PASS |
| named | Omar Saeed EMPULSE | 89 | 89 | PASS |
| named | Adel Nasser EMPULSE | 90 | 90 | PASS |
| named | Rana Aziz burnout risk | 20 | 20 | PASS |
| named | Lina Farhat burnout risk | 25 | 25 | PASS |
| named | Lina Farhat EMPULSE | 88 | 88 | PASS |
| named | Layla Haddad burnout risk | 36 | 36 | PASS |
| named | Layla Haddad engagement | 83 | 83 | PASS |
| named | Layla Haddad criteria | {'task_completion': 94, 'attendance_discipline': 91, 'professional_behavior': 89, 'innovation_creativity': 78, 'teamwork': 81, 'technology_adoption': 88} | {'task_completion': 94, 'attendance_discipline': 91, 'professional_behavior': 89, 'innovation_creativity': 78, 'teamwork': 81, 'technology_adoption': 88} | PASS |
| named | Aya Mourad burnout risk | 30 | 30 | PASS |
| named | Aya Mourad EMPULSE | 85 | 85 | PASS |
| named | Bilal Omar burnout risk | 62 | 62 | PASS |
| named | Bilal Omar EMPULSE | 72 | 72 | PASS |
| named | Hassan Ali burnout risk | 64 | 64 | PASS |
| named | Hassan Ali EMPULSE | 66 | 66 | PASS |
| named | Dina Kassem EMPULSE | 86 | 86 | PASS |
| E01-E03 | Layla EMPULSE (new formula) | 84 | 84 | PASS |
| M04b | Khalid EMPULSE (new formula) | 82 | 82 | PASS |
| M01 | Yasmin direct reports | 9 | 9 | PASS |
| M01 | Yasmin team high-risk (badge 3) | 3 | 3 | PASS |
| M01/H04 | Platform Reliability burnout | 51 | 51 | PASS |
| M01 | Platform Reliability engagement | 64 | 64 | PASS |
| M06 | Khalid 6 weeks ago | 46 | 46 | PASS |
| story | Layla Haddad risk path | [41, 50, 68, 68, 45, 36] | [41, 50, 68, 68, 45, 36] | PASS |
| story | Khalid Mansour risk path | [31, 38, 46, 72] | [31, 38, 46, 72] | PASS |
| story | Noura Al-Saud risk path | [66, 72, 49, 41] | [66, 72, 49, 41] | PASS |
| H05 | PR risk 30 Mar -> now | (34, 51) | (34, 51) | PASS |
| H05 | PR engagement 30 Mar -> now | (79, 64) | (79, 64) | PASS |
| H01 | org engagement end of Q2 | 71 | 71 | PASS |
| H09/H01 | recognition rate (60 days) | 64 | 64 | PASS |
| H09 | recognition rate People | 81 | 81 | PASS |
| H09 | recognition rate Operations | 74 | 73 | CHANGED |
| H09 | recognition rate Finance | 70 | 70 | PASS |
| H09 | recognition rate Sales | 66 | 66 | PASS |
| H09 | recognition rate Technology | 58 | 58 | PASS |
| H09 | recognition rate Customer Success | 52 | 52 | PASS |
| H09 | recognition rate Q2 | 57 | 57 | PASS |
| H09 | never recognized (12 months) | 96 | 96 | PASS |
| H09/E08 | awards Q3 by category | {'Performance Star': 38, 'Innovation Champion': 24, 'Collaboration Hero': 41, 'Digital Pioneer': 17, 'Team Supporter': 29, 'Growth Champion': 22} | {'Performance Star': 38, 'Innovation Champion': 24, 'Collaboration Hero': 41, 'Digital Pioneer': 17, 'Team Supporter': 29, 'Growth Champion': 22} | PASS |
| H09 | award givers Q3 | 142 | 142 | PASS |
| H09 | awards linked to outcomes | 58 | 58 | PASS |
| H09 | equity ratios | {'gender_f_m': 1.02, 'remote_onsite': 0.86, 'under30_30to45': 0.95, 'lower_upper_tier': 0.71} | {'gender_f_m': np.float64(1.02), 'remote_onsite': np.float64(0.86), 'under30_30to45': np.float64(0.95), 'lower_upper_tier': np.float64(0.71)} | PASS |
| M08/E08 | Khalid Mansour days since recognized | 71 | 71 | PASS |
| M08/E08 | Sami Youssef days since recognized | 64 | 64 | PASS |
| M08/E08 | Noura Al-Saud days since recognized | 9 | 9 | PASS |
| M08/E08 | Tariq Zaki days since recognized | 38 | 38 | PASS |
| M08/E08 | Dana Farouk days since recognized | 30 | 30 | PASS |
| M08/E08 | Huda Nasser days since recognized | 22 | 22 | PASS |
| M08/E08 | Rami Khoury days since recognized | 15 | 15 | PASS |
| M08/E08 | Faisal Rahman days since recognized | 12 | 12 | PASS |
| M08/E08 | Maha Al-Otaibi days since recognized | 5 | 5 | PASS |
| M08/E08 | Hassan Ali days since recognized | 62 | 62 | PASS |
| E01 | Layla recognitions this quarter | 3 | 3 | PASS |
| M08 | Platform Reliability recognitions this month | 5 | 5 | PASS |
| H01/H12 | interventions 2026 | 212 | 212 | PASS |
| H12 | types | {'Workload rebalance': 96, 'Recognition program': 48, 'Training & mentoring': 41, 'Task / team move': 27} | {'Workload rebalance': 96, 'Recognition program': 48, 'Training & mentoring': 41, 'Task / team move': 27} | PASS |
| H10 | detected / proposed / active / measured | {'detected': 9, 'proposed': 6, 'active': 27, 'measured': 58} | {'detected': 9, 'proposed': 6, 'active': 27, 'measured': 58} | PASS |
| H10/H01 | active on track | 81 | 81 | PASS |
| H10/H01 | follow-up due this week | 4 | 4 | PASS |
| H10/H01 | measured improved | 74 | 74 | PASS |
| H12/H01 | people improved | 71 | 71 | PASS |
| H10 | workload playbook (15+ points) | (19, 23) | (19, 23) | PASS |
| H10 | recognition-only playbook | (9, 17) | (9, 17) | PASS |
| H10 | INT-0392 Layla 68 -> 45 | (68, 45) | (68, 45) | PASS |
| H10 | INT-0418 Khalid proposed | proposed | proposed | PASS |
| H10 | INT-0371 Noura 72 -> 49 | (72, 49) | (72, 49) | PASS |
| rule | every started intervention is human-approved by a person | True | True | PASS |
| H08 | ideas this year | 118 | 118 | PASS |
| H08 | ideas last year | 88 | 88 | PASS |
| H08/E06 | Q3 funnel | {'submitted': 42, 'reviewed': 42, 'approved': 11, 'in_build': 6, 'implemented': 4, 'verified': 4} | {'submitted': 42, 'reviewed': 42, 'approved': 11, 'in_build': 6, 'implemented': 4, 'verified': 4} | PASS |
| H08/E06 | verified savings this year | 520000 | 520000 | PASS |
| H08 | time to impact (median weeks) | 19 | 19 | PASS |
| E06 | contributors in build | 38 | 38 | PASS |
| H01/H08 | participation org | 39 | 39 | PASS |
| H08 | participation Technology | 64 | 64 | PASS |
| H08 | participation Operations | 42 | 42 | PASS |
| H08 | participation People | 37 | 38 | CHANGED |
| H08 | participation Sales | 33 | 33 | PASS |
| H08 | participation Customer Success | 28 | 28 | PASS |
| H08 | participation Finance | 21 | 21 | PASS |
| H07/M01 | Customer Insights people in ideas | 6 | 6 | PASS |
| H07/M01 | Finance Ops people in ideas | 3 | 3 | PASS |
| H07/M01 | Field Operations people in ideas | 15 | 15 | PASS |
| H07/M01 | Data Platform people in ideas | 10 | 10 | PASS |
| H07/M01 | CS · Enterprise people in ideas | 5 | 5 | PASS |
| H07/M01 | Platform Reliability people in ideas | 5 | 5 | PASS |
| E04 | Layla ideas | ['IDEA-084', 'IDEA-102', 'IDEA-121'] | ['IDEA-084', 'IDEA-102', 'IDEA-121'] | PASS |
| H08 | DNA organisation medians | [61, 64, 55, 68, 59, 60, 52] | [61, 64, 55, 68, 59, 60, 52] | PASS |
| E04 | Layla DNA | [88, 91, 74, 79, 86, 58, 66] | [88, 91, 74, 79, 86, 58, 66] | PASS |
| H12 | expected impact | 4200000 | 4200000 | PASS |
| rule | score = criteria x weights (all 1,240) | True | True | PASS |
| rule | monthly scores use the same formula | True | True | PASS |
| rule | every line manager has >= 5 direct reports | True | True | PASS |
| rule | weekly risks come from the model (re-scored) | True | True | PASS |
| H02b | Gold + Silver share Q4 2025 -> Q3 2026 | (59, 65) | (59, 65) | PASS |
| H06 | intervention success: average risk drop (pts) | 15 | 15 | PASS |

## Score histories with the new formula (for the screens that show history)

Layla (E02 'score journey'): 2025-10 80 (risk 42), 2025-11 81 (risk 41), 2025-12 81 (risk 40), 2026-01 81 (risk 40), 2026-02 81 (risk 41), 2026-03 81 (risk 41), 2026-04 80 (risk 45), 2026-05 80 (risk 49), 2026-06 77 (risk 68), 2026-07 79 (risk 56), 2026-08 82 (risk 40), 2026-09 84 (risk 36)

Khalid: 2025-10 85 (risk 32), 2025-11 85 (risk 31), 2025-12 85 (risk 32), 2026-01 85 (risk 34), 2026-02 85 (risk 32), 2026-03 86 (risk 31), 2026-04 85 (risk 33), 2026-05 85 (risk 36), 2026-06 85 (risk 39), 2026-07 84 (risk 45), 2026-08 83 (risk 63), 2026-09 82 (risk 72)

Platform Reliability average (M02 trend): 2025-10 84.6, 2025-11 83.8, 2025-12 83.3, 2026-01 83.9, 2026-02 84.6, 2026-03 84.1, 2026-04 84.0, 2026-05 83.8, 2026-06 83.7, 2026-07 83.8, 2026-08 83.4, 2026-09 83.6

Gold + Silver share by quarter end (H02b layers): {'2025-12-01': np.float64(59.0), '2026-03-01': np.float64(58.0), '2026-06-01': np.float64(59.0), '2026-09-01': np.float64(65.0)}