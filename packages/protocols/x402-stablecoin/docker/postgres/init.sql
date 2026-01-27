-- X402 PostgreSQL Initialization Script
-- 
-- Creates tables for yield tracking and analytics

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- Yield Tracking Tables
-- ============================================

-- Wallet yield balances
CREATE TABLE IF NOT EXISTS yield_balances (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_address VARCHAR(42) NOT NULL,
    balance_usds DECIMAL(78, 18) NOT NULL DEFAULT 0,
    accrued_yield DECIMAL(78, 18) NOT NULL DEFAULT 0,
    last_yield_update TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(wallet_address)
);

-- Yield history records
CREATE TABLE IF NOT EXISTS yield_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    wallet_address VARCHAR(42) NOT NULL,
    amount DECIMAL(78, 18) NOT NULL,
    apy DECIMAL(10, 6) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    block_number BIGINT,
    tx_hash VARCHAR(66),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- Payment Tracking Tables
-- ============================================

-- Payment records
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_id VARCHAR(66) UNIQUE NOT NULL,
    payer_address VARCHAR(42) NOT NULL,
    recipient_address VARCHAR(42) NOT NULL,
    amount DECIMAL(78, 18) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    network VARCHAR(20) NOT NULL DEFAULT 'arbitrum-sepolia',
    tx_hash VARCHAR(66),
    block_number BIGINT,
    settled_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payment settlements
CREATE TABLE IF NOT EXISTS settlements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    payment_id VARCHAR(66) REFERENCES payments(payment_id),
    tx_hash VARCHAR(66) NOT NULL,
    gas_used BIGINT,
    gas_price DECIMAL(78, 0),
    status VARCHAR(20) NOT NULL,
    error_message TEXT,
    settled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- Tool Registry Tables
-- ============================================

-- Registered tools
CREATE TABLE IF NOT EXISTS tools (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tool_id VARCHAR(66) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    creator_address VARCHAR(42) NOT NULL,
    price_per_call DECIMAL(78, 18) NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    total_calls BIGINT DEFAULT 0,
    total_revenue DECIMAL(78, 18) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tool usage records
CREATE TABLE IF NOT EXISTS tool_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tool_id VARCHAR(66) REFERENCES tools(tool_id),
    user_address VARCHAR(42) NOT NULL,
    payment_id VARCHAR(66) REFERENCES payments(payment_id),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- Indexes
-- ============================================

CREATE INDEX IF NOT EXISTS idx_yield_balances_wallet ON yield_balances(wallet_address);
CREATE INDEX IF NOT EXISTS idx_yield_history_wallet ON yield_history(wallet_address);
CREATE INDEX IF NOT EXISTS idx_yield_history_timestamp ON yield_history(timestamp);
CREATE INDEX IF NOT EXISTS idx_payments_payer ON payments(payer_address);
CREATE INDEX IF NOT EXISTS idx_payments_recipient ON payments(recipient_address);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created ON payments(created_at);
CREATE INDEX IF NOT EXISTS idx_settlements_payment ON settlements(payment_id);
CREATE INDEX IF NOT EXISTS idx_tools_creator ON tools(creator_address);
CREATE INDEX IF NOT EXISTS idx_tool_usage_tool ON tool_usage(tool_id);
CREATE INDEX IF NOT EXISTS idx_tool_usage_user ON tool_usage(user_address);

-- ============================================
-- Functions
-- ============================================

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers
CREATE TRIGGER update_yield_balances_updated_at
    BEFORE UPDATE ON yield_balances
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at
    BEFORE UPDATE ON payments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tools_updated_at
    BEFORE UPDATE ON tools
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Initial Data (Optional)
-- ============================================

-- Add a welcome message to verify initialization
INSERT INTO yield_balances (wallet_address, balance_usds, accrued_yield)
VALUES ('0x0000000000000000000000000000000000000000', 0, 0)
ON CONFLICT (wallet_address) DO NOTHING;

-- Cleanup the test row
DELETE FROM yield_balances WHERE wallet_address = '0x0000000000000000000000000000000000000000';

COMMENT ON DATABASE x402 IS 'X402 Protocol Database - Yield tracking, payments, and tool registry';
