package http

import (
	"net/http"

	"github.com/mark3labs/x402-go"
	"github.com/mark3labs/x402-go/http/internal/helpers"
)

// sendPaymentRequired sends a 402 Payment Required response with payment requirements.
// It delegates to sendPaymentRequiredWithRequirements with the configured payment requirements.
func sendPaymentRequired(w http.ResponseWriter, config *Config) {
	sendPaymentRequiredWithRequirements(w, config.PaymentRequirements)
}

// sendPaymentRequiredWithRequirements sends a 402 Payment Required response with specific payment requirements.
func sendPaymentRequiredWithRequirements(w http.ResponseWriter, requirements []x402.PaymentRequirement) {
	helpers.SendPaymentRequired(w, requirements)
}

// parsePaymentHeader parses the X-PAYMENT header and returns the payment payload.
func parsePaymentHeader(r *http.Request) (x402.PaymentPayload, error) {
	return helpers.ParsePaymentHeaderFromRequest(r)
}

// findMatchingRequirement finds a payment requirement that matches the provided payment.
func findMatchingRequirement(payment x402.PaymentPayload, requirements []x402.PaymentRequirement) (x402.PaymentRequirement, error) {
	return helpers.FindMatchingRequirement(payment, requirements)
}

// addPaymentResponseHeader adds the X-PAYMENT-RESPONSE header with settlement information.
func addPaymentResponseHeader(w http.ResponseWriter, settlement *x402.SettlementResponse) error {
	return helpers.AddPaymentResponseHeader(w, settlement)
}
