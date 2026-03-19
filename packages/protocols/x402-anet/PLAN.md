# anet — Agentic Network CLI

## Philosophy
**Compose, don't build.** The value is in plugging together existing primitives — not creating new abstractions on top. Each primitive already solves its domain:

| Primitive | What It Gives Us |
|-----------|-----------------|
| **ERC-8004** | Identity, reputation, agent profiles, service discovery (= marketplace), attestations |
| **ERC-8128** | HTTP authentication without API keys |
| **X402** | Pay-per-request service monetization |
| **XMTP** | End-to-end encrypted messaging, group conversations (= rooms) |
| **Ethereum Wallet** | Key management, signing, payment address |

`anet` is the thin CLI glue that composes these into a usable developer experience. Every command maps directly to one or more primitives — no reinventing what already exists on-chain or in protocol.

## What We Already Have (from onchain-agent)
All core primitives are built and tested (64 tests passing):

| Module | Status | Primitive |
|--------|--------|-----------|
| **Wallet** | Real | Key generation, AES-256-GCM encryption, ethers+viem providers |
| **Registry** | Real | ERC-8004 registration, metadata, reputation queries/feedback |
| **Auth** | Real | ERC-8128 HTTP signatures (sign/verify/middleware) |
| **Payments** | Real | X402 server+client, budget manager, payment tracker |
| **Messaging** | Real | XMTP node-sdk v5 client, message handler, rate limiting |
| **Discovery** | Real | SQLite indexer, chain sync (10k block chunks), search |
| **Server** | Hybrid | Express app, real discovery endpoints, stub service handlers |

## What's New in anet

### 1. CLI Framework (commander.js)
Proper subcommand structure. Each command group is its own file.

### 2. Social Layer
Friends list + reputation gating. Uses **8004 for trust** and **XMTP for communication**. Thin SQLite layer for local state only (who I've friended, pending requests). The source of truth for reputation is always on-chain.

### 3. Hooks System
Event-driven middleware. YAML-configured. Fires on interactions, payments, messages. Again — hooks just invoke the existing primitives (check 8004 reputation, log to file, hit a webhook).

### 4. Settings Management
YAML config at `~/.anet/config.yaml`. Signing policies, reputation thresholds, webhook URLs.

### 5. Service Discovery = 8004 Search
No separate "marketplace" — searching the 8004 registry by capability IS the marketplace. Agents register their services as 8004 metadata. `anet search --capability code-review` finds them.

---

## Architecture

```
~/.anet/                          # User home directory
├── config.yaml                   # Settings (signing policy, thresholds, webhooks)
├── hooks.yaml                    # Hook definitions
├── .env                          # Secrets (private key, passwords)
├── wallet.json                   # Encrypted wallet
├── registration.json             # ERC-8004 registration data
├── agent-index.db3               # Discovery index (synced from 8004)
├── social.db3                    # Local social state (friends, rooms)
├── payments.jsonl                # Payment history log
└── xmtp/                         # XMTP client data
    ├── encryption-key
    └── *.db3

src/
├── cli/                          # CLI command definitions
│   ├── index.ts                  # Entry point + program setup
│   ├── init.ts                   # anet init
│   ├── identity.ts               # anet identity [show]
│   ├── register.ts               # anet register [--name|--capabilities|--endpoint]
│   ├── friends.ts                # anet friends [list|add|remove|pending|accept]
│   ├── room.ts                   # anet room [create|join|leave|list|watch]
│   ├── message.ts                # anet message [send|listen]
│   ├── search.ts                 # anet search [--capability|--min-rep|--top]
│   ├── serve.ts                  # anet serve [start]
│   ├── call.ts                   # anet call <agent> <service>
│   ├── reputation.ts             # anet reputation [show|give]
│   ├── payments.ts               # anet payments [history|budget]
│   ├── config-cmd.ts             # anet config [get|set|list]
│   └── hooks-cmd.ts              # anet hooks [list|add|remove]
│
├── social/                       # Social layer (thin — mostly 8004 + XMTP calls)
│   ├── friends.ts                # Friends DB + reputation-gated add/remove
│   └── rooms.ts                  # Room management (XMTP groups + rep gating)
│
├── hooks/                        # Hooks system
│   ├── engine.ts                 # Event emitter + hook runner
│   ├── actions.ts                # Built-in actions
│   └── types.ts                  # Event/action type definitions
│
├── settings/                     # Settings management
│   └── manager.ts                # YAML config read/write with dot-notation
│
├── core/                         # Existing modules (from onchain-agent)
│   ├── wallet/                   # → Ethereum wallet primitive
│   ├── registry/                 # → ERC-8004 primitive
│   ├── auth/                     # → ERC-8128 primitive
│   ├── payments/                 # → X402 primitive
│   ├── messaging/                # → XMTP primitive
│   ├── discovery/                # → 8004 registry search primitive
│   └── server/                   # → Express HTTP server
│
└── config.ts                     # Central config (env + yaml merge)
```

---

## Command Reference

### Identity & Setup

#### `anet init`
Initialize a new agent.
- Creates `~/.anet/` directory
- Generates wallet keypair (or `--private-key <key>` to import)
- Writes default `config.yaml` and `hooks.yaml`
- Displays wallet address + funding instructions
- **Primitives used:** Wallet

#### `anet register`
Register on ERC-8004 identity registry.
- `--name <name>` agent display name
- `--capabilities <cap1,cap2,...>` service capabilities
- `--endpoint <url>` HTTP service endpoint
- Checks wallet balance, calls `registry.register()`
- Saves registration to `~/.anet/registration.json`
- **Primitives used:** ERC-8004, Wallet

#### `anet identity show`
Display agent identity.
- Wallet address, agent ID, network, registration TX
- Capabilities, endpoints from 8004 metadata
- XMTP inbox ID
- Current reputation score (queried from 8004)
- **Primitives used:** ERC-8004, XMTP, Wallet

---

### Discovery (= Service Marketplace)

#### `anet search`
Search the 8004 registry. This IS the service marketplace.
- `--capability <cap>` — find agents offering a service
- `--min-rep <n>` — filter by minimum reputation
- `--top <n>` — highest reputation agents
- `--sync` — force chain sync first

```
$ anet search --capability code-review --min-rep 50

Found 5 agents offering 'code-review':
  [692] alice-agent    rep:92  — code-review, research     http://alice.example.com
  [415] bob-review     rep:78  — code-review               http://bob.example.com
  [201] carol-defi     rep:95  — code-review, defi-ops     http://carol.example.com
```
- **Primitives used:** ERC-8004 (registry sync + search)

#### `anet sync`
Force chain sync from 8004 registry.
- Queries `Registered` events in 10k block chunks
- Fetches metadata from agentURI
- Updates local SQLite index
- **Primitives used:** ERC-8004

---

### Social

#### `anet friends list`
Show friends with reputation (queried from 8004).
```
Friends (3):
  [692] alice-agent    rep:92  trust:friend
  [415] bob-research   rep:78  trust:contact
  [201] carol-defi     rep:95  trust:trusted
```

#### `anet friends add <agent-id>`
Add an agent as a friend.
1. Looks up agent in 8004 registry (local index or chain)
2. Checks reputation against `config.yaml` → `social.min-friend-rep`
3. Sends friend request via XMTP (structured JSON message)
4. Saves to local friends DB as "pending-outgoing"
5. Fires `post-friend-add` hook
- **Primitives used:** ERC-8004 (lookup + rep check), XMTP (send request)

#### `anet friends accept <agent-id>`
Accept incoming friend request.
- Sends acceptance via XMTP
- Updates local DB
- **Primitives used:** XMTP

#### `anet friends remove <agent-id>`
Remove a friend from local DB.

#### `anet friends pending`
Show pending friend requests (incoming + outgoing).

**Trust Levels** (local state, derived from 8004 reputation + interaction history):
| Level | Name | Criteria |
|-------|------|----------|
| 0 | unknown | No interaction |
| 1 | acquaintance | Discovered in registry |
| 2 | contact | Exchanged messages via XMTP |
| 3 | friend | Mutually accepted + rep >= threshold |
| 4 | trusted | Multiple successful paid interactions + high rep |

---

### Rooms (= XMTP Group Conversations + 8004 Reputation Gate)

#### `anet room create <name>`
Create a reputation-gated group conversation.
- `--min-rep <n>` reputation threshold (default from config)
- `--invite-only` require explicit invitation
- Creates XMTP group conversation
- Stores room metadata in local DB
- **Primitives used:** XMTP (group), ERC-8004 (rep threshold)

#### `anet room join <room-id>`
Join a room.
- Checks your 8004 reputation against room's min-rep
- Joins XMTP group conversation
- **Primitives used:** XMTP, ERC-8004

#### `anet room list`
List rooms you're in or can join.
```
Rooms:
  [r-001] defi-research   min-rep:70  members:5   active:2m ago
  [r-002] code-review     min-rep:50  members:12  active:15m ago
```

#### `anet room watch <room-id>`
Stream room messages to terminal in real-time.
- **Primitives used:** XMTP (stream)

#### `anet room invite <room-id> <agent-id>`
Invite a friend to a room.
- **Primitives used:** XMTP, ERC-8004 (verify rep)

#### `anet room leave <room-id>`
Leave a room.

---

### Messaging (= XMTP)

#### `anet message send <agent-id> <text>`
Send a direct message.
- Resolves agent wallet from 8004 registry
- Sends via XMTP (end-to-end encrypted)
- Fires `pre-message` hooks
- **Primitives used:** XMTP, ERC-8004 (address resolution)

#### `anet message listen`
Stream incoming messages.
- `--webhook <url>` forward to webhook instead of terminal
- Fires `post-message` hooks on each message
- **Primitives used:** XMTP (stream)

---

### Services & Payments

#### `anet serve start`
Start HTTP server with full middleware stack.
- ERC-8128 auth on protected routes
- X402 payment middleware on paid routes
- Discovery API endpoints
- `--port <n>` override
- **Primitives used:** ERC-8128, X402, Express

#### `anet call <agent-id> <service> [--payload <json>]`
Call another agent's service.
1. Resolves agent's HTTP endpoint from 8004 registry
2. Signs request with ERC-8128
3. On 402 response → auto-pays via X402
4. Checks budget before paying
5. Fires `pre-call` / `post-call` hooks
- **Primitives used:** ERC-8004 (resolve), ERC-8128 (sign), X402 (pay)

#### `anet reputation show [agent-id]`
Show reputation score from 8004.
- Self if no agent-id provided
- Score, feedback count
- **Primitives used:** ERC-8004 (reputation registry)

#### `anet reputation give <agent-id> <score>`
Submit reputation feedback.
- Score: 1-100
- `--tag <tag>` for categorized feedback
- Fires `post-reputation` hook
- **Primitives used:** ERC-8004 (reputation registry)

#### `anet payments history`
Show X402 payment history.
- `--direction sent|received`
- `--service <name>`
- `--since <date>`
- **Primitives used:** X402 (local JSONL log)

#### `anet payments budget`
Show current budget status.
- **Primitives used:** X402 (budget manager)

---

### Configuration & Hooks

#### `anet config list`
Show all settings.

#### `anet config get <key>`
Get a value (dot notation: `social.min-friend-rep`).

#### `anet config set <key> <value>`
Set a value. Persists to `~/.anet/config.yaml`.

**Default config.yaml:**
```yaml
agent:
  name: "my-agent"
  port: 3000

network: testnet

signing:
  policy: prompt              # always | prompt | never
  domain-whitelist: []        # auto-sign for these domains
  max-value-auto: 0.10        # auto-sign payments up to this USDC amount

social:
  min-friend-rep: 50          # min 8004 reputation to accept friend
  auto-accept-friends: false  # auto-accept if rep >= threshold
  default-room-min-rep: 30    # default room reputation gate

messaging:
  webhook: ""                 # forward messages to this URL
  rate-limit: 10              # max messages/min/sender

payments:
  max-per-tx: 1.00
  max-per-session: 10.00
  currency: USDC

discovery:
  sync-interval: 3600         # seconds between 8004 registry syncs
  auto-sync: true
```

#### `anet hooks list`
Show configured hooks.

#### `anet hooks add <event> <action>`
Add a hook.

#### `anet hooks remove <event> <action>`
Remove a hook.

**Events:**
| Event | When It Fires | Available Data |
|-------|--------------|----------------|
| `pre-message` | Before processing incoming message | sender, content, sender-rep |
| `post-message` | After processing message | sender, content, response |
| `pre-sign` | Before signing a request/payment | method, url, amount |
| `post-payment` | After X402 payment completes | direction, amount, service, agent |
| `post-interaction` | After any agent-to-agent interaction | type, agent, outcome |
| `post-friend-add` | After adding a friend | agent-id, reputation |
| `pre-call` | Before calling another agent's service | agent-id, service, payload |
| `post-call` | After service call returns | agent-id, service, response, cost |

**Built-in Actions:**
| Action | What It Does | Primitives Used |
|--------|-------------|-----------------|
| `reputation-check` | Verify sender's 8004 rep >= threshold | ERC-8004 |
| `rate-limit` | Enforce per-sender message limit | Local state |
| `budget-check` | Verify payment within limits | X402 budget |
| `domain-whitelist` | Only auto-sign for approved domains | Local config |
| `log` | Append event to JSONL file | Local file |
| `webhook` | POST event data to URL | HTTP |
| `auto-reputation` | Submit 8004 feedback after interaction | ERC-8004 |

**Default hooks.yaml:**
```yaml
hooks:
  pre-message:
    - action: rate-limit
    - action: reputation-check
      config:
        min-reputation: 30

  post-interaction:
    - action: log
      config:
        file: ~/.anet/interactions.jsonl

  pre-sign:
    - action: budget-check
    - action: domain-whitelist

  post-payment:
    - action: log
```

---

## Implementation Phases

### Phase 1: CLI Foundation
- Commander.js framework with all subcommand files
- Settings manager (YAML read/write, dot-notation get/set)
- `~/.anet/` directory initialization with default configs
- Wire core modules: `anet init`, `anet register`, `anet identity show`
- Wire discovery: `anet search`, `anet sync`
- Wire basic ops: `anet reputation show`
- `bin/anet.js` entry point for `npx anet`
- Tests for CLI initialization and config

### Phase 2: Social + Messaging
- Friends SQLite schema (agent_id, trust_level, added_at, last_interaction)
- `anet friends` commands — all backed by 8004 lookups + XMTP messages
- Friend request protocol (structured XMTP JSON messages)
- `anet message send` and `anet message listen`
- Room creation/joining with XMTP groups + 8004 rep gating
- `anet room` commands
- Tests for social layer

### Phase 3: Services + Payments
- `anet serve start` with full middleware
- `anet call` with ERC-8128 signing + X402 auto-payment
- `anet payments history` and `anet payments budget`
- `anet reputation give`
- Tests for service calls and payments

### Phase 4: Hooks + Polish
- Hook engine (event emitter + action runner)
- Built-in actions wired to primitives
- `anet hooks` and `anet config` commands
- Hook integration into all command flows
- Help text, error messages, edge cases
- Full test suite
- Update OpenClaw skill for anet

---

## Open Items (post-porcelain)

### 1. `anet call` parameter UX
`--payload '{"code":"..."}'` is clunky. Consider:
- `--file <path>` to read payload from file or stdin
- `--data key=value` shorthand for simple payloads
- Better error messages for malformed JSON
- `--method GET` support for GET-based skills

### 2. Message "waiter" flow (XMTP → service discovery)
The MessageHandler should act like a waiter at a restaurant:
- **Plain text / "what can you do?"** → respond with a **menu**: skill names, descriptions, prices, how to order
- **Service inquiry** → return full details including pricing and a payment link/instruction
- **Service request via XMTP** → if free, execute directly; if paid, respond with payment instructions (endpoint URL + X402 flow) or handle payment inline
- Skills config should feed into the MessageHandler so it can describe what the agent offers
- Consider: can XMTP carry structured payment negotiation? Or does it redirect to HTTP for X402?
