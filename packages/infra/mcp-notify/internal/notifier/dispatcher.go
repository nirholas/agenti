// Package notifier provides notification dispatching to various channels.
package notifier

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog/log"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/metric"
	"go.opentelemetry.io/otel/trace"
	"golang.org/x/sync/semaphore"

	"github.com/nirholas/mcp-notify/internal/config"
	"github.com/nirholas/mcp-notify/internal/db"
	"github.com/nirholas/mcp-notify/internal/notifier/discord"
	"github.com/nirholas/mcp-notify/internal/notifier/email"
	"github.com/nirholas/mcp-notify/internal/notifier/slack"
	"github.com/nirholas/mcp-notify/internal/notifier/teams"
	"github.com/nirholas/mcp-notify/internal/notifier/telegram"
	"github.com/nirholas/mcp-notify/internal/notifier/webhook"
	"github.com/nirholas/mcp-notify/pkg/types"
)

var (
	tracer = otel.Tracer("notifier")
	meter  = otel.Meter("notifier")
)

// Common errors
var (
	ErrCircuitOpen     = errors.New("circuit breaker is open")
	ErrNoSender        = errors.New("no sender registered for channel type")
	ErrMaxRetriesExceeded = errors.New("maximum retries exceeded")
)

// Sender is the interface for notification senders.
type Sender interface {
	Send(ctx context.Context, channel *types.Channel, change *types.Change) error
	Type() types.ChannelType
}

// CircuitBreaker implements the circuit breaker pattern to prevent
// hammering failed notification channels.
type CircuitBreaker struct {
	mu            sync.RWMutex
	failures      int
	successes     int
	lastFailure   time.Time
	state         CircuitState
	threshold     int           // Failures to open circuit
	timeout       time.Duration // Time to wait before half-open
	successThreshold int        // Successes needed to close circuit
}

// CircuitState represents the state of the circuit breaker.
type CircuitState int

const (
	CircuitClosed CircuitState = iota
	CircuitOpen
	CircuitHalfOpen
)

// NewCircuitBreaker creates a new circuit breaker.
func NewCircuitBreaker(threshold int, timeout time.Duration) *CircuitBreaker {
	return &CircuitBreaker{
		threshold:        threshold,
		timeout:          timeout,
		successThreshold: 3,
		state:            CircuitClosed,
	}
}

// Allow checks if the circuit allows a request.
func (cb *CircuitBreaker) Allow() bool {
	cb.mu.RLock()
	defer cb.mu.RUnlock()

	switch cb.state {
	case CircuitClosed:
		return true
	case CircuitOpen:
		// Check if timeout has passed
		if time.Since(cb.lastFailure) > cb.timeout {
			return true // Allow one request (will transition to half-open)
		}
		return false
	case CircuitHalfOpen:
		return true
	}
	return false
}

// RecordSuccess records a successful request.
func (cb *CircuitBreaker) RecordSuccess() {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	cb.successes++
	cb.failures = 0

	if cb.state == CircuitHalfOpen && cb.successes >= cb.successThreshold {
		cb.state = CircuitClosed
		cb.successes = 0
		log.Info().Msg("Circuit breaker closed")
	}
}

// RecordFailure records a failed request.
func (cb *CircuitBreaker) RecordFailure() {
	cb.mu.Lock()
	defer cb.mu.Unlock()

	cb.failures++
	cb.successes = 0
	cb.lastFailure = time.Now()

	if cb.state == CircuitClosed && cb.failures >= cb.threshold {
		cb.state = CircuitOpen
		log.Warn().Int("failures", cb.failures).Msg("Circuit breaker opened")
	} else if cb.state == CircuitHalfOpen {
		cb.state = CircuitOpen
		log.Warn().Msg("Circuit breaker reopened from half-open")
	}
}

// State returns the current state of the circuit breaker.
func (cb *CircuitBreaker) State() CircuitState {
	cb.mu.RLock()
	defer cb.mu.RUnlock()
	return cb.state
}

// RetryItem represents an item in the retry queue.
type RetryItem struct {
	ChannelID    string
	ChangeID     string
	Attempts     int
	NextRetry    time.Time
	MaxAttempts  int
	LastError    string
}

// Dispatcher routes notifications to the appropriate sender.
type Dispatcher struct {
	senders         map[types.ChannelType]Sender
	circuitBreakers map[string]*CircuitBreaker // Per-channel circuit breakers
	database        db.Database
	sem             *semaphore.Weighted
	mu              sync.RWMutex
	retryQueue      []RetryItem
	retryMu         sync.Mutex

	// Configuration
	maxRetries        int
	baseRetryDelay    time.Duration
	maxConcurrent     int64
	circuitThreshold  int
	circuitTimeout    time.Duration

	// Metrics
	notificationsSent   metric.Int64Counter
	notificationsFailed metric.Int64Counter
	notificationLatency metric.Float64Histogram
	circuitOpened       metric.Int64Counter
	retryQueueSize      metric.Int64Gauge
}

// NewDispatcher creates a new notification dispatcher.
func NewDispatcher(cfg config.NotificationsConfig, database db.Database) (*Dispatcher, error) {
	d := &Dispatcher{
		senders:          make(map[types.ChannelType]Sender),
		circuitBreakers:  make(map[string]*CircuitBreaker),
		database:         database,
		sem:              semaphore.NewWeighted(100), // Max 100 concurrent notifications
		retryQueue:       make([]RetryItem, 0),
		maxRetries:       5,
		baseRetryDelay:   time.Second * 5,
		maxConcurrent:    100,
		circuitThreshold: 5,
		circuitTimeout:   time.Minute * 5,
	}

	// Initialize senders based on config
	if cfg.Discord.Enabled {
		d.senders[types.ChannelDiscord] = discord.NewSender(discord.Config{
			RateLimit:     cfg.Discord.RateLimit,
			RetryAttempts: cfg.Discord.RetryAttempts,
			RetryDelay:    cfg.Discord.RetryDelay,
		})
	}

	if cfg.Slack.Enabled {
		d.senders[types.ChannelSlack] = slack.NewSender(slack.Config{
			RateLimit:     cfg.Slack.RateLimit,
			RetryAttempts: cfg.Slack.RetryAttempts,
			RetryDelay:    cfg.Slack.RetryDelay,
		})
	}

	if cfg.Email.Enabled {
		emailSender, err := email.NewSender(email.Config{
			SMTPHost:      cfg.Email.SMTP.Host,
			SMTPPort:      cfg.Email.SMTP.Port,
			SMTPUsername:  cfg.Email.SMTP.Username,
			SMTPPassword:  cfg.Email.SMTP.Password,
			FromAddress:   cfg.Email.SMTP.From,
			TLS:           cfg.Email.SMTP.TLS,
			RetryAttempts: cfg.Email.RetryAttempts,
			RetryDelay:    cfg.Email.RetryDelay,
		})
		if err != nil {
			return nil, fmt.Errorf("failed to create email sender: %w", err)
		}
		d.senders[types.ChannelEmail] = emailSender
	}

	if cfg.Webhook.Enabled {
		d.senders[types.ChannelWebhook] = webhook.NewSender(webhook.Config{
			Timeout:       cfg.Webhook.Timeout,
			RetryAttempts: cfg.Webhook.RetryAttempts,
			RetryDelay:    cfg.Webhook.RetryDelay,
			MaxBodySize:   cfg.Webhook.MaxBodySize,
		})
	}

	// Initialize Telegram sender (always enabled, requires config per channel)
	d.senders[types.ChannelTelegram] = telegram.NewSender(telegram.Config{
		RetryAttempts: 3,
		RetryDelay:    time.Second * 2,
	})

	// Initialize Teams sender (always enabled, requires config per channel)
	d.senders[types.ChannelTeams] = teams.NewSender(teams.Config{
		RetryAttempts: 3,
		RetryDelay:    time.Second * 2,
	})

	// Initialize metrics
	d.initMetrics()

	log.Info().
		Int("sender_count", len(d.senders)).
		Msg("Notification dispatcher initialized")

	return d, nil
}

func (d *Dispatcher) initMetrics() {
	var err error

	d.notificationsSent, err = meter.Int64Counter("notifications.sent.total",
		metric.WithDescription("Total notifications sent successfully"),
	)
	if err != nil {
		log.Warn().Err(err).Msg("Failed to create notifications sent metric")
	}

	d.notificationsFailed, err = meter.Int64Counter("notifications.failed.total",
		metric.WithDescription("Total notifications that failed to send"),
	)
	if err != nil {
		log.Warn().Err(err).Msg("Failed to create notifications failed metric")
	}

	d.notificationLatency, err = meter.Float64Histogram("notifications.latency_seconds",
		metric.WithDescription("Notification sending latency in seconds"),
	)
	if err != nil {
		log.Warn().Err(err).Msg("Failed to create notification latency metric")
	}
}

// Dispatch sends a notification for a change through a channel.
func (d *Dispatcher) Dispatch(ctx context.Context, channel *types.Channel, change *types.Change) error {
	ctx, span := tracer.Start(ctx, "Dispatch",
		trace.WithAttributes(
			attribute.String("channel_type", string(channel.Type)),
			attribute.String("server_name", change.ServerName),
		),
	)
	defer span.End()

	// Acquire semaphore to limit concurrency
	if err := d.sem.Acquire(ctx, 1); err != nil {
		return fmt.Errorf("failed to acquire semaphore: %w", err)
	}
	defer d.sem.Release(1)

	start := time.Now()
	defer func() {
		if d.notificationLatency != nil {
			d.notificationLatency.Record(ctx, time.Since(start).Seconds(),
				metric.WithAttributes(attribute.String("channel_type", string(channel.Type))),
			)
		}
	}()

	// Get sender for channel type
	d.mu.RLock()
	sender, ok := d.senders[channel.Type]
	d.mu.RUnlock()

	if !ok {
		return fmt.Errorf("no sender registered for channel type: %s", channel.Type)
	}

	// Create notification record
	notification := &types.Notification{
		SubscriptionID: channel.SubscriptionID,
		ChannelID:      channel.ID,
		ChangeID:       change.ID,
		Status:         "pending",
		CreatedAt:      time.Now().UTC(),
	}

	// Save notification record
	if err := d.database.SaveNotification(ctx, notification); err != nil {
		log.Error().Err(err).Msg("Failed to save notification record")
	}

	// Send notification
	err := sender.Send(ctx, channel, change)

	// Update notification status
	if err != nil {
		notification.Status = "failed"
		notification.Error = err.Error()
		notification.Attempts++
		if d.notificationsFailed != nil {
			d.notificationsFailed.Add(ctx, 1,
				metric.WithAttributes(attribute.String("channel_type", string(channel.Type))),
			)
		}
		span.RecordError(err)

		log.Error().
			Err(err).
			Str("channel_type", string(channel.Type)).
			Str("server_name", change.ServerName).
			Msg("Failed to send notification")
	} else {
		notification.Status = "sent"
		now := time.Now().UTC()
		notification.SentAt = &now
		if d.notificationsSent != nil {
			d.notificationsSent.Add(ctx, 1,
				metric.WithAttributes(attribute.String("channel_type", string(channel.Type))),
			)
		}

		log.Debug().
			Str("channel_type", string(channel.Type)).
			Str("server_name", change.ServerName).
			Msg("Notification sent successfully")
	}

	// Update notification record
	if updateErr := d.database.UpdateNotification(ctx, notification); updateErr != nil {
		log.Error().Err(updateErr).Msg("Failed to update notification record")
	}

	// Update channel stats
	if err := d.updateChannelStats(ctx, channel, err == nil); err != nil {
		log.Error().Err(err).Msg("Failed to update channel stats")
	}

	return err
}

// DispatchBatch sends notifications for multiple changes.
func (d *Dispatcher) DispatchBatch(ctx context.Context, channel *types.Channel, changes []*types.Change) error {
	ctx, span := tracer.Start(ctx, "DispatchBatch",
		trace.WithAttributes(
			attribute.String("channel_type", string(channel.Type)),
			attribute.Int("change_count", len(changes)),
		),
	)
	defer span.End()

	var lastErr error
	for _, change := range changes {
		if err := d.Dispatch(ctx, channel, change); err != nil {
			lastErr = err
			// Continue with other changes even if one fails
		}
	}

	return lastErr
}

// updateChannelStats updates the channel's delivery statistics.
func (d *Dispatcher) updateChannelStats(ctx context.Context, channel *types.Channel, success bool) error {
	now := time.Now().UTC()
	if success {
		channel.SuccessCount++
		channel.LastSuccess = &now
	} else {
		channel.FailureCount++
		channel.LastFailure = &now
	}

	return d.database.UpdateChannel(ctx, channel)
}

// GetSupportedChannels returns the list of enabled channel types.
func (d *Dispatcher) GetSupportedChannels() []types.ChannelType {
	d.mu.RLock()
	defer d.mu.RUnlock()

	channels := make([]types.ChannelType, 0, len(d.senders))
	for ct := range d.senders {
		channels = append(channels, ct)
	}
	return channels
}

// TestChannel sends a test notification to verify channel configuration.
func (d *Dispatcher) TestChannel(ctx context.Context, channel *types.Channel) error {
	testChange := &types.Change{
		ServerName: "test/mcp-server",
		ChangeType: types.ChangeTypeNew,
		NewVersion: "1.0.0",
		Server: &types.Server{
			Name:        "test/mcp-server",
			Description: "This is a test notification from MCP Notify",
		},
		DetectedAt: time.Now().UTC(),
	}

	return d.Dispatch(ctx, channel, testChange)
}

// DispatchBatchByChannel sends batched notifications for multiple changes to a single channel.
// This is more efficient than individual dispatches for bulk operations.
func (d *Dispatcher) DispatchBatchByChannel(ctx context.Context, channel *types.Channel, changes []types.Change) error {
	ctx, span := tracer.Start(ctx, "DispatchBatchByChannel",
		trace.WithAttributes(
			attribute.String("channel_type", string(channel.Type)),
			attribute.Int("change_count", len(changes)),
		),
	)
	defer span.End()

	if len(changes) == 0 {
		return nil
	}

	// Check circuit breaker for this channel
	cb := d.getCircuitBreaker(channel.ID.String())
	if !cb.Allow() {
		return ErrCircuitOpen
	}

	var successCount, failCount int
	var lastErr error

	for i := range changes {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		if err := d.Dispatch(ctx, channel, &changes[i]); err != nil {
			failCount++
			lastErr = err
			cb.RecordFailure()
		} else {
			successCount++
			cb.RecordSuccess()
		}
	}

	log.Info().
		Str("channel_id", channel.ID.String()).
		Int("success", successCount).
		Int("failed", failCount).
		Msg("Batch dispatch completed")

	return lastErr
}

// getCircuitBreaker gets or creates a circuit breaker for a channel.
func (d *Dispatcher) getCircuitBreaker(channelID string) *CircuitBreaker {
	d.mu.Lock()
	defer d.mu.Unlock()

	if cb, exists := d.circuitBreakers[channelID]; exists {
		return cb
	}

	cb := NewCircuitBreaker(d.circuitThreshold, d.circuitTimeout)
	d.circuitBreakers[channelID] = cb
	return cb
}

// EnqueueRetry adds a failed notification to the retry queue.
func (d *Dispatcher) EnqueueRetry(channelID, changeID string, err error) {
	d.retryMu.Lock()
	defer d.retryMu.Unlock()

	// Calculate next retry time with exponential backoff
	attempts := 1
	for _, item := range d.retryQueue {
		if item.ChannelID == channelID && item.ChangeID == changeID {
			attempts = item.Attempts + 1
			break
		}
	}

	// Exponential backoff: 5s, 10s, 20s, 40s, 80s
	delay := d.baseRetryDelay * time.Duration(1<<uint(attempts-1))
	if delay > time.Hour {
		delay = time.Hour // Cap at 1 hour
	}

	item := RetryItem{
		ChannelID:   channelID,
		ChangeID:    changeID,
		Attempts:    attempts,
		NextRetry:   time.Now().Add(delay),
		MaxAttempts: d.maxRetries,
		LastError:   err.Error(),
	}

	// Remove existing entry for same channel/change and add new one
	newQueue := make([]RetryItem, 0, len(d.retryQueue)+1)
	for _, existing := range d.retryQueue {
		if existing.ChannelID != channelID || existing.ChangeID != changeID {
			newQueue = append(newQueue, existing)
		}
	}
	newQueue = append(newQueue, item)
	d.retryQueue = newQueue

	log.Debug().
		Str("channel_id", channelID).
		Str("change_id", changeID).
		Int("attempts", attempts).
		Time("next_retry", item.NextRetry).
		Msg("Enqueued notification for retry")
}

// ProcessRetryQueue processes items in the retry queue that are ready for retry.
func (d *Dispatcher) ProcessRetryQueue(ctx context.Context) error {
	d.retryMu.Lock()
	now := time.Now()
	var readyItems []RetryItem
	var remainingItems []RetryItem

	for _, item := range d.retryQueue {
		if now.After(item.NextRetry) {
			readyItems = append(readyItems, item)
		} else {
			remainingItems = append(remainingItems, item)
		}
	}
	d.retryQueue = remainingItems
	d.retryMu.Unlock()

	if len(readyItems) == 0 {
		return nil
	}

	log.Info().Int("count", len(readyItems)).Msg("Processing retry queue")

	var deadLetterItems []RetryItem

	for _, item := range readyItems {
		select {
		case <-ctx.Done():
			// Re-add items that weren't processed
			d.retryMu.Lock()
			d.retryQueue = append(d.retryQueue, readyItems...)
			d.retryMu.Unlock()
			return ctx.Err()
		default:
		}

		// Load channel and change from database
		channelID, _ := parseUUID(item.ChannelID)
		changeID, _ := parseUUID(item.ChangeID)

		channel, err := d.database.GetChannelByID(ctx, channelID)
		if err != nil || channel == nil {
			log.Error().Str("channel_id", item.ChannelID).Msg("Failed to load channel for retry")
			continue
		}

		change, err := d.database.GetChangeByID(ctx, changeID)
		if err != nil || change == nil {
			log.Error().Str("change_id", item.ChangeID).Msg("Failed to load change for retry")
			continue
		}

		// Attempt to send
		err = d.Dispatch(ctx, channel, change)
		if err != nil {
			if item.Attempts >= item.MaxAttempts {
				log.Error().
					Str("channel_id", item.ChannelID).
					Str("change_id", item.ChangeID).
					Int("attempts", item.Attempts).
					Err(err).
					Msg("Maximum retries exceeded, moving to dead letter")
				deadLetterItems = append(deadLetterItems, item)
			} else {
				// Re-enqueue with incremented attempts
				d.EnqueueRetry(item.ChannelID, item.ChangeID, err)
			}
		} else {
			log.Info().
				Str("channel_id", item.ChannelID).
				Str("change_id", item.ChangeID).
				Int("attempts", item.Attempts).
				Msg("Retry successful")
		}
	}

	// Save dead letter items (failed permanently)
	for _, item := range deadLetterItems {
		if err := d.saveToDeadLetter(ctx, item); err != nil {
			log.Error().Err(err).Msg("Failed to save to dead letter queue")
		}
	}

	return nil
}

// saveToDeadLetter saves a permanently failed notification to the dead letter queue.
func (d *Dispatcher) saveToDeadLetter(ctx context.Context, item RetryItem) error {
	// Update notification status to failed permanently
	channelID, _ := parseUUID(item.ChannelID)
	changeID, _ := parseUUID(item.ChangeID)

	notification := &types.Notification{
		ChannelID: channelID,
		ChangeID:  changeID,
		Status:    "dead_letter",
		Attempts:  item.Attempts,
		Error:     item.LastError,
	}

	return d.database.UpdateNotification(ctx, notification)
}

// GetRetryQueueSize returns the current size of the retry queue.
func (d *Dispatcher) GetRetryQueueSize() int {
	d.retryMu.Lock()
	defer d.retryMu.Unlock()
	return len(d.retryQueue)
}

// ClearRetryQueue clears the retry queue.
func (d *Dispatcher) ClearRetryQueue() {
	d.retryMu.Lock()
	defer d.retryMu.Unlock()
	d.retryQueue = make([]RetryItem, 0)
}

// DispatchWithCircuitBreaker sends a notification with circuit breaker protection.
func (d *Dispatcher) DispatchWithCircuitBreaker(ctx context.Context, channel *types.Channel, change *types.Change) error {
	cb := d.getCircuitBreaker(channel.ID.String())

	if !cb.Allow() {
		log.Warn().
			Str("channel_id", channel.ID.String()).
			Msg("Circuit breaker open, skipping notification")
		return ErrCircuitOpen
	}

	err := d.Dispatch(ctx, channel, change)
	if err != nil {
		cb.RecordFailure()
		// Enqueue for retry
		d.EnqueueRetry(channel.ID.String(), change.ID.String(), err)
		return err
	}

	cb.RecordSuccess()
	return nil
}

// GetCircuitBreakerState returns the state of a channel's circuit breaker.
func (d *Dispatcher) GetCircuitBreakerState(channelID string) CircuitState {
	d.mu.RLock()
	defer d.mu.RUnlock()

	if cb, exists := d.circuitBreakers[channelID]; exists {
		return cb.State()
	}
	return CircuitClosed
}

// ResetCircuitBreaker resets a channel's circuit breaker to closed state.
func (d *Dispatcher) ResetCircuitBreaker(channelID string) {
	d.mu.Lock()
	defer d.mu.Unlock()

	if cb, exists := d.circuitBreakers[channelID]; exists {
		cb.mu.Lock()
		cb.state = CircuitClosed
		cb.failures = 0
		cb.successes = 0
		cb.mu.Unlock()
		log.Info().Str("channel_id", channelID).Msg("Circuit breaker reset")
	}
}

// parseUUID is a helper to parse UUIDs from strings.
func parseUUID(s string) (uuid.UUID, error) {
	return uuid.Parse(s)
}

// BatchConfig holds configuration for batch processing.
type BatchConfig struct {
	MaxBatchSize  int
	BatchWindow   time.Duration
	FlushInterval time.Duration
}

// NotificationBatcher collects notifications and dispatches them in batches.
type NotificationBatcher struct {
	dispatcher  *Dispatcher
	config      BatchConfig
	mu          sync.Mutex
	batches     map[string][]*pendingNotification // channel_id -> notifications
	flushTimer  *time.Timer
}

type pendingNotification struct {
	channel *types.Channel
	change  *types.Change
	addedAt time.Time
}

// NewNotificationBatcher creates a new notification batcher.
func NewNotificationBatcher(dispatcher *Dispatcher, config BatchConfig) *NotificationBatcher {
	if config.MaxBatchSize == 0 {
		config.MaxBatchSize = 10
	}
	if config.BatchWindow == 0 {
		config.BatchWindow = time.Second * 30
	}
	if config.FlushInterval == 0 {
		config.FlushInterval = time.Second * 10
	}

	nb := &NotificationBatcher{
		dispatcher: dispatcher,
		config:     config,
		batches:    make(map[string][]*pendingNotification),
	}

	return nb
}

// Add adds a notification to the batch for later dispatch.
func (nb *NotificationBatcher) Add(channel *types.Channel, change *types.Change) {
	nb.mu.Lock()
	defer nb.mu.Unlock()

	channelID := channel.ID.String()
	nb.batches[channelID] = append(nb.batches[channelID], &pendingNotification{
		channel: channel,
		change:  change,
		addedAt: time.Now(),
	})

	// Flush if batch size reached
	if len(nb.batches[channelID]) >= nb.config.MaxBatchSize {
		go nb.flushChannel(channelID)
	}
}

// Flush dispatches all pending notifications.
func (nb *NotificationBatcher) Flush(ctx context.Context) error {
	nb.mu.Lock()
	batches := nb.batches
	nb.batches = make(map[string][]*pendingNotification)
	nb.mu.Unlock()

	var lastErr error
	for channelID, notifications := range batches {
		if len(notifications) == 0 {
			continue
		}

		channel := notifications[0].channel
		changes := make([]types.Change, len(notifications))
		for i, n := range notifications {
			changes[i] = *n.change
		}

		if err := nb.dispatcher.DispatchBatchByChannel(ctx, channel, changes); err != nil {
			lastErr = err
			log.Error().
				Err(err).
				Str("channel_id", channelID).
				Int("count", len(notifications)).
				Msg("Failed to flush batch")
		}
	}

	return lastErr
}

func (nb *NotificationBatcher) flushChannel(channelID string) {
	nb.mu.Lock()
	notifications := nb.batches[channelID]
	delete(nb.batches, channelID)
	nb.mu.Unlock()

	if len(notifications) == 0 {
		return
	}

	ctx := context.Background()
	channel := notifications[0].channel
	changes := make([]types.Change, len(notifications))
	for i, n := range notifications {
		changes[i] = *n.change
	}

	if err := nb.dispatcher.DispatchBatchByChannel(ctx, channel, changes); err != nil {
		log.Error().
			Err(err).
			Str("channel_id", channelID).
			Msg("Failed to dispatch batch")
	}
}

// Start starts the periodic flush timer.
func (nb *NotificationBatcher) Start(ctx context.Context) {
	ticker := time.NewTicker(nb.config.FlushInterval)
	go func() {
		for {
			select {
			case <-ctx.Done():
				ticker.Stop()
				// Final flush
				nb.Flush(context.Background())
				return
			case <-ticker.C:
				nb.FlushOld(ctx)
			}
		}
	}()
}

// FlushOld flushes notifications that have been waiting longer than the batch window.
func (nb *NotificationBatcher) FlushOld(ctx context.Context) {
	nb.mu.Lock()
	now := time.Now()
	toFlush := make(map[string][]*pendingNotification)

	for channelID, notifications := range nb.batches {
		var old, remaining []*pendingNotification
		for _, n := range notifications {
			if now.Sub(n.addedAt) > nb.config.BatchWindow {
				old = append(old, n)
			} else {
				remaining = append(remaining, n)
			}
		}
		if len(old) > 0 {
			toFlush[channelID] = old
		}
		if len(remaining) > 0 {
			nb.batches[channelID] = remaining
		} else {
			delete(nb.batches, channelID)
		}
	}
	nb.mu.Unlock()

	for channelID, notifications := range toFlush {
		if len(notifications) == 0 {
			continue
		}

		channel := notifications[0].channel
		changes := make([]types.Change, len(notifications))
		for i, n := range notifications {
			changes[i] = *n.change
		}

		if err := nb.dispatcher.DispatchBatchByChannel(ctx, channel, changes); err != nil {
			log.Error().
				Err(err).
				Str("channel_id", channelID).
				Msg("Failed to flush old notifications")
		}
	}
}

