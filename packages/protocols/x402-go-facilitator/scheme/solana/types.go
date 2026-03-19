package solana

type SolPayload struct {
	Token  string `json:"token"`
	From   string `json:"from"`
	To     string `json:"to"`
	Amount uint64 `json:"amount"`
}
