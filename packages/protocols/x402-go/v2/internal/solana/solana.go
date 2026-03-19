// Package solana provides Solana-specific utilities for the x402 v2 protocol.
package solana

import (
	"fmt"

	"github.com/gagliardetto/solana-go"
	"github.com/gagliardetto/solana-go/programs/token"
	"github.com/gagliardetto/solana-go/rpc"

	v2 "github.com/mark3labs/x402-go/v2"
)

// ComputeBudgetProgramID is the Solana Compute Budget program ID.
var ComputeBudgetProgramID = solana.MustPublicKeyFromBase58("ComputeBudget111111111111111111111111111111")

// DefaultComputeUnits is the default compute unit limit for transactions.
const DefaultComputeUnits uint32 = 200_000

// DefaultComputeUnitPrice is the default compute unit price in microlamports.
const DefaultComputeUnitPrice uint64 = 10_000

// BuildTransferCheckedInstruction creates an SPL Token TransferChecked instruction.
func BuildTransferCheckedInstruction(
	source, mint, destination solana.PublicKey,
	owner solana.PublicKey,
	amount uint64,
	decimals uint8,
) solana.Instruction {
	return token.NewTransferCheckedInstructionBuilder().
		SetAmount(amount).
		SetDecimals(decimals).
		SetSourceAccount(source).
		SetDestinationAccount(destination).
		SetMintAccount(mint).
		SetOwnerAccount(owner).
		Build()
}

// BuildSetComputeUnitLimitInstruction creates a SetComputeUnitLimit instruction.
// Format: [2, units (u32 little-endian)]
// Instruction discriminator 2 = SetComputeUnitLimit
func BuildSetComputeUnitLimitInstruction(units uint32) solana.Instruction {
	data := make([]byte, 5)
	data[0] = 2 // SetComputeUnitLimit discriminator
	data[1] = byte(units)
	data[2] = byte(units >> 8)
	data[3] = byte(units >> 16)
	data[4] = byte(units >> 24)

	return solana.NewInstruction(
		ComputeBudgetProgramID,
		solana.AccountMetaSlice{},
		data,
	)
}

// BuildSetComputeUnitPriceInstruction creates a SetComputeUnitPrice instruction.
// Format: [3, microlamports (u64 little-endian)]
// Instruction discriminator 3 = SetComputeUnitPrice
func BuildSetComputeUnitPriceInstruction(microlamports uint64) solana.Instruction {
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

	return solana.NewInstruction(
		ComputeBudgetProgramID,
		solana.AccountMetaSlice{},
		data,
	)
}

// DeriveAssociatedTokenAddress derives an Associated Token Account (ATA) address.
func DeriveAssociatedTokenAddress(owner, mint solana.PublicKey) (solana.PublicKey, error) {
	ata, _, err := solana.FindAssociatedTokenAddress(owner, mint)
	if err != nil {
		return solana.PublicKey{}, fmt.Errorf("failed to derive ATA: %w", err)
	}
	return ata, nil
}

// BuildCreateIdempotentATAInstruction creates an idempotent Associated Token Account creation instruction.
// Unlike the standard Create instruction (index 0), CreateIdempotent (index 1) will succeed
// even if the account already exists, making it safe to use in transactions where the ATA
// may or may not already be created.
//
// Accounts:
// [0] payer (signer, writable) - Funds the account creation if needed
// [1] associatedToken (writable) - The ATA to create
// [2] owner - The owner of the new ATA
// [3] mint - The SPL token mint
// [4] systemProgram - System program ID
// [5] tokenProgram - SPL Token program ID
func BuildCreateIdempotentATAInstruction(payer, owner, mint solana.PublicKey) (solana.Instruction, error) {
	ata, err := DeriveAssociatedTokenAddress(owner, mint)
	if err != nil {
		return nil, err
	}

	accounts := solana.AccountMetaSlice{
		{PublicKey: payer, IsSigner: true, IsWritable: true},
		{PublicKey: ata, IsSigner: false, IsWritable: true},
		{PublicKey: owner, IsSigner: false, IsWritable: false},
		{PublicKey: mint, IsSigner: false, IsWritable: false},
		{PublicKey: solana.SystemProgramID, IsSigner: false, IsWritable: false},
		{PublicKey: solana.TokenProgramID, IsSigner: false, IsWritable: false},
	}

	// Instruction data is just [1] for CreateIdempotent (instruction index 1)
	// See: https://github.com/solana-labs/solana-program-library/blob/master/associated-token-account/program/src/instruction.rs
	data := []byte{1}

	return solana.NewInstruction(
		solana.SPLAssociatedTokenAccountProgramID,
		accounts,
		data,
	), nil
}

// GetRPCURL returns the RPC URL for a CAIP-2 Solana network identifier.
func GetRPCURL(network string) (string, error) {
	switch network {
	case v2.NetworkSolanaMainnet:
		return rpc.MainNetBeta_RPC, nil
	case v2.NetworkSolanaDevnet:
		return rpc.DevNet_RPC, nil
	default:
		return "", fmt.Errorf("invalid network %s: %w", network, v2.ErrInvalidNetwork)
	}
}
