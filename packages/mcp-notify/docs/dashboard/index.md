---
title: Dashboard
description: Web dashboard for managing MCP Notify subscriptions
icon: material/view-dashboard
---

# Dashboard

The MCP Notify Dashboard provides a visual interface for managing subscriptions and viewing changes.

![Dashboard Screenshot](../assets/dashboard-preview.png){ loading=lazy }

## Features

<div class="grid cards" markdown>

-   :material-bell-ring:{ .lg .middle } **Subscription Management**

    ---

    Create, edit, and delete subscriptions with an intuitive UI

-   :material-history:{ .lg .middle } **Change History**

    ---

    View all detected registry changes with filtering

-   :material-chart-line:{ .lg .middle } **Statistics**

    ---

    Real-time metrics and analytics

-   :material-theme-light-dark:{ .lg .middle } **Dark/Light Mode**

    ---

    Automatic theme switching

</div>

## Quick Start

### Using Docker

```bash
docker run -d \
  -p 3000:3000 \
  -e API_URL=http://localhost:8080 \
  ghcr.io/nirholas/mcp-notify-dashboard:latest
```

### From Source

```bash
cd web/dashboard
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Pages

### Subscriptions

Manage your notification subscriptions.

**Create Subscription:**

1. Click "New Subscription"
2. Enter server pattern (e.g., `claude-*`)
3. Select change types to monitor
4. Add notification channels
5. Save

**Edit Subscription:**

1. Click the edit icon on any subscription
2. Modify settings
3. Save changes

### Servers

Browse and search all MCP servers in the registry.

- Search by name or description
- View server details
- See change history per server

### Changes

View the change feed with filtering:

- Filter by change type (new, updated, removed)
- Filter by server pattern
- Date range selection

### Settings

Configure dashboard preferences:

- Theme (auto/light/dark)
- Notifications
- API configuration

## Self-Hosting

### Requirements

- Node.js 18+
- MCP Notify API running

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `API_URL` | Backend API URL | `http://localhost:8080` |
| `API_KEY` | API authentication key | - |

### Build for Production

```bash
npm run build
npm run start
```

### With Docker Compose

```yaml
services:
  dashboard:
    build: ./web/dashboard
    ports:
      - "3000:3000"
    environment:
      - API_URL=http://mcp-notify:8080
    depends_on:
      - mcp-notify
```

## Technology Stack

- **Framework**: Next.js 14
- **UI**: Tailwind CSS + Shadcn/UI
- **State**: React Query
- **Charts**: Recharts
