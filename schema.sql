DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS aad_users;
DROP TABLE IF EXISTS org_members;
DROP TABLE IF EXISTS users;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('unverified', 'verified', 'unlinked', 'active')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE org_members (
  github_id TEXT PRIMARY KEY,
  org_name TEXT NOT NULL,
  last_verified_at DATETIME NOT NULL
);

CREATE TABLE aad_users (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  aad_id TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);