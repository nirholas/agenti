"""
MAC (Message Authentication Code) Operations for Keystore Integrity

Implements Keccak-256 MAC following Web3 Secret Storage V3.
"""

import hmac
from eth_utils import keccak


def compute_mac(derived_key: bytes, ciphertext: bytes) -> bytes:
    """
    Compute MAC for keystore integrity verification.
    
    MAC = Keccak256(derivedKey[16:32] + ciphertext)
    
    Args:
        derived_key: Full derived key (32 bytes)
        ciphertext: Encrypted private key
        
    Returns:
        32-byte MAC value
    """
    # Use last 16 bytes of derived key for MAC
    mac_key = derived_key[16:32]
    
    # Concatenate MAC key and ciphertext
    mac_input = mac_key + ciphertext
    
    # Compute Keccak-256 hash
    mac = keccak(mac_input)
    
    return mac


def verify_mac(
    derived_key: bytes,
    ciphertext: bytes,
    expected_mac: bytes
) -> bool:
    """
    Verify MAC for keystore integrity.
    
    Uses constant-time comparison to prevent timing attacks.
    
    Args:
        derived_key: Full derived key (32 bytes)
        ciphertext: Encrypted private key
        expected_mac: MAC from keystore
        
    Returns:
        True if MAC matches, False otherwise
    """
    computed_mac = compute_mac(derived_key, ciphertext)
    
    # Constant-time comparison
    return hmac.compare_digest(computed_mac, expected_mac)
