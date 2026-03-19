package helpers

import (
	"log/slog"

	"github.com/mark3labs/x402-go"
)

func GetPayer(payment x402.PaymentPayload) string {
	logger := slog.Default()
	switch payment.Network {
	case x402.SolanaDevnet.NetworkID, x402.SolanaMainnet.NetworkID:
		payer, err := getPayerWithSolana(payment, logger)
		if err != nil {
			logger.Error("failed to get payer with solana", "err", err)
			return ""
		}
		return payer
	default:
		return ""
	}
}
