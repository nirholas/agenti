# chaoschain-x402-client

Python client for the ChaosChain x402 decentralized facilitator.

## Overview

This client provides a simple interface to verify and settle x402 payments using the decentralized CRE-powered facilitator instead of a centralized server.

## Installation

```bash
pip install chaoschain-x402-client
```

## Quick Start

```python
from chaoschain_x402_client import X402Client

# Initialize client
client = X402Client(facilitator_url='http://localhost:8402')

# Verify a payment
verify_result = client.verify_payment(
    payment_header='base64_encoded_payment_header',
    payment_requirements={
        'scheme': 'exact',
        'network': 'base-sepolia',
        'maxAmountRequired': '1000000',
        'payTo': '0x...',
        'asset': '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
        'resource': '/api/weather'
    }
)

if verify_result.isValid:
    print('✅ Payment verified!')
    print(f'Consensus proof: {verify_result.consensusProof}')

# Settle a payment
settle_result = client.settle_payment(
    payment_header='base64_encoded_payment_header',
    payment_requirements={
        'scheme': 'exact',
        'network': 'base-sepolia',
        'maxAmountRequired': '1000000',
        'payTo': '0x...',
        'asset': '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
        'resource': '/api/weather'
    }
)

if settle_result.success:
    print('✅ Payment settled!')
    print(f'Transaction hash: {settle_result.txHash}')
```

## Using as Context Manager

```python
from chaoschain_x402_client import X402Client

with X402Client(facilitator_url='http://localhost:8402') as client:
    result = client.verify_payment(header, requirements)
    print(f'Valid: {result.isValid}')
```

## API Reference

### `X402Client`

#### Constructor

```python
X402Client(
    facilitator_url: str,
    x402_version: int = 1,
    timeout: int = 30
)
```

**Parameters:**
- `facilitator_url` (required): URL of the facilitator service
- `x402_version` (optional): x402 protocol version (default: 1)
- `timeout` (optional): Request timeout in seconds (default: 30)

#### Methods

**`verify_payment(payment_header: str, payment_requirements: dict) -> VerifyResponse`**

Verifies an x402 payment via decentralized consensus.

**`settle_payment(payment_header: str, payment_requirements: dict) -> SettleResponse`**

Settles an x402 payment on-chain via decentralized consensus.

**`get_supported_schemes() -> SupportedSchemesResponse`**

Gets the list of supported payment schemes and networks.

**`health_check() -> ServiceInfo`**

Checks if the facilitator is responsive.

## Types

### `PaymentRequirements`

```python
{
    'scheme': str,                    # Payment scheme (e.g., 'exact')
    'network': str,                   # Blockchain network
    'maxAmountRequired': str,         # Maximum amount (string for large numbers)
    'resource': str,                  # Resource identifier
    'payTo': str,                     # Recipient address
    'asset': str,                     # Asset contract address
    'description': str | None,        # Optional description
    'mimeType': str | None,           # Optional MIME type
    'maxTimeoutSeconds': int | None,  # Optional timeout
    'extra': dict | None              # Optional extra data
}
```

### `VerifyResponse`

```python
class VerifyResponse:
    isValid: bool
    invalidReason: str | None
    consensusProof: str | None
    reportId: str | None
    timestamp: int | None
```

### `SettleResponse`

```python
class SettleResponse:
    success: bool
    error: str | None
    txHash: str | None
    networkId: str | None
    consensusProof: str | None
    timestamp: int | None
```

## Environment Variables

```bash
X402_FACILITATOR_URL=http://localhost:8402
```

```python
import os
from chaoschain_x402_client import X402Client

client = X402Client(
    facilitator_url=os.getenv('X402_FACILITATOR_URL', 'http://localhost:8402')
)
```

## Error Handling

```python
from chaoschain_x402_client import X402Client
import requests

client = X402Client(facilitator_url='http://localhost:8402')

try:
    result = client.verify_payment(header, requirements)
except TimeoutError:
    print('Request timed out')
except RuntimeError as e:
    print(f'Verification failed: {e}')
except requests.exceptions.RequestException as e:
    print(f'Network error: {e}')
```

## Integration with ChaosChain SDK

This client can be used alongside the main ChaosChain SDK for full agent functionality:

```python
from chaoschain_sdk import ChaosChainSDK, NetworkConfig
from chaoschain_x402_client import X402Client
import os

# Initialize ChaosChain SDK for agent identity
sdk = ChaosChainSDK(
    agent_name='MyAgent',
    agent_domain='myagent.example.com',
    agent_role='server',
    network=NetworkConfig.BASE_SEPOLIA,
    private_key=os.getenv('PRIVATE_KEY')
)

# Initialize x402 client for decentralized payments
x402 = X402Client(
    facilitator_url=os.getenv('X402_FACILITATOR_URL')
)

# Use both together
agent_id, tx_hash = sdk.register_identity()
payment_result = x402.verify_payment(header, requirements)
```

## Development

```bash
# Install dependencies
pip install -e ".[dev]"

# Run tests
pytest

# Run tests with coverage
pytest --cov=chaoschain_x402_client

# Type checking
mypy chaoschain_x402_client

# Format code
black chaoschain_x402_client
```

## Learn More

- [ChaosChain x402 Repo](https://github.com/ChaosChain/chaoschain-x402)
- [x402 Protocol](https://github.com/coinbase/x402)
- [ChaosChain SDK](https://github.com/ChaosChain/chaoschain-sdk-py)
- [Chainlink CRE](https://docs.chain.link/cre)

## License

MIT

