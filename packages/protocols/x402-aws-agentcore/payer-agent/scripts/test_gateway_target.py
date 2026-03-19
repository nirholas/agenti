#!/usr/bin/env python3
"""
Gateway Target Registration Test Script for x402 Payer Agent.

This script tests the AgentCore Gateway target configuration including:
1. OpenAPI specification validation
2. Gateway configuration parsing
3. Target URL connectivity
4. x402 header passthrough verification
5. MCP tool discovery simulation

Usage:
    # Run all tests
    python scripts/test_gateway_target.py
    
    # Run with verbose output
    python scripts/test_gateway_target.py --verbose
    
    # Test with specific CloudFront URL
    python scripts/test_gateway_target.py --cloudfront-url https://dXXX.cloudfront.net
    
    # Validate OpenAPI spec only
    python scripts/test_gateway_target.py --openapi-only
    
    # Test target connectivity only
    python scripts/test_gateway_target.py --connectivity-only
"""

import argparse
import json
import os
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional

import yaml

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))


@dataclass
class TestResult:
    """Result of a single test."""
    name: str
    passed: bool
    message: str = ""
    duration_ms: float = 0.0
    details: dict = field(default_factory=dict)


@dataclass
class TestSuite:
    """Collection of test results."""
    name: str
    results: list[TestResult] = field(default_factory=list)
    
    @property
    def passed(self) -> int:
        return sum(1 for r in self.results if r.passed)
    
    @property
    def failed(self) -> int:
        return sum(1 for r in self.results if not r.passed)
    
    @property
    def total(self) -> int:
        return len(self.results)
    
    @property
    def all_passed(self) -> bool:
        return self.failed == 0


def print_header(title: str) -> None:
    """Print a formatted header."""
    print(f"\n{'=' * 60}")
    print(f"  {title}")
    print(f"{'=' * 60}")


def print_result(result: TestResult, verbose: bool = False) -> None:
    """Print a test result."""
    status = "✅ PASS" if result.passed else "❌ FAIL"
    print(f"  {status} | {result.name}")
    if result.message:
        print(f"         {result.message}")
    if verbose and result.details:
        for key, value in result.details.items():
            if isinstance(value, dict):
                print(f"         {key}:")
                for k, v in value.items():
                    print(f"           {k}: {v}")
            else:
                print(f"         {key}: {value}")


# =============================================================================
# OpenAPI Specification Tests
# =============================================================================

def test_openapi_file_exists() -> TestResult:
    """Test that the OpenAPI specification file exists."""
    start = time.time()
    spec_path = Path("openapi/content-tools.yaml")
    
    if spec_path.exists():
        file_size = spec_path.stat().st_size
        return TestResult(
            name="OpenAPI spec file exists",
            passed=True,
            message=f"Found at {spec_path} ({file_size} bytes)",
            duration_ms=(time.time() - start) * 1000,
            details={"path": str(spec_path), "size_bytes": file_size},
        )
    else:
        return TestResult(
            name="OpenAPI spec file exists",
            passed=False,
            message=f"File not found: {spec_path}",
            duration_ms=(time.time() - start) * 1000,
        )


def test_openapi_valid_yaml() -> TestResult:
    """Test that the OpenAPI spec is valid YAML."""
    start = time.time()
    spec_path = Path("openapi/content-tools.yaml")
    
    try:
        with open(spec_path) as f:
            spec = yaml.safe_load(f)
        
        if not isinstance(spec, dict):
            return TestResult(
                name="OpenAPI spec valid YAML",
                passed=False,
                message="Spec is not a valid YAML dictionary",
                duration_ms=(time.time() - start) * 1000,
            )
        
        return TestResult(
            name="OpenAPI spec valid YAML",
            passed=True,
            message="Successfully parsed YAML",
            duration_ms=(time.time() - start) * 1000,
            details={"top_level_keys": list(spec.keys())},
        )
    except yaml.YAMLError as e:
        return TestResult(
            name="OpenAPI spec valid YAML",
            passed=False,
            message=f"YAML parse error: {e}",
            duration_ms=(time.time() - start) * 1000,
        )
    except FileNotFoundError:
        return TestResult(
            name="OpenAPI spec valid YAML",
            passed=False,
            message="File not found",
            duration_ms=(time.time() - start) * 1000,
        )


def test_openapi_version() -> TestResult:
    """Test that the OpenAPI spec has correct version."""
    start = time.time()
    spec_path = Path("openapi/content-tools.yaml")
    
    try:
        with open(spec_path) as f:
            spec = yaml.safe_load(f)
        
        openapi_version = spec.get("openapi", "")
        
        if openapi_version.startswith("3."):
            return TestResult(
                name="OpenAPI version 3.x",
                passed=True,
                message=f"Version: {openapi_version}",
                duration_ms=(time.time() - start) * 1000,
                details={"version": openapi_version},
            )
        else:
            return TestResult(
                name="OpenAPI version 3.x",
                passed=False,
                message=f"Expected 3.x, got: {openapi_version}",
                duration_ms=(time.time() - start) * 1000,
            )
    except Exception as e:
        return TestResult(
            name="OpenAPI version 3.x",
            passed=False,
            message=f"Error: {e}",
            duration_ms=(time.time() - start) * 1000,
        )


def test_openapi_required_fields() -> TestResult:
    """Test that the OpenAPI spec has all required fields."""
    start = time.time()
    spec_path = Path("openapi/content-tools.yaml")
    required_fields = ["openapi", "info", "paths"]
    
    try:
        with open(spec_path) as f:
            spec = yaml.safe_load(f)
        
        missing = [f for f in required_fields if f not in spec]
        
        if missing:
            return TestResult(
                name="OpenAPI required fields",
                passed=False,
                message=f"Missing fields: {missing}",
                duration_ms=(time.time() - start) * 1000,
            )
        
        # Check info section
        info = spec.get("info", {})
        info_required = ["title", "version"]
        info_missing = [f for f in info_required if f not in info]
        
        if info_missing:
            return TestResult(
                name="OpenAPI required fields",
                passed=False,
                message=f"Missing info fields: {info_missing}",
                duration_ms=(time.time() - start) * 1000,
            )
        
        return TestResult(
            name="OpenAPI required fields",
            passed=True,
            message=f"Title: {info.get('title')}, Version: {info.get('version')}",
            duration_ms=(time.time() - start) * 1000,
            details={
                "title": info.get("title"),
                "version": info.get("version"),
                "paths_count": len(spec.get("paths", {})),
            },
        )
    except Exception as e:
        return TestResult(
            name="OpenAPI required fields",
            passed=False,
            message=f"Error: {e}",
            duration_ms=(time.time() - start) * 1000,
        )


def test_openapi_operations() -> TestResult:
    """Test that all required operations are defined."""
    start = time.time()
    spec_path = Path("openapi/content-tools.yaml")
    required_operations = [
        "get_premium_article",
        "get_weather_data",
        "get_market_analysis",
        "get_research_report",
    ]
    
    try:
        with open(spec_path) as f:
            spec = yaml.safe_load(f)
        
        # Extract all operationIds from paths
        found_operations = []
        paths = spec.get("paths", {})
        
        for path, methods in paths.items():
            for method, operation in methods.items():
                if isinstance(operation, dict) and "operationId" in operation:
                    found_operations.append(operation["operationId"])
        
        missing = [op for op in required_operations if op not in found_operations]
        
        if missing:
            return TestResult(
                name="OpenAPI operations defined",
                passed=False,
                message=f"Missing operations: {missing}",
                duration_ms=(time.time() - start) * 1000,
                details={"found": found_operations, "missing": missing},
            )
        
        return TestResult(
            name="OpenAPI operations defined",
            passed=True,
            message=f"All {len(required_operations)} operations found",
            duration_ms=(time.time() - start) * 1000,
            details={"operations": found_operations},
        )
    except Exception as e:
        return TestResult(
            name="OpenAPI operations defined",
            passed=False,
            message=f"Error: {e}",
            duration_ms=(time.time() - start) * 1000,
        )


def test_openapi_x402_responses() -> TestResult:
    """Test that all operations have 402 response defined."""
    start = time.time()
    spec_path = Path("openapi/content-tools.yaml")
    
    try:
        with open(spec_path) as f:
            spec = yaml.safe_load(f)
        
        paths = spec.get("paths", {})
        operations_without_402 = []
        operations_with_402 = []
        
        for path, methods in paths.items():
            for method, operation in methods.items():
                if isinstance(operation, dict) and "operationId" in operation:
                    op_id = operation["operationId"]
                    responses = operation.get("responses", {})
                    
                    # Check for 402 response (direct or via $ref)
                    has_402 = "402" in responses or any(
                        "$ref" in str(v) and "402" in str(v)
                        for v in responses.values()
                    )
                    
                    if has_402:
                        operations_with_402.append(op_id)
                    else:
                        operations_without_402.append(op_id)
        
        if operations_without_402:
            return TestResult(
                name="OpenAPI 402 responses",
                passed=False,
                message=f"Missing 402 response: {operations_without_402}",
                duration_ms=(time.time() - start) * 1000,
            )
        
        return TestResult(
            name="OpenAPI 402 responses",
            passed=True,
            message=f"All {len(operations_with_402)} operations have 402 response",
            duration_ms=(time.time() - start) * 1000,
            details={"operations": operations_with_402},
        )
    except Exception as e:
        return TestResult(
            name="OpenAPI 402 responses",
            passed=False,
            message=f"Error: {e}",
            duration_ms=(time.time() - start) * 1000,
        )


def test_openapi_mcp_extensions() -> TestResult:
    """Test that operations have x-mcp-tool extensions."""
    start = time.time()
    spec_path = Path("openapi/content-tools.yaml")
    
    try:
        with open(spec_path) as f:
            spec = yaml.safe_load(f)
        
        paths = spec.get("paths", {})
        operations_with_mcp = []
        operations_without_mcp = []
        
        for path, methods in paths.items():
            for method, operation in methods.items():
                if isinstance(operation, dict) and "operationId" in operation:
                    op_id = operation["operationId"]
                    
                    if "x-mcp-tool" in operation:
                        mcp_tool = operation["x-mcp-tool"]
                        operations_with_mcp.append({
                            "operation_id": op_id,
                            "tool_name": mcp_tool.get("name"),
                            "category": mcp_tool.get("category"),
                            "requires_payment": mcp_tool.get("requires_payment"),
                        })
                    else:
                        operations_without_mcp.append(op_id)
        
        if operations_without_mcp:
            return TestResult(
                name="OpenAPI MCP extensions",
                passed=False,
                message=f"Missing x-mcp-tool: {operations_without_mcp}",
                duration_ms=(time.time() - start) * 1000,
            )
        
        return TestResult(
            name="OpenAPI MCP extensions",
            passed=True,
            message=f"All {len(operations_with_mcp)} operations have MCP extensions",
            duration_ms=(time.time() - start) * 1000,
            details={"mcp_tools": operations_with_mcp},
        )
    except Exception as e:
        return TestResult(
            name="OpenAPI MCP extensions",
            passed=False,
            message=f"Error: {e}",
            duration_ms=(time.time() - start) * 1000,
        )


# =============================================================================
# Gateway Configuration Tests
# =============================================================================

def test_gateway_config_exists() -> TestResult:
    """Test that the Gateway configuration file exists."""
    start = time.time()
    config_path = Path("gateway_config.yaml")
    
    if config_path.exists():
        file_size = config_path.stat().st_size
        return TestResult(
            name="Gateway config file exists",
            passed=True,
            message=f"Found at {config_path} ({file_size} bytes)",
            duration_ms=(time.time() - start) * 1000,
            details={"path": str(config_path), "size_bytes": file_size},
        )
    else:
        return TestResult(
            name="Gateway config file exists",
            passed=False,
            message=f"File not found: {config_path}",
            duration_ms=(time.time() - start) * 1000,
        )


def test_gateway_config_valid_yaml() -> TestResult:
    """Test that the Gateway config is valid YAML."""
    start = time.time()
    config_path = Path("gateway_config.yaml")
    
    try:
        with open(config_path) as f:
            config = yaml.safe_load(f)
        
        if not isinstance(config, dict):
            return TestResult(
                name="Gateway config valid YAML",
                passed=False,
                message="Config is not a valid YAML dictionary",
                duration_ms=(time.time() - start) * 1000,
            )
        
        return TestResult(
            name="Gateway config valid YAML",
            passed=True,
            message="Successfully parsed YAML",
            duration_ms=(time.time() - start) * 1000,
            details={"top_level_keys": list(config.keys())},
        )
    except yaml.YAMLError as e:
        return TestResult(
            name="Gateway config valid YAML",
            passed=False,
            message=f"YAML parse error: {e}",
            duration_ms=(time.time() - start) * 1000,
        )
    except FileNotFoundError:
        return TestResult(
            name="Gateway config valid YAML",
            passed=False,
            message="File not found",
            duration_ms=(time.time() - start) * 1000,
        )


def test_gateway_targets_defined() -> TestResult:
    """Test that Gateway targets are defined."""
    start = time.time()
    config_path = Path("gateway_config.yaml")
    
    try:
        with open(config_path) as f:
            config = yaml.safe_load(f)
        
        gateway = config.get("gateway", {})
        targets = gateway.get("targets", {})
        
        if not targets:
            return TestResult(
                name="Gateway targets defined",
                passed=False,
                message="No targets defined in gateway config",
                duration_ms=(time.time() - start) * 1000,
            )
        
        target_names = list(targets.keys())
        
        return TestResult(
            name="Gateway targets defined",
            passed=True,
            message=f"Found {len(target_names)} target(s): {target_names}",
            duration_ms=(time.time() - start) * 1000,
            details={"targets": target_names},
        )
    except Exception as e:
        return TestResult(
            name="Gateway targets defined",
            passed=False,
            message=f"Error: {e}",
            duration_ms=(time.time() - start) * 1000,
        )


def test_gateway_content_tools_target() -> TestResult:
    """Test that content_tools target is properly configured."""
    start = time.time()
    config_path = Path("gateway_config.yaml")
    
    try:
        with open(config_path) as f:
            config = yaml.safe_load(f)
        
        gateway = config.get("gateway", {})
        targets = gateway.get("targets", {})
        content_tools = targets.get("content_tools", {})
        
        if not content_tools:
            return TestResult(
                name="Content tools target configured",
                passed=False,
                message="content_tools target not found",
                duration_ms=(time.time() - start) * 1000,
            )
        
        # Check required fields
        required_fields = ["name", "type", "target_url", "authentication"]
        missing = [f for f in required_fields if f not in content_tools]
        
        if missing:
            return TestResult(
                name="Content tools target configured",
                passed=False,
                message=f"Missing fields: {missing}",
                duration_ms=(time.time() - start) * 1000,
            )
        
        # Check type is OPENAPI
        target_type = content_tools.get("type")
        if target_type != "OPENAPI":
            return TestResult(
                name="Content tools target configured",
                passed=False,
                message=f"Expected type OPENAPI, got: {target_type}",
                duration_ms=(time.time() - start) * 1000,
            )
        
        return TestResult(
            name="Content tools target configured",
            passed=True,
            message=f"Target '{content_tools.get('name')}' properly configured",
            duration_ms=(time.time() - start) * 1000,
            details={
                "name": content_tools.get("name"),
                "type": target_type,
                "target_url": content_tools.get("target_url"),
            },
        )
    except Exception as e:
        return TestResult(
            name="Content tools target configured",
            passed=False,
            message=f"Error: {e}",
            duration_ms=(time.time() - start) * 1000,
        )


def test_gateway_x402_headers_passthrough() -> TestResult:
    """Test that x402 headers are configured for passthrough."""
    start = time.time()
    config_path = Path("gateway_config.yaml")
    
    try:
        with open(config_path) as f:
            config = yaml.safe_load(f)
        
        gateway = config.get("gateway", {})
        targets = gateway.get("targets", {})
        content_tools = targets.get("content_tools", {})
        auth = content_tools.get("authentication", {})
        
        # Check authentication type
        auth_type = auth.get("type")
        if auth_type != "PASSTHROUGH":
            return TestResult(
                name="x402 headers passthrough",
                passed=False,
                message=f"Expected auth type PASSTHROUGH, got: {auth_type}",
                duration_ms=(time.time() - start) * 1000,
            )
        
        # Check request headers passthrough
        request_headers = auth.get("passthrough_request_headers", [])
        request_header_names = [h.get("name") for h in request_headers]
        
        required_request_headers = ["X-PAYMENT-SIGNATURE"]
        missing_request = [h for h in required_request_headers if h not in request_header_names]
        
        # Check response headers passthrough
        response_headers = auth.get("passthrough_response_headers", [])
        response_header_names = [h.get("name") for h in response_headers]
        
        required_response_headers = ["X-PAYMENT-REQUIRED", "X-PAYMENT-RESPONSE"]
        missing_response = [h for h in required_response_headers if h not in response_header_names]
        
        if missing_request or missing_response:
            return TestResult(
                name="x402 headers passthrough",
                passed=False,
                message=f"Missing headers - request: {missing_request}, response: {missing_response}",
                duration_ms=(time.time() - start) * 1000,
            )
        
        return TestResult(
            name="x402 headers passthrough",
            passed=True,
            message="All x402 headers configured for passthrough",
            duration_ms=(time.time() - start) * 1000,
            details={
                "request_headers": request_header_names,
                "response_headers": response_header_names,
            },
        )
    except Exception as e:
        return TestResult(
            name="x402 headers passthrough",
            passed=False,
            message=f"Error: {e}",
            duration_ms=(time.time() - start) * 1000,
        )


def test_gateway_mcp_operations() -> TestResult:
    """Test that MCP operations are defined in gateway config."""
    start = time.time()
    config_path = Path("gateway_config.yaml")
    
    try:
        with open(config_path) as f:
            config = yaml.safe_load(f)
        
        gateway = config.get("gateway", {})
        targets = gateway.get("targets", {})
        content_tools = targets.get("content_tools", {})
        openapi = content_tools.get("openapi", {})
        operations = openapi.get("operations", [])
        
        if not operations:
            return TestResult(
                name="Gateway MCP operations",
                passed=False,
                message="No operations defined in gateway config",
                duration_ms=(time.time() - start) * 1000,
            )
        
        required_ops = [
            "get_premium_article",
            "get_weather_data",
            "get_market_analysis",
            "get_research_report",
        ]
        
        found_ops = [op.get("operation_id") for op in operations]
        missing = [op for op in required_ops if op not in found_ops]
        
        if missing:
            return TestResult(
                name="Gateway MCP operations",
                passed=False,
                message=f"Missing operations: {missing}",
                duration_ms=(time.time() - start) * 1000,
            )
        
        # Extract operation details
        op_details = []
        for op in operations:
            op_details.append({
                "operation_id": op.get("operation_id"),
                "tool_name": op.get("tool_name"),
                "requires_payment": op.get("mcp_metadata", {}).get("requires_payment"),
            })
        
        return TestResult(
            name="Gateway MCP operations",
            passed=True,
            message=f"All {len(required_ops)} operations defined",
            duration_ms=(time.time() - start) * 1000,
            details={"operations": op_details},
        )
    except Exception as e:
        return TestResult(
            name="Gateway MCP operations",
            passed=False,
            message=f"Error: {e}",
            duration_ms=(time.time() - start) * 1000,
        )


def test_gateway_x402_metadata() -> TestResult:
    """Test that x402 payment metadata is defined for operations."""
    start = time.time()
    config_path = Path("gateway_config.yaml")
    
    try:
        with open(config_path) as f:
            config = yaml.safe_load(f)
        
        gateway = config.get("gateway", {})
        targets = gateway.get("targets", {})
        content_tools = targets.get("content_tools", {})
        openapi = content_tools.get("openapi", {})
        operations = openapi.get("operations", [])
        
        ops_with_x402 = []
        ops_without_x402 = []
        
        for op in operations:
            op_id = op.get("operation_id")
            x402_meta = op.get("x402_metadata", {})
            
            if x402_meta:
                # Validate required x402 fields
                required_x402 = ["price_usdc_units", "network", "scheme", "asset_address"]
                missing = [f for f in required_x402 if f not in x402_meta]
                
                if missing:
                    ops_without_x402.append(f"{op_id} (missing: {missing})")
                else:
                    ops_with_x402.append({
                        "operation_id": op_id,
                        "price": x402_meta.get("price_usdc_display"),
                        "network": x402_meta.get("network_name"),
                    })
            else:
                ops_without_x402.append(op_id)
        
        if ops_without_x402:
            return TestResult(
                name="Gateway x402 metadata",
                passed=False,
                message=f"Missing/incomplete x402 metadata: {ops_without_x402}",
                duration_ms=(time.time() - start) * 1000,
            )
        
        return TestResult(
            name="Gateway x402 metadata",
            passed=True,
            message=f"All {len(ops_with_x402)} operations have x402 metadata",
            duration_ms=(time.time() - start) * 1000,
            details={"operations": ops_with_x402},
        )
    except Exception as e:
        return TestResult(
            name="Gateway x402 metadata",
            passed=False,
            message=f"Error: {e}",
            duration_ms=(time.time() - start) * 1000,
        )


# =============================================================================
# Target Connectivity Tests
# =============================================================================

def test_cloudfront_url_configured(cloudfront_url: Optional[str] = None) -> TestResult:
    """Test that CloudFront URL is configured or provided."""
    start = time.time()
    
    # Check environment variable first
    env_url = os.environ.get("X402_SELLER_CLOUDFRONT_URL")
    
    if cloudfront_url:
        url = cloudfront_url
        source = "command line"
    elif env_url:
        url = env_url
        source = "environment variable"
    else:
        return TestResult(
            name="CloudFront URL configured",
            passed=False,
            message="No CloudFront URL provided. Set X402_SELLER_CLOUDFRONT_URL or use --cloudfront-url",
            duration_ms=(time.time() - start) * 1000,
        )
    
    # Validate URL format
    if not url.startswith("https://"):
        return TestResult(
            name="CloudFront URL configured",
            passed=False,
            message=f"URL must start with https://: {url}",
            duration_ms=(time.time() - start) * 1000,
        )
    
    return TestResult(
        name="CloudFront URL configured",
        passed=True,
        message=f"URL from {source}: {url[:50]}...",
        duration_ms=(time.time() - start) * 1000,
        details={"url": url, "source": source},
    )


def test_cloudfront_connectivity(cloudfront_url: Optional[str] = None) -> TestResult:
    """Test connectivity to CloudFront distribution."""
    start = time.time()
    
    url = cloudfront_url or os.environ.get("X402_SELLER_CLOUDFRONT_URL")
    
    if not url:
        return TestResult(
            name="CloudFront connectivity",
            passed=False,
            message="No CloudFront URL available",
            duration_ms=(time.time() - start) * 1000,
        )
    
    try:
        import httpx
        
        # Use OPTIONS request (doesn't require payment)
        test_url = f"{url.rstrip('/')}/api/premium-article"
        
        with httpx.Client(timeout=10.0) as client:
            response = client.options(test_url)
        
        # OPTIONS should return 200 or 204
        if response.status_code in [200, 204]:
            return TestResult(
                name="CloudFront connectivity",
                passed=True,
                message=f"OPTIONS request successful (status: {response.status_code})",
                duration_ms=(time.time() - start) * 1000,
                details={
                    "url": test_url,
                    "status_code": response.status_code,
                    "headers": dict(response.headers),
                },
            )
        else:
            return TestResult(
                name="CloudFront connectivity",
                passed=False,
                message=f"Unexpected status code: {response.status_code}",
                duration_ms=(time.time() - start) * 1000,
                details={"status_code": response.status_code},
            )
    except httpx.ConnectError as e:
        return TestResult(
            name="CloudFront connectivity",
            passed=False,
            message=f"Connection failed: {e}",
            duration_ms=(time.time() - start) * 1000,
        )
    except Exception as e:
        return TestResult(
            name="CloudFront connectivity",
            passed=False,
            message=f"Error: {e}",
            duration_ms=(time.time() - start) * 1000,
        )


def test_cloudfront_402_response(cloudfront_url: Optional[str] = None) -> TestResult:
    """Test that CloudFront returns 402 for unauthenticated requests."""
    start = time.time()
    
    url = cloudfront_url or os.environ.get("X402_SELLER_CLOUDFRONT_URL")
    
    if not url:
        return TestResult(
            name="CloudFront 402 response",
            passed=False,
            message="No CloudFront URL available",
            duration_ms=(time.time() - start) * 1000,
        )
    
    try:
        import httpx
        
        test_url = f"{url.rstrip('/')}/api/premium-article"
        
        with httpx.Client(timeout=10.0) as client:
            response = client.get(test_url)
        
        if response.status_code == 402:
            # Check for x402 headers
            has_payment_required = (
                "X-PAYMENT-REQUIRED" in response.headers or
                "x-payment-required" in response.headers
            )
            
            return TestResult(
                name="CloudFront 402 response",
                passed=True,
                message=f"402 Payment Required received (x402 header: {has_payment_required})",
                duration_ms=(time.time() - start) * 1000,
                details={
                    "status_code": response.status_code,
                    "has_x402_header": has_payment_required,
                    "content_type": response.headers.get("content-type"),
                },
            )
        else:
            return TestResult(
                name="CloudFront 402 response",
                passed=False,
                message=f"Expected 402, got: {response.status_code}",
                duration_ms=(time.time() - start) * 1000,
                details={"status_code": response.status_code},
            )
    except Exception as e:
        return TestResult(
            name="CloudFront 402 response",
            passed=False,
            message=f"Error: {e}",
            duration_ms=(time.time() - start) * 1000,
        )


def test_cloudfront_x402_headers(cloudfront_url: Optional[str] = None) -> TestResult:
    """Test that CloudFront returns proper x402 headers."""
    start = time.time()
    
    url = cloudfront_url or os.environ.get("X402_SELLER_CLOUDFRONT_URL")
    
    if not url:
        return TestResult(
            name="CloudFront x402 headers",
            passed=False,
            message="No CloudFront URL available",
            duration_ms=(time.time() - start) * 1000,
        )
    
    try:
        import httpx
        import base64
        
        test_url = f"{url.rstrip('/')}/api/premium-article"
        
        with httpx.Client(timeout=10.0) as client:
            response = client.get(test_url)
        
        if response.status_code != 402:
            return TestResult(
                name="CloudFront x402 headers",
                passed=False,
                message=f"Expected 402, got: {response.status_code}",
                duration_ms=(time.time() - start) * 1000,
            )
        
        # Check for X-PAYMENT-REQUIRED header
        payment_required_header = (
            response.headers.get("X-PAYMENT-REQUIRED") or
            response.headers.get("x-payment-required")
        )
        
        if not payment_required_header:
            return TestResult(
                name="CloudFront x402 headers",
                passed=False,
                message="X-PAYMENT-REQUIRED header not found",
                duration_ms=(time.time() - start) * 1000,
            )
        
        # Try to decode the header
        try:
            decoded = base64.b64decode(payment_required_header)
            payment_data = json.loads(decoded)
            
            # Validate x402 v2 structure
            x402_version = payment_data.get("x402Version")
            accepts = payment_data.get("accepts", [])
            
            return TestResult(
                name="CloudFront x402 headers",
                passed=True,
                message=f"Valid x402 v{x402_version} header with {len(accepts)} payment option(s)",
                duration_ms=(time.time() - start) * 1000,
                details={
                    "x402_version": x402_version,
                    "accepts_count": len(accepts),
                    "first_accept": accepts[0] if accepts else None,
                },
            )
        except Exception as decode_error:
            return TestResult(
                name="CloudFront x402 headers",
                passed=False,
                message=f"Failed to decode X-PAYMENT-REQUIRED: {decode_error}",
                duration_ms=(time.time() - start) * 1000,
            )
    except Exception as e:
        return TestResult(
            name="CloudFront x402 headers",
            passed=False,
            message=f"Error: {e}",
            duration_ms=(time.time() - start) * 1000,
        )


# =============================================================================
# AWS SDK Tests
# =============================================================================

def test_boto3_available() -> TestResult:
    """Test that boto3 is available."""
    start = time.time()
    try:
        import boto3
        return TestResult(
            name="boto3 available",
            passed=True,
            message=f"boto3 version: {boto3.__version__}",
            duration_ms=(time.time() - start) * 1000,
        )
    except ImportError as e:
        return TestResult(
            name="boto3 available",
            passed=False,
            message=f"Failed to import boto3: {e}",
            duration_ms=(time.time() - start) * 1000,
        )


def test_aws_credentials() -> TestResult:
    """Test that AWS credentials are available."""
    start = time.time()
    try:
        import boto3
        sts = boto3.client("sts")
        identity = sts.get_caller_identity()
        
        return TestResult(
            name="AWS credentials valid",
            passed=True,
            message=f"Account: {identity['Account']}",
            duration_ms=(time.time() - start) * 1000,
            details={
                "account": identity["Account"],
                "arn": identity["Arn"],
            },
        )
    except Exception as e:
        return TestResult(
            name="AWS credentials valid",
            passed=False,
            message=f"Failed: {e}",
            duration_ms=(time.time() - start) * 1000,
        )


def test_bedrock_client() -> TestResult:
    """Test that Bedrock Agent Runtime client can be created."""
    start = time.time()
    try:
        import boto3
        from botocore.config import Config
        
        config = Config(
            region_name="us-west-2",
            retries={"max_attempts": 3, "mode": "adaptive"},
        )
        
        client = boto3.client("bedrock-agent-runtime", config=config)
        
        if hasattr(client, "invoke_agent"):
            return TestResult(
                name="Bedrock client creation",
                passed=True,
                message="Client created with invoke_agent method",
                duration_ms=(time.time() - start) * 1000,
            )
        else:
            return TestResult(
                name="Bedrock client creation",
                passed=False,
                message="Client missing invoke_agent method",
                duration_ms=(time.time() - start) * 1000,
            )
    except Exception as e:
        return TestResult(
            name="Bedrock client creation",
            passed=False,
            message=f"Failed: {e}",
            duration_ms=(time.time() - start) * 1000,
        )


# =============================================================================
# Test Suites
# =============================================================================

def run_openapi_tests(verbose: bool = False) -> TestSuite:
    """Run OpenAPI specification tests."""
    suite = TestSuite(name="OpenAPI Specification Tests")
    
    print_header("OpenAPI Specification Tests")
    
    tests = [
        test_openapi_file_exists,
        test_openapi_valid_yaml,
        test_openapi_version,
        test_openapi_required_fields,
        test_openapi_operations,
        test_openapi_x402_responses,
        test_openapi_mcp_extensions,
    ]
    
    for test_fn in tests:
        result = test_fn()
        suite.results.append(result)
        print_result(result, verbose)
    
    return suite


def run_gateway_config_tests(verbose: bool = False) -> TestSuite:
    """Run Gateway configuration tests."""
    suite = TestSuite(name="Gateway Configuration Tests")
    
    print_header("Gateway Configuration Tests")
    
    tests = [
        test_gateway_config_exists,
        test_gateway_config_valid_yaml,
        test_gateway_targets_defined,
        test_gateway_content_tools_target,
        test_gateway_x402_headers_passthrough,
        test_gateway_mcp_operations,
        test_gateway_x402_metadata,
    ]
    
    for test_fn in tests:
        result = test_fn()
        suite.results.append(result)
        print_result(result, verbose)
    
    return suite


def run_connectivity_tests(
    cloudfront_url: Optional[str] = None,
    verbose: bool = False,
) -> TestSuite:
    """Run target connectivity tests."""
    suite = TestSuite(name="Target Connectivity Tests")
    
    print_header("Target Connectivity Tests")
    
    # URL configuration test
    result = test_cloudfront_url_configured(cloudfront_url)
    suite.results.append(result)
    print_result(result, verbose)
    
    # Only run connectivity tests if URL is available
    if result.passed:
        url = cloudfront_url or os.environ.get("X402_SELLER_CLOUDFRONT_URL")
        
        tests = [
            lambda: test_cloudfront_connectivity(url),
            lambda: test_cloudfront_402_response(url),
            lambda: test_cloudfront_x402_headers(url),
        ]
        
        for test_fn in tests:
            result = test_fn()
            suite.results.append(result)
            print_result(result, verbose)
    else:
        print("  ⏭️  Skipping connectivity tests (no URL available)")
    
    return suite


def run_aws_sdk_tests(verbose: bool = False) -> TestSuite:
    """Run AWS SDK tests."""
    suite = TestSuite(name="AWS SDK Tests")
    
    print_header("AWS SDK Tests")
    
    tests = [
        test_boto3_available,
        test_aws_credentials,
        test_bedrock_client,
    ]
    
    for test_fn in tests:
        result = test_fn()
        suite.results.append(result)
        print_result(result, verbose)
    
    return suite


def print_summary(suites: list[TestSuite]) -> None:
    """Print test summary."""
    print_header("Test Summary")
    
    total_passed = sum(s.passed for s in suites)
    total_failed = sum(s.failed for s in suites)
    total_tests = sum(s.total for s in suites)
    
    for suite in suites:
        status = "✅" if suite.all_passed else "❌"
        print(f"  {status} {suite.name}: {suite.passed}/{suite.total} passed")
    
    print(f"\n  Total: {total_passed}/{total_tests} passed, {total_failed} failed")
    
    if total_failed == 0:
        print("\n  🎉 All tests passed!")
    else:
        print(f"\n  ⚠️  {total_failed} test(s) failed")


def main():
    parser = argparse.ArgumentParser(
        description="Test AgentCore Gateway target registration"
    )
    parser.add_argument(
        "--cloudfront-url",
        help="CloudFront distribution URL for connectivity tests",
    )
    parser.add_argument(
        "--verbose", "-v",
        action="store_true",
        help="Show detailed test output",
    )
    parser.add_argument(
        "--openapi-only",
        action="store_true",
        help="Run only OpenAPI specification tests",
    )
    parser.add_argument(
        "--connectivity-only",
        action="store_true",
        help="Run only connectivity tests",
    )
    parser.add_argument(
        "--skip-connectivity",
        action="store_true",
        help="Skip connectivity tests (useful when CloudFront not deployed)",
    )
    
    args = parser.parse_args()
    
    print("\n🎯 x402 Payer Agent - Gateway Target Registration Tests")
    print("=" * 60)
    
    # Change to payer-agent directory
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    os.chdir(project_root)
    
    suites = []
    
    if args.openapi_only:
        suites.append(run_openapi_tests(args.verbose))
    elif args.connectivity_only:
        suites.append(run_connectivity_tests(args.cloudfront_url, args.verbose))
    else:
        # Run all test suites
        suites.append(run_openapi_tests(args.verbose))
        suites.append(run_gateway_config_tests(args.verbose))
        suites.append(run_aws_sdk_tests(args.verbose))
        
        if not args.skip_connectivity:
            suites.append(run_connectivity_tests(args.cloudfront_url, args.verbose))
    
    # Print summary
    print_summary(suites)
    
    # Exit with appropriate code
    total_failed = sum(s.failed for s in suites)
    sys.exit(0 if total_failed == 0 else 1)


if __name__ == "__main__":
    main()
