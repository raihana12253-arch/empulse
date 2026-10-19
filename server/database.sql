-- =====================================================================
-- server/database.sql — EMPULSE database (MySQL)
-- Import once: phpMyAdmin > Import > choose this file > Go.
-- Safe to import again (it does not create duplicates).
-- Now: the users table + the demo accounts.
-- The data tables (employees, weekly_metrics, ...) are added in the data step.
-- =====================================================================

CREATE DATABASE IF NOT EXISTS empulse
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE empulse;

-- Accounts that can sign in. One row per person who uses the app.
-- employee_id links to employees.id (foreign key added in the data step).
CREATE TABLE IF NOT EXISTS users (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  email          VARCHAR(190) NOT NULL,                 -- stored in lower case
  password_hash  VARCHAR(255) NOT NULL,                 -- PHP password_hash() (bcrypt), never the real password
  role           ENUM('employee','manager','hr','executive','admin') NOT NULL,
  full_name      VARCHAR(120) NOT NULL,
  employee_id    INT UNSIGNED NULL,                     -- link to the person in employees (data step)
  is_active      TINYINT(1)   NOT NULL DEFAULT 1,
  last_login_at  DATETIME     NULL,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_email (email),
  KEY ix_users_role (role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Demo accounts. Password for all: empulse123
-- password_hash is the encrypted form made by PHP password_hash(); the real password is never stored.
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
