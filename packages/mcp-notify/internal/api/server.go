// Package api provides the HTTP API server for MCP Notify.
package api

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/go-chi/httprate"
	"github.com/rs/zerolog/log"

	"github.com/nirholas/mcp-notify/internal/api/handlers"
	apimiddleware "github.com/nirholas/mcp-notify/internal/api/middleware"
	"github.com/nirholas/mcp-notify/internal/config"
	"github.com/nirholas/mcp-notify/internal/db"
	"github.com/nirholas/mcp-notify/internal/registry"
	"github.com/nirholas/mcp-notify/internal/subscription"
)

// Config holds API server configuration.
type Config struct {
	Host            string
	Port            int
	Database        db.Database
	Cache           db.Cache
	SubscriptionMgr *subscription.Manager
	RegistryClient  *registry.Client
	CORS            config.CORSConfig
	Version         string
	OpenAPISpec     []byte
}

// Server is the HTTP API server.
type Server struct {
	config     Config
	router     chi.Router
	httpServer *http.Server
	handlers   *handlers.Handlers
}

// NewServer creates a new API server.
func NewServer(cfg Config) *Server {
	s := &Server{
		config: cfg,
		handlers: handlers.New(handlers.Config{
			Database:        cfg.Database,
			Cache:           cfg.Cache,
			SubscriptionMgr: cfg.SubscriptionMgr,
			RegistryClient:  cfg.RegistryClient,
			Version:         cfg.Version,
			OpenAPISpec:     cfg.OpenAPISpec,
		}),
	}

	s.setupRouter()
	return s
}

func (s *Server) setupRouter() {
	r := chi.NewRouter()

	// Global middleware
	r.Use(middleware.RequestID)
	r.Use(middleware.RealIP)
	r.Use(apimiddleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.Compress(5))
	r.Use(middleware.Timeout(30 * time.Second))

	// CORS
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   s.config.CORS.Origins,
		AllowedMethods:   s.config.CORS.Methods,
		AllowedHeaders:   s.config.CORS.Headers,
		AllowCredentials: s.config.CORS.Credentials,
		MaxAge:           300,
	}))

	// Rate limiting (100 requests per minute per IP)
	r.Use(httprate.LimitByIP(100, time.Minute))

	// Health endpoints (no auth required)
	r.Get("/health", s.handlers.Health)
	r.Get("/ready", s.handlers.Ready)

	// API v1 routes
	r.Route("/api/v1", func(r chi.Router) {
		// Public endpoints
		r.Get("/stats", s.handlers.GetStats)

		// Subscriptions
		r.Route("/subscriptions", func(r chi.Router) {
			r.Post("/", s.handlers.CreateSubscription)
			r.Get("/", s.handlers.ListSubscriptions)

			r.Route("/{subscriptionID}", func(r chi.Router) {
				r.Use(apimiddleware.AuthenticateSubscription(s.config.Database))
				r.Get("/", s.handlers.GetSubscription)
				r.Put("/", s.handlers.UpdateSubscription)
				r.Delete("/", s.handlers.DeleteSubscription)
				r.Post("/pause", s.handlers.PauseSubscription)
				r.Post("/resume", s.handlers.ResumeSubscription)
				r.Post("/test", s.handlers.TestSubscription)
				r.Get("/notifications", s.handlers.GetSubscriptionNotifications)
			})
		})

		// Changes
		r.Route("/changes", func(r chi.Router) {
			r.Get("/", s.handlers.ListChanges)
			r.Get("/{changeID}", s.handlers.GetChange)
		})

		// Servers (proxy to registry with caching)
		r.Route("/servers", func(r chi.Router) {
			r.Get("/", s.handlers.ListServers)
			r.Get("/{serverName}", s.handlers.GetServer)
			r.Get("/{serverName}/changes", s.handlers.GetServerChanges)
		})

		// Feeds
		r.Route("/feeds", func(r chi.Router) {
			r.Get("/rss", s.handlers.RSSFeed)
			r.Get("/atom", s.handlers.AtomFeed)
			r.Get("/json", s.handlers.JSONFeed)
		})

		// Webhooks (for external integrations)
		r.Post("/webhooks/test", s.handlers.TestWebhook)
	})

	// Serve OpenAPI spec
	r.Get("/api/docs", s.handlers.ServeOpenAPISpec)
	r.Get("/api/openapi.yaml", s.handlers.ServeOpenAPIYAML)

	// Static files for dashboard (if embedded)
	// r.Handle("/*", http.FileServer(http.FS(dashboardFS)))

	s.router = r
}

// Run starts the HTTP server.
func (s *Server) Run(ctx context.Context) error {
	addr := fmt.Sprintf("%s:%d", s.config.Host, s.config.Port)

	s.httpServer = &http.Server{
		Addr:         addr,
		Handler:      s.router,
		ReadTimeout:  15 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	// Start server in goroutine
	errCh := make(chan error, 1)
	go func() {
		log.Info().Str("addr", addr).Msg("Starting HTTP server")
		if err := s.httpServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			errCh <- err
		}
	}()

	// Wait for context cancellation or error
	select {
	case <-ctx.Done():
		log.Info().Msg("Shutting down HTTP server")
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		return s.httpServer.Shutdown(shutdownCtx)
	case err := <-errCh:
		return err
	}
}

// Router returns the chi router for testing.
func (s *Server) Router() chi.Router {
	return s.router
}
