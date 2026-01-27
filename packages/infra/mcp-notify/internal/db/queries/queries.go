// Package queries contains SQL query constants and builders.
// Queries are currently embedded in the postgres.go implementation.
// This package can be extended with query builders or sqlc-generated code.

package queries

// Query constants for common operations.
// These are provided for reference; the actual queries are in postgres.go.

const (
	// SelectActiveSubscriptions retrieves all active subscriptions with their channels.
	SelectActiveSubscriptions = `
		SELECT s.id, s.name, s.description, s.filters, s.status, 
		       s.api_key_hash, s.api_key_hint, s.notification_count,
		       s.last_reset, s.last_notified, s.created_at, s.updated_at
		FROM subscriptions s
		WHERE s.status = 'active'
		ORDER BY s.created_at DESC
	`

	// SelectSubscriptionByID retrieves a subscription by its UUID.
	SelectSubscriptionByID = `
		SELECT id, name, description, filters, status, api_key_hash, api_key_hint,
		       notification_count, last_reset, last_notified, created_at, updated_at
		FROM subscriptions
		WHERE id = $1
	`

	// InsertChange inserts a new detected change.
	InsertChange = `
		INSERT INTO changes (id, server_name, change_type, previous_snapshot_id, 
		                     new_snapshot_id, field_changes, detected_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`

	// SelectRecentChanges retrieves changes within a time window.
	SelectRecentChanges = `
		SELECT id, server_name, change_type, previous_snapshot_id, 
		       new_snapshot_id, field_changes, detected_at
		FROM changes
		WHERE detected_at >= $1
		ORDER BY detected_at DESC
		LIMIT $2
	`
)
