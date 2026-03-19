package coinbase

import (
	"crypto/sha256"
	"strings"
	"testing"
	"time"

	"gopkg.in/square/go-jose.v2/jwt"
)

// Test EC private key (ECDSA P-256) - base64-encoded (CDP format) - DO NOT USE IN PRODUCTION
// gitleaks:allow
const testECPrivateKey = `MHcCAQEEIIGlRFY0J0gbOFJbZqHRIhzgFjt6sMdVlvL+8zBcCIJmoAoGCCqGSM49AwEHoUQDQgAEzXDFO5wEOHqMNLhFqn1NJl3vXqKLJJqL0YNn2R3DJCDm7fRXQzKtYMJcQFMQKmC0BNm7hPpYPKJbZEcLQ9chMg==`

// Test invalid base64 format
const testInvalidBase64 = `THIS IS NOT A VALID BASE64 KEY!!!`

// Test non-base64 data
const testNonBase64 = `this is not base64 encoded data at all`

func TestNewCDPAuth_ValidCredentials(t *testing.T) {
	tests := []struct {
		name         string
		apiKeyName   string
		apiKeySecret string
		walletSecret string
		wantErr      bool
	}{
		{
			name:         "valid ECDSA credentials with wallet secret",
			apiKeyName:   "organizations/test-org/apiKeys/test-key",
			apiKeySecret: testECPrivateKey,
			walletSecret: "wallet-secret-123",
			wantErr:      false,
		},
		{
			name:         "valid ECDSA credentials without wallet secret",
			apiKeyName:   "organizations/test-org/apiKeys/test-key",
			apiKeySecret: testECPrivateKey,
			walletSecret: "",
			wantErr:      false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			auth, err := NewCDPAuth(tt.apiKeyName, tt.apiKeySecret, tt.walletSecret)

			if tt.wantErr {
				if err == nil {
					t.Fatal("expected error, got nil")
				}
				return
			}

			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if auth == nil {
				t.Fatal("expected auth to be non-nil")
			}

			// Verify fields are set
			if auth.apiKeyName != tt.apiKeyName {
				t.Errorf("expected apiKeyName %s, got %s", tt.apiKeyName, auth.apiKeyName)
			}

			if auth.apiKeySecret != tt.apiKeySecret {
				t.Errorf("expected apiKeySecret to be set")
			}

			if auth.walletSecret != tt.walletSecret {
				t.Errorf("expected walletSecret %s, got %s", tt.walletSecret, auth.walletSecret)
			}

			// Verify private key was parsed and cached
			if auth.privateKey == nil {
				t.Fatal("expected privateKey to be parsed and cached")
			}
		})
	}
}

func TestNewCDPAuth_InvalidCredentials(t *testing.T) {
	tests := []struct {
		name         string
		apiKeyName   string
		apiKeySecret string
		walletSecret string
		wantErrMsg   string
	}{
		{
			name:         "empty API key name",
			apiKeyName:   "",
			apiKeySecret: testECPrivateKey,
			walletSecret: "wallet-secret",
			wantErrMsg:   "apiKeyName must not be empty",
		},
		{
			name:         "invalid base64 format",
			apiKeyName:   "organizations/test-org/apiKeys/test-key",
			apiKeySecret: testInvalidBase64,
			walletSecret: "wallet-secret",
			wantErrMsg:   "failed to decode base64 key",
		},
		{
			name:         "non-base64 data",
			apiKeyName:   "organizations/test-org/apiKeys/test-key",
			apiKeySecret: testNonBase64,
			walletSecret: "wallet-secret",
			wantErrMsg:   "failed to decode base64 key",
		},
		{
			name:         "empty base64 data",
			apiKeyName:   "organizations/test-org/apiKeys/test-key",
			apiKeySecret: "",
			walletSecret: "wallet-secret",
			wantErrMsg:   "failed to parse private key",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			auth, err := NewCDPAuth(tt.apiKeyName, tt.apiKeySecret, tt.walletSecret)

			if err == nil {
				t.Fatal("expected error, got nil")
			}

			if auth != nil {
				t.Errorf("expected auth to be nil, got %+v", auth)
			}

			if !strings.Contains(err.Error(), tt.wantErrMsg) {
				t.Errorf("expected error to contain %q, got %q", tt.wantErrMsg, err.Error())
			}
		})
	}
}

func TestGenerateBearerToken_ValidToken(t *testing.T) {
	auth, err := NewCDPAuth(
		"organizations/test-org/apiKeys/test-key",
		testECPrivateKey,
		"wallet-secret",
	)
	if err != nil {
		t.Fatalf("failed to create auth: %v", err)
	}

	tests := []struct {
		name   string
		method string
		path   string
	}{
		{
			name:   "GET request",
			method: "GET",
			path:   "/platform/v2/evm/accounts",
		},
		{
			name:   "POST request",
			method: "POST",
			path:   "/platform/v2/evm/accounts",
		},
		{
			name:   "PUT request",
			method: "PUT",
			path:   "/platform/v2/evm/accounts/test-account",
		},
		{
			name:   "DELETE request",
			method: "DELETE",
			path:   "/platform/v2/evm/accounts/test-account",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			token, err := auth.GenerateBearerToken(tt.method, tt.path)
			if err != nil {
				t.Fatalf("failed to generate token: %v", err)
			}

			if token == "" {
				t.Fatal("expected non-empty token")
			}

			// Parse and validate JWT structure
			parsedToken, err := jwt.ParseSigned(token)
			if err != nil {
				t.Fatalf("failed to parse JWT: %v", err)
			}

			// Verify token has headers
			if len(parsedToken.Headers) == 0 {
				t.Fatal("expected JWT to have headers")
			}

			// Verify algorithm is ES256
			if parsedToken.Headers[0].Algorithm != "ES256" {
				t.Errorf("expected algorithm ES256, got %s", parsedToken.Headers[0].Algorithm)
			}

			// Verify kid header (stored in KeyID field)
			kid := parsedToken.Headers[0].KeyID
			if kid == "" {
				t.Fatal("expected kid (KeyID) header to be set")
			}
			if kid != "organizations/test-org/apiKeys/test-key" {
				t.Errorf("expected kid %s, got %s", "organizations/test-org/apiKeys/test-key", kid)
			}

			// Verify type header
			typ, ok := parsedToken.Headers[0].ExtraHeaders["typ"]
			if !ok {
				t.Fatal("expected typ header to be set")
			}
			if typ != "JWT" {
				t.Errorf("expected typ JWT, got %s", typ)
			}
		})
	}
}

func TestGenerateBearerToken_Claims(t *testing.T) {
	auth, err := NewCDPAuth(
		"organizations/test-org/apiKeys/test-key",
		testECPrivateKey,
		"wallet-secret",
	)
	if err != nil {
		t.Fatalf("failed to create auth: %v", err)
	}

	method := "GET"
	path := "/platform/v2/evm/accounts"

	token, err := auth.GenerateBearerToken(method, path)
	if err != nil {
		t.Fatalf("failed to generate token: %v", err)
	}

	// Parse token (we can't verify signature without extracting public key, but we can inspect claims)
	parsedToken, err := jwt.ParseSigned(token)
	if err != nil {
		t.Fatalf("failed to parse JWT: %v", err)
	}

	// Extract claims without verification (for testing purposes)
	var claims APIKeyClaims
	if err := parsedToken.UnsafeClaimsWithoutVerification(&claims); err != nil {
		t.Fatalf("failed to extract claims: %v", err)
	}

	// Verify subject
	if claims.Subject != "organizations/test-org/apiKeys/test-key" {
		t.Errorf("expected subject %s, got %s", "organizations/test-org/apiKeys/test-key", claims.Subject)
	}

	// Verify issuer (CDP SDK uses "cdp")
	if claims.Issuer != "cdp" {
		t.Errorf("expected issuer cdp, got %s", claims.Issuer)
	}

	// Verify audience (should be array with "cdp_service")
	if len(claims.Audience) != 1 || claims.Audience[0] != "cdp_service" {
		t.Errorf("expected audience [cdp_service], got %v", claims.Audience)
	}

	// Verify URIs format (should be array)
	expectedURI := "GET api.cdp.coinbase.com/platform/v2/evm/accounts"
	if len(claims.URIs) != 1 || claims.URIs[0] != expectedURI {
		t.Errorf("expected URIs [%s], got %v", expectedURI, claims.URIs)
	}

	// Verify expiration is approximately 2 minutes from now
	now := time.Now()
	expTime := claims.Expiry.Time()
	expectedExp := now.Add(2 * time.Minute)
	timeDiff := expTime.Sub(expectedExp)
	if timeDiff < -5*time.Second || timeDiff > 5*time.Second {
		t.Errorf("expected expiration around %v, got %v (diff: %v)", expectedExp, expTime, timeDiff)
	}

	// Verify not-before is approximately now
	nbfTime := claims.NotBefore.Time()
	nbfDiff := nbfTime.Sub(now)
	if nbfDiff < -5*time.Second || nbfDiff > 5*time.Second {
		t.Errorf("expected not-before around %v, got %v (diff: %v)", now, nbfTime, nbfDiff)
	}

	// Verify reqHash is not set for Bearer token without body
	if claims.ReqHash != "" {
		t.Errorf("expected empty reqHash for Bearer token, got %s", claims.ReqHash)
	}
}

func TestGenerateWalletAuthToken_WithBodyHash(t *testing.T) {
	auth, err := NewCDPAuth(
		"organizations/test-org/apiKeys/test-key",
		testECPrivateKey,
		"wallet-secret",
	)
	if err != nil {
		t.Fatalf("failed to create auth: %v", err)
	}

	method := "POST"
	path := "/platform/v2/evm/accounts/0x742d35Cc6634C0532925a3b844Bc454e4438f44e/sign/typed-data"

	// Create a test body and hash it
	testBody := []byte(`{"typedData": {"domain": {"name": "Test"}}}`)
	hash := sha256.Sum256(testBody)

	token, err := auth.GenerateWalletAuthToken(method, path, hash[:])
	if err != nil {
		t.Fatalf("failed to generate wallet auth token: %v", err)
	}

	if token == "" {
		t.Fatal("expected non-empty token")
	}

	// Parse token
	parsedToken, err := jwt.ParseSigned(token)
	if err != nil {
		t.Fatalf("failed to parse JWT: %v", err)
	}

	// Extract claims (Wallet Auth uses different structure than Bearer)
	var claims map[string]interface{}
	if err := parsedToken.UnsafeClaimsWithoutVerification(&claims); err != nil {
		t.Fatalf("failed to extract claims: %v", err)
	}

	// Verify reqHash is set and correct
	expectedHash := "367fc472194508bcb21c0c67de93721bdc937da40cccf39b984929ee55cd6f32" // SHA-256 of testBody
	reqHash, ok := claims["reqHash"].(string)
	if !ok {
		t.Fatal("reqHash claim not found or not a string")
	}
	if reqHash != expectedHash {
		t.Errorf("expected reqHash %s, got %s", expectedHash, reqHash)
	}

	// Verify iat and nbf are set
	if _, ok := claims["iat"]; !ok {
		t.Error("iat claim not found")
	}
	if _, ok := claims["nbf"]; !ok {
		t.Error("nbf claim not found")
	}

	// Verify jti is set
	if _, ok := claims["jti"].(string); !ok {
		t.Error("jti claim not found or not a string")
	}

	// Verify uris is an array with the correct URI
	uris, ok := claims["uris"].([]interface{})
	if !ok || len(uris) != 1 {
		t.Fatal("uris claim not found or not an array with one element")
	}
	expectedURI := "POST api.cdp.coinbase.com/platform/v2/evm/accounts/0x742d35Cc6634C0532925a3b844Bc454e4438f44e/sign/typed-data"
	if uris[0].(string) != expectedURI {
		t.Errorf("expected URI %s, got %s", expectedURI, uris[0])
	}
}

func TestGenerateWalletAuthToken_EmptyBodyHash(t *testing.T) {
	auth, err := NewCDPAuth(
		"organizations/test-org/apiKeys/test-key",
		testECPrivateKey,
		"wallet-secret",
	)
	if err != nil {
		t.Fatalf("failed to create auth: %v", err)
	}

	method := "POST"
	path := "/platform/v2/evm/accounts/test-account/sign"

	// Generate token with nil body hash
	token, err := auth.GenerateWalletAuthToken(method, path, nil)
	if err != nil {
		t.Fatalf("failed to generate wallet auth token: %v", err)
	}

	if token == "" {
		t.Fatal("expected non-empty token")
	}

	// Parse token
	parsedToken, err := jwt.ParseSigned(token)
	if err != nil {
		t.Fatalf("failed to parse JWT: %v", err)
	}

	// Extract claims (Wallet Auth uses map structure)
	var claims map[string]interface{}
	if err := parsedToken.UnsafeClaimsWithoutVerification(&claims); err != nil {
		t.Fatalf("failed to extract claims: %v", err)
	}

	// Verify reqHash is not set when no body hash provided
	if reqHash, ok := claims["reqHash"]; ok {
		t.Errorf("expected no reqHash claim, got %s", reqHash)
	}
}

func TestGenerateBearerToken_DifferentTokensForDifferentPaths(t *testing.T) {
	auth, err := NewCDPAuth(
		"organizations/test-org/apiKeys/test-key",
		testECPrivateKey,
		"wallet-secret",
	)
	if err != nil {
		t.Fatalf("failed to create auth: %v", err)
	}

	token1, err := auth.GenerateBearerToken("GET", "/platform/v2/evm/accounts")
	if err != nil {
		t.Fatalf("failed to generate token1: %v", err)
	}

	token2, err := auth.GenerateBearerToken("GET", "/platform/v2/solana/accounts")
	if err != nil {
		t.Fatalf("failed to generate token2: %v", err)
	}

	// Tokens should be different for different paths
	if token1 == token2 {
		t.Error("expected different tokens for different paths")
	}
}

func TestGenerateBearerToken_DifferentTokensForDifferentMethods(t *testing.T) {
	auth, err := NewCDPAuth(
		"organizations/test-org/apiKeys/test-key",
		testECPrivateKey,
		"wallet-secret",
	)
	if err != nil {
		t.Fatalf("failed to create auth: %v", err)
	}

	token1, err := auth.GenerateBearerToken("GET", "/platform/v2/evm/accounts")
	if err != nil {
		t.Fatalf("failed to generate token1: %v", err)
	}

	token2, err := auth.GenerateBearerToken("POST", "/platform/v2/evm/accounts")
	if err != nil {
		t.Fatalf("failed to generate token2: %v", err)
	}

	// Tokens should be different for different methods
	if token1 == token2 {
		t.Error("expected different tokens for different methods")
	}
}

func TestCDPAuth_ThreadSafe(t *testing.T) {
	auth, err := NewCDPAuth(
		"organizations/test-org/apiKeys/test-key",
		testECPrivateKey,
		"wallet-secret",
	)
	if err != nil {
		t.Fatalf("failed to create auth: %v", err)
	}

	// Test concurrent token generation
	done := make(chan bool, 10)
	for i := 0; i < 10; i++ {
		go func(idx int) {
			token, err := auth.GenerateBearerToken("GET", "/platform/v2/evm/accounts")
			if err != nil {
				t.Errorf("goroutine %d: failed to generate token: %v", idx, err)
			}
			if token == "" {
				t.Errorf("goroutine %d: expected non-empty token", idx)
			}
			done <- true
		}(i)
	}

	// Wait for all goroutines to complete
	for i := 0; i < 10; i++ {
		<-done
	}
}

func TestAPIKeyClaims_Structure(t *testing.T) {
	auth, err := NewCDPAuth(
		"organizations/test-org/apiKeys/test-key",
		testECPrivateKey,
		"wallet-secret",
	)
	if err != nil {
		t.Fatalf("failed to create auth: %v", err)
	}

	tests := []struct {
		name         string
		method       string
		path         string
		bodyHash     []byte
		checkReqHash bool
	}{
		{
			name:         "Bearer token without body hash",
			method:       "GET",
			path:         "/platform/v2/evm/accounts",
			bodyHash:     nil,
			checkReqHash: false,
		},
		{
			name:         "Wallet auth token with body hash",
			method:       "POST",
			path:         "/platform/v2/evm/accounts/test/sign",
			bodyHash:     []byte("test-hash-content"),
			checkReqHash: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var token string
			var err error

			if tt.checkReqHash {
				hash := sha256.Sum256(tt.bodyHash)
				token, err = auth.GenerateWalletAuthToken(tt.method, tt.path, hash[:])
			} else {
				token, err = auth.GenerateBearerToken(tt.method, tt.path)
			}

			if err != nil {
				t.Fatalf("failed to generate token: %v", err)
			}

			// Parse and verify claims structure
			parsedToken, err := jwt.ParseSigned(token)
			if err != nil {
				t.Fatalf("failed to parse JWT: %v", err)
			}

			if tt.checkReqHash {
				// Wallet Auth uses different claims structure
				var claims map[string]interface{}
				if err := parsedToken.UnsafeClaimsWithoutVerification(&claims); err != nil {
					t.Fatalf("failed to extract claims: %v", err)
				}

				// Verify Wallet Auth specific claims
				if _, ok := claims["iat"]; !ok {
					t.Error("expected iat to be set")
				}
				if _, ok := claims["nbf"]; !ok {
					t.Error("expected nbf to be set")
				}
				if _, ok := claims["jti"]; !ok {
					t.Error("expected jti to be set")
				}
				if uris, ok := claims["uris"].([]interface{}); !ok || len(uris) == 0 {
					t.Error("expected uris to be set")
				}

				// Verify reqHash is set for wallet auth token
				if reqHash, ok := claims["reqHash"].(string); !ok || reqHash == "" {
					t.Error("expected reqHash to be set for wallet auth token")
				}
			} else {
				// Bearer token uses APIKeyClaims structure
				var claims APIKeyClaims
				if err := parsedToken.UnsafeClaimsWithoutVerification(&claims); err != nil {
					t.Fatalf("failed to extract claims: %v", err)
				}

				// Verify all standard claims are present
				if claims.Subject == "" {
					t.Error("expected Subject to be set")
				}
				if claims.Issuer == "" {
					t.Error("expected Issuer to be set")
				}
				if claims.Expiry == nil {
					t.Error("expected Expiry to be set")
				}
				if claims.NotBefore == nil {
					t.Error("expected NotBefore to be set")
				}
				if len(claims.URIs) == 0 {
					t.Error("expected URIs to be set")
				}
				if len(claims.Audience) == 0 {
					t.Error("expected Audience to be set")
				}

				// Verify reqHash is empty for bearer token
				if claims.ReqHash != "" {
					t.Error("expected ReqHash to be empty for bearer token")
				}
			}
		})
	}
}
