-- OpenBare Registry Database Schema

-- Nodes table: stores all registered bare server nodes
CREATE TABLE IF NOT EXISTS nodes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL UNIQUE,
    region TEXT NOT NULL,
    owner TEXT NOT NULL,
    contact TEXT,
    registered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_heartbeat DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'pending' CHECK(status IN ('healthy', 'unhealthy', 'pending')),
    avg_latency REAL DEFAULT NULL,
    total_checks INTEGER DEFAULT 0,
    successful_checks INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index for fast region filtering
CREATE INDEX IF NOT EXISTS idx_nodes_region ON nodes(region);

-- Index for status filtering (healthy nodes lookup)
CREATE INDEX IF NOT EXISTS idx_nodes_status ON nodes(status);

-- Index for latency sorting
CREATE INDEX IF NOT EXISTS idx_nodes_latency ON nodes(avg_latency);

-- Index for heartbeat expiry checks
CREATE INDEX IF NOT EXISTS idx_nodes_heartbeat ON nodes(last_heartbeat);

-- Combined index for common query pattern (healthy + region)
CREATE INDEX IF NOT EXISTS idx_nodes_status_region ON nodes(status, region);

-- Rate limiting table for registration attempts
CREATE TABLE IF NOT EXISTS rate_limits (
    ip TEXT PRIMARY KEY,
    attempts INTEGER DEFAULT 1,
    first_attempt DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_attempt DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Index for cleanup of old rate limit entries
CREATE INDEX IF NOT EXISTS idx_rate_limits_first_attempt ON rate_limits(first_attempt);

-- Health check history for analytics
CREATE TABLE IF NOT EXISTS health_checks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    node_id INTEGER NOT NULL,
    checked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    latency_ms REAL,
    success INTEGER NOT NULL,
    error_message TEXT,
    FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
);

-- Index for node health history lookup
CREATE INDEX IF NOT EXISTS idx_health_checks_node ON health_checks(node_id);

-- Index for time-based cleanup
CREATE INDEX IF NOT EXISTS idx_health_checks_time ON health_checks(checked_at);

-- Network statistics table (aggregated daily)
CREATE TABLE IF NOT EXISTS network_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date DATE NOT NULL UNIQUE,
    total_nodes INTEGER DEFAULT 0,
    healthy_nodes INTEGER DEFAULT 0,
    total_checks INTEGER DEFAULT 0,
    successful_checks INTEGER DEFAULT 0,
    avg_latency REAL,
    regions_active INTEGER DEFAULT 0
);

-- Index for date lookup
CREATE INDEX IF NOT EXISTS idx_network_stats_date ON network_stats(date);

-- Trigger to update updated_at timestamp
CREATE TRIGGER IF NOT EXISTS update_nodes_timestamp 
AFTER UPDATE ON nodes
BEGIN
    UPDATE nodes SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
