// Package middleware provides HTTP middleware for the API server.
package middleware

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/rs/zerolog/log"

	"github.com/nirholas/mcp-notify/internal/db"
)

// RateLimitConfig holds rate limiter configuration.
type RateLimitConfig struct {
	// Limit is the maximum number of requests allowed per window.
	Limit int64
	// Window is the time window for rate limiting.
	Window time.Duration
	// Cache is the cache interface for storing rate limit counters.
	Cache db.Cache
	// KeyFunc is an optional function to extract a custom rate limit key.
	// If nil, the subscription ID or IP address will be used.
	KeyFunc func(r *http.Request) string
}

// RateLimitByAPIKey creates a middleware that rate limits requests by API key/subscription.
// It uses Redis to track request counts across multiple instances.
func RateLimitByAPIKey(cache db.Cache, limit int64, window time.Duration) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Get subscription from context
			sub := GetSubscriptionFromContext(r.Context())
			if sub == nil {
				// No subscription in context, skip rate limiting
				next.ServeHTTP(w, r)
				return
			}

			// Build rate limit key
			key := fmt.Sprintf("ratelimit:sub:%s", sub.ID.String())

			// Increment counter
			count, err := cache.IncrementRateLimit(r.Context(), key, window)
			if err != nil {
				log.Error().Err(err).Str("key", key).Msg("Failed to check rate limit")
				// Allow request on cache error (fail open)
				next.ServeHTTP(w, r)
				return
			}

			// Set rate limit headers
			w.Header().Set("X-RateLimit-Limit", strconv.FormatInt(limit, 10))
			remaining := limit - count
			if remaining < 0 {
				remaining = 0
			}
			w.Header().Set("X-RateLimit-Remaining", strconv.FormatInt(remaining, 10))
			w.Header().Set("X-RateLimit-Reset", strconv.FormatInt(time.Now().Add(window).Unix(), 10))

			// Check if over limit
			if count > limit {
				w.Header().Set("Retry-After", strconv.Itoa(int(window.Seconds())))
				writeJSONError(w, http.StatusTooManyRequests, "RATE_LIMIT_EXCEEDED",
					fmt.Sprintf("Rate limit exceeded. Maximum %d requests per %s", limit, window),
					map[string]string{
						"limit":       strconv.FormatInt(limit, 10),
						"window":      window.String(),
						"retry_after": strconv.Itoa(int(window.Seconds())),
					})
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// RateLimitByIP creates a middleware that rate limits requests by IP address.
// This is useful for public endpoints where no API key is required.
func RateLimitByIP(cache db.Cache, limit int64, window time.Duration) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Get client IP
			ip := getClientIP(r)
			if ip == "" {
				// Can't determine IP, allow request
				next.ServeHTTP(w, r)
				return
			}

			// Build rate limit key
			key := fmt.Sprintf("ratelimit:ip:%s", ip)

			// Increment counter
			count, err := cache.IncrementRateLimit(r.Context(), key, window)
			if err != nil {
				log.Error().Err(err).Str("key", key).Msg("Failed to check rate limit")
				// Allow request on cache error (fail open)
				next.ServeHTTP(w, r)
				return
			}

			// Set rate limit headers
			w.Header().Set("X-RateLimit-Limit", strconv.FormatInt(limit, 10))
			remaining := limit - count
			if remaining < 0 {
				remaining = 0
			}
			w.Header().Set("X-RateLimit-Remaining", strconv.FormatInt(remaining, 10))
			w.Header().Set("X-RateLimit-Reset", strconv.FormatInt(time.Now().Add(window).Unix(), 10))

			// Check if over limit
			if count > limit {
				w.Header().Set("Retry-After", strconv.Itoa(int(window.Seconds())))
				writeJSONError(w, http.StatusTooManyRequests, "RATE_LIMIT_EXCEEDED",
					fmt.Sprintf("Rate limit exceeded. Maximum %d requests per %s", limit, window),
					map[string]string{
						"limit":       strconv.FormatInt(limit, 10),
						"window":      window.String(),
						"retry_after": strconv.Itoa(int(window.Seconds())),
					})
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// RateLimitByEndpoint creates a middleware that rate limits by endpoint + IP/subscription.
// This allows different rate limits for different endpoints.
func RateLimitByEndpoint(cache db.Cache, limit int64, window time.Duration) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Determine identifier (subscription ID or IP)
			var identifier string
			sub := GetSubscriptionFromContext(r.Context())
			if sub != nil {
				identifier = "sub:" + sub.ID.String()
			} else {
				identifier = "ip:" + getClientIP(r)
			}

			// Build rate limit key including endpoint
			key := fmt.Sprintf("ratelimit:%s:%s:%s", r.Method, r.URL.Path, identifier)

			// Increment counter
			count, err := cache.IncrementRateLimit(r.Context(), key, window)
			if err != nil {
				log.Error().Err(err).Str("key", key).Msg("Failed to check rate limit")
				next.ServeHTTP(w, r)
				return
			}

			// Set rate limit headers
			w.Header().Set("X-RateLimit-Limit", strconv.FormatInt(limit, 10))
			remaining := limit - count
			if remaining < 0 {
				remaining = 0
			}
			w.Header().Set("X-RateLimit-Remaining", strconv.FormatInt(remaining, 10))
			w.Header().Set("X-RateLimit-Reset", strconv.FormatInt(time.Now().Add(window).Unix(), 10))

			// Check if over limit
			if count > limit {
				w.Header().Set("Retry-After", strconv.Itoa(int(window.Seconds())))
				writeJSONError(w, http.StatusTooManyRequests, "RATE_LIMIT_EXCEEDED",
					fmt.Sprintf("Rate limit exceeded for this endpoint. Maximum %d requests per %s", limit, window),
					nil)
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// getClientIP extracts the client IP address from the request.
// It checks X-Forwarded-For, X-Real-IP headers, and falls back to RemoteAddr.
func getClientIP(r *http.Request) string {
	// Check X-Forwarded-For header (may contain multiple IPs)
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		// Take the first IP in the list
		for i := 0; i < len(xff); i++ {
			if xff[i] == ',' {
				return xff[:i]
			}
		}
		return xff
	}

	// Check X-Real-IP header
	if xri := r.Header.Get("X-Real-IP"); xri != "" {
		return xri
	}

	// Fall back to RemoteAddr (remove port if present)
	addr := r.RemoteAddr
	for i := len(addr) - 1; i >= 0; i-- {
		if addr[i] == ':' {
			return addr[:i]
		}
	}
	return addr
}

// BurstRateLimiter provides a token bucket rate limiter for more advanced rate limiting.
type BurstRateLimiter struct {
	cache       db.Cache
	rate        int64         // Tokens added per window
	burst       int64         // Maximum tokens (bucket size)
	window      time.Duration // Time window for adding tokens
}

// NewBurstRateLimiter creates a new burst rate limiter.
func NewBurstRateLimiter(cache db.Cache, rate, burst int64, window time.Duration) *BurstRateLimiter {
	return &BurstRateLimiter{
		cache:  cache,
		rate:   rate,
		burst:  burst,
		window: window,
	}
}

// Allow checks if a request should be allowed and consumes a token if so.
func (rl *BurstRateLimiter) Allow(r *http.Request) (bool, error) {
	// Get identifier
	var identifier string
	sub := GetSubscriptionFromContext(r.Context())
	if sub != nil {
		identifier = "sub:" + sub.ID.String()
	} else {
		identifier = "ip:" + getClientIP(r)
	}

	key := fmt.Sprintf("burst:tokens:%s", identifier)
	
	// For simplicity, use the basic rate limit
	// A full token bucket implementation would need Lua scripting in Redis
	count, err := rl.cache.IncrementRateLimit(r.Context(), key, rl.window)
	if err != nil {
		return true, err // Fail open
	}

	return count <= rl.burst, nil
}
