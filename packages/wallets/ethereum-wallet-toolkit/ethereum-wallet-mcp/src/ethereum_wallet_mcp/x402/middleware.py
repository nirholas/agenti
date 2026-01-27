"""
x402 Payment Middleware for Python MCP Servers

Provides payment gating for MCP tools using the x402 payment protocol.
"""

import os
import json
import time
import hashlib
import hmac
from dataclasses import dataclass, field
from typing import Optional, Callable, Any, Dict
from functools import wraps


@dataclass
class X402Config:
    """Configuration for x402 payment integration."""
    
    # Payment configuration
    price: str = "0.001"  # Price in token units
    token: str = "USDC"  # Payment token
    chain: str = "base"  # Blockchain network
    
    # Recipient configuration
    recipient: str = field(default_factory=lambda: os.environ.get(
        "X402_RECIPIENT", 
        "0x1234567890123456789012345678901234567890"
    ))
    
    # Free tier configuration
    free_tier_calls: int = 10  # Free calls per period
    free_tier_period: int = 3600  # Period in seconds (1 hour)
    
    # Optional description
    description: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "price": self.price,
            "token": self.token,
            "chain": self.chain,
            "recipient": self.recipient,
            "description": self.description,
        }


class X402Middleware:
    """Middleware for handling x402 payments in MCP servers."""
    
    def __init__(self, config: Optional[X402Config] = None):
        self.config = config or X402Config()
        self._usage_cache: Dict[str, Dict[str, Any]] = {}
    
    def _get_client_id(self, request: Any) -> str:
        """Extract client ID from request for rate limiting."""
        # Try various methods to identify the client
        if hasattr(request, 'client_id'):
            return request.client_id
        if hasattr(request, 'headers'):
            return request.headers.get('X-Client-ID', 'anonymous')
        return 'anonymous'
    
    def _check_free_tier(self, client_id: str) -> bool:
        """Check if client is within free tier limits."""
        now = time.time()
        
        if client_id not in self._usage_cache:
            self._usage_cache[client_id] = {
                'count': 0,
                'period_start': now,
            }
        
        usage = self._usage_cache[client_id]
        
        # Reset counter if period has passed
        if now - usage['period_start'] > self.config.free_tier_period:
            usage['count'] = 0
            usage['period_start'] = now
        
        # Check if within free tier
        if usage['count'] < self.config.free_tier_calls:
            usage['count'] += 1
            return True
        
        return False
    
    def _verify_payment_header(self, payment_header: Optional[str]) -> bool:
        """Verify x402 payment proof from header."""
        if not payment_header:
            return False
        
        try:
            # Parse payment proof
            payment_data = json.loads(payment_header)
            
            # Basic validation
            required_fields = ['signature', 'timestamp', 'amount', 'token']
            if not all(f in payment_data for f in required_fields):
                return False
            
            # Check timestamp (within 5 minutes)
            if abs(time.time() - payment_data['timestamp']) > 300:
                return False
            
            # Verify amount and token match
            if payment_data['token'] != self.config.token:
                return False
            
            if float(payment_data['amount']) < float(self.config.price):
                return False
            
            # In production, verify the cryptographic signature
            # against the blockchain transaction
            return True
            
        except (json.JSONDecodeError, KeyError, ValueError):
            return False
    
    def create_payment_required_response(self) -> Dict[str, Any]:
        """Create a 402 Payment Required response."""
        return {
            "error": {
                "code": 402,
                "message": "Payment Required",
                "x402": {
                    "version": "1.0",
                    "price": self.config.price,
                    "token": self.config.token,
                    "chain": self.config.chain,
                    "recipient": self.config.recipient,
                    "description": self.config.description,
                    "accepts": ["x402-payment"],
                }
            }
        }


def create_payment_required_response(config: X402Config) -> Dict[str, Any]:
    """Create a 402 Payment Required response."""
    middleware = X402Middleware(config)
    return middleware.create_payment_required_response()


def verify_payment(payment_header: Optional[str], config: X402Config) -> bool:
    """Verify an x402 payment proof."""
    middleware = X402Middleware(config)
    return middleware._verify_payment_header(payment_header)


def with_x402(
    config: Optional[X402Config] = None,
    price: Optional[str] = None,
    token: Optional[str] = None,
    description: Optional[str] = None,
):
    """
    Decorator to add x402 payment gating to an MCP tool.
    
    Usage:
        @with_x402(price="0.01", token="USDC", description="Premium analysis")
        async def premium_tool(params):
            return expensive_computation(params)
    """
    if config is None:
        config = X402Config(
            price=price or "0.001",
            token=token or "USDC",
            description=description,
        )
    
    middleware = X402Middleware(config)
    
    def decorator(func: Callable) -> Callable:
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Check for payment header in kwargs
            payment_header = kwargs.pop('_x402_payment', None)
            request = kwargs.get('request', None)
            
            # Get client ID
            client_id = 'anonymous'
            if request:
                client_id = middleware._get_client_id(request)
            
            # Check free tier first
            if middleware._check_free_tier(client_id):
                return await func(*args, **kwargs)
            
            # Verify payment
            if middleware._verify_payment_header(payment_header):
                return await func(*args, **kwargs)
            
            # Return 402 Payment Required
            return middleware.create_payment_required_response()
        
        # Add pricing info to function metadata
        wrapper._x402_config = config
        wrapper._x402_pricing = config.to_dict()
        
        return wrapper
    
    return decorator


def pricing_info(config: X402Config) -> str:
    """
    Generate pricing info string for tool descriptions.
    
    Usage:
        description = f"Get market data. {pricing_info(config)}"
    """
    return f"💰 {config.price} {config.token} per call ({config.chain})"
