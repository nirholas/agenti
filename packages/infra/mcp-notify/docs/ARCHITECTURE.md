# Architecture

This document describes the high-level architecture of MCP Notify, including system components, data flow, and design decisions.

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            MCP Notify                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                   │
│  │   Poller     │───▶│  Diff Engine │───▶│  Dispatcher  │                   │
│  └──────────────┘    └──────────────┘    └──────────────┘                   │
│         │                   │                   │                            │
│         ▼                   ▼                   ▼                            │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                   │
│  │  MCP Registry│    │   Database   │    │  Notification │                   │
│  │    (API)     │    │  (PostgreSQL)│    │   Channels    │                   │
│  └──────────────┘    └──────────────┘    └──────────────┘                   │
│                             │                   │                            │
│                             │            ┌──────┴───────────┐               │
│                             │            │  Discord │ Slack │               │
│                             │            │  Email   │ Teams │               │
│                             │            │  Webhook │Telegram│              │
│                             │            └──────────────────┘               │
│                             │                                               │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐                   │
│  │   REST API   │◀──▶│    Redis     │    │  Scheduler   │                   │
│  │   Server     │    │   (Cache)    │    │  (Digests)   │                   │
│  └──────────────┘    └──────────────┘    └──────────────┘                   │
│         ▲                                                                    │
│         │                                                                    │
│  ┌──────┴───────┐                                                           │
│  │ Web Dashboard│                                                           │
│  │    (React)   │                                                           │
│  └──────────────┘                                                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Components

### 1. Poller (`internal/poller/`)

The Poller component is responsible for fetching data from the MCP Registry at configurable intervals.

**Responsibilities:**
- Fetch the complete server list from MCP Registry API
- Handle rate limiting and retries
- Maintain last successful poll timestamp
- Emit events for successful polls

**Configuration:**
```yaml
poller:
  interval: 5m          # Poll interval
  timeout: 30s          # Request timeout
  retry_attempts: 3     # Number of retries on failure
  retry_backoff: 5s     # Backoff between retries
```

### 2. Registry Client (`internal/registry/`)

Abstracts communication with the MCP Registry API.

**Features:**
- HTTP client with configurable timeouts
- Response caching with ETags
- Automatic retry with exponential backoff
- Metrics collection for API calls

### 3. Diff Engine (`internal/diff/`)

Compares successive snapshots of the registry to detect changes.

**Change Types:**
- `new`: Server added to registry
- `updated`: Server metadata changed (version, description, packages, etc.)
- `removed`: Server removed from registry

**Algorithm:**
```go
type Change struct {
    Type         ChangeType
    ServerName   string
    OldSnapshot  *Server
    NewSnapshot  *Server
    FieldChanges []FieldChange
}

func ComputeDiff(old, new []Server) []Change {
    // Build maps for O(1) lookup
    // Compare servers by name
    // Track field-level changes for updates
}
```

### 4. Subscription Manager (`internal/subscription/`)

Manages user subscriptions and matches changes to subscriptions.

**Filter Matching:**
- Glob patterns for namespaces (e.g., `io.github.*`)
- Keyword matching in server names and descriptions
- Change type filtering
- Server name exact matching

### 5. Notification Dispatcher (`internal/notifier/`)

Routes notifications to appropriate channels based on subscription configuration.

**Channel Implementations:**
- Discord: Rich embeds via webhooks
- Slack: Block Kit messages via webhooks
- Email: SMTP with HTML templates
- Webhook: Generic HTTP POST with HMAC signing
- Telegram: Bot API messages
- Microsoft Teams: Adaptive Cards

**Reliability Features:**
- Retry queue with exponential backoff
- Dead letter queue for failed notifications
- Per-channel rate limiting
- Circuit breaker pattern

### 6. REST API Server (`internal/api/`)

HTTP API for subscription management and data access.

**Endpoints:**
- `POST /api/v1/subscriptions` - Create subscription
- `GET /api/v1/subscriptions` - List subscriptions
- `GET /api/v1/changes` - Query change history
- `GET /api/v1/servers` - List registry servers
- `GET /api/v1/feeds/rss` - RSS feed

**Middleware:**
- Authentication (API key)
- Rate limiting
- Request logging
- CORS handling

### 7. Digest Scheduler (`internal/scheduler/`)

Manages email digest delivery based on user preferences.

**Digest Frequencies:**
- Immediate: Send instantly
- Hourly: Aggregate changes per hour
- Daily: Summary at configured time
- Weekly: Weekly summary

### 8. Web Dashboard (`web/dashboard/`)

React-based SPA for subscription management and monitoring.

**Tech Stack:**
- React 18 with TypeScript
- TanStack Query for data fetching
- Tailwind CSS with shadcn/ui
- Vite for build tooling

## Data Flow

### Change Detection Flow

```
1. Poller fetches servers from MCP Registry
                    │
                    ▼
2. Diff Engine compares with previous snapshot
                    │
                    ▼
3. Changes stored in PostgreSQL
                    │
                    ▼
4. Subscription Manager matches changes to subscriptions
                    │
                    ▼
5. Dispatcher sends notifications via configured channels
```

### API Request Flow

```
1. Request hits API server
          │
          ▼
2. Auth middleware validates API key
          │
          ▼
3. Rate limiter checks quota
          │
          ▼
4. Handler processes request
          │
          ▼
5. Database/Cache query
          │
          ▼
6. Response returned to client
```

## Database Schema

### Tables

**subscriptions**
```sql
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    api_key_hash VARCHAR(64) NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_notified_at TIMESTAMPTZ
);
```

**subscription_filters**
```sql
CREATE TABLE subscription_filters (
    id UUID PRIMARY KEY,
    subscription_id UUID REFERENCES subscriptions(id),
    filter_type VARCHAR(50),
    filter_value TEXT
);
```

**channels**
```sql
CREATE TABLE channels (
    id UUID PRIMARY KEY,
    subscription_id UUID REFERENCES subscriptions(id),
    channel_type VARCHAR(50),
    config JSONB,
    enabled BOOLEAN DEFAULT true,
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0
);
```

**changes**
```sql
CREATE TABLE changes (
    id UUID PRIMARY KEY,
    server_name VARCHAR(255),
    change_type VARCHAR(20),
    previous_version VARCHAR(100),
    new_version VARCHAR(100),
    field_changes JSONB,
    server_snapshot JSONB,
    detected_at TIMESTAMPTZ DEFAULT NOW()
);
```

**notifications**
```sql
CREATE TABLE notifications (
    id UUID PRIMARY KEY,
    subscription_id UUID REFERENCES subscriptions(id),
    channel_id UUID REFERENCES channels(id),
    change_id UUID REFERENCES changes(id),
    status VARCHAR(20),
    attempts INTEGER DEFAULT 0,
    last_attempt_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ
);
```

### Indexes

```sql
CREATE INDEX idx_changes_detected_at ON changes(detected_at DESC);
CREATE INDEX idx_changes_server_name ON changes(server_name);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_notifications_status ON notifications(status);
```

## Caching Strategy

### Redis Usage

- **Server Cache**: Full registry snapshot (TTL: 5 minutes)
- **Rate Limit Counters**: Per-API-key request counts
- **Digest Queue**: Pending digest notifications

### Cache Invalidation

- Server cache invalidated on each poll
- Rate limit counters expire based on window size
- Digest queue processed by scheduler

## Scaling Considerations

### Horizontal Scaling

- **API Servers**: Stateless, can run multiple instances behind load balancer
- **Pollers**: Single instance with leader election (using Redis locks)
- **Workers**: Multiple notification workers consuming from queue

### Vertical Scaling

- **Database**: Connection pooling, read replicas for queries
- **Redis**: Cluster mode for high availability

### Expected Load

| Component | Metric | Expected Value |
|-----------|--------|----------------|
| Registry Poll | Requests/hour | 12 |
| Changes Detected | Per day | 50-200 |
| Subscriptions | Total | 10,000+ |
| Notifications | Per day | 50,000+ |

## Security

### Authentication

- API key authentication using secure random tokens
- Keys stored as bcrypt hashes
- Rate limiting per API key

### Data Protection

- Webhook secrets encrypted at rest
- Email addresses hashed for storage
- No PII in logs

### Network Security

- HTTPS only for all endpoints
- Webhook signature verification (HMAC-SHA256)
- Input validation and sanitization

## Monitoring

### Metrics (Prometheus)

- `mcp_watch_poll_duration_seconds`
- `mcp_watch_changes_detected_total`
- `mcp_watch_notifications_sent_total`
- `mcp_watch_api_requests_total`

### Logging

- Structured JSON logging
- Request ID propagation
- Log levels: DEBUG, INFO, WARN, ERROR

### Alerting

- Poll failures
- High notification failure rate
- Database connection issues
- API error rate threshold

## Design Decisions

### Why Polling vs WebSockets?

The MCP Registry does not provide real-time change notifications. Polling at reasonable intervals (5 minutes) provides timely updates while being respectful of the registry's resources.

### Why PostgreSQL?

- Strong consistency for subscription data
- JSONB for flexible schema evolution
- Excellent indexing for time-series queries
- Battle-tested reliability

### Why Redis?

- Fast rate limiting with atomic operations
- Pub/sub for worker coordination
- Session storage for dashboard

### Why Go?

- Excellent concurrency primitives
- Low resource usage
- Single binary deployment
- Strong standard library for HTTP

## Future Considerations

- **GraphQL API**: More flexible querying
- **Event Sourcing**: Full audit trail of all events
- **Multi-region**: Geographic distribution
- **Plugins**: Custom notification channels
