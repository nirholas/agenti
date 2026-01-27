"""
Key Derivation Functions for Keystore Encryption

Implements scrypt and PBKDF2 key derivation following Web3 Secret Storage V3.
"""

import secrets
from dataclasses import dataclass
from typing import Literal

from cryptography.hazmat.primitives.kdf.scrypt import Scrypt
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.backends import default_backend


# Standard parameters for scrypt
SCRYPT_N_STANDARD = 262144  # 2^18
SCRYPT_R = 8
SCRYPT_P = 1
SCRYPT_DKLEN = 32
SCRYPT_SALT_LENGTH = 32

# Standard parameters for PBKDF2
PBKDF2_ITERATIONS_STANDARD = 262144
PBKDF2_DKLEN = 32
PBKDF2_SALT_LENGTH = 32

# Light parameters (faster but less secure)
SCRYPT_N_LIGHT = 4096  # 2^12
PBKDF2_ITERATIONS_LIGHT = 10000


@dataclass
class KDFParams:
    """Key derivation function parameters."""
    kdf: Literal["scrypt", "pbkdf2"]
    salt: bytes
    dklen: int
    # Scrypt-specific
    n: int | None = None
    r: int | None = None
    p: int | None = None
    # PBKDF2-specific
    c: int | None = None
    prf: str | None = None


def derive_key_scrypt(
    password: str,
    salt: bytes | None = None,
    n: int = SCRYPT_N_STANDARD,
    r: int = SCRYPT_R,
    p: int = SCRYPT_P,
    dklen: int = SCRYPT_DKLEN
) -> tuple[bytes, KDFParams]:
    """
    Derive encryption key using scrypt.
    
    Args:
        password: Password string (UTF-8 encoded)
        salt: Random salt (generated if None)
        n: CPU/memory cost parameter (power of 2)
        r: Block size parameter
        p: Parallelization parameter
        dklen: Derived key length in bytes
        
    Returns:
        Tuple of (derived_key, kdf_params)
    """
    if salt is None:
        salt = secrets.token_bytes(SCRYPT_SALT_LENGTH)
    
    # Encode password as UTF-8
    password_bytes = password.encode('utf-8')
    
    # Create scrypt KDF
    kdf = Scrypt(
        salt=salt,
        length=dklen,
        n=n,
        r=r,
        p=p,
        backend=default_backend()
    )
    
    # Derive key
    derived_key = kdf.derive(password_bytes)
    
    # Create params object
    params = KDFParams(
        kdf="scrypt",
        salt=salt,
        dklen=dklen,
        n=n,
        r=r,
        p=p
    )
    
    return derived_key, params


def derive_key_pbkdf2(
    password: str,
    salt: bytes | None = None,
    iterations: int = PBKDF2_ITERATIONS_STANDARD,
    dklen: int = PBKDF2_DKLEN
) -> tuple[bytes, KDFParams]:
    """
    Derive encryption key using PBKDF2-HMAC-SHA256.
    
    Args:
        password: Password string (UTF-8 encoded)
        salt: Random salt (generated if None)
        iterations: Number of iterations
        dklen: Derived key length in bytes
        
    Returns:
        Tuple of (derived_key, kdf_params)
    """
    if salt is None:
        salt = secrets.token_bytes(PBKDF2_SALT_LENGTH)
    
    # Encode password as UTF-8
    password_bytes = password.encode('utf-8')
    
    # Create PBKDF2 KDF
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=dklen,
        salt=salt,
        iterations=iterations,
        backend=default_backend()
    )
    
    # Derive key
    derived_key = kdf.derive(password_bytes)
    
    # Create params object
    params = KDFParams(
        kdf="pbkdf2",
        salt=salt,
        dklen=dklen,
        c=iterations,
        prf="hmac-sha256"
    )
    
    return derived_key, params


def get_kdf_params(
    kdf: Literal["scrypt", "pbkdf2"],
    security_level: Literal["standard", "light", "custom"] = "standard",
    custom_params: dict | None = None
) -> dict:
    """
    Get KDF parameters for specified security level.
    
    Args:
        kdf: Key derivation function name
        security_level: Security level preset
        custom_params: Custom parameters (for "custom" level)
        
    Returns:
        Dictionary of KDF parameters
    """
    if kdf == "scrypt":
        if security_level == "standard":
            return {
                "n": SCRYPT_N_STANDARD,
                "r": SCRYPT_R,
                "p": SCRYPT_P,
                "dklen": SCRYPT_DKLEN
            }
        elif security_level == "light":
            return {
                "n": SCRYPT_N_LIGHT,
                "r": SCRYPT_R,
                "p": SCRYPT_P,
                "dklen": SCRYPT_DKLEN
            }
        elif security_level == "custom" and custom_params:
            return {
                "n": custom_params.get("n", SCRYPT_N_STANDARD),
                "r": custom_params.get("r", SCRYPT_R),
                "p": custom_params.get("p", SCRYPT_P),
                "dklen": custom_params.get("dklen", SCRYPT_DKLEN)
            }
    
    elif kdf == "pbkdf2":
        if security_level == "standard":
            return {
                "c": PBKDF2_ITERATIONS_STANDARD,
                "dklen": PBKDF2_DKLEN,
                "prf": "hmac-sha256"
            }
        elif security_level == "light":
            return {
                "c": PBKDF2_ITERATIONS_LIGHT,
                "dklen": PBKDF2_DKLEN,
                "prf": "hmac-sha256"
            }
        elif security_level == "custom" and custom_params:
            return {
                "c": custom_params.get("c", PBKDF2_ITERATIONS_STANDARD),
                "dklen": custom_params.get("dklen", PBKDF2_DKLEN),
                "prf": "hmac-sha256"
            }
    
    raise ValueError(f"Unknown KDF or security level: {kdf}, {security_level}")


def assess_kdf_strength(kdf: str, params: dict) -> dict:
    """
    Assess the security strength of KDF parameters.
    
    Args:
        kdf: KDF name ("scrypt" or "pbkdf2")
        params: KDF parameters
        
    Returns:
        Security assessment dictionary
    """
    if kdf == "scrypt":
        n = params.get("n", 0)
        r = params.get("r", 8)
        p = params.get("p", 1)
        
        # Calculate memory requirement: 128 * N * r * p bytes
        memory_bytes = 128 * n * r * p
        memory_mb = memory_bytes / (1024 * 1024)
        
        if n >= SCRYPT_N_STANDARD:
            strength = "standard"
            crack_time = "centuries"
            recommendations = []
        elif n >= 131072:  # 2^17
            strength = "moderate"
            crack_time = "years"
            recommendations = ["Consider upgrading to N=262144 for better security"]
        elif n >= SCRYPT_N_LIGHT:
            strength = "light"
            crack_time = "months"
            recommendations = [
                "Upgrade to standard parameters for production use",
                "Current parameters suitable only for development"
            ]
        else:
            strength = "weak"
            crack_time = "days"
            recommendations = [
                "URGENT: Upgrade immediately - parameters are insecure",
                "Re-encrypt with standard parameters"
            ]
        
        return {
            "kdf_strength": strength,
            "estimated_crack_time": crack_time,
            "memory_requirement_mb": round(memory_mb, 2),
            "recommendations": recommendations
        }
    
    elif kdf == "pbkdf2":
        iterations = params.get("c", 0)
        
        if iterations >= PBKDF2_ITERATIONS_STANDARD:
            strength = "standard"
            crack_time = "years"
            recommendations = ["Consider scrypt for better resistance to hardware attacks"]
        elif iterations >= 100000:
            strength = "moderate"
            crack_time = "months"
            recommendations = [
                "Consider increasing iterations to 262144",
                "Consider migrating to scrypt"
            ]
        elif iterations >= PBKDF2_ITERATIONS_LIGHT:
            strength = "light"
            crack_time = "weeks"
            recommendations = [
                "Upgrade to standard parameters",
                "PBKDF2 with low iterations is vulnerable to GPU attacks"
            ]
        else:
            strength = "weak"
            crack_time = "hours"
            recommendations = [
                "URGENT: Re-encrypt immediately",
                "Use minimum 262144 iterations for PBKDF2"
            ]
        
        return {
            "kdf_strength": strength,
            "estimated_crack_time": crack_time,
            "iterations": iterations,
            "recommendations": recommendations
        }
    
    return {
        "kdf_strength": "unknown",
        "estimated_crack_time": "unknown",
        "recommendations": ["Unknown KDF - cannot assess security"]
    }
