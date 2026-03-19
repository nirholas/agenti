package coinbase

import (
	"crypto"
	"crypto/ecdsa"
	"crypto/ed25519"
	"crypto/rand"
	"crypto/x509"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"strings"
	"time"

	"gopkg.in/square/go-jose.v2"
	"gopkg.in/square/go-jose.v2/jwt"
)

// CDPAuth manages CDP API authentication credentials and JWT token generation.
// It handles parsing of base64-encoded private keys in multiple formats and generates
// both Bearer tokens for standard API authentication and Wallet Authentication tokens
// for sensitive signing operations.
//
// CDPAuth is immutable after construction and thread-safe for concurrent use.
// The parsed private key is cached internally to avoid repeated parsing overhead.
//
// The apiKeySecret can be in any of these formats provided by CDP:
//   - Raw Ed25519 private key: 64-byte base64-encoded key (e.g., "hM...Few==")
//   - Ed25519 seed: 32-byte base64-encoded seed
//   - DER/PKCS8 format: ASN.1 encoded key (e.g., "MIG...BtY")
//   - SEC1/EC format: ECDSA private key in SEC1 format
//
// Example usage:
//
//	auth, err := NewCDPAuth(
//	    "organizations/abc/apiKeys/xyz",
//	    "hM...Few==",  // base64-encoded Ed25519 or PKCS8 key from CDP
//	    "MIG...BtY",   // base64-encoded wallet secret (PKCS8 ECDSA)
//	)
//	if err != nil {
//	    log.Fatal(err)
//	}
//
//	token, err := auth.GenerateBearerToken("GET", "/platform/v2/evm/accounts")
//	if err != nil {
//	    log.Fatal(err)
//	}
type CDPAuth struct {
	// apiKeyName is the CDP API key identifier (e.g., "organizations/xxx/apiKeys/yyy")
	apiKeyName string

	// apiKeySecret is the base64-encoded private key from CDP (Ed25519 or PKCS8)
	apiKeySecret string

	// walletSecret is the wallet-specific secret for signing operations (optional)
	walletSecret string

	// privateKey is the parsed API key for Bearer tokens
	privateKey interface{}

	// walletPrivateKey is the parsed wallet key for Wallet Auth tokens (may be same as privateKey)
	walletPrivateKey interface{}
}

// APIKeyClaims represents the JWT claims structure required by CDP API.
// It extends the standard JWT claims with CDP-specific fields for request
// authentication and integrity verification.
type APIKeyClaims struct {
	*jwt.Claims
	// URIs is an array of request URIs in format: ["{METHOD} api.cdp.coinbase.com{path}"]
	URIs []string `json:"uris,omitempty"`
	// ReqHash is the hex-encoded SHA-256 hash of the request body (optional)
	ReqHash string `json:"reqHash,omitempty"`
}

// NewCDPAuth creates a new CDPAuth instance with the provided credentials.
// It validates the API key name and parses the base64-encoded private key,
// caching the parsed key for efficient token generation.
//
// The apiKeySecret can be in any of these formats:
//   - Raw Ed25519 private key (64 bytes) - Common for API Key Secrets
//   - Ed25519 seed (32 bytes)
//   - DER/PKCS8 format - Common for Wallet Secrets
//   - SEC1/EC format - ECDSA private keys
//
// Parameters:
//   - apiKeyName: CDP API key identifier (required, must not be empty)
//   - apiKeySecret: base64-encoded private key in any supported format (required)
//   - walletSecret: Wallet-specific secret for signing operations (optional)
//
// Returns:
//   - *CDPAuth: Configured authentication instance
//   - error: Validation or parsing errors
//
// Errors:
//   - Returns error if apiKeyName is empty
//   - Returns error if apiKeySecret is not valid base64 format
//   - Returns error if private key parsing fails for all supported formats
//
// Example:
//
//	auth, err := NewCDPAuth(
//	    os.Getenv("CDP_API_KEY_NAME"),
//	    os.Getenv("CDP_API_KEY_SECRET"),   // Raw Ed25519 or PKCS8
//	    os.Getenv("CDP_WALLET_SECRET"),    // PKCS8 ECDSA
//	)
func NewCDPAuth(apiKeyName, apiKeySecret, walletSecret string) (*CDPAuth, error) {
	// Validate API key name
	if apiKeyName == "" {
		return nil, fmt.Errorf("apiKeyName must not be empty")
	}

	// Decode base64-encoded private key
	keyBytes, err := base64.StdEncoding.DecodeString(strings.TrimSpace(apiKeySecret))
	if err != nil {
		return nil, fmt.Errorf("failed to decode base64 key: %w", err)
	}

	// Parse private key - CDP uses multiple formats:
	// 1. Raw Ed25519 64-byte private key (API Key Secret)
	// 2. DER/PKCS8 format (Wallet Secret, older API keys)
	// 3. SEC1/RFC 5915 EC private key format
	var privateKey interface{}
	var parseErr error

	// Try format 1: Raw Ed25519 private key (64 bytes)
	if len(keyBytes) == ed25519.PrivateKeySize {
		privateKey = ed25519.PrivateKey(keyBytes)
	} else if len(keyBytes) == ed25519.SeedSize {
		// Also accept 32-byte Ed25519 seed
		privateKey = ed25519.NewKeyFromSeed(keyBytes)
	} else {
		// Try format 2: PKCS8 DER format (supports both ECDSA and Ed25519)
		privateKey, parseErr = x509.ParsePKCS8PrivateKey(keyBytes)
		if parseErr != nil {
			// Try format 3: EC private key (SEC1/RFC 5915 format)
			privateKey, parseErr = x509.ParseECPrivateKey(keyBytes)
			if parseErr != nil {
				return nil, fmt.Errorf("failed to parse private key (tried Ed25519 raw, PKCS8, and EC formats): %w", parseErr)
			}
		}
	}

	// Validate key type
	switch k := privateKey.(type) {
	case *ecdsa.PrivateKey:
		// ECDSA is valid
	case ed25519.PrivateKey:
		// Ed25519 is valid
	case crypto.Signer:
		// Other crypto.Signer implementations
	default:
		return nil, fmt.Errorf("unsupported private key type %T: must be ECDSA or Ed25519", k)
	}

	// Parse wallet secret if provided (used for Wallet Auth tokens)
	// If not provided or invalid, fall back to using API key for both types of tokens
	var walletPrivateKey interface{}
	if walletSecret != "" {
		walletKeyBytes, err := base64.StdEncoding.DecodeString(strings.TrimSpace(walletSecret))
		// Only proceed if base64 decoding succeeded
		if err == nil && len(walletKeyBytes) > 0 {
			// Parse wallet key using same format support
			var walletParseErr error
			if len(walletKeyBytes) == ed25519.PrivateKeySize {
				walletPrivateKey = ed25519.PrivateKey(walletKeyBytes)
			} else if len(walletKeyBytes) == ed25519.SeedSize {
				walletPrivateKey = ed25519.NewKeyFromSeed(walletKeyBytes)
			} else {
				walletPrivateKey, walletParseErr = x509.ParsePKCS8PrivateKey(walletKeyBytes)
				if walletParseErr != nil {
					walletPrivateKey, walletParseErr = x509.ParseECPrivateKey(walletKeyBytes)
					if walletParseErr != nil {
						return nil, fmt.Errorf("failed to parse wallet secret (tried Ed25519 raw, PKCS8, and EC formats): %w", walletParseErr)
					}
				}
			}

			// Validate wallet key type
			switch k := walletPrivateKey.(type) {
			case *ecdsa.PrivateKey:
				// ECDSA is valid
			case ed25519.PrivateKey:
				// Ed25519 is valid
			case crypto.Signer:
				// Other crypto.Signer implementations
			default:
				return nil, fmt.Errorf("unsupported wallet key type %T: must be ECDSA or Ed25519", k)
			}
		}
	}

	// If wallet key wasn't successfully parsed, use API key for both Bearer and Wallet Auth
	if walletPrivateKey == nil {
		walletPrivateKey = privateKey
	}

	return &CDPAuth{
		apiKeyName:       apiKeyName,
		apiKeySecret:     apiKeySecret,
		walletSecret:     walletSecret,
		privateKey:       privateKey,
		walletPrivateKey: walletPrivateKey,
	}, nil
}

// GenerateBearerToken generates a JWT Bearer token for standard CDP API authentication.
// The token is valid for 2 minutes and includes claims for request identification
// and authorization.
//
// Parameters:
//   - method: HTTP method (e.g., "GET", "POST", "PUT", "DELETE")
//   - path: API endpoint path (e.g., "/platform/v2/evm/accounts")
//
// Returns:
//   - string: Signed JWT token for Authorization header
//   - error: Token generation or signing errors
//
// The generated JWT includes the following claims:
//   - sub: API key name
//   - iss: "coinbase-cloud"
//   - nbf: Current timestamp (not before)
//   - exp: Current timestamp + 2 minutes (expiration)
//   - uri: "{method} api.cdp.coinbase.com{path}"
//
// Example:
//
//	token, err := auth.GenerateBearerToken("GET", "/platform/v2/evm/accounts")
//	if err != nil {
//	    return err
//	}
//	req.Header.Set("Authorization", "Bearer "+token)
func (a *CDPAuth) GenerateBearerToken(method, path string) (string, error) {
	return a.generateJWT(method, path, nil, 2*time.Minute)
}

// GenerateWalletAuthToken generates a JWT Wallet Authentication token for sensitive
// signing operations. The token is valid for 1 minute and includes a hash of the
// request body for integrity verification.
//
// Unlike Bearer tokens, Wallet Auth tokens use a different claims structure:
//   - iat: Issued at timestamp
//   - nbf: Not before timestamp
//   - jti: Unique JWT ID
//   - uris: Array containing the request URI
//   - reqHash: Hex-encoded SHA-256 hash of sorted JSON request body
//
// Parameters:
//   - method: HTTP method (typically "POST" for signing operations)
//   - path: API endpoint path
//   - bodyHash: SHA-256 hash of the sorted JSON request body bytes
//
// Returns:
//   - string: Signed JWT token for X-Wallet-Auth header
//   - error: Token generation or signing errors
//
// Example:
//
//	bodyBytes, _ := json.Marshal(signRequest)
//	hash := sha256.Sum256(bodyBytes)
//	token, err := auth.GenerateWalletAuthToken("POST", "/platform/v2/evm/accounts/0x.../sign/typed-data", hash[:])
//	if err != nil {
//	    return err
//	}
//	req.Header.Set("X-Wallet-Auth", token)
func (a *CDPAuth) GenerateWalletAuthToken(method, path string, bodyHash []byte) (string, error) {
	// Use wallet private key for Wallet Auth tokens with wallet-specific claims
	return a.generateWalletJWT(a.walletPrivateKey, method, path, bodyHash)
}

// generateJWT is the internal JWT generation implementation for Bearer tokens.
func (a *CDPAuth) generateJWT(method, path string, bodyHash []byte, expiration time.Duration) (string, error) {
	// Use API private key for Bearer tokens
	return a.generateJWTWithKey(a.privateKey, method, path, bodyHash, expiration)
}

// generateWalletJWT generates a Wallet Authentication JWT with CDP-specific claims.
// Unlike Bearer tokens, Wallet Auth uses: iat, nbf, jti, uris (array), reqHash
func (a *CDPAuth) generateWalletJWT(key interface{}, method, path string, bodyHash []byte) (string, error) {
	// Determine signing algorithm based on key type
	var alg jose.SignatureAlgorithm
	switch key.(type) {
	case *ecdsa.PrivateKey:
		alg = jose.ES256
	case ed25519.PrivateKey:
		alg = jose.EdDSA
	case crypto.Signer:
		alg = jose.EdDSA
	default:
		return "", fmt.Errorf("unsupported wallet key type for JWT signing: %T", key)
	}

	// Create signer WITHOUT kid header (CDP Wallet Auth doesn't use kid)
	sig, err := jose.NewSigner(
		jose.SigningKey{Algorithm: alg, Key: key},
		(&jose.SignerOptions{}).WithType("JWT"),
	)
	if err != nil {
		return "", fmt.Errorf("failed to create wallet JWT signer (key type: %T, alg: %s): %w", key, alg, err)
	}

	// Build URI - note the array format for Wallet Auth
	uri := fmt.Sprintf("%s %s%s", method, "api.cdp.coinbase.com", path)

	// Calculate request hash if body provided
	var reqHash string
	if len(bodyHash) > 0 {
		reqHash = hex.EncodeToString(bodyHash)
	}

	// Generate a unique JTI
	jtiBytes := make([]byte, 16)
	if _, err := rand.Read(jtiBytes); err != nil {
		return "", fmt.Errorf("generate JTI: %w", err)
	}
	jti := hex.EncodeToString(jtiBytes)

	// Create Wallet Auth claims (different structure from Bearer)
	now := time.Now()
	walletClaims := map[string]interface{}{
		"iat":  now.Unix(),
		"nbf":  now.Unix(),
		"jti":  jti,
		"uris": []string{uri},
	}
	if reqHash != "" {
		walletClaims["reqHash"] = reqHash
	}

	// Sign and serialize JWT
	token, err := jwt.Signed(sig).Claims(walletClaims).CompactSerialize()
	if err != nil {
		return "", fmt.Errorf("failed to serialize wallet JWT: %w", err)
	}

	return token, nil
}

// generateJWTWithKey is the core JWT generation implementation that accepts a specific key.
func (a *CDPAuth) generateJWTWithKey(key interface{}, method, path string, bodyHash []byte, expiration time.Duration) (string, error) {
	// Determine signing algorithm based on key type
	var alg jose.SignatureAlgorithm
	switch key.(type) {
	case *ecdsa.PrivateKey:
		alg = jose.ES256
	case ed25519.PrivateKey:
		alg = jose.EdDSA
	case crypto.Signer:
		// Other crypto.Signer implementations (fallback to EdDSA)
		alg = jose.EdDSA
	default:
		return "", fmt.Errorf("unsupported key type for JWT signing: %T", key)
	}

	// Generate random nonce for JWT header (16 digits as per CDP SDK)
	nonceBytes := make([]byte, 8) // 8 bytes = 16 hex chars
	if _, err := rand.Read(nonceBytes); err != nil {
		return "", fmt.Errorf("generate nonce: %w", err)
	}
	nonce := hex.EncodeToString(nonceBytes)

	// Create signer with key ID header and nonce
	sig, err := jose.NewSigner(
		jose.SigningKey{Algorithm: alg, Key: key},
		(&jose.SignerOptions{}).
			WithType("JWT").
			WithHeader("kid", a.apiKeyName).
			WithHeader("nonce", nonce),
	)
	if err != nil {
		return "", fmt.Errorf("failed to create JWT signer (key type: %T, alg: %s): %w", key, alg, err)
	}

	// Build URI claim (as array per CDP API spec)
	uri := fmt.Sprintf("%s api.cdp.coinbase.com%s", method, path)

	// Calculate request hash if body provided
	var reqHash string
	if len(bodyHash) > 0 {
		reqHash = hex.EncodeToString(bodyHash)
	}

	// Create claims with CDP-specific structure
	now := time.Now()
	claims := &APIKeyClaims{
		Claims: &jwt.Claims{
			Subject:   a.apiKeyName,
			Issuer:    "cdp",                       // CDP uses "cdp", not "coinbase-cloud"
			Audience:  jwt.Audience{"cdp_service"}, // Audience is an array
			NotBefore: jwt.NewNumericDate(now),
			Expiry:    jwt.NewNumericDate(now.Add(expiration)),
		},
		URIs:    []string{uri}, // URIs is an array
		ReqHash: reqHash,
	}

	// Sign and serialize JWT
	token, err := jwt.Signed(sig).Claims(claims).CompactSerialize()
	if err != nil {
		return "", fmt.Errorf("failed to serialize JWT: %w", err)
	}

	return token, nil
}
