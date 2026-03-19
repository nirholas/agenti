package caddyx402

import "time"

// PaymentRecord represents a single payment event in the audit trail.
type PaymentRecord struct {
	ID          int64     `json:"id"`
	Timestamp   time.Time `json:"timestamp"`
	Path        string    `json:"path"`
	UserAgent   string    `json:"user_agent"`
	CrawlerName string    `json:"crawler_name"`
	Payer       string    `json:"payer"`
	Amount      string    `json:"amount"`
	Network     string    `json:"network"`
	TxHash      string    `json:"tx_hash"`
	Success     bool      `json:"success"`
	ErrorReason string    `json:"error_reason,omitempty"`
	RemoteAddr  string    `json:"remote_addr"`
	DryRun      bool      `json:"dry_run"`
}

// PaymentStore is the interface for persisting payment audit records.
type PaymentStore interface {
	// Init sets up the store (create tables, etc.).
	Init() error

	// Record inserts a payment record.
	Record(rec PaymentRecord) error

	// Close shuts down the store.
	Close() error
}
