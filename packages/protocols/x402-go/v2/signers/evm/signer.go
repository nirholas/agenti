package evm

import (
	"crypto/ecdsa"
	"fmt"
	"math/big"
	"strings"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"

	v2 "github.com/mark3labs/x402-go/v2"
	"github.com/mark3labs/x402-go/v2/internal/eip3009"
)

type Signer struct {
	privateKey *ecdsa.PrivateKey
	address    common.Address
	network    string
	chainID    int64
	tokens     []v2.TokenConfig
	priority   int
	maxAmount  *big.Int
}

type Option func(*Signer) error

func NewSigner(network string, privateKeyHex string, tokens []v2.TokenConfig, opts ...Option) (*Signer, error) {
	privateKeyHex = strings.TrimPrefix(privateKeyHex, "0x")
	privateKey, err := crypto.HexToECDSA(privateKeyHex)
	if err != nil {
		return nil, v2.ErrInvalidKey
	}

	s := &Signer{
		privateKey: privateKey,
		network:    network,
		tokens:     tokens,
		priority:   0,
	}

	for _, opt := range opts {
		if err := opt(s); err != nil {
			return nil, err
		}
	}

	s.address = crypto.PubkeyToAddress(privateKey.PublicKey)

	chainID, err := GetChainID(network)
	if err != nil {
		return nil, err
	}
	s.chainID = chainID

	return s, nil
}

func NewSignerFromKey(network string, key *ecdsa.PrivateKey, tokens []v2.TokenConfig, opts ...Option) (*Signer, error) {
	s := &Signer{
		privateKey: key,
		network:    network,
		tokens:     tokens,
		priority:   0,
	}

	for _, opt := range opts {
		if err := opt(s); err != nil {
			return nil, err
		}
	}

	s.address = crypto.PubkeyToAddress(key.PublicKey)

	chainID, err := GetChainID(network)
	if err != nil {
		return nil, err
	}
	s.chainID = chainID

	return s, nil
}

func WithPriority(priority int) Option {
	return func(s *Signer) error {
		s.priority = priority
		return nil
	}
}

func WithMaxAmount(amount *big.Int) Option {
	return func(s *Signer) error {
		s.maxAmount = amount
		return nil
	}
}

func (s *Signer) Network() string {
	return s.network
}

func (s *Signer) Scheme() string {
	return "exact"
}

func (s *Signer) CanSign(requirements *v2.PaymentRequirements) bool {
	if requirements.Scheme != "exact" {
		return false
	}

	if requirements.Network != s.network {
		return false
	}

	for _, token := range s.tokens {
		if strings.EqualFold(token.Address, requirements.Asset) {
			return true
		}
	}

	return false
}

func (s *Signer) Sign(requirements *v2.PaymentRequirements) (*v2.PaymentPayload, error) {
	if !s.CanSign(requirements) {
		return nil, v2.ErrNoValidSigner
	}

	amount, ok := new(big.Int).SetString(requirements.Amount, 10)
	if !ok {
		return nil, v2.ErrInvalidAmount
	}

	if s.maxAmount != nil && amount.Cmp(s.maxAmount) > 0 {
		return nil, v2.ErrAmountExceeded
	}

	var tokenAddress common.Address
	for _, token := range s.tokens {
		if strings.EqualFold(token.Address, requirements.Asset) {
			tokenAddress = common.HexToAddress(token.Address)
			break
		}
	}

	name, version, err := extractEIP3009Params(requirements)
	if err != nil {
		return nil, err
	}

	auth, err := eip3009.CreateAuthorization(
		s.address,
		common.HexToAddress(requirements.PayTo),
		amount,
		requirements.MaxTimeoutSeconds,
	)
	if err != nil {
		return nil, err
	}

	signature, err := eip3009.SignAuthorization(s.privateKey, tokenAddress, big.NewInt(s.chainID), auth, name, version)
	if err != nil {
		return nil, err
	}

	payload := &v2.PaymentPayload{
		X402Version: 2,
		Accepted:    *requirements,
		Payload: v2.EVMPayload{
			Signature: signature,
			Authorization: v2.EVMAuthorization{
				From:        auth.From.Hex(),
				To:          auth.To.Hex(),
				Value:       auth.Value.String(),
				ValidAfter:  auth.ValidAfter.String(),
				ValidBefore: auth.ValidBefore.String(),
				Nonce:       common.BytesToHash(auth.Nonce[:]).Hex(),
			},
		},
	}

	return payload, nil
}

func (s *Signer) GetPriority() int {
	return s.priority
}

func (s *Signer) GetTokens() []v2.TokenConfig {
	return s.tokens
}

func (s *Signer) GetMaxAmount() *big.Int {
	return s.maxAmount
}

func (s *Signer) Address() common.Address {
	return s.address
}

func GetChainID(network string) (int64, error) {
	switch network {
	case "eip155:8453":
		return 8453, nil
	case "eip155:84532":
		return 84532, nil
	case "eip155:1":
		return 1, nil
	case "eip155:11155111":
		return 11155111, nil
	case "eip155:137":
		return 137, nil
	case "eip155:80002":
		return 80002, nil
	case "eip155:43114":
		return 43114, nil
	case "eip155:43113":
		return 43113, nil
	default:
		return 0, v2.ErrInvalidNetwork
	}
}

func extractEIP3009Params(requirements *v2.PaymentRequirements) (name, version string, err error) {
	if requirements.Extra == nil {
		return "", "", fmt.Errorf("missing EIP-3009 parameters: Extra field is nil")
	}

	nameVal, ok := requirements.Extra["name"]
	if !ok {
		return "", "", fmt.Errorf("missing EIP-3009 parameter: name")
	}
	name, ok = nameVal.(string)
	if !ok {
		return "", "", fmt.Errorf("invalid EIP-3009 parameter: name is not a string")
	}

	versionVal, ok := requirements.Extra["version"]
	if !ok {
		return "", "", fmt.Errorf("missing EIP-3009 parameter: version")
	}
	version, ok = versionVal.(string)
	if !ok {
		return "", "", fmt.Errorf("invalid EIP-3009 parameter: version is not a string")
	}

	return name, version, nil
}
