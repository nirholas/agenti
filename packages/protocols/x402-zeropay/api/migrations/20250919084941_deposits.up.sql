-- Add up migration script here
CREATE TABLE IF NOT EXISTS deposits (
  id             SERIAL PRIMARY KEY,
  customer       INT NOT NULL,
  amount         INT NOT NULL,
  tx             VARCHAR NOT NULL,
  created_at     TIMESTAMP NOT NULL,
  settled_amount INT,
  settled_tx     VARCHAR,
  settled_at     TIMESTAMP
)
