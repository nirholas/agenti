package main

import (
	"encoding/hex"
	"encoding/json"

	"github.com/gosuda/x402-facilitator/api/client"
	"github.com/gosuda/x402-facilitator/scheme/evm"
	"github.com/gosuda/x402-facilitator/types"
	"github.com/rs/zerolog/log"
	"github.com/spf13/cobra"
)

var cmd = &cobra.Command{
	Use:   "x402-client",
	Short: "Start the facilitator client",
	Run:   run,
}

var (
	url     string
	scheme  string
	network string
	token   string
	from    string
	to      string
	amount  string
	privkey string
)

func init() {
	fs := cmd.PersistentFlags()

	fs.StringVarP(&url, "url", "u", "http://localhost:9090", "Base URL of the facilitator server")
	fs.StringVarP(&scheme, "scheme", "s", "evm", "Scheme to use")
	fs.StringVarP(&network, "network", "n", "base-sepolia", "Blockchain network to use")
	fs.StringVarP(&token, "token", "t", "USDC", "token contract for sending")
	fs.StringVarP(&from, "from", "F", "", "Sender address")
	fs.StringVarP(&to, "to", "T", "", "Recipient address")
	fs.StringVarP(&amount, "amount", "A", "", "Amount to send")
	fs.StringVarP(&privkey, "privkey", "P", "", "Sender private key")
}

func main() {
	if err := cmd.Execute(); err != nil {
		log.Fatal().Err(err).Msg("Failed to execute command")
	}
}

func run(cmd *cobra.Command, args []string) {
	client, err := client.NewClient(url)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to create client")
	}

	// Here you would implement the logic to interact with the facilitator server
	// using the provided parameters.
	log.Info().Msg("Sending payment request")
	var paymentPayload *types.PaymentPayload
	var paymentRequirements *types.PaymentRequirements
	switch scheme {
	case "evm":
		priv, err := hex.DecodeString(privkey)
		if err != nil {
			log.Fatal().Err(err).Msg("Failed to decode private key")
		}
		evmPayload, err := evm.NewEVMPayload(network, token, from, to, amount, evm.NewRawPrivateSigner(priv))
		if err != nil {
			log.Fatal().Err(err).Msg("Failed to create EVM payload")
		}
		jsonPayload, err := json.Marshal(evmPayload)
		if err != nil {
			log.Fatal().Err(err).Msg("Failed to marshal EVM payload to JSON")
		}
		paymentPayload = &types.PaymentPayload{
			X402Version: int(types.X402VersionV1),
			Scheme:      scheme,
			Network:     network,
			Payload:     jsonPayload,
		}
		paymentRequirements = &types.PaymentRequirements{
			Scheme:  scheme,
			Network: network,
			PayTo:   to,
			Asset:   token,
		}
	}

	verifyResp, err := client.Verify(cmd.Context(), paymentPayload, paymentRequirements)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to verify payment")
	}
	if !verifyResp.IsValid {
		log.Error().Str("invalidReason", verifyResp.InvalidReason).Msg("Payment verification failed")
		return
	}

	settleResp, err := client.Settle(cmd.Context(), paymentPayload, paymentRequirements)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to settle payment")
	}
	if !settleResp.Success {
		log.Error().Msg("Payment settlement failed")
		return
	}
	log.Info().Msg("Payment settled successfully")

}
