---
title: Go SDK
description: Official Go client library for MCP Notify
icon: simple/go
---

# Go SDK

The official Go client for interacting with MCP Notify.

## Installation

```bash
go get github.com/nirholas/mcp-notify/pkg/client
```

## Quick Start

```go
package main

import (
    "context"
    "fmt"
    "log"

    "github.com/nirholas/mcp-notify/pkg/client"
)

func main() {
    // Create client
    c := client.New("https://api.mcp-notify.example.com", "your-api-key")

    ctx := context.Background()

    // Search for servers
    servers, err := c.SearchServers(ctx, "database")
    if err != nil {
        log.Fatal(err)
    }

    for _, s := range servers {
        fmt.Printf("%s: %s\n", s.Name, s.Description)
    }
}
```

## Client Options

### Custom HTTP Client

```go
httpClient := &http.Client{
    Timeout: 30 * time.Second,
}

c := client.New(baseURL, apiKey, client.WithHTTPClient(httpClient))
```

### Retry Configuration

```go
c := client.New(baseURL, apiKey,
    client.WithMaxRetries(3),
    client.WithRetryDelay(100 * time.Millisecond),
)
```

## API Methods

### Subscriptions

#### Create Subscription

```go
sub, err := c.CreateSubscription(ctx, &client.CreateSubscriptionRequest{
    ServerPattern: "claude-*",
    Channels: []client.Channel{
        {Type: "slack", Config: map[string]string{"webhook_url": "..."}},
    },
    NotifyOn: []string{"new", "updated", "removed"},
})
```

#### List Subscriptions

```go
subs, err := c.ListSubscriptions(ctx)
for _, sub := range subs {
    fmt.Printf("ID: %s, Pattern: %s\n", sub.ID, sub.ServerPattern)
}
```

#### Get Subscription

```go
sub, err := c.GetSubscription(ctx, "subscription-id")
```

#### Update Subscription

```go
sub, err := c.UpdateSubscription(ctx, "subscription-id", &client.UpdateSubscriptionRequest{
    ServerPattern: "new-pattern-*",
    Active: true,
})
```

#### Delete Subscription

```go
err := c.DeleteSubscription(ctx, "subscription-id")
```

### Changes

#### Get Recent Changes

```go
changes, err := c.GetChanges(ctx, &client.GetChangesRequest{
    Since: time.Now().Add(-24 * time.Hour),
    Limit: 50,
})
```

#### Get Server Changes

```go
changes, err := c.GetServerChanges(ctx, "server-name", nil)
```

### Servers

#### Search Servers

```go
results, err := c.SearchServers(ctx, "database")
```

#### Get Server

```go
server, err := c.GetServer(ctx, "filesystem")
```

### Statistics

```go
stats, err := c.GetStats(ctx)
fmt.Printf("Total servers: %d\n", stats.TotalServers)
fmt.Printf("Changes today: %d\n", stats.ChangesToday)
```

## Error Handling

```go
sub, err := c.GetSubscription(ctx, "invalid-id")
if err != nil {
    var apiErr *client.APIError
    if errors.As(err, &apiErr) {
        switch apiErr.StatusCode {
        case http.StatusNotFound:
            fmt.Println("Subscription not found")
        case http.StatusUnauthorized:
            fmt.Println("Invalid API key")
        default:
            fmt.Printf("API error: %s\n", apiErr.Message)
        }
    }
}
```

## Context and Cancellation

All methods accept a context for cancellation and timeouts:

```go
ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
defer cancel()

servers, err := c.SearchServers(ctx, "database")
if errors.Is(err, context.DeadlineExceeded) {
    log.Println("Request timed out")
}
```

## Complete Example

```go
package main

import (
    "context"
    "fmt"
    "log"
    "os"

    "github.com/nirholas/mcp-notify/pkg/client"
)

func main() {
    c := client.New(
        os.Getenv("MCP_NOTIFY_URL"),
        os.Getenv("MCP_NOTIFY_API_KEY"),
    )

    ctx := context.Background()

    // Create a subscription
    sub, err := c.CreateSubscription(ctx, &client.CreateSubscriptionRequest{
        ServerPattern: "claude-*",
        Channels: []client.Channel{
            {
                Type: "discord",
                Config: map[string]string{
                    "webhook_url": os.Getenv("DISCORD_WEBHOOK"),
                },
            },
        },
        NotifyOn: []string{"new", "updated"},
        DigestSchedule: "daily",
    })
    if err != nil {
        log.Fatalf("Failed to create subscription: %v", err)
    }

    fmt.Printf("Created subscription: %s\n", sub.ID)

    // Check recent changes
    changes, err := c.GetChanges(ctx, nil)
    if err != nil {
        log.Fatalf("Failed to get changes: %v", err)
    }

    fmt.Printf("Recent changes: %d\n", len(changes))
    for _, change := range changes[:5] {
        fmt.Printf("  - %s: %s (%s)\n", change.ServerName, change.Type, change.Timestamp)
    }
}
```
