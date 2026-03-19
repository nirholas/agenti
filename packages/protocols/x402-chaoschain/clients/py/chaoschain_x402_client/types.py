"""
Type definitions for the ChaosChain x402 client.
"""

from typing import Optional, Dict, Any, List
from pydantic import BaseModel, Field


class PaymentRequirements(BaseModel):
    """
    Payment requirements specifying what the resource server accepts.
    """

    scheme: str = Field(..., description="Payment scheme (e.g., 'exact')")
    network: str = Field(..., description="Blockchain network (e.g., 'base-sepolia')")
    maxAmountRequired: str = Field(
        ..., description="Maximum amount in atomic units (string to handle large numbers)"
    )
    resource: str = Field(..., description="Resource identifier/URL")
    payTo: str = Field(..., description="Payment recipient address")
    asset: str = Field(..., description="Payment asset contract address")
    description: Optional[str] = Field(None, description="Human-readable description")
    mimeType: Optional[str] = Field(None, description="MIME type of the resource")
    maxTimeoutSeconds: Optional[int] = Field(
        None, description="Maximum timeout for the operation"
    )
    extra: Optional[Dict[str, Any]] = Field(
        None, description="Additional scheme-specific data"
    )


class VerifyResponse(BaseModel):
    """
    Response from the verify endpoint.
    """

    isValid: bool = Field(..., description="Whether the payment is valid")
    invalidReason: Optional[str] = Field(
        None, description="Reason if payment is invalid"
    )
    consensusProof: Optional[str] = Field(
        None, description="CRE consensus proof (ChaosChain extension)"
    )
    reportId: Optional[str] = Field(
        None, description="Report identifier (ChaosChain extension)"
    )
    timestamp: Optional[int] = Field(
        None, description="Unix timestamp (ChaosChain extension)"
    )


class SettleResponse(BaseModel):
    """
    Response from the settle endpoint.
    """

    success: bool = Field(..., description="Whether settlement succeeded")
    error: Optional[str] = Field(None, description="Error message if failed")
    txHash: Optional[str] = Field(None, description="Transaction hash")
    networkId: Optional[str] = Field(None, description="Network identifier")
    consensusProof: Optional[str] = Field(
        None, description="CRE consensus proof (ChaosChain extension)"
    )
    timestamp: Optional[int] = Field(
        None, description="Unix timestamp (ChaosChain extension)"
    )


class SchemeNetworkPair(BaseModel):
    """
    A (scheme, network) pair supported by the facilitator.
    """

    scheme: str
    network: str


class SupportedSchemesResponse(BaseModel):
    """
    Response from the /supported endpoint listing supported schemes.
    """

    kinds: List[SchemeNetworkPair] = Field(
        ..., description="List of supported (scheme, network) pairs"
    )


class ServiceInfo(BaseModel):
    """
    Service information from health check.
    """

    service: str
    version: str
    mode: str
    endpoints: Optional[Dict[str, str]] = None
    docs: Optional[str] = None

