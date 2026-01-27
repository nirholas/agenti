"""
Pytest configuration and fixtures for keystore tests.
"""

import os
import sys
import json
import tempfile
import pytest
from pathlib import Path
import uuid

# Add src to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))


@pytest.fixture
def sample_private_key():
    """Return a sample private key for testing."""
    return bytes.fromhex(
        "4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318"
    )


@pytest.fixture
def sample_private_key_hex():
    """Return a sample private key as hex string."""
    return "0x4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318"


@pytest.fixture
def sample_address():
    """Return the address corresponding to sample_private_key."""
    return "0x742d35Cc6634C0532925a3b844Bc9e7595f8fE00"


@pytest.fixture
def sample_password():
    """Return a sample password for testing."""
    return "TestPassword123!"


@pytest.fixture
def weak_password():
    """Return a weak password for testing validation."""
    return "weak"


@pytest.fixture
def strong_password():
    """Return a strong password for testing."""
    return "MyV3ryStr0ng!P@ssw0rd#2024"


@pytest.fixture
def sample_salt():
    """Return a sample 32-byte salt."""
    return bytes.fromhex("ab0c7876052600dd703518d6fc3fe8984592145b591fc8fb5c6d43190334ba19")


@pytest.fixture
def sample_keystore():
    """Return a complete sample keystore structure."""
    return {
        "version": 3,
        "id": str(uuid.uuid4()),
        "address": "742d35cc6634c0532925a3b844bc9e7595f8fe00",
        "crypto": {
            "ciphertext": "5318b4d5bcd28de64ee5559e671353e16f075ecae9f99c7a79a38af5f869aa46",
            "cipherparams": {
                "iv": "6087dab2f9fdbbfaddc31a909735c1e6"
            },
            "cipher": "aes-128-ctr",
            "kdf": "scrypt",
            "kdfparams": {
                "n": 16384,  # Lower for testing speed
                "r": 8,
                "p": 1,
                "dklen": 32,
                "salt": "ab0c7876052600dd703518d6fc3fe8984592145b591fc8fb5c6d43190334ba19"
            },
            "mac": "517ead924a9d0dc3124507e3393d175ce3ff7c1e96529c6c555ce9e51205e9b2"
        }
    }


@pytest.fixture
def sample_pbkdf2_keystore():
    """Return a sample PBKDF2 keystore structure."""
    return {
        "version": 3,
        "id": str(uuid.uuid4()),
        "address": "008aeeda4d805471df9b2a5b0f38a0c3bcba786b",
        "crypto": {
            "ciphertext": "d172bf743a674da9cdad04534d56926ef8358534d458fffccd4e6ad2fbde479c",
            "cipherparams": {
                "iv": "83dbcc02d8ccb40e466191a123791e0e"
            },
            "cipher": "aes-128-ctr",
            "kdf": "pbkdf2",
            "kdfparams": {
                "c": 10000,  # Lower for testing speed
                "prf": "hmac-sha256",
                "dklen": 32,
                "salt": "ae3cd4e7013836a3df6bd7241b12db061dbe2c6785853cce422d148a624ce0bd"
            },
            "mac": "517ead924a9d0dc3124507e3393d175ce3ff7c1e96529c6c555ce9e51205e9b2"
        }
    }


@pytest.fixture
def invalid_keystore_missing_version():
    """Return an invalid keystore missing version."""
    return {
        "id": str(uuid.uuid4()),
        "address": "742d35cc6634c0532925a3b844bc9e7595f8fe00",
        "crypto": {}
    }


@pytest.fixture
def invalid_keystore_wrong_version():
    """Return an invalid keystore with wrong version."""
    return {
        "version": 2,
        "id": str(uuid.uuid4()),
        "address": "742d35cc6634c0532925a3b844bc9e7595f8fe00",
        "crypto": {}
    }


@pytest.fixture
def temp_directory():
    """Create a temporary directory for testing."""
    with tempfile.TemporaryDirectory() as tmpdir:
        yield tmpdir


@pytest.fixture
def temp_keystore_file(temp_directory, sample_keystore):
    """Create a temporary keystore file."""
    filepath = os.path.join(temp_directory, "test_keystore.json")
    with open(filepath, 'w') as f:
        json.dump(sample_keystore, f, indent=2)
    return filepath


@pytest.fixture
def kdf_test_params():
    """Return KDF parameters optimized for fast testing."""
    return {
        "scrypt": {
            "n": 16384,  # 2^14, fast for testing
            "r": 8,
            "p": 1,
            "dklen": 32
        },
        "pbkdf2": {
            "c": 10000,  # Fast for testing
            "prf": "hmac-sha256",
            "dklen": 32
        }
    }


# Mark slow tests
def pytest_configure(config):
    """Configure custom pytest markers."""
    config.addinivalue_line(
        "markers", "slow: marks tests as slow (deselect with '-m \"not slow\"')"
    )
    config.addinivalue_line(
        "markers", "integration: marks tests as integration tests"
    )


# Skip slow tests by default in CI
def pytest_collection_modifyitems(config, items):
    """Modify test collection based on markers."""
    if os.environ.get("CI"):
        skip_slow = pytest.mark.skip(reason="Skipping slow tests in CI")
        for item in items:
            if "slow" in item.keywords:
                item.add_marker(skip_slow)
