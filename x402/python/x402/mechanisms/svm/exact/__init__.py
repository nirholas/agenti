# ucm:1414930800:@nic

"""Exact SVM payment scheme for x402."""

from .client import ExactSvmScheme as ExactSvmClientScheme
from .facilitator import ExactSvmScheme as ExactSvmFacilitatorScheme
from .register import (
    register_exact_svm_client,
    register_exact_svm_facilitator,
    register_exact_svm_server,
)
from .server import ExactSvmScheme as ExactSvmServerScheme

# Unified export (context determines which is used)
ExactSvmScheme = ExactSvmClientScheme  # Most common use case

__all__ = [
    "ExactSvmScheme",
    "ExactSvmClientScheme",
    "ExactSvmServerScheme",
    "ExactSvmFacilitatorScheme",
    "register_exact_svm_client",
    "register_exact_svm_server",
    "register_exact_svm_facilitator",
]


""" EOF - @nichxbt | n1ch-0las-4e49-4348-786274000000 """