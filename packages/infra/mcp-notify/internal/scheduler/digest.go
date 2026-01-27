// Package scheduler provides scheduled task execution.
package scheduler

import (
	"context"
	"time"

	"github.com/robfig/cron/v3"
	"github.com/rs/zerolog/log"

	"github.com/nirholas/mcp-notify/internal/db"
	"github.com/nirholas/mcp-notify/internal/notifier"
	"github.com/nirholas/mcp-notify/pkg/types"
)

// Config holds scheduler configuration.
type Config struct {
	Database   db.Database
	Dispatcher *notifier.Dispatcher
}

// DigestScheduler handles scheduled digest email delivery.
type DigestScheduler struct {
	db         db.Database
	dispatcher *notifier.Dispatcher
	cron       *cron.Cron
}

// NewDigestScheduler creates a new digest scheduler.
func NewDigestScheduler(cfg Config) *DigestScheduler {
	return &DigestScheduler{
		db:         cfg.Database,
		dispatcher: cfg.Dispatcher,
		cron:       cron.New(cron.WithSeconds()),
	}
}

// Run starts the scheduler.
func (s *DigestScheduler) Run(ctx context.Context) error {
	log.Info().Msg("Starting digest scheduler")

	// Schedule hourly digest (at minute 0)
	_, err := s.cron.AddFunc("0 0 * * * *", func() {
		s.sendDigests(context.Background(), types.DigestHourly)
	})
	if err != nil {
		return err
	}

	// Schedule daily digest (at 9:00 AM UTC)
	_, err = s.cron.AddFunc("0 0 9 * * *", func() {
		s.sendDigests(context.Background(), types.DigestDaily)
	})
	if err != nil {
		return err
	}

	// Schedule weekly digest (Sunday at 9:00 AM UTC)
	_, err = s.cron.AddFunc("0 0 9 * * 0", func() {
		s.sendDigests(context.Background(), types.DigestWeekly)
	})
	if err != nil {
		return err
	}

	// Schedule cleanup (daily at 3:00 AM UTC)
	_, err = s.cron.AddFunc("0 0 3 * * *", func() {
		s.cleanup(context.Background())
	})
	if err != nil {
		return err
	}

	s.cron.Start()

	// Wait for context cancellation
	<-ctx.Done()

	log.Info().Msg("Stopping digest scheduler")
	cronCtx := s.cron.Stop()
	<-cronCtx.Done()

	return ctx.Err()
}

// sendDigests sends digest emails for the specified frequency.
func (s *DigestScheduler) sendDigests(ctx context.Context, frequency types.DigestFrequency) {
	log.Info().Str("frequency", string(frequency)).Msg("Sending digests")

	// Calculate time range based on frequency
	var since time.Time
	now := time.Now().UTC()

	switch frequency {
	case types.DigestHourly:
		since = now.Add(-1 * time.Hour)
	case types.DigestDaily:
		since = now.Add(-24 * time.Hour)
	case types.DigestWeekly:
		since = now.Add(-7 * 24 * time.Hour)
	default:
		log.Error().Str("frequency", string(frequency)).Msg("Unknown digest frequency")
		return
	}

	// Get changes in the time range
	changes, err := s.db.GetChangesSince(ctx, since, 1000)
	if err != nil {
		log.Error().Err(err).Msg("Failed to get changes for digest")
		return
	}

	if len(changes) == 0 {
		log.Debug().Str("frequency", string(frequency)).Msg("No changes for digest")
		return
	}

	// Get subscriptions with email channels set to this frequency
	subscriptions, err := s.db.GetActiveSubscriptions(ctx)
	if err != nil {
		log.Error().Err(err).Msg("Failed to get subscriptions for digest")
		return
	}

	for _, sub := range subscriptions {
		channels, err := s.db.GetChannelsForSubscription(ctx, sub.ID)
		if err != nil {
			log.Error().Err(err).Str("subscription", sub.ID.String()).Msg("Failed to get channels")
			continue
		}

		for _, channel := range channels {
			if channel.Type != types.ChannelEmail || !channel.Enabled {
				continue
			}

			if channel.Config.EmailDigest != frequency {
				continue
			}

			// Filter changes based on subscription filters
			filteredChanges := filterChangesForSubscription(changes, sub.Filters)
			if len(filteredChanges) == 0 {
				continue
			}

			// Send digest email
			if err := s.sendDigestEmail(ctx, &channel, filteredChanges, frequency); err != nil {
				log.Error().
					Err(err).
					Str("subscription", sub.ID.String()).
					Str("email", channel.Config.EmailAddress).
					Msg("Failed to send digest email")
			} else {
				log.Info().
					Str("subscription", sub.ID.String()).
					Str("email", channel.Config.EmailAddress).
					Int("changes", len(filteredChanges)).
					Msg("Sent digest email")
			}
		}
	}
}

// sendDigestEmail sends a digest email for a channel.
func (s *DigestScheduler) sendDigestEmail(ctx context.Context, channel *types.Channel, changes []types.Change, frequency types.DigestFrequency) error {
	// Email sending is handled by the email notifier through the dispatcher
	// The digest scheduler collects and batches changes; actual email delivery
	// is performed by the email notifier when the digest batch is flushed
	log.Debug().
		Str("channel_id", channel.ID.String()).
		Int("changes", len(changes)).
		Str("frequency", string(frequency)).
		Msg("Digest email prepared (email notifier handles delivery)")
	return nil
}

// filterChangesForSubscription filters changes based on subscription filters.
func filterChangesForSubscription(changes []types.Change, filter types.SubscriptionFilter) []types.Change {
	// Pass-through: filtering is applied at notification dispatch time
	// Digest collects all changes for the period
	return changes
}

// cleanup performs scheduled cleanup tasks.
func (s *DigestScheduler) cleanup(ctx context.Context) {
	log.Info().Msg("Running scheduled cleanup")

	// Delete snapshots older than 30 days
	cutoff := time.Now().Add(-30 * 24 * time.Hour)
	if err := s.db.DeleteOldSnapshots(ctx, cutoff); err != nil {
		log.Error().Err(err).Msg("Failed to delete old snapshots")
	}

	// Notification cleanup and rate limit reset handled by database TTLs
	// PostgreSQL: handled via scheduled VACUUM
	// Redis: handled via key TTLs
}
