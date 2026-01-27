// Package poller provides the registry polling service.
package poller

import (
	"context"
	"sync"
	"time"

	"github.com/rs/zerolog/log"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/metric"

	"github.com/nirholas/mcp-notify/internal/db"
	"github.com/nirholas/mcp-notify/internal/diff"
	"github.com/nirholas/mcp-notify/internal/notifier"
	"github.com/nirholas/mcp-notify/internal/registry"
	"github.com/nirholas/mcp-notify/internal/subscription"
	"github.com/nirholas/mcp-notify/pkg/types"
)

var (
	tracer = otel.Tracer("poller")
	meter  = otel.Meter("poller")
)

// Config holds poller configuration.
type Config struct {
	Client          *registry.Client
	Database        db.Database
	Cache           db.Cache
	Dispatcher      *notifier.Dispatcher
	SubscriptionMgr *subscription.Manager
	PollInterval    time.Duration
}

// Poller polls the MCP Registry for changes.
type Poller struct {
	config       Config
	diffEngine   *diff.Engine
	lastSnapshot *types.Snapshot
	lastPollTime time.Time
	mu           sync.RWMutex

	// Metrics
	pollCount       metric.Int64Counter
	pollDuration    metric.Float64Histogram
	changesDetected metric.Int64Counter
	pollErrors      metric.Int64Counter
}

// New creates a new poller.
func New(cfg Config) *Poller {
	p := &Poller{
		config:     cfg,
		diffEngine: diff.NewEngine(),
	}

	// Initialize metrics
	p.initMetrics()

	return p
}

func (p *Poller) initMetrics() {
	var err error

	p.pollCount, err = meter.Int64Counter("poller.polls.total",
		metric.WithDescription("Total number of registry polls"),
	)
	if err != nil {
		log.Warn().Err(err).Msg("Failed to create poll count metric")
	}

	p.pollDuration, err = meter.Float64Histogram("poller.poll.duration_seconds",
		metric.WithDescription("Duration of registry polls in seconds"),
	)
	if err != nil {
		log.Warn().Err(err).Msg("Failed to create poll duration metric")
	}

	p.changesDetected, err = meter.Int64Counter("poller.changes.detected",
		metric.WithDescription("Total number of changes detected"),
	)
	if err != nil {
		log.Warn().Err(err).Msg("Failed to create changes detected metric")
	}

	p.pollErrors, err = meter.Int64Counter("poller.errors.total",
		metric.WithDescription("Total number of poll errors"),
	)
	if err != nil {
		log.Warn().Err(err).Msg("Failed to create poll errors metric")
	}
}

// Run starts the polling loop.
func (p *Poller) Run(ctx context.Context) error {
	log.Info().
		Dur("interval", p.config.PollInterval).
		Msg("Starting registry poller")

	// Do initial poll immediately
	if err := p.poll(ctx); err != nil {
		log.Error().Err(err).Msg("Initial poll failed")
		// Don't fail startup on initial poll failure
	}

	ticker := time.NewTicker(p.config.PollInterval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			log.Info().Msg("Stopping registry poller")
			return ctx.Err()
		case <-ticker.C:
			if err := p.poll(ctx); err != nil {
				log.Error().Err(err).Msg("Poll failed")
				if p.pollErrors != nil {
					p.pollErrors.Add(ctx, 1)
				}
			}
		}
	}
}

// poll performs a single poll of the registry.
func (p *Poller) poll(ctx context.Context) error {
	ctx, span := tracer.Start(ctx, "poll")
	defer span.End()

	start := time.Now()
	defer func() {
		duration := time.Since(start).Seconds()
		if p.pollDuration != nil {
			p.pollDuration.Record(ctx, duration)
		}
		if p.pollCount != nil {
			p.pollCount.Add(ctx, 1)
		}
	}()

	log.Debug().Msg("Starting registry poll")

	// Fetch all servers from registry
	servers, err := p.config.Client.ListServers(ctx)
	if err != nil {
		span.RecordError(err)
		return err
	}

	span.SetAttributes(attribute.Int("server_count", len(servers)))

	// Create new snapshot
	newSnapshot := p.diffEngine.CreateSnapshot(servers)

	// Get previous snapshot
	p.mu.RLock()
	previousSnapshot := p.lastSnapshot
	p.mu.RUnlock()

	// Compare snapshots
	var diffResult *types.DiffResult
	if previousSnapshot == nil {
		// First poll - treat all servers as new (but don't notify)
		log.Info().Int("server_count", len(servers)).Msg("Initial snapshot created")
		diffResult = &types.DiffResult{
			ToSnapshot:   newSnapshot,
			TotalChanges: 0, // Don't count initial servers as changes
		}
	} else if p.diffEngine.HasChanges(previousSnapshot, newSnapshot) {
		// Compute detailed diff
		diffResult = p.diffEngine.Compare(previousSnapshot, newSnapshot)
		log.Info().
			Int("new", len(diffResult.NewServers)).
			Int("updated", len(diffResult.UpdatedServers)).
			Int("removed", len(diffResult.RemovedServers)).
			Msg("Changes detected")
	} else {
		log.Debug().Msg("No changes detected")
		diffResult = &types.DiffResult{
			FromSnapshot: previousSnapshot,
			ToSnapshot:   newSnapshot,
			TotalChanges: 0,
		}
	}

	// Store snapshot
	p.mu.Lock()
	p.lastSnapshot = newSnapshot
	p.lastPollTime = time.Now()
	p.mu.Unlock()

	// Save snapshot to database
	if err := p.config.Database.SaveSnapshot(ctx, newSnapshot); err != nil {
		log.Error().Err(err).Msg("Failed to save snapshot")
		// Continue anyway - this is not critical
	}

	// Process changes if any
	if diffResult.TotalChanges > 0 {
		if p.changesDetected != nil {
			p.changesDetected.Add(ctx, int64(diffResult.TotalChanges))
		}

		// Save changes to database
		allChanges := append(append(diffResult.NewServers, diffResult.UpdatedServers...), diffResult.RemovedServers...)
		for _, change := range allChanges {
			if err := p.config.Database.SaveChange(ctx, &change); err != nil {
				log.Error().Err(err).Str("server", change.ServerName).Msg("Failed to save change")
			}
		}

		// Dispatch notifications
		if err := p.dispatchNotifications(ctx, diffResult); err != nil {
			log.Error().Err(err).Msg("Failed to dispatch notifications")
		}
	}

	log.Debug().
		Dur("duration", time.Since(start)).
		Int("total_changes", diffResult.TotalChanges).
		Msg("Poll completed")

	return nil
}

// dispatchNotifications sends notifications for detected changes.
func (p *Poller) dispatchNotifications(ctx context.Context, diffResult *types.DiffResult) error {
	ctx, span := tracer.Start(ctx, "dispatchNotifications")
	defer span.End()

	// Get all active subscriptions
	subscriptions, err := p.config.SubscriptionMgr.GetActiveSubscriptions(ctx)
	if err != nil {
		return err
	}

	span.SetAttributes(attribute.Int("subscription_count", len(subscriptions)))

	// For each subscription, filter changes and dispatch
	for _, sub := range subscriptions {
		// Filter changes based on subscription filters
		filteredResult := diff.FilterChanges(diffResult, sub.Filters)

		if filteredResult.TotalChanges == 0 {
			continue
		}

		// Collect all changes for this subscription
		allChanges := append(append(
			filteredResult.NewServers,
			filteredResult.UpdatedServers...),
			filteredResult.RemovedServers...,
		)

		// Dispatch to each channel
		for _, channel := range sub.Channels {
			if !channel.Enabled {
				continue
			}

			for _, change := range allChanges {
				if err := p.config.Dispatcher.Dispatch(ctx, &channel, &change); err != nil {
					log.Error().
						Err(err).
						Str("subscription", sub.ID.String()).
						Str("channel", string(channel.Type)).
						Str("server", change.ServerName).
						Msg("Failed to dispatch notification")
				}
			}
		}

		// Update last notified timestamp
		if err := p.config.SubscriptionMgr.UpdateLastNotified(ctx, sub.ID); err != nil {
			log.Error().Err(err).Str("subscription", sub.ID.String()).Msg("Failed to update last notified")
		}
	}

	return nil
}

// GetLastSnapshot returns the most recent snapshot.
func (p *Poller) GetLastSnapshot() *types.Snapshot {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return p.lastSnapshot
}

// GetStats returns current poller statistics.
func (p *Poller) GetStats(ctx context.Context) (*PollerStats, error) {
	p.mu.RLock()
	lastSnapshot := p.lastSnapshot
	lastPollTime := p.lastPollTime
	p.mu.RUnlock()

	stats := &PollerStats{
		LastPollTime: lastPollTime,
	}

	if lastSnapshot != nil {
		stats.ServerCount = lastSnapshot.ServerCount
		stats.LastSnapshotTime = lastSnapshot.Timestamp
	}

	// Get change counts from database
	changes24h, err := p.config.Database.GetChangeCountSince(ctx, time.Now().Add(-24*time.Hour))
	if err != nil {
		return nil, err
	}
	stats.ChangesLast24h = changes24h

	return stats, nil
}

// PollerStats contains poller statistics.
type PollerStats struct {
	ServerCount      int       `json:"server_count"`
	LastPollTime     time.Time `json:"last_poll_time"`
	LastSnapshotTime time.Time `json:"last_snapshot_time"`
	ChangesLast24h   int       `json:"changes_last_24h"`
}

// ForcePool triggers an immediate poll (useful for testing).
func (p *Poller) ForcePoll(ctx context.Context) error {
	return p.poll(ctx)
}
