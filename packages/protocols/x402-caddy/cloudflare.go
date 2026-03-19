package caddyx402

import (
	"net/http"
)

// setCrawlerPriceHeaders sets Cloudflare-compatible crawler pricing headers on 402 responses.
// See: https://blog.cloudflare.com/x402/
func setCrawlerPriceHeaders(w http.ResponseWriter, price string, network string) {
	w.Header().Set("crawler-price", price)
	w.Header().Set("crawler-price-currency", "USDC")
	w.Header().Set("crawler-price-network", network)
}

// setCrawlerChargedHeaders sets Cloudflare-compatible headers after a successful payment.
func setCrawlerChargedHeaders(w http.ResponseWriter, amount string, txHash string, network string) {
	w.Header().Set("crawler-charged", amount)
	w.Header().Set("crawler-charged-currency", "USDC")
	w.Header().Set("crawler-charged-network", network)
	if txHash != "" {
		w.Header().Set("crawler-charged-tx", txHash)
	}
}
