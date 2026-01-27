# SDKs Overview

Official SDKs for Free Crypto News API, available in multiple languages.

## Installation

=== "Python"

    ```bash
    pip install free-crypto-news
    ```

=== "JavaScript"

    ```bash
    npm install free-crypto-news
    ```

=== "TypeScript"

    ```bash
    npm install @free-crypto-news/typescript
    ```

=== "React"

    ```bash
    npm install @free-crypto-news/react
    ```

=== "Go"

    ```bash
    go get github.com/nirholas/free-crypto-news/sdk/go
    ```

=== "PHP"

    ```bash
    composer require free-crypto-news/sdk
    ```

## Quick Comparison

| SDK | Async | Types | Real-time | Size |
|-----|-------|-------|-----------|------|
| Python | ✅ asyncio | ✅ Pydantic | ✅ SSE | ~15KB |
| JavaScript | ✅ Promise | ❌ | ✅ WebSocket | ~8KB |
| TypeScript | ✅ Promise | ✅ Full | ✅ WebSocket | ~12KB |
| React | ✅ Hooks | ✅ Full | ✅ Hooks | ~20KB |
| Go | ✅ Goroutines | ✅ Structs | ✅ Channels | ~25KB |
| PHP | ❌ | ❌ | ❌ | ~10KB |

## Choose Your SDK

<div class="grid" markdown>

<div class="card" markdown>
### [:fontawesome-brands-python: Python](python.md)
Best for data science, scripts, and backend services. Includes async support and Pydantic models.
</div>

<div class="card" markdown>
### [:fontawesome-brands-js: JavaScript](javascript.md)
Best for Node.js backends and vanilla JS frontends. Lightweight and dependency-free.
</div>

<div class="card" markdown>
### [:simple-typescript: TypeScript](typescript.md)
Best for type-safe applications. Full type definitions for all API responses.
</div>

<div class="card" markdown>
### [:fontawesome-brands-react: React](react.md)
Best for React apps. Includes hooks, components, and context providers.
</div>

<div class="card" markdown>
### [:fontawesome-brands-golang: Go](go.md)
Best for high-performance services. Includes concurrent fetching and channels for real-time.
</div>

<div class="card" markdown>
### [:fontawesome-brands-php: PHP](php.md)
Best for WordPress plugins and PHP backends. Simple and straightforward.
</div>

</div>
