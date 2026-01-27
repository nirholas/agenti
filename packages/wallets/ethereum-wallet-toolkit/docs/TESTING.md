# Testing Guide for Ethereum Wallet MCP Servers

This guide covers testing the MCP servers - both for development and for users wanting to verify their installation works correctly.

## Table of Contents

- [Quick Start](#quick-start)
- [Test Architecture](#test-architecture)
- [Running Tests](#running-tests)
- [Writing Tests](#writing-tests)
- [Test Fixtures & Vectors](#test-fixtures--vectors)
- [Manual Testing](#manual-testing)
- [Troubleshooting](#troubleshooting)

---

## Quick Start

### Run All Tests

```bash
# From repository root
./run_all_tests.sh

# Or individually
cd ethereum-wallet-mcp && pytest tests/ -v
cd signing-mcp-server && pytest tests/ -v
cd keystore-mcp-server && pytest tests/ -v
cd transaction-mcp-server && pytest tests/ -v
cd validation-mcp-server && pytest tests/ -v
```

### Expected Output

```
======================================
Running all MCP server tests
======================================

=== 1. ETHEREUM-WALLET-MCP TESTS ===
111 passed ✅

=== 2. SIGNING-MCP-SERVER TESTS ===
34 passed ✅

=== 3. KEYSTORE-MCP-SERVER TESTS ===
74 passed ✅

=== 4. TRANSACTION-MCP-SERVER TESTS ===
65 passed ✅

=== 5. VALIDATION-MCP-SERVER TESTS ===
64 passed ✅

Total: 348 tests
======================================
```

---

## Test Architecture

### Structure

Each MCP server follows the same testing pattern:

```
<server>/
├── src/
│   └── <package>/
│       └── tools/
│           ├── module.py          # Contains *_impl() functions
│           └── ...
└── tests/
    ├── __init__.py
    ├── conftest.py                # Shared fixtures
    ├── test_<feature>.py          # Tests for each feature
    └── ...
```

### Testing Approach

We test the **implementation functions** (`*_impl`) directly rather than going through MCP protocol:

```python
# ✅ Correct - Test the implementation
from signing_mcp.tools.message_signing import sign_message_impl

def test_sign_message():
    result = sign_message_impl("Hello", TEST_KEY)
    assert result['signature'].startswith('0x')

# ❌ Wrong - Don't test via server._tools (doesn't work)
server = Server()
tools = server._tools  # This doesn't exist!
```

### Why This Approach?

1. **Isolation** - Tests the actual logic without MCP transport overhead
2. **Speed** - No server startup/shutdown per test
3. **Reliability** - Not dependent on MCP SDK implementation details
4. **Simplicity** - Easy to write and understand

---

## Running Tests

### Prerequisites

```bash
# Install dev dependencies for each server
pip install -e "./ethereum-wallet-mcp[dev]"
pip install -e "./signing-mcp-server[dev]"
pip install -e "./keystore-mcp-server[dev]"
pip install -e "./transaction-mcp-server[dev]"
pip install -e "./validation-mcp-server[dev]"
```

### Run Specific Server Tests

```bash
# Wallet generation tests
pytest ethereum-wallet-mcp/tests/test_wallet_generation.py -v

# Signing tests
pytest signing-mcp-server/tests/test_message_signing.py -v

# Transaction tests
pytest transaction-mcp-server/tests/test_signing.py -v
```

### Run Tests with Coverage

```bash
cd ethereum-wallet-mcp
pytest tests/ --cov=ethereum_wallet_mcp --cov-report=html
open htmlcov/index.html
```

### Run Tests Matching Pattern

```bash
# All tests with "sign" in the name
pytest -k "sign" -v

# All async tests
pytest -k "asyncio" -v
```

### Run Tests with Debug Output

```bash
# Show print statements
pytest -s

# Show full diffs
pytest -vv

# Stop on first failure
pytest -x

# Drop into debugger on failure
pytest --pdb
```

---

## Writing Tests

### Basic Test Structure

```python
"""
Tests for <feature>.
"""

import pytest
from <package>.tools.<module> import <function>_impl


# Test vectors - known good inputs and outputs
TEST_VECTORS = [
    ("input1", "expected1"),
    ("input2", "expected2"),
]


class TestFeature:
    """Test <feature> functionality."""
    
    def test_basic_case(self):
        """Test the basic happy path."""
        result = function_impl("valid input")
        assert result['key'] == 'expected value'
    
    @pytest.mark.parametrize("input,expected", TEST_VECTORS)
    def test_known_vectors(self, input, expected):
        """Test against known test vectors."""
        result = function_impl(input)
        assert result['output'] == expected
    
    def test_error_case(self):
        """Test error handling."""
        result = function_impl("invalid input")
        assert result['error'] is True
```

### Using Fixtures

```python
# conftest.py
import pytest

@pytest.fixture
def test_private_key():
    """Test private key - NEVER use in production."""
    return "0x4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318"

@pytest.fixture
def test_address():
    """Corresponding address for test private key."""
    return "0x2c7536E3605D9C16a7a3D7b1898e529396a65c23"


# test_file.py
def test_derivation(test_private_key, test_address):
    result = derive_address_impl(test_private_key)
    assert result['address'] == test_address
```

### Testing Async Functions

```python
import pytest

@pytest.mark.asyncio
async def test_async_function():
    """Test an async function."""
    result = await async_function_impl("input")
    assert result['success'] is True
```

### Testing Error Cases

```python
def test_invalid_input_returns_error():
    """Test that invalid input returns error dict, not exception."""
    result = function_impl("definitely invalid")
    
    assert result.get('error') is True
    assert 'message' in result or 'error_message' in result


def test_exception_is_caught():
    """Test that exceptions are caught and returned as errors."""
    # The implementation should catch exceptions and return error dict
    result = function_impl(None)  # Likely to cause issues
    assert result.get('error') is True
```

---

## Test Fixtures & Vectors

### Standard Test Keys

**NEVER use these with real funds - they are publicly known!**

```python
# Test key #1 (private key value = 1)
TEST_KEY_1 = "0x0000000000000000000000000000000000000000000000000000000000000001"
TEST_ADDRESS_1 = "0x7E5F4552091A69125d5DfCb7b8C2659029395Bdf"

# Test key from web3.py docs
TEST_KEY_2 = "0x4c0883a69102937d6231471b5dbb6204fe5129617082792ae468d01a3f362318"
TEST_ADDRESS_2 = "0x2c7536E3605D9C16a7a3D7b1898e529396a65c23"

# Standard test mnemonic (BIP39)
TEST_MNEMONIC = "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about"
TEST_MNEMONIC_ADDRESS = "0x9858EfFD232B4033E47d90003D41EC34EcaEda94"  # At m/44'/60'/0'/0/0
```

### EIP-55 Checksum Vectors

```python
# Official EIP-55 test vectors
EIP55_VECTORS = [
    ("0x5aaeb6053f3e94c9b9a09f33669435e7ef1beaed", "0x5aAeb6053F3E94C9b9A09f33669435E7Ef1BeAed"),
    ("0xfb6916095ca1df60bb79ce92ce3ea74c37c5d359", "0xfB6916095ca1df60bB79Ce92cE3Ea74c37c5d359"),
    ("0xdbf03b407c01e7cd3cbea99509d93f8dddc8c6fb", "0xdbF03B407c01E7cD3CBea99509d93f8DDDC8C6FB"),
    ("0xd1220a0cf47c7b9be7a2e6ba89f429762e7b9adb", "0xD1220A0cf47c7B9Be7A2E6BA89F429762e7b9aDb"),
]
```

### Function Selector Vectors

```python
# Common ERC-20 selectors
SELECTOR_VECTORS = [
    ("transfer(address,uint256)", "0xa9059cbb"),
    ("approve(address,uint256)", "0x095ea7b3"),
    ("transferFrom(address,address,uint256)", "0x23b872dd"),
    ("balanceOf(address)", "0x70a08231"),
    ("totalSupply()", "0x18160ddd"),
]
```

### Keccak256 Vectors

```python
# Known keccak256 hashes
HASH_VECTORS = [
    ("", "0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470"),
    ("Hello, World!", "0xacaf3289d7b601cbd114fb36c4d29c85bbfd5e133f14cb355c3fd8d99367964f"),
]
```

---

## Manual Testing

### Test Server Startup

```bash
# Each server should start without errors
ethereum-wallet-mcp
# Should hang waiting for input (Ctrl+C to exit)

signing-mcp-server
keystore-mcp-server
transaction-mcp-server
validation-mcp-server
```

### Test via Claude Desktop

1. Configure servers in `claude_desktop_config.json`
2. Restart Claude Desktop
3. Ask Claude to list available tools:
   ```
   What Ethereum wallet tools are available?
   ```
4. Test each server:
   ```
   Generate a new Ethereum wallet
   Sign the message "test" with private key 0x...
   Validate this address: 0x...
   ```

### Test via MCP Inspector

```bash
# Install MCP inspector
npm install -g @anthropic-ai/mcp-inspector

# Inspect a server
mcp-inspector ethereum-wallet-mcp
```

### Verify Tool Outputs

When testing manually, verify:

1. **Format** - Addresses are checksummed, hex values start with 0x
2. **Completeness** - All expected fields are present
3. **Correctness** - Values match when cross-verified with other tools
4. **Error handling** - Invalid inputs return helpful error messages

---

## Troubleshooting

### Common Issues

#### Tests Can't Import Modules

```bash
# Make sure the server is installed
pip install -e ./ethereum-wallet-mcp

# Verify installation
python -c "from ethereum_wallet_mcp.tools.wallet import generate_wallet_impl; print('OK')"
```

#### Async Tests Failing

```bash
# Make sure pytest-asyncio is installed
pip install pytest-asyncio

# Check pyproject.toml has the right config
[tool.pytest.ini_options]
asyncio_mode = "auto"
```

#### Import Errors with MCP SDK

```bash
# The MCP SDK changed. Make sure you're using the right import:
from mcp.server.fastmcp import FastMCP  # For FastMCP-based servers
from mcp.server import Server           # For standard Server

# Verify SDK version
pip show mcp
```

#### Cached Python Files

```bash
# Clear all __pycache__ directories
find . -type d -name '__pycache__' -exec rm -rf {} + 2>/dev/null

# Reinstall
pip install -e ./ethereum-wallet-mcp --force-reinstall
```

### Debugging Test Failures

```bash
# Run single failing test with max verbosity
pytest tests/test_signing.py::TestMessageSigning::test_sign_message -vvs

# Use pdb for debugging
pytest --pdb tests/test_failing.py

# Print local variables on failure
pytest --tb=long tests/test_failing.py
```

### Getting Help

1. Check the test file for expected behavior
2. Look at the implementation function for error cases
3. Compare with working tests in other servers
4. Check GitHub issues for similar problems

---

## Continuous Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
      
      - name: Install dependencies
        run: |
          pip install -e "./ethereum-wallet-mcp[dev]"
          pip install -e "./signing-mcp-server[dev]"
          pip install -e "./keystore-mcp-server[dev]"
          pip install -e "./transaction-mcp-server[dev]"
          pip install -e "./validation-mcp-server[dev]"
      
      - name: Run tests
        run: ./run_all_tests.sh
```

### Pre-commit Hooks

```yaml
# .pre-commit-config.yaml
repos:
  - repo: local
    hooks:
      - id: run-tests
        name: Run tests
        entry: ./run_all_tests.sh
        language: system
        pass_filenames: false
```

---

## Test Maintenance

### Adding New Tests

1. Create test file in `tests/` directory
2. Follow naming convention: `test_<feature>.py`
3. Test both success and error cases
4. Include known test vectors where possible
5. Run the full test suite to ensure no regressions

### Updating Test Vectors

When cryptographic implementations change:

1. Verify new vectors against reference implementations
2. Cross-check with ethers.js, web3.py, or official specs
3. Document the source of test vectors in comments
4. Update this guide if the vector format changes

### Performance Testing

```python
import time

def test_performance():
    """Ensure signing completes in reasonable time."""
    start = time.time()
    for _ in range(100):
        sign_message_impl("test", TEST_KEY)
    elapsed = time.time() - start
    
    assert elapsed < 5.0, f"100 signatures took {elapsed}s (should be < 5s)"
```
