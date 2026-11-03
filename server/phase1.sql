-- =====================================================================
-- server/phase1.sql — three small extra tables for the employee screens E01-E04.
-- Run ONCE, after database.sql and data.sql (see server/docs/README.md).
-- Running it again just rebuilds these three tables.
--
-- Why they exist: the design shows things the generated data did not have
-- (hours of focus time and meetings, the next mentor session, the next growth module).
-- They are filled ONLY for Layla Haddad (the demo employee). Other people see an empty card.
-- The numbers are the ones shown in the design (demo values, not model output).
-- ALL DATA IS SYNTHETIC.
-- =====================================================================
USE empulse;
SET NAMES utf8mb4;

DROP TABLE IF EXISTS demo_facts;
DROP TABLE IF EXISTS work_events;
DROP TABLE IF EXISTS growth_modules;
DROP TABLE IF EXISTS mentor_sessions;
DROP TABLE IF EXISTS weekly_activity;

-- Hours per week (E01 "Balance this week").
CREATE TABLE weekly_activity (
  employee_id    INT UNSIGNED NOT NULL,
  week_start     DATE         NOT NULL,                 -- Monday
  planned_hours  DECIMAL(4,1) NOT NULL,
  work_hours     DECIMAL(4,1) NOT NULL,
  focus_hours    DECIMAL(4,1) NOT NULL,
  meeting_hours  DECIMAL(4,1) NOT NULL,
  after_hours    DECIMAL(4,1) NOT NULL,
  PRIMARY KEY (employee_id, week_start),
  CONSTRAINT fk_activity_employee FOREIGN KEY (employee_id) REFERENCES employees (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- The next mentor session (E01 "Mentor session").
CREATE TABLE mentor_sessions (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  employee_id  INT UNSIGNED NOT NULL,
  mentor_name  VARCHAR(80)  NOT NULL,
  session_at   DATETIME     NOT NULL,
  topic        VARCHAR(120) NOT NULL,
  PRIMARY KEY (id),
  KEY ix_mentor_employee (employee_id),
  CONSTRAINT fk_mentor_employee FOREIGN KEY (employee_id) REFERENCES employees (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- A growth path: its modules, in order (E01 "Next growth step"; E07 will use it too).
CREATE TABLE growth_modules (
  employee_id   INT UNSIGNED NOT NULL,
  goal_title    VARCHAR(80)  NOT NULL,                  -- "Lead Data Analyst"
  seq           TINYINT UNSIGNED NOT NULL,              -- 1 ... total
  total         TINYINT UNSIGNED NOT NULL,
  title         VARCHAR(100) NOT NULL,
  description   VARCHAR(160) NOT NULL,
  progress_pct  TINYINT UNSIGNED NOT NULL,              -- 0-100
  PRIMARY KEY (employee_id, seq),
  CONSTRAINT fk_growth_employee FOREIGN KEY (employee_id) REFERENCES employees (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- Layla Haddad (found by e-mail) ----------
INSERT INTO weekly_activity (employee_id, week_start, planned_hours, work_hours, focus_hours, meeting_hours, after_hours)
SELECT id, '2026-09-14', 40, 41.5, 14, 11, 1.5 FROM employees WHERE email = 'layla@horizon.demo';
INSERT INTO weekly_activity (employee_id, week_start, planned_hours, work_hours, focus_hours, meeting_hours, after_hours)
SELECT id, '2026-09-07', 40, 40.5, 13, 12, 0.5 FROM employees WHERE email = 'layla@horizon.demo';
INSERT INTO weekly_activity (employee_id, week_start, planned_hours, work_hours, focus_hours, meeting_hours, after_hours)
SELECT id, '2026-08-31', 40, 42, 12, 12, 2 FROM employees WHERE email = 'layla@horizon.demo';

INSERT INTO mentor_sessions (employee_id, mentor_name, session_at, topic)
SELECT id, 'Nadia Karim', '2026-09-24 10:00:00', 'From prototype to rollout' FROM employees WHERE email = 'layla@horizon.demo';

INSERT INTO growth_modules (employee_id, goal_title, seq, total, title, description, progress_pct)
SELECT id, 'Lead Data Analyst', 1, 6, 'Advanced SQL and data modelling', 'Builds your technical base', 100 FROM employees WHERE email = 'layla@horizon.demo';
INSERT INTO growth_modules (employee_id, goal_title, seq, total, title, description, progress_pct)
SELECT id, 'Lead Data Analyst', 2, 6, 'Experiment design', 'Strengthens your experimentation', 100 FROM employees WHERE email = 'layla@horizon.demo';
INSERT INTO growth_modules (employee_id, goal_title, seq, total, title, description, progress_pct)
SELECT id, 'Lead Data Analyst', 3, 6, 'Stakeholder storytelling', 'Makes your insights land', 100 FROM employees WHERE email = 'layla@horizon.demo';
INSERT INTO growth_modules (employee_id, goal_title, seq, total, title, description, progress_pct)
SELECT id, 'Lead Data Analyst', 4, 6, 'Analytics Product Delivery', 'Closes your implementation gap', 64 FROM employees WHERE email = 'layla@horizon.demo';
INSERT INTO growth_modules (employee_id, goal_title, seq, total, title, description, progress_pct)
SELECT id, 'Lead Data Analyst', 5, 6, 'Leading analyses end to end', 'Prepares you to lead', 0 FROM employees WHERE email = 'layla@horizon.demo';
INSERT INTO growth_modules (employee_id, goal_title, seq, total, title, description, progress_pct)
SELECT id, 'Lead Data Analyst', 6, 6, 'Coaching other analysts', 'Grows your team impact', 0 FROM employees WHERE email = 'layla@horizon.demo';

-- Single numbers that the design shows for Layla but the generated data does not contain.
-- They are demo values taken from the design images (see docs/DECISIONS.md, step E01-E04).
-- A screen uses a fact when the person has one, and calculates the number from the data otherwise.
CREATE TABLE demo_facts (
  employee_id  INT UNSIGNED NOT NULL,
  fact_key     VARCHAR(40)  NOT NULL,
  fact_value   VARCHAR(80)  NOT NULL,
  PRIMARY KEY (employee_id, fact_key),
  CONSTRAINT fk_facts_employee FOREIGN KEY (employee_id) REFERENCES employees (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Work events shown on the Digital Twin timeline (E03). kind = a text key in the language files.
CREATE TABLE work_events (
  employee_id  INT UNSIGNED NOT NULL,
  event_date   DATE         NOT NULL,
  kind         VARCHAR(40)  NOT NULL,
  PRIMARY KEY (employee_id, event_date, kind),
  CONSTRAINT fk_events_employee FOREIGN KEY (employee_id) REFERENCES employees (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO demo_facts (employee_id, fact_key, fact_value)
SELECT id, 'focus_days',          'tue_wed' FROM employees WHERE email = 'layla@horizon.demo';
INSERT INTO demo_facts (employee_id, fact_key, fact_value)
SELECT id, 'focus_morning_pct',   '68'      FROM employees WHERE email = 'layla@horizon.demo';
INSERT INTO demo_facts (employee_id, fact_key, fact_value)
SELECT id, 'workload_june_pct',   '122'     FROM employees WHERE email = 'layla@horizon.demo';
INSERT INTO demo_facts (employee_id, fact_key, fact_value)
SELECT id, 'workload_now_pct',    '102'     FROM employees WHERE email = 'layla@horizon.demo';
INSERT INTO demo_facts (employee_id, fact_key, fact_value)
SELECT id, 'workload_limit_pct',  '105'     FROM employees WHERE email = 'layla@horizon.demo';
INSERT INTO demo_facts (employee_id, fact_key, fact_value)
SELECT id, 'workload_rise_pct',   '22'      FROM employees WHERE email = 'layla@horizon.demo';
INSERT INTO demo_facts (employee_id, fact_key, fact_value)
SELECT id, 'meeting_change_pct',  '9'       FROM employees WHERE email = 'layla@horizon.demo';
INSERT INTO demo_facts (employee_id, fact_key, fact_value)
SELECT id, 'dna_growth_trait',    'business_impact' FROM employees WHERE email = 'layla@horizon.demo';
INSERT INTO demo_facts (employee_id, fact_key, fact_value)
SELECT id, 'dna_growth_points',   '22'      FROM employees WHERE email = 'layla@horizon.demo';
INSERT INTO demo_facts (employee_id, fact_key, fact_value)
SELECT id, 'ideas_cited_teams',   '4'       FROM employees WHERE email = 'layla@horizon.demo';
INSERT INTO demo_facts (employee_id, fact_key, fact_value)
SELECT id, 'named_by_colleagues', '5'       FROM employees WHERE email = 'layla@horizon.demo';
INSERT INTO demo_facts (employee_id, fact_key, fact_value)
SELECT id, 'development_area_2',  'stakeholder_negotiation' FROM employees WHERE email = 'layla@horizon.demo';

INSERT INTO work_events (employee_id, event_date, kind)
SELECT id, '2026-05-04', 'new_client_portfolio' FROM employees WHERE email = 'layla@horizon.demo';
INSERT INTO work_events (employee_id, event_date, kind)
SELECT id, '2026-06-01', 'recurring_reports' FROM employees WHERE email = 'layla@horizon.demo';

-- Two small corrections so Layla's screens read exactly like the design:
-- her latest check-in is "Good" (4 of 5), and one idea title is written the way the design writes it.
UPDATE checkins SET energy = 4
 WHERE week_start = '2026-09-14' AND employee_id = (SELECT id FROM employees WHERE email = 'layla@horizon.demo');
UPDATE ideas SET title = 'Churn early-signal alerts' WHERE code = 'IDEA-102';
-- The two recognition messages on Layla's overview read as in the design.
UPDATE recognitions SET message = 'Stepped in to coach two new analysts on the churn model.'
 WHERE category = 'Collaboration Hero' AND receiver_id = (SELECT id FROM employees WHERE email = 'layla@horizon.demo');
UPDATE recognitions SET message = 'Self-serve Insight Hub cut report requests by 38%.'
 WHERE category = 'Innovation Champion' AND receiver_id = (SELECT id FROM employees WHERE email = 'layla@horizon.demo');
