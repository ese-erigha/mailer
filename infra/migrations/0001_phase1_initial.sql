CREATE TABLE accounts (
  id TEXT PRIMARY KEY,
  google_sub_claim TEXT NOT NULL UNIQUE,
  gmail_address TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  account_id TEXT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_sessions_account_id ON sessions (account_id);

CREATE TABLE oauth_tokens (
  account_id TEXT PRIMARY KEY REFERENCES accounts (id) ON DELETE CASCADE,
  encrypted_refresh_token BLOB NOT NULL,
  encryption_nonce BLOB NOT NULL,
  consented_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE mailboxes (
  account_id TEXT PRIMARY KEY REFERENCES accounts (id) ON DELETE CASCADE,
  gmail_history_id TEXT NOT NULL,
  gmail_watch_expires_at INTEGER NOT NULL,
  label_id_by_name TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE activities (
  account_id TEXT NOT NULL REFERENCES accounts (id) ON DELETE CASCADE,
  gmail_message_id TEXT NOT NULL,
  gmail_thread_id TEXT NOT NULL,
  email_subject TEXT NOT NULL,
  category TEXT,
  model_confidence REAL,
  mailer_action TEXT NOT NULL,
  model_id TEXT,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  triage_duration_ms INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (account_id, gmail_message_id)
);

CREATE INDEX idx_activities_account_id_created_at ON activities (account_id, created_at);
