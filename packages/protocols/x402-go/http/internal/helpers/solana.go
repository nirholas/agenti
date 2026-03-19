package helpers

import (
	"fmt"
	"log/slog"

	"github.com/gagliardetto/solana-go"
	"github.com/gagliardetto/solana-go/programs/system"
	"github.com/gagliardetto/solana-go/programs/token"
	"github.com/mark3labs/x402-go"
)

func getPayerWithSolana(payment x402.PaymentPayload, logger *slog.Logger) (string, error) {
	payload, ok := payment.Payload.(map[string]any)
	if !ok {
		logger.Error("invalid payload type")
		return "", fmt.Errorf("invalid payload type")
	}
	transaction, ok := payload["transaction"]
	if !ok {
		logger.Error("transaction not found in payload")
		return "", fmt.Errorf("transaction not found in payload")
	}

	base64Transaction, ok := transaction.(string)
	if !ok {
		logger.Error("transaction is not a string")
		return "", fmt.Errorf("transaction is not a string")
	}

	tx, err := solana.TransactionFromBase64(base64Transaction)
	if err != nil {
		logger.Error("failed to decode transaction", "error", err)
		return "", fmt.Errorf("failed to decode transaction: %w", err)
	}

	for _, inst := range tx.Message.Instructions {
		prog, err := tx.Message.ResolveProgramIDIndex(inst.ProgramIDIndex)
		if err != nil {
			logger.Error("failed to resolve program ID index", "index", inst.ProgramIDIndex, "error", err)
			continue
		}
		switch {
		case prog.Equals(solana.SystemProgramID):
			accountsMeta, err := inst.ResolveInstructionAccounts(&tx.Message)
			if err != nil {
				logger.Error("failed to resolve instruction accounts", "index", inst.ProgramIDIndex, "error", err)
				break
			}
			ix, err := system.DecodeInstruction(accountsMeta, inst.Data)
			if err != nil {
				logger.Error("failed to decode system instruction", "index", inst.ProgramIDIndex, "error", err)
				break
			}
			t, ok := ix.Impl.(*system.Transfer)
			if !ok {
				logger.Error("failed to decode system transfer instruction", "index", inst.ProgramIDIndex)
				break
			}
			return t.GetFundingAccount().PublicKey.String(), nil
		case prog.Equals(solana.TokenProgramID):
			accountsMeta, err := inst.ResolveInstructionAccounts(&tx.Message)
			if err != nil {
				logger.Error("failed to resolve instruction accounts", "index", inst.ProgramIDIndex, "error", err)
				break
			}

			ix, err := token.DecodeInstruction(accountsMeta, inst.Data)
			if err != nil {
				logger.Error("failed to decode token instruction", "index", inst.ProgramIDIndex, "error", err)
				break
			}

			switch t := ix.Impl.(type) {
			case *token.Transfer:
				return t.GetOwnerAccount().PublicKey.String(), nil
			case *token.TransferChecked:
				return t.GetOwnerAccount().PublicKey.String(), nil
			default:
				logger.Error("unhandled token instruction type", "index", inst.ProgramIDIndex, "type", fmt.Sprintf("%T", t))
			}
		default:
		}
	}
	return "", nil
}
