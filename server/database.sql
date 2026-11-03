-- =====================================================================
-- server/database.sql — EMPULSE database (MySQL / MariaDB in XAMPP)
--
-- Step 1: import this file  (creates the database and all tables, adds the demo accounts)
-- Step 2: import data.sql   (fills the tables with the generated demo data)
-- phpMyAdmin > Import > choose the file > Go.   Or see server/docs/README.md.
--
-- Importing this file again RESETS the data tables (they are dropped and created empty).
-- The users table and the audit log are kept.
--
-- ALL DATA IS SYNTHETIC. The criteria weights and tier limits are NOT stored here:
-- they live in one place only, server/config.php (supervisor decision).
-- =====================================================================

CREATE DATABASE IF NOT EXISTS empulse
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE empulse;

-- ---------------------------------------------------------------------
-- Accounts that can sign in. One row per person who uses the app.
-- employee_id links to employees.id (filled by data.sql, matched by e-mail).
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  email          VARCHAR(190) NOT NULL,                 -- stored in lower case
  password_hash  VARCHAR(255) NOT NULL,                 -- PHP password_hash() (bcrypt), never the real password
  role           ENUM('employee','manager','hr','executive','admin') NOT NULL,
  full_name      VARCHAR(120) NOT NULL,
  employee_id    INT UNSIGNED NULL,                     -- the person in employees (NULL for the executive demo account)
  is_active      TINYINT(1)   NOT NULL DEFAULT 1,
  last_login_at  DATETIME     NULL,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY ix_users_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Demo accounts. Password for all: empulse123
INSERT INTO users (email, password_hash, role, full_name) VALUES
  ('layla@horizon.demo',  '$2y$10$3vt/z5WdorEJmadFNSz2N.JHo88srqq/oY1uoFeqUX5z3Mym4vyNy', 'employee',  'Layla Haddad'),
  ('yasmin@horizon.demo', '$2y$10$3vt/z5WdorEJmadFNSz2N.JHo88srqq/oY1uoFeqUX5z3Mym4vyNy', 'manager',   'Yasmin Hadi'),
  ('rana@horizon.demo',   '$2y$10$3vt/z5WdorEJmadFNSz2N.JHo88srqq/oY1uoFeqUX5z3Mym4vyNy', 'hr',        'Rana Aziz'),
  -- Executive demo account (sees totals only). Not named in the design: server/docs/DECISIONS.md D-14.
  ('exec@horizon.demo',   '$2y$10$3vt/z5WdorEJmadFNSz2N.JHo88srqq/oY1uoFeqUX5z3Mym4vyNy', 'executive', 'Executive (demo)')
ON DUPLICATE KEY UPDATE
  password_hash = VALUES(password_hash),
  role          = VALUES(role),
  full_name     = VALUES(full_name),
  is_active     = 1;

-- ---------------------------------------------------------------------
-- Audit log: one row every time HR opens one person's data (privacy rule).
-- Kept when this file is imported again.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_log (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id      INT UNSIGNED NOT NULL,                   -- who looked
  action       VARCHAR(60)  NOT NULL,                   -- e.g. 'view_employee_profile', 'export_employees'
  employee_id  INT UNSIGNED NULL,                       -- whose data (NULL for exports of many people)
  details      VARCHAR(255) NULL,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY ix_audit_user (user_id),
  KEY ix_audit_employee (employee_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Data tables (filled by data.sql). Dropped first so a new import starts clean.
-- ---------------------------------------------------------------------
SET FOREIGN_KEY_CHECKS = 0;
DROP TABLE IF EXISTS app_settings, economic_items, skills, innovation_dna, recognitions, idea_members, ideas,
  interventions, checkins, monthly_scores, weekly_metrics, employee_current, employees, teams, departments;
SET FOREIGN_KEY_CHECKS = 1;

-- Simple settings. as_of_date = "today" in the demo data (21 Sep 2026).
-- Screens must use this date, not the computer's date.
CREATE TABLE app_settings (
  setting_key    VARCHAR(60)  NOT NULL,
  setting_value  VARCHAR(255) NOT NULL,
  PRIMARY KEY (setting_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6 departments
CREATE TABLE departments (
  id       INT UNSIGNED NOT NULL,
  name     VARCHAR(80)  NOT NULL,
  head_id  INT UNSIGNED NULL,                           -- the department head (employees.id)
  PRIMARY KEY (id),
  UNIQUE KEY uq_departments_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 31 teams. A team's "people" are its members WITHOUT the lead
-- (Platform Reliability = 9 people = Yasmin Hadi's 9 direct reports).
CREATE TABLE teams (
  id             INT UNSIGNED NOT NULL,
  name           VARCHAR(80)  NOT NULL,
  department_id  INT UNSIGNED NOT NULL,
  lead_id        INT UNSIGNED NULL,                     -- the team lead (employees.id)
  PRIMARY KEY (id),
  KEY ix_teams_department (department_id),
  CONSTRAINT fk_teams_department FOREIGN KEY (department_id) REFERENCES departments (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 1,240 people. Names are invented.
CREATE TABLE employees (
  id                  INT UNSIGNED NOT NULL,
  employee_code       CHAR(6)      NOT NULL,            -- HZ0001 ...
  full_name           VARCHAR(120) NOT NULL,
  first_name          VARCHAR(60)  NOT NULL,
  last_name           VARCHAR(60)  NOT NULL,
  email               VARCHAR(190) NOT NULL,
  gender              ENUM('F','M') NOT NULL,
  age                 TINYINT UNSIGNED NOT NULL,
  job_title           VARCHAR(80)  NOT NULL,
  job_level           TINYINT UNSIGNED NOT NULL,        -- 1 junior ... 5 department head
  department_id       INT UNSIGNED NOT NULL,
  team_id             INT UNSIGNED NULL,                -- NULL for department heads
  position            ENUM('member','team_lead','dept_head') NOT NULL,
  is_line_manager     TINYINT(1)   NOT NULL DEFAULT 0,  -- manages a group inside a big team
  manager_id          INT UNSIGNED NULL,                -- direct manager (employees.id)
  app_role            ENUM('employee','manager','hr','executive','admin') NOT NULL,
  hire_date           DATE         NOT NULL,
  tenure_years        DECIMAL(4,1) NOT NULL,
  work_mode           ENUM('Hybrid','On-site','Remote') NOT NULL,
  work_location       VARCHAR(40)  NOT NULL,
  monthly_income_sar  INT UNSIGNED NOT NULL,
  is_demo_person      TINYINT(1)   NOT NULL DEFAULT 0,  -- a person named in the design
  PRIMARY KEY (id),
  UNIQUE KEY uq_employees_email (email),
  UNIQUE KEY uq_employees_code (employee_code),
  KEY ix_employees_department (department_id),
  KEY ix_employees_team (team_id),
  KEY ix_employees_manager (manager_id),
  KEY ix_employees_name (full_name),
  CONSTRAINT fk_employees_department FOREIGN KEY (department_id) REFERENCES departments (id),
  CONSTRAINT fk_employees_team FOREIGN KEY (team_id) REFERENCES teams (id),
  CONSTRAINT fk_employees_manager FOREIGN KEY (manager_id) REFERENCES employees (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Today's state of every person: model inputs, burnout risk (from the ML model),
-- the seven criteria and the EMPULSE Score.
--   EMPULSE Score = sum of criterion x weight (weights in server/config.php)
--   job_burnout   = 100 - burnout_risk_pct   (the 7th criterion, scored the other way round)
-- Burnout risk is decision support, not a diagnosis.
CREATE TABLE employee_current (
  employee_id               INT UNSIGNED NOT NULL,
  as_of                     DATE         NOT NULL,
  -- model inputs (burnout + attrition models)
  workload_index            DECIMAL(5,1) NOT NULL,      -- 0-100
  overtime_hours_monthly    DECIMAL(5,1) NOT NULL,
  work_life_balance         DECIMAL(4,2) NOT NULL,      -- 1-4
  job_satisfaction          DECIMAL(4,2) NOT NULL,      -- 1-4
  mood_score                DECIMAL(4,2) NOT NULL,      -- 1-5
  engagement_score          TINYINT UNSIGNED NOT NULL,  -- 0-100, analytics signal only (not in the score)
  absence_days_annual       TINYINT UNSIGNED NOT NULL,
  recognition_90d           TINYINT UNSIGNED NOT NULL,  -- recognitions received in the last 90 days
  tenure_years              DECIMAL(4,1) NOT NULL,
  job_level                 TINYINT UNSIGNED NOT NULL,
  training_times_last_year  TINYINT UNSIGNED NOT NULL,
  income_ratio              DECIMAL(5,3) NOT NULL,      -- pay / median pay of the level
  years_since_promotion     DECIMAL(4,1) NOT NULL,
  monthly_income_sar        INT UNSIGNED NOT NULL,
  -- model outputs
  burnout_risk_pct          TINYINT UNSIGNED NOT NULL,  -- 0-100; 60+ = elevated (limit in server/config.php)
  burnout_change_6w         SMALLINT     NOT NULL,      -- points, compared with 6 weeks ago
  attrition_risk_pct        TINYINT UNSIGNED NOT NULL,
  burnout_drivers           TEXT         NOT NULL,      -- JSON: what raises / lowers the risk (Shapley values)
  attrition_drivers         TEXT         NOT NULL,      -- JSON
  -- the seven criteria (0-100)
  attendance_discipline     TINYINT UNSIGNED NOT NULL,
  task_completion           TINYINT UNSIGNED NOT NULL,
  innovation_creativity     TINYINT UNSIGNED NOT NULL,
  teamwork                  TINYINT UNSIGNED NOT NULL,
  professional_behavior     TINYINT UNSIGNED NOT NULL,
  technology_adoption       TINYINT UNSIGNED NOT NULL,
  job_burnout               TINYINT UNSIGNED NOT NULL,  -- = 100 - burnout_risk_pct
  empulse_score_exact       DECIMAL(5,2) NOT NULL,      -- e.g. 83.75
  empulse_score             TINYINT UNSIGNED NOT NULL,  -- rounded, e.g. 84
  tier                      ENUM('Gold','Silver','Bronze','Growth Needed') NOT NULL,
  last_recognized_at        DATE         NULL,
  development_plan          VARCHAR(60)  NULL,
  PRIMARY KEY (employee_id),
  KEY ix_current_tier (tier),
  KEY ix_current_risk (burnout_risk_pct),
  CONSTRAINT fk_current_employee FOREIGN KEY (employee_id) REFERENCES employees (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 52 weeks per person (Monday of each week). The last week equals employee_current.
CREATE TABLE weekly_metrics (
  employee_id             INT UNSIGNED NOT NULL,
  week_start              DATE         NOT NULL,
  workload_index          DECIMAL(5,1) NOT NULL,
  overtime_hours_monthly  DECIMAL(5,1) NOT NULL,
  work_life_balance       DECIMAL(4,2) NOT NULL,
  job_satisfaction        DECIMAL(4,2) NOT NULL,
  mood_score              DECIMAL(4,2) NOT NULL,
  engagement_score        TINYINT UNSIGNED NOT NULL,
  burnout_risk_pct        TINYINT UNSIGNED NOT NULL,    -- from the model
  PRIMARY KEY (employee_id, week_start),
  KEY ix_weekly_week (week_start),
  CONSTRAINT fk_weekly_employee FOREIGN KEY (employee_id) REFERENCES employees (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- The seven criteria and the score at the end of each month (12 months).
CREATE TABLE monthly_scores (
  employee_id            INT UNSIGNED NOT NULL,
  month                  DATE         NOT NULL,         -- first day of the month
  attendance_discipline  TINYINT UNSIGNED NOT NULL,
  task_completion        TINYINT UNSIGNED NOT NULL,
  innovation_creativity  TINYINT UNSIGNED NOT NULL,
  teamwork               TINYINT UNSIGNED NOT NULL,
  professional_behavior  TINYINT UNSIGNED NOT NULL,
  technology_adoption    TINYINT UNSIGNED NOT NULL,
  burnout_risk_pct       TINYINT UNSIGNED NOT NULL,
  job_burnout            TINYINT UNSIGNED NOT NULL,
  engagement_score       TINYINT UNSIGNED NOT NULL,
  empulse_score_exact    DECIMAL(5,2) NOT NULL,
  empulse_score          TINYINT UNSIGNED NOT NULL,
  tier                   ENUM('Gold','Silver','Bronze','Growth Needed') NOT NULL,
  PRIMARY KEY (employee_id, month),
  KEY ix_monthly_month (month),
  CONSTRAINT fk_monthly_employee FOREIGN KEY (employee_id) REFERENCES employees (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- PRIVATE weekly check-in. Only the person sees their own answers.
-- Managers and HR see only totals of 5 or more people (rule enforced in PHP).
CREATE TABLE checkins (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  employee_id  INT UNSIGNED NOT NULL,
  week_start   DATE         NOT NULL,
  energy       TINYINT UNSIGNED NOT NULL,               -- 1 Drained ... 5 Energised
  morale       TINYINT UNSIGNED NOT NULL,               -- 0-100
  share_trend  TINYINT(1)   NOT NULL DEFAULT 0,         -- the person shares the trend (never the answers)
  note         VARCHAR(500) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_checkins_week (employee_id, week_start),
  KEY ix_checkins_week (week_start),
  CONSTRAINT fk_checkins_employee FOREIGN KEY (employee_id) REFERENCES employees (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Interventions. Rule: nothing starts until a person approved it (human_approved = 1, approved_by_id set).
-- PulseAI may only DETECT and PROPOSE.
CREATE TABLE interventions (
  id                  INT UNSIGNED NOT NULL,
  code                VARCHAR(12)  NOT NULL,            -- INT-0392
  employee_id         INT UNSIGNED NULL,                -- for one person
  team_id             INT UNSIGNED NULL,                -- for a whole team
  department_id       INT UNSIGNED NULL,
  people_count        SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  type                ENUM('Workload rebalance','Recognition program','Training & mentoring','Task / team move') NOT NULL,
  title               VARCHAR(160) NOT NULL,
  problem             VARCHAR(160) NOT NULL,
  root_cause          VARCHAR(160) NOT NULL,
  status              ENUM('detected','proposed','active','completed','measured','declined','cancelled') NOT NULL,
  on_track            TINYINT(1)   NOT NULL DEFAULT 0,
  progress_pct        TINYINT UNSIGNED NOT NULL DEFAULT 0,
  proposed_by         ENUM('PulseAI','Manager') NOT NULL,
  owner_id            INT UNSIGNED NULL,                -- the manager or HR partner who owns it
  human_approved      TINYINT(1)   NOT NULL DEFAULT 0,
  approved_by_id      INT UNSIGNED NULL,                -- the person who approved it
  detected_at         DATE         NOT NULL,
  proposed_at         DATE         NULL,
  approved_at         DATE         NULL,
  started_at          DATE         NULL,
  checkin_at          DATE         NULL,
  followup_at         DATE         NULL,
  completed_at        DATE         NULL,
  measured_at         DATE         NULL,
  expected_risk_drop  TINYINT UNSIGNED NULL,            -- points, projected
  expected_text       VARCHAR(60)  NULL,                -- for team actions, e.g. 'Engagement +6'
  baseline_risk_pct   TINYINT UNSIGNED NULL,            -- risk when detected
  followup_risk_pct   TINYINT UNSIGNED NULL,            -- risk 6 weeks after the start (measured ones)
  current_risk_pct    TINYINT UNSIGNED NULL,
  outcome             ENUM('improved','no_change') NULL,
  improved            TINYINT(1)   NOT NULL DEFAULT 0,  -- risk 5+ points lower than at detection
  result_note         VARCHAR(160) NULL,
  cost_sar            INT UNSIGNED NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  UNIQUE KEY uq_interventions_code (code),
  KEY ix_interventions_employee (employee_id),
  KEY ix_interventions_status (status),
  CONSTRAINT fk_interventions_employee FOREIGN KEY (employee_id) REFERENCES employees (id),
  CONSTRAINT fk_interventions_team FOREIGN KEY (team_id) REFERENCES teams (id),
  CONSTRAINT fk_interventions_owner FOREIGN KEY (owner_id) REFERENCES employees (id),
  CONSTRAINT fk_interventions_approver FOREIGN KEY (approved_by_id) REFERENCES employees (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Ideas (Innovation Lab / Marketplace). Codes IDEA-001 ... IDEA-121 are 2026, IDEA-25-xxx are 2025.
CREATE TABLE ideas (
  id                    INT UNSIGNED NOT NULL,
  code                  VARCHAR(12)  NOT NULL,
  title                 VARCHAR(120) NOT NULL,
  department_id         INT UNSIGNED NOT NULL,
  team_id               INT UNSIGNED NULL,
  owner_id              INT UNSIGNED NOT NULL,
  status                ENUM('draft','ai_reviewed','approved','in_build','implemented','rejected','parked','merged') NOT NULL,
  category              VARCHAR(40)  NOT NULL,
  created_at            DATE         NULL,
  submitted_at          DATE         NULL,              -- NULL for drafts
  reviewed_at           DATE         NULL,              -- PulseAI review
  decided_at            DATE         NULL,              -- Innovation Council decision
  build_started_at      DATE         NULL,
  implemented_at        DATE         NULL,
  verified_at           DATE         NULL,              -- savings verified by Finance
  expected_savings_sar  INT UNSIGNED NOT NULL DEFAULT 0,
  cost_sar              INT UNSIGNED NOT NULL DEFAULT 0,
  realized_savings_sar  INT UNSIGNED NOT NULL DEFAULT 0,
  novelty               TINYINT UNSIGNED NULL,          -- PulseAI review scores 0-100
  feasibility           TINYINT UNSIGNED NULL,
  value_score           TINYINT UNSIGNED NULL,
  impact_score          TINYINT UNSIGNED NULL,
  readiness             TINYINT UNSIGNED NULL,
  progress_pct          TINYINT UNSIGNED NOT NULL DEFAULT 0,
  open_roles            VARCHAR(120) NULL,
  note                  VARCHAR(160) NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_ideas_code (code),
  KEY ix_ideas_status (status),
  CONSTRAINT fk_ideas_department FOREIGN KEY (department_id) REFERENCES departments (id),
  CONSTRAINT fk_ideas_owner FOREIGN KEY (owner_id) REFERENCES employees (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Who worked on which idea (participation = people in any 2026 idea)
CREATE TABLE idea_members (
  idea_id      INT UNSIGNED NOT NULL,
  employee_id  INT UNSIGNED NOT NULL,
  role         ENUM('owner','contributor') NOT NULL,
  PRIMARY KEY (idea_id, employee_id),
  KEY ix_idea_members_employee (employee_id),
  CONSTRAINT fk_idea_members_idea FOREIGN KEY (idea_id) REFERENCES ideas (id),
  CONSTRAINT fk_idea_members_employee FOREIGN KEY (employee_id) REFERENCES employees (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Recognition. kind = 'award' (one of the six categories) or 'kudos' (a simple thank-you).
-- Recognition never changes an EMPULSE Score directly.
CREATE TABLE recognitions (
  id              INT UNSIGNED NOT NULL,
  giver_id        INT UNSIGNED NULL,                    -- NULL when given by a group (giver_name)
  giver_name      VARCHAR(80)  NULL,                    -- e.g. 'Innovation Council'
  receiver_id     INT UNSIGNED NOT NULL,
  kind            ENUM('award','kudos') NOT NULL,
  category        ENUM('Performance Star','Innovation Champion','Collaboration Hero','Digital Pioneer',
                       'Team Supporter','Growth Champion') NULL,
  message         VARCHAR(300) NOT NULL,
  linked_outcome  VARCHAR(160) NULL,                    -- "impact thread"
  is_public       TINYINT(1)   NOT NULL DEFAULT 1,
  created_at      DATE         NOT NULL,
  voices          SMALLINT UNSIGNED NOT NULL DEFAULT 0, -- colleagues who added their voice
  PRIMARY KEY (id),
  KEY ix_recognitions_receiver (receiver_id),
  KEY ix_recognitions_date (created_at),
  CONSTRAINT fk_recognitions_giver FOREIGN KEY (giver_id) REFERENCES employees (id),
  CONSTRAINT fk_recognitions_receiver FOREIGN KEY (receiver_id) REFERENCES employees (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Innovation DNA: seven traits per person (0-100)
CREATE TABLE innovation_dna (
  employee_id         INT UNSIGNED NOT NULL,
  idea_generation     TINYINT UNSIGNED NOT NULL,
  problem_solving     TINYINT UNSIGNED NOT NULL,
  experimentation     TINYINT UNSIGNED NOT NULL,
  collaboration       TINYINT UNSIGNED NOT NULL,
  digital_innovation  TINYINT UNSIGNED NOT NULL,
  implementation      TINYINT UNSIGNED NOT NULL,
  business_impact     TINYINT UNSIGNED NOT NULL,
  PRIMARY KEY (employee_id),
  CONSTRAINT fk_dna_employee FOREIGN KEY (employee_id) REFERENCES employees (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Skills (growth path, marketplace matching)
CREATE TABLE skills (
  id           INT UNSIGNED NOT NULL,
  employee_id  INT UNSIGNED NOT NULL,
  skill        VARCHAR(60)  NOT NULL,
  category     ENUM('Technical','Soft') NOT NULL,
  level        TINYINT UNSIGNED NOT NULL,               -- 1-5
  PRIMARY KEY (id),
  KEY ix_skills_employee (employee_id),
  CONSTRAINT fk_skills_employee FOREIGN KEY (employee_id) REFERENCES employees (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Economic impact FY2026 (H12): transparent assumptions that Finance can change
CREATE TABLE economic_items (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  section     ENUM('component','summary','source') NOT NULL,
  item_key    VARCHAR(30)  NOT NULL,
  label       VARCHAR(80)  NOT NULL,
  value_sar   INT UNSIGNED NOT NULL,
  basis       VARCHAR(160) NOT NULL,                    -- how it is calculated
  sort_order  TINYINT UNSIGNED NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_economic_items (section, item_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
