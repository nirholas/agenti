"""
EIP-712 Typed Data Signing Tools

Implements typed structured data signing operations per EIP-712.
"""

import re
from typing import Any, Dict, Optional
from copy import deepcopy

from eth_account import Account
from eth_account.messages import encode_typed_data
from eth_utils import to_checksum_address, keccak
from mcp.server import Server


# ============================================================================
# Constants
# ============================================================================

HEX_PATTERN = re.compile(r'^(0x)?[0-9a-fA-F]*$')


# ============================================================================
# EIP-712 Templates
# ============================================================================

TYPED_DATA_TEMPLATES = {
    "permit": {
        "description": "ERC-20 Permit (EIP-2612) - Gasless token approvals",
        "template": {
            "types": {
                "EIP712Domain": [
                    {"name": "name", "type": "string"},
                    {"name": "version", "type": "string"},
                    {"name": "chainId", "type": "uint256"},
                    {"name": "verifyingContract", "type": "address"}
                ],
                "Permit": [
                    {"name": "owner", "type": "address"},
                    {"name": "spender", "type": "address"},
                    {"name": "value", "type": "uint256"},
                    {"name": "nonce", "type": "uint256"},
                    {"name": "deadline", "type": "uint256"}
                ]
            },
            "primaryType": "Permit",
            "domain": {
                "name": "TOKEN_NAME",
                "version": "1",
                "chainId": 1,
                "verifyingContract": "0x0000000000000000000000000000000000000000"
            },
            "message": {
                "owner": "0x0000000000000000000000000000000000000000",
                "spender": "0x0000000000000000000000000000000000000000",
                "value": 0,
                "nonce": 0,
                "deadline": 0
            }
        }
    },
    "permit2": {
        "description": "Uniswap Permit2 - Universal token approvals",
        "template": {
            "types": {
                "EIP712Domain": [
                    {"name": "name", "type": "string"},
                    {"name": "chainId", "type": "uint256"},
                    {"name": "verifyingContract", "type": "address"}
                ],
                "PermitSingle": [
                    {"name": "details", "type": "PermitDetails"},
                    {"name": "spender", "type": "address"},
                    {"name": "sigDeadline", "type": "uint256"}
                ],
                "PermitDetails": [
                    {"name": "token", "type": "address"},
                    {"name": "amount", "type": "uint160"},
                    {"name": "expiration", "type": "uint48"},
                    {"name": "nonce", "type": "uint48"}
                ]
            },
            "primaryType": "PermitSingle",
            "domain": {
                "name": "Permit2",
                "chainId": 1,
                "verifyingContract": "0x000000000022D473030F116dDEE9F6B43aC78BA3"
            },
            "message": {
                "details": {
                    "token": "0x0000000000000000000000000000000000000000",
                    "amount": 0,
                    "expiration": 0,
                    "nonce": 0
                },
                "spender": "0x0000000000000000000000000000000000000000",
                "sigDeadline": 0
            }
        }
    },
    "order": {
        "description": "DEX Order - Limit order for decentralized exchanges",
        "template": {
            "types": {
                "EIP712Domain": [
                    {"name": "name", "type": "string"},
                    {"name": "version", "type": "string"},
                    {"name": "chainId", "type": "uint256"},
                    {"name": "verifyingContract", "type": "address"}
                ],
                "Order": [
                    {"name": "maker", "type": "address"},
                    {"name": "taker", "type": "address"},
                    {"name": "makerToken", "type": "address"},
                    {"name": "takerToken", "type": "address"},
                    {"name": "makerAmount", "type": "uint256"},
                    {"name": "takerAmount", "type": "uint256"},
                    {"name": "expiry", "type": "uint256"},
                    {"name": "salt", "type": "uint256"}
                ]
            },
            "primaryType": "Order",
            "domain": {
                "name": "Exchange",
                "version": "1.0",
                "chainId": 1,
                "verifyingContract": "0x0000000000000000000000000000000000000000"
            },
            "message": {
                "maker": "0x0000000000000000000000000000000000000000",
                "taker": "0x0000000000000000000000000000000000000000",
                "makerToken": "0x0000000000000000000000000000000000000000",
                "takerToken": "0x0000000000000000000000000000000000000000",
                "makerAmount": 0,
                "takerAmount": 0,
                "expiry": 0,
                "salt": 0
            }
        }
    },
    "delegation": {
        "description": "Delegation - Delegate voting power",
        "template": {
            "types": {
                "EIP712Domain": [
                    {"name": "name", "type": "string"},
                    {"name": "version", "type": "string"},
                    {"name": "chainId", "type": "uint256"},
                    {"name": "verifyingContract", "type": "address"}
                ],
                "Delegation": [
                    {"name": "delegatee", "type": "address"},
                    {"name": "nonce", "type": "uint256"},
                    {"name": "expiry", "type": "uint256"}
                ]
            },
            "primaryType": "Delegation",
            "domain": {
                "name": "TOKEN_NAME",
                "version": "1",
                "chainId": 1,
                "verifyingContract": "0x0000000000000000000000000000000000000000"
            },
            "message": {
                "delegatee": "0x0000000000000000000000000000000000000000",
                "nonce": 0,
                "expiry": 0
            }
        }
    },
    "mail": {
        "description": "Mail - EIP-712 specification example",
        "template": {
            "types": {
                "EIP712Domain": [
                    {"name": "name", "type": "string"},
                    {"name": "version", "type": "string"},
                    {"name": "chainId", "type": "uint256"},
                    {"name": "verifyingContract", "type": "address"}
                ],
                "Person": [
                    {"name": "name", "type": "string"},
                    {"name": "wallet", "type": "address"}
                ],
                "Mail": [
                    {"name": "from", "type": "Person"},
                    {"name": "to", "type": "Person"},
                    {"name": "contents", "type": "string"}
                ]
            },
            "primaryType": "Mail",
            "domain": {
                "name": "Ether Mail",
                "version": "1",
                "chainId": 1,
                "verifyingContract": "0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC"
            },
            "message": {
                "from": {
                    "name": "Alice",
                    "wallet": "0xCD2a3d9F938E13CD947Ec05AbC7FE734Df8DD826"
                },
                "to": {
                    "name": "Bob",
                    "wallet": "0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB"
                },
                "contents": "Hello, Bob!"
            }
        }
    }
}


# ============================================================================
# Validation Helpers
# ============================================================================

def _normalize_hex(value: str) -> str:
    """Normalize hex string to have 0x prefix."""
    if value.startswith('0x') or value.startswith('0X'):
        return '0x' + value[2:].lower()
    return '0x' + value.lower()


def _validate_private_key(private_key: str) -> str:
    """Validate and normalize a private key."""
    if not private_key:
        raise ValueError("Private key is required")
    
    key = _normalize_hex(private_key)
    key_hex = key[2:]
    
    if not HEX_PATTERN.match(key_hex):
        raise ValueError("Private key must be hexadecimal")
    
    if len(key_hex) != 64:
        raise ValueError(f"Private key must be 32 bytes (64 hex chars), got {len(key_hex)}")
    
    return key


def _validate_signature(signature: str) -> str:
    """Validate and normalize a signature."""
    if not signature:
        raise ValueError("Signature is required")
    
    sig = _normalize_hex(signature)
    sig_hex = sig[2:]
    
    if not HEX_PATTERN.match(sig_hex):
        raise ValueError("Signature must be hexadecimal")
    
    if len(sig_hex) != 130:
        raise ValueError(f"Signature must be 65 bytes (130 hex chars), got {len(sig_hex) // 2} bytes")
    
    return sig


def _validate_address(address: str) -> str:
    """Validate and normalize an Ethereum address."""
    if not address:
        raise ValueError("Address is required")
    
    addr = _normalize_hex(address)
    addr_hex = addr[2:]
    
    if len(addr_hex) != 40:
        raise ValueError(f"Address must be 20 bytes (40 hex chars), got {len(addr_hex)}")
    
    try:
        return to_checksum_address(addr)
    except Exception as e:
        raise ValueError(f"Invalid address format: {e}")


def _validate_typed_data(typed_data: Dict) -> None:
    """Validate EIP-712 typed data structure."""
    required = ['types', 'primaryType', 'domain', 'message']
    for field in required:
        if field not in typed_data:
            raise ValueError(f"Missing required field: {field}")
    
    if 'EIP712Domain' not in typed_data['types']:
        raise ValueError("types must include EIP712Domain")
    
    if typed_data['primaryType'] not in typed_data['types']:
        raise ValueError(f"primaryType '{typed_data['primaryType']}' not defined in types")


# ============================================================================
# Core Typed Data Functions
# ============================================================================

def sign_typed_data_impl(typed_data: Dict, private_key: str) -> Dict[str, Any]:
    """
    Sign EIP-712 typed structured data.
    """
    _validate_typed_data(typed_data)
    key = _validate_private_key(private_key)
    
    account = Account.from_key(key)
    
    # Sign the typed data
    signed = account.sign_message(encode_typed_data(full_message=typed_data))
    
    # Get signature hex
    signature_hex = '0x' + signed.signature.hex()
    
    # Get message hash
    message_hash_attr = getattr(signed, 'message_hash', None) or getattr(signed, 'messageHash', None)
    message_hash_hex = '0x' + message_hash_attr.hex() if message_hash_attr else ''
    
    return {
        'signer': account.address,
        'signature': signature_hex,
        'v': signed.v,
        'r': hex(signed.r),
        's': hex(signed.s),
        'signing_hash': message_hash_hex,
        'primary_type': typed_data['primaryType'],
        'domain_name': typed_data.get('domain', {}).get('name', 'Unknown'),
        'chain_id': typed_data.get('domain', {}).get('chainId', 'Unknown')
    }


def verify_typed_data_impl(
    typed_data: Dict,
    signature: str,
    expected_address: str
) -> Dict[str, Any]:
    """
    Verify a signed EIP-712 typed data signature.
    """
    _validate_typed_data(typed_data)
    sig = _validate_signature(signature)
    expected = _validate_address(expected_address)
    
    try:
        recovered = Account.recover_message(
            encode_typed_data(full_message=typed_data),
            signature=sig
        )
        recovered_checksum = to_checksum_address(recovered)
    except Exception as e:
        return {
            'is_valid': False,
            'error': f"Recovery failed: {str(e)}",
            'expected_address': expected
        }
    
    is_match = recovered_checksum.lower() == expected.lower()
    
    return {
        'is_valid': is_match,
        'recovered_address': recovered_checksum,
        'expected_address': expected,
        'match': is_match,
        'primary_type': typed_data['primaryType']
    }


def recover_typed_data_signer_impl(typed_data: Dict, signature: str) -> Dict[str, Any]:
    """
    Recover the signer from an EIP-712 typed data signature.
    """
    _validate_typed_data(typed_data)
    sig = _validate_signature(signature)
    
    try:
        recovered = Account.recover_message(
            encode_typed_data(full_message=typed_data),
            signature=sig
        )
        recovered_checksum = to_checksum_address(recovered)
    except Exception as e:
        return {
            'success': False,
            'error': f"Recovery failed: {str(e)}"
        }
    
    return {
        'success': True,
        'signer': recovered_checksum,
        'primary_type': typed_data['primaryType']
    }


def hash_typed_data_impl(typed_data: Dict) -> Dict[str, Any]:
    """
    Compute the EIP-712 hash of typed data without signing.
    """
    _validate_typed_data(typed_data)
    
    try:
        encoded = encode_typed_data(full_message=typed_data)
        # Compute the signing hash: keccak(version + header + body)
        full_message = encoded.version + encoded.header + encoded.body
        full_hash = keccak(full_message)
    except Exception as e:
        return {
            'success': False,
            'error': f"Hash computation failed: {str(e)}"
        }
    
    return {
        'success': True,
        'signing_hash': '0x' + full_hash.hex(),
        'domain_separator': '0x' + encoded.header.hex(),
        'message_hash': '0x' + encoded.body.hex(),
        'primary_type': typed_data['primaryType'],
        'domain_name': typed_data.get('domain', {}).get('name', 'Unknown')
    }


def get_typed_data_template_impl(template_name: str) -> Dict[str, Any]:
    """
    Get a template for common EIP-712 typed data structures.
    """
    template_lower = template_name.lower()
    
    if template_lower not in TYPED_DATA_TEMPLATES:
        return {
            'success': False,
            'error': f"Unknown template: {template_name}",
            'available_templates': list(TYPED_DATA_TEMPLATES.keys())
        }
    
    template_info = TYPED_DATA_TEMPLATES[template_lower]
    
    return {
        'success': True,
        'template_name': template_lower,
        'description': template_info['description'],
        'typed_data': deepcopy(template_info['template']),
        'usage': f"Fill in the domain and message fields with your specific values"
    }


# ============================================================================
# Tool Registration
# ============================================================================

def register_typed_data_tools(server: Server) -> None:
    """Register EIP-712 typed data tools with the MCP server."""
    
    @server.tool()
    async def sign_typed_data(
        typed_data: Dict[str, Any],
        private_key: str
    ) -> Dict[str, Any]:
        """
        Sign EIP-712 typed structured data.
        
        Used for signing permits, DEX orders, and other DeFi operations
        that require human-readable, typed signing.
        
        Args:
            typed_data: EIP-712 typed data with types, primaryType, domain, message
            private_key: Hex-encoded 32-byte private key
            
        Returns:
            Dictionary containing signature and signing details
        """
        try:
            return sign_typed_data_impl(typed_data, private_key)
        except Exception as e:
            return {"error": True, "message": str(e)}
    
    @server.tool()
    async def verify_typed_data(
        typed_data: Dict[str, Any],
        signature: str,
        expected_address: str
    ) -> Dict[str, Any]:
        """
        Verify an EIP-712 typed data signature.
        
        Args:
            typed_data: EIP-712 typed data structure
            signature: 65-byte signature in hex format
            expected_address: Address expected to have signed
            
        Returns:
            Dictionary with verification result
        """
        try:
            return verify_typed_data_impl(typed_data, signature, expected_address)
        except Exception as e:
            return {"error": True, "message": str(e)}
    
    @server.tool()
    async def recover_typed_data_signer(
        typed_data: Dict[str, Any],
        signature: str
    ) -> Dict[str, Any]:
        """
        Recover the signer address from an EIP-712 typed data signature.
        
        Args:
            typed_data: EIP-712 typed data structure
            signature: 65-byte signature in hex format
            
        Returns:
            Dictionary containing recovered signer address
        """
        try:
            return recover_typed_data_signer_impl(typed_data, signature)
        except Exception as e:
            return {"error": True, "message": str(e)}
    
    @server.tool()
    async def hash_typed_data(
        typed_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Compute the EIP-712 hash of typed data without signing.
        
        Useful for debugging and verifying hash computation.
        
        Args:
            typed_data: EIP-712 typed data structure
            
        Returns:
            Dictionary containing the signing hash
        """
        try:
            return hash_typed_data_impl(typed_data)
        except Exception as e:
            return {"error": True, "message": str(e)}
    
    @server.tool()
    async def get_typed_data_template(
        template_name: str
    ) -> Dict[str, Any]:
        """
        Get a template for common EIP-712 typed data structures.
        
        Available templates: permit, permit2, order, delegation, mail
        
        Args:
            template_name: Name of the template (permit, permit2, order, delegation, mail)
            
        Returns:
            Template with types, domain, and message structure
        """
        try:
            return get_typed_data_template_impl(template_name)
        except Exception as e:
            return {"error": True, "message": str(e)}
    
    # Store references for testing
    server._tools = getattr(server, '_tools', {})
    server._tools['sign_typed_data'] = sign_typed_data
    server._tools['verify_typed_data'] = verify_typed_data
    server._tools['recover_typed_data_signer'] = recover_typed_data_signer
    server._tools['hash_typed_data'] = hash_typed_data
    server._tools['get_typed_data_template'] = get_typed_data_template
