-- Add up migration script here
CREATE TABLE IF NOT EXISTS customers (
  id         SERIAL PRIMARY KEY,
  account    VARCHAR NOT NULL,
  eth        VARCHAR NOT NULL UNIQUE,
  updated_at TIMESTAMP NOT NULL
)
