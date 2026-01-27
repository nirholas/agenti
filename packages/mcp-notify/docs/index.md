---
title: MCP Notify
description: Real-time notifications for MCP Registry changes
hide:
  - navigation
  - toc
---

<style>
.md-main__inner {
  margin-top: 0;
}
.md-content__inner {
  padding-top: 0;
}
.hero {
  background: linear-gradient(135deg, #4051b5 0%, #6366f1 50%, #0ea5e9 100%);
  padding: 4rem 1rem;
  margin: 0 -1rem;
  text-align: center;
  color: white;
}
.hero h1 {
  font-size: 3rem;
  font-weight: 700;
  margin-bottom: 1rem;
}
.hero p {
  font-size: 1.25rem;
  opacity: 0.9;
  max-width: 600px;
  margin: 0 auto 2rem;
}
.hero-buttons {
  display: flex;
  gap: 1rem;
  justify-content: center;
  flex-wrap: wrap;
}
.hero-buttons a {
  padding: 0.75rem 2rem;
  border-radius: 0.5rem;
  font-weight: 600;
  text-decoration: none;
  transition: transform 0.2s;
}
.hero-buttons a:hover {
  transform: translateY(-2px);
}
.hero-buttons .primary {
  background: white;
  color: #4051b5;
}
.hero-buttons .secondary {
  background: rgba(255,255,255,0.15);
  color: white;
  border: 2px solid rgba(255,255,255,0.3);
}
.features {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 2rem;
  padding: 4rem 1rem;
  max-width: 1200px;
  margin: 0 auto;
}
.feature {
  text-align: center;
  padding: 2rem;
  border-radius: 1rem;
  background: var(--md-code-bg-color);
}
.feature-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}
.feature h3 {
  margin-bottom: 0.5rem;
}
.feature p {
  opacity: 0.8;
}
.channels {
  background: var(--md-code-bg-color);
  padding: 4rem 1rem;
  text-align: center;
}
.channels h2 {
  margin-bottom: 2rem;
}
.channel-grid {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 1rem;
  max-width: 800px;
  margin: 0 auto;
}
.channel {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.5rem;
  background: var(--md-default-bg-color);
  border-radius: 2rem;
  font-weight: 500;
}
.quickstart {
  padding: 4rem 1rem;
  max-width: 800px;
  margin: 0 auto;
}
.quickstart h2 {
  text-align: center;
  margin-bottom: 2rem;
}
</style>

<div class="hero">
  <h1>🔔 MCP Notify</h1>
  <p>
    Never miss a change in the MCP Registry. Get real-time notifications 
    when new servers are added, existing ones are updated, or servers are removed.
  </p>
  <div class="hero-buttons">
    <a href="getting-started/quickstart/" class="primary">Get Started →</a>
    <a href="https://github.com/nirholas/mcp-notify" class="secondary">View on GitHub</a>
  </div>
</div>

<div class="features">
  <div class="feature">
    <div class="feature-icon">⚡</div>
    <h3>Real-Time Monitoring</h3>
    <p>Continuous polling of the official MCP Registry with intelligent diff detection</p>
  </div>
  <div class="feature">
    <div class="feature-icon">🎯</div>
    <h3>Smart Filters</h3>
    <p>Filter by namespaces, keywords, and change types to get only relevant notifications</p>
  </div>
  <div class="feature">
    <div class="feature-icon">📡</div>
    <h3>7 Notification Channels</h3>
    <p>Discord, Slack, Email, Telegram, Teams, Webhooks, and RSS feeds</p>
  </div>
  <div class="feature">
    <div class="feature-icon">🛠️</div>
    <h3>CLI & API</h3>
    <p>Full-featured CLI tool and REST API for programmatic access</p>
  </div>
  <div class="feature">
    <div class="feature-icon">🤖</div>
    <h3>MCP Server</h3>
    <p>Native MCP server integration for AI assistants like Claude</p>
  </div>
  <div class="feature">
    <div class="feature-icon">🚀</div>
    <h3>Easy Deployment</h3>
    <p>One-click deploy to Railway, Docker Compose, or Kubernetes</p>
  </div>
</div>

<div class="channels">
  <h2>Supported Notification Channels</h2>
  <div class="channel-grid">
    <div class="channel">💬 Discord</div>
    <div class="channel">📱 Slack</div>
    <div class="channel">📧 Email</div>
    <div class="channel">✈️ Telegram</div>
    <div class="channel">👥 Microsoft Teams</div>
    <div class="channel">🔗 Webhooks</div>
    <div class="channel">📰 RSS/Atom</div>
  </div>
</div>

<div class="quickstart">
  <h2>Quick Start</h2>

```bash
# Install the CLI
go install github.com/nirholas/mcp-notify/cmd/mcp-notify-cli@latest

# Watch for changes in real-time
mcp-notify-cli watch

# Create a Discord subscription
mcp-notify-cli subscribe discord \
  --webhook-url "https://discord.com/api/webhooks/..." \
  --name "My MCP Alerts"
```

  <p style="text-align: center; margin-top: 2rem;">
    <a href="getting-started/installation/" class="md-button md-button--primary">
      Full Installation Guide →
    </a>
  </p>
</div>
