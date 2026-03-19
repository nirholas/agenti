# Deployment Guide

This guide provides detailed instructions for deploying ZeroPay either using Docker or building from source.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Option 1: Docker Deployment (Recommended)](#option-1-docker-deployment-recommended)
- [Option 2: Build from Source](#option-2-build-from-source)
- [Configuration](#configuration)
- [Running the Application](#running-the-application)
- [Database Setup](#database-setup)

## Prerequisites

### Common Requirements
- PostgreSQL 12 or higher
- Redis 6 or higher
- A wallet with sufficient funds for gas fees
- RPC endpoints for supported blockchain networks (e.g., Alchemy, Infura)

### For Docker Deployment
- Docker 20.10 or higher
- Docker Compose 2.0 or higher (optional, for easier setup)

### For Building from Source
- Rust 1.75 or higher
- Cargo (comes with Rust)
- OpenSSL development libraries
- pkg-config

## Option 1: Docker Deployment (Recommended)

### Using Pre-built Image from Docker Hub

1. **Pull the latest image:**
   ```bash
   docker pull zeropaydev/zeropay:latest
   ```

2. **Create environment configuration:**
   ```bash
   cp .env-template .env
   ```

   Edit `.env` with your configuration:
   ```bash
   PORT=9000
   DATABASE_URL=postgres://postgres:postgres@localhost/zeropay
   REDIS=redis://127.0.0.1:6379
   MNEMONICS="your 12 or 24 word seed phrase"
   WALLET=0xa0..00
   APIKEY=your-secure-api-key
   WEBHOOK=https://your-webhook-endpoint.com
   SCANNER_CONFIG=config.toml
   ```

3. **Configure chains:**

   Edit `config.toml` to configure supported blockchain networks:
   ```toml
   [[chains]]
   chain_type="evm"
   chain_name="ethereum"
   latency=6
   estimation=72
   commission=5
   commission_min=50
   commission_max=200
   admin="0xYourAdminPrivateKey"
   rpc="https://eth-mainnet.g.alchemy.com/v2/YOUR-API-KEY"
   tokens=["USDT:0xdAC17F958D2ee523a2206206994597C13D831ec7", "USDC:0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"]
   ```

4. **Run with Docker:**
   ```bash
   docker run -d \
     --name zeropay \
     -p 9000:9000 \
     --env-file .env \
     -v $(pwd)/config.toml:/app/config.toml \
     zeropaydev/zeropay:latest
   ```

### Using Docker Compose (Recommended)

The project includes a `docker-compose.yml` file that sets up PostgreSQL, Redis, and ZeroPay with all required configuration.

1. **Configure your blockchain settings:**

   Edit `config.toml` to configure supported blockchain networks:
   ```toml
   [[chains]]
   chain_type="evm"
   chain_name="Sepolia"
   latency=1
   estimation=12
   commission=5
   commission_min=50
   commission_max=200
   admin="0xYourAdminPrivateKey"
   rpc="https://ethereum-sepolia.blockpi.network/v1/rpc/YOUR-API-KEY"
   tokens=["USDT:0xTokenAddress"]
   ```

2. **Edit docker-compose.yml environment variables:**

   Update the `zeropay` service environment section in `docker-compose.yml`:
   ```yaml
   environment:
     - PORT=9000
     - DATABASE_URL=postgres://postgres:postgres@zeropay-postgres:5432/zeropay
     - REDIS_URL=redis://zeropay-redis:6379
     - SCANNER_CONFIG=config.toml
     - MNEMONICS=your twelve or twenty four word mnemonic phrase
     - WALLET=0xYourWalletAddress
     - APIKEY=your-secure-api-key
     - WEBHOOK=https://your-webhook-url.com
   ```

3. **Start all services:**
   ```bash
   docker-compose up -d
   ```

4. **View logs:**
   ```bash
   docker-compose logs -f zeropay
   ```

**Note:** All configuration is now in `docker-compose.yml`. The `.env` file is optional and only needed for local development without Docker.

### Building Docker Image Locally

If you prefer to build the image yourself:

```bash
# Build the image
docker build -t zeropay:local .

# Run the container
docker run -d \
  --name zeropay \
  -p 9000:9000 \
  --env-file .env \
  -v $(pwd)/config.toml:/app/config.toml \
  zeropay:local
```

## Option 2: Build from Source

### 1. Install Dependencies

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install -y pkg-config libssl-dev build-essential
```

**macOS:**
```bash
brew install openssl pkg-config
```

**Arch Linux:**
```bash
sudo pacman -S openssl pkg-config
```

### 2. Install Rust

If you don't have Rust installed:
```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source $HOME/.cargo/env
```

Verify installation:
```bash
rustc --version
cargo --version
```

### 3. Clone and Build

```bash
# Clone the repository
git clone https://github.com/ZeroPayDev/zeropay.git
cd zeropay

# Build in release mode
cargo build --release

# The binary will be located at: target/release/api
```

### 4. Configuration

Copy and configure environment variables:
```bash
cp .env-template .env
```

Edit `.env` and `config.toml` as described in the Docker section above.

### 5. Run the Application

```bash
# Run directly
./target/release/api

# Or with cargo
cargo run --release --bin api
```

## Database Setup

### PostgreSQL

1. **Create the database:**
   ```sql
   CREATE DATABASE zeropay;
   ```

2. **Run migrations:**

   The application will automatically run migrations on startup. Ensure your `DATABASE_URL` is correctly set in `.env`.

### Redis

Redis requires no additional setup. Ensure it's running and accessible at the URL specified in your `.env` file.

## Configuration

### Environment Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `PORT` | API server port | `9000` |
| `DATABASE_URL` | PostgreSQL connection string | `postgres://user:pass@host:5432/zeropay` |
| `REDIS_URL` | Redis connection string | `redis://host:6379` |
| `MNEMONICS` | BIP39 seed phrase for wallet generation | `word1 word2 ... word12` |
| `WALLET` | Main settlement wallet address | `0xa0..00` |
| `APIKEY` | API key for authentication | `your-secure-key` |
| `WEBHOOK` | Webhook URL for payment notifications | `https://your-app.com/webhook` |
| `SCANNER_CONFIG` | Path to chain configuration file | `config.toml` |

**For Docker Compose:** Set these in the `environment` section of `docker-compose.yml`
**For local development:** Set these in `.env` file or as environment variables

### Chain Configuration (`config.toml`)

Each chain configuration includes:

- `chain_type`: Type of blockchain (currently supports "evm")
- `chain_name`: Network name (e.g., "ethereum", "polygon")
- `latency`: Number of blocks to wait for confirmation
- `estimation`: Estimated time to receive payment (in seconds)
- `commission`: Commission rate percentage (0-100)
- `commission_min`: Minimum commission amount (in cents)
- `commission_max`: Maximum commission amount (in cents)
- `admin`: Private key for admin account (pays gas fees)
- `rpc`: RPC endpoint URL
- `tokens`: Array of supported tokens in format "SYMBOL:ADDRESS"

## Running the Application

### Docker

```bash
# Start
docker start zeropay

# Stop
docker stop zeropay

# View logs
docker logs -f zeropay

# Restart
docker restart zeropay
```

### Docker Compose

```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# View logs
docker-compose logs -f zeropay

# Restart
docker-compose restart zeropay
```

### From Source

```bash
# Development mode (with hot reload)
cargo watch -x 'run --bin api'

# Production mode
./target/release/api
```

## Health Check

Verify the application is running:

```bash
curl http://localhost:9000/health
```

## Troubleshooting

### Database Connection Issues

- Verify PostgreSQL is running: `pg_isready`
- Check connection string in `.env`
- Ensure database exists: `psql -l`

### Redis Connection Issues

- Check Redis is running: `redis-cli ping`
- Verify Redis URL in `.env`

### RPC Issues

- Test RPC endpoint: `curl -X POST <RPC_URL> -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'`
- Check API key validity
- Verify rate limits haven't been exceeded

### Build Issues

- Update Rust: `rustup update`
- Clean build artifacts: `cargo clean`
- Check OpenSSL installation: `pkg-config --modversion openssl`

## Security Recommendations

1. **Never commit sensitive data** - Keep `.env` and private keys secure
2. **Use strong API keys** - Generate secure random strings
3. **Secure webhook endpoints** - Verify HMAC signatures (see API documentation)
4. **Use firewall rules** - Restrict access to database and Redis
5. **Keep software updated** - Regularly update dependencies
6. **Monitor logs** - Set up log monitoring for suspicious activity
7. **Backup private keys** - Store securely offline

## Production Deployment

For production environments:

1. Use environment-specific configuration files
2. Set up proper logging and monitoring
3. Configure automated backups for PostgreSQL
4. Use managed services for PostgreSQL and Redis (e.g., AWS RDS, ElastiCache)
5. Set up SSL/TLS certificates (use a reverse proxy like nginx)
6. Implement rate limiting
7. Configure proper resource limits in Docker
8. Set up automated health checks and alerts

## Support

For issues and questions:
- GitHub Issues: [https://github.com/ZeroPayDev/zeropay/issues](https://github.com/ZeroPayDev/zeropay/issues)
- Documentation: See [API.md](./API.md) for API reference
