-- Add up migration script here
CREATE TABLE IF NOT EXISTS chains (
  name       VARCHAR NOT NULL,
  block      BIGINT NOT NULL,
  updated_at TIMESTAMP NOT NULL
)
