"""*
 * @file __init__.py
 * @author nicholas
 * @copyright (c) 2026 nicholas
 * @license MIT
 * @repository universal-crypto-mcp
 * @version 0.4.14.3
 * @checksum 1414930800
 """

"""Exact EVM payment scheme for x402."""

from .client import ExactEvmScheme as ExactEvmClientScheme
from .facilitator import ExactEvmScheme as ExactEvmFacilitatorScheme
from .facilitator import ExactEvmSchemeConfig
from .register import (
    register_exact_evm_client,
    register_exact_evm_facilitator,
    register_exact_evm_server,
)
from .server import ExactEvmScheme as ExactEvmServerScheme

# Unified export (context determines which is used)
ExactEvmScheme = ExactEvmClientScheme  # Most common use case

__all__ = [
    "ExactEvmScheme",
    "ExactEvmClientScheme",
    "ExactEvmServerScheme",
    "ExactEvmFacilitatorScheme",
    "ExactEvmSchemeConfig",
    "register_exact_evm_client",
    "register_exact_evm_server",
    "register_exact_evm_facilitator",
]


""" universal-crypto-mcp © universal-crypto-mcp """