"""Payment-related tools for the x402 payer agent."""

import json
import secrets
import sys
import time
from typing import Any, Literal
from strands import tool

# Mock bcl module to avoid nillion/bcl native extension issues in containers
# We don't use nillion features, but coinbase_agentkit imports it at the top level
if 'bcl' not in sys.modules:
    import types
    mock_bcl = types.ModuleType('bcl')
    mock_bcl.symmetric = types.ModuleType('bcl.symmetric')
    mock_bcl.asymmetric = types.ModuleType('bcl.asymmetric')
    sys.modules['bcl'] = mock_bcl
    sys.modules['bcl.symmetric'] = mock_bcl.symmetric
    sys.modules['bcl.asymmetric'] = mock_bcl.asymmetric

# Now import coinbase_agentkit - the nillion import will fail gracefully
# since bcl is mocked
try:
    from coinbase_agentkit.wallet_providers.cdp_evm_wallet_provider import (
        CdpEvmWalletProvider,
        CdpEvmWalletProviderConfig,
    )
except ImportError:
    # If direct import fails, try the main module
    from coinbase_agentkit import CdpEvmWalletProvider, CdpEvmWalletProviderConfig

from ..config import config
from ..tracing import get_tracer, add_payment_span_attributes
from ..metrics import get_metrics_emitter

# Wallet provider singleton
_wallet_provider: CdpEvmWalletProvider | None = None

# Supported testnet networks for faucet
SUPPORTED_FAUCET_NETWORKS = ["base-sepolia", "ethereum-sepolia"]

# USDC contract addresses per network
USDC_CONTRACTS = {
    "base-sepolia": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    "ethereum-sepolia": "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
}

# Network to chain ID mapping (CAIP-2 format: eip155:chainId)
NETWORK_TO_CHAIN_ID = {
    "base-sepolia": "84532",
    "base": "8453",
    "eip155:84532": "84532",
    "eip155:8453": "8453",
}

# Token info for EIP-712 domain
TOKEN_INFO = {
    "84532": {  # Base Sepolia
        "0x036CbD53842c5426634e7929541eC2318f3dCF7e": {
            "name": "USDC",
            "version": "2",
            "decimals": 6,
        }
    },
    "8453": {  # Base Mainnet
        "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913": {
            "name": "USD Coin",
            "version": "2",
            "decimals": 6,
        }
    },
}

# ERC-20 balanceOf ABI
ERC20_BALANCE_OF_ABI = [
    {
        "constant": True,
        "inputs": [{"name": "_owner", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"name": "balance", "type": "uint256"}],
        "type": "function",
    }
]

# Supported assets per network
SUPPORTED_FAUCET_ASSETS = {
    "base-sepolia": ["eth", "usdc", "eurc", "cbbtc"],
    "ethereum-sepolia": ["eth", "usdc", "eurc", "cbbtc"],
}


def _get_wallet_provider_sync() -> CdpEvmWalletProvider:
    """Get or create the wallet provider (synchronous)."""
    global _wallet_provider
    if _wallet_provider is None:
        wallet_config = CdpEvmWalletProviderConfig(
            api_key_id=config.cdp_api_key_name,
            api_key_secret=config.cdp_api_key_private_key,
            wallet_secret=config.cdp_wallet_secret,
            address=config.cdp_wallet_address if config.cdp_wallet_address else None,
            network_id=config.network_id,
        )
        _wallet_provider = CdpEvmWalletProvider(wallet_config)
    return _wallet_provider


@tool
def analyze_payment(
    amount: str,
    currency: str,
    recipient: str,
    description: str,
    wallet_balance: str,
) -> dict[str, Any]:
    """
    Analyze a payment request and decide whether to approve it.

    Args:
        amount: The payment amount (e.g., "0.001")
        currency: The currency (e.g., "ETH")
        recipient: The recipient wallet address
        description: Description of what is being purchased
        wallet_balance: Current wallet balance

    Returns:
        Dictionary with decision, reasoning, and risk level
    """
    tracer = get_tracer()
    metrics = get_metrics_emitter()
    start_time = time.time()
    
    with tracer.start_as_current_span("payment.analyze") as span:
        add_payment_span_attributes(
            span,
            amount=amount,
            currency=currency,
            recipient=recipient,
        )
        span.set_attribute("payment.description", description)
        span.set_attribute("wallet.balance", wallet_balance)
        
        # Convert to float for comparison
        try:
            amount_float = float(amount)
            balance_float = float(wallet_balance)
        except ValueError:
            span.set_attribute("payment.decision", "rejected")
            span.set_attribute("payment.rejection_reason", "invalid_format")
            latency_ms = (time.time() - start_time) * 1000
            metrics.record_payment_analysis(
                approved=False,
                latency_ms=latency_ms,
                amount=amount,
                currency=currency,
                rejection_reason="invalid_format",
            )
            return {
                "should_pay": False,
                "reasoning": "Invalid amount or balance format",
                "risk_level": "high",
            }

        # Basic validation checks
        if balance_float < amount_float:
            span.set_attribute("payment.decision", "rejected")
            span.set_attribute("payment.rejection_reason", "insufficient_balance")
            latency_ms = (time.time() - start_time) * 1000
            metrics.record_payment_analysis(
                approved=False,
                latency_ms=latency_ms,
                amount=amount,
                currency=currency,
                rejection_reason="insufficient_balance",
            )
            return {
                "should_pay": False,
                "reasoning": f"Insufficient balance. Have {wallet_balance} {currency}, need {amount} {currency}",
                "risk_level": "high",
            }

        # Check if amount is reasonable (demo: under 0.01 ETH)
        if amount_float > 0.01:
            span.set_attribute("payment.decision", "rejected")
            span.set_attribute("payment.rejection_reason", "amount_too_high")
            latency_ms = (time.time() - start_time) * 1000
            metrics.record_payment_analysis(
                approved=False,
                latency_ms=latency_ms,
                amount=amount,
                currency=currency,
                rejection_reason="amount_too_high",
            )
            return {
                "should_pay": False,
                "reasoning": f"Amount {amount} {currency} exceeds reasonable threshold for demo content",
                "risk_level": "medium",
            }

        # Check recipient address format
        if not recipient.startswith("0x") or len(recipient) != 42:
            span.set_attribute("payment.decision", "rejected")
            span.set_attribute("payment.rejection_reason", "invalid_recipient")
            latency_ms = (time.time() - start_time) * 1000
            metrics.record_payment_analysis(
                approved=False,
                latency_ms=latency_ms,
                amount=amount,
                currency=currency,
                rejection_reason="invalid_recipient",
            )
            return {
                "should_pay": False,
                "reasoning": "Invalid recipient address format",
                "risk_level": "high",
            }

        # Approve the payment
        span.set_attribute("payment.decision", "approved")
        span.set_attribute("payment.risk_level", "low")
        latency_ms = (time.time() - start_time) * 1000
        metrics.record_payment_analysis(
            approved=True,
            latency_ms=latency_ms,
            amount=amount,
            currency=currency,
        )
        return {
            "should_pay": True,
            "reasoning": f"Payment of {amount} {currency} for '{description}' is reasonable and within budget",
            "risk_level": "low",
        }


@tool
def sign_payment(
    scheme: str,
    network: str,
    amount: str,
    recipient: str,
    asset: str = "",
    max_timeout_seconds: int = 60,
) -> dict[str, Any]:
    """
    Sign a payment using the AgentKit wallet for x402 v2 protocol.

    Creates an EIP-3009 TransferWithAuthorization signature for USDC transfers.

    Args:
        scheme: Payment scheme (e.g., "exact")
        network: Blockchain network in CAIP-2 format (e.g., "eip155:84532" or "base-sepolia")
        amount: Payment amount in atomic units (e.g., "2000" for 0.002 USDC)
        recipient: Recipient wallet address (payTo)
        asset: Token contract address (optional, defaults to USDC for network)
        max_timeout_seconds: Maximum time for payment validity (default 60)

    Returns:
        Signed x402 v2 payment payload ready for x-payment header
    """
    tracer = get_tracer()
    metrics = get_metrics_emitter()
    start_time = time.time()
    
    with tracer.start_as_current_span("payment.sign") as span:
        add_payment_span_attributes(
            span,
            amount=amount,
            network=network,
            recipient=recipient,
        )
        span.set_attribute("payment.scheme", scheme)
        
        try:
            wallet_provider = _get_wallet_provider_sync()
            address = wallet_provider.get_address()
            span.set_attribute("wallet.address", address)

            # Get chain ID from network
            chain_id = NETWORK_TO_CHAIN_ID.get(network)
            if not chain_id:
                # Try to extract from CAIP-2 format (eip155:chainId)
                if network.startswith("eip155:"):
                    chain_id = network.split(":")[1]
                else:
                    return {
                        "success": False,
                        "error": f"Unsupported network: {network}",
                    }
            
            # Get asset address (default to USDC)
            if not asset:
                network_key = "base-sepolia" if chain_id == "84532" else "base"
                asset = USDC_CONTRACTS.get(network_key, USDC_CONTRACTS["base-sepolia"])
            
            # Get token info for EIP-712 domain
            token_info = TOKEN_INFO.get(chain_id, {}).get(asset.lower()) or TOKEN_INFO.get(chain_id, {}).get(asset)
            if not token_info:
                # Default to USDC info
                token_info = {"name": "USDC", "version": "2", "decimals": 6}
            
            # Create nonce (32 random bytes as hex string)
            nonce_bytes = secrets.token_bytes(32)
            nonce_hex = f"0x{nonce_bytes.hex()}"
            
            # Create time window
            now = int(time.time())
            valid_after = str(now - 60)  # Valid from 60 seconds ago
            valid_before = str(now + max_timeout_seconds)
            
            # Create EIP-712 typed data for TransferWithAuthorization
            typed_data = {
                "types": {
                    "EIP712Domain": [
                        {"name": "name", "type": "string"},
                        {"name": "version", "type": "string"},
                        {"name": "chainId", "type": "uint256"},
                        {"name": "verifyingContract", "type": "address"},
                    ],
                    "TransferWithAuthorization": [
                        {"name": "from", "type": "address"},
                        {"name": "to", "type": "address"},
                        {"name": "value", "type": "uint256"},
                        {"name": "validAfter", "type": "uint256"},
                        {"name": "validBefore", "type": "uint256"},
                        {"name": "nonce", "type": "bytes32"},
                    ],
                },
                "primaryType": "TransferWithAuthorization",
                "domain": {
                    "name": token_info["name"],
                    "version": token_info["version"],
                    "chainId": int(chain_id),
                    "verifyingContract": asset,
                },
                "message": {
                    "from": address,
                    "to": recipient,
                    "value": int(amount),
                    "validAfter": int(valid_after),
                    "validBefore": int(valid_before),
                    "nonce": nonce_hex,  # Use hex string for CDP API
                },
            }
            
            # Sign the typed data using CDP wallet
            # The CDP wallet provider uses sign_typed_data for EIP-712
            try:
                signature = wallet_provider.sign_typed_data(typed_data)
            except AttributeError:
                # Fallback: sign as message if typed data not supported
                message = json.dumps({
                    "from": address,
                    "to": recipient,
                    "value": amount,
                    "validAfter": valid_after,
                    "validBefore": valid_before,
                    "nonce": nonce_hex,
                })
                signature = wallet_provider.sign_message(message)
            
            # Ensure signature has 0x prefix
            if not signature.startswith("0x"):
                signature = f"0x{signature}"
            
            span.set_attribute("payment.signed", True)
            span.set_attribute("payment.valid_after", valid_after)
            span.set_attribute("payment.valid_before", valid_before)
            
            latency_ms = (time.time() - start_time) * 1000
            metrics.record_payment_signing(
                success=True,
                latency_ms=latency_ms,
                network=network,
                amount=amount,
            )

            # Create x402 v2 payment payload
            # The "accepted" field should contain the payment requirements we're accepting
            payment_payload = {
                "x402Version": 2,
                "accepted": {
                    "scheme": scheme,
                    "network": f"eip155:{chain_id}" if not network.startswith("eip155:") else network,
                    "amount": amount,
                    "asset": asset,
                    "payTo": recipient,
                    "maxTimeoutSeconds": max_timeout_seconds,
                    "extra": {
                        "name": token_info["name"],
                        "version": token_info["version"],
                    },
                },
                "payload": {
                    "signature": signature,
                    "authorization": {
                        "from": address,
                        "to": recipient,
                        "value": amount,
                        "validAfter": valid_after,
                        "validBefore": valid_before,
                        "nonce": nonce_hex,
                    },
                },
            }

            return {
                "success": True,
                "payload": payment_payload,
            }
        except Exception as e:
            span.set_attribute("payment.signed", False)
            span.set_attribute("error.message", str(e))
            span.record_exception(e)
            
            latency_ms = (time.time() - start_time) * 1000
            metrics.record_payment_signing(
                success=False,
                latency_ms=latency_ms,
                network=network,
                amount=amount,
                error=str(e),
            )
            return {
                "success": False,
                "error": str(e),
            }


@tool
def get_wallet_balance() -> dict[str, Any]:
    """
    Get the current wallet balance including ETH and USDC.

    Returns:
        Dictionary with wallet address, network, ETH balance, and USDC balance
    """
    tracer = get_tracer()
    metrics = get_metrics_emitter()
    
    with tracer.start_as_current_span("wallet.get_balance") as span:
        try:
            wallet_provider = _get_wallet_provider_sync()
            address = wallet_provider.get_address()
            network = wallet_provider.get_network()
            network_id = network.network_id
            balance = wallet_provider.get_balance()

            # Convert from wei to ETH
            balance_eth = float(balance) / 1e18
            
            span.set_attribute("wallet.address", address)
            span.set_attribute("wallet.network", network_id)
            span.set_attribute("wallet.balance_eth", balance_eth)
            
            # Get USDC balance if contract exists for this network
            usdc_balance = "0"
            usdc_contract = USDC_CONTRACTS.get(network_id)
            if usdc_contract:
                try:
                    result = wallet_provider.read_contract(
                        contract_address=usdc_contract,
                        abi=ERC20_BALANCE_OF_ABI,
                        function_name="balanceOf",
                        args=[address],
                    )
                    # USDC has 6 decimals
                    usdc_balance = str(float(result) / 1e6)
                    span.set_attribute("wallet.balance_usdc", usdc_balance)
                except Exception as e:
                    span.set_attribute("wallet.usdc_error", str(e))
            
            # Record wallet balance metric
            metrics.record_wallet_balance(
                balance_eth=balance_eth,
                network=network_id,
                address=address,
            )

            return {
                "success": True,
                "address": address,
                "network": network_id,
                "eth_balance": str(balance_eth),
                "usdc_balance": usdc_balance,
                "balances": {
                    "ETH": str(balance_eth),
                    "USDC": usdc_balance,
                },
            }
        except Exception as e:
            span.set_attribute("error.message", str(e))
            span.record_exception(e)
            metrics.record_error(
                error_type="wallet_balance_error",
                error_message=str(e),
                operation="get_wallet_balance",
            )
            return {
                "success": False,
                "error": str(e),
            }


@tool
def request_faucet_funds(
    asset_id: str = "eth",
) -> dict[str, Any]:
    """
    Request test tokens from the testnet faucet.

    This tool requests free test tokens from the CDP faucet for testing purposes.
    Only works on supported testnet networks (base-sepolia, ethereum-sepolia).

    Args:
        asset_id: The asset to request. Options:
            - "eth" (default): Native ETH
            - "usdc": USDC stablecoin
            - "eurc": EURC stablecoin
            - "cbbtc": Coinbase wrapped BTC

    Returns:
        Dictionary with success status and transaction hash or error message
    """
    metrics = get_metrics_emitter()
    
    try:
        wallet_provider = _get_wallet_provider_sync()
        network = wallet_provider.get_network()
        network_id = network.network_id
        address = wallet_provider.get_address()

        # Validate network support
        if network_id not in SUPPORTED_FAUCET_NETWORKS:
            metrics.record_faucet_request(
                success=False,
                network=network_id,
                asset=asset_id,
                error="unsupported_network",
            )
            return {
                "success": False,
                "error": f"Faucet is only supported on testnet networks: {', '.join(SUPPORTED_FAUCET_NETWORKS)}. "
                         f"Current network: {network_id}",
            }

        # Validate asset support
        supported_assets = SUPPORTED_FAUCET_ASSETS.get(network_id, [])
        asset_lower = asset_id.lower()
        if asset_lower not in supported_assets:
            metrics.record_faucet_request(
                success=False,
                network=network_id,
                asset=asset_id,
                error="unsupported_asset",
            )
            return {
                "success": False,
                "error": f"Asset '{asset_id}' is not supported on {network_id}. "
                         f"Supported assets: {', '.join(supported_assets)}",
            }

        # Get CDP client and request faucet funds
        cdp_client = wallet_provider.get_client()

        import asyncio

        async def _request_faucet():
            async with cdp_client as cdp:
                token: Literal["eth", "usdc", "eurc", "cbbtc"] = asset_lower  # type: ignore
                tx_hash = await cdp.evm.request_faucet(
                    address=address,
                    token=token,
                    network=network_id,
                )
                return tx_hash

        try:
            loop = asyncio.get_event_loop()
        except RuntimeError:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

        tx_hash = loop.run_until_complete(_request_faucet())
        
        metrics.record_faucet_request(
            success=True,
            network=network_id,
            asset=asset_id,
        )

        return {
            "success": True,
            "message": f"Successfully requested {asset_id.upper()} from faucet",
            "transaction_hash": tx_hash,
            "address": address,
            "network": network_id,
            "asset": asset_id.upper(),
        }

    except Exception as e:
        metrics.record_faucet_request(
            success=False,
            network=network_id if 'network_id' in dir() else "unknown",
            asset=asset_id,
            error=str(e),
        )
        return {
            "success": False,
            "error": f"Failed to request faucet funds: {str(e)}",
        }


@tool
def check_faucet_eligibility() -> dict[str, Any]:
    """
    Check if the current wallet is eligible for faucet funds.

    Returns information about faucet availability for the current network
    and lists supported assets.

    Returns:
        Dictionary with eligibility status and supported assets
    """
    try:
        wallet_provider = _get_wallet_provider_sync()
        network = wallet_provider.get_network()
        network_id = network.network_id
        address = wallet_provider.get_address()

        is_eligible = network_id in SUPPORTED_FAUCET_NETWORKS
        supported_assets = SUPPORTED_FAUCET_ASSETS.get(network_id, [])

        return {
            "success": True,
            "eligible": is_eligible,
            "address": address,
            "network": network_id,
            "supported_assets": supported_assets if is_eligible else [],
            "message": (
                f"Wallet is eligible for faucet on {network_id}. "
                f"Available assets: {', '.join(supported_assets)}"
                if is_eligible
                else f"Faucet not available on {network_id}. "
                     f"Supported networks: {', '.join(SUPPORTED_FAUCET_NETWORKS)}"
            ),
        }

    except Exception as e:
        return {
            "success": False,
            "error": f"Failed to check faucet eligibility: {str(e)}",
        }
