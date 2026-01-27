# Installation Instructions

## Quick Install

```bash
# Basic installation
pip install lyra-intel

# With all features
pip install lyra-intel[all]

# Specific feature sets
pip install lyra-intel[ai]          # AI providers
pip install lyra-intel[export]       # PDF/Excel export
pip install lyra-intel[enterprise]   # SSO integration
```

## Development Installation

```bash
# Clone repository
git clone https://github.com/nirholas/lyra-intel.git
cd lyra-intel

# Install in development mode
pip install -e ".[all]"

# Install development dependencies
pip install -r requirements-dev.txt
```

## Feature-Specific Dependencies

### AI Features
```bash
pip install openai anthropic sentence-transformers
```

### Export Formats
```bash
pip install reportlab openpyxl
```

### Real-Time Streaming
```bash
pip install websockets
```

### Monitoring
```bash
pip install prometheus-client
```

### Enterprise SSO
```bash
pip install ldap3 python-saml
```

### Interactive CLI
```bash
pip install click rich
```

## Docker Installation

```bash
# Pull image
docker pull ghcr.io/nirholas/lyra-intel:latest

# Run with docker-compose
docker-compose up -d
```

## IDE Extensions

### VS Code
```bash
cd extensions/vscode
npm install
npm run compile
# Install extension from VSIX
```

### JetBrains
```bash
cd extensions/jetbrains
./gradlew buildPlugin
# Install plugin from build/distributions/
```

## Web Dashboard

```bash
cd src/web/dashboard
npm install
npm run build
npm run preview
```

## Verifying Installation

```bash
# Check CLI
lyra-intel --version

# Run health check
curl http://localhost:8080/api/v1/health

# Test analysis
lyra-intel analyze /path/to/code --format json
```

## Troubleshooting

**ImportError: No module named 'sentence_transformers'**
```bash
pip install sentence-transformers
```

**ReportLab not found**
```bash
pip install reportlab
```

**WebSocket connection failed**
```bash
pip install websockets
```

**LDAP/SAML errors**
```bash
pip install ldap3 python-saml
```

- contact [nich on Github](github.com/nirholas) | [nich on X](x.com/nichxbt)
