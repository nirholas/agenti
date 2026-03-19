package caddyx402

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"sync"

	_ "modernc.org/sqlite"
)

// SQLiteStore implements PaymentStore using pure-Go SQLite.
type SQLiteStore struct {
	db     *sql.DB
	path   string
	mu     sync.Mutex
	closed bool
}

// NewSQLiteStore creates a new SQLite-backed payment store.
func NewSQLiteStore(dbPath string) *SQLiteStore {
	return &SQLiteStore{path: dbPath}
}

// Init opens the database and creates the payments table if needed.
func (s *SQLiteStore) Init() error {
	// Ensure parent directory exists with restricted permissions.
	dir := filepath.Dir(s.path)
	if err := os.MkdirAll(dir, 0700); err != nil {
		return fmt.Errorf("create db directory %s: %w", dir, err)
	}

	db, err := sql.Open("sqlite", s.path)
	if err != nil {
		return fmt.Errorf("open sqlite %s: %w", s.path, err)
	}

	// SQLite supports only one writer at a time. Limit connections to avoid SQLITE_BUSY.
	db.SetMaxOpenConns(1)

	// Enable WAL mode for better concurrent read performance.
	if _, err := db.Exec("PRAGMA journal_mode=WAL"); err != nil {
		db.Close()
		return fmt.Errorf("set WAL mode: %w", err)
	}

	// Set busy timeout to wait instead of failing immediately on contention.
	if _, err := db.Exec("PRAGMA busy_timeout=5000"); err != nil {
		db.Close()
		return fmt.Errorf("set busy timeout: %w", err)
	}

	// Create payments table.
	createSQL := `
	CREATE TABLE IF NOT EXISTS payments (
		id           INTEGER PRIMARY KEY AUTOINCREMENT,
		timestamp    DATETIME NOT NULL,
		path         TEXT NOT NULL,
		user_agent   TEXT NOT NULL,
		crawler_name TEXT NOT NULL DEFAULT '',
		payer        TEXT NOT NULL DEFAULT '',
		amount       TEXT NOT NULL DEFAULT '0',
		network      TEXT NOT NULL DEFAULT '',
		tx_hash      TEXT NOT NULL DEFAULT '',
		success      BOOLEAN NOT NULL DEFAULT 0,
		error_reason TEXT NOT NULL DEFAULT '',
		remote_addr  TEXT NOT NULL DEFAULT '',
		dry_run      BOOLEAN NOT NULL DEFAULT 0
	);
	CREATE INDEX IF NOT EXISTS idx_payments_timestamp ON payments(timestamp);
	CREATE INDEX IF NOT EXISTS idx_payments_payer ON payments(payer);
	CREATE INDEX IF NOT EXISTS idx_payments_tx_hash ON payments(tx_hash);
	`

	if _, err := db.Exec(createSQL); err != nil {
		db.Close()
		return fmt.Errorf("create payments table: %w", err)
	}

	s.db = db
	return nil
}

// Record inserts a payment record into the database.
func (s *SQLiteStore) Record(rec PaymentRecord) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.db == nil || s.closed {
		return fmt.Errorf("store not initialized or already closed")
	}

	_, err := s.db.Exec(`
		INSERT INTO payments (timestamp, path, user_agent, crawler_name, payer, amount, network, tx_hash, success, error_reason, remote_addr, dry_run)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		rec.Timestamp.UTC(), rec.Path, rec.UserAgent, rec.CrawlerName, rec.Payer, rec.Amount,
		rec.Network, rec.TxHash, rec.Success, rec.ErrorReason, rec.RemoteAddr, rec.DryRun,
	)
	if err != nil {
		return fmt.Errorf("insert payment record: %w", err)
	}
	return nil
}

// Close closes the database connection. Safe to call multiple times.
func (s *SQLiteStore) Close() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.db != nil && !s.closed {
		s.closed = true
		return s.db.Close()
	}
	return nil
}
