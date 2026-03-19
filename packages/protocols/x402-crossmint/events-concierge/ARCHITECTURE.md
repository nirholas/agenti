# Secret Vault MCP - Architecture Diagram

## What is a Durable Object?

**Durable Objects** are Cloudflare's solution for **stateful, coordinated serverless computing**. Think of them as:

### Simple Definition
A **single-threaded, persistent mini-server** that exists for as long as needed, with guaranteed data consistency.

### Key Characteristics

1. **Single Instance per ID**
   - Each Durable Object has a unique name/ID
   - Only ONE instance exists globally for that ID
   - Example: `Host DO name: "a1b2c3"` - there's only one of these worldwide

2. **Stateful & Persistent**
   - Has in-memory state that persists across requests
   - Can store data in built-in transactional storage
   - Survives between requests (unlike Workers which are stateless)

3. **Single-Threaded (Coordination)**
   - All requests to the same DO are serialized
   - No race conditions or concurrency issues
   - Perfect for things that need coordination (like chat rooms, game servers, or MCP agents)

4. **Geographically Distributed**
   - Automatically created near users who access them
   - Low latency for regional users
   - Can migrate between data centers based on usage

### In This Application

```
Guest Agent DO (name: "default")
├── Purpose: WebSocket connection handler
├── State: Current MCP connection, wallet info, pending confirmations
├── Created: On first browser connection
├── Lifecycle: Lives as long as browser is connected
└── Instance Count: 1 (all users share this for demo purposes)

Host Agent DO (name: "a1b2c3" - hashed from userId)
├── Purpose: MCP server exposing secret tools
├── State: User's wallet address, tool registry
├── Created: Lazily on first access to /mcp/users/a1b2c3
├── Lifecycle: Lives as long as needed, hibernates when idle
└── Instance Count: 1 per user (isolated per-user MCP servers)
```

### "Creating an MCP" = Creating a Route, Not a DO

**Important**: When you call `POST /api/users/mcp`, you're NOT creating the Durable Object directly. You're creating:

1. **A mapping in KV storage** (userId → urlSafeId → walletAddress)
2. **An MCP URL** that will route to a DO (e.g., `/mcp/users/a1b2c3`)

The **actual Durable Object** is created by Cloudflare **on first access** to that URL:

```
POST /api/users/mcp           → KV mapping created ✓
                                  DO doesn't exist yet ✗

GET /mcp/users/a1b2c3         → Cloudflare creates DO ✓
  (first access)                  DO.init() runs
                                  Wallet created
                                  MCP tools registered
```

This is called **lazy initialization** - DOs are created on-demand, not upfront.

### Lifecycle: Created → Active → Hibernated → Evicted

**Important**: Durable Objects don't live forever in memory. They have a lifecycle:

```
1. CREATED (on first access)
   └─> DO instance spins up
   └─> init() method runs
   └─> In-memory state initialized

2. ACTIVE (while receiving requests)
   └─> Processes requests
   └─> Maintains in-memory state
   └─> Writes important data to DO storage

3. HIBERNATED (no requests for ~10 seconds)
   └─> WebSocket connections kept alive
   └─> In-memory state persists
   └─> Wakes instantly on new request

4. EVICTED (idle for extended period)
   └─> In-memory instance destroyed
   └─> Durable storage persists ✓
   └─> Next request creates fresh instance
   └─> init() runs again
   └─> Loads state from DO storage
```

### What Persists vs What Doesn't

| Type | Persists After Eviction? | Example |
|------|-------------------------|---------|
| **DO Storage** | ✅ YES (forever) | User settings, data written via `storage.put()` |
| **In-Memory State** | ❌ NO | Variables like `this.wallet`, `this.mcpConnected` |
| **WebSocket Connections** | ❌ NO | Browser needs to reconnect |
| **KV Data** | ✅ YES (independent) | User mappings, secrets |

### In This Application

**Host Agent DO** stores critical data in KV (not DO storage):
- User wallet address → in KV
- Secrets → in KV
- MCP URL mappings → in KV

This means:
- Host DO can be evicted safely
- On next access, it recreates from KV
- No data loss

**Guest Agent DO** is more ephemeral:
- WebSocket connection is the main state
- When browser disconnects, DO can be evicted
- Next connection creates fresh instance

### Durable Objects vs Regular Workers

| Feature | Worker | Durable Object |
|---------|--------|----------------|
| **State** | Stateless | Stateful |
| **Instances** | Many (load balanced) | One per ID |
| **Concurrency** | Parallel requests | Serialized requests |
| **Use Case** | HTTP API, static content | Chat, coordination, agents |
| **Storage** | External (KV, R2, D1) | Built-in transactional storage |
| **WebSockets** | No* | Yes (perfect for it) |

*Workers can proxy WebSockets to Durable Objects

### Why Use DOs for Agents?

In this app, Durable Objects are perfect because:

1. **Agent State**: Each agent needs to maintain state (wallet, MCP connection, pending payments)
2. **WebSocket**: Guest DO handles the WebSocket connection from browser
3. **Isolation**: Each user's Host DO is completely isolated
4. **Coordination**: MCP protocol requires coordinated request/response handling

### How They're Created

```typescript
// server.ts
export { Host, Guest };  // Export DO classes

// wrangler.toml
[durable_objects]
bindings = [
  { class_name = "Host", name = "Host" },
  { class_name = "Guest", name = "Guest" }
]

// Accessing a DO
const agent = await getAgentByName(env.Guest, "default");
const response = await agent.fetch(request);
```

---

## System Architecture

```mermaid
graph TB
    subgraph "Browser (Client)"
        UI[React UI<br/>Chat Interface]
        DevMode[Developer Mode Panel<br/>Logs & Tools]
        GuestWallet[Guest Wallet<br/>Crossmint SDK]
        UI --> DevMode
        UI --> GuestWallet
    end

    subgraph "Cloudflare Workers"
        Gateway[Gateway Worker<br/>server.ts<br/>Routes: /agent, /mcp, /api]

        subgraph "Durable Objects"
            HostDO[Host Agent DO<br/>MCP Server]
            GuestDO[Guest Agent DO<br/>MCP Client]
        end

        KV[(KV Storage<br/>Secrets & Users)]

        Gateway -->|Route: /mcp/*| HostDO
        Gateway -->|Route: /agent| GuestDO
        HostDO --> KV
    end

    subgraph "External Services"
        Crossmint[Crossmint API<br/>Wallet Management]
        Facilitator[x402 Facilitator<br/>Payment Verification]
        BaseSepolia[Base Sepolia<br/>Blockchain]
    end

    UI -->|WebSocket to /agent| Gateway
    DevMode -->|HTTP to /mcp| Gateway
    GuestDO -->|MCP Protocol| HostDO

    GuestWallet --> Crossmint
    HostDO --> Crossmint

    HostDO -->|Verify Payment| Facilitator
    Facilitator -->|Settle| BaseSepolia
    GuestWallet -->|Sign Transaction| BaseSepolia

    style UI fill:#3b82f6,color:#fff
    style HostDO fill:#22c55e,color:#fff
    style GuestDO fill:#f59e0b,color:#fff
    style KV fill:#8b5cf6,color:#fff
    style Crossmint fill:#ec4899,color:#fff
    style Facilitator fill:#06b6d4,color:#fff
    style BaseSepolia fill:#6366f1,color:#fff
```

## Payment Flow (x402 Protocol)

```mermaid
sequenceDiagram
    participant User
    participant GuestAgent
    participant GuestWallet
    participant HostAgent
    participant Facilitator
    participant Blockchain

    User->>GuestAgent: "Retrieve secret abc-123"
    GuestAgent->>HostAgent: GET /mcp (retrieveSecret)
    HostAgent-->>GuestAgent: 402 Payment Required<br/>+ Payment Requirements

    GuestAgent->>User: Show Payment Modal<br/>$0.05 USD
    User->>GuestAgent: Confirm Payment

    GuestAgent->>GuestWallet: Sign x402 Payment
    GuestWallet->>GuestWallet: signTypedData()<br/>(ERC-6492 or EIP-1271)
    GuestWallet-->>GuestAgent: Signature

    GuestAgent->>HostAgent: GET /mcp (retrieveSecret)<br/>Header: X-PAYMENT
    HostAgent->>Facilitator: Verify Payment Signature
    Facilitator->>Blockchain: Settle Transaction<br/>(USDC Transfer)
    Blockchain-->>Facilitator: TX Hash
    Facilitator-->>HostAgent: Payment Verified ✓

    HostAgent->>HostAgent: Retrieve Secret from KV
    HostAgent-->>GuestAgent: 200 OK<br/>+ Secret Data + TX Hash
    GuestAgent-->>User: Display Secret & TX Link
```

## MCP Server Architecture (Per-User Isolation)

```mermaid
graph LR
    subgraph "User Registration"
        User1[User: alice@example.com]
        User2[User: bob@example.com]
    end

    subgraph "Gateway Router"
        API[POST /api/users/mcp]
        Hash[SHA-256 Hash<br/>userId → urlSafeId]
    end

    subgraph "KV Storage"
        KV1[users:email:alice]
        KV2[usersByHash:a1b2c3]
        KV3[a1b2c3:secrets:*]
    end

    subgraph "Durable Objects (Per-User)"
        DO1[Host DO<br/>name: a1b2c3]
        DO2[Host DO<br/>name: d4e5f6]
    end

    User1 --> API
    User2 --> API
    API --> Hash
    Hash --> KV1
    Hash --> KV2
    KV2 --> DO1
    DO1 --> KV3

    style DO1 fill:#22c55e,color:#fff
    style DO2 fill:#22c55e,color:#fff
    style KV1 fill:#8b5cf6,color:#fff
    style KV2 fill:#8b5cf6,color:#fff
    style KV3 fill:#8b5cf6,color:#fff
```

## Component Interaction Map

```mermaid
graph TB
    subgraph "UI Layer"
        ChatHeader[ChatHeader<br/>Status & Toggle]
        MessageList[MessageList<br/>Chat History]
        ChatInput[ChatInput<br/>User Commands]
        NerdPanel[NerdPanel<br/>Dev Tools]
    end

    subgraph "State Management"
        ClientApp[ClientApp.tsx<br/>Main Controller]
        Agent[useAgent Hook<br/>WebSocket]
    end

    subgraph "Agent Layer"
        Guest[Guest Agent DO<br/>MCP Client]
        Host[Host Agent DO<br/>MCP Server]
    end

    subgraph "Protocol Layer"
        MCP[MCP Protocol<br/>Tools & Resources]
        X402[x402 Protocol<br/>Payments]
    end

    subgraph "Wallet Layer"
        CrossmintSDK[Crossmint SDK<br/>Wallet Operations]
        X402Adapter[x402Adapter<br/>Signature Processing]
    end

    ChatHeader --> ClientApp
    MessageList --> ClientApp
    ChatInput --> ClientApp
    NerdPanel --> ClientApp

    ClientApp --> Agent
    Agent --> Guest
    Guest --> Host

    Guest --> MCP
    Host --> MCP
    Guest --> X402
    Host --> X402

    Guest --> CrossmintSDK
    Host --> CrossmintSDK
    X402 --> X402Adapter
    X402Adapter --> CrossmintSDK

    style ClientApp fill:#3b82f6,color:#fff
    style Guest fill:#f59e0b,color:#fff
    style Host fill:#22c55e,color:#fff
    style MCP fill:#06b6d4,color:#fff
    style X402 fill:#ec4899,color:#fff
```

## Data Flow: Store & Retrieve Secret

```mermaid
sequenceDiagram
    participant User
    participant MyMCP
    participant Gateway
    participant HostDO
    participant KV

    Note over User,KV: STORE SECRET (Authenticated)
    User->>MyMCP: Store "OPENAI_API_KEY"
    MyMCP->>MyMCP: Login with Email OTP
    MyMCP->>MyMCP: Create/Get Wallet
    MyMCP->>Gateway: POST /api/users/mcp<br/>{userId, walletAddress}
    Gateway->>Gateway: Hash userId → urlSafeId
    Gateway->>KV: Store user mapping
    Gateway-->>MyMCP: mcpUrl: /mcp/users/{urlSafeId}

    MyMCP->>Gateway: POST /api/users/secrets<br/>{secretName, secretValue}
    Gateway->>Gateway: Verify wallet ownership
    Gateway->>KV: Store secret<br/>Key: {urlSafeId}:secrets:{uuid}
    Gateway-->>MyMCP: secretId: uuid

    Note over User,KV: RETRIEVE SECRET (Paid)
    User->>HostDO: GET /mcp (retrieveSecret)
    HostDO->>HostDO: Return 402 Payment Required
    User->>User: Pay $0.05 via x402
    User->>HostDO: GET /mcp + X-PAYMENT header
    HostDO->>KV: Get secret<br/>Key: {urlSafeId}:secrets:{uuid}
    KV-->>HostDO: Secret data
    HostDO->>KV: Increment retrieval count
    HostDO-->>User: Secret + metadata
```

## Wallet Deployment Flow

```mermaid
stateDiagram-v2
    [*] --> PreDeployed: Wallet Created<br/>(Crossmint API)

    PreDeployed --> CheckingDeployment: Check on-chain<br/>(viem getCode)

    CheckingDeployment --> PreDeployed: code = 0x
    CheckingDeployment --> Deployed: code exists

    PreDeployed --> Deploying: First Payment Attempt

    Deploying --> DeployTx: Send self-transfer<br/>(1 wei)
    DeployTx --> Deployed: TX confirmed

    Deployed --> Ready: Can settle payments

    note right of PreDeployed
        ERC-6492 signatures
        work pre-deployment
    end note

    note right of Deployed
        Standard EIP-1271
        smart contract signatures
    end note
```

## Technology Stack

```mermaid
graph LR
    subgraph "Frontend"
        React[React 19]
        Vite[Vite]
        AgentSDK[Cloudflare Agents SDK]
    end

    subgraph "Backend"
        Workers[Cloudflare Workers]
        DO[Durable Objects]
        KVStore[KV Storage]
    end

    subgraph "Blockchain"
        Base[Base Sepolia]
        USDC[USDC Token]
        Crossmint[Crossmint Wallets]
    end

    subgraph "Protocols"
        MCPProto[MCP Protocol]
        X402Proto[x402 Protocol]
    end

    React --> AgentSDK
    AgentSDK --> Workers
    Workers --> DO
    Workers --> KVStore

    DO --> MCPProto
    DO --> X402Proto

    X402Proto --> Crossmint
    Crossmint --> Base
    Base --> USDC

    style React fill:#61dafb,color:#000
    style Workers fill:#f38020,color:#fff
    style DO fill:#f38020,color:#fff
    style Base fill:#0052ff,color:#fff
    style Crossmint fill:#ec4899,color:#fff
```

## Key Features

### 1. **Autonomous Payments**
- Guest Agent automatically handles 402 responses
- No user intervention for payment signing
- Crossmint smart wallets abstract private key management

### 2. **Per-User Isolation**
- Each user gets their own Durable Object instance
- Secrets scoped by hashed userId
- Isolated wallet and payment history

### 3. **MCP Protocol Integration**
- Host exposes tools via MCP
- Guest consumes tools via MCP
- x402 layer adds payment requirements

### 4. **Smart Wallet Features**
- Pre-deployed wallets (ERC-6492 signatures)
- Auto-deployment on first payment
- EIP-1271 signature validation

### 5. **Developer Experience**
- Real-time logs in Developer Mode panel
- Transaction history tracking
- WebSocket-based agent communication
- Chat-based UI for natural interaction

## Security Model

```mermaid
graph TB
    subgraph "Authentication"
        EmailOTP[Email OTP<br/>Client-side]
        APIKey[API Key Signer<br/>Server-side]
    end

    subgraph "Authorization"
        WalletOwnership[Wallet Ownership<br/>Signature Verification]
        UserMapping[User → Wallet<br/>KV Mapping]
    end

    subgraph "Payment Security"
        X402Sig[x402 Signatures<br/>EIP-712 TypedData]
        Facilitator[Facilitator Verification<br/>Off-chain]
        OnChain[On-chain Settlement<br/>USDC Transfer]
    end

    EmailOTP --> WalletOwnership
    APIKey --> WalletOwnership
    WalletOwnership --> UserMapping
    UserMapping --> X402Sig
    X402Sig --> Facilitator
    Facilitator --> OnChain

    style EmailOTP fill:#22c55e,color:#fff
    style WalletOwnership fill:#f59e0b,color:#fff
    style X402Sig fill:#ec4899,color:#fff
    style OnChain fill:#6366f1,color:#fff
```

---

## File Structure Map

```
calendar-concierge/
├── src/
│   ├── agents/
│   │   ├── host.ts          # MCP Server (Durable Object)
│   │   └── guest.ts         # MCP Client (Durable Object)
│   │
│   ├── components/
│   │   ├── Chat/
│   │   │   ├── ChatHeader.tsx
│   │   │   ├── MessageList.tsx
│   │   │   ├── ChatInput.tsx
│   │   │   └── Message.tsx
│   │   │
│   │   ├── NerdMode/
│   │   │   └── NerdPanel.tsx
│   │   │
│   │   └── TransactionHistory.tsx
│   │
│   ├── pages/
│   │   └── MyMcp.tsx        # User registration & secret storage
│   │
│   ├── utils/
│   │   ├── intentDetection.ts
│   │   └── exportUtils.ts
│   │
│   ├── shared/
│   │   └── secretService.ts  # KV-backed secret CRUD
│   │
│   ├── client.tsx           # Main React app
│   ├── server.ts            # Cloudflare Worker entry
│   ├── x402Adapter.ts       # Crossmint → x402 bridge
│   ├── constants.ts         # Network config
│   └── types.ts             # TypeScript types
│
├── wrangler.toml            # Cloudflare config
└── package.json
```
