-- Public x402 Facilitator Schema
-- No API keys, no tenants - just transaction tracking (like PayAI)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Transaction History
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  request_id TEXT UNIQUE NOT NULL,
  idempotency_key TEXT UNIQUE,
  
  -- Payment details
  chain TEXT NOT NULL,
  tx_hash TEXT,
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  asset TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  
  -- Fee breakdown
  fee_amount NUMERIC NOT NULL,
  net_amount NUMERIC NOT NULL,
  fee_bps INTEGER NOT NULL DEFAULT 100,
  
  -- Status tracking
  status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'failed')),
  block_number BIGINT,
  confirmations INTEGER DEFAULT 0,
  error_message TEXT,
  
  -- ChaosChain identity (optional)
  agent_id TEXT,
  evidence_hash TEXT,
  proof_of_agency TEXT,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  settled_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ
);

CREATE INDEX idx_transactions_chain ON transactions(chain);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_agent_id ON transactions(agent_id);
CREATE INDEX idx_transactions_created ON transactions(created_at DESC);
CREATE INDEX idx_transactions_tx_hash ON transactions(tx_hash);

-- Idempotency Store (24h TTL)
CREATE TABLE idempotency_store (
  key TEXT PRIMARY KEY,
  request_hash TEXT NOT NULL,
  response JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_idempotency_created ON idempotency_store(created_at);

-- Nonce Tracking (Replay Protection)
CREATE TABLE payment_nonces (
  payer_address TEXT NOT NULL,
  chain TEXT NOT NULL,
  nonce TEXT NOT NULL,
  valid_after TIMESTAMPTZ,
  valid_before TIMESTAMPTZ,
  used_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (payer_address, chain, nonce)
);

CREATE INDEX idx_nonces_payer ON payment_nonces(payer_address);
CREATE INDEX idx_nonces_used ON payment_nonces(used_at);

-- Cleanup old idempotency records (call periodically)
CREATE OR REPLACE FUNCTION cleanup_old_idempotency()
RETURNS void AS $$
BEGIN
  DELETE FROM idempotency_store 
  WHERE created_at < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;

-- Cleanup old nonces (call periodically)
CREATE OR REPLACE FUNCTION cleanup_old_nonces()
RETURNS void AS $$
BEGIN
  DELETE FROM payment_nonces 
  WHERE used_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;
