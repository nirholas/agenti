// Package mocks provides mock implementations for testing.
package mocks

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"sync"

	"github.com/nirholas/mcp-notify/pkg/types"
)

// MockRegistryServer is a mock implementation of the MCP Registry API.
type MockRegistryServer struct {
	servers   []types.Server
	mu        sync.RWMutex
	pageSize  int
	server    *httptest.Server
	
	// Request tracking for assertions
	RequestCount int
	LastRequest  *http.Request
}

// NewMockRegistry creates a new mock registry server.
func NewMockRegistry(servers []types.Server) *MockRegistryServer {
	// Make a copy to avoid modifying the original slice
	serversCopy := make([]types.Server, len(servers))
	copy(serversCopy, servers)
	
	m := &MockRegistryServer{
		servers:  serversCopy,
		pageSize: 100,
	}
	m.server = httptest.NewServer(m)
	return m
}

// URL returns the mock server URL.
func (m *MockRegistryServer) URL() string {
	return m.server.URL
}

// Close shuts down the mock server.
func (m *MockRegistryServer) Close() {
	m.server.Close()
}

// SetServers replaces the server list.
func (m *MockRegistryServer) SetServers(servers []types.Server) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.servers = servers
}

// GetServers returns a copy of the current server list.
func (m *MockRegistryServer) GetServers() []types.Server {
	m.mu.RLock()
	defer m.mu.RUnlock()
	result := make([]types.Server, len(m.servers))
	copy(result, m.servers)
	return result
}

// AddServer adds a new server.
func (m *MockRegistryServer) AddServer(server types.Server) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.servers = append(m.servers, server)
}

// UpdateServer updates an existing server by name.
func (m *MockRegistryServer) UpdateServer(name string, server types.Server) bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	for i, s := range m.servers {
		if s.Name == name {
			m.servers[i] = server
			return true
		}
	}
	return false
}

// RemoveServer removes a server by name.
func (m *MockRegistryServer) RemoveServer(name string) bool {
	m.mu.Lock()
	defer m.mu.Unlock()
	for i, s := range m.servers {
		if s.Name == name {
			m.servers = append(m.servers[:i], m.servers[i+1:]...)
			return true
		}
	}
	return false
}

// SetPageSize sets the page size for pagination.
func (m *MockRegistryServer) SetPageSize(size int) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.pageSize = size
}

// ServeHTTP implements the http.Handler interface.
func (m *MockRegistryServer) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	m.mu.Lock()
	m.RequestCount++
	m.LastRequest = r
	m.mu.Unlock()

	switch r.URL.Path {
	case "/v0/servers":
		m.handleListServers(w, r)
	case "/health":
		m.handleHealth(w, r)
	default:
		http.NotFound(w, r)
	}
}

func (m *MockRegistryServer) handleListServers(w http.ResponseWriter, r *http.Request) {
	m.mu.RLock()
	servers := m.servers
	pageSize := m.pageSize
	m.mu.RUnlock()

	// Parse query parameters
	query := r.URL.Query()

	limit := pageSize
	if limitStr := query.Get("limit"); limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
			limit = l
		}
	}

	cursor := 0
	if cursorStr := query.Get("cursor"); cursorStr != "" {
		if c, err := strconv.Atoi(cursorStr); err == nil && c >= 0 {
			cursor = c
		}
	}

	// Paginate
	start := cursor
	end := cursor + limit
	if start > len(servers) {
		start = len(servers)
	}
	if end > len(servers) {
		end = len(servers)
	}

	pageServers := servers[start:end]

	// Determine next cursor
	nextCursor := ""
	if end < len(servers) {
		nextCursor = strconv.Itoa(end)
	}

	// Build response in the same format as the real MCP Registry API
	type serverWrapper struct {
		Server struct {
			Name        string `json:"name"`
			Description string `json:"description"`
			Repository  *struct {
				URL    string `json:"url"`
				Source string `json:"source"`
			} `json:"repository,omitempty"`
			Version  string `json:"version,omitempty"`
			Packages []struct {
				RegistryType string `json:"registryType"`
				Name         string `json:"name"`
			} `json:"packages,omitempty"`
		} `json:"server"`
		Meta struct {
			Official struct {
				Status      string `json:"status"`
				PublishedAt string `json:"publishedAt"`
				UpdatedAt   string `json:"updatedAt"`
				IsLatest    bool   `json:"isLatest"`
			} `json:"io.modelcontextprotocol.registry/official"`
		} `json:"_meta"`
	}

	wrappedServers := make([]serverWrapper, 0, len(pageServers))
	for _, s := range pageServers {
		var sw serverWrapper
		sw.Server.Name = s.Name
		sw.Server.Description = s.Description
		if s.Repository != nil {
			sw.Server.Repository = &struct {
				URL    string `json:"url"`
				Source string `json:"source"`
			}{
				URL:    s.Repository.URL,
				Source: s.Repository.Source,
			}
		}
		if s.VersionDetail != nil {
			sw.Server.Version = s.VersionDetail.Version
			sw.Meta.Official.IsLatest = s.VersionDetail.IsLatest
		}
		sw.Meta.Official.Status = "active"
		sw.Meta.Official.PublishedAt = s.CreatedAt.Format("2006-01-02T15:04:05.999999Z")
		sw.Meta.Official.UpdatedAt = s.UpdatedAt.Format("2006-01-02T15:04:05.999999Z")
		wrappedServers = append(wrappedServers, sw)
	}

	response := struct {
		Servers  []serverWrapper `json:"servers"`
		Metadata struct {
			NextCursor string `json:"nextCursor,omitempty"`
			Count      int    `json:"count"`
		} `json:"metadata"`
	}{
		Servers: wrappedServers,
	}
	response.Metadata.NextCursor = nextCursor
	response.Metadata.Count = len(pageServers)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (m *MockRegistryServer) handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{"status": "healthy"})
}

// ResetRequestCount resets the request counter.
func (m *MockRegistryServer) ResetRequestCount() {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.RequestCount = 0
	m.LastRequest = nil
}
