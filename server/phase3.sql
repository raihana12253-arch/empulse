-- =====================================================================
-- phase3.sql — extra tables and demo data for E09 PulseAI, E10 My Reports, E11 Settings and M01 Team Overview.
-- Import AFTER database.sql, data.sql, phase1.sql and phase2.sql. It needs the database "empulse" selected.
-- It can be run again (the DROP lines clean the old copy).
-- =====================================================================
USE empulse;

DROP TABLE IF EXISTS report_shares;
DROP TABLE IF EXISTS pulseai_log;
DROP TABLE IF EXISTS user_settings;

-- E11: the privacy choices of one person (a missing row = the default shown in the page)
CREATE TABLE user_settings (
  employee_id    INT UNSIGNED NOT NULL,
  setting_key    VARCHAR(40)  NOT NULL,                 -- share_wellbeing, public_recognition, pulseai_suggest, weekly_digest
  setting_value  TINYINT(1)   NOT NULL,
  PRIMARY KEY (employee_id, setting_key),
  CONSTRAINT fk_settings_employee FOREIGN KEY (employee_id) REFERENCES employees (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- E09: the questions a person asked PulseAI (only their own) and whether the answer helped
CREATE TABLE pulseai_log (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  employee_id  INT UNSIGNED NOT NULL,
  intent       VARCHAR(30)  NOT NULL,                   -- reach_gold, innovation_drop, course, lead_ready, summary, plan
  question     VARCHAR(200) NOT NULL,
  asked_at     DATETIME     NOT NULL,
  helpful      TINYINT(1)   NULL,
  PRIMARY KEY (id),
  KEY ix_pulseai_employee (employee_id),
  CONSTRAINT fk_pulseai_employee FOREIGN KEY (employee_id) REFERENCES employees (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- E10: a report the person chose to share with their manager (nothing is shared without this row)
CREATE TABLE report_shares (
  id            INT UNSIGNED NOT NULL AUTO_INCREMENT,
  employee_id   INT UNSIGNED NOT NULL,
  report_key    VARCHAR(30)  NOT NULL,
  shared_with   INT UNSIGNED NOT NULL,                  -- the manager (employees.id)
  shared_at     DATETIME     NOT NULL,
  PRIMARY KEY (id),
  KEY ix_shares_employee (employee_id),
  CONSTRAINT fk_shares_employee FOREIGN KEY (employee_id) REFERENCES employees (id),
  CONSTRAINT fk_shares_manager FOREIGN KEY (shared_with) REFERENCES employees (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Layla's choices as in the design: the weekly digest is off, everything else is on
INSERT INTO user_settings (employee_id, setting_key, setting_value)
SELECT id, 'share_wellbeing', 1 FROM employees WHERE email = 'layla@horizon.demo';
INSERT INTO user_settings (employee_id, setting_key, setting_value)
SELECT id, 'public_recognition', 1 FROM employees WHERE email = 'layla@horizon.demo';
INSERT INTO user_settings (employee_id, setting_key, setting_value)
SELECT id, 'pulseai_suggest', 1 FROM employees WHERE email = 'layla@horizon.demo';
INSERT INTO user_settings (employee_id, setting_key, setting_value)
SELECT id, 'weekly_digest', 0 FROM employees WHERE email = 'layla@horizon.demo';

-- Layla's earlier questions to PulseAI (the "Recent" list)
INSERT INTO pulseai_log (employee_id, intent, question, asked_at)
SELECT id, 'reach_gold', 'How can I reach Gold this quarter?', '2026-09-21 09:40:00' FROM employees WHERE email = 'layla@horizon.demo';
INSERT INTO pulseai_log (employee_id, intent, question, asked_at)
SELECT id, 'innovation_drop', 'Why did my innovation score drop?', '2026-09-18 16:05:00' FROM employees WHERE email = 'layla@horizon.demo';
INSERT INTO pulseai_log (employee_id, intent, question, asked_at)
SELECT id, 'course', 'Which course should I take next?', '2026-09-12 11:20:00' FROM employees WHERE email = 'layla@horizon.demo';
INSERT INTO pulseai_log (employee_id, intent, question, asked_at)
SELECT id, 'lead_ready', 'Am I ready for Lead Data Analyst?', '2026-09-05 14:30:00' FROM employees WHERE email = 'layla@horizon.demo';
INSERT INTO pulseai_log (employee_id, intent, question, asked_at)
SELECT id, 'summary', 'Summarise my progress this quarter', '2026-08-29 10:10:00' FROM employees WHERE email = 'layla@horizon.demo';

-- Design-only numbers of Layla (E09 / E10): wellbeing signal 49 -> 76, peer coaching named by 5 colleagues, July rebalance result
INSERT INTO demo_facts (employee_id, fact_key, fact_value)
SELECT id, 'wellbeing_now', '76' FROM employees WHERE email = 'layla@horizon.demo';
INSERT INTO demo_facts (employee_id, fact_key, fact_value)
SELECT id, 'wellbeing_start', '49' FROM employees WHERE email = 'layla@horizon.demo';
INSERT INTO demo_facts (employee_id, fact_key, fact_value)
SELECT id, 'peer_coaching_named', '5' FROM employees WHERE email = 'layla@horizon.demo';
INSERT INTO demo_facts (employee_id, fact_key, fact_value)
SELECT id, 'rebalance_engagement_from', '66' FROM employees WHERE email = 'layla@horizon.demo';
INSERT INTO demo_facts (employee_id, fact_key, fact_value)
SELECT id, 'rebalance_engagement_to', '80' FROM employees WHERE email = 'layla@horizon.demo';
INSERT INTO demo_facts (employee_id, fact_key, fact_value)
SELECT id, 'rebalance_score_from', '81' FROM employees WHERE email = 'layla@horizon.demo';

-- M01: Yasmin's team has two open SRE roles (a fact of the manager, shown in "What's changing")
INSERT INTO demo_facts (employee_id, fact_key, fact_value)
SELECT id, 'unfilled_roles', '2' FROM employees WHERE email = 'yasmin@horizon.demo';
INSERT INTO demo_facts (employee_id, fact_key, fact_value)
SELECT id, 'unfilled_role_name', 'SRE' FROM employees WHERE email = 'yasmin@horizon.demo';
