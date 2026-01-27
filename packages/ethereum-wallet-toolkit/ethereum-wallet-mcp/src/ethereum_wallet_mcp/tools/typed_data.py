"""
Typed Data Tools for Ethereum Wallet MCP Server

This module implements MCP tools for EIP-712 typed structured data operations:
- sign_typed_data: Sign EIP-712 typed structured data
- verify_typed_data: Verify an EIP-712 typed data signature
- recover_typed_data_signer: Recover signer from typed data signature
- hash_typed_data: Compute EIP-712 hash without signing
- generate_typed_data_template: Generate templates for common use cases

EIP-712 is used for signing structured data like permits, orders, and other
DeFi operations that require human-readable signing.

Security Note: Private keys are never logged or persisted.
"""

import time
from typing import Optional, Dict, Any, List
from copy import deepcopy

from eth_account import Account
from eth_account.messages import encode_typed_data
from eth_utils import to_checksum_address, keccak
from mcp.server import Server


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
                "value": "0",
                "nonce": 0,
                "deadline": 0
            }
        },
        "required_fields": ["domain.name", "domain.verifyingContract", "message.owner", "message.spender", "message.value", "message.deadline"],
        "example_values": {
            "domain.name": "USD Coin",
            "domain.version": "2",
            "domain.chainId": 1,
            "domain.verifyingContract": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
            "message.owner": "0xYourAddress",
            "message.spender": "0xUniswapRouter",
            "message.value": "1000000000000000000",
            "message.nonce": 0,
            "message.deadline": 1893456000
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
                    "amount": "0",
                    "expiration": 0,
                    "nonce": 0
                },
                "spender": "0x0000000000000000000000000000000000000000",
                "sigDeadline": 0
            }
        },
        "required_fields": ["message.details.token", "message.details.amount", "message.spender", "message.sigDeadline"],
        "example_values": {
            "domain.chainId": 1,
            "message.details.token": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
            "message.details.amount": "1461501637330902918203684832716283019655932542975",
            "message.details.expiration": 1893456000,
            "message.details.nonce": 0,
            "message.spender": "0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD",
            "message.sigDeadline": 1893456000
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
                "makerAmount": "0",
                "takerAmount": "0",
                "expiry": 0,
                "salt": 0
            }
        },
        "required_fields": ["domain.verifyingContract", "message.maker", "message.makerToken", "message.takerToken", "message.makerAmount", "message.takerAmount"],
        "example_values": {
            "domain.name": "0x Exchange",
            "domain.verifyingContract": "0xDef1C0ded9bec7F1a1670819833240f027b25EfF",
            "message.maker": "0xYourAddress",
            "message.taker": "0x0000000000000000000000000000000000000000",
            "message.makerToken": "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
            "message.takerToken": "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
            "message.makerAmount": "1000000000000000000",
            "message.takerAmount": "3000000000",
            "message.expiry": 1893456000,
            "message.salt": 12345678901234567890
        }
    },
    "delegation": {
        "description": "Delegation Signature - Delegate voting power or actions",
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
        },
        "required_fields": ["domain.name", "domain.verifyingContract", "message.delegatee", "message.expiry"],
        "example_values": {
            "domain.name": "Compound",
            "domain.verifyingContract": "0xc00e94Cb662C3520282E6f5717214004A7f26888",
            "message.delegatee": "0xDelegateAddress",
            "message.nonce": 0,
            "message.expiry": 1893456000
        }
    },
    "mail": {
        "description": "Mail - Simple structured message (EIP-712 spec example)",
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
                    "name": "",
                    "wallet": "0x0000000000000000000000000000000000000000"
                },
                "to": {
                    "name": "",
                    "wallet": "0x0000000000000000000000000000000000000000"
                },
                "contents": ""
            }
        },
        "required_fields": ["message.from.name", "message.from.wallet", "message.to.name", "message.to.wallet", "message.contents"],
        "example_values": {
            "message.from.name": "Alice",
            "message.from.wallet": "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
            "message.to.name": "Bob",
            "message.to.wallet": "0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
            "message.contents": "Hello, Bob!"
        }
    },
    "custom": {
        "description": "Custom - Empty template for your own typed data",
        "template": {
            "types": {
                "EIP712Domain": [
                    {"name": "name", "type": "string"},
                    {"name": "version", "type": "string"},
                    {"name": "chainId", "type": "uint256"},
                    {"name": "verifyingContract", "type": "address"}
                ],
                "YourType": [
                    {"name": "field1", "type": "string"},
                    {"name": "field2", "type": "uint256"},
                    {"name": "field3", "type": "address"}
                ]
            },
            "primaryType": "YourType",
            "domain": {
                "name": "Your App Name",
                "version": "1",
                "chainId": 1,
                "verifyingContract": "0x0000000000000000000000000000000000000000"
            },
            "message": {
                "field1": "",
                "field2": 0,
                "field3": "0x0000000000000000000000000000000000000000"
            }
        },
        "required_fields": ["types", "primaryType", "domain", "message"],
        "example_values": {
            "Note": "Customize types, primaryType, domain, and message for your use case"
        }
    }
}


# ============================================================================
# Error Classes
# ============================================================================

class TypedDataError(Exception):
    """Base exception for typed data operations."""
    def __init__(self, code: str, message: str):
        self.code = code
        self.message = message
        super().__init__(message)
    
    def to_dict(self) -> dict:
        return {"error": True, "code": self.code, "message": self.message}


class InvalidTypedDataError(TypedDataError):
    """Raised when typed data structure is invalid."""
    def __init__(self, message: str):
        super().__init__("INVALID_TYPED_DATA", message)


class InvalidKeyError(TypedDataError):
    """Raised when a private key format is invalid."""
    def __init__(self, message: str):
        super().__init__("INVALID_KEY", message)


class InvalidSignatureError(TypedDataError):
    """Raised when a signature format is invalid."""
    def __init__(self, message: str):
        super().__init__("INVALID_SIGNATURE", message)


class InvalidAddressError(TypedDataError):
    """Raised when an address format is invalid."""
    def __init__(self, message: str):
        super().__init__("INVALID_ADDRESS", message)


# ============================================================================
# Validation Functions
# ============================================================================

def _normalize_hex(value: str) -> str:
    """Normalize hex string to have 0x prefix."""
    if value.startswith('0x') or value.startswith('0X'):
        return '0x' + value[2:]
    return '0x' + value


def _validate_private_key(private_key: str) -> str:
    """Validate and normalize a private key."""
    if not private_key:
        raise InvalidKeyError("Private key is required")
    
    key = _normalize_hex(private_key)
    key_hex = key[2:]
    
    if len(key_hex) != 64:
        raise InvalidKeyError(f"Private key must be 32 bytes (64 hex chars), got {len(key_hex)}")
    
    return key


def _validate_signature(signature: str) -> str:
    """Validate and normalize a signature."""
    if not signature:
        raise InvalidSignatureError("Signature is required")
    
    sig = _normalize_hex(signature)
    sig_hex = sig[2:]
    
    if len(sig_hex) != 130:
        raise InvalidSignatureError(
            f"Signature must be 65 bytes (130 hex chars), got {len(sig_hex) // 2} bytes"
        )
    
    return sig


def _validate_address(address: str) -> str:
    """Validate and normalize an Ethereum address."""
    if not address:
        raise InvalidAddressError("Address is required")
    
    addr = _normalize_hex(address)
    addr_hex = addr[2:]
    
    if len(addr_hex) != 40:
        raise InvalidAddressError(f"Address must be 20 bytes (40 hex chars), got {len(addr_hex)}")
    
    try:
        return to_checksum_address(addr)
    except Exception as e:
        raise InvalidAddressError(f"Invalid address format: {e}")


def _validate_typed_data_structure(typed_data: dict) -> tuple[bool, List[str]]:
    """
    Validate EIP-712 typed data structure.
    
    Returns: (is_valid, list_of_errors)
    """
    errors = []
    
    # Check required top-level fields
    required_fields = ["types", "primaryType", "domain", "message"]
    for field in required_fields:
        if field not in typed_data:
            errors.append(f"Missing required field: '{field}'")
    
    if errors:
        return False, errors
    
    # Validate types
    types = typed_data.get("types", {})
    if not isinstance(types, dict):
        errors.append("'types' must be an object")
    elif "EIP712Domain" not in types:
        errors.append("'types' must include 'EIP712Domain'")
    
    # Validate primaryType exists in types
    primary_type = typed_data.get("primaryType", "")
    if primary_type and types and primary_type not in types:
        errors.append(f"primaryType '{primary_type}' not found in types")
    
    # Validate domain
    domain = typed_data.get("domain", {})
    if not isinstance(domain, dict):
        errors.append("'domain' must be an object")
    
    # Validate message
    message = typed_data.get("message", {})
    if not isinstance(message, dict):
        errors.append("'message' must be an object")
    
    return len(errors) == 0, errors


def _validate_typed_data(typed_data: dict) -> dict:
    """
    Validate typed data and return normalized version.
    Raises InvalidTypedDataError if invalid.
    """
    is_valid, errors = _validate_typed_data_structure(typed_data)
    
    if not is_valid:
        raise InvalidTypedDataError(
            f"Invalid EIP-712 typed data: {'; '.join(errors)}"
        )
    
    return typed_data


# ============================================================================
# Helper Functions
# ============================================================================

def _extract_signature_components(signed) -> dict:
    """Extract signature components from a signed message object."""
    sig_hex = signed.signature.hex()
    if not sig_hex.startswith('0x'):
        sig_hex = '0x' + sig_hex
    
    return {
        "signature": sig_hex,
        "v": signed.v,
        "r": hex(signed.r),
        "s": hex(signed.s)
    }


def _extract_message_hash(signed) -> str:
    """Extract message hash from a signed message object."""
    msg_hash = getattr(signed, 'message_hash', None) or getattr(signed, 'messageHash', None)
    if msg_hash:
        hash_hex = msg_hash.hex()
        if not hash_hex.startswith('0x'):
            hash_hex = '0x' + hash_hex
        return hash_hex
    return ""


# ============================================================================
# Tool Registration
# ============================================================================

def register_typed_data_tools(server: Server) -> None:
    """
    Register all typed data tools with the MCP server.
    
    Args:
        server: MCP Server instance to register tools with
    """
    
    @server.tool()
    async def sign_typed_data(typed_data: dict, private_key: str) -> dict:
        """
        Sign EIP-712 typed structured data.
        
        Used for signing permits, exchange orders, gasless approvals, and other
        structured data in DeFi protocols. EIP-712 provides human-readable
        signing that shows users exactly what they're signing.
        
        Args:
            typed_data: EIP-712 typed data object containing:
                - types: Type definitions including EIP712Domain
                - primaryType: Name of the primary type being signed
                - domain: Domain separator values (name, version, chainId, verifyingContract)
                - message: The actual message data to sign
            private_key: Hex-encoded private key (with or without 0x)
        
        Returns:
            Dictionary containing:
            - primary_type: What type was signed
            - domain: Domain information
            - signer_address: Address that signed
            - signature: Full signature (0x prefixed)
            - signature_components: {v, r, s}
            - message_hash: EIP-712 hash that was signed
            - domain_separator: Computed domain separator hash
        
        Example:
            >>> typed_data = {
            ...     "types": {"EIP712Domain": [...], "Permit": [...]},
            ...     "primaryType": "Permit",
            ...     "domain": {"name": "USDC", "chainId": 1, ...},
            ...     "message": {"owner": "0x...", "spender": "0x...", ...}
            ... }
            >>> result = await sign_typed_data(typed_data, "0x...")
        """
        try:
            # Validate inputs
            key = _validate_private_key(private_key)
            validated_data = _validate_typed_data(typed_data)
            
            # Create account
            account = Account.from_key(key)
            
            # Encode and sign typed data
            signable = encode_typed_data(full_message=validated_data)
            signed = account.sign_message(signable)
            
            # Extract components
            components = _extract_signature_components(signed)
            msg_hash = _extract_message_hash(signed)
            
            # Try to extract domain separator
            domain_separator = ""
            try:
                # The domain separator is part of the signable message
                domain_sep = getattr(signable, 'header', None)
                if domain_sep:
                    domain_separator = '0x' + keccak(domain_sep).hex()
            except Exception:
                pass
            
            return {
                "primary_type": validated_data.get("primaryType"),
                "domain": validated_data.get("domain"),
                "signer_address": account.address,
                "signature": components["signature"],
                "signature_components": {
                    "v": components["v"],
                    "r": components["r"],
                    "s": components["s"]
                },
                "message_hash": msg_hash,
                "domain_separator": domain_separator
            }
            
        except InvalidKeyError as e:
            return e.to_dict()
        except InvalidTypedDataError as e:
            return e.to_dict()
        except Exception as e:
            return {"error": True, "code": "SIGNING_ERROR", "message": str(e)}
    
    
    @server.tool()
    async def verify_typed_data(
        typed_data: dict,
        signature: str,
        expected_address: str
    ) -> dict:
        """
        Verify an EIP-712 typed data signature.
        
        This recovers the signer address from the signature and compares it
        to the expected address to verify the signature is valid.
        
        Args:
            typed_data: Original EIP-712 typed data that was signed
            signature: Signature to verify (0x prefixed hex)
            expected_address: Address expected to have signed
        
        Returns:
            Dictionary containing:
            - primary_type: What type was signed
            - expected_address: Normalized expected address
            - recovered_address: Address recovered from signature
            - is_valid: True if recovered matches expected
            - domain: Domain information from typed data
        
        Example:
            >>> result = await verify_typed_data(typed_data, "0x...", "0x742d...")
            >>> result["is_valid"]  # True or False
        """
        try:
            # Validate inputs
            sig = _validate_signature(signature)
            expected = _validate_address(expected_address)
            validated_data = _validate_typed_data(typed_data)
            
            # Encode typed data and recover signer
            signable = encode_typed_data(full_message=validated_data)
            recovered = Account.recover_message(signable, signature=sig)
            recovered_normalized = to_checksum_address(recovered)
            
            # Compare addresses (case-insensitive)
            is_valid = expected.lower() == recovered_normalized.lower()
            
            return {
                "primary_type": validated_data.get("primaryType"),
                "expected_address": expected,
                "recovered_address": recovered_normalized,
                "is_valid": is_valid,
                "domain": validated_data.get("domain")
            }
            
        except InvalidSignatureError as e:
            return e.to_dict()
        except InvalidAddressError as e:
            return e.to_dict()
        except InvalidTypedDataError as e:
            return e.to_dict()
        except Exception as e:
            return {"error": True, "code": "VERIFICATION_ERROR", "message": str(e)}
    
    
    @server.tool()
    async def recover_typed_data_signer(typed_data: dict, signature: str) -> dict:
        """
        Recover the signer address from signed EIP-712 typed data.
        
        Use this when you have a signature and want to know who signed
        the typed data, without having an expected address to compare.
        
        Args:
            typed_data: Original EIP-712 typed data
            signature: The signature (0x prefixed hex)
        
        Returns:
            Dictionary containing:
            - primary_type: What type was signed
            - recovered_address: Address that signed the data
            - domain: Domain information
            - message_hash: Hash that was signed
        
        Example:
            >>> result = await recover_typed_data_signer(typed_data, "0x...")
            >>> result["recovered_address"]  # "0x742d35Cc..."
        """
        try:
            # Validate inputs
            sig = _validate_signature(signature)
            validated_data = _validate_typed_data(typed_data)
            
            # Encode typed data and recover signer
            signable = encode_typed_data(full_message=validated_data)
            recovered = Account.recover_message(signable, signature=sig)
            recovered_normalized = to_checksum_address(recovered)
            
            # Calculate message hash
            msg_hash = keccak(signable.body)
            msg_hash_hex = '0x' + msg_hash.hex()
            
            return {
                "primary_type": validated_data.get("primaryType"),
                "recovered_address": recovered_normalized,
                "domain": validated_data.get("domain"),
                "message_hash": msg_hash_hex
            }
            
        except InvalidSignatureError as e:
            return e.to_dict()
        except InvalidTypedDataError as e:
            return e.to_dict()
        except Exception as e:
            return {"error": True, "code": "RECOVERY_ERROR", "message": str(e)}
    
    
    @server.tool()
    async def hash_typed_data(typed_data: dict) -> dict:
        """
        Compute the EIP-712 hash of typed data without signing.
        
        Useful for debugging or verifying that your hash computation
        matches an expected value before signing.
        
        Args:
            typed_data: EIP-712 typed data to hash
        
        Returns:
            Dictionary containing:
            - primary_type: What type was hashed
            - struct_hash: Hash of the primary struct
            - domain_separator: Domain separator hash
            - message_hash: Final signing hash (what would be signed)
            - encoding_details: Breakdown of encoding components
        
        Example:
            >>> result = await hash_typed_data(typed_data)
            >>> result["message_hash"]  # "0xabc..."
        """
        try:
            # Validate typed data
            validated_data = _validate_typed_data(typed_data)
            
            # Encode typed data
            signable = encode_typed_data(full_message=validated_data)
            
            # Extract components - the signable has header and body
            # Header contains domain info, body contains the struct
            domain_separator = ""
            struct_hash = ""
            
            try:
                # Body contains the full signing message
                body = signable.body
                
                # For EIP-712, the body format is:
                # 0x1901 || domainSeparator || structHash
                if body and len(body) >= 66:  # 2 bytes + 32 + 32
                    domain_separator = '0x' + body[2:34].hex()
                    struct_hash = '0x' + body[34:66].hex()
            except Exception:
                pass
            
            # Calculate final message hash
            message_hash = keccak(signable.body)
            message_hash_hex = '0x' + message_hash.hex()
            
            return {
                "primary_type": validated_data.get("primaryType"),
                "struct_hash": struct_hash,
                "domain_separator": domain_separator,
                "message_hash": message_hash_hex,
                "encoding_details": {
                    "domain": validated_data.get("domain"),
                    "message": validated_data.get("message"),
                    "types": list(validated_data.get("types", {}).keys())
                }
            }
            
        except InvalidTypedDataError as e:
            return e.to_dict()
        except Exception as e:
            return {"error": True, "code": "HASH_ERROR", "message": str(e)}
    
    
    @server.tool()
    async def generate_typed_data_template(
        template_type: str,
        chain_id: int = 1,
        contract_address: Optional[str] = None
    ) -> dict:
        """
        Generate a template EIP-712 typed data structure for common use cases.
        
        This provides ready-to-use templates for common DeFi operations like
        permits, orders, and delegations. Just fill in the required fields.
        
        Args:
            template_type: Type of template to generate. One of:
                - "permit": ERC20 Permit (EIP-2612) for gasless approvals
                - "permit2": Uniswap Permit2 for universal token approvals
                - "order": DEX order for limit orders
                - "delegation": Delegation signature for voting power
                - "mail": Simple mail example from EIP-712 spec
                - "custom": Empty template to customize
            chain_id: Chain ID for the domain (default: 1 for mainnet)
            contract_address: Verifying contract address (optional)
        
        Returns:
            Dictionary containing:
            - template: Complete EIP-712 structure to fill in
            - description: Explanation of the template
            - required_fields: Fields that must be filled
            - example_values: Example values for each field
        
        Example:
            >>> result = await generate_typed_data_template("permit", 137)
            >>> # Returns template for ERC-20 permit on Polygon
        """
        try:
            # Normalize template type
            template_type_lower = template_type.lower().strip()
            
            # Check if template exists
            if template_type_lower not in TYPED_DATA_TEMPLATES:
                available = ", ".join(TYPED_DATA_TEMPLATES.keys())
                return {
                    "error": True,
                    "code": "INVALID_TEMPLATE_TYPE",
                    "message": f"Unknown template type: '{template_type}'. Available: {available}"
                }
            
            # Get template info
            template_info = TYPED_DATA_TEMPLATES[template_type_lower]
            
            # Deep copy template to avoid modifying original
            template = deepcopy(template_info["template"])
            
            # Update chain_id
            template["domain"]["chainId"] = chain_id
            
            # Update contract address if provided
            if contract_address:
                try:
                    normalized_address = _validate_address(contract_address)
                    template["domain"]["verifyingContract"] = normalized_address
                except InvalidAddressError as e:
                    return e.to_dict()
            
            # Add deadline examples based on current time
            current_time = int(time.time())
            deadline_examples = {
                "1_hour": current_time + 3600,
                "1_day": current_time + 86400,
                "1_week": current_time + 604800,
                "1_month": current_time + 2592000,
                "max_uint256": "115792089237316195423570985008687907853269984665640564039457584007913129639935"
            }
            
            return {
                "template": template,
                "description": template_info["description"],
                "required_fields": template_info["required_fields"],
                "example_values": template_info["example_values"],
                "chain_id": chain_id,
                "deadline_examples": deadline_examples,
                "usage_notes": (
                    f"Fill in the required fields before signing. "
                    f"The template is configured for chain ID {chain_id}. "
                    f"Remember to set appropriate deadline values based on your use case."
                )
            }
            
        except Exception as e:
            return {"error": True, "code": "TEMPLATE_ERROR", "message": str(e)}
