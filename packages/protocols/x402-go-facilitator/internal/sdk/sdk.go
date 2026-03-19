// Package sdk provides re-exports of the x402 SDK types and functions.
// This package serves as a single point of import for SDK functionality,
// ensuring consistent usage across the project.
//
// Principle: SDK provides functionality - never reimplement what SDK offers.
package sdk

import (
	x402 "github.com/coinbase/x402/go"
	"github.com/coinbase/x402/go/mechanisms/evm"
	"github.com/coinbase/x402/go/mechanisms/evm/exact/facilitator"
	"github.com/coinbase/x402/go/types"
)

// =============================================================================
// Type Aliases - Core Types
// =============================================================================

type (
	// PaymentPayload represents the V2 payment payload sent by clients
	PaymentPayload = types.PaymentPayload

	// PaymentRequirements defines the payment requirements from the resource server
	PaymentRequirements = types.PaymentRequirements

	// SupportedKind represents a supported scheme and network pair
	SupportedKind = types.SupportedKind

	// Network represents a blockchain network identifier (CAIP-2 format)
	Network = x402.Network

	// VerifyResponse is the response from payment verification
	VerifyResponse = x402.VerifyResponse

	// SettleResponse is the response from payment settlement
	SettleResponse = x402.SettleResponse
)

// =============================================================================
// Type Aliases - EVM Types
// =============================================================================

type (
	// ExactEIP3009Authorization represents the EIP-3009 TransferWithAuthorization data
	ExactEIP3009Authorization = evm.ExactEIP3009Authorization

	// ExactEIP3009Payload represents the exact payment payload for EVM networks
	ExactEIP3009Payload = evm.ExactEIP3009Payload

	// ExactPermit2Payload represents the Permit2 payment payload
	ExactPermit2Payload = evm.ExactPermit2Payload

	// FacilitatorEvmSigner is the interface that must be implemented
	// to connect the SDK to actual EVM RPC endpoints
	FacilitatorEvmSigner = evm.FacilitatorEvmSigner

	// TypedDataDomain represents the EIP-712 domain separator
	TypedDataDomain = evm.TypedDataDomain

	// TypedDataField represents a field in EIP-712 typed data
	TypedDataField = evm.TypedDataField

	// TransactionReceipt represents the receipt of a mined transaction
	TransactionReceipt = evm.TransactionReceipt

	// ExactEvmSchemeConfig holds configuration for the ExactEvmScheme facilitator
	ExactEvmSchemeConfig = facilitator.ExactEvmSchemeConfig
)

// =============================================================================
// Type Aliases - Facilitator Types
// =============================================================================

type (
	// X402Facilitator is the main facilitator type that manages payment mechanisms
	X402Facilitator = x402.X402Facilitator

	// SchemeNetworkFacilitator interface for V2 facilitator mechanisms
	SchemeNetworkFacilitator = x402.SchemeNetworkFacilitator
)

// =============================================================================
// Function Re-exports - Facilitator
// =============================================================================

var (
	// NewFacilitator creates a new x402 facilitator instance
	NewFacilitator = x402.Newx402Facilitator

	// NewExactEvmScheme creates a new EVM exact payment scheme facilitator
	NewExactEvmScheme = facilitator.NewExactEvmScheme
)

// =============================================================================
// Function Re-exports - Signature Verification
// =============================================================================

var (
	// VerifyUniversalSignature verifies signatures supporting EOA, EIP-1271, and ERC-6492
	VerifyUniversalSignature = evm.VerifyUniversalSignature

	// VerifyEOASignature verifies ECDSA signatures from EOA wallets
	VerifyEOASignature = evm.VerifyEOASignature

	// VerifyEIP1271Signature verifies signatures from smart contract wallets
	VerifyEIP1271Signature = evm.VerifyEIP1271Signature
)

// =============================================================================
// Function Re-exports - EIP-712 Hashing
// =============================================================================

var (
	// HashEIP3009Authorization hashes EIP-3009 TransferWithAuthorization data
	HashEIP3009Authorization = evm.HashEIP3009Authorization

	// HashPermit2Authorization hashes Permit2 authorization data
	HashPermit2Authorization = evm.HashPermit2Authorization
)

// =============================================================================
// Function Re-exports - ERC-6492
// =============================================================================

var (
	// ParseERC6492Signature parses an ERC-6492 wrapped signature
	ParseERC6492Signature = evm.ParseERC6492Signature

	// IsERC6492Signature checks if a signature is ERC-6492 wrapped
	IsERC6492Signature = evm.IsERC6492Signature
)

// =============================================================================
// Function Re-exports - Payload Detection
// =============================================================================

var (
	// IsPermit2Payload checks if a payload is a Permit2 payload
	IsPermit2Payload = evm.IsPermit2Payload

	// IsEIP3009Payload checks if a payload is an EIP-3009 payload
	IsEIP3009Payload = evm.IsEIP3009Payload

	// PayloadFromMap creates an EIP-3009 payload from a map
	PayloadFromMap = evm.PayloadFromMap

	// Permit2PayloadFromMap creates a Permit2 payload from a map
	Permit2PayloadFromMap = evm.Permit2PayloadFromMap
)

// =============================================================================
// Function Re-exports - Network Configuration
// =============================================================================

var (
	// GetNetworkConfig returns the network configuration for a given network
	GetNetworkConfig = evm.GetNetworkConfig

	// GetAssetInfo returns asset information for a given network and asset address
	GetAssetInfo = evm.GetAssetInfo
)

// =============================================================================
// Function Re-exports - Utilities
// =============================================================================

var (
	// HexToBytes converts a hex string to bytes
	HexToBytes = evm.HexToBytes
)

// =============================================================================
// Constants Re-exports
// =============================================================================

const (
	// PERMIT2Address is the canonical Permit2 contract address
	PERMIT2Address = evm.PERMIT2Address

	// SchemeExact is the scheme identifier for exact payments
	SchemeExact = evm.SchemeExact

	// TxStatusSuccess is the status code for successful transactions
	TxStatusSuccess = evm.TxStatusSuccess
)

// =============================================================================
// ABI Re-exports
// =============================================================================

var (
	// TransferWithAuthorizationVRSABI is the ABI for TransferWithAuthorization (v,r,s version)
	TransferWithAuthorizationVRSABI = evm.TransferWithAuthorizationVRSABI

	// TransferWithAuthorizationBytesABI is the ABI for TransferWithAuthorization (bytes version)
	TransferWithAuthorizationBytesABI = evm.TransferWithAuthorizationBytesABI

	// ERC20BalanceOfABI is the ABI for ERC20 balanceOf
	ERC20BalanceOfABI = evm.ERC20BalanceOfABI

	// AuthorizationStateABI is the ABI for checking authorization state
	AuthorizationStateABI = evm.AuthorizationStateABI
)
