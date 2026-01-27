# Lyra Intel Quick Start

Get started with Lyra Intel in under 5 minutes.

## Installation

```bash
# Clone the repository
git clone https://github.com/nirholas/lyra-intel.git
cd lyra-intel

# Install dependencies
pip install -e .

# Verify installation
python cli.py --version
```

## Basic Usage

### 1. Scan a Repository

Quickly scan any codebase:

```bash
python cli.py scan /path/to/your/repo
```

This provides:
- Total file count and sizes
- Code structure overview
- Basic complexity metrics
- Language breakdown

### 2. Full Analysis

For comprehensive analysis:

```bash
python cli.py analyze /path/to/your/repo --output ./results.json
```

This generates:
- Detailed code metrics
- Dependency graphs
- Pattern detection results
- Security findings
- Git history analysis

### 3. Security Scan

Check for security vulnerabilities:

```bash
python cli.py security-scan /path/to/your/repo --output security.json
```

Detects:
- Hardcoded credentials
- SQL injection risks
- Unsafe patterns
- Known vulnerabilities

### 4. Compare Branches

Analyze differences between branches:

```bash
python emergency_analysis.py /path/to/repo main feature-branch
```

Shows:
- Changed files
- Complexity deltas
- New security issues
- Recommendations

## Web Dashboard

Launch the interactive dashboard:

```bash
python launch_dashboard.py
```

Then visit `http://localhost:8080` to explore:
- Interactive code graphs
- Dependency visualizations
- Security reports
- Metrics dashboards

## API Server

Start the REST API:

```bash
python -m src.api.server
```

The API will be available at `http://localhost:8080/api/v1/`

Test it:
```bash
curl http://localhost:8080/api/v1/health
```

## Common Commands

```bash
# Analyze with specific features
python cli.py analyze /path/to/repo \
  --features security,dependencies,patterns \
  --output results.json

# Generate HTML report
python cli.py report /path/to/repo --output report.html

# Export dependency graph
python cli.py graph /path/to/repo --format dot --output deps.dot

# Check analysis status
python cli.py status
```

## Configuration

Create a `.env` file from the template:

```bash
cp .env.example .env
```

Edit `.env` to configure:
- AI provider API keys (optional)
- Database settings
- Cache backends
- API authentication

## Docker Setup

Using Docker for isolated environment:

```bash
# Build image
docker build -t lyra-intel .

# Run analysis
docker run -v /path/to/repo:/repo lyra-intel analyze /repo

# Start API server
docker-compose up
```

## Next Steps

- Read [README.md](README.md) for full feature list
- Check [CONTRIBUTING.md](CONTRIBUTING.md) for development guide
- See [API Documentation](docs/API.md) for API reference
- Explore [Examples](examples/) for advanced usage

## Common Issues

### Missing Dependencies
```bash
pip install -r requirements.txt
```

### Python Version
Requires Python 3.9 or higher:
```bash
python --version
```

### Permission Errors
Make sure scripts are executable:
```bash
chmod +x cli.py emergency_analysis.py
```

## Getting Help

```bash
# General help
python cli.py --help

# Command-specific help
python cli.py analyze --help
python cli.py security-scan --help
```

For issues and questions, please visit the GitHub repository.
- contact [nich on Github](github.com/nirholas) | [nich on X](x.com/nichxbt)

