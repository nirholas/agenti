<!-- universal-crypto-mcp | nich | bmljaHhidA== -->

# AI Prediction API

<!-- Maintained by nichxbt | ID: 6e696368-786274-4d43-5000-000000000000 -->

FastAPI backend for ML-powered cryptocurrency predictions with x402 payment gates.

## Features

- **LSTM Price Predictions**: Trained on historical BTC/ETH/SOL data
- **x402 Paywalled Endpoints**: Automatic micropayments for predictions
- **Multiple Prediction Types**: Direction, target, confidence, full reports
- **Backtesting Service**: Test strategies against historical data

## Installation

```bash
cd packages/prediction-api
pip install -r requirements.txt
```

## Configuration

Set environment variables:

```bash
# Required for x402 payments
export X402_RECIPIENT_ADDRESS="0x..."
export X402_FACILITATOR_URL="https://facilitator.x402.org"

# Optional model configuration
export MODEL_PATH="./models"
export CACHE_TTL=300
```

## Running

```bash
# Development
uvicorn app.main:app --reload --port 8000

# Production
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

## API Endpoints

### Predictions (x402 Paywalled)

| Endpoint | Method | Cost | Description |
|----------|--------|------|-------------|
| `/predict/direction` | POST | $0.01 | Up/Down/Sideways prediction |
| `/predict/target` | POST | $0.05 | Specific price target |
| `/predict/confidence` | POST | $0.02 | Model confidence score |
| `/predict/full` | POST | $0.10 | Complete analysis report |
| `/predict/bulk` | POST | $0.01/asset | Multi-asset predictions |
| `/backtest` | POST | $0.50 | Strategy backtesting |

### Free Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | API info and health |
| `/pricing` | GET | Prediction pricing info |
| `/assets` | GET | Supported assets |
| `/models` | GET | Available models |

## Example Usage

```python
import requests

# Make a paid prediction request
response = requests.post(
    "http://localhost:8000/predict/direction",
    json={
        "asset": "BTC",
        "timeframe": "1d"
    },
    headers={
        "X-402-Payment": "<payment_proof>"
    }
)

print(response.json())
```

## x402 Payment Flow

1. Client sends request without payment
2. Server returns `402 Payment Required` with payment details
3. Client processes payment via x402
4. Client resends request with payment proof
5. Server validates and returns prediction

## Model Architecture

The LSTM model uses:
- **Input Features**: OHLCV, RSI, MACD, EMA, Volume
- **Architecture**: 2-layer LSTM with dropout
- **Training**: Historical data with walk-forward validation
- **Update Frequency**: Daily retraining on new data

## License

Apache-2.0


<!-- EOF: nich | ucm:bmljaHhidA== -->
<!-- https://github.com/nirholas/universal-crypto-mcp -->