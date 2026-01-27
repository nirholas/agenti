"""
Function Selector Tools

Implements encode_function_selector and decode_function_selector.
"""

import re
from mcp.server.fastmcp import FastMCP
from eth_utils import keccak


# Common function selectors database
KNOWN_SELECTORS = {
    # ERC-20
    "0xa9059cbb": {"signature": "transfer(address,uint256)", "category": "ERC20", "description": "Transfer tokens"},
    "0x095ea7b3": {"signature": "approve(address,uint256)", "category": "ERC20", "description": "Approve spender"},
    "0x23b872dd": {"signature": "transferFrom(address,address,uint256)", "category": "ERC20", "description": "Transfer from"},
    "0x70a08231": {"signature": "balanceOf(address)", "category": "ERC20", "description": "Get balance"},
    "0xdd62ed3e": {"signature": "allowance(address,address)", "category": "ERC20", "description": "Check allowance"},
    "0x18160ddd": {"signature": "totalSupply()", "category": "ERC20", "description": "Total supply"},
    "0x06fdde03": {"signature": "name()", "category": "ERC20", "description": "Token name"},
    "0x95d89b41": {"signature": "symbol()", "category": "ERC20", "description": "Token symbol"},
    "0x313ce567": {"signature": "decimals()", "category": "ERC20", "description": "Token decimals"},
    
    # ERC-721
    "0x42842e0e": {"signature": "safeTransferFrom(address,address,uint256)", "category": "ERC721", "description": "Safe transfer NFT"},
    "0xb88d4fde": {"signature": "safeTransferFrom(address,address,uint256,bytes)", "category": "ERC721", "description": "Safe transfer with data"},
    "0x6352211e": {"signature": "ownerOf(uint256)", "category": "ERC721", "description": "Get NFT owner"},
    "0xa22cb465": {"signature": "setApprovalForAll(address,bool)", "category": "ERC721", "description": "Set operator approval"},
    "0xe985e9c5": {"signature": "isApprovedForAll(address,address)", "category": "ERC721", "description": "Check operator approval"},
    "0x081812fc": {"signature": "getApproved(uint256)", "category": "ERC721", "description": "Get approved address"},
    "0xc87b56dd": {"signature": "tokenURI(uint256)", "category": "ERC721", "description": "Get token URI"},
    
    # ERC-1155
    "0xf242432a": {"signature": "safeTransferFrom(address,address,uint256,uint256,bytes)", "category": "ERC1155", "description": "Safe transfer"},
    "0x2eb2c2d6": {"signature": "safeBatchTransferFrom(address,address,uint256[],uint256[],bytes)", "category": "ERC1155", "description": "Batch transfer"},
    "0x00fdd58e": {"signature": "balanceOf(address,uint256)", "category": "ERC1155", "description": "Get balance"},
    "0x4e1273f4": {"signature": "balanceOfBatch(address[],uint256[])", "category": "ERC1155", "description": "Batch balance"},
    
    # Common DeFi
    "0x7ff36ab5": {"signature": "swapExactETHForTokens(uint256,address[],address,uint256)", "category": "DeFi", "description": "Swap ETH for tokens"},
    "0x38ed1739": {"signature": "swapExactTokensForTokens(uint256,uint256,address[],address,uint256)", "category": "DeFi", "description": "Swap tokens"},
    "0xe8e33700": {"signature": "addLiquidity(address,address,uint256,uint256,uint256,uint256,address,uint256)", "category": "DeFi", "description": "Add liquidity"},
    "0xbaa2abde": {"signature": "removeLiquidity(address,address,uint256,uint256,uint256,address,uint256)", "category": "DeFi", "description": "Remove liquidity"},
    
    # Proxy patterns
    "0x5c60da1b": {"signature": "implementation()", "category": "Proxy", "description": "Get implementation"},
    "0x3659cfe6": {"signature": "upgradeTo(address)", "category": "Proxy", "description": "Upgrade implementation"},
    "0x4f1ef286": {"signature": "upgradeToAndCall(address,bytes)", "category": "Proxy", "description": "Upgrade and call"},
    
    # Ownership
    "0x8da5cb5b": {"signature": "owner()", "category": "Ownership", "description": "Get owner"},
    "0xf2fde38b": {"signature": "transferOwnership(address)", "category": "Ownership", "description": "Transfer ownership"},
    "0x715018a6": {"signature": "renounceOwnership()", "category": "Ownership", "description": "Renounce ownership"},
    
    # Permit (EIP-2612)
    "0xd505accf": {"signature": "permit(address,address,uint256,uint256,uint8,bytes32,bytes32)", "category": "Permit", "description": "EIP-2612 permit"},
    "0x7ecebe00": {"signature": "nonces(address)", "category": "Permit", "description": "Get nonce"},
    "0x3644e515": {"signature": "DOMAIN_SEPARATOR()", "category": "Permit", "description": "EIP-712 domain"},
}


def encode_function_selector_impl(function_signature: str) -> dict:
    """
    Encode function signature to 4-byte selector.
    
    Computes the keccak256 hash of the function signature and returns
    the first 4 bytes as the function selector.
    
    Args:
        function_signature: Function signature (e.g., "transfer(address,uint256)")
    
    Returns:
        Dictionary containing:
        - selector: 4-byte function selector (0x + 8 hex chars)
        - full_hash: Complete keccak256 hash
        - function_signature: Input signature
        - normalized_signature: Cleaned signature
        - parameter_types: List of parameter types
        - function_name: Function name only
    """
    if not function_signature or not isinstance(function_signature, str):
        return {
            "error": True,
            "code": "INVALID_SIGNATURE",
            "message": "Function signature must be a non-empty string"
        }
    
    # Normalize signature
    sig = function_signature.strip()
    
    # Remove any return type if present
    if " returns" in sig:
        sig = sig.split(" returns")[0].strip()
    
    # Remove extra whitespace
    sig = re.sub(r'\s+', '', sig)
    
    # Parse function name and parameters
    match = re.match(r'^([a-zA-Z_][a-zA-Z0-9_]*)\((.*)\)$', sig)
    if not match:
        return {
            "error": True,
            "code": "INVALID_FORMAT",
            "message": f"Invalid function signature format: {function_signature}"
        }
    
    function_name = match.group(1)
    params_str = match.group(2)
    
    # Parse parameter types
    if params_str:
        # Handle nested tuples by not splitting inside parentheses
        params = []
        depth = 0
        current = ""
        for char in params_str:
            if char == '(':
                depth += 1
                current += char
            elif char == ')':
                depth -= 1
                current += char
            elif char == ',' and depth == 0:
                params.append(current.strip())
                current = ""
            else:
                current += char
        if current:
            params.append(current.strip())
        parameter_types = params
    else:
        parameter_types = []
    
    # Compute hash
    try:
        full_hash = keccak(text=sig)
        selector = full_hash[:4]
        
        return {
            "selector": "0x" + selector.hex(),
            "full_hash": "0x" + full_hash.hex(),
            "function_signature": function_signature,
            "normalized_signature": sig,
            "parameter_types": parameter_types,
            "function_name": function_name
        }
    except Exception as e:
        return {
            "error": True,
            "code": "HASH_FAILED",
            "message": f"Failed to compute selector: {e}"
        }


def decode_function_selector_impl(selector: str) -> dict:
    """
    Decode 4-byte function selector to signature.
    
    Looks up the selector in a database of known function signatures.
    Note: Some selectors may have collisions (multiple functions with same selector).
    
    Args:
        selector: 4-byte selector (0x + 8 hex chars)
    
    Returns:
        Dictionary containing:
        - selector: Input selector (normalized)
        - known_signatures: List of known function signatures
        - most_likely: Most likely signature (if known)
        - collision_count: Number of known signatures
        - is_known: Whether selector is in database
        - category: Function category (if known)
        - description: Function description (if known)
    """
    # Normalize selector
    sel = selector.strip().lower() if selector else ""
    if sel.startswith('0x'):
        sel = sel[2:]
    
    # Validate format
    if len(sel) != 8:
        return {
            "error": True,
            "code": "INVALID_LENGTH",
            "message": f"Selector must be 4 bytes (8 hex chars). Got: {len(sel)}"
        }
    
    try:
        int(sel, 16)
    except ValueError:
        return {
            "error": True,
            "code": "INVALID_HEX",
            "message": "Selector contains non-hex characters"
        }
    
    normalized = "0x" + sel
    
    # Look up in database
    if normalized in KNOWN_SELECTORS:
        info = KNOWN_SELECTORS[normalized]
        return {
            "selector": normalized,
            "known_signatures": [info["signature"]],
            "most_likely": info["signature"],
            "collision_count": 1,
            "is_known": True,
            "category": info["category"],
            "description": info["description"]
        }
    
    return {
        "selector": normalized,
        "known_signatures": [],
        "most_likely": None,
        "collision_count": 0,
        "is_known": False,
        "category": None,
        "description": None
    }


def register_selector_tools(server: FastMCP) -> None:
    """Register function selector tools with the MCP server."""
    
    @server.tool()
    async def encode_function_selector(
        function_signature: str
    ) -> dict:
        """
        Encode function signature to 4-byte selector.
        
        Computes the keccak256 hash of the function signature and returns
        the first 4 bytes as the function selector.
        
        Args:
            function_signature: Function signature (e.g., "transfer(address,uint256)")
        
        Returns:
            Dictionary containing:
            - selector: 4-byte function selector (0x + 8 hex chars)
            - full_hash: Complete keccak256 hash
            - function_signature: Input signature
            - normalized_signature: Cleaned signature
            - parameter_types: List of parameter types
            - function_name: Function name only
        """
        return encode_function_selector_impl(function_signature)
    
    @server.tool()
    async def decode_function_selector(
        selector: str,
        use_database: bool = True
    ) -> dict:
        """
        Decode 4-byte function selector to signature.
        
        Looks up the selector in a database of known function signatures.
        Note: Some selectors may have collisions (multiple functions with same selector).
        
        Args:
            selector: 4-byte selector (0x + 8 hex chars)
            use_database: Whether to look up in known signatures database
        
        Returns:
            Dictionary containing:
            - selector: Input selector (normalized)
            - known_signatures: List of known function signatures
            - most_likely: Most likely signature (if known)
            - collision_count: Number of known signatures
            - is_known: Whether selector is in database
            - category: Function category (if known)
            - description: Function description (if known)
        """
        return decode_function_selector_impl(selector)
