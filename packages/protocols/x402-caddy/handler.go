package caddyx402

import (
	"net/http"
	"path"
	"strings"
	"time"

	"github.com/caddyserver/caddy/v2/modules/caddyhttp"
	"go.uber.org/zap"
)

// ServeHTTP implements caddyhttp.MiddlewareHandler.
func (x *X402) ServeHTTP(w http.ResponseWriter, r *http.Request, next caddyhttp.Handler) error {
	ua := r.UserAgent()

	// 1. Check if this is an AI crawler.
	if !x.crawler.IsCrawler(ua) {
		return next.ServeHTTP(w, r)
	}

	// 2. Check if path is exempt. Clean the path first to prevent traversal.
	cleanPath := path.Clean(r.URL.Path)
	if x.isExempt(cleanPath) {
		return next.ServeHTTP(w, r)
	}

	crawlerName := x.crawler.MatchedPattern(ua)
	x.logger.Info("AI crawler detected",
		zap.String("crawler", crawlerName),
		zap.String("path", cleanPath),
		zap.String("remote_addr", r.RemoteAddr),
	)

	// 3. Build payment requirements for this resource.
	// Use the configured host or fall back to request Host header.
	host := r.Host
	resource := "https://" + host + cleanPath
	reqs, err := buildPaymentRequirements(x.Config, resource)
	if err != nil {
		// FAIL CLOSED: never serve content for free on internal error.
		x.logger.Error("failed to build payment requirements, blocking request", zap.Error(err))
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return nil
	}

	// 4. Check for X-PAYMENT header.
	paymentHeader := r.Header.Get("X-PAYMENT")
	if paymentHeader == "" {
		x.logger.Info("no X-PAYMENT header, returning 402",
			zap.String("path", cleanPath),
			zap.String("crawler", crawlerName),
		)
		return x.write402(w, reqs)
	}

	// 4b. Size-limit the payment header to prevent DoS.
	if len(paymentHeader) > maxPaymentHeaderSize {
		x.logger.Warn("X-PAYMENT header too large",
			zap.Int("size", len(paymentHeader)),
			zap.String("path", cleanPath),
		)
		return x.write402(w, reqs)
	}

	// 5. Decode the payment payload.
	payload, err := decodePaymentHeader(paymentHeader)
	if err != nil {
		x.logger.Warn("invalid X-PAYMENT header",
			zap.Error(err),
			zap.String("path", cleanPath),
		)
		return x.write402(w, reqs)
	}

	// 6. Dry run mode: skip verification and settlement.
	if x.DryRun {
		x.logger.Warn("dry run: skipping payment verification",
			zap.String("path", cleanPath),
			zap.String("crawler", crawlerName),
		)

		dryRunSettlement := &SettlementResponse{
			Success:     true,
			Transaction: "0x_dry_run",
			Network:     x.Network,
			Payer:       "dry_run",
		}

		x.recordAudit(r, crawlerName, dryRunSettlement, reqs.MaxAmountRequired)
		x.setResponseHeaders(w, dryRunSettlement)
		return next.ServeHTTP(w, r)
	}

	// 7. Verify payment with facilitator.
	verifyResp, err := x.facilitator.Verify(r.Context(), payload, reqs)
	if err != nil {
		x.logger.Error("facilitator verify failed", zap.Error(err))
		return x.write402(w, reqs)
	}

	if !verifyResp.IsValid {
		x.logger.Warn("payment verification failed",
			zap.String("reason", verifyResp.InvalidReason),
			zap.String("payer", verifyResp.Payer),
		)

		x.recordAudit(r, crawlerName, &SettlementResponse{
			Success:     false,
			Network:     x.Network,
			Payer:       verifyResp.Payer,
			ErrorReason: verifyResp.InvalidReason,
		}, reqs.MaxAmountRequired)

		return x.write402(w, reqs)
	}

	// 8. Settle payment with facilitator.
	settleResp, err := x.facilitator.Settle(r.Context(), payload, reqs)
	if err != nil {
		x.logger.Error("facilitator settle failed", zap.Error(err))
		return x.write402(w, reqs)
	}

	if !settleResp.Success {
		x.logger.Warn("settlement failed",
			zap.String("reason", settleResp.ErrorReason),
			zap.String("payer", settleResp.Payer),
		)

		x.recordAudit(r, crawlerName, settleResp, reqs.MaxAmountRequired)
		return x.write402(w, reqs)
	}

	// 9. Payment successful!
	x.logger.Info("payment settled successfully",
		zap.String("tx", settleResp.Transaction),
		zap.String("payer", settleResp.Payer),
		zap.String("network", settleResp.Network),
		zap.String("path", cleanPath),
	)

	x.recordAudit(r, crawlerName, settleResp, reqs.MaxAmountRequired)
	x.setResponseHeaders(w, settleResp)

	// 10. Serve the content.
	return next.ServeHTTP(w, r)
}

// write402 writes a 402 response with payment requirements and Cloudflare compat headers.
// This deduplicates the repeated pattern of setting CF headers + writing 402.
func (x *X402) write402(w http.ResponseWriter, reqs PaymentRequirements) error {
	if x.CloudflareCompat {
		setCrawlerPriceHeaders(w, x.Price, x.Network)
	}
	// Generic error message to avoid leaking internal details.
	return writePaymentRequired(w, reqs, "Payment required to access this resource")
}

// isExempt checks if a request path matches any exempt pattern.
// Patterns ending in * use prefix matching (matches across path separators).
// Other patterns use path.Match glob semantics.
func (x *X402) isExempt(reqPath string) bool {
	for _, pattern := range x.exemptGlobs {
		// For patterns ending in *, use prefix matching to allow deep path matching.
		if strings.HasSuffix(pattern, "*") {
			prefix := pattern[:len(pattern)-1]
			if strings.HasPrefix(reqPath, prefix) {
				return true
			}
			continue
		}
		// For exact patterns, use path.Match.
		if matched, err := path.Match(pattern, reqPath); err == nil && matched {
			return true
		}
	}
	return false
}

// setResponseHeaders sets X-PAYMENT-RESPONSE and Cloudflare compat headers on success.
func (x *X402) setResponseHeaders(w http.ResponseWriter, settlement *SettlementResponse) {
	encoded, err := encodeSettlementResponse(settlement)
	if err == nil {
		w.Header().Set("X-PAYMENT-RESPONSE", encoded)
	}

	if x.CloudflareCompat {
		setCrawlerChargedHeaders(w, x.Price, settlement.Transaction, settlement.Network)
	}
}

// recordAudit logs any payment event (success, failure, dry-run) to the store.
func (x *X402) recordAudit(r *http.Request, crawlerName string, settlement *SettlementResponse, amount string) {
	if x.store == nil {
		return
	}

	// Truncate UA to prevent unbounded storage.
	ua := r.UserAgent()
	if len(ua) > 512 {
		ua = ua[:512]
	}

	rec := PaymentRecord{
		Timestamp:   time.Now(),
		Path:        r.URL.Path,
		UserAgent:   ua,
		CrawlerName: crawlerName,
		Payer:       settlement.Payer,
		Amount:      amount,
		Network:     settlement.Network,
		TxHash:      settlement.Transaction,
		Success:     settlement.Success,
		ErrorReason: settlement.ErrorReason,
		RemoteAddr:  r.RemoteAddr,
		DryRun:      x.DryRun,
	}

	if err := x.store.Record(rec); err != nil {
		x.logger.Error("failed to record payment", zap.Error(err))
	}
}
