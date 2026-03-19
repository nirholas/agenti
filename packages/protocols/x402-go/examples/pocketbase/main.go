package main

import (
	"log"
	"net/http"

	"github.com/pocketbase/pocketbase"
	"github.com/pocketbase/pocketbase/core"

	"github.com/mark3labs/x402-go"
	"github.com/mark3labs/x402-go/facilitator"
	httpx402 "github.com/mark3labs/x402-go/http"
	pbx402 "github.com/mark3labs/x402-go/http/pocketbase"
)

func main() {
	app := pocketbase.New()

	// Configure payment requirements using helper function
	requirement, err := x402.NewUSDCPaymentRequirement(x402.USDCRequirementConfig{
		Chain:             x402.BaseSepolia,                             // TESTNET - change to x402.BaseMainnet for production
		Amount:            "0.01",                                       // 0.01 USDC
		RecipientAddress:  "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0", // REPLACE WITH YOUR WALLET ADDRESS
		Description:       "Access to premium content",
		MaxTimeoutSeconds: 300,
	})
	if err != nil {
		log.Fatal(err)
	}

	config := &httpx402.Config{
		FacilitatorURL:      "https://api.x402.coinbase.com", // Production facilitator - replace if using your own
		PaymentRequirements: []x402.PaymentRequirement{requirement},
	}

	// Register middleware
	app.OnServe().BindFunc(func(se *core.ServeEvent) error {
		// Create middleware
		middleware := pbx402.NewPocketBaseX402Middleware(config)

		// Protect a single route
		se.Router.GET("/api/premium/data", func(e *core.RequestEvent) error {
			// Access payment details (optional)
			payment := e.Get("x402_payment").(*facilitator.VerifyResponse)

			return e.JSON(http.StatusOK, map[string]any{
				"data":  "Premium content here",
				"payer": payment.Payer,
			})
		}).BindFunc(middleware)

		// Example: Protect a group of routes
		premiumGroup := se.Router.Group("/api/premium")
		premiumGroup.BindFunc(middleware) // Apply to all routes in group

		// All these routes require payment
		premiumGroup.GET("/reports", func(e *core.RequestEvent) error {
			return e.JSON(http.StatusOK, map[string]any{
				"report": "Premium report data",
			})
		})

		premiumGroup.GET("/analytics", func(e *core.RequestEvent) error {
			return e.JSON(http.StatusOK, map[string]any{
				"analytics": "Premium analytics data",
			})
		})

		return se.Next()
	})

	if err := app.Start(); err != nil {
		log.Fatal(err)
	}
}
