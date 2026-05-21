-- D1 schema for the "request next game" feature.
-- This database is shared between OWdle and Deadlockle (canonical: owdle-votes).
-- One row per (game, voter). voter_hash is sha256(ip + project + 2-day bucket)
-- so we can rate-limit without storing PII; the salt rotates every 2 days,
-- and including `project` lets a single IP cast one vote per site (max 2).
-- `source` records which site the vote came from.

CREATE TABLE IF NOT EXISTS votes (
  game_id      TEXT    NOT NULL,
  voter_hash   TEXT    NOT NULL,
  game_name    TEXT    NOT NULL,
  game_image   TEXT,
  game_released TEXT,
  created_at   INTEGER NOT NULL,
  source       TEXT    NOT NULL DEFAULT 'owdle',
  PRIMARY KEY (game_id, voter_hash)
);

CREATE INDEX IF NOT EXISTS idx_votes_game_id ON votes(game_id);
CREATE INDEX IF NOT EXISTS idx_votes_created_at ON votes(created_at);
CREATE INDEX IF NOT EXISTS idx_votes_source ON votes(source);

-- Free-form user feedback (max 150 chars, server-enforced). Shares the
-- canonical owdle-votes DB so OWdle and Deadlockle write to the same table;
-- `source` distinguishes which site a row came from. submitter_hash uses
-- the same salted+bucketed scheme as voter_hash so we can rate-limit per
-- IP per day without storing PII. The CHECK constraint is defence in depth
-- against a buggy client; the Function also validates length before insert.
CREATE TABLE IF NOT EXISTS feedback (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  body           TEXT    NOT NULL CHECK(length(body) BETWEEN 1 AND 150),
  source         TEXT    NOT NULL,
  submitter_hash TEXT    NOT NULL,
  created_at     INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_feedback_source ON feedback(source);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at);
CREATE INDEX IF NOT EXISTS idx_feedback_submitter ON feedback(submitter_hash, created_at);
