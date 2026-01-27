#!/bin/bash
# Test script for all MCP servers

echo "======================================"
echo "Running all MCP server tests"
echo "======================================"

cd /workspaces/ethereum-wallet-toolkit

# Install all servers
pip install -e ethereum-wallet-mcp > /dev/null 2>&1
pip install -e signing-mcp-server > /dev/null 2>&1
pip install -e keystore-mcp-server > /dev/null 2>&1
pip install -e transaction-mcp-server > /dev/null 2>&1
pip install -e validation-mcp-server > /dev/null 2>&1

echo ""
echo "=== 1. ETHEREUM-WALLET-MCP TESTS ==="
python -m pytest ethereum-wallet-mcp/tests/ --tb=short

echo ""
echo "=== 2. SIGNING-MCP-SERVER TESTS ==="
python -m pytest signing-mcp-server/tests/ --tb=short

echo ""
echo "=== 3. KEYSTORE-MCP-SERVER TESTS ==="
python -m pytest keystore-mcp-server/tests/ --tb=short

echo ""
echo "=== 4. TRANSACTION-MCP-SERVER TESTS ==="
python -m pytest transaction-mcp-server/tests/ --tb=short

echo ""
echo "=== 5. VALIDATION-MCP-SERVER TESTS ==="
python -m pytest validation-mcp-server/tests/ --tb=short

echo ""
echo "======================================"
echo "All test suites complete"
echo "======================================"

