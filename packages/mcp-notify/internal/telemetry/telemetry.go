// Package telemetry provides observability setup for MCP Notify.
package telemetry

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"sync"
	"time"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/rs/zerolog/log"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracehttp"
	otelprometheus "go.opentelemetry.io/otel/exporters/prometheus"
	"go.opentelemetry.io/otel/metric"
	sdkmetric "go.opentelemetry.io/otel/sdk/metric"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.24.0"
	"go.opentelemetry.io/otel/trace"

	"github.com/nirholas/mcp-notify/internal/config"
)

// getHostname returns the hostname or "unknown" if it can't be determined.
func getHostname() string {
	if h, err := os.Hostname(); err == nil {
		return h
	}
	return "unknown"
}

var (
	// Metrics
	pollsTotal            metric.Int64Counter
	pollDuration          metric.Float64Histogram
	changesDetectedTotal  metric.Int64Counter
	notificationsSentTotal   metric.Int64Counter
	notificationsFailedTotal metric.Int64Counter
	subscriptionsActive   metric.Int64Gauge
	registryServersTotal  metric.Int64Gauge

	// Tracer
	tracer trace.Tracer

	// Meter
	meter metric.Meter

	// For graceful shutdown
	shutdownFuncs []func(context.Context) error
	shutdownMu    sync.Mutex
)

// Setup initializes the telemetry subsystem with metrics and optional tracing.
func Setup(ctx context.Context, cfg config.TelemetryConfig) (shutdown func(context.Context) error, err error) {
	// If both metrics and tracing are disabled, return no-op
	if !cfg.Metrics.Enabled && !cfg.Tracing.Enabled {
		log.Info().Msg("Telemetry disabled")
		// Initialize no-op tracer and meter
		tracer = otel.Tracer("mcp-notify")
		meter = otel.Meter("mcp-notify")
		return func(ctx context.Context) error { return nil }, nil
	}

	// Create resource - avoid merging with resource.Default() to prevent schema conflicts
	res := resource.NewWithAttributes(
		semconv.SchemaURL,
		semconv.ServiceName(cfg.Tracing.ServiceName),
		semconv.ServiceVersion("1.0.0"),
		attribute.String("host.name", getHostname()),
	)

	// Setup metrics if enabled
	if cfg.Metrics.Enabled {
		if err := setupMetrics(ctx, res); err != nil {
			return nil, fmt.Errorf("failed to setup metrics: %w", err)
		}
		log.Info().Msg("Metrics exporter initialized")
	}

	// Setup tracing if enabled
	if cfg.Tracing.Enabled {
		if err := setupTracing(ctx, res, cfg.Tracing); err != nil {
			return nil, fmt.Errorf("failed to setup tracing: %w", err)
		}
		log.Info().Str("endpoint", cfg.Tracing.Endpoint).Msg("Tracing exporter initialized")
	}

	// Get tracer and meter
	tracer = otel.Tracer("mcp-notify")
	meter = otel.Meter("mcp-notify")

	// Initialize metrics
	if err := initializeMetrics(meter); err != nil {
		return nil, fmt.Errorf("failed to initialize metrics: %w", err)
	}

	return shutdownTelemetry, nil
}

func setupMetrics(ctx context.Context, res *resource.Resource) error {
	// Create Prometheus exporter
	exporter, err := otelprometheus.New()
	if err != nil {
		return fmt.Errorf("failed to create prometheus exporter: %w", err)
	}

	// Create meter provider
	provider := sdkmetric.NewMeterProvider(
		sdkmetric.WithResource(res),
		sdkmetric.WithReader(exporter),
	)

	otel.SetMeterProvider(provider)

	shutdownMu.Lock()
	shutdownFuncs = append(shutdownFuncs, provider.Shutdown)
	shutdownMu.Unlock()

	return nil
}

func setupTracing(ctx context.Context, res *resource.Resource, cfg config.TracingConfig) error {
	if cfg.Endpoint == "" {
		return nil // Skip if no endpoint configured
	}

	// Create OTLP exporter
	exporter, err := otlptracehttp.New(ctx,
		otlptracehttp.WithEndpoint(cfg.Endpoint),
		otlptracehttp.WithInsecure(),
	)
	if err != nil {
		return fmt.Errorf("failed to create trace exporter: %w", err)
	}

	// Configure sampler
	var sampler sdktrace.Sampler
	if cfg.SampleRate >= 1.0 {
		sampler = sdktrace.AlwaysSample()
	} else if cfg.SampleRate <= 0 {
		sampler = sdktrace.NeverSample()
	} else {
		sampler = sdktrace.TraceIDRatioBased(cfg.SampleRate)
	}

	// Create trace provider
	provider := sdktrace.NewTracerProvider(
		sdktrace.WithResource(res),
		sdktrace.WithBatcher(exporter),
		sdktrace.WithSampler(sampler),
	)

	otel.SetTracerProvider(provider)

	shutdownMu.Lock()
	shutdownFuncs = append(shutdownFuncs, func(ctx context.Context) error {
		return provider.Shutdown(ctx)
	})
	shutdownMu.Unlock()

	return nil
}

func initializeMetrics(m metric.Meter) error {
	var err error

	// Counter: Total number of registry polls
	pollsTotal, err = m.Int64Counter(
		"mcp_watch_polls_total",
		metric.WithDescription("Total number of registry polls"),
		metric.WithUnit("{poll}"),
	)
	if err != nil {
		return fmt.Errorf("failed to create polls_total metric: %w", err)
	}

	// Histogram: Poll duration in seconds
	pollDuration, err = m.Float64Histogram(
		"mcp_watch_poll_duration_seconds",
		metric.WithDescription("Duration of registry polls in seconds"),
		metric.WithUnit("s"),
		metric.WithExplicitBucketBoundaries(0.1, 0.25, 0.5, 1, 2.5, 5, 10, 30),
	)
	if err != nil {
		return fmt.Errorf("failed to create poll_duration metric: %w", err)
	}

	// Counter: Total changes detected by type
	changesDetectedTotal, err = m.Int64Counter(
		"mcp_watch_changes_detected_total",
		metric.WithDescription("Total number of changes detected by type"),
		metric.WithUnit("{change}"),
	)
	if err != nil {
		return fmt.Errorf("failed to create changes_detected_total metric: %w", err)
	}

	// Counter: Total notifications sent by channel type
	notificationsSentTotal, err = m.Int64Counter(
		"mcp_watch_notifications_sent_total",
		metric.WithDescription("Total number of notifications sent by channel type"),
		metric.WithUnit("{notification}"),
	)
	if err != nil {
		return fmt.Errorf("failed to create notifications_sent_total metric: %w", err)
	}

	// Counter: Total notifications failed by channel type
	notificationsFailedTotal, err = m.Int64Counter(
		"mcp_watch_notifications_failed_total",
		metric.WithDescription("Total number of notifications failed by channel type"),
		metric.WithUnit("{notification}"),
	)
	if err != nil {
		return fmt.Errorf("failed to create notifications_failed_total metric: %w", err)
	}

	// Gauge: Active subscriptions
	subscriptionsActive, err = m.Int64Gauge(
		"mcp_watch_subscriptions_active",
		metric.WithDescription("Number of active subscriptions"),
		metric.WithUnit("{subscription}"),
	)
	if err != nil {
		return fmt.Errorf("failed to create subscriptions_active metric: %w", err)
	}

	// Gauge: Total servers in registry
	registryServersTotal, err = m.Int64Gauge(
		"mcp_watch_registry_servers_total",
		metric.WithDescription("Total number of servers in the registry"),
		metric.WithUnit("{server}"),
	)
	if err != nil {
		return fmt.Errorf("failed to create registry_servers_total metric: %w", err)
	}

	return nil
}

func shutdownTelemetry(ctx context.Context) error {
	shutdownMu.Lock()
	defer shutdownMu.Unlock()

	var lastErr error
	for _, fn := range shutdownFuncs {
		if err := fn(ctx); err != nil {
			log.Error().Err(err).Msg("Error during telemetry shutdown")
			lastErr = err
		}
	}
	shutdownFuncs = nil
	return lastErr
}

// RunMetricsServer starts the Prometheus metrics HTTP server.
func RunMetricsServer(ctx context.Context, port int) error {
	mux := http.NewServeMux()
	mux.Handle("/metrics", promhttp.Handler())
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	server := &http.Server{
		Addr:    fmt.Sprintf(":%d", port),
		Handler: mux,
	}

	// Handle graceful shutdown
	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := server.Shutdown(shutdownCtx); err != nil {
			log.Error().Err(err).Msg("Error shutting down metrics server")
		}
	}()

	log.Info().Int("port", port).Msg("Starting metrics server")
	if err := server.ListenAndServe(); err != http.ErrServerClosed {
		return fmt.Errorf("metrics server error: %w", err)
	}

	return nil
}

// -----------------------------------------------------------------------------
// Metric Recording Functions
// -----------------------------------------------------------------------------

// RecordPoll records a poll operation with its duration.
func RecordPoll(ctx context.Context, duration time.Duration, err error) {
	if pollsTotal == nil {
		return
	}

	status := "success"
	if err != nil {
		status = "error"
	}

	attrs := metric.WithAttributes(
		attribute.String("status", status),
	)

	pollsTotal.Add(ctx, 1, attrs)
	pollDuration.Record(ctx, duration.Seconds(), attrs)
}

// RecordChange records a detected change.
func RecordChange(ctx context.Context, changeType string) {
	if changesDetectedTotal == nil {
		return
	}

	changesDetectedTotal.Add(ctx, 1, metric.WithAttributes(
		attribute.String("change_type", changeType),
	))
}

// RecordNotificationSent records a successfully sent notification.
func RecordNotificationSent(ctx context.Context, channelType string) {
	if notificationsSentTotal == nil {
		return
	}

	notificationsSentTotal.Add(ctx, 1, metric.WithAttributes(
		attribute.String("channel_type", channelType),
	))
}

// RecordNotificationFailed records a failed notification.
func RecordNotificationFailed(ctx context.Context, channelType string) {
	if notificationsFailedTotal == nil {
		return
	}

	notificationsFailedTotal.Add(ctx, 1, metric.WithAttributes(
		attribute.String("channel_type", channelType),
	))
}

// SetActiveSubscriptions sets the gauge for active subscriptions.
func SetActiveSubscriptions(ctx context.Context, count int64) {
	if subscriptionsActive == nil {
		return
	}

	subscriptionsActive.Record(ctx, count)
}

// SetRegistryServers sets the gauge for total registry servers.
func SetRegistryServers(ctx context.Context, count int64) {
	if registryServersTotal == nil {
		return
	}

	registryServersTotal.Record(ctx, count)
}

// -----------------------------------------------------------------------------
// Tracing Functions
// -----------------------------------------------------------------------------

// StartSpan starts a new trace span.
func StartSpan(ctx context.Context, name string, opts ...trace.SpanStartOption) (context.Context, trace.Span) {
	if tracer == nil {
		return ctx, trace.SpanFromContext(ctx)
	}
	return tracer.Start(ctx, name, opts...)
}

// SpanFromContext returns the current span from context.
func SpanFromContext(ctx context.Context) trace.Span {
	return trace.SpanFromContext(ctx)
}

// AddSpanEvent adds an event to the current span.
func AddSpanEvent(ctx context.Context, name string, attrs ...attribute.KeyValue) {
	span := trace.SpanFromContext(ctx)
	if span.IsRecording() {
		span.AddEvent(name, trace.WithAttributes(attrs...))
	}
}

// SetSpanError marks the span as having an error.
func SetSpanError(ctx context.Context, err error) {
	span := trace.SpanFromContext(ctx)
	if span.IsRecording() && err != nil {
		span.RecordError(err)
	}
}

// -----------------------------------------------------------------------------
// Legacy Prometheus Metrics (for direct registration if needed)
// -----------------------------------------------------------------------------

var (
	// PrometheusRegistry is a custom registry for Prometheus metrics
	PrometheusRegistry = prometheus.NewRegistry()
)

// RegisterPrometheusCollectors registers any additional Prometheus collectors.
func RegisterPrometheusCollectors() error {
	// Register Go runtime collectors
	if err := PrometheusRegistry.Register(prometheus.NewGoCollector()); err != nil {
		return fmt.Errorf("failed to register Go collector: %w", err)
	}
	if err := PrometheusRegistry.Register(prometheus.NewProcessCollector(prometheus.ProcessCollectorOpts{})); err != nil {
		return fmt.Errorf("failed to register process collector: %w", err)
	}
	return nil
}
