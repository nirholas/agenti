-- Add up migration script here
CREATE TABLE IF NOT EXISTS sessions (
  id         SERIAL PRIMARY KEY,
  customer   INT NOT NULL,
  deposit    INT,
  amount     INT NOT NULL,
  sent       BOOLEAN NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  expired_at TIMESTAMP NOT NULL
)
