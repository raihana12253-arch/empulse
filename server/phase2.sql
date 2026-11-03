-- =====================================================================
-- phase2.sql — extra tables and Layla's demo data for the screens E05 - E08
-- (Innovation Lab, Innovation Marketplace, My Growth Path, Recognition).
-- Import AFTER database.sql, data.sql and phase1.sql. It needs the database "empulse" selected.
-- It can be run again after re-importing data.sql (the DROP lines clean the old copy).
-- =====================================================================
USE empulse;

DROP TABLE IF EXISTS recognition_voices;
DROP TABLE IF EXISTS recognition_stories;
DROP TABLE IF EXISTS idea_evidence;
DROP TABLE IF EXISTS idea_notes;
DROP TABLE IF EXISTS idea_details;
DROP TABLE IF EXISTS growth_projects;
DROP TABLE IF EXISTS mentors;
DROP TABLE IF EXISTS learning_items;
DROP TABLE IF EXISTS growth_skills;
DROP TABLE IF EXISTS growth_milestones;

-- E05: the text of a draft idea and PulseAI's money estimate
CREATE TABLE idea_details (
  idea_id         INT UNSIGNED NOT NULL,
  problem         VARCHAR(400) NOT NULL,
  solution        VARCHAR(400) NOT NULL,
  benefit         VARCHAR(300) NOT NULL,
  duration_weeks  TINYINT UNSIGNED NOT NULL,
  roi_estimate    DECIMAL(3,1) NULL,                    -- PulseAI estimate, e.g. 3.2
  roi_low         DECIMAL(3,1) NULL,
  roi_high        DECIMAL(3,1) NULL,
  ramp_weeks      TINYINT UNSIGNED NULL,                -- "6 weeks of analyst review time"
  ramp_cost_sar   INT UNSIGNED NULL,
  adoption_pct    TINYINT UNSIGNED NULL,
  saved_at        DATETIME NULL,
  PRIMARY KEY (idea_id),
  CONSTRAINT fk_details_idea FOREIGN KEY (idea_id) REFERENCES ideas (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- E05: PulseAI's short reason under each score (kind 'analysis', dim = novelty ...) and the "strengthen" tips
CREATE TABLE idea_notes (
  idea_id  INT UNSIGNED NOT NULL,
  kind     ENUM('analysis','suggestion') NOT NULL,
  seq      TINYINT UNSIGNED NOT NULL,
  dim      VARCHAR(20) NULL,
  note     VARCHAR(220) NOT NULL,
  PRIMARY KEY (idea_id, kind, seq),
  CONSTRAINT fk_notes_idea FOREIGN KEY (idea_id) REFERENCES ideas (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- E05: files attached to a draft (names only; this demo does not store files)
CREATE TABLE idea_evidence (
  idea_id     INT UNSIGNED NOT NULL,
  seq         TINYINT UNSIGNED NOT NULL,
  file_name   VARCHAR(80) NOT NULL,
  size_label  VARCHAR(30) NOT NULL,
  PRIMARY KEY (idea_id, seq),
  CONSTRAINT fk_evidence_idea FOREIGN KEY (idea_id) REFERENCES ideas (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- E07: the milestones drawn on the journey (state: done / current / planned / goal; x and y are 0-1000 / 0-300)
CREATE TABLE growth_milestones (
  employee_id  INT UNSIGNED NOT NULL,
  seq          TINYINT UNSIGNED NOT NULL,
  state        ENUM('done','current','planned','goal') NOT NULL,
  title        VARCHAR(80) NOT NULL,
  sub          VARCHAR(40) NOT NULL,
  pos_x        SMALLINT UNSIGNED NOT NULL,
  pos_y        SMALLINT UNSIGNED NOT NULL,
  PRIMARY KEY (employee_id, seq),
  CONSTRAINT fk_milestone_employee FOREIGN KEY (employee_id) REFERENCES employees (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE growth_skills (
  employee_id  INT UNSIGNED NOT NULL,
  seq          TINYINT UNSIGNED NOT NULL,
  skill        VARCHAR(60) NOT NULL,
  value        TINYINT UNSIGNED NOT NULL,
  target       TINYINT UNSIGNED NOT NULL,
  PRIMARY KEY (employee_id, seq),
  CONSTRAINT fk_gskill_employee FOREIGN KEY (employee_id) REFERENCES employees (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- E07: learning that is not one of the growth path modules
CREATE TABLE learning_items (
  employee_id  INT UNSIGNED NOT NULL,
  seq          TINYINT UNSIGNED NOT NULL,
  title        VARCHAR(100) NOT NULL,
  detail       VARCHAR(100) NOT NULL,
  PRIMARY KEY (employee_id, seq),
  CONSTRAINT fk_learning_employee FOREIGN KEY (employee_id) REFERENCES employees (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE mentors (
  employee_id  INT UNSIGNED NOT NULL,
  mentor_id    INT UNSIGNED NOT NULL,
  PRIMARY KEY (employee_id, mentor_id),
  CONSTRAINT fk_mentors_employee FOREIGN KEY (employee_id) REFERENCES employees (id),
  CONSTRAINT fk_mentors_mentor FOREIGN KEY (mentor_id) REFERENCES employees (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE growth_projects (
  employee_id  INT UNSIGNED NOT NULL,
  idea_id      INT UNSIGNED NOT NULL,
  sub          VARCHAR(60) NOT NULL,
  PRIMARY KEY (employee_id, idea_id),
  CONSTRAINT fk_gproject_employee FOREIGN KEY (employee_id) REFERENCES employees (id),
  CONSTRAINT fk_gproject_idea FOREIGN KEY (idea_id) REFERENCES ideas (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- E08: the longer story and the impact line the wall shows (the short message stays for E01)
CREATE TABLE recognition_stories (
  recognition_id  INT UNSIGNED NOT NULL,
  story           VARCHAR(300) NOT NULL,
  impact          VARCHAR(160) NULL,
  PRIMARY KEY (recognition_id),
  CONSTRAINT fk_story_recognition FOREIGN KEY (recognition_id) REFERENCES recognitions (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- E08: one voice per colleague on a recognition
CREATE TABLE recognition_voices (
  recognition_id  INT UNSIGNED NOT NULL,
  employee_id     INT UNSIGNED NOT NULL,
  PRIMARY KEY (recognition_id, employee_id),
  CONSTRAINT fk_voice_recognition FOREIGN KEY (recognition_id) REFERENCES recognitions (id),
  CONSTRAINT fk_voice_employee FOREIGN KEY (employee_id) REFERENCES employees (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------- E05: the draft idea IDEA-121 (Layla) ----------
INSERT INTO idea_details (idea_id, problem, solution, benefit, duration_weeks, roi_estimate, roi_low, roi_high, ramp_weeks, ramp_cost_sar, adoption_pct, saved_at)
SELECT id, 'Analysts hand-code ~4,000 open-text survey answers each quarter. It takes 3 weeks, so insights arrive after decisions are made.',
       'A language model suggests themes for each answer; analysts approve or correct in one click. Corrections retrain the model every cycle.',
       'Insights in 3 days instead of 3 weeks; analysts freed for deeper work.', 8, 3.2, 2.6, 3.8, 6, 12000, 90, '2026-09-21 09:58:00'
FROM ideas WHERE code = 'IDEA-121';
INSERT INTO idea_notes (idea_id, kind, seq, dim, note)
SELECT id, 'analysis', 1, 'novelty', 'No similar idea in the last 24 months; 1 related idea (2025) stopped for data access.' FROM ideas WHERE code = 'IDEA-121';
INSERT INTO idea_notes (idea_id, kind, seq, dim, note)
SELECT id, 'analysis', 2, 'feasibility', 'Uses the approved language-model gateway; survey data already classified Internal.' FROM ideas WHERE code = 'IDEA-121';
INSERT INTO idea_notes (idea_id, kind, seq, dim, note)
SELECT id, 'analysis', 3, 'value', 'Savings credible; benefit of faster insight not yet counted.' FROM ideas WHERE code = 'IDEA-121';
INSERT INTO idea_notes (idea_id, kind, seq, dim, note)
SELECT id, 'analysis', 4, 'impact', '3 teams run quarterly surveys; reach grows if HR adopts it.' FROM ideas WHERE code = 'IDEA-121';
INSERT INTO idea_notes (idea_id, kind, seq, dim, note)
SELECT id, 'suggestion', 1, NULL, 'Add a 20-answer pilot comparing AI themes with manual coding — lifts feasibility confidence.' FROM ideas WHERE code = 'IDEA-121';
INSERT INTO idea_notes (idea_id, kind, seq, dim, note)
SELECT id, 'suggestion', 2, NULL, 'Name a data owner in Customer Insights to avoid the 2025 blocker.' FROM ideas WHERE code = 'IDEA-121';
INSERT INTO idea_notes (idea_id, kind, seq, dim, note)
SELECT id, 'suggestion', 3, NULL, 'Estimate hours saved for HR’s engagement survey to grow impact.' FROM ideas WHERE code = 'IDEA-121';
INSERT INTO idea_evidence (idea_id, seq, file_name, size_label)
SELECT id, 1, 'coding-time-study.pdf', '1.2 MB' FROM ideas WHERE code = 'IDEA-121';
INSERT INTO idea_evidence (idea_id, seq, file_name, size_label)
SELECT id, 2, 'theme-review-mock.png', '640 KB' FROM ideas WHERE code = 'IDEA-121';
INSERT INTO idea_evidence (idea_id, seq, file_name, size_label)
SELECT id, 3, 'prototype · notebook link', '' FROM ideas WHERE code = 'IDEA-121';
-- the idea cost / savings that the form shows
UPDATE ideas SET cost_sar = 40000, expected_savings_sar = 150000 WHERE code = 'IDEA-121';

-- ---------- E07: Layla's growth path ----------
INSERT INTO growth_milestones (employee_id, seq, state, title, sub, pos_x, pos_y)
SELECT id, 1, 'done',    '2022',                         'Joined as Analyst',        90, 232 FROM employees WHERE email = 'layla@horizon.demo';
INSERT INTO growth_milestones (employee_id, seq, state, title, sub, pos_x, pos_y)
SELECT id, 2, 'done',    '2024',                         'Promoted to Senior',      266, 191 FROM employees WHERE email = 'layla@horizon.demo';
INSERT INTO growth_milestones (employee_id, seq, state, title, sub, pos_x, pos_y)
SELECT id, 3, 'done',    'Insight Hub implemented',      'AUG 26',                  377, 100 FROM employees WHERE email = 'layla@horizon.demo';
INSERT INTO growth_milestones (employee_id, seq, state, title, sub, pos_x, pos_y)
SELECT id, 4, 'current', 'Analytics Product Delivery',   '64% completed',           590, 175 FROM employees WHERE email = 'layla@horizon.demo';
INSERT INTO growth_milestones (employee_id, seq, state, title, sub, pos_x, pos_y)
SELECT id, 5, 'planned', 'Co-lead Anomaly Radar',        'OCT 12',                  710, 198 FROM employees WHERE email = 'layla@horizon.demo';
INSERT INTO growth_milestones (employee_id, seq, state, title, sub, pos_x, pos_y)
SELECT id, 6, 'planned', 'Stakeholder negotiation lab',  'DEC 17',                  803,  93 FROM employees WHERE email = 'layla@horizon.demo';
INSERT INTO growth_milestones (employee_id, seq, state, title, sub, pos_x, pos_y)
SELECT id, 7, 'planned', 'Lead readiness review',        'JAN 21',                  874,  38 FROM employees WHERE email = 'layla@horizon.demo';
INSERT INTO growth_milestones (employee_id, seq, state, title, sub, pos_x, pos_y)
SELECT id, 8, 'goal',    'Lead Data Analyst',            '',                        874,  38 FROM employees WHERE email = 'layla@horizon.demo';

INSERT INTO growth_skills (employee_id, seq, skill, value, target)
SELECT id, 1, 'Analytics depth', 90, 85 FROM employees WHERE email = 'layla@horizon.demo';
INSERT INTO growth_skills (employee_id, seq, skill, value, target)
SELECT id, 2, 'Coaching others', 80, 70 FROM employees WHERE email = 'layla@horizon.demo';
INSERT INTO growth_skills (employee_id, seq, skill, value, target)
SELECT id, 3, 'Business acumen', 65, 75 FROM employees WHERE email = 'layla@horizon.demo';
INSERT INTO growth_skills (employee_id, seq, skill, value, target)
SELECT id, 4, 'Stakeholder management', 55, 70 FROM employees WHERE email = 'layla@horizon.demo';
INSERT INTO growth_skills (employee_id, seq, skill, value, target)
SELECT id, 5, 'Delivery & implementation', 40, 70 FROM employees WHERE email = 'layla@horizon.demo';

INSERT INTO learning_items (employee_id, seq, title, detail)
SELECT id, 1, 'Negotiating with Senior Stakeholders', 'Live cohort starts 18 Oct' FROM employees WHERE email = 'layla@horizon.demo';
INSERT INTO learning_items (employee_id, seq, title, detail)
SELECT id, 2, 'Finance for Analysts', 'On-demand course (estimated 4 hours)' FROM employees WHERE email = 'layla@horizon.demo';

INSERT INTO mentors (employee_id, mentor_id)
SELECT l.id, m.id FROM employees l, employees m WHERE l.email = 'layla@horizon.demo' AND m.full_name = 'Nadia Karim';
INSERT INTO mentors (employee_id, mentor_id)
SELECT l.id, m.id FROM employees l, employees m WHERE l.email = 'layla@horizon.demo' AND m.full_name = 'Adel Nasser';

INSERT INTO growth_projects (employee_id, idea_id, sub)
SELECT l.id, i.id, 'Co-lead role open' FROM employees l, ideas i WHERE l.email = 'layla@horizon.demo' AND i.code = 'IDEA-117';
INSERT INTO growth_projects (employee_id, idea_id, sub)
SELECT l.id, i.id, 'Pilot pipeline development' FROM employees l, ideas i WHERE l.email = 'layla@horizon.demo' AND i.code = 'IDEA-102';

INSERT INTO demo_facts (employee_id, fact_key, fact_value)
SELECT id, 'learning_hours', '42' FROM employees WHERE email = 'layla@horizon.demo';
INSERT INTO demo_facts (employee_id, fact_key, fact_value)
SELECT id, 'learning_hours_delta', '4' FROM employees WHERE email = 'layla@horizon.demo';
INSERT INTO demo_facts (employee_id, fact_key, fact_value)
SELECT id, 'goals_total', '3' FROM employees WHERE email = 'layla@horizon.demo';
INSERT INTO demo_facts (employee_id, fact_key, fact_value)
SELECT id, 'goals_on_track', '2' FROM employees WHERE email = 'layla@horizon.demo';
INSERT INTO demo_facts (employee_id, fact_key, fact_value)
SELECT id, 'milestones_reached', '4' FROM employees WHERE email = 'layla@horizon.demo';
INSERT INTO demo_facts (employee_id, fact_key, fact_value)
SELECT id, 'milestones_total', '8' FROM employees WHERE email = 'layla@horizon.demo';
INSERT INTO demo_facts (employee_id, fact_key, fact_value)
SELECT id, 'joined_year', '2022' FROM employees WHERE email = 'layla@horizon.demo';
INSERT INTO demo_facts (employee_id, fact_key, fact_value)
SELECT id, 'recognize_outcome', 'Board pack Q3' FROM employees WHERE email = 'layla@horizon.demo';

-- ---------- E08: the stories on the wall (same recognitions as in the data, longer text as in the design) ----------
INSERT INTO recognition_stories (recognition_id, story, impact)
SELECT id, 'Self-serve Insight Hub put answers in the hands of five teams. Fewer tickets, faster decisions — and a model other departments now copy.', 'Report requests -38% · SAR 180K / yr'
FROM recognitions WHERE category = 'Innovation Champion' AND giver_name = 'Innovation Council' AND receiver_id = (SELECT id FROM employees WHERE email = 'layla@horizon.demo');
INSERT INTO recognition_stories (recognition_id, story, impact)
SELECT r.id, 'Took on two recurring reports in July without a word of complaint, and improved both. Thank you for giving me room to recover.', r.linked_outcome
FROM recognitions r JOIN employees e ON e.id = r.receiver_id WHERE e.full_name = 'Yousef Tamimi' AND r.category = 'Team Supporter';
INSERT INTO recognition_stories (recognition_id, story, impact)
SELECT r.id, 'Paired with three teams to migrate the deploy pipeline — zero downtime, and everyone learned something.', 'Deploy time -41%'
FROM recognitions r JOIN employees e ON e.id = r.receiver_id WHERE e.full_name = 'Noura Al-Saud' AND r.category = 'Collaboration Hero' AND r.linked_outcome IS NOT NULL;
INSERT INTO recognition_stories (recognition_id, story, impact)
SELECT r.id, 'Championed the new ERP flows in Finance Ops, running lunch-and-learns until the whole team was confident.', r.linked_outcome
FROM recognitions r JOIN employees e ON e.id = r.receiver_id WHERE e.full_name = 'Dina Kassem' AND r.category = 'Digital Pioneer' AND r.linked_outcome IS NOT NULL;
INSERT INTO recognition_stories (recognition_id, story, impact)
SELECT r.id, 'Completed the SQL-to-Python path and shipped her first automated dashboard within the same month.', r.linked_outcome
FROM recognitions r JOIN employees e ON e.id = r.receiver_id WHERE e.full_name = 'Reem Aziz' AND r.category = 'Growth Champion';
INSERT INTO recognition_stories (recognition_id, story, impact)
SELECT r.id, 'Led the incident review culture reset — blameless, fast, and with fixes that stick.', 'Repeat incidents -27%'
FROM recognitions r JOIN employees e ON e.id = r.receiver_id WHERE e.full_name = 'Maha Al-Otaibi' AND r.category = 'Performance Star' AND r.linked_outcome IS NOT NULL;

-- IDEA-117 (Invoice Anomaly Radar): the text shown on the marketplace card
INSERT INTO idea_details (idea_id, problem, solution, benefit, duration_weeks)
SELECT id, 'Duplicate and out-of-pattern supplier invoices are paid before anyone sees them.',
       'Flags duplicate and out-of-pattern supplier invoices before payment. Pilot on 18 months of AP data found SAR 1.1M in questionable payments.',
       'Fewer questionable payments.', 14 FROM ideas WHERE code = 'IDEA-117';
INSERT INTO demo_facts (employee_id, fact_key, fact_value)
SELECT id, 'growth_ready_pct', '64' FROM employees WHERE email = 'layla@horizon.demo';
INSERT INTO demo_facts (employee_id, fact_key, fact_value)
SELECT id, 'plan_month', '7' FROM employees WHERE email = 'layla@horizon.demo';
