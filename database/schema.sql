-- ============================================================
-- Teach-Back AI schema
-- Import via phpMyAdmin (Import tab) or: mysql -u root < schema.sql
-- ============================================================
CREATE DATABASE IF NOT EXISTS teach_back_ai
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE teach_back_ai;

-- 1. USERS -----------------------------------------------------
CREATE TABLE users (
  user_id     INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name        VARCHAR(100) NOT NULL,
  email       VARCHAR(190) NOT NULL,
  password    VARCHAR(255) NOT NULL,            -- password_hash() output
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id),
  UNIQUE KEY uq_users_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. TOPICS ----------------------------------------------------
CREATE TABLE topics (
  topic_id    INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id     INT UNSIGNED NOT NULL,
  subject     VARCHAR(100) NOT NULL,
  topic_name  VARCHAR(150) NOT NULL,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (topic_id),
  UNIQUE KEY uq_topics_user_subject_topic (user_id, subject, topic_name),
  KEY idx_topics_user (user_id),
  CONSTRAINT fk_topics_user FOREIGN KEY (user_id)
    REFERENCES users (user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. TEACH_SESSIONS --------------------------------------------
CREATE TABLE teach_sessions (
  session_id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id              INT UNSIGNED NOT NULL,
  topic_id             INT UNSIGNED NOT NULL,
  persona              ENUM('beginner','kid','skeptic','professor') NOT NULL,
  status               ENUM('active','completed') NOT NULL DEFAULT 'active',
  previous_session_id  INT UNSIGNED NULL,       -- set for re-teach sessions
  started_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ended_at             TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (session_id),
  KEY idx_sessions_user_started (user_id, started_at),
  KEY idx_sessions_topic (topic_id),
  KEY idx_sessions_previous (previous_session_id),
  CONSTRAINT fk_sessions_user  FOREIGN KEY (user_id)
    REFERENCES users (user_id) ON DELETE CASCADE,
  CONSTRAINT fk_sessions_topic FOREIGN KEY (topic_id)
    REFERENCES topics (topic_id) ON DELETE CASCADE,
  CONSTRAINT fk_sessions_previous FOREIGN KEY (previous_session_id)
    REFERENCES teach_sessions (session_id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. MESSAGES --------------------------------------------------
CREATE TABLE messages (
  message_id  INT UNSIGNED NOT NULL AUTO_INCREMENT,
  session_id  INT UNSIGNED NOT NULL,
  sender      ENUM('user','ai') NOT NULL,       -- 'user' = student teacher, 'ai' = AI student
  content     TEXT NOT NULL,
  sent_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (message_id),
  KEY idx_messages_session_sent (session_id, sent_at),
  CONSTRAINT fk_messages_session FOREIGN KEY (session_id)
    REFERENCES teach_sessions (session_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 5. EVALUATIONS (one per session) -----------------------------
-- gaps, misconceptions, missing_concepts, suggestions store JSON arrays
-- as LONGTEXT (MariaDB's JSON type is just an alias for LONGTEXT).
CREATE TABLE evaluations (
  eval_id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  session_id        INT UNSIGNED NOT NULL,
  accuracy          TINYINT UNSIGNED NOT NULL,
  clarity           TINYINT UNSIGNED NOT NULL,
  completeness      TINYINT UNSIGNED NOT NULL,
  examples          TINYINT UNSIGNED NOT NULL,
  overall_score     DECIMAL(3,1) NOT NULL,      -- calculated by PHP: average of 4 scores
  gaps              LONGTEXT NOT NULL,
  misconceptions    LONGTEXT NOT NULL,
  missing_concepts  LONGTEXT NOT NULL,
  suggestions       LONGTEXT NOT NULL,
  summary           TEXT NOT NULL,
  created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (eval_id),
  UNIQUE KEY uq_eval_session (session_id),
  CONSTRAINT fk_eval_session FOREIGN KEY (session_id)
    REFERENCES teach_sessions (session_id) ON DELETE CASCADE,
  CONSTRAINT chk_eval_accuracy     CHECK (accuracy     BETWEEN 0 AND 10),
  CONSTRAINT chk_eval_clarity      CHECK (clarity      BETWEEN 0 AND 10),
  CONSTRAINT chk_eval_completeness CHECK (completeness BETWEEN 0 AND 10),
  CONSTRAINT chk_eval_examples     CHECK (examples     BETWEEN 0 AND 10),
  CONSTRAINT chk_eval_overall      CHECK (overall_score BETWEEN 0 AND 10),
  CONSTRAINT chk_eval_gaps_json    CHECK (JSON_VALID(gaps)),
  CONSTRAINT chk_eval_misc_json    CHECK (JSON_VALID(misconceptions)),
  CONSTRAINT chk_eval_missing_json CHECK (JSON_VALID(missing_concepts)),
  CONSTRAINT chk_eval_sugg_json    CHECK (JSON_VALID(suggestions))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 6. WEAK_AREAS (recurring knowledge gaps) ---------------------
CREATE TABLE weak_areas (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id         INT UNSIGNED NOT NULL,
  topic_id        INT UNSIGNED NOT NULL,
  gap_tag         VARCHAR(40) NOT NULL,         -- normalized: lowercase, trimmed
  times_repeated  INT UNSIGNED NOT NULL DEFAULT 1,
  last_seen_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                  ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_weak_user_topic_tag (user_id, topic_id, gap_tag),
  KEY idx_weak_user (user_id),
  KEY idx_weak_topic (topic_id),
  CONSTRAINT fk_weak_user  FOREIGN KEY (user_id)
    REFERENCES users (user_id) ON DELETE CASCADE,
  CONSTRAINT fk_weak_topic FOREIGN KEY (topic_id)
    REFERENCES topics (topic_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- SUPPORT TABLE: LOGIN RATE LIMITING ---------------------------
CREATE TABLE login_attempts (
  attempt_id    INT UNSIGNED NOT NULL AUTO_INCREMENT,
  email         VARCHAR(190) NOT NULL,
  ip_address    VARCHAR(45)  NOT NULL,
  attempted_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (attempt_id),
  KEY idx_attempts_email_time (email, attempted_at),
  KEY idx_attempts_ip_time (ip_address, attempted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- OPTIONAL (enable only for the video teaching extension) ------
-- CREATE TABLE video_uploads (
--   video_id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
--   user_id            INT UNSIGNED NOT NULL,
--   session_id         INT UNSIGNED NULL,
--   original_name      VARCHAR(255) NOT NULL,
--   stored_name        CHAR(40) NOT NULL,       -- random name, stored outside web root
--   mime_type          VARCHAR(100) NOT NULL,
--   file_size          INT UNSIGNED NOT NULL,
--   transcript         LONGTEXT NULL,
--   status             ENUM('uploaded','processing','transcribed','failed')
--                      NOT NULL DEFAULT 'uploaded',
--   uploaded_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
--   PRIMARY KEY (video_id),
--   UNIQUE KEY uq_video_stored (stored_name),
--   KEY idx_video_user (user_id),
--   CONSTRAINT fk_video_user FOREIGN KEY (user_id)
--     REFERENCES users (user_id) ON DELETE CASCADE,
--   CONSTRAINT fk_video_session FOREIGN KEY (session_id)
--     REFERENCES teach_sessions (session_id) ON DELETE SET NULL
-- ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
