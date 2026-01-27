---
title: Architecture
description: System architecture and design of MCP Notify
icon: material/sitemap
---

# Architecture

Technical architecture and design decisions for MCP Notify.

## System Overview

```mermaid
graph TB
    subgraph External
        R[MCP Registry]
        U[Users]
        N[Notification Channels]
    end
    
    subgraph MCP Notify
        subgraph API Layer
            HTTP[HTTP Server]
            MW[Middleware]
        end
        
        subgraph Core Services
            P[Poller]
            D[Diff Engine]
            S[Subscription Manager]
            NO[Notifier Dispatcher]
        end
        
        subgraph Data Layer
            PG[(PostgreSQL)]
            RD[(Redis)]
        end
        
        subgraph MCP Interface
            MCP[MCP Server]
        end
    end
    
    R -->|Poll| P
    P -->|Changes| D
    D -->|Diffs| S
    S -->|Match| NO
    NO -->|Send| N
    
    U -->|HTTP| HTTP
    HTTP --> MW
    MW --> S
    
    S --> PG
    P --> RD
    
    MCP -->|Query| PG
```

## Components

### Poller

The poller fetches the MCP Registry at configurable intervals.

```go
type Poller struct {
    interval time.Duration
    client   *registry.Client
    cache    *redis.Client
}
```

**Responsibilities:**

- Fetch registry data on schedule
- Store snapshots for diffing
- Detect network failures and retry

### Diff Engine

Compares registry snapshots to detect changes.

```go
type DiffEngine struct {
    storage Storage
}

type Change struct {
    Type       ChangeType  // New, Updated, Removed
    ServerName string
    OldData    *Server
    NewData    *Server
    Fields     []FieldDiff
}
```

**Change Detection:**

| Change Type | Detection Method |
|-------------|------------------|
| New Server | Present in new, absent in old |
| Removed Server | Present in old, absent in new |
| Updated Server | Deep comparison of fields |

### Subscription Manager

Manages user subscriptions and matches changes.

```go
type SubscriptionManager struct {
    db      *postgres.Client
    matcher PatternMatcher
}

type Subscription struct {
    ID            string
    UserID        string
    ServerPattern string    // Glob pattern
    NotifyOn      []ChangeType
    Channels      []Channel
    Active        bool
}
```

**Pattern Matching:**

- Glob patterns: `claude-*`, `*-database`, `filesystem`
- Regex patterns: `^(claude|anthropic)-.*$`
- Exact match: `filesystem`

### Notifier Dispatcher

Routes notifications to configured channels.

```mermaid
graph LR
    D[Dispatcher] --> S[Slack Sender]
    D --> DC[Discord Sender]
    D --> E[Email Sender]
    D --> T[Telegram Sender]
    D --> MS[Teams Sender]
    D --> W[Webhook Sender]
    D --> R[RSS Generator]
```

Each sender implements the `Sender` interface:

```go
type Sender interface {
    Send(ctx context.Context, notification Notification) error
    Type() string
}
```

### API Server

RESTful HTTP API built with Go's standard library.

**Middleware Stack:**

```
Request → Logging → Auth → RateLimit → Handler → Response
```

| Middleware | Purpose |
|------------|---------|
| Logging | Request/response logging |
| Auth | API key validation |
| RateLimit | Request throttling |

### MCP Server

Implements the Model Context Protocol for AI assistant integration.

```go
type MCPServer struct {
    sdk *mcp.Server
    db  *postgres.Client
}
```

**Transport:** stdio (standard input/output)

**Tools Provided:**

- `search_servers` - Search by keyword
- `get_server` - Get server details
- `list_servers` - List all servers
- `get_stats` - Registry statistics

## Data Flow

### Subscription Creation

```mermaid
sequenceDiagram
    participant U as User
    participant A as API
    participant V as Validator
    participant D as Database
    
    U->>A: POST /subscriptions
    A->>V: Validate request
    V-->>A: Valid
    A->>D: Insert subscription
    D-->>A: Created
    A-->>U: 201 + subscription
```

### Change Detection & Notification

```mermaid
sequenceDiagram
    participant P as Poller
    participant R as Registry
    participant D as Diff Engine
    participant S as Sub Manager
    participant N as Notifier
    participant C as Channels
    
    P->>R: Fetch registry
    R-->>P: Server list
    P->>D: Compare with previous
    D-->>P: Changes detected
    P->>S: Get matching subs
    S-->>P: Subscriptions
    P->>N: Dispatch notifications
    N->>C: Send to channels
```

## Database Schema

### Core Tables

```mermaid
erDiagram
    users ||--o{ subscriptions : has
    subscriptions ||--o{ channels : has
    subscriptions ||--o{ notifications : receives
    servers ||--o{ changes : has
    
    users {
        uuid id PK
        string email
        string api_key
        timestamp created_at
    }
    
    subscriptions {
        uuid id PK
        uuid user_id FK
        string server_pattern
        array notify_on
        boolean active
    }
    
    channels {
        uuid id PK
        uuid subscription_id FK
        string type
        jsonb config
    }
    
    servers {
        uuid id PK
        string name
        string version
        jsonb metadata
        timestamp last_seen
    }
    
    changes {
        uuid id PK
        uuid server_id FK
        string change_type
        jsonb diff
        timestamp detected_at
    }
```

## Caching Strategy

### Redis Usage

| Key Pattern | Data | TTL |
|-------------|------|-----|
| `registry:snapshot` | Latest registry | 5m |
| `registry:hash` | Content hash | 5m |
| `server:{name}` | Server details | 1h |
| `ratelimit:{ip}` | Request count | 1m |

### Cache Invalidation

- Snapshot cache invalidated on new poll
- Server cache invalidated on change detection
- Rate limit counters auto-expire

## Scalability

### Horizontal Scaling

```mermaid
graph TB
    LB[Load Balancer]
    
    subgraph App Servers
        A1[Instance 1]
        A2[Instance 2]
        A3[Instance 3]
    end
    
    LB --> A1 & A2 & A3
    
    A1 & A2 & A3 --> PG[(PostgreSQL Primary)]
    A1 & A2 & A3 --> RD[(Redis Cluster)]
    
    PG --> PGR[(PostgreSQL Replica)]
```

### Considerations

- **Poller**: Only one instance should poll (use leader election)
- **API**: Stateless, can scale horizontally
- **Notifier**: Queue-based for reliability

## Security

### Authentication

```
Authorization: Bearer <api-key>
```

API keys are hashed with bcrypt and stored in PostgreSQL.

### Rate Limiting

| Endpoint | Limit |
|----------|-------|
| `/api/*` | 100/min |
| `/auth/*` | 10/min |
| `/webhooks/*` | 1000/min |

### Data Protection

- Webhook URLs encrypted at rest
- API keys hashed
- TLS required in production
