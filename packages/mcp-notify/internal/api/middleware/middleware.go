// Package middleware provides HTTP middleware for the API server.
package middleware

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"

	"github.com/nirholas/mcp-notify/internal/db"
	"github.com/nirholas/mcp-notify/pkg/types"
)

// Context keys for middleware
type contextKey string

const (
	// SubscriptionContextKey is the context key for the authenticated subscription
	SubscriptionContextKey contextKey = "subscription"
)

// Logger is a zerolog-based request logger middleware.
func Logger(next http.Handler) http.Handler {
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
				Msg("HTTP request")
		}()

		next.ServeHTTP(ww, r)
	})
}

// AuthenticateSubscription is a middleware that authenticates requests using API key.
// The API key can be provided in the Authorization header (Bearer token) or X-API-Key header.
func AuthenticateSubscription(database db.Database) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Get subscription ID from URL
			subscriptionIDStr := chi.URLParam(r, "subscriptionID")
			if subscriptionIDStr == "" {
				http.Error(w, `{"error": "subscription ID required"}`, http.StatusBadRequest)
				return
			}

			subscriptionID, err := uuid.Parse(subscriptionIDStr)
			if err != nil {
				http.Error(w, `{"error": "invalid subscription ID"}`, http.StatusBadRequest)
				return
			}

			// Extract API key from request
			apiKey := extractAPIKey(r)
			if apiKey == "" {
				http.Error(w, `{"error": "API key required"}`, http.StatusUnauthorized)
				return
			}

			// Hash the API key
			apiKeyHash := hashAPIKey(apiKey)

			// Get subscription from database
			sub, err := database.GetSubscriptionByID(r.Context(), subscriptionID)
			if err != nil {
				log.Error().Err(err).Msg("Failed to get subscription")
				http.Error(w, `{"error": "internal server error"}`, http.StatusInternalServerError)
				return
			}

			if sub == nil {
				http.Error(w, `{"error": "subscription not found"}`, http.StatusNotFound)
				return
			}

			// Verify API key matches
			if sub.APIKey != apiKeyHash {
				http.Error(w, `{"error": "invalid API key"}`, http.StatusUnauthorized)
				return
			}

			// Store subscription in context
			ctx := context.WithValue(r.Context(), SubscriptionContextKey, sub)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// GetSubscriptionFromContext retrieves the authenticated subscription from the context.
func GetSubscriptionFromContext(ctx context.Context) *types.Subscription {
	sub, ok := ctx.Value(SubscriptionContextKey).(*types.Subscription)
	if !ok {
		return nil
	}
	return sub
}

// extractAPIKey extracts the API key from the request headers.
// Supports Authorization: Bearer <key> and X-API-Key: <key> headers.
func extractAPIKey(r *http.Request) string {
	// Try Authorization header first
	authHeader := r.Header.Get("Authorization")
	if authHeader != "" {
		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) == 2 && strings.EqualFold(parts[0], "Bearer") {
			return strings.TrimSpace(parts[1])
		}
	}

	// Try X-API-Key header
	apiKey := r.Header.Get("X-API-Key")
	if apiKey != "" {
		return strings.TrimSpace(apiKey)
	}

	// Try query parameter (not recommended, but supported)
	apiKey = r.URL.Query().Get("api_key")
	return strings.TrimSpace(apiKey)
}

// hashAPIKey creates a SHA-256 hash of the API key.
func hashAPIKey(key string) string {
	hash := sha256.Sum256([]byte(key))
	return hex.EncodeToString(hash[:])
}

// RateLimiter is a middleware that limits requests per subscription.
type RateLimiter struct {
	cache     db.Cache
	limit     int64
	window    time.Duration
}

// NewRateLimiter creates a new rate limiter middleware.
func NewRateLimiter(cache db.Cache, limit int64, window time.Duration) *RateLimiter {
	return &RateLimiter{
		cache:  cache,
		limit:  limit,
		window: window,
	}
}

// Limit applies rate limiting to the request.
func (rl *RateLimiter) Limit(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Get subscription from context
		sub := GetSubscriptionFromContext(r.Context())
		if sub == nil {
			// No subscription in context, skip rate limiting
			next.ServeHTTP(w, r)
			return
		}

		// Increment rate limit counter
		key := "sub:" + sub.ID.String()
		count, err := rl.cache.IncrementRateLimit(r.Context(), key, rl.window)
		if err != nil {
			log.Error().Err(err).Msg("Failed to check rate limit")
			// Allow request on error
			next.ServeHTTP(w, r)
			return
		}

		// Check if over limit
		if count > rl.limit {
			w.Header().Set("X-RateLimit-Limit", string(rune(rl.limit)))
			w.Header().Set("X-RateLimit-Remaining", "0")
			w.Header().Set("Retry-After", string(rune(int(rl.window.Seconds()))))
			http.Error(w, `{"error": "rate limit exceeded"}`, http.StatusTooManyRequests)
			return
		}

		// Set rate limit headers
		remaining := rl.limit - count
		if remaining < 0 {
			remaining = 0
		}
		w.Header().Set("X-RateLimit-Limit", string(rune(rl.limit)))
		w.Header().Set("X-RateLimit-Remaining", string(rune(remaining)))

		next.ServeHTTP(w, r)
	})
}

// CORS sets up CORS headers for the response.
func CORS(origins []string, methods []string, headers []string, credentials bool) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			origin := r.Header.Get("Origin")

			// Check if origin is allowed
			allowed := false
			for _, o := range origins {
				if o == "*" || o == origin {
					allowed = true
					break
				}
			}

			if allowed && origin != "" {
				w.Header().Set("Access-Control-Allow-Origin", origin)
				if credentials {
					w.Header().Set("Access-Control-Allow-Credentials", "true")
				}
			}

			// Handle preflight requests
			if r.Method == http.MethodOptions {
				w.Header().Set("Access-Control-Allow-Methods", strings.Join(methods, ", "))
				w.Header().Set("Access-Control-Allow-Headers", strings.Join(headers, ", "))
				w.Header().Set("Access-Control-Max-Age", "300")
				w.WriteHeader(http.StatusNoContent)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// RequireJSON ensures the request has JSON content type.
func RequireJSON(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodDelete && r.Method != http.MethodHead {
			contentType := r.Header.Get("Content-Type")
			if !strings.Contains(contentType, "application/json") {
				http.Error(w, `{"error": "Content-Type must be application/json"}`, http.StatusUnsupportedMediaType)
				return
			}
		}
		next.ServeHTTP(w, r)
	})
}
