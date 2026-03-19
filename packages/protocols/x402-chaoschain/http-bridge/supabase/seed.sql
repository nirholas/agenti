-- Seed data for ChaosChain x402 Facilitator
-- Public service - no tenants or API keys needed!

-- This file intentionally minimal - the facilitator is a public service.
-- Just verify tables were created:

SELECT 
  table_name 
FROM 
  information_schema.tables 
WHERE 
  table_schema = 'public' 
  AND table_name IN ('transactions', 'idempotency_store', 'payment_nonces');

-- Expected output: 3 tables
