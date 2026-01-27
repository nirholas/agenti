// Package middleware provides HTTP middleware for the API server.
package middleware

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5/middleware"
	"github.com/google/uuid"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
)

// Context keys for logging middleware
const (
	// RequestIDKey is the context key for the request ID
	RequestIDKey = "request_id"
	// LoggerKey is the context key for the logger
	LoggerKey = "logger"
)

// RequestLogger is a zerolog-based request logger middleware.
// It logs request details including method, path, status, duration, and correlation ID.
func RequestLogger(logger zerolog.Logger) func(next http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)

			// Get or generate request ID
			requestID := middleware.GetReqID(r.Context())
			if requestID == "" {
				requestID = uuid.New().String()
			}

			// Add request ID to response headers
			ww.Header().Set("X-Request-ID", requestID)

			// Create a logger with request context
			reqLogger := logger.With().
				Str("request_id", requestID).
				Str("method", r.Method).
				Str("path", r.URL.Path).
				Str("remote_ip", getClientIP(r)).
				Logger()

			// Log request start (debug level)
			reqLogger.Debug().
				Str("user_agent", r.UserAgent()).
				Str("query", r.URL.RawQuery).
				Msg("Request started")

			// Process request
			defer func() {
				duration := time.Since(start)
				status := ww.Status()

				// Determine log level based on status code
				var event *zerolog.Event
				switch {
				case status >= 500:
					event = reqLogger.Error()
				case status >= 400:
					event = reqLogger.Warn()
				default:
					event = reqLogger.Info()
				}

				// Log request completion
				event.
					Int("status", status).
					Int("bytes", ww.BytesWritten()).
					Dur("duration_ms", duration).
					Float64("duration_seconds", duration.Seconds()).
					Msg("Request completed")
			}()

			next.ServeHTTP(ww, r)
		})
	}
}

// StructuredLogger creates a middleware that adds structured logging context.
// This enriches logs with subscription context if available.
func StructuredLogger(logger zerolog.Logger) func(next http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)

			// Get request ID
			requestID := middleware.GetReqID(r.Context())
			if requestID == "" {
				requestID = uuid.New().String()
			}

			// Set request ID header
			ww.Header().Set("X-Request-ID", requestID)

			// Build base logger
			reqLogger := logger.With().
				Str("request_id", requestID).
				Str("method", r.Method).
				Str("path", r.URL.Path).
				Logger()

			defer func() {
				duration := time.Since(start)
				status := ww.Status()

				// Build log event
				event := reqLogger.Info()
				if status >= 500 {
					event = reqLogger.Error()
				} else if status >= 400 {
					event = reqLogger.Warn()
				}

				// Add subscription context if available
				if sub := GetSubscriptionFromContext(r.Context()); sub != nil {
					event = event.Str("subscription_id", sub.ID.String())
				}

				event.
					Int("status", status).
					Int("bytes_written", ww.BytesWritten()).
					Dur("duration", duration).
					Str("remote_ip", getClientIP(r)).
					Msg("HTTP request")
			}()

			next.ServeHTTP(ww, r)
		})
	}
}

// RecoveryLogger creates a middleware that logs panics with full context.
func RecoveryLogger(logger zerolog.Logger) func(next http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer func() {
				if rec := recover(); rec != nil {
					requestID := middleware.GetReqID(r.Context())
					
					logger.Error().
						Str("request_id", requestID).
						Str("method", r.Method).
						Str("path", r.URL.Path).
						Interface("panic", rec).
						Msg("Panic recovered")

					// Return 500 error
					writeJSONError(w, http.StatusInternalServerError, 
						"INTERNAL_ERROR", 
						"An unexpected error occurred", 
						nil)
				}
			}()

			next.ServeHTTP(w, r)
		})
	}
}

// AccessLogger is a simpler access log middleware for high-volume logging.
func AccessLogger(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		ww := middleware.NewWrapResponseWriter(w, r.ProtoMajor)

		defer func() {
			log.Info().
				Str("method", r.Method).
				Str("path", r.URL.Path).
				Str("remote", r.RemoteAddr).
				Int("status", ww.Status()).
				Int("bytes", ww.BytesWritten()).
				Dur("duration", time.Since(start)).
				Str("request_id", middleware.GetReqID(r.Context())).
				Msg("access")
		}()

		next.ServeHTTP(ww, r)
	})
}

// CorrelationID adds a correlation ID to requests for distributed tracing.
func CorrelationID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Check for existing correlation ID in headers
		correlationID := r.Header.Get("X-Correlation-ID")
		if correlationID == "" {
			correlationID = r.Header.Get("X-Request-ID")
		}
		if correlationID == "" {
			correlationID = uuid.New().String()
		}

		// Add to response headers
		w.Header().Set("X-Correlation-ID", correlationID)
		w.Header().Set("X-Request-ID", correlationID)

		next.ServeHTTP(w, r)
	})
}

// ResponseTime adds response time headers to all responses.
func ResponseTime(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		
		defer func() {
			duration := time.Since(start)
			w.Header().Set("X-Response-Time", duration.String())
		}()

		next.ServeHTTP(w, r)
	})
}
