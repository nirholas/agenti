# Features

## Everything You Need to Track MCP Changes

MCP Notify is designed for developers, DevOps teams, and organizations that rely on MCP servers.

---

## 📡 Real-Time Monitoring

### Continuous Registry Scanning
Our poller monitors the MCP Registry at configurable intervals (default: 5 minutes), ensuring you're always up to date.

### Field-Level Diff Detection
We don't just detect changes — we tell you exactly what changed:
- Version updates
- Description modifications
- Package additions
- Repository changes
- Remote endpoint updates

### Change History
Full audit trail of all detected changes with timestamps, searchable and exportable.

---

## 🎯 Flexible Subscriptions

### Namespace Patterns
Use glob patterns to match server namespaces:
```
io.github.myorg/*     # All servers from your org
*.ai.*                # Any AI-related namespace
io.github.*/llm-*     # LLM servers from any GitHub user
```

### Keyword Matching
Filter by keywords appearing in server names or descriptions:
```
ai, llm, gpt, openai, automation, data-processing
```

### Change Type Filters
Subscribe only to specific types of changes:
- **New servers**: Be first to discover new tools
- **Updates**: Track version bumps and improvements
- **Removals**: Know when servers are deprecated

### Multiple Channels
Route notifications to multiple destinations per subscription for redundancy.

---

## 🔔 Notification Channels

### Discord
- Rich embed formatting with colors and fields
- Customizable bot name and avatar
- Thread support for organized discussions
- Links to registry and repository

### Slack
- Block Kit messages for rich formatting
- Channel and username customization
- Action buttons for quick access
- Attachment fallbacks for accessibility

### Email
- Beautiful HTML templates
- Plain text fallback
- Digest options: immediate, hourly, daily, weekly
- Customizable subject lines

### Webhooks
- Standard HTTP POST delivery
- HMAC-SHA256 signature verification
- Configurable headers and timeout
- Retry with exponential backoff
- Dead letter queue for failures

### Telegram
- Bot API integration
- Channel and group support
- Thread support for supergroups
- Formatted messages with links

### Microsoft Teams
- Adaptive Cards formatting
- Action buttons
- Full server details
- Direct links to resources

### RSS Feeds
- Subscribe without an account
- Filterable feeds
- Atom format support
- Works with any feed reader

---

## 📊 Web Dashboard

### Overview
- Real-time stats at a glance
- Live change feed
- System health status
- Quick actions

### Changes Explorer
- Filterable change list
- Time range selection
- Search by server name
- Export to CSV/JSON
- Detailed change view

### Subscription Manager
- Create and edit subscriptions
- Test notifications
- Pause/resume subscriptions
- API key management

### Server Browser
- Search all registry servers
- View server details
- One-click subscribe
- Direct repository links

### Settings
- Theme customization (light/dark)
- Notification preferences
- API key regeneration
- Webhook testing

---

## 🔒 Security

### API Key Authentication
- Secure random key generation
- bcrypt hashed storage
- Per-key rate limiting
- Key rotation support

### Webhook Security
- HMAC-SHA256 signatures
- Timestamp validation
- Configurable secrets
- Signature verification examples

### Data Protection
- No PII in logs
- Encrypted secrets at rest
- HTTPS everywhere
- Input validation and sanitization

---

## 🚀 Deployment Options

### Docker Compose
Simple local and production deployment with PostgreSQL and Redis included.

### Kubernetes / Helm
Production-grade deployment with:
- Horizontal Pod Autoscaler
- Pod Disruption Budget
- Service Monitor for Prometheus
- Configurable ingress

### Terraform
Infrastructure as code for cloud providers:
- AWS
- Google Cloud
- Azure

---

## 📈 Observability

### Prometheus Metrics
Export comprehensive metrics:
- Poll success/failure rates
- Change detection counts
- Notification delivery stats
- API request latency
- Resource usage

### Grafana Dashboards
Pre-built dashboards for:
- System overview
- Notification performance
- API metrics
- Resource utilization

### Structured Logging
JSON-formatted logs with:
- Request IDs
- Correlation tracking
- Log levels
- Contextual information
