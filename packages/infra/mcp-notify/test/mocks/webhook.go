package mocks

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"sync"
)

// WebhookCapture captures webhook requests for testing.
type WebhookCapture struct {
	Requests []CapturedRequest
	mu       sync.Mutex
	server   *httptest.Server
	
	// Response configuration
	StatusCode int
	Response   interface{}
	ShouldFail bool
}

// CapturedRequest represents a captured HTTP request.
type CapturedRequest struct {
	Method  string
	Path    string
	Headers http.Header
	Body    []byte
}

// NewWebhookCapture creates a new webhook capture server.
func NewWebhookCapture() *WebhookCapture {
	w := &WebhookCapture{
		Requests:   make([]CapturedRequest, 0),
		StatusCode: http.StatusOK,
	}
	w.server = httptest.NewServer(w)
	return w
}

// URL returns the capture server URL.
func (w *WebhookCapture) URL() string {
	return w.server.URL
}

// Close shuts down the capture server.
func (w *WebhookCapture) Close() {
	w.server.Close()
}

// ServeHTTP implements the http.Handler interface.
func (w *WebhookCapture) ServeHTTP(rw http.ResponseWriter, r *http.Request) {
	w.mu.Lock()
	defer w.mu.Unlock()

	// Read body
	var body []byte
	if r.Body != nil {
		body = make([]byte, r.ContentLength)
		r.Body.Read(body)
	}

	// Capture request
	w.Requests = append(w.Requests, CapturedRequest{
		Method:  r.Method,
		Path:    r.URL.Path,
		Headers: r.Header.Clone(),
		Body:    body,
	})

	// Send configured response
	if w.ShouldFail {
		http.Error(rw, "simulated failure", http.StatusInternalServerError)
		return
	}

	rw.WriteHeader(w.StatusCode)
	if w.Response != nil {
		json.NewEncoder(rw).Encode(w.Response)
	}
}

// GetRequests returns all captured requests.
func (w *WebhookCapture) GetRequests() []CapturedRequest {
	w.mu.Lock()
	defer w.mu.Unlock()
	result := make([]CapturedRequest, len(w.Requests))
	copy(result, w.Requests)
	return result
}

// Reset clears all captured requests.
func (w *WebhookCapture) Reset() {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.Requests = make([]CapturedRequest, 0)
	w.StatusCode = http.StatusOK
	w.Response = nil
	w.ShouldFail = false
}

// SetFailure configures the mock to return errors.
func (w *WebhookCapture) SetFailure(shouldFail bool) {
	w.mu.Lock()
	defer w.mu.Unlock()
	w.ShouldFail = shouldFail
}

// LastRequest returns the most recent captured request.
func (w *WebhookCapture) LastRequest() *CapturedRequest {
	w.mu.Lock()
	defer w.mu.Unlock()
	if len(w.Requests) == 0 {
		return nil
	}
	return &w.Requests[len(w.Requests)-1]
}

// RequestCount returns the number of captured requests.
func (w *WebhookCapture) RequestCount() int {
	w.mu.Lock()
	defer w.mu.Unlock()
	return len(w.Requests)
}
