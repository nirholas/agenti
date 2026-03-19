package gin

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	v2 "github.com/mark3labs/x402-go/v2"
	v2http "github.com/mark3labs/x402-go/v2/http"
)

func init() {
	// Disable Gin debug mode for cleaner test output
	gin.SetMode(gin.TestMode)
}

// TestGinMiddleware_NoPaymentReturns402 tests that requests without X-PAYMENT header return 402
func TestGinMiddleware_NoPaymentReturns402(t *testing.T) {
	// Create middleware config
	config := v2http.Config{
		FacilitatorURL: "http://mock-facilitator.test",
		Resource: v2.ResourceInfo{
			URL:         "https://api.example.com/test",
			Description: "Test resource",
		},
		PaymentRequirements: []v2.PaymentRequirements{
			{
				Scheme:            "exact",
				Network:           "eip155:84532", // Base Sepolia (CAIP-2 format)
				Amount:            "10000",
				Asset:             "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
				PayTo:             "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
				MaxTimeoutSeconds: 60,
			},
		},
	}

	// Create Gin router with middleware
	r := gin.New()
	r.Use(NewX402Middleware(config))

	// Add test handler
	r.GET("/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "success"})
	})

	// Make request without payment
	req := httptest.NewRequest("GET", "/test", nil)
	rec := httptest.NewRecorder()

	r.ServeHTTP(rec, req)

	// Expect 402 Payment Required
	if rec.Code != http.StatusPaymentRequired {
		t.Errorf("Expected status %d, got %d", http.StatusPaymentRequired, rec.Code)
	}

	// Check response is JSON (Gin adds charset automatically)
	contentType := rec.Header().Get("Content-Type")
	if contentType != "application/json; charset=utf-8" {
		t.Errorf("Expected Content-Type application/json; charset=utf-8, got %s", contentType)
	}

	// Verify response body structure
	var response v2.PaymentRequired
	if err := json.NewDecoder(rec.Body).Decode(&response); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}

	if response.X402Version != v2.X402Version {
		t.Errorf("Expected x402Version %d, got %d", v2.X402Version, response.X402Version)
	}

	if len(response.Accepts) != 1 {
		t.Errorf("Expected 1 accept option, got %d", len(response.Accepts))
	}

	if response.Accepts[0].Network != "eip155:84532" {
		t.Errorf("Expected network eip155:84532, got %s", response.Accepts[0].Network)
	}
}

// TestGinMiddleware_VerifyOnlyMode tests verification-only mode without settlement
func TestGinMiddleware_VerifyOnlyMode(t *testing.T) {
	// Create middleware config with VerifyOnly flag
	config := v2http.Config{
		FacilitatorURL: "http://mock-facilitator.test",
		VerifyOnly:     true, // Key difference - only verify, don't settle
		Resource: v2.ResourceInfo{
			URL:         "https://api.example.com/test",
			Description: "Test resource",
		},
		PaymentRequirements: []v2.PaymentRequirements{
			{
				Scheme:            "exact",
				Network:           "eip155:84532",
				Amount:            "10000",
				Asset:             "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
				PayTo:             "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
				MaxTimeoutSeconds: 60,
			},
		},
	}

	// Create Gin router with middleware
	r := gin.New()
	r.Use(NewX402Middleware(config))

	// Add test handler
	r.GET("/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "success"})
	})

	// Make request without payment - should return 402
	req := httptest.NewRequest("GET", "/test", nil)
	rec := httptest.NewRecorder()

	r.ServeHTTP(rec, req)

	// Expect 402 Payment Required
	if rec.Code != http.StatusPaymentRequired {
		t.Errorf("Expected status %d, got %d", http.StatusPaymentRequired, rec.Code)
	}

	// Verify X-PAYMENT-RESPONSE header is NOT present in 402 response
	if rec.Header().Get("X-PAYMENT-RESPONSE") != "" {
		t.Error("Expected no X-PAYMENT-RESPONSE header on 402 response")
	}
}

// TestGinMiddleware_RouterGroupSupport tests middleware with gin.RouterGroup
func TestGinMiddleware_RouterGroupSupport(t *testing.T) {
	// Create middleware config
	config := v2http.Config{
		FacilitatorURL: "http://mock-facilitator.test",
		Resource: v2.ResourceInfo{
			URL:         "https://api.example.com/test",
			Description: "Test resource",
		},
		PaymentRequirements: []v2.PaymentRequirements{
			{
				Scheme:            "exact",
				Network:           "eip155:84532",
				Amount:            "10000",
				Asset:             "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
				PayTo:             "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
				MaxTimeoutSeconds: 60,
			},
		},
	}

	// Create Gin router
	r := gin.New()

	// Create protected group with middleware
	protected := r.Group("/protected")
	protected.Use(NewX402Middleware(config))
	{
		protected.GET("/resource", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"message": "protected"})
		})
	}

	// Create public group without middleware
	public := r.Group("/public")
	{
		public.GET("/resource", func(c *gin.Context) {
			c.JSON(http.StatusOK, gin.H{"message": "public"})
		})
	}

	// Test protected endpoint without payment - should return 402
	req := httptest.NewRequest("GET", "/protected/resource", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusPaymentRequired {
		t.Errorf("Protected endpoint: expected status %d, got %d", http.StatusPaymentRequired, rec.Code)
	}

	// Test public endpoint without payment - should return 200
	req = httptest.NewRequest("GET", "/public/resource", nil)
	rec = httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("Public endpoint: expected status %d, got %d", http.StatusOK, rec.Code)
	}
}

// TestGinMiddleware_AbortOnFailure tests that c.Abort() properly stops handler chain
func TestGinMiddleware_AbortOnFailure(t *testing.T) {
	// Create middleware config
	config := v2http.Config{
		FacilitatorURL: "http://mock-facilitator.test",
		Resource: v2.ResourceInfo{
			URL:         "https://api.example.com/test",
			Description: "Test resource",
		},
		PaymentRequirements: []v2.PaymentRequirements{
			{
				Scheme:            "exact",
				Network:           "eip155:84532",
				Amount:            "10000",
				Asset:             "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
				PayTo:             "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
				MaxTimeoutSeconds: 60,
			},
		},
	}

	// Track if handler was called
	handlerCalled := false

	// Create Gin router with middleware
	r := gin.New()
	r.Use(NewX402Middleware(config))

	// Add test handler
	r.GET("/test", func(c *gin.Context) {
		handlerCalled = true
		c.JSON(http.StatusOK, gin.H{"message": "success"})
	})

	// Make request without payment
	req := httptest.NewRequest("GET", "/test", nil)
	rec := httptest.NewRecorder()

	r.ServeHTTP(rec, req)

	// Verify handler was NOT called (middleware should abort)
	if handlerCalled {
		t.Error("Expected handler to NOT be called when payment verification fails")
	}

	// Verify response is 402
	if rec.Code != http.StatusPaymentRequired {
		t.Errorf("Expected status %d, got %d", http.StatusPaymentRequired, rec.Code)
	}
}

// TestGinMiddleware_InvalidPaymentHeader tests handling of malformed payment header
func TestGinMiddleware_InvalidPaymentHeader(t *testing.T) {
	// Create middleware config
	config := v2http.Config{
		FacilitatorURL: "http://mock-facilitator.test",
		Resource: v2.ResourceInfo{
			URL:         "https://api.example.com/test",
			Description: "Test resource",
		},
		PaymentRequirements: []v2.PaymentRequirements{
			{
				Scheme:            "exact",
				Network:           "eip155:84532",
				Amount:            "10000",
				Asset:             "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
				PayTo:             "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
				MaxTimeoutSeconds: 60,
			},
		},
	}

	// Create Gin router with middleware
	r := gin.New()
	r.Use(NewX402Middleware(config))

	// Add test handler
	r.GET("/test", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "success"})
	})

	// Make request with invalid payment header (not valid base64)
	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("X-PAYMENT", "not-valid-base64!!!!")
	rec := httptest.NewRecorder()

	r.ServeHTTP(rec, req)

	// Expect 400 Bad Request for invalid header
	if rec.Code != http.StatusBadRequest {
		t.Errorf("Expected status %d, got %d", http.StatusBadRequest, rec.Code)
	}
}

// TestGinMiddleware_ResourceInfoPopulated tests that resource info is populated correctly
func TestGinMiddleware_ResourceInfoPopulated(t *testing.T) {
	// Create middleware config WITHOUT pre-populated resource info
	config := v2http.Config{
		FacilitatorURL: "http://mock-facilitator.test",
		// Resource is intentionally empty to test auto-population
		PaymentRequirements: []v2.PaymentRequirements{
			{
				Scheme:            "exact",
				Network:           "eip155:84532",
				Amount:            "10000",
				Asset:             "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
				PayTo:             "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
				MaxTimeoutSeconds: 60,
			},
		},
	}

	// Create Gin router with middleware
	r := gin.New()
	r.Use(NewX402Middleware(config))

	// Add test handler
	r.GET("/api/v2/resource", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"message": "success"})
	})

	// Make request without payment
	req := httptest.NewRequest("GET", "/api/v2/resource", nil)
	req.Host = "example.com"
	rec := httptest.NewRecorder()

	r.ServeHTTP(rec, req)

	// Expect 402 Payment Required
	if rec.Code != http.StatusPaymentRequired {
		t.Errorf("Expected status %d, got %d", http.StatusPaymentRequired, rec.Code)
	}

	// Verify response body includes auto-populated resource info
	var response v2.PaymentRequired
	if err := json.NewDecoder(rec.Body).Decode(&response); err != nil {
		t.Fatalf("Failed to decode response: %v", err)
	}

	// Resource URL should be auto-populated from request
	if response.Resource.URL == "" {
		t.Error("Expected resource URL to be populated from request")
	}

	// Description should be auto-populated
	if response.Resource.Description == "" {
		t.Error("Expected resource description to be populated")
	}
}

// TestGetPaymentFromContext tests the helper function for extracting payment from Gin context
func TestGetPaymentFromContext(t *testing.T) {
	// Test with empty context
	c, _ := gin.CreateTestContext(httptest.NewRecorder())
	payment := GetPaymentFromContext(c)
	if payment != nil {
		t.Error("Expected nil payment from empty context")
	}

	// Test with payment in context
	expectedPayment := &v2.VerifyResponse{
		IsValid: true,
		Payer:   "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
	}
	c.Set(PaymentContextKey, expectedPayment)

	payment = GetPaymentFromContext(c)
	if payment == nil {
		t.Fatal("Expected payment from context, got nil")
	}

	if payment.Payer != expectedPayment.Payer {
		t.Errorf("Expected payer %s, got %s", expectedPayment.Payer, payment.Payer)
	}

	// Test with wrong type in context
	c2, _ := gin.CreateTestContext(httptest.NewRecorder())
	c2.Set(PaymentContextKey, "not a payment")
	payment = GetPaymentFromContext(c2)
	if payment != nil {
		t.Error("Expected nil payment when wrong type in context")
	}
}

// TestGinMiddleware_MultipleMiddlewares tests that middleware works with other Gin middlewares
func TestGinMiddleware_MultipleMiddlewares(t *testing.T) {
	// Create middleware config
	config := v2http.Config{
		FacilitatorURL: "http://mock-facilitator.test",
		Resource: v2.ResourceInfo{
			URL:         "https://api.example.com/test",
			Description: "Test resource",
		},
		PaymentRequirements: []v2.PaymentRequirements{
			{
				Scheme:            "exact",
				Network:           "eip155:84532",
				Amount:            "10000",
				Asset:             "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
				PayTo:             "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
				MaxTimeoutSeconds: 60,
			},
		},
	}

	// Track middleware execution order
	order := make([]string, 0)

	// Create Gin router with multiple middlewares
	r := gin.New()

	// First middleware (runs before x402)
	r.Use(func(c *gin.Context) {
		order = append(order, "before")
		c.Next()
		order = append(order, "before-done")
	})

	// x402 middleware
	r.Use(NewX402Middleware(config))

	// Last middleware (should NOT run without payment)
	r.Use(func(c *gin.Context) {
		order = append(order, "after")
		c.Next()
		order = append(order, "after-done")
	})

	// Add test handler
	r.GET("/test", func(c *gin.Context) {
		order = append(order, "handler")
		c.JSON(http.StatusOK, gin.H{"message": "success"})
	})

	// Make request without payment
	req := httptest.NewRequest("GET", "/test", nil)
	rec := httptest.NewRecorder()

	r.ServeHTTP(rec, req)

	// Verify response is 402
	if rec.Code != http.StatusPaymentRequired {
		t.Errorf("Expected status %d, got %d", http.StatusPaymentRequired, rec.Code)
	}

	// Verify middleware execution:
	// - "before" should run
	// - x402 should abort (no "after" or "handler")
	// - "before-done" should run (after returning from aborted chain)
	expectedOrder := []string{"before", "before-done"}
	if len(order) != len(expectedOrder) {
		t.Errorf("Expected order %v, got %v", expectedOrder, order)
	}
	for i, expected := range expectedOrder {
		if i >= len(order) || order[i] != expected {
			t.Errorf("Expected order %v, got %v", expectedOrder, order)
			break
		}
	}
}
