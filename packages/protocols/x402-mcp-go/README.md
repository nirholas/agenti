# ⚠️ ARCHIVED - This Repository Has Moved

**This repository is archived.** MCP functionality has been merged into the main x402-go library:

### 👉 https://github.com/mark3labs/x402-go

Please use the main library for all future development. This repository is no longer maintained.

---

# mcp-go-x402

x402 payment protocol support for [MCP-Go](https://github.com/mark3labs/mcp-go) clients and servers.

This library provides:
- **Client Transport**: Automatic x402 payment handling for MCP clients
- **Server Wrapper**: Payment collection support for MCP servers

## Features

### Client Features
- 🔌 **Drop-in replacement**: Fully compatible with mcp-go transport interface
- 💰 **Automatic payments**: Handles 402 responses transparently
- 🔐 **Multiple signers**: Support for private keys, mnemonics, keystores
- 🎯 **Payment control**: Optional callback for payment approval
- 🧪 **Testing support**: Mock signers and payment recorders for easy testing

### Server Features
- 💳 **Payment collection**: Require payments for specific MCP tools
- 🔒 **Payment verification**: Automatic verification via x402 facilitator
- ⛓️ **On-chain settlement**: Automatic settlement of verified payments
- 🎛️ **Flexible pricing**: Set different prices for different tools
- 🔄 **Mixed mode**: Support both free and paid tools on same server

## Installation

```bash
go get github.com/mark3labs/mcp-go-x402
```

## Quick Start

### Client Usage

```go
package main

import (
    "context"
    "log"
    
    "github.com/mark3labs/mcp-go/client"
    "github.com/mark3labs/mcp-go/mcp"
    x402 "github.com/mark3labs/mcp-go-x402"
)

func main() {
    signer, err := x402.NewPrivateKeySigner(
        "YOUR_PRIVATE_KEY_HEX",
        x402.AcceptUSDCBase(),
    )
    if err != nil {
        log.Fatal(err)
    }
    
    transport, err := x402.New(x402.Config{
        ServerURL: "https://paid-mcp-server.example.com",
        Signers:   []x402.PaymentSigner{signer},
    })
    if err != nil {
        log.Fatal(err)
    }
    
    mcpClient := client.NewClient(transport)
    
    ctx := context.Background()
    if err := mcpClient.Start(ctx); err != nil {
        log.Fatal(err)
    }
    defer mcpClient.Close()
    
    _, err = mcpClient.Initialize(ctx, mcp.InitializeRequest{
        Params: mcp.InitializeParams{
            ProtocolVersion: "1.0.0",
            ClientInfo: mcp.Implementation{
                Name:    "x402-client",
                Version: "1.0.0",
            },
        },
    })
    if err != nil {
        log.Fatal(err)
    }
    
    tools, _ := mcpClient.ListTools(ctx, mcp.ListToolsRequest{})
    log.Printf("Found %d tools", len(tools.Tools))
}
```

### Server Usage

```go
package main

import (
    "context"
    "log"
    
    "github.com/mark3labs/mcp-go/mcp"
    "github.com/mark3labs/mcp-go/server"
    x402server "github.com/mark3labs/mcp-go-x402/server"
)

func main() {
    // Configure x402 server
    config := &x402server.Config{
        FacilitatorURL:  "https://facilitator.x402.rs",
        VerifyOnly:      false, // Set to true for testing without settlement
    }
    
    // Create x402 server
    srv := x402server.NewX402Server("my-server", "1.0.0", config)
    
    // Add a free tool
    srv.AddTool(
        mcp.NewTool("free-tool", 
            mcp.WithDescription("This tool is free")),
        freeToolHandler,
    )
    
    // Add a paid tool with multiple payment options
    srv.AddPayableTool(
        mcp.NewTool("premium-tool",
            mcp.WithDescription("Premium feature"),
            mcp.WithString("input", mcp.Required())),
        premiumToolHandler,
        x402server.RequireUSDCBase("0xYourWallet", "10000", "Premium feature"),
        x402server.RequireUSDCBaseSepolia("0xYourWallet", "5000", "Premium feature (testnet)"),
    )
    
    // Start server
    log.Println("Starting x402 MCP server on :8080")
    if err := srv.Start(":8080"); err != nil {
        log.Fatal(err)
    }
}

func freeToolHandler(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
    return &mcp.CallToolResult{
        Content: []mcp.Content{mcp.NewTextContent("Free response")},
    }, nil
}

func premiumToolHandler(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
    input := req.GetString("input", "")
    // Process premium request
    return &mcp.CallToolResult{
        Content: []mcp.Content{mcp.NewTextContent("Premium response for: " + input)},
    }, nil
}
```

## Solana (SVM) Support

The library supports Solana payments using SPL tokens in addition to EVM-based payments.

### Client Usage with Solana

```go
// Create Solana signer with base58 private key
signer, err := x402.NewSolanaPrivateKeySigner(
    privateKeyBase58,
    x402.AcceptUSDCSolanaDevnet(),
)

// Or load from Solana CLI keypair file
signer, err := x402.NewSolanaPrivateKeySignerFromFile(
    "~/.config/solana/id.json",
    x402.AcceptUSDCSolana().WithPriority(2),
)

// Use with transport
transport, err := x402.New(x402.Config{
    ServerURL: "http://localhost:8080",
    Signers:   []x402.PaymentSigner{signer},
})
```

### Server Usage with Solana

```go
srv.AddPayableTool(
    mcp.NewTool("premium-search",
        mcp.WithDescription("Premium search on Solana")),
    searchHandler,
    x402server.RequireUSDCSolanaDevnet(
        recipientAddress,
        "1000000",
        "Premium search access",
    ),
)
```

### Multi-Chain Support

```go
evmSigner, _ := x402.NewPrivateKeySigner(
    evmPrivateKey, 
    x402.AcceptUSDCBaseSepolia().WithPriority(1),
)

solSigner, _ := x402.NewSolanaPrivateKeySigner(
    solPrivateKey,
    x402.AcceptUSDCSolanaDevnet().WithPriority(2),
)

transport, _ := x402.New(x402.Config{
    ServerURL: serverURL,
    Signers:   []x402.PaymentSigner{evmSigner, solSigner},
})
```

**See `examples/svm-client` and `examples/svm-server` for complete working examples.**

## Client Configuration Options

### Basic Configuration

```go
signer, err := x402.NewPrivateKeySigner(
    privateKey,
    x402.AcceptUSDCBase(),
    x402.AcceptUSDCBaseSepolia(),
)

config := x402.Config{
    ServerURL: "https://server.example.com",
    Signers:   []x402.PaymentSigner{signer},
}
```

### With Payment Approval Callback

```go
config := x402.Config{
    ServerURL: "https://server.example.com",
    Signers:   []x402.PaymentSigner{signer},
    PaymentCallback: func(amount *big.Int, resource string) bool {
        if amount.Cmp(big.NewInt(100000)) > 0 {
            fmt.Printf("Approve payment of %s for %s? ", amount, resource)
            return getUserApproval()
        }
        return true
    },
}
```

### With Event Callbacks

```go
config := x402.Config{
    ServerURL: "https://server.example.com",
    Signers:   []x402.PaymentSigner{signer},
    OnPaymentAttempt: func(event x402.PaymentEvent) {
        log.Printf("Attempting payment: %s to %s", event.Amount, event.Recipient)
    },
    OnPaymentSuccess: func(event x402.PaymentEvent) {
        log.Printf("Payment successful: tx %s", event.Transaction)
    },
    OnPaymentFailure: func(event x402.PaymentEvent, err error) {
        log.Printf("Payment failed: %v", err)
    },
}
```

### Multiple Signers with Fallback

Configure multiple signers with different payment options and priorities. The client will try signers in priority order until one succeeds:

```go
// Create personal wallet for small payments
personalSigner, _ := x402.NewPrivateKeySigner(
    personalKey,
    x402.AcceptUSDCBase().WithMaxAmount("50000"), // Max 0.05 USDC
)
personalSigner.WithPriority(1) // Try first

// Create business wallet for larger payments
businessSigner, _ := x402.NewPrivateKeySigner(
    businessKey,
    x402.AcceptUSDCBase(), // No limit
)
businessSigner.WithPriority(2) // Fallback

config := x402.Config{
    ServerURL: "https://server.example.com",
    Signers:   []x402.PaymentSigner{personalSigner, businessSigner},
}
```

### Multiple Signers with Different Networks

```go
// Mainnet signer
mainnetSigner, _ := x402.NewPrivateKeySigner(
    mainnetKey,
    x402.AcceptUSDCBase(),
)

// Testnet signer for development
testnetSigner, _ := x402.NewPrivateKeySigner(
    testnetKey,
    x402.AcceptUSDCBaseSepolia(),
)

config := x402.Config{
    ServerURL: "https://server.example.com",
    Signers:   []x402.PaymentSigner{mainnetSigner, testnetSigner},
}
```

## Server Configuration Options

### Basic Server Configuration

```go
config := &x402server.Config{
    FacilitatorURL:  "https://facilitator.x402.rs",
    VerifyOnly:      false, // Set to true for testing without settlement
}
```

### Multiple Payment Options

Servers can now offer multiple payment options per tool, allowing clients to choose their preferred network or take advantage of discounts:

```go
srv.AddPayableTool(
    mcp.NewTool("analytics",
        mcp.WithDescription("Advanced analytics"),
        mcp.WithString("query", mcp.Required())),
    analyticsHandler,
    // Base mainnet - cheapest option
    x402server.RequireUSDCBase("0xYourWallet", "50000", "Analytics via Base - 0.05 USDC"),
    // Polygon mainnet - moderate fees
    x402server.RequireUSDCPolygon("0xYourWallet", "75000", "Analytics via Polygon - 0.075 USDC"),
    // Avalanche mainnet
    x402server.RequireUSDCAvalanche("0xYourWallet", "100000", "Analytics via Avalanche - 0.1 USDC"),
    // Testnet options for development
    x402server.RequireUSDCBaseSepolia("0xYourWallet", "10000", "Analytics via Base Sepolia (testnet) - 0.01 USDC"),
    x402server.RequireUSDCPolygonAmoy("0xYourWallet", "10000", "Analytics via Polygon Amoy (testnet) - 0.01 USDC"),
    x402server.RequireUSDCAvalancheFuji("0xYourWallet", "10000", "Analytics via Avalanche Fuji (testnet) - 0.01 USDC"),
)
```

#### Available Server Helper Functions

**Mainnet:**
- `RequireUSDCBase(payTo, amount, description)` - Base mainnet
- `RequireUSDCPolygon(payTo, amount, description)` - Polygon mainnet
- `RequireUSDCAvalanche(payTo, amount, description)` - Avalanche C-Chain mainnet
- `RequireUSDCSolana(payTo, amount, description)` - Solana mainnet

**Testnet:**
- `RequireUSDCBaseSepolia(payTo, amount, description)` - Base Sepolia testnet
- `RequireUSDCPolygonAmoy(payTo, amount, description)` - Polygon Amoy testnet
- `RequireUSDCAvalancheFuji(payTo, amount, description)` - Avalanche Fuji testnet
- `RequireUSDCSolanaDevnet(payTo, amount, description)` - Solana devnet

When a client requests a paid tool without payment, they receive all available payment options and can choose the one that works best for them based on:
- Network preference (gas fees, speed)
- Available balance on different chains
- Price differences (discounts for certain networks)

### Using with Existing MCP Server

```go
// If you already have an MCP server, wrap it with x402
mcpServer := server.NewMCPServer("existing", "1.0")
httpServer := server.NewStreamableHTTPServer(mcpServer)

// Wrap with x402 handler
x402Handler := x402server.NewX402Handler(httpServer, config)

// Use as http.Handler
http.Handle("/", x402Handler)
http.ListenAndServe(":8080", nil)
```

## Signer Options (Client)

### EVM Signers

#### Private Key

```go
signer, err := x402.NewPrivateKeySigner(
    "0xYourPrivateKeyHex",
    x402.AcceptUSDCBase(),       // Must specify at least one payment option
)
```

#### Mnemonic (BIP-39)

```go
signer, err := x402.NewMnemonicSigner(
    "your twelve word mnemonic phrase here ...",
    "m/44'/60'/0'/0/0", // Optional: derivation path
    x402.AcceptUSDCBase(),
)
```

#### Keystore File

```go
keystoreJSON, _ := os.ReadFile("keystore.json")
signer, err := x402.NewKeystoreSigner(
    keystoreJSON,
    "password",
    x402.AcceptUSDCBase(),
)
```

### Solana Signers

#### Solana Private Key (Base58)

```go
signer, err := x402.NewSolanaPrivateKeySigner(
    "YourBase58PrivateKey",
    x402.AcceptUSDCSolana(),     // Mainnet
    // x402.AcceptUSDCSolanaDevnet(), // Or devnet for testing
)
```

#### Solana Keypair File

```go
// Load from Solana CLI keypair file
signer, err := x402.NewSolanaPrivateKeySignerFromFile(
    "~/.config/solana/id.json",
    x402.AcceptUSDCSolanaDevnet(),
)
```

### Multiple Payment Options with Priorities

```go
signer, err := x402.NewPrivateKeySigner(
    privateKey,
    // Priority 1: Prefer Base (cheap & fast)
    x402.AcceptUSDCBase().WithPriority(1),
    
    // Priority 2: Polygon (moderate fees)
    x402.AcceptUSDCPolygon().WithPriority(2),
    
    // Priority 3: Avalanche
    x402.AcceptUSDCAvalanche().WithPriority(3),
    
    // Priority 4: Fallback to testnets
    x402.AcceptUSDCBaseSepolia().WithPriority(4),
    x402.AcceptUSDCPolygonAmoy().WithPriority(5),
    x402.AcceptUSDCAvalancheFuji().WithPriority(6),
)
```

### Supported Chains

#### EVM Chains (Mainnet)
- **Base**: `x402.AcceptUSDCBase()` - Chain ID: 8453
- **Polygon**: `x402.AcceptUSDCPolygon()` - Chain ID: 137
- **Avalanche C-Chain**: `x402.AcceptUSDCAvalanche()` - Chain ID: 43114

#### EVM Chains (Testnet)
- **Base Sepolia**: `x402.AcceptUSDCBaseSepolia()` - Chain ID: 84532
- **Polygon Amoy**: `x402.AcceptUSDCPolygonAmoy()` - Chain ID: 80002
- **Avalanche Fuji**: `x402.AcceptUSDCAvalancheFuji()` - Chain ID: 43113

#### Solana Chains
- **Solana Mainnet**: `x402.AcceptUSDCSolana()`
- **Solana Devnet**: `x402.AcceptUSDCSolanaDevnet()`

### With Custom Limits

```go
signer, err := x402.NewPrivateKeySigner(
    privateKey,
    x402.AcceptUSDCBase()
        .WithMaxAmount("100000")    // Max 0.1 USDC per payment
        .WithMinBalance("1000000"), // Keep 1 USDC reserve
)
```

### Custom Signer

```go
type MyCustomSigner struct {
    paymentOptions []x402.ClientPaymentOption
}

func NewMyCustomSigner() *MyCustomSigner {
    return &MyCustomSigner{
        paymentOptions: []x402.ClientPaymentOption{
            x402.AcceptUSDCBase(),
            x402.AcceptUSDCBaseSepolia(),
        },
    }
}

func (s *MyCustomSigner) SignPayment(ctx context.Context, req x402.PaymentRequirement) (*x402.PaymentPayload, error) {
    // Your custom signing logic
    // Could use hardware wallet, remote signer, etc.
}

func (s *MyCustomSigner) GetAddress() string {
    return "0xYourAddress"
}

func (s *MyCustomSigner) SupportsNetwork(network string) bool {
    for _, opt := range s.paymentOptions {
        if opt.Network == network {
            return true
        }
    }
    return false
}

func (s *MyCustomSigner) HasAsset(asset, network string) bool {
    for _, opt := range s.paymentOptions {
        if opt.Network == network && opt.Asset == asset {
            return true
        }
    }
    return false
}

func (s *MyCustomSigner) GetPaymentOption(network, asset string) *x402.ClientPaymentOption {
    for _, opt := range s.paymentOptions {
        if opt.Network == network && opt.Asset == asset {
            optCopy := opt
            return &optCopy
        }
    }
    return nil
}
```

## Testing

### Using Mock Signers

#### Mock EVM Signer

```go
func TestMyMCPClient(t *testing.T) {
    // No real wallet needed for tests
    signer := x402.NewMockSigner(
        "0xTestWallet",
        x402.AcceptUSDCBaseSepolia(), // Mock signer for testing
    )
    
    transport, _ := x402.New(x402.Config{
        ServerURL: "https://test-server.example.com",
        Signers:   []x402.PaymentSigner{signer},
    })
    
    // Test your MCP client
    client := client.NewClient(transport)
    // ...
}
```

#### Mock Solana Signer

```go
func TestSolanaClient(t *testing.T) {
    signer := x402.NewMockSolanaSigner(
        "DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK",
        x402.AcceptUSDCSolanaDevnet(),
    )
    
    transport, _ := x402.New(x402.Config{
        ServerURL: "https://test-server.example.com",
        Signers:   []x402.PaymentSigner{signer},
    })
    // ...
}
```

### Recording Payments

```go
func TestPaymentFlow(t *testing.T) {
    // Create mock signer and recorder
    signer := x402.NewMockSigner(
        "0xTestWallet",
        x402.AcceptUSDCBaseSepolia(),
    )
    recorder := x402.NewPaymentRecorder()
    
    transport, _ := x402.New(x402.Config{
        ServerURL: testServer.URL,
        Signers:   []x402.PaymentSigner{signer},
    })
    
    // Attach the recorder using the helper function
    x402.WithPaymentRecorder(recorder)(transport)
    
    // Make requests...
    
    // Verify payments
    assert.Equal(t, 2, recorder.PaymentCount()) // Attempt + Success events
    lastPayment := recorder.LastPayment()
    assert.Equal(t, x402.PaymentEventSuccess, lastPayment.Type)
    assert.Equal(t, "20000", recorder.TotalAmount())
}
```

## Supported Networks

### EVM Networks

- `base` - Base Mainnet (via `AcceptUSDCBase()`, `RequireUSDCBase()`)
- `base-sepolia` - Base Sepolia Testnet (via `AcceptUSDCBaseSepolia()`, `RequireUSDCBaseSepolia()`)

### Solana (SVM) Networks

- `solana` - Solana Mainnet (via `AcceptUSDCSolana()`, `RequireUSDCSolana()`)
- `solana-devnet` - Solana Devnet (via `AcceptUSDCSolanaDevnet()`, `RequireUSDCSolanaDevnet()`)

Additional networks can be supported by manually configuring `ClientPaymentOption` or `PaymentRequirement` objects with the appropriate network, asset, and scheme parameters.

## Security Considerations

### General
- **Private keys**: Never hardcode private keys. Use environment variables or secure key management.
- **Payment approval**: Use `PaymentCallback` to control payment approval based on amount or resource.
- **Network verification**: The library verifies network and asset compatibility before signing.
- **Per-option limits**: Use `.WithMaxAmount()` on payment options to set per-network spending limits.

### EVM-Specific
- **Chain ID verification**: Signers verify the chain ID matches the payment option configuration.
- **EIP-712 signing**: All EVM signatures use typed structured data per EIP-712.

### Solana-Specific
- **Blockhash expiration**: Solana transactions expire after ~60-90 seconds. The facilitator must submit quickly.
- **Fee payer trust**: The facilitator acts as the fee payer and adds their signature before submission.
- **Transaction inspection**: Clients should validate the transaction matches the payment requirement before signing.

## Examples

See the [examples](./examples) directory for more detailed examples:

### EVM Examples
- [Client](./examples/client/) - Simple client that can pay for tool use with EVM chains
- [Server](./examples/server/) - Server that collects payments on EVM chains

### SVM (Solana) Examples
- [SVM Client](./examples/svm-client/) - Client that uses Solana for payments
- [SVM Server](./examples/svm-server/) - Server that collects payments on Solana

## Architecture

### Client Flow
1. Client makes MCP request through x402 transport
2. If server returns 402 Payment Required, transport extracts payment requirements
3. Transport uses configured signer to create payment authorization
4. Transport retries request with X-PAYMENT header
5. Server verifies and settles payment, then returns response

### Server Flow
1. Server receives MCP request
2. Checks if requested tool requires payment
3. If no payment provided, returns 402 with payment requirements
4. If payment provided, verifies with facilitator service
5. Settles payment on-chain (unless in verify-only mode)
6. Executes tool and returns response with payment confirmation

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see [LICENSE](LICENSE) file for details.

## Acknowledgments

- [MCP-Go](https://github.com/mark3labs/mcp-go) for the excellent MCP implementation
- [x402 Protocol](https://x402.org) ([GitHub](https://github.com/coinbase/x402)) for the payment specification
- [go-ethereum](https://github.com/ethereum/go-ethereum) for EVM crypto utilities
- [solana-go](https://github.com/gagliardetto/solana-go) for Solana transaction construction and signing
