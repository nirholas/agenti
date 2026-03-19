package caddyx402

import "testing"

func TestCaddyModule(t *testing.T) {
	x := X402{}
	info := x.CaddyModule()

	if info.ID != "http.handlers.x402" {
		t.Errorf("module ID = %q, want http.handlers.x402", info.ID)
	}

	mod := info.New()
	if _, ok := mod.(*X402); !ok {
		t.Error("New() did not return *X402")
	}
}

func TestValidate_MissingPayTo(t *testing.T) {
	x := &X402{Config: Config{Price: "0.01", Network: "base", MaxTimeoutSeconds: 60}}
	if err := x.Validate(); err != errMissingPayTo {
		t.Errorf("err = %v, want errMissingPayTo", err)
	}
}

func TestValidate_InvalidPayTo(t *testing.T) {
	x := &X402{Config: Config{PayTo: "invalid", Price: "0.01", Network: "base", MaxTimeoutSeconds: 60}}
	if err := x.Validate(); err != errInvalidPayTo {
		t.Errorf("err = %v, want errInvalidPayTo", err)
	}
}

func TestValidate_MissingPrice(t *testing.T) {
	x := &X402{Config: Config{
		PayTo:             "0x1234567890abcdef1234567890abcdef12345678",
		Network:           "base",
		MaxTimeoutSeconds: 60,
	}}
	if err := x.Validate(); err != errMissingPrice {
		t.Errorf("err = %v, want errMissingPrice", err)
	}
}

func TestValidate_UnsupportedNetwork(t *testing.T) {
	x := &X402{Config: Config{
		PayTo:             "0x1234567890abcdef1234567890abcdef12345678",
		Price:             "0.01",
		Network:           "ethereum",
		MaxTimeoutSeconds: 60,
	}}
	if err := x.Validate(); err != errUnsupportedNetwork {
		t.Errorf("err = %v, want errUnsupportedNetwork", err)
	}
}

func TestValidate_InsecureFacilitatorURL(t *testing.T) {
	x := &X402{Config: Config{
		PayTo:             "0x1234567890abcdef1234567890abcdef12345678",
		Price:             "0.01",
		Network:           "base",
		FacilitatorURL:    "http://evil.com/facilitator",
		MaxTimeoutSeconds: 60,
	}}
	if err := x.Validate(); err != errInsecureFacilitator {
		t.Errorf("err = %v, want errInsecureFacilitator", err)
	}
}

func TestValidate_LocalhostHTTPAllowed(t *testing.T) {
	x := &X402{Config: Config{
		PayTo:             "0x1234567890abcdef1234567890abcdef12345678",
		Price:             "0.01",
		Network:           "base",
		FacilitatorURL:    "http://localhost:8080/facilitator",
		MaxTimeoutSeconds: 60,
	}}
	if err := x.Validate(); err != nil {
		t.Errorf("unexpected error for localhost HTTP: %v", err)
	}
}

func TestValidate_InvalidMaxTimeout(t *testing.T) {
	x := &X402{Config: Config{
		PayTo:             "0x1234567890abcdef1234567890abcdef12345678",
		Price:             "0.01",
		Network:           "base",
		MaxTimeoutSeconds: 0,
	}}
	if err := x.Validate(); err != errInvalidMaxTimeout {
		t.Errorf("err = %v, want errInvalidMaxTimeout", err)
	}
}

func TestValidate_NegativeMaxTimeout(t *testing.T) {
	x := &X402{Config: Config{
		PayTo:             "0x1234567890abcdef1234567890abcdef12345678",
		Price:             "0.01",
		Network:           "base",
		MaxTimeoutSeconds: -5,
	}}
	if err := x.Validate(); err != errInvalidMaxTimeout {
		t.Errorf("err = %v, want errInvalidMaxTimeout", err)
	}
}

func TestValidate_InvalidPrice(t *testing.T) {
	tests := []struct {
		price string
	}{
		{""},
		{"-1"},
		{"abc"},
		{"1.2.3"},
		{"0"},
		{"0.000000"},
	}

	for _, tc := range tests {
		x := &X402{Config: Config{
			PayTo:             "0x1234567890abcdef1234567890abcdef12345678",
			Price:             tc.price,
			Network:           "base",
			MaxTimeoutSeconds: 60,
		}}
		if err := x.Validate(); err == nil {
			t.Errorf("expected error for price %q", tc.price)
		}
	}
}

func TestValidate_Success(t *testing.T) {
	x := &X402{Config: Config{
		PayTo:             "0x1234567890abcdef1234567890abcdef12345678",
		Price:             "0.01",
		Network:           "base",
		MaxTimeoutSeconds: 60,
	}}
	if err := x.Validate(); err != nil {
		t.Errorf("unexpected error: %v", err)
	}
}

func TestDefaults(t *testing.T) {
	d := defaults()
	if d.Network != "base" {
		t.Errorf("default network = %q", d.Network)
	}
	if d.FacilitatorURL != defaultFacilitatorURL {
		t.Errorf("default facilitator URL = %q", d.FacilitatorURL)
	}
	if !d.CloudflareCompat {
		t.Error("default cloudflare_compat should be true")
	}
	if d.DryRun {
		t.Error("default dry_run should be false")
	}
	if d.MaxTimeoutSeconds != 60 {
		t.Errorf("default max_timeout = %d", d.MaxTimeoutSeconds)
	}
}

func TestCleanup_DoubleClose(t *testing.T) {
	dir := t.TempDir()
	store := NewSQLiteStore(dir + "/test.db")
	if err := store.Init(); err != nil {
		t.Fatal(err)
	}

	x := &X402{store: store}

	// First close should succeed.
	if err := x.Cleanup(); err != nil {
		t.Errorf("first cleanup: %v", err)
	}

	// Second close should also succeed (no error).
	if err := x.Cleanup(); err != nil {
		t.Errorf("second cleanup: %v", err)
	}
}
