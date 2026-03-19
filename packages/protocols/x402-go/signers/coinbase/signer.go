package coinbase

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"math/big"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gagliardetto/solana-go"
	"github.com/mark3labs/x402-go"
)

// Signer implements the x402.Signer interface using Coinbase Developer Platform (CDP) wallets.
// It provides secure transaction signing without managing private keys locally.
type Signer struct {
	cdpClient      *CDPClient
	auth           *CDPAuth
	accountName    string // Account name (optional identifier, not used in API paths)
	address        string // Blockchain address used as identifier in CDP API paths
	network        string
	networkType    NetworkType
	chainID        *big.Int
	tokens         []x402.TokenConfig
	priority       int
	maxAmount      *big.Int
	eip3009Name    string // EIP-3009 domain name for EVM chains
	eip3009Version string // EIP-3009 domain version for EVM chains
}

// SignerOption is a functional option for configuring a Signer.
type SignerOption func(*Signer) error

// NewSigner creates a new CDP signer with the given account name and options.
// The signer is initialized by creating or retrieving a CDP account for the specified network.
// At least one token must be configured via WithToken or WithTokenPriority.
//
// The accountName parameter is required and must be:
// - Between 2 and 36 characters long
// - Alphanumeric characters and hyphens only
// - Start and end with alphanumeric characters
// - Unique across all accounts in the CDP project
func NewSigner(accountName string, opts ...SignerOption) (*Signer, error) {
	s := &Signer{
		priority:    0,
		accountName: accountName,
	}

	// Apply all options
	for _, opt := range opts {
		if err := opt(s); err != nil {
			return nil, err
		}
	}

	// Validation
	if s.auth == nil {
		return nil, fmt.Errorf("CDP credentials not provided")
	}
	if s.network == "" {
		return nil, x402.ErrInvalidNetwork
	}
	if s.accountName == "" {
		return nil, fmt.Errorf("account name is required (use WithAccountName option)")
	}
	if len(s.tokens) == 0 {
		return nil, x402.ErrNoTokens
	}

	// Determine network type and chain ID
	s.networkType = getNetworkType(s.network)
	if s.networkType == NetworkTypeUnknown {
		return nil, x402.ErrInvalidNetwork
	}

	if s.networkType == NetworkTypeEVM {
		chainID, err := getChainID(s.network)
		if err != nil {
			return nil, err
		}
		s.chainID = chainID
	}

	// Initialize CDP client if not already set
	if s.cdpClient == nil {
		s.cdpClient = NewCDPClient(s.auth)
	}

	// Create or retrieve account for this network with the given name
	ctx := context.Background()
	account, err := CreateOrGetAccount(ctx, s.cdpClient, s.network, s.accountName)
	if err != nil {
		return nil, err
	}

	s.address = account.Address

	return s, nil
}

// WithCDPCredentials sets the CDP API credentials.
// apiKeyName format: "organizations/{org-id}/apiKeys/{key-id}" or just the UUID
// apiKeySecret: base64-encoded private key from CDP (Ed25519 raw or DER/PKCS8 format)
// walletSecret: Optional wallet-specific secret (empty string if not needed)
func WithCDPCredentials(apiKeyName, apiKeySecret, walletSecret string) SignerOption {
	return func(s *Signer) error {
		auth, err := NewCDPAuth(apiKeyName, apiKeySecret, walletSecret)
		if err != nil {
			return fmt.Errorf("failed to initialize CDP auth: %w", err)
		}
		s.auth = auth
		return nil
	}
}

// WithCDPCredentialsFromEnv loads CDP credentials from environment variables:
// - CDP_API_KEY_NAME
// - CDP_API_KEY_SECRET
// - CDP_WALLET_SECRET (optional)
func WithCDPCredentialsFromEnv() SignerOption {
	return func(s *Signer) error {
		apiKeyName := os.Getenv("CDP_API_KEY_NAME")
		apiKeySecret := os.Getenv("CDP_API_KEY_SECRET")
		walletSecret := os.Getenv("CDP_WALLET_SECRET")

		if apiKeyName == "" {
			return fmt.Errorf("CDP_API_KEY_NAME environment variable not set")
		}
		if apiKeySecret == "" {
			return fmt.Errorf("CDP_API_KEY_SECRET environment variable not set")
		}

		auth, err := NewCDPAuth(apiKeyName, apiKeySecret, walletSecret)
		if err != nil {
			return fmt.Errorf("failed to initialize CDP auth from env: %w", err)
		}
		s.auth = auth
		return nil
	}
}

// WithNetwork sets the blockchain network.
// Supported networks: base, base-sepolia, ethereum, sepolia, solana, solana-devnet
func WithNetwork(network string) SignerOption {
	return func(s *Signer) error {
		s.network = network

		// Set default EIP-3009 parameters based on network
		// These can be overridden with WithEIP3009Params if needed
		switch network {
		case "base", "ethereum":
			s.eip3009Name = "USD Coin"
			s.eip3009Version = "2"
		case "base-sepolia", "sepolia":
			// Base Sepolia and Ethereum Sepolia use "USDC" as the domain name
			s.eip3009Name = "USDC"
			s.eip3009Version = "2"
		}

		return nil
	}
}

// WithEIP3009Params sets custom EIP-3009 domain parameters for EVM chains.
// This overrides the default parameters set by WithNetwork.
// Only needed if the token contract uses non-standard domain parameters.
func WithEIP3009Params(name, version string) SignerOption {
	return func(s *Signer) error {
		s.eip3009Name = name
		s.eip3009Version = version
		return nil
	}
}

// WithToken adds a token configuration.
// address: Token contract address (EVM) or mint address (Solana)
// symbol: Token symbol (e.g., "USDC")
// decimals: Token decimal places
func WithToken(address, symbol string, decimals int) SignerOption {
	return func(s *Signer) error {
		s.tokens = append(s.tokens, x402.TokenConfig{
			Address:  address,
			Symbol:   symbol,
			Decimals: decimals,
			Priority: 0,
		})
		return nil
	}
}

// WithTokenPriority adds a token configuration with a specific priority.
// Lower priority numbers are selected first.
func WithTokenPriority(address, symbol string, decimals, priority int) SignerOption {
	return func(s *Signer) error {
		s.tokens = append(s.tokens, x402.TokenConfig{
			Address:  address,
			Symbol:   symbol,
			Decimals: decimals,
			Priority: priority,
		})
		return nil
	}
}

// WithPriority sets the signer priority for selection.
// Lower numbers indicate higher priority (1 > 2 > 3).
func WithPriority(priority int) SignerOption {
	return func(s *Signer) error {
		s.priority = priority
		return nil
	}
}

// WithMaxAmountPerCall sets the maximum amount per payment call.
// Amount should be specified as a base-10 string in token base units.
func WithMaxAmountPerCall(amount string) SignerOption {
	return func(s *Signer) error {
		maxAmount, ok := new(big.Int).SetString(amount, 10)
		if !ok {
			return x402.ErrInvalidAmount
		}
		s.maxAmount = maxAmount
		return nil
	}
}

// Network implements x402.Signer.
func (s *Signer) Network() string {
	return s.network
}

// Scheme implements x402.Signer.
func (s *Signer) Scheme() string {
	return "exact"
}

// CanSign implements x402.Signer.
func (s *Signer) CanSign(requirements *x402.PaymentRequirement) bool {
	// Check network match
	if requirements.Network != s.network {
		return false
	}

	// Check scheme match
	if requirements.Scheme != "exact" {
		return false
	}

	// Check if we have the required token
	for _, token := range s.tokens {
		if strings.EqualFold(token.Address, requirements.Asset) {
			return true
		}
	}

	return false
}

// Sign implements x402.Signer.
func (s *Signer) Sign(requirements *x402.PaymentRequirement) (*x402.PaymentPayload, error) {
	// Verify we can sign
	if !s.CanSign(requirements) {
		return nil, x402.ErrNoValidSigner
	}

	// Parse amount
	amount := new(big.Int)
	if _, ok := amount.SetString(requirements.MaxAmountRequired, 10); !ok {
		return nil, x402.ErrInvalidAmount
	}

	// Check max amount limit
	if s.maxAmount != nil && amount.Cmp(s.maxAmount) > 0 {
		return nil, x402.ErrAmountExceeded
	}

	// Route to chain-specific signing implementation
	switch s.networkType {
	case NetworkTypeEVM:
		return s.signEVM(requirements, amount)
	case NetworkTypeSVM:
		return s.signSVM(requirements, amount)
	default:
		return nil, fmt.Errorf("unsupported network type: %s", s.networkType)
	}
}

// GetPriority implements x402.Signer.
func (s *Signer) GetPriority() int {
	return s.priority
}

// GetTokens implements x402.Signer.
func (s *Signer) GetTokens() []x402.TokenConfig {
	return s.tokens
}

// GetMaxAmount implements x402.Signer.
func (s *Signer) GetMaxAmount() *big.Int {
	return s.maxAmount
}

// Address returns the CDP wallet address.
func (s *Signer) Address() string {
	return s.address
}

// AccountName returns the CDP account name (used as identifier in API paths).
func (s *Signer) AccountName() string {
	return s.accountName
}

// signEVM signs an EVM payment using EIP-3009 authorization.
func (s *Signer) signEVM(requirements *x402.PaymentRequirement, amount *big.Int) (*x402.PaymentPayload, error) {
	ctx := context.Background()

	// Find the token address
	var tokenAddress string
	for _, token := range s.tokens {
		if strings.EqualFold(token.Address, requirements.Asset) {
			tokenAddress = token.Address
			break
		}
	}
	if tokenAddress == "" {
		return nil, fmt.Errorf("token not found: %s", requirements.Asset)
	}

	// Create EIP-3009 authorization with timing and nonce
	auth, err := s.createEIP3009Authorization(requirements.PayTo, amount, requirements.MaxTimeoutSeconds)
	if err != nil {
		return nil, err
	}

	// Build EIP-712 typed data for CDP API
	typedData := s.buildEIP712TypedData(tokenAddress, auth)

	// Call CDP API to sign
	signature, err := s.signTypedData(ctx, typedData)
	if err != nil {
		return nil, err
	}

	// Build payment payload
	payload := &x402.PaymentPayload{
		X402Version: 1,
		Scheme:      "exact",
		Network:     s.network,
		Payload: x402.EVMPayload{
			Signature: signature,
			Authorization: x402.EVMAuthorization{
				From:        s.address,
				To:          requirements.PayTo,
				Value:       auth.Value,
				ValidAfter:  auth.ValidAfter,
				ValidBefore: auth.ValidBefore,
				Nonce:       auth.Nonce,
			},
		},
	}

	return payload, nil
}

// signSVM signs a Solana payment using TransferChecked instruction.
func (s *Signer) signSVM(requirements *x402.PaymentRequirement, amount *big.Int) (*x402.PaymentPayload, error) {
	ctx := context.Background()

	// Find the token configuration to get decimals
	var decimals uint8
	for _, token := range s.tokens {
		if strings.EqualFold(token.Address, requirements.Asset) {
			decimals = uint8(token.Decimals)
			break
		}
	}

	// Extract fee payer from requirements
	feePayer, err := extractFeePayer(requirements)
	if err != nil {
		return nil, err
	}

	// Get blockhash from Solana network
	blockhash, err := s.getRecentBlockhash(ctx)
	if err != nil {
		return nil, err
	}

	// Build the unsigned transaction
	unsignedTx, err := s.buildSolanaTransaction(
		requirements.Asset,
		requirements.PayTo,
		amount.Uint64(),
		decimals,
		feePayer,
		blockhash,
	)
	if err != nil {
		return nil, err
	}

	// Sign the transaction via CDP API
	signedTx, err := s.signSolanaTransaction(ctx, unsignedTx)
	if err != nil {
		return nil, err
	}

	// Build payment payload
	payload := &x402.PaymentPayload{
		X402Version: 1,
		Scheme:      "exact",
		Network:     s.network,
		Payload: map[string]any{
			"transaction": signedTx,
		},
	}

	return payload, nil
}

// eip3009Auth represents the parameters for EIP-3009 transferWithAuthorization.
type eip3009Auth struct {
	From        string
	To          string
	Value       string
	ValidAfter  string
	ValidBefore string
	Nonce       string
}

// createEIP3009Authorization creates a new EIP-3009 authorization with appropriate timing and nonce.
func (s *Signer) createEIP3009Authorization(to string, value *big.Int, timeoutSeconds int) (*eip3009Auth, error) {
	// Generate a cryptographically secure random nonce
	nonce, err := generateNonce()
	if err != nil {
		return nil, fmt.Errorf("failed to generate nonce: %w", err)
	}

	// Set validity window
	// Subtract 10 seconds from validAfter to account for clock drift between client and server
	now := time.Now().Unix()
	validAfter := big.NewInt(now - 10)
	validBefore := big.NewInt(now + int64(timeoutSeconds))

	return &eip3009Auth{
		From:        s.address,
		To:          to,
		Value:       value.String(),
		ValidAfter:  validAfter.String(),
		ValidBefore: validBefore.String(),
		Nonce:       nonce,
	}, nil
}

// generateNonce generates a cryptographically secure 32-byte random nonce as a hex string.
func generateNonce() (string, error) {
	var nonce [32]byte
	if _, err := rand.Read(nonce[:]); err != nil {
		return "", err
	}
	return "0x" + hex.EncodeToString(nonce[:]), nil
}

// typedData represents EIP-712 typed data for CDP API.
type typedData struct {
	Domain      typedDataDomain        `json:"domain"`
	Types       map[string][]typeField `json:"types"`
	PrimaryType string                 `json:"primaryType"`
	Message     map[string]interface{} `json:"message"`
}

type typedDataDomain struct {
	Name              string `json:"name"`
	Version           string `json:"version"`
	ChainID           int64  `json:"chainId"`
	VerifyingContract string `json:"verifyingContract"`
}

type typeField struct {
	Name string `json:"name"`
	Type string `json:"type"`
}

// buildEIP712TypedData constructs the EIP-712 typed data structure for EIP-3009 authorization.
func (s *Signer) buildEIP712TypedData(tokenAddress string, auth *eip3009Auth) typedData {
	return typedData{
		Domain: typedDataDomain{
			Name:              s.eip3009Name,
			Version:           s.eip3009Version,
			ChainID:           s.chainID.Int64(),
			VerifyingContract: tokenAddress,
		},
		Types: map[string][]typeField{
			"EIP712Domain": {
				{Name: "name", Type: "string"},
				{Name: "version", Type: "string"},
				{Name: "chainId", Type: "uint256"},
				{Name: "verifyingContract", Type: "address"},
			},
			"TransferWithAuthorization": {
				{Name: "from", Type: "address"},
				{Name: "to", Type: "address"},
				{Name: "value", Type: "uint256"},
				{Name: "validAfter", Type: "uint256"},
				{Name: "validBefore", Type: "uint256"},
				{Name: "nonce", Type: "bytes32"},
			},
		},
		PrimaryType: "TransferWithAuthorization",
		Message: map[string]interface{}{
			"from":        auth.From,
			"to":          auth.To,
			"value":       auth.Value,
			"validAfter":  auth.ValidAfter,
			"validBefore": auth.ValidBefore,
			"nonce":       auth.Nonce,
		},
	}
}

// signMessageResponse represents the CDP API response for signing operations.
type signMessageResponse struct {
	Signature string `json:"signature"`
}

// signTypedData calls the CDP API to sign EIP-712 typed data.
// The CDP API expects domain, types, primaryType, and message as top-level fields.
func (s *Signer) signTypedData(ctx context.Context, data typedData) (string, error) {
	path := fmt.Sprintf("/platform/v2/evm/accounts/%s/sign/typed-data", s.address)

	// CDP API expects the typed data fields at the top level, not nested
	req := map[string]interface{}{
		"domain":      data.Domain,
		"types":       data.Types,
		"primaryType": data.PrimaryType,
		"message":     data.Message,
	}

	var resp signMessageResponse
	err := s.cdpClient.doRequestWithRetry(ctx, "POST", path, req, &resp, true)
	if err != nil {
		return "", fmt.Errorf("sign typed data: %w", err)
	}

	return resp.Signature, nil
}

// extractFeePayer extracts the fee payer address from payment requirements.
// The fee payer is provided in requirements.Extra["feePayer"] as per the exact_svm spec.
func extractFeePayer(requirements *x402.PaymentRequirement) (string, error) {
	if requirements.Extra == nil {
		return "", fmt.Errorf("missing extra field in requirements")
	}

	feePayerStr, ok := requirements.Extra["feePayer"].(string)
	if !ok {
		return "", fmt.Errorf("feePayer not found or not a string in extra field")
	}

	if feePayerStr == "" {
		return "", fmt.Errorf("feePayer cannot be empty")
	}

	return feePayerStr, nil
}

// getRecentBlockhash retrieves a recent blockhash directly from the Solana network.
// CDP doesn't provide a blockhash endpoint, so we fetch it from the public RPC.
func (s *Signer) getRecentBlockhash(ctx context.Context) (string, error) {
	// Get RPC URL for the network
	var rpcURL string
	switch strings.ToLower(s.network) {
	case "solana", "mainnet-beta":
		rpcURL = "https://api.mainnet-beta.solana.com"
	case "solana-devnet", "devnet":
		rpcURL = "https://api.devnet.solana.com"
	case "testnet":
		rpcURL = "https://api.testnet.solana.com"
	default:
		return "", fmt.Errorf("unsupported Solana network: %s", s.network)
	}

	// Call Solana RPC getLatestBlockhash method
	type rpcRequest struct {
		JsonRPC string        `json:"jsonrpc"`
		ID      int           `json:"id"`
		Method  string        `json:"method"`
		Params  []interface{} `json:"params"`
	}

	type rpcResponse struct {
		Result struct {
			Context struct {
				Slot uint64 `json:"slot"`
			} `json:"context"`
			Value struct {
				Blockhash            string `json:"blockhash"`
				LastValidBlockHeight uint64 `json:"lastValidBlockHeight"`
			} `json:"value"`
		} `json:"result"`
		Error *struct {
			Code    int    `json:"code"`
			Message string `json:"message"`
		} `json:"error"`
	}

	reqBody := rpcRequest{
		JsonRPC: "2.0",
		ID:      1,
		Method:  "getLatestBlockhash",
		Params:  []interface{}{map[string]string{"commitment": "finalized"}},
	}

	reqJSON, err := json.Marshal(reqBody)
	if err != nil {
		return "", fmt.Errorf("marshal RPC request: %w", err)
	}

	httpReq, err := http.NewRequestWithContext(ctx, "POST", rpcURL, bytes.NewReader(reqJSON))
	if err != nil {
		return "", fmt.Errorf("create HTTP request: %w", err)
	}
	httpReq.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	httpResp, err := client.Do(httpReq)
	if err != nil {
		return "", fmt.Errorf("RPC request failed: %w", err)
	}
	defer httpResp.Body.Close()

	var rpcResp rpcResponse
	if err := json.NewDecoder(httpResp.Body).Decode(&rpcResp); err != nil {
		return "", fmt.Errorf("decode RPC response: %w", err)
	}

	if rpcResp.Error != nil {
		return "", fmt.Errorf("RPC error: %s", rpcResp.Error.Message)
	}

	if rpcResp.Result.Value.Blockhash == "" {
		return "", fmt.Errorf("empty blockhash in RPC response")
	}

	return rpcResp.Result.Value.Blockhash, nil
}

// solanaTransactionRequest represents the transaction structure for CDP signing.
type solanaTransactionRequest struct {
	Instructions []solanaInstruction `json:"instructions"`
	FeePayer     string              `json:"feePayer"`
	Blockhash    string              `json:"blockhash"`
}

// solanaInstruction represents a Solana instruction.
type solanaInstruction struct {
	ProgramID string              `json:"programId"`
	Accounts  []solanaAccountMeta `json:"accounts"`
	Data      string              `json:"data"`
}

// solanaAccountMeta represents account metadata for a Solana instruction.
type solanaAccountMeta struct {
	PublicKey  string `json:"pubkey"`
	IsSigner   bool   `json:"isSigner"`
	IsWritable bool   `json:"isWritable"`
}

// buildSolanaTransaction constructs an unsigned Solana transaction with TransferChecked instruction.
func (s *Signer) buildSolanaTransaction(
	mintAddress string,
	recipient string,
	amount uint64,
	decimals uint8,
	feePayer string,
	blockhash string,
) (*solanaTransactionRequest, error) {
	// Derive associated token accounts (this follows the SPL Token standard)
	// Source ATA: derived from signer's address + mint
	// Destination ATA: derived from recipient + mint
	sourceATA, err := deriveAssociatedTokenAddress(s.address, mintAddress)
	if err != nil {
		return nil, fmt.Errorf("failed to derive source ATA: %w", err)
	}

	destATA, err := deriveAssociatedTokenAddress(recipient, mintAddress)
	if err != nil {
		return nil, fmt.Errorf("failed to derive destination ATA: %w", err)
	}

	// Build compute budget instructions (matching svm/signer.go pattern)
	computeUnitLimitInst := buildComputeUnitLimitInstruction(200_000)
	computeUnitPriceInst := buildComputeUnitPriceInstruction(10_000)

	// Build TransferChecked instruction
	transferInst := buildTransferCheckedInstruction(
		sourceATA,
		mintAddress,
		destATA,
		s.address,
		amount,
		decimals,
	)

	// Construct transaction request
	tx := &solanaTransactionRequest{
		Instructions: []solanaInstruction{
			computeUnitLimitInst,
			computeUnitPriceInst,
			transferInst,
		},
		FeePayer:  feePayer,
		Blockhash: blockhash,
	}

	return tx, nil
}

// deriveAssociatedTokenAddress derives the Associated Token Account address.
// Uses the same derivation as svm/signer.go to ensure consistency.
func deriveAssociatedTokenAddress(ownerStr, mintStr string) (string, error) {
	owner, err := solana.PublicKeyFromBase58(ownerStr)
	if err != nil {
		return "", fmt.Errorf("invalid owner address: %w", err)
	}

	mint, err := solana.PublicKeyFromBase58(mintStr)
	if err != nil {
		return "", fmt.Errorf("invalid mint address: %w", err)
	}

	// Use the official solana-go function for ATA derivation
	ata, _, err := solana.FindAssociatedTokenAddress(owner, mint)
	if err != nil {
		return "", fmt.Errorf("failed to derive ATA: %w", err)
	}

	return ata.String(), nil
}

// buildComputeUnitLimitInstruction creates a SetComputeUnitLimit instruction.
func buildComputeUnitLimitInstruction(units uint32) solanaInstruction {
	// Instruction data: [2, units (u32 little-endian)]
	data := make([]byte, 5)
	data[0] = 2 // SetComputeUnitLimit discriminator
	data[1] = byte(units)
	data[2] = byte(units >> 8)
	data[3] = byte(units >> 16)
	data[4] = byte(units >> 24)

	return solanaInstruction{
		ProgramID: "ComputeBudget111111111111111111111111111111",
		Accounts:  []solanaAccountMeta{},
		Data:      hex.EncodeToString(data),
	}
}

// buildComputeUnitPriceInstruction creates a SetComputeUnitPrice instruction.
func buildComputeUnitPriceInstruction(microlamports uint64) solanaInstruction {
	// Instruction data: [3, microlamports (u64 little-endian)]
	data := make([]byte, 9)
	data[0] = 3 // SetComputeUnitPrice discriminator
	data[1] = byte(microlamports)
	data[2] = byte(microlamports >> 8)
	data[3] = byte(microlamports >> 16)
	data[4] = byte(microlamports >> 24)
	data[5] = byte(microlamports >> 32)
	data[6] = byte(microlamports >> 40)
	data[7] = byte(microlamports >> 48)
	data[8] = byte(microlamports >> 56)

	return solanaInstruction{
		ProgramID: "ComputeBudget111111111111111111111111111111",
		Accounts:  []solanaAccountMeta{},
		Data:      hex.EncodeToString(data),
	}
}

// buildTransferCheckedInstruction creates a TransferChecked instruction for SPL Token.
func buildTransferCheckedInstruction(
	source, mint, destination, owner string,
	amount uint64,
	decimals uint8,
) solanaInstruction {
	// TransferChecked instruction data: [12, amount (u64 LE), decimals (u8)]
	data := make([]byte, 10)
	data[0] = 12 // TransferChecked discriminator
	data[1] = byte(amount)
	data[2] = byte(amount >> 8)
	data[3] = byte(amount >> 16)
	data[4] = byte(amount >> 24)
	data[5] = byte(amount >> 32)
	data[6] = byte(amount >> 40)
	data[7] = byte(amount >> 48)
	data[8] = byte(amount >> 56)
	data[9] = decimals

	return solanaInstruction{
		ProgramID: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", // SPL Token program
		Accounts: []solanaAccountMeta{
			{PublicKey: source, IsSigner: false, IsWritable: true},      // Source account
			{PublicKey: mint, IsSigner: false, IsWritable: false},       // Mint
			{PublicKey: destination, IsSigner: false, IsWritable: true}, // Destination account
			{PublicKey: owner, IsSigner: true, IsWritable: false},       // Owner (signer)
		},
		Data: hex.EncodeToString(data),
	}
}

// signSolanaTransactionRequest represents the request to sign a Solana transaction.
// The Transaction field must be a base64-encoded serialized Solana transaction.
type signSolanaTransactionRequest struct {
	Transaction string `json:"transaction"`
}

// signSolanaTransactionResponse represents the response from signing a Solana transaction.
type signSolanaTransactionResponse struct {
	SignedTransaction string `json:"signedTransaction"`
}

// signSolanaTransaction calls the CDP API to sign a Solana transaction.
func (s *Signer) signSolanaTransaction(ctx context.Context, tx *solanaTransactionRequest) (string, error) {
	path := fmt.Sprintf("/platform/v2/solana/accounts/%s/sign/transaction", s.address)

	// Serialize the transaction to base64
	serializedTx, err := serializeSolanaTransaction(tx)
	if err != nil {
		return "", fmt.Errorf("failed to serialize transaction: %w", err)
	}

	req := signSolanaTransactionRequest{
		Transaction: serializedTx,
	}

	var resp signSolanaTransactionResponse
	err = s.cdpClient.doRequestWithRetry(ctx, "POST", path, req, &resp, true)
	if err != nil {
		return "", fmt.Errorf("sign solana transaction: %w", err)
	}

	if resp.SignedTransaction == "" {
		return "", fmt.Errorf("empty signed transaction returned from CDP API")
	}

	return resp.SignedTransaction, nil
}

// serializeSolanaTransaction serializes a Solana transaction to base64.
// This converts our internal transaction representation to a proper Solana transaction
// and serializes it to the base64 format that CDP API expects.
//
// The serialized format includes:
// 1. Signature slots (empty for unsigned transactions)
// 2. The message (header + accounts + blockhash + instructions)
//
// This matches the format that svm/signer.go produces.
func serializeSolanaTransaction(tx *solanaTransactionRequest) (string, error) {
	// Parse blockhash
	blockhash, err := solana.HashFromBase58(tx.Blockhash)
	if err != nil {
		return "", fmt.Errorf("invalid blockhash: %w", err)
	}

	// Parse fee payer
	feePayer, err := solana.PublicKeyFromBase58(tx.FeePayer)
	if err != nil {
		return "", fmt.Errorf("invalid fee payer: %w", err)
	}

	// Build Solana instructions
	var instructions []solana.Instruction
	for _, inst := range tx.Instructions {
		programID, err := solana.PublicKeyFromBase58(inst.ProgramID)
		if err != nil {
			return "", fmt.Errorf("invalid program ID %s: %w", inst.ProgramID, err)
		}

		// Parse accounts
		var accountMetas []*solana.AccountMeta
		for _, acc := range inst.Accounts {
			pubkey, err := solana.PublicKeyFromBase58(acc.PublicKey)
			if err != nil {
				return "", fmt.Errorf("invalid account pubkey %s: %w", acc.PublicKey, err)
			}
			accountMetas = append(accountMetas, &solana.AccountMeta{
				PublicKey:  pubkey,
				IsSigner:   acc.IsSigner,
				IsWritable: acc.IsWritable,
			})
		}

		// Decode instruction data from hex
		data, err := hex.DecodeString(inst.Data)
		if err != nil {
			return "", fmt.Errorf("invalid instruction data: %w", err)
		}

		instructions = append(instructions, solana.NewInstruction(
			programID,
			accountMetas,
			data,
		))
	}

	// Create the unsigned transaction (this creates signature slots)
	solanaTx, err := solana.NewTransaction(
		instructions,
		blockhash,
		solana.TransactionPayer(feePayer),
	)
	if err != nil {
		return "", fmt.Errorf("failed to create transaction: %w", err)
	}

	// Serialize the full transaction (includes empty signature slots)
	// This matches what svm/signer.go does with tx.MarshalBinary()
	serialized, err := solanaTx.MarshalBinary()
	if err != nil {
		return "", fmt.Errorf("failed to serialize transaction: %w", err)
	}

	// Encode to base64
	return base64.StdEncoding.EncodeToString(serialized), nil
}
