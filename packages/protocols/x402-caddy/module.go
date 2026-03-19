package caddyx402

import (
	"path"

	"github.com/caddyserver/caddy/v2"
	"github.com/caddyserver/caddy/v2/modules/caddyhttp"
	"go.uber.org/zap"
)

// X402 is a Caddy HTTP middleware that implements the x402 payment protocol,
// requiring AI crawlers to pay USDC for content access.
type X402 struct {
	Config

	logger      *zap.Logger
	crawler     *CrawlerDetector
	facilitator *FacilitatorClient
	store       PaymentStore
	exemptGlobs []string
}

func init() {
	caddy.RegisterModule(X402{})
}

// CaddyModule returns the Caddy module information.
func (X402) CaddyModule() caddy.ModuleInfo {
	return caddy.ModuleInfo{
		ID:  "http.handlers.x402",
		New: func() caddy.Module { return new(X402) },
	}
}

// Provision sets up the module.
func (x *X402) Provision(ctx caddy.Context) error {
	x.logger = ctx.Logger()

	// Initialize crawler detector.
	detector, err := NewCrawlerDetector(x.CustomCrawlerPatterns)
	if err != nil {
		return err
	}
	x.crawler = detector

	// Initialize facilitator client.
	url := x.FacilitatorURL
	if url == "" {
		url = defaultFacilitatorURL
	}
	x.facilitator = NewFacilitatorClient(url, x.FacilitatorKey)

	// Initialize store.
	if x.DBPath != "" {
		store := NewSQLiteStore(x.DBPath)
		if err := store.Init(); err != nil {
			x.logger.Error("failed to initialize payment store", zap.Error(err))
			// Non-fatal: continue without audit trail.
		} else {
			x.store = store
			x.logger.Info("payment store initialized", zap.String("path", x.DBPath))
		}
	}

	// Validate exempt path patterns at provision time.
	x.exemptGlobs = make([]string, 0, len(x.ExemptPaths))
	for _, p := range x.ExemptPaths {
		// For non-wildcard patterns, validate they are valid path.Match patterns.
		if p[len(p)-1] != '*' {
			if _, err := path.Match(p, "/test"); err != nil {
				return err
			}
		}
		x.exemptGlobs = append(x.exemptGlobs, p)
	}

	if x.DryRun {
		x.logger.Warn("x402 middleware running in DRY RUN mode — no payments will be verified or settled")
	}

	x.logger.Info("x402 middleware provisioned",
		zap.String("pay_to", x.PayTo),
		zap.String("price", x.Price),
		zap.String("network", x.Network),
		zap.Bool("dry_run", x.DryRun),
		zap.Bool("cloudflare_compat", x.CloudflareCompat),
		zap.Int("exempt_paths", len(x.exemptGlobs)),
	)

	return nil
}

// Validate ensures the configuration is valid.
func (x *X402) Validate() error {
	if x.PayTo == "" {
		return errMissingPayTo
	}
	if !isValidEVMAddress(x.PayTo) {
		return errInvalidPayTo
	}
	if x.Price == "" {
		return errMissingPrice
	}
	// Validate price converts successfully.
	if _, err := priceToAtomicUnits(x.Price); err != nil {
		return err
	}
	if assetForNetwork(x.Network) == "" {
		return errUnsupportedNetwork
	}
	// Validate facilitator URL uses HTTPS.
	if x.FacilitatorURL != "" && !isSecureURL(x.FacilitatorURL) {
		return errInsecureFacilitator
	}
	// Validate max timeout.
	if x.MaxTimeoutSeconds <= 0 {
		return errInvalidMaxTimeout
	}
	return nil
}

// Cleanup releases resources.
func (x *X402) Cleanup() error {
	if x.store != nil {
		err := x.store.Close()
		x.store = nil // Prevent double-close.
		return err
	}
	return nil
}

// Interface guards.
var (
	_ caddy.Module                = (*X402)(nil)
	_ caddy.Provisioner           = (*X402)(nil)
	_ caddy.Validator             = (*X402)(nil)
	_ caddy.CleanerUpper          = (*X402)(nil)
	_ caddyhttp.MiddlewareHandler = (*X402)(nil)
)
