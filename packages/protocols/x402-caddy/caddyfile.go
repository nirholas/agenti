package caddyx402

import (
	"strconv"

	"github.com/caddyserver/caddy/v2/caddyconfig/caddyfile"
	"github.com/caddyserver/caddy/v2/caddyconfig/httpcaddyfile"
	"github.com/caddyserver/caddy/v2/modules/caddyhttp"
)

func init() {
	httpcaddyfile.RegisterHandlerDirective("x402", parseCaddyfile)
	httpcaddyfile.RegisterDirectiveOrder("x402", httpcaddyfile.Before, "reverse_proxy")
}

// parseCaddyfile parses the x402 Caddyfile directive.
func parseCaddyfile(h httpcaddyfile.Helper) (caddyhttp.MiddlewareHandler, error) {
	x := &X402{
		Config: defaults(),
	}
	err := x.UnmarshalCaddyfile(h.Dispenser)
	return x, err
}

// UnmarshalCaddyfile implements caddyfile.Unmarshaler.
//
//	x402 {
//	    pay_to      0xADDRESS
//	    price       0.01
//	    network     base
//	    facilitator_url https://x402.org/facilitator
//	    facilitator_key {env.CDP_API_KEY}
//	    exempt /robots.txt
//	    exempt /.well-known/*
//	    cloudflare_compat on
//	    db_path /var/lib/caddy/x402-payments.db
//	    dry_run off
//	    description "My site content"
//	    max_timeout 60
//	    crawler_pattern MyBot
//	}
func (x *X402) UnmarshalCaddyfile(d *caddyfile.Dispenser) error {
	// Consume the directive name "x402".
	d.Next()

	// Parse the block.
	for d.NextBlock(0) {
		switch d.Val() {
		case "pay_to":
			if !d.NextArg() {
				return d.ArgErr()
			}
			x.PayTo = d.Val()

		case "price":
			if !d.NextArg() {
				return d.ArgErr()
			}
			x.Price = d.Val()

		case "network":
			if !d.NextArg() {
				return d.ArgErr()
			}
			x.Network = d.Val()

		case "facilitator_url":
			if !d.NextArg() {
				return d.ArgErr()
			}
			x.FacilitatorURL = d.Val()

		case "facilitator_key":
			if !d.NextArg() {
				return d.ArgErr()
			}
			x.FacilitatorKey = d.Val()

		case "exempt":
			if !d.NextArg() {
				return d.ArgErr()
			}
			x.ExemptPaths = append(x.ExemptPaths, d.Val())

		case "cloudflare_compat":
			if !d.NextArg() {
				return d.ArgErr()
			}
			val, err := strconv.ParseBool(d.Val())
			if err != nil {
				return d.Errf("invalid cloudflare_compat value: %v", err)
			}
			x.CloudflareCompat = val

		case "db_path":
			if !d.NextArg() {
				return d.ArgErr()
			}
			x.DBPath = d.Val()

		case "dry_run":
			if !d.NextArg() {
				return d.ArgErr()
			}
			val, err := strconv.ParseBool(d.Val())
			if err != nil {
				return d.Errf("invalid dry_run value: %v", err)
			}
			x.DryRun = val

		case "description":
			if !d.NextArg() {
				return d.ArgErr()
			}
			x.Description = d.Val()

		case "max_timeout":
			if !d.NextArg() {
				return d.ArgErr()
			}
			val, err := strconv.Atoi(d.Val())
			if err != nil {
				return d.Errf("invalid max_timeout value: %v", err)
			}
			x.MaxTimeoutSeconds = val

		case "crawler_pattern":
			if !d.NextArg() {
				return d.ArgErr()
			}
			x.CustomCrawlerPatterns = append(x.CustomCrawlerPatterns, d.Val())

		default:
			return d.Errf("unrecognized x402 option: %s", d.Val())
		}
	}

	return nil
}

// Interface guard.
var _ caddyfile.Unmarshaler = (*X402)(nil)
