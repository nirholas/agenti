from datetime import datetime
from typing import Annotated, Any, Dict, List, Literal, Optional, Union

from eth_utils.address import is_address
from pydantic import BaseModel, ConfigDict, Field, field_validator
from x402.types import (
    PaymentPayload,
    PaymentRequirements,
)


class ApiClientOptions(BaseModel):
    """Configuration options for the API client."""

    base_url: str
    session_key_private_key: Optional[str] = None
    agent_address: str
    timeout: int = 30000

    @field_validator("agent_address")
    @classmethod
    def validate_agent_address(cls, v: str) -> str:
        if not is_address(v):
            raise ValueError(f"Invalid Ethereum address: {v}")
        return v


class AuthenticationState(BaseModel):
    """Current authentication state."""

    token: Optional[str] = None
    expires_at: Optional[datetime] = None


class PaymentEventSending(BaseModel):
    """Payment is being sent."""

    type: Literal["sending"] = "sending"


class PaymentEventAccepted(BaseModel):
    """Payment was accepted."""

    type: Literal["accepted"] = "accepted"


class PaymentEventRejected(BaseModel):
    """Payment was rejected."""

    type: Literal["rejected"] = "rejected"
    reason: str


class PaymentEventError(BaseModel):
    """Payment encountered an error."""

    type: Literal["error"] = "error"
    reason: str


PaymentEvent = Annotated[
    Union[
        PaymentEventSending,
        PaymentEventAccepted,
        PaymentEventRejected,
        PaymentEventError,
    ],
    Field(discriminator="type"),
]


class ApiRequestAgentPaymentAuthorization(BaseModel):
    """Agent payment authorization request."""

    requirements: List[PaymentRequirements]
    context: Dict[str, Any] | None  # TODO: missing alias generation


class AuthorizedRequirement(BaseModel):
    """Single authorized payment requirement with remaining limits."""

    requirement: PaymentRequirements = Field(
        description="Authorized payment requirement"
    )
    limits: Dict[str, str] = Field(
        description="Remaining spend limits after this requirement (dailyRemaining, monthlyRemaining)"
    )


class RejectedRequirement(BaseModel):
    """Single rejected payment requirement with reason."""

    requirement: PaymentRequirements = Field(description="Rejected payment requirement")
    reason: str = Field(description="Why this requirement was rejected")


class AuthorizedResponse(BaseModel):
    """Authorized requirements with recommendation."""

    recommended: Optional[int] = Field(
        default=None,
        description="Index of recommended requirement (cheapest option). None if no requirements authorized.",
    )
    requirements: List[AuthorizedRequirement] = Field(
        description="List of authorized payment requirements. Empty if none authorized."
    )


class ApiResponseAgentPaymentAuthorization(BaseModel):
    """Agent payment authorization response."""

    authorized: AuthorizedResponse = Field(
        description="Authorized payment requirements with recommendation"
    )
    rejected: List[RejectedRequirement] = Field(
        description="List of rejected payment requirements with reasons"
    )


class ApiRequestAgentPaymentEvent(BaseModel):
    """Agent payment event report."""

    id_: str = Field(serialization_alias="id")
    payment: PaymentPayload
    event: PaymentEvent


class ApiResponseAgentPaymentEvent(BaseModel):
    """Agent payment event response."""

    received: bool
    payment_id: Optional[str] = Field(
        default=None,
        description="Internal payment record ID if created",
        validation_alias="paymentId",
    )

    model_config = ConfigDict(
        validate_by_name=True,
    )


class ApiResponseNonce(BaseModel):
    """Nonce response."""

    nonce: str
    session_id: str = Field(validation_alias="sessionId")

    model_config = ConfigDict(
        validate_by_name=True,
    )


class ApiRequestLogin(BaseModel):
    """SIWE login request."""

    message: str
    signature: str
    session_id: str = Field(serialization_alias="sessionId")
    agent_address: str = Field(serialization_alias="agentAddress")


class ApiResponseLogin(BaseModel):
    """SIWE login response."""

    token: str
    agent_address: str = Field(validation_alias="agentAddress")
    expires_at: str = Field(validation_alias="expiresAt")

    model_config = ConfigDict(
        validate_by_name=True,
    )


class ApiError(Exception):
    """Custom API error with optional status code and response."""

    def __init__(
        self, message: str, status: Optional[int] = None, response: Optional[Any] = None
    ):
        self.status = status
        self.response = response
        super().__init__(message)
