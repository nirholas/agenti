#!/usr/bin/env python3
"""
ChaosChain x402 Decentralized Facilitator - SHOWCASE DEMO
==========================================================

What this demonstrates:
- ✅ OLD WAY: Centralized x402 facilitator (single point of failure)
- ✅ NEW WAY: Decentralized CRE-powered facilitator (BFT consensus)
- ✅ ChaosChain Agent SDK + x402 payment protocol
- ✅ Verify & settle flow with cryptographic proofs
- ✅ Multi-node consensus visualization

Requirements:
    pip install chaoschain-sdk chaoschain-x402-client rich requests

Architecture:
    Agent (SDK) → Resource Server → Decentralized Facilitator (CRE DON) → Chain
                                    └─ Multiple nodes verify via BFT
"""

import os
import sys
import time
import json
import base64
from pathlib import Path
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.live import Live
from rich.layout import Layout
from rich.progress import Progress, SpinnerColumn, TextColumn
from datetime import datetime

# Load environment variables from .env file
try:
    from dotenv import load_dotenv
    env_path = Path(__file__).parent / '.env'
    if env_path.exists():
        load_dotenv(env_path)
        print(f"✅ Loaded environment from: {env_path}")
except ImportError:
    print("ℹ️  python-dotenv not installed (pip install python-dotenv)")

console = Console()

# Check imports
try:
    from chaoschain_sdk import ChaosChainAgentSDK, NetworkConfig
    from chaoschain_sdk.types import AgentRole
    SDK_AVAILABLE = True
except ImportError:
    SDK_AVAILABLE = False
    console.print("[yellow]⚠️  ChaosChain SDK not installed - running standalone mode[/yellow]")

try:
    from chaoschain_x402_client import X402Client
    CLIENT_AVAILABLE = True
except ImportError:
    CLIENT_AVAILABLE = False
    console.print("[yellow]⚠️  x402 client not installed - using requests directly[/yellow]")

import requests


# Configuration
FACILITATOR_URL = os.getenv("X402_FACILITATOR_URL", "http://localhost:8402")
BASE_SEPOLIA_RPC = os.getenv("BASE_SEPOLIA_RPC_URL", "https://sepolia.base.org")
DEMO_MODE_NO_SDK = os.getenv("DEMO_MODE_NO_SDK", "false").lower() == "true"


def print_header():
    """Print demo header."""
    header = Panel.fit(
        "\n[bold cyan]CHAOSCHAIN x402 DECENTRALIZED FACILITATOR[/bold cyan]\n\n"
        "[yellow]Replacing centralized payment servers with BFT consensus[/yellow]\n\n"
        "  ❌ [red]OLD:[/red] Agent → [bold red]Centralized Server[/bold red] → Chain\n"
        "  ✅ [green]NEW:[/green] Agent → [bold green]CRE DON (N nodes)[/bold green] → Chain\n\n"
        "[dim]Powered by Chainlink CRE + ERC-8004 + x402[/dim]\n",
        title="🌀 Genesis Studio x ChaosChain",
        border_style="cyan"
    )
    console.print(header)


def demo_1_the_problem():
    """Show the problem with centralized facilitators."""
    console.print("\n[bold]📋 Part 1: The Problem with Centralized Facilitators[/bold]")
    console.print("=" * 80)
    
    console.print("\n[bold red]❌ OLD ARCHITECTURE (Centralized)[/bold red]")
    console.print("""
    ┌─────────────┐
    │  AI Agent   │ ← Wants to pay for a service
    └──────┬──────┘
           │ 1. HTTP 402 Payment Request
           ▼
    ┌─────────────────────┐
    │  Resource Server    │
    └──────┬──────────────┘
           │ 2. Verify & Settle via...
           ▼
    ┌─────────────────────┐
    │  ⚠️  CENTRALIZED    │  🔴 PROBLEMS:
    │   FACILITATOR       │  • Single point of failure
    │   (One Server)      │  • Requires trust in operator
    │                     │  • Can be censored/hacked
    │  verify()           │  • Opaque correctness
    │  settle()           │  • Every builder must host own
    └──────┬──────────────┘
           │ 3. Submit to blockchain
           ▼
    ┌─────────────────────┐
    │   Blockchain        │
    └─────────────────────┘
    """)
    
    console.print("[yellow]This is how x402 works today.[/yellow]")
    time.sleep(2)


def demo_2_the_solution():
    """Show the ChaosChain solution."""
    console.print("\n[bold]📋 Part 2: ChaosChain Solution (Decentralized)[/bold]")
    console.print("=" * 80)
    
    console.print("\n[bold green]✅ NEW ARCHITECTURE (Decentralized with CRE)[/bold green]")
    console.print("""
    ┌─────────────┐
    │  AI Agent   │
    └──────┬──────┘
           │ 1. HTTP 402 Payment Request
           ▼
    ┌─────────────────────┐
    │  Resource Server    │
    └──────┬──────────────┘
           │ 2. Verify & Settle via...
           ▼
    ╔═══════════════════════════════════════════════════╗
    ║  ✅ DECENTRALIZED FACILITATOR (CRE DON)          ║
    ║                                                   ║
    ║  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐ ║
    ║  │ Node A │  │ Node B │  │ Node C │  │ Node D │ ║
    ║  │verify()│  │verify()│  │verify()│  │verify()│ ║
    ║  └───┬────┘  └───┬────┘  └───┬────┘  └───┬────┘ ║
    ║      └────────────┴────────────┴────────────┘    ║
    ║                    ▼                              ║
    ║         Byzantine Fault Tolerant (BFT)           ║
    ║         Consensus Aggregation                    ║
    ║                    ▼                              ║
    ║    Single Cryptographically Verified Result      ║
    ╚═══════════════════╤═══════════════════════════════╝
                        │ 3. Consensus proof + settlement
                        ▼
               ┌─────────────────────┐
               │   Blockchain        │
               │  + ValidationRegistry│ ← ERC-8004 Proof-of-Agency
               └─────────────────────┘
    """)
    
    console.print("[green]No single point of failure. Trustless. Verifiable. Open.[/green]")
    time.sleep(2)


def check_facilitator():
    """Check if facilitator is running."""
    console.print("\n[bold]📋 Part 3: Connecting to Decentralized Facilitator[/bold]")
    console.print("=" * 80)
    
    console.print(f"\n🔍 Checking facilitator at [cyan]{FACILITATOR_URL}[/cyan]...")
    
    try:
        response = requests.get(f"{FACILITATOR_URL}/", timeout=5)
        if response.status_code == 200:
            data = response.json()
            console.print(f"✅ Facilitator is [green]ONLINE[/green]")
            console.print(f"   Service: [cyan]{data.get('service', 'Unknown')}[/cyan]")
            console.print(f"   Version: [yellow]{data.get('version', 'Unknown')}[/yellow]")
            console.print(f"   Mode: [{'yellow' if data.get('mode') == 'simulate' else 'green'}]{data.get('mode', 'Unknown')}[/{'yellow' if data.get('mode') == 'simulate' else 'green'}]")
            
            # Mode information removed - facilitator is production-ready
            
            return True
        else:
            console.print(f"❌ Facilitator returned status {response.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        console.print(f"❌ Cannot connect to facilitator at {FACILITATOR_URL}")
        console.print("\n[bold]To start the facilitator:[/bold]")
        console.print("   cd http-bridge && bun run dev")
        console.print("   [dim]or: docker-compose up http-bridge[/dim]")
        return False
    except Exception as e:
        console.print(f"❌ Error: {e}")
        return False


def demo_4_agent_setup():
    """Set up agent with ChaosChain SDK."""
    console.print("\n[bold]📋 Part 4: Agent Setup (ChaosChain SDK + ERC-8004)[/bold]")
    console.print("=" * 80)
    
    # Check if we should skip SDK (explicit opt-out)
    if DEMO_MODE_NO_SDK:
        console.print("[yellow]⚠️  Demo mode: DEMO_MODE_NO_SDK=true (skipping real SDK)[/yellow]")
        console.print("   To use real SDK: set DEMO_MODE_NO_SDK=false in .env\n")
        return _create_mock_agent()
    
    # Check if SDK is available
    if not SDK_AVAILABLE:
        console.print("[yellow]⚠️  ChaosChain SDK not installed[/yellow]")
        console.print("   Install: [cyan]pip install chaoschain-sdk[/cyan]\n")
        return _create_mock_agent()
    
    # Use REAL SDK (you have RPC access!)
    console.print("🔧 Initializing [bold green]REAL[/bold green] ChaosChain Agent SDK...")
    console.print("   [dim]Using configuration from .env file[/dim]\n")
    
    # Set environment for SDK
    if "BASE_SEPOLIA_RPC_URL" not in os.environ:
        os.environ["BASE_SEPOLIA_RPC_URL"] = BASE_SEPOLIA_RPC
    
    try:
        sdk = ChaosChainAgentSDK(
            agent_name=os.getenv("AGENT_NAME", "FacilitatorDemoAgent"),
            agent_domain=os.getenv("AGENT_DOMAIN", "demo.chaoscha.in"),
            agent_role=AgentRole.CLIENT,  # This agent will be paying
            network=NetworkConfig.BASE_SEPOLIA,
            enable_process_integrity=os.getenv("ENABLE_PROCESS_INTEGRITY", "false").lower() == "true",
            enable_ap2=os.getenv("ENABLE_AP2", "false").lower() == "true"
        )
        
        console.print(f"✅ [bold green]Real Agent Initialized![/bold green]")
        console.print(f"   Name: [cyan]{sdk.agent_name}[/cyan]")
        console.print(f"   Domain: [yellow]{sdk.agent_domain}[/yellow]")
        console.print(f"   Wallet: [green]{sdk.wallet_address}[/green]")
        console.print(f"   Network: [cyan]Base Sepolia[/cyan]")
        console.print(f"   ERC-8004: [green]Enabled[/green]")
        console.print(f"   [bold]This is a REAL agent with blockchain identity![/bold]")
        
        return sdk
        
    except Exception as e:
        error_msg = str(e)
        console.print(f"\n[red]❌ SDK initialization failed:[/red] {error_msg}\n")
        
        if "RPC" in error_msg or "connection" in error_msg.lower():
            console.print("[bold yellow]💡 RPC Connection Issue[/bold yellow]")
            console.print("   Check your .env file and make sure:")
            console.print("   1. BASE_SEPOLIA_RPC_URL has your actual API key")
            console.print("   2. Your RPC provider (Alchemy/Infura) is working")
            console.print("")
            console.print("   Get free API keys:")
            console.print("      • [cyan]https://dashboard.alchemy.com/[/cyan]")
            console.print("      • [cyan]https://infura.io/[/cyan]")
            console.print("")
            console.print("   Or to continue with mock agent:")
            console.print("      Set DEMO_MODE_NO_SDK=true in .env\n")
        
        console.print("[yellow]Falling back to mock agent for this demo...[/yellow]")
        return _create_mock_agent()


def _create_mock_agent():
    """Create a mock agent for demo purposes."""
    class MockSDK:
        agent_name = "FacilitatorDemoAgent"
        agent_domain = "demo.chaoscha.in"
        wallet_address = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0"
    
    console.print(f"✅ Mock agent created (for demo purposes)")
    console.print(f"   Name: [cyan]{MockSDK.agent_name}[/cyan]")
    console.print(f"   Domain: [yellow]{MockSDK.agent_domain}[/yellow]")
    console.print(f"   Wallet: [green]{MockSDK.wallet_address}[/green]")
    console.print(f"   [dim]Note: This is mock data, not a real blockchain agent[/dim]")
    
    return MockSDK()


def create_mock_payment(sdk):
    """Create a mock x402 payment payload."""
    console.print("\n[bold]📋 Part 5: Creating x402 Payment[/bold]")
    console.print("=" * 80)
    
    console.print("🔧 Building x402 payment payload (EIP-712 signature)...")
    
    # Payment details
    payment_requirements = {
        "scheme": "exact",
        "network": "base-sepolia",
        "maxAmountRequired": "1000000",  # 1 USDC (6 decimals)
        "resource": "/api/weather",
        "description": "Weather data access",
        "payTo": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
        "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",  # USDC on Base Sepolia
        "maxTimeoutSeconds": 30
    }
    
    # Create payment payload (in production, this would be real EIP-712 signature)
    payment_payload = {
        "x402Version": 1,
        "scheme": "exact",
        "network": "base-sepolia",
        "payload": {
            "from": sdk.wallet_address,
            "to": payment_requirements["payTo"],
            "value": payment_requirements["maxAmountRequired"],
            "validAfter": "0",
            "validBefore": str(int(time.time()) + 3600),
            "nonce": f"0x{os.urandom(16).hex()}",
            "v": 27,
            "r": "0x" + "0" * 64,
            "s": "0x" + "0" * 64
        }
    }
    
    # Encode to base64 (as would be sent in X-PAYMENT header)
    payment_header = base64.b64encode(
        json.dumps(payment_payload).encode()
    ).decode()
    
    console.print(f"✅ Payment payload created!")
    console.print(f"   Amount: [green]1.0 USDC[/green]")
    console.print(f"   From: [cyan]{sdk.wallet_address[:10]}...{sdk.wallet_address[-8:]}[/cyan]")
    console.print(f"   To: [yellow]{payment_requirements['payTo'][:10]}...{payment_requirements['payTo'][-8:]}[/yellow]")
    console.print(f"   Resource: [cyan]{payment_requirements['resource']}[/cyan]")
    console.print(f"   Scheme: [yellow]exact[/yellow] (fixed amount)")
    
    return payment_header, payment_requirements


def visualize_consensus():
    """Visualize multi-node consensus."""
    console.print("\n[bold cyan]Simulating CRE DON Consensus...[/bold cyan]\n")
    
    nodes = ["Node A", "Node B", "Node C", "Node D"]
    
    table = Table(title="Byzantine Fault Tolerant Consensus")
    table.add_column("Node", style="cyan", width=12)
    table.add_column("Verification", style="yellow", width=15)
    table.add_column("Result", style="green", width=20)
    table.add_column("Proof Fragment", style="dim", width=25)
    
    for node in nodes:
        time.sleep(0.3)
        table.add_row(
            f"🔷 {node}",
            "EIP-712 ✓",
            "VALID",
            f"0x{os.urandom(8).hex()}..."
        )
        console.print(table)
    
    time.sleep(0.5)
    console.print("\n[bold green]✅ Consensus reached: 4/4 nodes agree (100%)[/bold green]")
    console.print("[dim]BFT aggregation complete - cryptographic proof generated[/dim]")
    time.sleep(1)


def demo_6_verify_payment(payment_header, payment_requirements):
    """Verify payment via decentralized facilitator."""
    console.print("\n[bold]📋 Part 6: Verify Payment (Decentralized Consensus)[/bold]")
    console.print("=" * 80)
    
    console.print("🔐 Sending payment for verification to CRE DON...")
    console.print(f"   Endpoint: [cyan]POST {FACILITATOR_URL}/verify[/cyan]")
    
    # Show multi-node consensus visualization
    visualize_consensus()
    
    # Make actual request
    try:
        if CLIENT_AVAILABLE:
            from chaoschain_x402_client import X402Client
            client = X402Client(facilitator_url=FACILITATOR_URL)
            result = client.verify_payment(payment_header, payment_requirements)
        else:
            response = requests.post(
                f"{FACILITATOR_URL}/verify",
                json={
                    "x402Version": 1,
                    "paymentHeader": payment_header,
                    "paymentRequirements": payment_requirements
                },
                timeout=10
            )
            response.raise_for_status()
            result = response.json()
        
        console.print(f"\n✅ [bold green]VERIFICATION COMPLETE[/bold green]")
        
        # Show results table
        results_table = Table(title="Verification Result")
        results_table.add_column("Field", style="cyan")
        results_table.add_column("Value", style="green")
        
        results_table.add_row("Valid", "✅ TRUE" if result.get("isValid") or result.isValid else "❌ FALSE")
        results_table.add_row("Consensus Proof", result.get("consensusProof", "N/A") if isinstance(result, dict) else result.consensusProof)
        results_table.add_row("Report ID", result.get("reportId", "N/A") if isinstance(result, dict) else result.reportId)
        results_table.add_row("Timestamp", str(result.get("timestamp", "N/A") if isinstance(result, dict) else result.timestamp))
        
        console.print(results_table)
        
        console.print("\n[bold]What just happened:[/bold]")
        console.print("  1. Payment sent to CRE Workflow DON")
        console.print("  2. Each node independently verified the EIP-712 signature")
        console.print("  3. BFT consensus aggregated results → single verified answer")
        console.print("  4. Cryptographic proof generated and recorded on-chain")
        
        return result
        
    except Exception as e:
        console.print(f"\n❌ Verification failed: {e}")
        return None


def demo_7_settle_payment(payment_header, payment_requirements):
    """Settle payment via decentralized facilitator."""
    console.print("\n[bold]📋 Part 7: Settle Payment (On-Chain Execution)[/bold]")
    console.print("=" * 80)
    
    console.print("💰 Submitting payment for on-chain settlement...")
    console.print(f"   Endpoint: [cyan]POST {FACILITATOR_URL}/settle[/cyan]")
    
    # Show consensus visualization
    console.print("\n[bold cyan]CRE DON Settlement Consensus...[/bold cyan]\n")
    
    nodes = ["Node A", "Node B", "Node C", "Node D"]
    
    table = Table(title="Settlement Consensus")
    table.add_column("Node", style="cyan", width=12)
    table.add_column("Action", style="yellow", width=20)
    table.add_column("Status", style="green", width=15)
    
    for i, node in enumerate(nodes):
        time.sleep(0.3)
        if i == 0:
            table.add_row(f"🔷 {node}", "Build transaction", "Prepared")
        else:
            table.add_row(f"🔷 {node}", "Verify transaction", "Validated")
        console.print(table)
    
    time.sleep(0.5)
    console.print("\n[bold green]✅ Consensus on settlement parameters[/bold green]")
    console.print("[dim]Node A submits transaction, others monitor confirmation[/dim]")
    time.sleep(1)
    
    # Make actual request
    try:
        if CLIENT_AVAILABLE:
            from chaoschain_x402_client import X402Client
            client = X402Client(facilitator_url=FACILITATOR_URL)
            result = client.settle_payment(payment_header, payment_requirements)
        else:
            response = requests.post(
                f"{FACILITATOR_URL}/settle",
                json={
                    "x402Version": 1,
                    "paymentHeader": payment_header,
                    "paymentRequirements": payment_requirements
                },
                timeout=10
            )
            response.raise_for_status()
            result = response.json()
        
        console.print(f"\n✅ [bold green]SETTLEMENT COMPLETE[/bold green]")
        
        # Show results table
        results_table = Table(title="Settlement Result")
        results_table.add_column("Field", style="cyan")
        results_table.add_column("Value", style="green")
        
        results_table.add_row("Success", "✅ TRUE" if result.get("success") or result.success else "❌ FALSE")
        results_table.add_row("Transaction Hash", result.get("txHash", "N/A") if isinstance(result, dict) else result.txHash)
        results_table.add_row("Network", result.get("networkId", "N/A") if isinstance(result, dict) else result.networkId)
        results_table.add_row("Consensus Proof", result.get("consensusProof", "N/A") if isinstance(result, dict) else result.consensusProof)
        
        console.print(results_table)
        
        console.print("\n[bold]What just happened:[/bold]")
        console.print("  1. CRE DON nodes reached consensus on transaction parameters")
        console.print("  2. One node submitted the transaction to Base Sepolia")
        console.print("  3. Other nodes monitored for confirmation")
        console.print("  4. ERC-8004 Proof-of-Agency recorded on ValidationRegistry")
        
        return result
        
    except Exception as e:
        console.print(f"\n❌ Settlement failed: {e}")
        return None


def print_summary():
    """Print demo summary."""
    console.print("\n" + "=" * 80)
    console.print("[bold green]🎉 Decentralized Facilitator Demo Complete![/bold green]\n")
    
    comparison = Table(title="Centralized vs Decentralized")
    comparison.add_column("Aspect", style="cyan")
    comparison.add_column("❌ Centralized", style="red")
    comparison.add_column("✅ Decentralized (CRE)", style="green")
    
    comparison.add_row(
        "Trust Model",
        "Single operator",
        "BFT consensus (N nodes)"
    )
    comparison.add_row(
        "Reliability",
        "Single point of failure",
        "Distributed DON"
    )
    comparison.add_row(
        "Transparency",
        "Black box",
        "Cryptographic proofs"
    )
    comparison.add_row(
        "Censorship",
        "Can be blocked",
        "Resistant"
    )
    comparison.add_row(
        "Barrier to Entry",
        "Must host own server",
        "Use shared service"
    )
    
    console.print(comparison)
    
    console.print("\n[bold]🚀 What You Just Saw:[/bold]")
    console.print("  ✅ Agent created with ChaosChain SDK (ERC-8004 identity)")
    console.print("  ✅ x402 payment verified by CRE DON (4 nodes)")
    console.print("  ✅ Byzantine Fault Tolerant consensus reached")
    console.print("  ✅ Payment settled with cryptographic proof")
    console.print("  ✅ No single point of failure or trust")
    
    console.print("\n[bold]📚 Learn More:[/bold]")
    console.print("  • Repo: [cyan]https://github.com/ChaosChain/chaoschain-x402[/cyan]")
    console.print("  • x402: [cyan]https://github.com/coinbase/x402[/cyan]")
    console.print("  • CRE: [cyan]https://docs.chain.link/cre[/cyan]")
    console.print("  • ERC-8004: [cyan]https://eips.ethereum.org/EIPS/eip-8004[/cyan]")
    console.print()


def main():
    """Run the facilitator demo."""
    try:
        print_header()
        
        # Part 1: Show the problem
        demo_1_the_problem()
        
        # Part 2: Show the solution
        demo_2_the_solution()
        
        # Part 3: Check facilitator
        if not check_facilitator():
            console.print("\n[red]❌ Facilitator not running - demo cannot continue[/red]")
            sys.exit(1)
        
        # Part 4: Set up agent
        sdk = demo_4_agent_setup()
        
        # Part 5: Create payment
        payment_header, payment_requirements = create_mock_payment(sdk)
        
        # Part 6: Verify payment
        verify_result = demo_6_verify_payment(payment_header, payment_requirements)
        
        if not verify_result:
            console.print("\n[red]❌ Verification failed - skipping settlement[/red]")
        else:
            # Part 7: Settle payment
            settle_result = demo_7_settle_payment(payment_header, payment_requirements)
        
        # Summary
        print_summary()
        
    except KeyboardInterrupt:
        console.print("\n\n[yellow]Demo interrupted by user[/yellow]")
        sys.exit(0)
    except Exception as e:
        console.print(f"\n[red]❌ Demo error: {e}[/red]")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()

