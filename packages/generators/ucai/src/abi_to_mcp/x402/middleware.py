"""
x402 Payment Middleware for UCAI MCP Servers

Provides payment gating for MCP tools using the x402 payment protocol.
"""

import os
import json
import time
from dataclasses import dataclass, field
from typing import Optional, Callable, Any, Dict
from functools import wraps


@dataclass
class X402Config:
    """Configuration for x402 payment integration."""
    
    price: str = "0.001"
    token: str = "USDC"
    chain: str = "base"
    recipient: str = field(default_factory=lambda: os.environ.get(
        "X402_RECIPIENT", 
        "0x1234567890123456789012345678901234567890"
    ))
    free_tier_calls: int = 10
    free_tier_period: int = 3600
    description: Optional[str] = None
    
    def to_dict(self) -> Dict[str, Any]:
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
    
    def _check_free_tier(self, client_id: str) -> bool:
        now = time.time()
        
        if client_id not in self._usage_cache:
            self._usage_cache[client_id] = {
                'count': 0,
                'period_start': now,
            }
        
        usage = self._usage_cache[client_id]
        
        if now - usage['period_start'] > self.config.free_tier_period:
            usage['count'] = 0
            usage['period_start'] = now
        
        if usage['count'] < self.config.free_tier_calls:
            usage['count'] += 1
            return True
        
        return False
    
    def _verify_payment_header(self, payment_header: Optional[str]) -> bool:
        if not payment_header:
            return False
        
        try:
            payment_data = json.loads(payment_header)
            required_fields = ['signature', 'timestamp', 'amount', 'token']
            if not all(f in payment_data for f in required_fields):
                return False
            if abs(time.time() - payment_data['timestamp']) > 300:
                return False
            if payment_data['token'] != self.config.token:
                return False
            if float(payment_data['amount']) < float(self.config.price):
                return False
            return True
        except (json.JSONDecodeError, KeyError, ValueError):
            return False
    
    def create_payment_required_response(self) -> Dict[str, Any]:
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
    middleware = X402Middleware(config)
    return middleware.create_payment_required_response()


def verify_payment(payment_header: Optional[str], config: X402Config) -> bool:
    middleware = X402Middleware(config)
    return middleware._verify_payment_header(payment_header)


def with_x402(
    config: Optional[X402Config] = None,
    price: Optional[str] = None,
    token: Optional[str] = None,
    description: Optional[str] = None,
):
    """Decorator to add x402 payment gating to an MCP tool."""
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
            payment_header = kwargs.pop('_x402_payment', None)
            request = kwargs.get('request', None)
            client_id = 'anonymous'
            if request and hasattr(request, 'client_id'):
                client_id = request.client_id
            
            if middleware._check_free_tier(client_id):
                return await func(*args, **kwargs)
            
            if middleware._verify_payment_header(payment_header):
                return await func(*args, **kwargs)
            
            return middleware.create_payment_required_response()
        
        wrapper._x402_config = config
        wrapper._x402_pricing = config.to_dict()
        return wrapper
    
    return decorator


def pricing_info(config: X402Config) -> str:
    return f"💰 {config.price} {config.token} per call ({config.chain})"
