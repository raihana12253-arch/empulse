-- =====================================================================
-- phase4.sql — extra table and demo data for M02 Team Performance, M03 Team Pulse, M04 Team Members, M04b Member profile.
-- Import AFTER database.sql, data.sql, phase1.sql, phase2.sql and phase3.sql. It needs the database "empulse" selected.
-- It can be run again.
-- demo_facts below are DISPLAY VALUES taken from the design (narrative numbers). Scores, tiers and table values are always calculated.
-- =====================================================================
USE empulse;

DROP TABLE IF EXISTS manager_notes;

-- Notes shown on the member profile (M04b): events, development notes, recommended manager actions.
-- A person without notes gets texts made by rules from the numbers.
CREATE TABLE manager_notes (
  employee_id  INT UNSIGNED  NOT NULL,
  kind         VARCHAR(20)   NOT NULL,                 -- event, development, action
  ord          TINYINT UNSIGNED NOT NULL,
  title        VARCHAR(160)  NOT NULL,
  detail       VARCHAR(400)  NULL,                      -- lines separated by |
  footer       VARCHAR(160)  NULL,
  num          SMALLINT      NULL,                      -- action: projected risk drop (points)
  PRIMARY KEY (employee_id, kind, ord),
  CONSTRAINT fk_notes_employee FOREIGN KEY (employee_id) REFERENCES employees (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- M01 / M03 narrative numbers of Yasmin's team ----------
DELETE FROM demo_facts WHERE employee_id = 21 AND fact_key IN ('m01_workload_pct','m01_overtime_hours','m01_overtime_people','m01_ideas_approved',
  'm03_fall_pts','m03_workload_share','m03_workload_effect','m03_overtime_effect','m03_overtime_note','m03_recog_gap_pct','m03_recog_effect');
INSERT INTO demo_facts (employee_id, fact_key, fact_value) VALUES
  (21, 'm01_workload_pct', '18'), (21, 'm01_overtime_hours', '12'), (21, 'm01_overtime_people', '3'), (21, 'm01_ideas_approved', '2'),
  (21, 'm03_fall_pts', '15'), (21, 'm03_workload_share', '60'), (21, 'm03_workload_effect', '9'),
  (21, 'm03_overtime_effect', '4'), (21, 'm03_overtime_note', 'Mostly incident nights'),
  (21, 'm03_recog_gap_pct', '41'), (21, 'm03_recog_effect', '2');

-- ---------- M04: the one thing that would help each person most (text of the design) ----------
DELETE FROM demo_facts WHERE fact_key = 'm04_recommended' AND employee_id IN (367, 623, 38, 586, 1215, 431, 730, 1101, 381);
INSERT INTO demo_facts (employee_id, fact_key, fact_value) VALUES
  (367,  'm04_recommended', 'Review workload · reallocate 2 tasks'),
  (623,  'm04_recommended', 'Rotate off primary on-call'),
  (38,   'm04_recommended', 'Schedule a supportive check-in'),
  (586,  'm04_recommended', 'Pair with a mentor · Kubernetes path'),
  (1215, 'm04_recommended', 'Review on-call load before it grows'),
  (431,  'm04_recommended', 'Offer stretch: alert-noise project'),
  (730,  'm04_recommended', 'Recognize the pipeline migration'),
  (1101, 'm04_recommended', 'Keep capacity for Khalid''s tasks'),
  (381,  'm04_recommended', 'Nominate as Performance Star');

-- ---------- M04b: Khalid Mansour (id 367) ----------
DELETE FROM demo_facts WHERE employee_id = 367 AND fact_key IN ('forecast_pct','forecast_weeks','recog_days','proj_risk','proj_wellbeing_to',
  'proj_wellbeing_gain','proj_engagement','proj_cases_n','proj_cases_total','proj_cases_drop','proj_cases_weeks','proj_confidence','proj_horizon_weeks');
INSERT INTO demo_facts (employee_id, fact_key, fact_value) VALUES
  (367, 'forecast_pct', '81'), (367, 'forecast_weeks', '3'), (367, 'recog_days', '71'),
  (367, 'proj_risk', '49'), (367, 'proj_wellbeing_to', '58'), (367, 'proj_wellbeing_gain', '52'), (367, 'proj_engagement', '78'),
  (367, 'proj_cases_n', '19'), (367, 'proj_cases_total', '23'), (367, 'proj_cases_drop', '15'), (367, 'proj_cases_weeks', '6'),
  (367, 'proj_confidence', '0.78'), (367, 'proj_horizon_weeks', '3');

DELETE FROM manager_notes WHERE employee_id = 367;
INSERT INTO manager_notes (employee_id, kind, ord, title, detail, footer, num) VALUES
  (367, 'event', 1, '3 SRE cross-staffed', NULL, NULL, NULL),
  (367, 'event', 2, 'Incident pages +25%', NULL, NULL, NULL),
  (367, 'event', 3, 'Overtime +1d', NULL, NULL, NULL),
  (367, 'event', 4, 'Early warning', NULL, NULL, NULL),
  (367, 'event', 5, 'Plan proposed', NULL, NULL, NULL),
  (367, 'development', 1, 'Sustainable pace', 'written 8 times', NULL, NULL),
  (367, 'development', 2, 'Delegating incident work to newer engineers', NULL, NULL, NULL),
  (367, 'action', 1, 'Reallocate 2 tasks this week', 'Deploy pipeline migration → Noura (capacity 74%)|Alert tuning → Faisal (71%)|Impact est. task count: 16 → 11', 'Impact est. this week', 11),
  (367, 'action', 2, 'Two weeks off primary on-call', 'Begin during this rotation (Noura covers)|Keep Khalid as backup, not lead', 'Impact est. from 1 Sep to 13 Oct', 8),
  (367, 'action', 3, 'Recognize the incident work', 'Nominate Performance Star badge in Recognition module|Direct DM', 'Yasmin Hadi this week — 10 min', 4);

DELETE FROM demo_facts WHERE employee_id = 367 AND fact_key IN ('ind_workload_pct','ind_overtime_hours');
INSERT INTO demo_facts (employee_id, fact_key, fact_value) VALUES (367, 'ind_workload_pct', '18'), (367, 'ind_overtime_hours', '12');