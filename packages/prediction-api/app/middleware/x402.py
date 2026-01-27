"""
x402 Payment Gate Middleware
FastAPI middleware for x402 payment protocol integration.
"""

from functools import wraps
from typing import Callable, Optional
from fastapi import Request, HTTPException
import hashlib
import time

from ..config import settings


class X402PaymentRequired(Exception):
    """Exception raised when payment is required"""
    
    def __init__(
        self,
        amount: float,
        description: str = "Payment required",
        network: Optional[str] = None,
        recipient: Optional[str] = None,
        token: Optional[str] = None,
    ):
        self.amount = amount
        self.description = description
        self.network = network or settings.x402_network
        self.recipient = recipient or settings.x402_recipient_address
        self.token = token or settings.x402_token
        super().__init__(description)


def x402_paywall(
    amount: float,
    description: str = "Payment required",
    network: Optional[str] = None,
    recipient: Optional[str] = None,
    token: Optional[str] = None,
):
    """
    Decorator to add x402 paywall to a FastAPI endpoint.
    
    Usage:
        @app.post("/predict/direction")
        @x402_paywall(amount=0.01, description="Price direction prediction")
        async def predict_direction(request: PredictionRequest):
            ...
    """
    
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Find the Request object in args or kwargs
            request: Optional[Request] = None
            for arg in args:
                if isinstance(arg, Request):
                    request = arg
                    break
            if request is None:
                request = kwargs.get("request")
            
            # If x402 is disabled, skip payment check
            if not settings.x402_enabled:
                return await func(*args, **kwargs)
            
            # Check for payment proof in headers
            payment_proof = None
            if request:
                payment_proof = request.headers.get("X-402-Payment")
                if not payment_proof:
                    payment_proof = request.headers.get("x-402-payment")
            
            if not payment_proof:
                # No payment provided - return 402
                raise X402PaymentRequired(
                    amount=amount,
                    description=description,
                    network=network,
                    recipient=recipient,
                    token=token,
                )
            
            # Validate payment proof
            # In production, verify the payment on-chain
            if not _validate_payment_proof(payment_proof, amount):
                raise HTTPException(
                    status_code=402,
                    detail="Invalid payment proof"
                )
            
            # Payment valid - proceed with request
            return await func(*args, **kwargs)
        
        return wrapper
    return decorator


def _validate_payment_proof(proof: str, expected_amount: float) -> bool:
    """
    Validate x402 payment proof.
    
    In production, this would:
    1. Decode the payment proof (base64 or JWT)
    2. Extract the transaction hash
    3. Verify the transaction on-chain
    4. Confirm the amount matches
    5. Check the recipient address
    6. Verify the nonce hasn't been used
    
    For development, we accept any non-empty proof.
    """
    if not proof:
        return False
    
    # Development mode: accept any proof
    if settings.debug or not settings.x402_enabled:
        return True
    
    # TODO: Implement actual on-chain verification
    # This would use web3.py to check:
    # - Transaction exists and is confirmed
    # - Amount >= expected_amount
    # - Recipient matches settings.x402_recipient_address
    # - Token is correct (USDC, USDs, etc.)
    
    # For now, do basic validation
    try:
        # Proof should be a transaction hash (0x...) or encoded payment
        if proof.startswith("0x") and len(proof) == 66:
            return True
        
        # Accept base64 encoded proofs
        if len(proof) > 20:
            return True
        
        return False
    except Exception:
        return False


def generate_payment_request(
    amount: float,
    resource: str,
    description: str = "",
    validity_seconds: int = 300,
) -> dict:
    """
    Generate an x402 payment request object.
    
    This is what gets returned in the 402 response body.
    """
    return {
        "x402_version": 1,
        "accepts": [{
            "scheme": "exact",
            "network": f"eip155:{_get_chain_id(settings.x402_network)}",
            "maxAmountRequired": str(int(amount * 1_000_000)),  # USDC has 6 decimals
            "resource": resource,
            "description": description,
            "mimeType": "application/json",
            "payTo": settings.x402_recipient_address,
            "maxTimeoutSeconds": validity_seconds,
            "asset": f"eip155:{_get_chain_id(settings.x402_network)}/erc20:{_get_token_address()}",
        }],
    }


def _get_chain_id(network: str) -> int:
    """Get EIP-155 chain ID for network"""
    chain_ids = {
        "base": 8453,
        "base-sepolia": 84532,
        "ethereum": 1,
        "arbitrum": 42161,
        "optimism": 10,
        "polygon": 137,
    }
    return chain_ids.get(network, 8453)


def _get_token_address() -> str:
    """Get token contract address"""
    # USDC addresses by network
    usdc_addresses = {
        "base": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        "ethereum": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        "arbitrum": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
        "optimism": "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
        "polygon": "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359",
    }
    return usdc_addresses.get(settings.x402_network, usdc_addresses["base"])
