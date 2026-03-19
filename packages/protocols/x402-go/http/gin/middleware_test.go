package gin

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/mark3labs/x402-go"
	httpx402 "github.com/mark3labs/x402-go/http"
)

func init() {
	// Disable Gin debug mode for cleaner test output
	gin.SetMode(gin.TestMode)
}

// TestGinMiddleware_NoPaymentReturns402 tests that requests without X-PAYMENT header return 402
func TestGinMiddleware_NoPaymentReturns402(t *testing.T) {
	// Create middleware config
	config := &httpx402.Config{
		FacilitatorURL: "http://mock-facilitator.test",
		PaymentRequirements: []x402.PaymentRequirement{
			{
				Scheme:            "exact",
				Network:           "base-sepolia",
				MaxAmountRequired: "10000",
				Asset:             "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
				PayTo:             "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
				Resource:          "https://api.example.com/test",
				Description:       "Test resource",
				MaxTimeoutSeconds: 60,
			},
		},
	}

	// Create Gin router with middleware
	r := gin.New()
	r.Use(NewGinX402Middleware(config))

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
}

// TestGinMiddleware_VerifyOnlyMode tests verification-only mode without settlement
func TestGinMiddleware_VerifyOnlyMode(t *testing.T) {
	// Create middleware config with VerifyOnly flag
	config := &httpx402.Config{
		FacilitatorURL: "http://mock-facilitator.test",
		VerifyOnly:     true, // Key difference - only verify, don't settle
		PaymentRequirements: []x402.PaymentRequirement{
			{
				Scheme:            "exact",
				Network:           "base-sepolia",
				MaxAmountRequired: "10000",
				Asset:             "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
				PayTo:             "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
				Resource:          "https://api.example.com/test",
				Description:       "Test resource",
				MaxTimeoutSeconds: 60,
			},
		},
	}

	// Create Gin router with middleware
	r := gin.New()
	r.Use(NewGinX402Middleware(config))

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

// TestGinMiddleware_ValidPaymentSucceeds tests valid payment flow
func TestGinMiddleware_ValidPaymentSucceeds(t *testing.T) {
	// This test will fail until we implement the middleware
	// It requires a mock facilitator
	t.Skip("Requires mock facilitator implementation")
}

// TestGinMiddleware_PaymentDetailsAccessible tests payment details via c.Get("x402_payment")
func TestGinMiddleware_PaymentDetailsAccessible(t *testing.T) {
	// This test verifies that payment information is stored in Gin context
	// and can be retrieved in handler using c.Get("x402_payment")
	t.Skip("Requires mock facilitator to test payment context storage")
}

// TestGinMiddleware_RouterGroupSupport tests middleware with gin.RouterGroup
func TestGinMiddleware_RouterGroupSupport(t *testing.T) {
	// Create middleware config
	config := &httpx402.Config{
		FacilitatorURL: "http://mock-facilitator.test",
		PaymentRequirements: []x402.PaymentRequirement{
			{
				Scheme:            "exact",
				Network:           "base-sepolia",
				MaxAmountRequired: "10000",
				Asset:             "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
				PayTo:             "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
				Resource:          "https://api.example.com/test",
				Description:       "Test resource",
				MaxTimeoutSeconds: 60,
			},
		},
	}

	// Create Gin router
	r := gin.New()

	// Create protected group with middleware
	protected := r.Group("/protected")
	protected.Use(NewGinX402Middleware(config))
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
	config := &httpx402.Config{
		FacilitatorURL: "http://mock-facilitator.test",
		PaymentRequirements: []x402.PaymentRequirement{
			{
				Scheme:            "exact",
				Network:           "base-sepolia",
				MaxAmountRequired: "10000",
				Asset:             "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
				PayTo:             "0x209693Bc6afc0C5328bA36FaF03C514EF312287C",
				Resource:          "https://api.example.com/test",
				Description:       "Test resource",
				MaxTimeoutSeconds: 60,
			},
		},
	}

	// Track if handler was called
	handlerCalled := false

	// Create Gin router with middleware
	r := gin.New()
	r.Use(NewGinX402Middleware(config))

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
