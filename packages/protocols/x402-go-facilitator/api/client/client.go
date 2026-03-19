package client

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"

	"github.com/gosuda/x402-facilitator/types"
)

type Client struct {
	BaseURL          *url.URL
	HTTPClient       *http.Client
	CreateAuthHeader func() (map[string]map[string]string, error)
}

func NewClient(baseURL string) (*Client, error) {
	parsed, err := url.Parse(baseURL)
	if err != nil {
		return nil, fmt.Errorf("invalid base URL: %w", err)
	}
	return &Client{
		BaseURL:    parsed,
		HTTPClient: http.DefaultClient,
	}, nil
}

// Supported fetches the list of supported schemes.
func (c *Client) Supported(ctx context.Context) ([]types.SupportedKind, error) {
	var result []types.SupportedKind
	if err := c.doRequest(ctx, http.MethodGet, "/supported", nil, "", &result); err != nil {
		return nil, err
	}
	return result, nil
}

func (c *Client) Verify(ctx context.Context, payload *types.PaymentPayload, req *types.PaymentRequirements) (*types.PaymentVerifyResponse, error) {
	body := types.PaymentVerifyRequest{
		X402Version:         int(types.X402VersionV1),
		PaymentHeader:       *payload,
		PaymentRequirements: *req,
	}

	var resp types.PaymentVerifyResponse
	if err := c.doRequest(ctx, http.MethodPost, "/verify", body, "verify", &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

// Settle sends a payment settlement request.
func (c *Client) Settle(ctx context.Context, payload *types.PaymentPayload, req *types.PaymentRequirements) (*types.PaymentSettleResponse, error) {
	body := types.PaymentSettleRequest{
		X402Version:         int(types.X402VersionV1),
		PaymentHeader:       *payload,
		PaymentRequirements: *req,
	}

	var resp types.PaymentSettleResponse
	if err := c.doRequest(ctx, http.MethodPost, "/settle", body, "settle", &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

func (c *Client) doRequest(ctx context.Context, method, path string, body any, authKey string, out any) error {
	// Build URL
	u := c.BaseURL.ResolveReference(&url.URL{Path: path})

	// Prepare body
	var reader io.Reader
	if body != nil {
		payload, err := json.Marshal(body)
		if err != nil {
			return fmt.Errorf("marshal request body: %w", err)
		}
		reader = bytes.NewReader(payload)
	}

	// Create HTTP request
	req, err := http.NewRequestWithContext(ctx, method, u.String(), reader)
	if err != nil {
		return err
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	if authKey != "" && c.CreateAuthHeader != nil {
		hdrs, err := c.CreateAuthHeader()
		if err != nil {
			return fmt.Errorf("create auth headers: %w", err)
		}
		if section, ok := hdrs[authKey]; ok {
			for k, v := range section {
				req.Header.Set(k, v)
			}
		}
	}

	// Execute
	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		data, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("%s %s failed: status %d, body: %s", method, path, resp.StatusCode, string(data))
	}

	if out != nil {
		if err := json.NewDecoder(resp.Body).Decode(out); err != nil {
			return fmt.Errorf("decode %s response: %w", path, err)
		}
	}
	return nil
}
