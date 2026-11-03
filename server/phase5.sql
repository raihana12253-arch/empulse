-- =====================================================================
-- phase5.sql — extra tables and demo data for M05 Performance-Wellbeing, M06 Burnout Early Warning, M07 Team Morale, M08 Recognition (manager).
-- Import AFTER database.sql, data.sql, phase1.sql ... phase4.sql. It needs the database "empulse" selected. It can be run again.
-- demo_facts / manager_notes below are DISPLAY VALUES and texts taken from the design. Scores, risks, tiers and table values are always calculated.
-- The hours and check-in comments of Yasmin's team are DEMO data made for these screens (hours come from the weekly overtime).
-- =====================================================================
USE empulse;

DROP TABLE IF EXISTS recognition_drafts;
DROP TABLE IF EXISTS checkin_themes;

-- One saved draft per manager (M08 "Save draft").
CREATE TABLE recognition_drafts (
  manager_id    INT UNSIGNED  NOT NULL,
  receiver_id   INT UNSIGNED  NOT NULL,
  category      VARCHAR(40)   NOT NULL,
  message       VARCHAR(300)  NOT NULL,
  link_outcome  TINYINT(1)    NOT NULL DEFAULT 0,
  saved_at      DATETIME      NOT NULL,
  PRIMARY KEY (manager_id),
  CONSTRAINT fk_draft_manager FOREIGN KEY (manager_id) REFERENCES employees (id),
  CONSTRAINT fk_draft_receiver FOREIGN KEY (receiver_id) REFERENCES employees (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- The tone of a check-in comment theme (M07): concern, watch or positive. Comments with the same text are one theme.
CREATE TABLE checkin_themes (
  note  VARCHAR(160) NOT NULL,
  tone  VARCHAR(10)  NOT NULL,
  PRIMARY KEY (note)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO checkin_themes (note, tone) VALUES
  ('On-call nights are wearing people down', 'concern'),
  ('Priorities change mid-sprint', 'watch'),
  ('Pairing sessions are the best part of the week', 'positive'),
  ('Wins aren''t noticed outside the team', 'watch');

-- ---------- M07: anonymous check-in comments of the team (the API returns only the theme and how many mentions) ----------
UPDATE checkins SET note = NULL WHERE employee_id IN (367,623,38,586,1215,431,730,1101,381) AND week_start >= '2026-06-29';
UPDATE checkins SET note = 'On-call nights are wearing people down' WHERE employee_id = 367 AND week_start = '2026-06-29';
UPDATE checkins SET note = 'On-call nights are wearing people down' WHERE employee_id = 623 AND week_start = '2026-08-24';
UPDATE checkins SET note = 'On-call nights are wearing people down' WHERE employee_id = 38 AND week_start = '2026-07-27';
UPDATE checkins SET note = 'On-call nights are wearing people down' WHERE employee_id = 586 AND week_start = '2026-06-29';
UPDATE checkins SET note = 'On-call nights are wearing people down' WHERE employee_id = 1215 AND week_start = '2026-08-24';
UPDATE checkins SET note = 'On-call nights are wearing people down' WHERE employee_id = 730 AND week_start = '2026-08-17';
UPDATE checkins SET note = 'Priorities change mid-sprint' WHERE employee_id = 367 AND week_start = '2026-08-10';
UPDATE checkins SET note = 'Priorities change mid-sprint' WHERE employee_id = 431 AND week_start = '2026-07-13';
UPDATE checkins SET note = 'Priorities change mid-sprint' WHERE employee_id = 1101 AND week_start = '2026-07-06';
UPDATE checkins SET note = 'Priorities change mid-sprint' WHERE employee_id = 38 AND week_start = '2026-07-20';
UPDATE checkins SET note = 'Pairing sessions are the best part of the week' WHERE employee_id = 381 AND week_start = '2026-07-13';
UPDATE checkins SET note = 'Pairing sessions are the best part of the week' WHERE employee_id = 431 AND week_start = '2026-09-07';
UPDATE checkins SET note = 'Pairing sessions are the best part of the week' WHERE employee_id = 730 AND week_start = '2026-08-10';
UPDATE checkins SET note = 'Pairing sessions are the best part of the week' WHERE employee_id = 1101 AND week_start = '2026-07-13';
UPDATE checkins SET note = 'Pairing sessions are the best part of the week' WHERE employee_id = 586 AND week_start = '2026-08-17';
UPDATE checkins SET note = 'Wins aren''t noticed outside the team' WHERE employee_id = 623 AND week_start = '2026-08-10';
UPDATE checkins SET note = 'Wins aren''t noticed outside the team' WHERE employee_id = 1215 AND week_start = '2026-08-31';
UPDATE checkins SET note = 'Wins aren''t noticed outside the team' WHERE employee_id = 381 AND week_start = '2026-07-06';
UPDATE checkins SET note = 'Wins aren''t noticed outside the team' WHERE employee_id = 431 AND week_start = '2026-08-31';
UPDATE checkins SET note = 'Wins aren''t noticed outside the team' WHERE employee_id = 367 AND week_start = '2026-09-14';

-- ---------- M06: hours and after-hours work of the team, 12 weeks (derived from the weekly overtime) ----------
DELETE FROM weekly_activity WHERE employee_id IN (367,623,38,586,1215,431,730,1101,381);
INSERT INTO weekly_activity (employee_id, week_start, planned_hours, work_hours, focus_hours, meeting_hours, after_hours)
SELECT employee_id, week_start, 40, ROUND(8 + 1.7 * overtime_hours_monthly, 1), ROUND((8 + 1.7 * overtime_hours_monthly) * 0.4, 1),
       ROUND((8 + 1.7 * overtime_hours_monthly) * 0.25, 1),
       CASE WHEN overtime_hours_monthly > 19 THEN ROUND((overtime_hours_monthly - 19) * 1.05, 1) ELSE 0 END
FROM weekly_metrics WHERE employee_id IN (367,623,38,586,1215,431,730,1101,381) AND week_start >= '2026-06-22';

-- ---------- display values ----------
DELETE FROM demo_facts WHERE employee_id = 21 AND fact_key IN ('m07_recog_change', 'm07_workload_level', 'm07_inn_change');
INSERT INTO demo_facts (employee_id, fact_key, fact_value) VALUES (21, 'm07_recog_change', '9'), (21, 'm07_workload_level', '118'), (21, 'm07_inn_change', '8');

DELETE FROM demo_facts WHERE employee_id = 367 AND fact_key IN ('ew_open_from', 'ew_open_to', 'rc_workload', 'rc_overtime', 'rc_engagement', 'rc_recognition', 'rec_outcome', 'rec_outcome_long', 'ind_workload_pct', 'ind_overtime_hours', 'ew_similar', 'ew_weekends');
INSERT INTO demo_facts (employee_id, fact_key, fact_value) VALUES
  (367, 'ew_open_from', '9'), (367, 'ew_open_to', '16'),
  (367, 'rc_workload', '11'), (367, 'rc_overtime', '7'), (367, 'rc_engagement', '5'), (367, 'rc_recognition', '3'),
  (367, 'ind_workload_pct', '18'), (367, 'ind_overtime_hours', '12'), (367, 'ew_similar', '7'), (367, 'ew_weekends', '3'),
  (367, 'rec_outcome', 'Checkout uptime 99.98%'), (367, 'rec_outcome_long', 'Checkout uptime 99.98% during the sale');

DELETE FROM manager_notes WHERE kind IN ('ew_action', 'ew_followup', 'rec_suggest') AND employee_id = 367;
INSERT INTO manager_notes (employee_id, kind, ord, title, detail, footer, num) VALUES
  (367, 'ew_action', 1, 'Reallocate 2 tasks', 'Deploy pipeline migration → Noura (capacity 74%)|Alert tuning → Faisal (71%)', NULL, 11),
  (367, 'ew_action', 2, 'Schedule manager check-in', 'Yasmin Hadi · 30 min · this week · supportive script ready', NULL, 5),
  (367, 'ew_action', 3, 'Review workload after 2 weeks', 'Auto-reminder 5 Oct · compare against baseline', NULL, 7),
  (367, 'ew_followup', 1, 'Today', 'Plan approval by manager', '2026-09-21', NULL),
  (367, 'ew_followup', 2, 'Check-in', 'Yasmin Hadi ↔ Khalid, 30 min', '2026-09-23', NULL),
  (367, 'ew_followup', 3, 'Tasks moved', 'Noura & Faisal confirm', '2026-09-24', NULL),
  (367, 'ew_followup', 4, 'Review', 'Workload vs baseline', '2026-10-05', NULL),
  (367, 'ew_followup', 5, 'Outcome', 'Risk, engagement, performance measured', '2026-10-19', NULL),
  (367, 'rec_suggest', 1, 'Performance Star', 'Three weekends of incident cover in August kept checkout online through the sale. The whole team — and our customers — noticed. Thank you.', NULL, NULL);

-- Team notes of Yasmin (id 21): events on the morale chart and what would lift morale fastest.
DELETE FROM manager_notes WHERE employee_id = 21 AND kind IN ('team_event', 'morale_lift');
INSERT INTO manager_notes (employee_id, kind, ord, title, detail, footer, num) VALUES
  (21, 'team_event', 1, '2nd SRE leaves', '2026-07-20', NULL, NULL),
  (21, 'team_event', 2, 'Incident surge', '2026-08-10', NULL, NULL),
  (21, 'team_event', 3, '3 weekends on call', '2026-08-31', NULL, NULL),
  (21, 'morale_lift', 1, 'Share the on-call load with Data Platform for 4 weeks — addresses the #1 theme.', NULL, NULL, NULL),
  (21, 'morale_lift', 2, 'Freeze mid-sprint priority changes until the SRE roles are filled.', NULL, NULL, NULL),
  (21, 'morale_lift', 3, 'Celebrate the pipeline migration publicly — recognition is at a 6-month low.', NULL, NULL, NULL);

-- P5-02: DEMO adjustment of the Q2 (June) scores of three people so M05 shows "6 moved: 4 up, 2 down" as in the design.
UPDATE monthly_scores SET task_completion = 77, job_burnout = 55 WHERE month = '2026-06-01' AND employee_id IN (1215, 431);
UPDATE monthly_scores SET task_completion = 82, job_burnout = 55 WHERE month = '2026-06-01' AND employee_id = 623;

-- P5-08: Khalid's evidence lines are DISPLAY values from the design (hours 42 -> 55, after-hours 1 -> 9).
INSERT INTO demo_facts (employee_id, fact_key, fact_value) VALUES
 (367, 'ew_hours_from', '42'), (367, 'ew_hours_to', '55'), (367, 'ew_after_from', '1'), (367, 'ew_after_to', '9');
