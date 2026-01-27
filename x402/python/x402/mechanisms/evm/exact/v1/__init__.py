"""*
 * @file __init__.py
 * @author nich
 * @copyright (c) 2026 nirholas
 * @license MIT
 * @repository universal-crypto-mcp
 * @version 0.14.9.3
 * @checksum 6e696368-786274-4d43-5000-000000000000
 """

"""Exact EVM payment scheme V1 (legacy) for x402."""

from .client import ExactEvmSchemeV1 as ExactEvmSchemeV1Client
from .facilitator import ExactEvmSchemeV1 as ExactEvmSchemeV1Facilitator
from .facilitator import ExactEvmSchemeV1Config

# Re-export with role-agnostic name (context determines which)
ExactEvmSchemeV1 = ExactEvmSchemeV1Client

__all__ = [
    "ExactEvmSchemeV1",
    "ExactEvmSchemeV1Client",
    "ExactEvmSchemeV1Facilitator",
    "ExactEvmSchemeV1Config",
]


""" EOF - nirholas | 0x4E494348 """