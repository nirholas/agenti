package caddyx402

import (
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"
)

func TestSQLiteStore(t *testing.T) {
	dir := t.TempDir()
	dbPath := filepath.Join(dir, "test-payments.db")

	store := NewSQLiteStore(dbPath)
	if err := store.Init(); err != nil {
		t.Fatal(err)
	}
	defer store.Close()

	// Verify the file was created.
	if _, err := os.Stat(dbPath); os.IsNotExist(err) {
		t.Fatal("database file not created")
	}

	// Insert a record.
	rec := PaymentRecord{
		Timestamp:   time.Now(),
		Path:        "/test",
		UserAgent:   "GPTBot/1.0",
		CrawlerName: "GPTBot",
		Payer:       "0xPAYER",
		Amount:      "10000",
		Network:     "base-sepolia",
		TxHash:      "0xTXHASH",
		Success:     true,
		RemoteAddr:  "1.2.3.4:1234",
	}

	if err := store.Record(rec); err != nil {
		t.Fatal(err)
	}

	// Insert a failed record.
	rec2 := PaymentRecord{
		Timestamp:   time.Now(),
		Path:        "/test2",
		UserAgent:   "ClaudeBot/1.0",
		CrawlerName: "ClaudeBot",
		Success:     false,
		ErrorReason: "insufficient_funds",
		RemoteAddr:  "5.6.7.8:5678",
	}

	if err := store.Record(rec2); err != nil {
		t.Fatal(err)
	}

	// Verify records were inserted by querying directly.
	var count int
	err := store.db.QueryRow("SELECT COUNT(*) FROM payments").Scan(&count)
	if err != nil {
		t.Fatal(err)
	}
	if count != 2 {
		t.Errorf("count = %d, want 2", count)
	}
}

func TestSQLiteStore_NotInitialized(t *testing.T) {
	store := NewSQLiteStore("/tmp/does-not-exist.db")
	err := store.Record(PaymentRecord{})
	if err == nil {
		t.Error("expected error when store not initialized")
	}
}

func TestSQLiteStore_CreateDirectory(t *testing.T) {
	dir := t.TempDir()
	dbPath := filepath.Join(dir, "subdir", "nested", "payments.db")

	store := NewSQLiteStore(dbPath)
	if err := store.Init(); err != nil {
		t.Fatal(err)
	}
	defer store.Close()

	if _, err := os.Stat(dbPath); os.IsNotExist(err) {
		t.Fatal("database file not created in nested directory")
	}
}

func TestSQLiteStore_DoubleClose(t *testing.T) {
	dir := t.TempDir()
	store := NewSQLiteStore(filepath.Join(dir, "test.db"))
	if err := store.Init(); err != nil {
		t.Fatal(err)
	}

	if err := store.Close(); err != nil {
		t.Errorf("first close: %v", err)
	}
	if err := store.Close(); err != nil {
		t.Errorf("second close: %v", err)
	}
}

func TestSQLiteStore_RecordAfterClose(t *testing.T) {
	dir := t.TempDir()
	store := NewSQLiteStore(filepath.Join(dir, "test.db"))
	if err := store.Init(); err != nil {
		t.Fatal(err)
	}
	store.Close()

	err := store.Record(PaymentRecord{Timestamp: time.Now()})
	if err == nil {
		t.Error("expected error when recording after close")
	}
}

func TestSQLiteStore_ConcurrentWrites(t *testing.T) {
	dir := t.TempDir()
	store := NewSQLiteStore(filepath.Join(dir, "concurrent.db"))
	if err := store.Init(); err != nil {
		t.Fatal(err)
	}
	defer store.Close()

	const n = 20
	var wg sync.WaitGroup
	errs := make(chan error, n)

	for i := 0; i < n; i++ {
		wg.Add(1)
		go func(i int) {
			defer wg.Done()
			rec := PaymentRecord{
				Timestamp:   time.Now(),
				Path:        "/concurrent",
				UserAgent:   "Bot",
				CrawlerName: "Bot",
				RemoteAddr:  "1.2.3.4:1234",
			}
			if err := store.Record(rec); err != nil {
				errs <- err
			}
		}(i)
	}

	wg.Wait()
	close(errs)

	for err := range errs {
		t.Errorf("concurrent write error: %v", err)
	}

	// Verify all records were inserted.
	var count int
	if err := store.db.QueryRow("SELECT COUNT(*) FROM payments").Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != n {
		t.Errorf("count = %d, want %d", count, n)
	}
}

func TestSQLiteStore_DirectoryPermissions(t *testing.T) {
	dir := t.TempDir()
	subdir := filepath.Join(dir, "restricted")
	dbPath := filepath.Join(subdir, "payments.db")

	store := NewSQLiteStore(dbPath)
	if err := store.Init(); err != nil {
		t.Fatal(err)
	}
	defer store.Close()

	info, err := os.Stat(subdir)
	if err != nil {
		t.Fatal(err)
	}
	perm := info.Mode().Perm()
	if perm != 0700 {
		t.Errorf("directory permissions = %o, want 0700", perm)
	}
}
