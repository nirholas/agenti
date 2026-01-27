// Package handlers provides HTTP request handlers for the API.
package handlers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-playground/validator/v10"
	"github.com/google/uuid"
	"github.com/gorilla/feeds"
	"github.com/rs/zerolog/log"

	"github.com/nirholas/mcp-notify/internal/db"
	"github.com/nirholas/mcp-notify/internal/registry"
	"github.com/nirholas/mcp-notify/internal/subscription"
	"github.com/nirholas/mcp-notify/pkg/types"
)

// Config holds handler dependencies.
type Config struct {
	Database        db.Database
	Cache           db.Cache
	SubscriptionMgr *subscription.Manager
	RegistryClient  *registry.Client
	Version         string
	OpenAPISpec     []byte
}

// Handlers contains all HTTP handlers.
type Handlers struct {
	db              db.Database
	cache           db.Cache
	subscriptionMgr *subscription.Manager
	registryClient  *registry.Client
	validate        *validator.Validate
	version         string
	openAPISpec     []byte
}

// New creates a new Handlers instance.
func New(cfg Config) *Handlers {
	version := cfg.Version
	if version == "" {
		version = "dev"
	}
	return &Handlers{
		db:              cfg.Database,
		cache:           cfg.Cache,
		subscriptionMgr: cfg.SubscriptionMgr,
		registryClient:  cfg.RegistryClient,
		validate:        validator.New(),
		version:         version,
		openAPISpec:     cfg.OpenAPISpec,
	}
}

// Health returns the health status.
func (h *Handlers) Health(w http.ResponseWriter, r *http.Request) {
	response := types.HealthResponse{
		Status:    "healthy",
		Version:   h.version,
		Timestamp: time.Now().UTC(),
		Checks:    make(map[string]string),
	}

	// Check database
	if err := h.db.Ping(r.Context()); err != nil {
		response.Checks["database"] = "unhealthy"
		response.Status = "degraded"
	} else {
		response.Checks["database"] = "healthy"
	}

	// Check registry
	if err := h.registryClient.HealthCheck(r.Context()); err != nil {
		response.Checks["registry"] = "unhealthy"
	} else {
		response.Checks["registry"] = "healthy"
	}

	status := http.StatusOK
	if response.Status != "healthy" {
		status = http.StatusServiceUnavailable
	}

	writeJSON(w, status, response)
}

// Ready returns readiness status.
func (h *Handlers) Ready(w http.ResponseWriter, r *http.Request) {
	if err := h.db.Ping(r.Context()); err != nil {
		writeError(w, http.StatusServiceUnavailable, "Database not ready", "")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ready"})
}

// GetStats returns service statistics.
func (h *Handlers) GetStats(w http.ResponseWriter, r *http.Request) {
	stats, err := h.db.GetStats(r.Context())
	if err != nil {
		log.Error().Err(err).Msg("Failed to get stats")
		writeError(w, http.StatusInternalServerError, "Failed to get stats", "")
		return
	}
	writeJSON(w, http.StatusOK, stats)
}

// CreateSubscription creates a new subscription.
func (h *Handlers) CreateSubscription(w http.ResponseWriter, r *http.Request) {
	var req types.CreateSubscriptionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body", "")
		return
	}

	if err := h.validate.Struct(req); err != nil {
		writeError(w, http.StatusBadRequest, "Validation failed", err.Error())
		return
	}

	// Create subscription
	sub, apiKey, err := h.subscriptionMgr.Create(r.Context(), req)
	if err != nil {
		log.Error().Err(err).Msg("Failed to create subscription")
		writeError(w, http.StatusInternalServerError, "Failed to create subscription", "")
		return
	}

	// Return subscription with API key (only shown once)
	response := types.SubscriptionResponse{
		Subscription: *sub,
		APIKey:       apiKey,
	}

	writeJSON(w, http.StatusCreated, response)
}

// ListSubscriptions lists all subscriptions (admin only or limited info).
func (h *Handlers) ListSubscriptions(w http.ResponseWriter, r *http.Request) {
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 || limit > 100 {
		limit = 20
	}

	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	if offset < 0 {
		offset = 0
	}

	subscriptions, total, err := h.db.ListSubscriptions(r.Context(), limit, offset)
	if err != nil {
		log.Error().Err(err).Msg("Failed to list subscriptions")
		writeError(w, http.StatusInternalServerError, "Failed to list subscriptions", "")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"subscriptions": subscriptions,
		"total":         total,
		"limit":         limit,
		"offset":        offset,
	})
}

// GetSubscription returns a single subscription.
func (h *Handlers) GetSubscription(w http.ResponseWriter, r *http.Request) {
	sub := r.Context().Value("subscription").(*types.Subscription)
	writeJSON(w, http.StatusOK, sub)
}

// UpdateSubscription updates a subscription.
func (h *Handlers) UpdateSubscription(w http.ResponseWriter, r *http.Request) {
	sub := r.Context().Value("subscription").(*types.Subscription)

	var req types.UpdateSubscriptionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body", "")
		return
	}

	if err := h.validate.Struct(req); err != nil {
		writeError(w, http.StatusBadRequest, "Validation failed", err.Error())
		return
	}

	updated, err := h.subscriptionMgr.Update(r.Context(), sub.ID, req)
	if err != nil {
		log.Error().Err(err).Msg("Failed to update subscription")
		writeError(w, http.StatusInternalServerError, "Failed to update subscription", "")
		return
	}

	writeJSON(w, http.StatusOK, updated)
}

// DeleteSubscription deletes a subscription.
func (h *Handlers) DeleteSubscription(w http.ResponseWriter, r *http.Request) {
	sub := r.Context().Value("subscription").(*types.Subscription)

	if err := h.subscriptionMgr.Delete(r.Context(), sub.ID); err != nil {
		log.Error().Err(err).Msg("Failed to delete subscription")
		writeError(w, http.StatusInternalServerError, "Failed to delete subscription", "")
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

// PauseSubscription pauses a subscription.
func (h *Handlers) PauseSubscription(w http.ResponseWriter, r *http.Request) {
	sub := r.Context().Value("subscription").(*types.Subscription)

	if err := h.subscriptionMgr.Pause(r.Context(), sub.ID); err != nil {
		log.Error().Err(err).Msg("Failed to pause subscription")
		writeError(w, http.StatusInternalServerError, "Failed to pause subscription", "")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "paused"})
}

// ResumeSubscription resumes a paused subscription.
func (h *Handlers) ResumeSubscription(w http.ResponseWriter, r *http.Request) {
	sub := r.Context().Value("subscription").(*types.Subscription)

	if err := h.subscriptionMgr.Resume(r.Context(), sub.ID); err != nil {
		log.Error().Err(err).Msg("Failed to resume subscription")
		writeError(w, http.StatusInternalServerError, "Failed to resume subscription", "")
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "active"})
}

// TestSubscription sends a test notification to all channels.
func (h *Handlers) TestSubscription(w http.ResponseWriter, r *http.Request) {
	sub := r.Context().Value("subscription").(*types.Subscription)

	results, err := h.subscriptionMgr.SendTestNotification(r.Context(), sub.ID)
	if err != nil {
		log.Error().Err(err).Msg("Failed to send test notification")
		writeError(w, http.StatusInternalServerError, "Failed to send test notification", "")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"message": "Test notifications sent",
		"results": results,
	})
}

// GetSubscriptionNotifications returns notifications for a subscription.
func (h *Handlers) GetSubscriptionNotifications(w http.ResponseWriter, r *http.Request) {
	sub := r.Context().Value("subscription").(*types.Subscription)

	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 || limit > 100 {
		limit = 50
	}

	notifications, err := h.db.GetNotificationsForSubscription(r.Context(), sub.ID, limit)
	if err != nil {
		log.Error().Err(err).Msg("Failed to get notifications")
		writeError(w, http.StatusInternalServerError, "Failed to get notifications", "")
		return
	}

	writeJSON(w, http.StatusOK, notifications)
}

// ListChanges returns recent changes.
func (h *Handlers) ListChanges(w http.ResponseWriter, r *http.Request) {
	// Parse query parameters
	sinceStr := r.URL.Query().Get("since")
	var since time.Time
	if sinceStr != "" {
		var err error
		since, err = time.Parse(time.RFC3339, sinceStr)
		if err != nil {
			writeError(w, http.StatusBadRequest, "Invalid 'since' parameter", "Expected RFC3339 format")
			return
		}
	} else {
		since = time.Now().Add(-24 * time.Hour) // Default to last 24 hours
	}

	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 || limit > 500 {
		limit = 100
	}

	changes, err := h.db.GetChangesSince(r.Context(), since, limit)
	if err != nil {
		log.Error().Err(err).Msg("Failed to get changes")
		writeError(w, http.StatusInternalServerError, "Failed to get changes", "")
		return
	}

	writeJSON(w, http.StatusOK, types.ChangesResponse{
		Changes:    changes,
		TotalCount: len(changes),
	})
}

// GetChange returns a single change.
func (h *Handlers) GetChange(w http.ResponseWriter, r *http.Request) {
	changeID := chi.URLParam(r, "changeID")
	id, err := uuid.Parse(changeID)
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid change ID", "")
		return
	}

	change, err := h.db.GetChangeByID(r.Context(), id)
	if err != nil {
		log.Error().Err(err).Msg("Failed to get change")
		writeError(w, http.StatusInternalServerError, "Failed to get change", "")
		return
	}

	if change == nil {
		writeError(w, http.StatusNotFound, "Change not found", "")
		return
	}

	writeJSON(w, http.StatusOK, change)
}

// ListServers lists servers from the registry.
func (h *Handlers) ListServers(w http.ResponseWriter, r *http.Request) {
	servers, err := h.registryClient.ListServers(r.Context())
	if err != nil {
		log.Error().Err(err).Msg("Failed to list servers")
		writeError(w, http.StatusInternalServerError, "Failed to list servers", "")
		return
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"servers": servers,
		"count":   len(servers),
	})
}

// GetServer returns a single server from the registry.
func (h *Handlers) GetServer(w http.ResponseWriter, r *http.Request) {
	serverName := chi.URLParam(r, "serverName")

	server, err := h.registryClient.GetServer(r.Context(), serverName)
	if err != nil {
		log.Error().Err(err).Msg("Failed to get server")
		writeError(w, http.StatusInternalServerError, "Failed to get server", "")
		return
	}

	if server == nil {
		writeError(w, http.StatusNotFound, "Server not found", "")
		return
	}

	writeJSON(w, http.StatusOK, server)
}

// GetServerChanges returns changes for a specific server.
func (h *Handlers) GetServerChanges(w http.ResponseWriter, r *http.Request) {
	serverName := chi.URLParam(r, "serverName")

	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 || limit > 100 {
		limit = 50
	}

	changes, err := h.db.GetChangesForServer(r.Context(), serverName, limit)
	if err != nil {
		log.Error().Err(err).Msg("Failed to get server changes")
		writeError(w, http.StatusInternalServerError, "Failed to get server changes", "")
		return
	}

	writeJSON(w, http.StatusOK, changes)
}

// RSSFeed returns an RSS feed of recent changes.
func (h *Handlers) RSSFeed(w http.ResponseWriter, r *http.Request) {
	feed, err := h.buildFeed(r)
	if err != nil {
		log.Error().Err(err).Msg("Failed to build feed")
		writeError(w, http.StatusInternalServerError, "Failed to build feed", "")
		return
	}

	rss, err := feed.ToRss()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to generate RSS", "")
		return
	}

	w.Header().Set("Content-Type", "application/rss+xml; charset=utf-8")
	w.Write([]byte(rss))
}

// AtomFeed returns an Atom feed of recent changes.
func (h *Handlers) AtomFeed(w http.ResponseWriter, r *http.Request) {
	feed, err := h.buildFeed(r)
	if err != nil {
		log.Error().Err(err).Msg("Failed to build feed")
		writeError(w, http.StatusInternalServerError, "Failed to build feed", "")
		return
	}

	atom, err := feed.ToAtom()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to generate Atom", "")
		return
	}

	w.Header().Set("Content-Type", "application/atom+xml; charset=utf-8")
	w.Write([]byte(atom))
}

// JSONFeed returns a JSON feed of recent changes.
func (h *Handlers) JSONFeed(w http.ResponseWriter, r *http.Request) {
	feed, err := h.buildFeed(r)
	if err != nil {
		log.Error().Err(err).Msg("Failed to build feed")
		writeError(w, http.StatusInternalServerError, "Failed to build feed", "")
		return
	}

	jsonFeed, err := feed.ToJSON()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "Failed to generate JSON feed", "")
		return
	}

	w.Header().Set("Content-Type", "application/feed+json; charset=utf-8")
	w.Write([]byte(jsonFeed))
}

func (h *Handlers) buildFeed(r *http.Request) (*feeds.Feed, error) {
	// Get recent changes
	since := time.Now().Add(-7 * 24 * time.Hour) // Last 7 days
	changes, err := h.db.GetChangesSince(r.Context(), since, 100)
	if err != nil {
		return nil, err
	}

	feed := &feeds.Feed{
		Title:       "MCP Registry Changes",
		Link:        &feeds.Link{Href: "https://registry.modelcontextprotocol.io"},
		Description: "Recent changes in the MCP Registry",
		Author:      &feeds.Author{Name: "MCP Notify"},
		Created:     time.Now(),
	}

	for _, change := range changes {
		var title, description string
		switch change.ChangeType {
		case types.ChangeTypeNew:
			title = "New: " + change.ServerName
			description = "New MCP server added to the registry"
		case types.ChangeTypeUpdated:
			title = "Updated: " + change.ServerName
			if change.PreviousVersion != "" && change.NewVersion != "" {
				description = fmt.Sprintf("Updated from %s to %s", change.PreviousVersion, change.NewVersion)
			} else {
				description = "Server updated"
			}
		case types.ChangeTypeRemoved:
			title = "Removed: " + change.ServerName
			description = "Server removed from the registry"
		}

		if change.Server != nil && change.Server.Description != "" {
			description += "\n\n" + change.Server.Description
		}

		feed.Items = append(feed.Items, &feeds.Item{
			Title:       title,
			Link:        &feeds.Link{Href: fmt.Sprintf("https://registry.modelcontextprotocol.io/servers/%s", change.ServerName)},
			Description: description,
			Id:          change.ID.String(),
			Created:     change.DetectedAt,
		})
	}

	return feed, nil
}

// TestWebhook tests a webhook URL without creating a subscription.
func (h *Handlers) TestWebhook(w http.ResponseWriter, r *http.Request) {
	var req struct {
		URL     string            `json:"url" validate:"required,url"`
		Secret  string            `json:"secret,omitempty"`
		Headers map[string]string `json:"headers,omitempty"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "Invalid request body", "")
		return
	}

	if err := h.validate.Struct(req); err != nil {
		writeError(w, http.StatusBadRequest, "Validation failed", err.Error())
		return
	}

	// Send test webhook
	testPayload := map[string]interface{}{
		"type":      "test",
		"message":   "This is a test webhook from MCP Notify",
		"timestamp": time.Now().UTC().Format(time.RFC3339),
	}

	body, _ := json.Marshal(testPayload)
	httpReq, err := http.NewRequestWithContext(r.Context(), "POST", req.URL, bytes.NewReader(body))
	if err != nil {
		writeError(w, http.StatusBadRequest, "Invalid webhook URL", err.Error())
		return
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("User-Agent", "MCP-Notify/1.0")
	for k, v := range req.Headers {
		httpReq.Header.Set(k, v)
	}

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]interface{}{
			"status":  "error",
			"message": "Failed to send webhook",
			"error":   err.Error(),
		})
		return
	}
	defer resp.Body.Close()

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"status":      "success",
		"message":     "Test webhook sent",
		"status_code": resp.StatusCode,
	})
}

// ServeOpenAPISpec serves the OpenAPI documentation UI.
func (h *Handlers) ServeOpenAPISpec(w http.ResponseWriter, r *http.Request) {
	// Serve Swagger UI or Redoc
	html := `<!DOCTYPE html>
<html>
<head>
    <title>MCP Notify API</title>
    <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
        SwaggerUIBundle({
            url: "/api/openapi.yaml",
            dom_id: '#swagger-ui',
        });
    </script>
</body>
</html>`
	w.Header().Set("Content-Type", "text/html")
	w.Write([]byte(html))
}

// ServeOpenAPIYAML serves the OpenAPI specification file.
func (h *Handlers) ServeOpenAPIYAML(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/yaml")
	if len(h.openAPISpec) > 0 {
		w.Write(h.openAPISpec)
	} else {
		http.Error(w, "OpenAPI spec not available", http.StatusNotFound)
	}
}

// Helper functions

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func writeError(w http.ResponseWriter, status int, message, details string) {
	response := types.ErrorResponse{
		Error: message,
	}
	if details != "" {
		response.Details = map[string]string{"info": details}
	}
	writeJSON(w, status, response)
}
