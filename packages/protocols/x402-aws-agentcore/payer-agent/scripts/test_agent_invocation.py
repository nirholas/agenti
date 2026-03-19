#!/usr/bin/env python3
"""
Test script for invoking the x402 payer agent.

This script can test the agent both locally and via AgentCore Runtime.

Usage:
    # Test locally with a simple message
    python scripts/test_agent_invocation.py --local --message "Check my wallet balance"
    
    # Run predefined test scenarios locally
    python scripts/test_agent_invocation.py --local --run-scenarios
    
    # Test via AgentCore Runtime (requires deployed runtime)
    python scripts/test_agent_invocation.py --runtime-arn <RUNTIME_ARN>
    
    # Test via AgentCore Runtime with scenarios
    python scripts/test_agent_invocation.py --runtime-arn <RUNTIME_ARN> --run-scenarios
"""

import argparse
import asyncio
import json
import os
import sys
import time
import uuid
from dataclasses import dataclass
from pathlib import Path
from typing import Optional

# Add parent directory to path for local imports
sys.path.insert(0, str(Path(__file__).parent.parent))


@dataclass
class TestResult:
    """Result of a test invocation."""
    success: bool
    scenario_name: str
    mode: str
    response: Optional[str] = None
    error: Optional[str] = None
    duration_ms: Optional[float] = None
    session_id: Optional[str] = None


def print_header(title: str, char: str = "=") -> None:
    """Print a formatted header."""
    print(f"\n{char * 60}")
    print(f" {title}")
    print(f"{char * 60}")


def print_result(result: TestResult) -> None:
    """Print a test result in a formatted way."""
    status = "✓ PASS" if result.success else "✗ FAIL"
    print(f"\n{status}: {result.scenario_name}")
    print(f"  Mode: {result.mode}")
    if result.duration_ms:
        print(f"  Duration: {result.duration_ms:.0f}ms")
    if result.session_id:
        print(f"  Session ID: {result.session_id}")
    if result.error:
        print(f"  Error: {result.error}")
    if result.response and result.success:
        # Truncate long responses
        response_preview = result.response[:500]
        if len(result.response) > 500:
            response_preview += "..."
        print(f"  Response: {response_preview}")


async def test_local_agent(message: str, scenario_name: str = "Custom") -> TestResult:
    """Test the agent locally without AgentCore."""
    print_header(f"Local Test: {scenario_name}", "-")
    print(f"Message: {message}")
    
    start_time = time.time()
    
    try:
        from agent.main import create_payer_agent
        
        agent = create_payer_agent()
        # Strands Agent is callable directly (not async)
        response = agent(message)
        
        duration_ms = (time.time() - start_time) * 1000
        
        return TestResult(
            success=True,
            scenario_name=scenario_name,
            mode="local",
            response=str(response),
            duration_ms=duration_ms,
        )
        
    except ImportError as e:
        return TestResult(
            success=False,
            scenario_name=scenario_name,
            mode="local",
            error=f"Could not import agent module: {e}. Run: pip install -e .",
        )
    except Exception as e:
        duration_ms = (time.time() - start_time) * 1000
        return TestResult(
            success=False,
            scenario_name=scenario_name,
            mode="local",
            error=str(e),
            duration_ms=duration_ms,
        )


async def test_agentcore_runtime(
    runtime_arn: str,
    message: str,
    region: str,
    scenario_name: str = "Custom",
    session_id: Optional[str] = None,
) -> TestResult:
    """Test the agent via AgentCore Runtime."""
    print_header(f"AgentCore Test: {scenario_name}", "-")
    print(f"Runtime ARN: {runtime_arn}")
    print(f"Message: {message}")
    
    start_time = time.time()
    session_id = session_id or f"test-session-{uuid.uuid4().hex}"
    
    try:
        from agent.runtime_client import RuntimeClient
        
        # Create AgentCore Runtime client using our runtime_client module
        client = RuntimeClient(
            agent_runtime_arn=runtime_arn,
            region=region,
        )
        
        # Invoke the agent
        response = client.invoke(
            prompt=message,
            session_id=session_id,
        )
        
        duration_ms = (time.time() - start_time) * 1000
        
        if response.success:
            return TestResult(
                success=True,
                scenario_name=scenario_name,
                mode="agentcore",
                response=response.completion,
                duration_ms=duration_ms,
                session_id=session_id,
            )
        else:
            return TestResult(
                success=False,
                scenario_name=scenario_name,
                mode="agentcore",
                error=response.error,
                duration_ms=duration_ms,
                session_id=session_id,
            )
        
    except ImportError as e:
        return TestResult(
            success=False,
            scenario_name=scenario_name,
            mode="agentcore",
            error=f"Could not import runtime_client: {e}",
        )
    except Exception as e:
        duration_ms = (time.time() - start_time) * 1000
        error_msg = str(e)
        
        # Provide helpful error messages
        if "ResourceNotFoundException" in error_msg:
            error_msg = (
                f"Runtime not found: {runtime_arn}. "
                "Verify the runtime ARN and ensure it's deployed."
            )
        elif "AccessDeniedException" in error_msg:
            error_msg = (
                "Access denied. Check IAM permissions for bedrock-agentcore:InvokeAgentRuntime."
            )
        
        return TestResult(
            success=False,
            scenario_name=scenario_name,
            mode="agentcore",
            error=error_msg,
            duration_ms=duration_ms,
            session_id=session_id,
        )


def get_test_scenarios() -> list[dict]:
    """Get predefined test scenarios for the payer agent."""
    return [
        {
            "name": "Wallet Balance Check",
            "message": "What is my current wallet balance?",
            "description": "Tests the get_wallet_balance tool",
            "expected_tools": ["get_wallet_balance"],
        },
        {
            "name": "Agent Capabilities",
            "message": "What can you help me with? List your capabilities.",
            "description": "Tests agent understanding of its role",
            "expected_tools": [],
        },
        {
            "name": "Payment Analysis - Approve",
            "message": (
                "Should I pay 0.001 ETH to 0x1234567890123456789012345678901234567890 "
                "for a premium article? My balance is 0.1 ETH."
            ),
            "description": "Tests payment analysis with valid parameters",
            "expected_tools": ["analyze_payment"],
        },
        {
            "name": "Payment Analysis - Reject High Amount",
            "message": (
                "Should I pay 0.5 ETH to 0x1234567890123456789012345678901234567890 "
                "for a premium article? My balance is 1.0 ETH."
            ),
            "description": "Tests payment rejection for high amounts",
            "expected_tools": ["analyze_payment"],
        },
        {
            "name": "Payment Analysis - Reject Insufficient Balance",
            "message": (
                "Should I pay 0.1 ETH to 0x1234567890123456789012345678901234567890 "
                "for content? My balance is 0.05 ETH."
            ),
            "description": "Tests payment rejection for insufficient balance",
            "expected_tools": ["analyze_payment"],
        },
        {
            "name": "Faucet Eligibility Check",
            "message": "Am I eligible to get test tokens from the faucet?",
            "description": "Tests faucet eligibility checking",
            "expected_tools": ["check_faucet_eligibility"],
        },
    ]


async def run_test_scenarios(
    test_func,
    scenarios: list[dict],
    **kwargs,
) -> list[TestResult]:
    """Run a series of test scenarios."""
    results = []
    
    for i, scenario in enumerate(scenarios, 1):
        print(f"\n{'#' * 60}")
        print(f"# Scenario {i}/{len(scenarios)}: {scenario['name']}")
        print(f"# {scenario.get('description', '')}")
        print(f"{'#' * 60}")
        
        result = await test_func(
            message=scenario["message"],
            scenario_name=scenario["name"],
            **kwargs,
        )
        results.append(result)
        print_result(result)
        
        # Small delay between tests to avoid rate limiting
        if i < len(scenarios):
            await asyncio.sleep(1)
    
    return results


def print_summary(results: list[TestResult]) -> None:
    """Print a summary of all test results."""
    print_header("TEST SUMMARY")
    
    passed = sum(1 for r in results if r.success)
    failed = len(results) - passed
    
    print(f"\nTotal: {len(results)} | Passed: {passed} | Failed: {failed}")
    print("-" * 40)
    
    for result in results:
        status = "✓" if result.success else "✗"
        duration = f"{result.duration_ms:.0f}ms" if result.duration_ms else "N/A"
        print(f"  {status} {result.scenario_name} ({duration})")
    
    if failed > 0:
        print("\nFailed tests:")
        for result in results:
            if not result.success:
                print(f"  - {result.scenario_name}: {result.error}")
    
    print()
    return passed == len(results)


def main():
    parser = argparse.ArgumentParser(
        description="Test x402 payer agent invocation",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Test locally with a custom message
  python scripts/test_agent_invocation.py --local --message "Check my wallet balance"
  
  # Run all test scenarios locally
  python scripts/test_agent_invocation.py --local --run-scenarios
  
  # Test via AgentCore Runtime
  python scripts/test_agent_invocation.py --runtime-arn arn:aws:bedrock:us-west-2:123456789:agent-runtime/xyz
  
  # Run scenarios via AgentCore
  python scripts/test_agent_invocation.py --runtime-arn <ARN> --run-scenarios
        """,
    )
    
    mode_group = parser.add_mutually_exclusive_group(required=True)
    mode_group.add_argument(
        "--local",
        action="store_true",
        help="Test the agent locally (no AgentCore deployment required)",
    )
    mode_group.add_argument(
        "--runtime-arn",
        help="AgentCore Runtime ARN for remote testing",
    )
    
    parser.add_argument(
        "--message",
        help="Custom message to send to the agent",
    )
    parser.add_argument(
        "--region",
        default=os.environ.get("AWS_REGION", "us-west-2"),
        help="AWS region (default: us-west-2)",
    )
    parser.add_argument(
        "--run-scenarios",
        action="store_true",
        help="Run predefined test scenarios",
    )
    parser.add_argument(
        "--session-id",
        help="Session ID for AgentCore (auto-generated if not provided)",
    )
    parser.add_argument(
        "--output-json",
        help="Output results to JSON file",
    )
    
    args = parser.parse_args()
    
    # Change to project root
    project_root = Path(__file__).parent.parent
    os.chdir(project_root)
    
    # Load environment variables
    try:
        from dotenv import load_dotenv
        load_dotenv()
    except ImportError:
        pass  # dotenv is optional
    
    print_header("x402 Payer Agent - Invocation Test")
    print(f"Mode: {'Local' if args.local else 'AgentCore Runtime'}")
    print(f"Region: {args.region}")
    
    results = []
    
    if args.run_scenarios:
        scenarios = get_test_scenarios()
        print(f"Running {len(scenarios)} test scenarios...")
        
        if args.local:
            results = asyncio.run(run_test_scenarios(
                test_local_agent,
                scenarios,
            ))
        else:
            results = asyncio.run(run_test_scenarios(
                test_agentcore_runtime,
                scenarios,
                runtime_arn=args.runtime_arn,
                region=args.region,
            ))
    else:
        # Single message test
        message = args.message or "Hello! What can you help me with?"
        
        if args.local:
            result = asyncio.run(test_local_agent(message))
        else:
            result = asyncio.run(test_agentcore_runtime(
                runtime_arn=args.runtime_arn,
                message=message,
                region=args.region,
                session_id=args.session_id,
            ))
        
        results = [result]
        print_result(result)
    
    # Print summary if multiple tests
    if len(results) > 1:
        all_passed = print_summary(results)
    else:
        all_passed = results[0].success if results else False
    
    # Output to JSON if requested
    if args.output_json:
        output_data = {
            "mode": "local" if args.local else "agentcore",
            "region": args.region,
            "runtime_arn": args.runtime_arn,
            "results": [
                {
                    "scenario": r.scenario_name,
                    "success": r.success,
                    "response": r.response,
                    "error": r.error,
                    "duration_ms": r.duration_ms,
                    "session_id": r.session_id,
                }
                for r in results
            ],
            "summary": {
                "total": len(results),
                "passed": sum(1 for r in results if r.success),
                "failed": sum(1 for r in results if not r.success),
            },
        }
        
        with open(args.output_json, "w") as f:
            json.dump(output_data, f, indent=2)
        print(f"\nResults saved to: {args.output_json}")
    
    # Exit with appropriate code
    sys.exit(0 if all_passed else 1)


if __name__ == "__main__":
    main()
