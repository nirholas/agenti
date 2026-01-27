"""
Pytest configuration for transaction-mcp-server tests.
"""

import pytest


@pytest.fixture
def test_addresses():
    """Common test addresses."""
    return {
        'sender': '0x742d35Cc6634C0532925a3b844Bc9e7595f2bD73',
        'recipient': '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
        'contract': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',  # USDC
    }


@pytest.fixture
def test_private_key():
    """Test private key - NEVER use in production."""
    return '0x4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318'


@pytest.fixture
def legacy_tx():
    """Sample legacy transaction."""
    return {
        'to': '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
        'value': 1000000000000000000,  # 1 ETH
        'gas': 21000,
        'gasPrice': 30000000000,  # 30 gwei
        'nonce': 0,
        'chainId': 1
    }


@pytest.fixture
def eip1559_tx():
    """Sample EIP-1559 transaction."""
    return {
        'to': '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
        'value': 1000000000000000000,  # 1 ETH
        'gas': 21000,
        'maxFeePerGas': 50000000000,  # 50 gwei
        'maxPriorityFeePerGas': 2000000000,  # 2 gwei
        'nonce': 0,
        'chainId': 1
    }
