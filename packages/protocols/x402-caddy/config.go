package caddyx402

import (
	"fmt"
	"regexp"
	"strings"
	"time"
)

// USDC contract addresses per network.
var usdcAssets = map[string]string{
	"base-sepolia": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
	"base":         "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
}

// Default facilitator URL (x402.org public facilitator).
const defaultFacilitatorURL = "https://x402.org/facilitator"

// Pre-compiled regexes.
var (
	evmAddressRE = regexp.MustCompile(`^0x[0-9a-fA-F]{40}$`)
	priceRE      = regexp.MustCompile(`^\d+(\.\d+)?$`)
)

// Config holds all directive settings parsed from the Caddyfile.
type Config struct {
	// PayTo is the EVM address that receives USDC payments.
	PayTo string `json:"pay_to"`

	// Price in USDC (human-readable, e.g. "0.01").
	Price string `json:"price"`

	// Network is the blockchain network identifier (e.g. "base", "base-sepolia").
	Network string `json:"network"`

	// FacilitatorURL is the base URL of the x402 facilitator service.
	FacilitatorURL string `json:"facilitator_url,omitempty"`

	// FacilitatorKey is the API key for the facilitator (optional, for authenticated facilitators).
	// Redacted from JSON serialization via custom MarshalJSON on the parent struct.
	FacilitatorKey string `json:"-"`

	// ExemptPaths are path patterns that bypass the paywall.
	ExemptPaths []string `json:"exempt_paths,omitempty"`

	// CloudflareCompat enables crawler-price/crawler-charged header emission.
	CloudflareCompat bool `json:"cloudflare_compat"`

	// DBPath is the path to the SQLite audit trail database.
	DBPath string `json:"db_path,omitempty"`

	// DryRun when true skips actual settlement (useful for testing).
	DryRun bool `json:"dry_run"`

	// Description is a human-readable description of the protected resource.
	Description string `json:"description,omitempty"`

	// MaxTimeoutSeconds is the max time allowed for payment completion.
	MaxTimeoutSeconds int `json:"max_timeout_seconds,omitempty"`

	// CustomCrawlerPatterns are additional regex patterns to match crawler UAs.
	CustomCrawlerPatterns []string `json:"custom_crawler_patterns,omitempty"`
}

// defaults returns a Config with sensible default values.
func defaults() Config {
	return Config{
		Network:           "base",
		FacilitatorURL:    defaultFacilitatorURL,
		CloudflareCompat:  true,
		DBPath:            "/var/lib/caddy/x402-payments.db",
		DryRun:            false,
		Description:       "Access to this resource requires payment",
		MaxTimeoutSeconds: 60,
	}
}

// priceToAtomicUnits converts a human-readable USDC price (e.g. "0.01")
// to atomic units (6 decimals). Returns an error for invalid input.
func priceToAtomicUnits(price string) (string, error) {
	if price == "" {
		return "", fmt.Errorf("price is empty")
	}
	if !priceRE.MatchString(price) {
		return "", fmt.Errorf("price %q must be a non-negative decimal number (e.g. \"0.01\")", price)
	}

	parts := splitDecimal(price)
	whole := parts[0]
	frac := ""
	if len(parts) > 1 {
		frac = parts[1]
	}

	// Pad or truncate fractional part to 6 digits (USDC has 6 decimals).
	for len(frac) < 6 {
		frac += "0"
	}
	frac = frac[:6]

	result := whole + frac
	result = trimLeadingZeros(result)
	if result == "" {
		result = "0"
	}

	// Reject zero price — charging nothing is a misconfiguration.
	if result == "0" {
		return "", fmt.Errorf("price %q results in zero atomic units", price)
	}

	return result, nil
}

func splitDecimal(s string) []string {
	for i, c := range s {
		if c == '.' {
			return []string{s[:i], s[i+1:]}
		}
	}
	return []string{s}
}

func trimLeadingZeros(s string) string {
	i := 0
	for i < len(s)-1 && s[i] == '0' {
		i++
	}
	return s[i:]
}

// isValidEVMAddress checks if a string looks like a valid EVM address.
func isValidEVMAddress(addr string) bool {
	return evmAddressRE.MatchString(addr)
}

// assetForNetwork returns the USDC contract address for the given network.
func assetForNetwork(network string) string {
	if asset, ok := usdcAssets[network]; ok {
		return asset
	}
	return ""
}

// isSecureURL checks if a URL uses HTTPS or is a localhost/loopback address (for dev).
func isSecureURL(rawURL string) bool {
	if strings.HasPrefix(rawURL, "https://") {
		return true
	}
	// Allow HTTP for localhost/loopback (development).
	if strings.HasPrefix(rawURL, "http://localhost") ||
		strings.HasPrefix(rawURL, "http://127.0.0.1") ||
		strings.HasPrefix(rawURL, "http://[::1]") {
		return true
	}
	return false
}

// facilitatorTimeout is the HTTP client timeout for facilitator requests.
const facilitatorTimeout = 30 * time.Second

// maxPaymentHeaderSize is the maximum allowed X-PAYMENT header size in bytes.
const maxPaymentHeaderSize = 64 * 1024 // 64KB

// maxFacilitatorResponseSize is the maximum facilitator response body size.
const maxFacilitatorResponseSize = 1 << 20 // 1MB
