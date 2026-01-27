// Package middleware provides HTTP middleware for the API server.
package middleware

import (
	"context"
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/rs/zerolog/log"

	"github.com/nirholas/mcp-notify/internal/subscription"
	"github.com/nirholas/mcp-notify/pkg/types"
)

// APIKeyAuth creates a middleware that authenticates requests using API key.
// The API key can be provided in the Authorization header (Bearer token), X-API-Key header,
// or as a query parameter (not recommended for security).
// This middleware validates the API key against the subscription manager.
func APIKeyAuth(subscriptionMgr *subscription.Manager) func(next http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Extract API key from request
			apiKey := extractAPIKey(r)
			if apiKey == "" {
				writeJSONError(w, http.StatusUnauthorized, "API_KEY_REQUIRED", "API key is required", nil)
				return
			}

			// Validate API key and get subscription
			sub, err := subscriptionMgr.ValidateAPIKey(r.Context(), apiKey)
			if err != nil {
				log.Error().Err(err).Msg("Failed to validate API key")
				writeJSONError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to validate API key", nil)
				return
			}

			if sub == nil {
				writeJSONError(w, http.StatusUnauthorized, "INVALID_API_KEY", "Invalid API key", nil)
				return
			}

			// Check if subscription is active
			if sub.Status != types.SubscriptionStatusActive {
				writeJSONError(w, http.StatusForbidden, "SUBSCRIPTION_INACTIVE", "Subscription is not active", map[string]string{
					"status": string(sub.Status),
				})
				return
			}

			// Store subscription in context
			ctx := context.WithValue(r.Context(), SubscriptionContextKey, sub)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// APIKeyAuthForSubscription creates a middleware that authenticates requests and verifies
// the API key belongs to the subscription specified in the URL.
func APIKeyAuthForSubscription(subscriptionMgr *subscription.Manager) func(next http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Get subscription ID from URL
			subscriptionIDStr := chi.URLParam(r, "subscriptionID")
			if subscriptionIDStr == "" {
				writeJSONError(w, http.StatusBadRequest, "SUBSCRIPTION_ID_REQUIRED", "Subscription ID is required", nil)
				return
			}

			subscriptionID, err := uuid.Parse(subscriptionIDStr)
			if err != nil {
				writeJSONError(w, http.StatusBadRequest, "INVALID_SUBSCRIPTION_ID", "Invalid subscription ID format", nil)
				return
			}

			// Extract API key from request
			apiKey := extractAPIKey(r)
			if apiKey == "" {
				writeJSONError(w, http.StatusUnauthorized, "API_KEY_REQUIRED", "API key is required", nil)
				return
			}

			// Validate API key
			sub, err := subscriptionMgr.ValidateAPIKey(r.Context(), apiKey)
			if err != nil {
				log.Error().Err(err).Msg("Failed to validate API key")
				writeJSONError(w, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to validate API key", nil)
				return
			}

			if sub == nil {
				writeJSONError(w, http.StatusUnauthorized, "INVALID_API_KEY", "Invalid API key", nil)
				return
			}

			// Verify the API key belongs to the requested subscription
			if sub.ID != subscriptionID {
				writeJSONError(w, http.StatusForbidden, "ACCESS_DENIED", "API key does not match subscription", nil)
				return
			}

			// Check if subscription is active (allow paused for some operations)
			if sub.Status == types.SubscriptionStatusExpired {
				writeJSONError(w, http.StatusForbidden, "SUBSCRIPTION_EXPIRED", "Subscription has expired", nil)
				return
			}

			// Store subscription in context
			ctx := context.WithValue(r.Context(), SubscriptionContextKey, sub)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// PublicEndpoint is a middleware that marks an endpoint as public (no auth required).
// It can be used for documentation purposes and to skip authentication.
func PublicEndpoint(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Just pass through, no authentication required
		next.ServeHTTP(w, r)
	})
}

// OptionalAuth is a middleware that attempts to authenticate but allows unauthenticated requests.
// If authentication succeeds, the subscription is stored in context.
func OptionalAuth(subscriptionMgr *subscription.Manager) func(next http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Extract API key from request
			apiKey := extractAPIKey(r)
			if apiKey == "" {
				// No API key provided, continue without authentication
				next.ServeHTTP(w, r)
				return
			}

			// Try to validate API key
			sub, err := subscriptionMgr.ValidateAPIKey(r.Context(), apiKey)
			if err != nil {
				log.Debug().Err(err).Msg("Optional auth: failed to validate API key")
				next.ServeHTTP(w, r)
				return
			}

			if sub != nil && sub.Status == types.SubscriptionStatusActive {
				// Store subscription in context
				ctx := context.WithValue(r.Context(), SubscriptionContextKey, sub)
				next.ServeHTTP(w, r.WithContext(ctx))
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// Note: extractAPIKey and hashAPIKey are defined in middleware.go

// writeJSONError writes a JSON error response.
func writeJSONError(w http.ResponseWriter, status int, code, message string, details map[string]string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	
	response := map[string]interface{}{
		"error": map[string]interface{}{
			"code":    code,
			"message": message,
		},
	}
	
	if details != nil {
		response["error"].(map[string]interface{})["details"] = details
	}
	
	json.NewEncoder(w).Encode(response)
}
