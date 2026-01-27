"""
Storage Slot Calculation Tools

Implements calculate_storage_slot tool.
"""

from mcp.server.fastmcp import FastMCP
from eth_utils import keccak


def calculate_storage_slot_impl(base_slot: str, key: str = None, slot_type: str = "simple") -> dict:
    """
    Calculate contract storage slot positions.
    
    Computes storage slot locations for Solidity storage layouts,
    supporting simple slots, mappings, and dynamic arrays.
    
    Args:
        base_slot: Base storage slot (hex string, position in contract storage)
        key: Mapping key (for mapping types) - address or uint256
        slot_type: "simple", "mapping", or "dynamic_array"
    
    Returns:
        Dictionary containing:
        - storage_slot: Computed storage slot (0x + 64 hex chars)
        - slot_type: Type of slot computation
        - calculation: Details of calculation method
        - use_with: How to use with eth_getStorageAt
    
    Storage Layout Rules:
        - Simple: slot = declared position (0, 1, 2, ...)
        - Mapping: slot = keccak256(key . base_slot) where . is concatenation
        - Dynamic array: length at base_slot, data at keccak256(base_slot)
    """
    # Parse base slot
    slot = base_slot.strip() if base_slot else "0"
    if slot.startswith('0x') or slot.startswith('0X'):
        slot = slot[2:]
    
    # Pad to 32 bytes (64 hex chars)
    try:
        slot_int = int(slot, 16)
        slot_padded = slot_int.to_bytes(32, 'big')
    except ValueError as e:
        return {
            "error": True,
            "code": "INVALID_SLOT",
            "message": f"Invalid base slot: {e}"
        }
    
    if slot_type == "simple":
        # Simple slot - just return the base slot padded
        return {
            "storage_slot": "0x" + slot_padded.hex(),
            "slot_type": "simple",
            "calculation": {
                "method": "direct position",
                "base_slot": "0x" + slot_padded.hex(),
                "formula": "slot = base_slot"
            },
            "use_with": f"eth_getStorageAt(contract, 0x{slot_padded.hex()})"
        }
    
    elif slot_type == "mapping":
        if not key:
            return {
                "error": True,
                "code": "MISSING_KEY",
                "message": "Mapping type requires a key parameter"
            }
        
        # Parse key
        key_str = key.strip()
        if key_str.startswith('0x') or key_str.startswith('0X'):
            key_str = key_str[2:]
        
        try:
            # Determine if key is address (20 bytes) or uint256 (32 bytes)
            if len(key_str) <= 40:
                # Treat as address - pad to 32 bytes
                key_int = int(key_str, 16)
                key_padded = key_int.to_bytes(32, 'big')
            else:
                # Treat as uint256
                key_int = int(key_str, 16)
                key_padded = key_int.to_bytes(32, 'big')
        except ValueError as e:
            return {
                "error": True,
                "code": "INVALID_KEY",
                "message": f"Invalid mapping key: {e}"
            }
        
        # mapping slot = keccak256(key . slot)
        # Concatenate key and slot (both 32 bytes)
        data = key_padded + slot_padded
        result_hash = keccak(primitive=data)
        
        return {
            "storage_slot": "0x" + result_hash.hex(),
            "slot_type": "mapping",
            "calculation": {
                "method": "keccak256(key . base_slot)",
                "base_slot": "0x" + slot_padded.hex(),
                "key": "0x" + key_padded.hex(),
                "concatenated": "0x" + data.hex(),
                "formula": "slot = keccak256(abi.encode(key, base_slot))"
            },
            "use_with": f"eth_getStorageAt(contract, 0x{result_hash.hex()})"
        }
    
    elif slot_type == "dynamic_array":
        # Dynamic array:
        # - Length stored at base_slot
        # - Elements stored at keccak256(base_slot) + index
        data_slot = keccak(primitive=slot_padded)
        
        return {
            "storage_slot": "0x" + data_slot.hex(),
            "slot_type": "dynamic_array",
            "calculation": {
                "method": "keccak256(base_slot)",
                "base_slot": "0x" + slot_padded.hex(),
                "length_slot": "0x" + slot_padded.hex(),
                "data_start_slot": "0x" + data_slot.hex(),
                "formula": "length = storage[base_slot], element[i] = storage[keccak256(base_slot) + i]"
            },
            "use_with": f"Length: eth_getStorageAt(contract, 0x{slot_padded.hex()}), Data[0]: eth_getStorageAt(contract, 0x{data_slot.hex()})"
        }
    
    else:
        return {
            "error": True,
            "code": "INVALID_TYPE",
            "message": f"Unknown slot type: {slot_type}. Use 'simple', 'mapping', or 'dynamic_array'"
        }


def register_storage_tools(server: FastMCP) -> None:
    """Register storage slot tools with the MCP server."""
    
    @server.tool()
    async def calculate_storage_slot(
        base_slot: str,
        key: str = None,
        slot_type: str = "simple"
    ) -> dict:
        """
        Calculate contract storage slot positions.
        
        Computes storage slot locations for Solidity storage layouts,
        supporting simple slots, mappings, and dynamic arrays.
        
        Args:
            base_slot: Base storage slot (hex string, position in contract storage)
            key: Mapping key (for mapping types) - address or uint256
            slot_type: "simple", "mapping", or "dynamic_array"
        
        Returns:
            Dictionary containing:
            - storage_slot: Computed storage slot (0x + 64 hex chars)
            - slot_type: Type of slot computation
            - calculation: Details of calculation method
            - use_with: How to use with eth_getStorageAt
        
        Storage Layout Rules:
            - Simple: slot = declared position (0, 1, 2, ...)
            - Mapping: slot = keccak256(key . base_slot) where . is concatenation
            - Dynamic array: length at base_slot, data at keccak256(base_slot)
        """
        return calculate_storage_slot_impl(base_slot, key, slot_type)
