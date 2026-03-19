# ChaosChain x402 Showcase Demo

**Visual, interactive demo** showing the transformation from centralized to decentralized x402 facilitators.

## What This Demonstrates

1. **The Problem** - Centralized facilitator architecture (single point of failure)
2. **The Solution** - Decentralized CRE DON with BFT consensus
3. **Agent Setup** - ChaosChain SDK + ERC-8004 identity
4. **Payment Creation** - x402 protocol (EIP-712 signatures)
5. **Verification** - Multi-node consensus visualization
6. **Settlement** - On-chain execution with proofs
7. **Comparison** - Side-by-side analysis

## Prerequisites

### Required
- Python 3.9+
- HTTP bridge running on port 8402

### Optional (for full demo)
- ChaosChain SDK: `pip install chaoschain-sdk`
- Base Sepolia testnet access

## Installation

```bash
# Install dependencies
pip install -r requirements.txt

# Or install globally
pip install chaoschain-sdk chaoschain-x402-client rich requests
```

## Running the Demo

### 1. Start the HTTP Bridge

In a separate terminal:
```bash
cd ../../http-bridge
bun install
bun run dev
```

Or with Docker:
```bash
cd ../..
docker-compose up http-bridge
```

### 2. Run the Showcase

```bash
python demo_facilitator.py
```

## Demo Flow

```
┌─────────────────────────────────────────┐
│ Part 1: The Problem (Centralized)      │
│   • Shows old architecture              │
│   • Explains single point of failure    │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│ Part 2: The Solution (Decentralized)   │
│   • Shows new CRE DON architecture      │
│   • Explains BFT consensus              │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│ Part 3: Connect to Facilitator         │
│   • Health check                        │
│   • Mode detection (simulate/prod)      │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│ Part 4: Agent Setup                    │
│   • ChaosChain SDK initialization       │
│   • ERC-8004 identity                   │
│   • Wallet creation                     │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│ Part 5: Create x402 Payment            │
│   • Build payment payload               │
│   • EIP-712 structure                   │
│   • Encode to base64                    │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│ Part 6: Verify Payment                 │
│   • Send to CRE DON                     │
│   • Visualize multi-node consensus      │
│   • Show cryptographic proof            │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│ Part 7: Settle Payment                 │
│   • Settlement consensus                │
│   • On-chain execution                  │
│   • Proof-of-Agency (ERC-8004)         │
└─────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────┐
│ Summary: Before vs After Comparison    │
│   • Trust model                         │
│   • Reliability                         │
│   • Business models                     │
└─────────────────────────────────────────┘
```

## Features

### Visual Consensus Simulation
Shows how 4 nodes verify payment independently:
```
┌─────────────┬─────────────┬────────────────┬─────────────────┐
│ Node        │ Verification│ Result         │ Proof Fragment  │
├─────────────┼─────────────┼────────────────┼─────────────────┤
│ 🔷 Node A   │ EIP-712 ✓   │ VALID          │ 0xabc123...     │
│ 🔷 Node B   │ EIP-712 ✓   │ VALID          │ 0xdef456...     │
│ 🔷 Node C   │ EIP-712 ✓   │ VALID          │ 0xghi789...     │
│ 🔷 Node D   │ EIP-712 ✓   │ VALID          │ 0xjkl012...     │
└─────────────┴─────────────┴────────────────┴─────────────────┘
```

### Architecture Comparison
Clear before/after diagrams showing:
- Old: Agent → Centralized Server → Chain
- New: Agent → CRE DON (N nodes) → Chain

### Educational Callouts
- "What just happened" explanations
- Key concepts highlighted
- Next steps and production mode

## Modes

### Standalone Mode
If ChaosChain SDK not installed, uses mock agent:
```bash
python demo_facilitator.py
# Works without SDK, shows facilitator functionality
```

### Full Mode
With ChaosChain SDK installed:
```bash
pip install chaoschain-sdk
python demo_facilitator.py
# Full agent setup + facilitator demo
```

## Expected Output

```
═══════════════════════════════════════════════════════════
  CHAOSCHAIN x402 DECENTRALIZED FACILITATOR
═══════════════════════════════════════════════════════════

Replacing centralized payment servers with BFT consensus

  ❌ OLD: Agent → Centralized Server → Chain
  ✅ NEW: Agent → CRE DON (N nodes) → Chain

Powered by Chainlink CRE + ERC-8004 + x402

[Shows problem → solution → demo → comparison]

✅ VERIFICATION COMPLETE
✅ SETTLEMENT COMPLETE
✅ 4/4 nodes reached consensus
```

## Environment Variables

### Quick Setup

**Easiest way (recommended):**
```bash
# Run the setup script
chmod +x setup_env.sh
./setup_env.sh
```

**Or set manually:**
```bash
# Required: Facilitator URL
export X402_FACILITATOR_URL=http://localhost:8402

# Use mock agent (no RPC needed) - DEFAULT
export DEMO_MODE_NO_SDK=true
```

**For real SDK usage (optional):**
```bash
# Get free API key from Alchemy or Infura
export BASE_SEPOLIA_RPC_URL=https://base-sepolia.g.alchemy.com/v2/YOUR_KEY
export DEMO_MODE_NO_SDK=false
```

See `env_template.txt` for all available environment variables.

## Troubleshooting

### Facilitator not running
```
❌ Cannot connect to facilitator at http://localhost:8402

To start the facilitator:
   cd http-bridge && bun run dev
   or: docker-compose up http-bridge
```

### SDK not installed
```
⚠️  ChaosChain SDK not installed - running standalone mode
   Install: pip install chaoschain-sdk
```

Demo will still work, but with mock agent instead of real SDK.

## Integration with Your Workflow

This demo can be integrated into:
1. **Live presentations** - Visual, engaging showcase
2. **Onboarding** - Help new developers understand the value
3. **Documentation** - Record and embed in README
4. **Partner demos** - Show to Coinbase, Chainlink, etc.

## Learn More

- [Main README](../../README.md)
- [ChaosChain SDK](https://github.com/ChaosChain/chaoschain-sdk-py)
- [x402 Protocol](https://github.com/coinbase/x402)
- [Chainlink CRE](https://docs.chain.link/cre)

