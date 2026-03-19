package caddyx402

import (
	"testing"

	"github.com/caddyserver/caddy/v2/caddyconfig/caddyfile"
)

func TestUnmarshalCaddyfile_Full(t *testing.T) {
	input := `x402 {
		pay_to 0x1234567890abcdef1234567890abcdef12345678
		price 0.01
		network base-sepolia
		facilitator_url https://x402.org/facilitator
		facilitator_key my-api-key
		exempt /robots.txt
		exempt /.well-known/*
		cloudflare_compat true
		db_path /tmp/test.db
		dry_run false
		description "Test content"
		max_timeout 120
		crawler_pattern MyBot
	}`

	d := caddyfile.NewTestDispenser(input)
	x := &X402{Config: defaults()}
	err := x.UnmarshalCaddyfile(d)
	if err != nil {
		t.Fatal(err)
	}

	if x.PayTo != "0x1234567890abcdef1234567890abcdef12345678" {
		t.Errorf("PayTo = %q", x.PayTo)
	}
	if x.Price != "0.01" {
		t.Errorf("Price = %q", x.Price)
	}
	if x.Network != "base-sepolia" {
		t.Errorf("Network = %q", x.Network)
	}
	if x.FacilitatorURL != "https://x402.org/facilitator" {
		t.Errorf("FacilitatorURL = %q", x.FacilitatorURL)
	}
	if x.FacilitatorKey != "my-api-key" {
		t.Errorf("FacilitatorKey = %q", x.FacilitatorKey)
	}
	if len(x.ExemptPaths) != 2 {
		t.Fatalf("ExemptPaths length = %d, want 2", len(x.ExemptPaths))
	}
	if x.ExemptPaths[0] != "/robots.txt" {
		t.Errorf("ExemptPaths[0] = %q", x.ExemptPaths[0])
	}
	if x.ExemptPaths[1] != "/.well-known/*" {
		t.Errorf("ExemptPaths[1] = %q", x.ExemptPaths[1])
	}
	if !x.CloudflareCompat {
		t.Error("CloudflareCompat should be true")
	}
	if x.DBPath != "/tmp/test.db" {
		t.Errorf("DBPath = %q", x.DBPath)
	}
	if x.DryRun {
		t.Error("DryRun should be false")
	}
	if x.Description != "Test content" {
		t.Errorf("Description = %q", x.Description)
	}
	if x.MaxTimeoutSeconds != 120 {
		t.Errorf("MaxTimeoutSeconds = %d", x.MaxTimeoutSeconds)
	}
	if len(x.CustomCrawlerPatterns) != 1 || x.CustomCrawlerPatterns[0] != "MyBot" {
		t.Errorf("CustomCrawlerPatterns = %v", x.CustomCrawlerPatterns)
	}
}

func TestUnmarshalCaddyfile_MinimalDefaults(t *testing.T) {
	input := `x402 {
		pay_to 0x1234567890abcdef1234567890abcdef12345678
		price 0.01
	}`

	d := caddyfile.NewTestDispenser(input)
	x := &X402{Config: defaults()}
	err := x.UnmarshalCaddyfile(d)
	if err != nil {
		t.Fatal(err)
	}

	// Explicit values.
	if x.PayTo != "0x1234567890abcdef1234567890abcdef12345678" {
		t.Errorf("PayTo = %q", x.PayTo)
	}
	if x.Price != "0.01" {
		t.Errorf("Price = %q", x.Price)
	}

	// Defaults should be preserved.
	if x.Network != "base" {
		t.Errorf("default Network = %q, want base", x.Network)
	}
	if x.FacilitatorURL != defaultFacilitatorURL {
		t.Errorf("default FacilitatorURL = %q", x.FacilitatorURL)
	}
	if !x.CloudflareCompat {
		t.Error("default CloudflareCompat should be true")
	}
	if x.MaxTimeoutSeconds != 60 {
		t.Errorf("default MaxTimeoutSeconds = %d", x.MaxTimeoutSeconds)
	}
}

func TestUnmarshalCaddyfile_UnknownDirective(t *testing.T) {
	input := `x402 {
		pay_to 0x1234567890abcdef1234567890abcdef12345678
		unknown_option value
	}`

	d := caddyfile.NewTestDispenser(input)
	x := &X402{Config: defaults()}
	err := x.UnmarshalCaddyfile(d)
	if err == nil {
		t.Error("expected error for unknown directive")
	}
}

func TestUnmarshalCaddyfile_MissingArgument(t *testing.T) {
	input := `x402 {
		pay_to
	}`

	d := caddyfile.NewTestDispenser(input)
	x := &X402{Config: defaults()}
	err := x.UnmarshalCaddyfile(d)
	if err == nil {
		t.Error("expected error for missing argument")
	}
}

func TestUnmarshalCaddyfile_InvalidBool(t *testing.T) {
	input := `x402 {
		cloudflare_compat notabool
	}`

	d := caddyfile.NewTestDispenser(input)
	x := &X402{Config: defaults()}
	err := x.UnmarshalCaddyfile(d)
	if err == nil {
		t.Error("expected error for invalid bool")
	}
}

func TestUnmarshalCaddyfile_InvalidMaxTimeout(t *testing.T) {
	input := `x402 {
		max_timeout notanumber
	}`

	d := caddyfile.NewTestDispenser(input)
	x := &X402{Config: defaults()}
	err := x.UnmarshalCaddyfile(d)
	if err == nil {
		t.Error("expected error for non-integer max_timeout")
	}
}
