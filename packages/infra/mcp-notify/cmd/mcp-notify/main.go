// Package main provides the entry point for the MCP Notify server.
package main

import (
	"context"
	"fmt"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
	"golang.org/x/sync/errgroup"

	apispec "github.com/nirholas/mcp-notify/api"
	"github.com/nirholas/mcp-notify/internal/api"
	"github.com/nirholas/mcp-notify/internal/config"
	"github.com/nirholas/mcp-notify/internal/db"
	"github.com/nirholas/mcp-notify/internal/notifier"
	"github.com/nirholas/mcp-notify/internal/poller"
	"github.com/nirholas/mcp-notify/internal/registry"
	"github.com/nirholas/mcp-notify/internal/scheduler"
	"github.com/nirholas/mcp-notify/internal/subscription"
	"github.com/nirholas/mcp-notify/internal/telemetry"
)

// Version information (set via ldflags)
var (
	Version   = "dev"
	Commit    = "unknown"
	BuildDate = "unknown"
)

func main() {
	// Initialize logging
	setupLogging()

	log.Info().
		Str("version", Version).
		Str("commit", Commit).
		Str("build_date", BuildDate).
		Msg("Starting MCP Notify")

	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to load configuration")
	}

	// Set log level from config
	setLogLevel(cfg.LogLevel)

	// Create root context with cancellation
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Handle shutdown signals
	go handleShutdown(cancel)

	// Run the application
	if err := run(ctx, cfg); err != nil {
		log.Fatal().Err(err).Msg("Application error")
	}

	log.Info().Msg("MCP Notify shutdown complete")
}

func run(ctx context.Context, cfg *config.Config) error {
	// Initialize telemetry
	telemetryShutdown, err := telemetry.Setup(ctx, cfg.Telemetry)
	if err != nil {
		return fmt.Errorf("failed to setup telemetry: %w", err)
	}
	defer telemetryShutdown(context.Background())

	// Initialize database
	database, err := db.New(ctx, cfg.Database)
	if err != nil {
		return fmt.Errorf("failed to connect to database: %w", err)
	}
	defer database.Close()

	// Run migrations
	if err := database.Migrate(ctx); err != nil {
		return fmt.Errorf("failed to run migrations: %w", err)
	}

	// Initialize Redis (optional)
	var cache db.Cache
	if cfg.Redis.URL != "" {
		cache, err = db.NewRedisCache(ctx, cfg.Redis)
		if err != nil {
			log.Warn().Err(err).Msg("Failed to connect to Redis, continuing without cache")
		} else {
			defer cache.Close()
		}
	}

	// Initialize registry client
	registryClient := registry.NewClient(cfg.Registry)

	// Initialize subscription manager
	subscriptionMgr := subscription.NewManager(database, cache)

	// Initialize notification dispatcher
	dispatcher, err := notifier.NewDispatcher(cfg.Notifications, database)
	if err != nil {
		return fmt.Errorf("failed to create notification dispatcher: %w", err)
	}

	// Initialize poller
	registryPoller := poller.New(poller.Config{
		Client:          registryClient,
		Database:        database,
		Cache:           cache,
		Dispatcher:      dispatcher,
		SubscriptionMgr: subscriptionMgr,
		PollInterval:    cfg.Registry.PollInterval,
	})

	// Initialize scheduler for digest emails
	digestScheduler := scheduler.NewDigestScheduler(scheduler.Config{
		Database:   database,
		Dispatcher: dispatcher,
	})

	// Initialize API server
	apiServer := api.NewServer(api.Config{
		Host:            cfg.Server.Host,
		Port:            cfg.Server.Port,
		Database:        database,
		Cache:           cache,
		SubscriptionMgr: subscriptionMgr,
		RegistryClient:  registryClient,
		CORS:            cfg.Server.CORS,
		Version:         Version,
		OpenAPISpec:     apispec.OpenAPISpec,
	})

	// Start all components using errgroup
	g, gCtx := errgroup.WithContext(ctx)

	// Start poller
	g.Go(func() error {
		log.Info().Msg("Starting registry poller")
		return registryPoller.Run(gCtx)
	})

	// Start digest scheduler
	g.Go(func() error {
		log.Info().Msg("Starting digest scheduler")
		return digestScheduler.Run(gCtx)
	})

	// Start API server
	g.Go(func() error {
		log.Info().
			Str("host", cfg.Server.Host).
			Int("port", cfg.Server.Port).
			Msg("Starting API server")
		return apiServer.Run(gCtx)
	})

	// Start metrics server (if enabled)
	if cfg.Telemetry.Metrics.Enabled {
		g.Go(func() error {
			log.Info().
				Int("port", cfg.Telemetry.Metrics.Port).
				Msg("Starting metrics server")
			return telemetry.RunMetricsServer(gCtx, cfg.Telemetry.Metrics.Port)
		})
	}

	// Wait for all goroutines
	if err := g.Wait(); err != nil {
		return fmt.Errorf("component error: %w", err)
	}

	return nil
}

func setupLogging() {
	// Configure zerolog
	zerolog.TimeFieldFormat = time.RFC3339
	zerolog.DurationFieldUnit = time.Millisecond

	// Pretty logging for development
	if os.Getenv("MCP_WATCH_ENV") != "production" {
		log.Logger = log.Output(zerolog.ConsoleWriter{
			Out:        os.Stderr,
			TimeFormat: "15:04:05",
		})
	}
}

func setLogLevel(level string) {
	switch level {
	case "debug":
		zerolog.SetGlobalLevel(zerolog.DebugLevel)
	case "info":
		zerolog.SetGlobalLevel(zerolog.InfoLevel)
	case "warn":
		zerolog.SetGlobalLevel(zerolog.WarnLevel)
	case "error":
		zerolog.SetGlobalLevel(zerolog.ErrorLevel)
	default:
		zerolog.SetGlobalLevel(zerolog.InfoLevel)
	}
}

func handleShutdown(cancel context.CancelFunc) {
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	sig := <-sigCh
	log.Info().Str("signal", sig.String()).Msg("Received shutdown signal")
	cancel()
}
