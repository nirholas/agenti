import asyncio
from datetime import datetime
from types import TracebackType
from typing import Any, Dict, List, Optional, Self
from urllib.parse import urlparse

import httpx
from eth_account import Account
from eth_account.messages import encode_defunct
from siwe.siwe import (  # type: ignore[import-untyped]
    ISO8601Datetime,
    SiweMessage,
    VersionEnum,
)
from x402.types import (
    PaymentPayload,
    PaymentRequirements,
)

from .types import (
    ApiClientOptions,
    ApiError,
    ApiRequestAgentPaymentAuthorization,
    ApiRequestAgentPaymentEvent,
    ApiRequestLogin,
    ApiResponseAgentPaymentAuthorization,
    ApiResponseAgentPaymentEvent,
    ApiResponseLogin,
    ApiResponseNonce,
    AuthenticationState,
    PaymentEvent,
)


class ApiClient:
    """Python SDK for the x402 payment API.

    Provides simple methods to interact with the payment authorization API,
    including SIWE authentication and payment lifecycle management.
    """

    def __init__(self, options: ApiClientOptions):
        self.base_url = options.base_url.rstrip("/")  # Remove trailing slash
        self.session_key_private_key = options.session_key_private_key
        self.agent_address = options.agent_address
        self.timeout = options.timeout / 1000.0  # Convert to seconds for httpx
        self._auth_lock = asyncio.Lock()
        self._auth = AuthenticationState()
        self._http_client: Optional[httpx.AsyncClient] = None

    async def __aenter__(self) -> Self:
        """Async context manager entry."""
        self._http_client = httpx.AsyncClient(timeout=self.timeout)
        return self

    async def __aexit__(
        self,
        exc_type: type[BaseException] | None,
        exc_val: BaseException | None,
        exc_tb: TracebackType | None,
    ) -> None:
        """Async context manager exit."""
        if self._http_client:
            await self._http_client.aclose()

    @property
    def http_client(self) -> httpx.AsyncClient:
        """Get or create HTTP client."""
        if self._http_client is None:
            self._http_client = httpx.AsyncClient(timeout=self.timeout)
        return self._http_client

    async def _perform_authentication(self) -> None:
        """Internal method to perform authentication without mutex."""
        if not self.session_key_private_key:
            raise ApiError("Session key private key is required for authentication")

        try:
            # Create account from private key
            account = Account.from_key(self.session_key_private_key)
            session_key_address = account.address

            # Step 1: Get nonce
            nonce_response = ApiResponseNonce(
                **await self._fetch("/api/v1/agents/auth/nonce", method="GET")
            )
            assert nonce_response.session_id and nonce_response.nonce

            # Step 2: Create SIWE message
            domain = urlparse(self.base_url).netloc
            siwe_message = SiweMessage(
                domain=domain,
                address=session_key_address,
                statement="Sign in to API",
                uri=self.base_url,
                version=VersionEnum("1"),
                chain_id=1,
                nonce=nonce_response.nonce,
                issued_at=ISO8601Datetime.from_datetime(datetime.now()),
            )

            # Step 3: Sign the message
            message_to_sign = siwe_message.prepare_message()

            signature = account.sign_message(
                encode_defunct(text=message_to_sign)
            ).signature

            # Step 4: Login with signature
            login_request = ApiRequestLogin(
                message=message_to_sign,
                signature="0x" + signature.hex(),
                session_id=nonce_response.session_id,
                agent_address=self.agent_address,
            )
            login_response = await self._fetch(
                "/api/v1/agents/auth/login",
                method="POST",
                json_data=login_request.model_dump(mode="json", by_alias=True),
            )
            login_data = ApiResponseLogin(**login_response)

            # Verify returned agent_address matches what we configured
            if login_data.agent_address.lower() != self.agent_address.lower():
                raise ApiError(
                    f"Agent address mismatch: requested {self.agent_address}, "
                    f"got {login_data.agent_address}"
                )

            # Store authentication state (agent_address comes from config, not server)
            self._auth = AuthenticationState(
                token=login_data.token,
                expires_at=datetime.fromisoformat(
                    login_data.expires_at.replace("Z", "+00:00")
                ),
            )

        except Exception as error:
            if isinstance(error, ApiError):
                raise error
            raise ApiError(f"Authentication failed: {error}")

    async def authorize_payment(
        self,
        requirements: List[PaymentRequirements],
        context: Optional[Dict[str, Any]] = None,
    ) -> ApiResponseAgentPaymentAuthorization:
        """Request authorization for a payment."""
        await self._ensure_authenticated()

        request = ApiRequestAgentPaymentAuthorization(
            requirements=requirements,
            context=context,
        )

        exclude_fields = {"context": True} if request.context is None else {}

        response = await self._fetch(
            f"/api/v1/agents/{self.agent_address}/payment/authorize",
            method="POST",
            json_data=request.model_dump(
                mode="json", by_alias=True, exclude=exclude_fields
            ),
            headers={"Authorization": f"Bearer {self._auth.token}"},
        )

        return ApiResponseAgentPaymentAuthorization(**response)

    async def report_payment_event(
        self,
        event_id: str,
        payment: PaymentPayload,
        event: PaymentEvent,
    ) -> ApiResponseAgentPaymentEvent:
        """Report a payment lifecycle event."""
        await self._ensure_authenticated()

        report = ApiRequestAgentPaymentEvent(
            id_=event_id,
            payment=payment,
            event=event,
        )

        response = await self._fetch(
            f"/api/v1/agents/{self.agent_address}/payment/events",
            method="POST",
            json_data=report.model_dump(mode="json", by_alias=True),
            headers={"Authorization": f"Bearer {self._auth.token}"},
        )

        return ApiResponseAgentPaymentEvent(**response)

    def clear_auth(self) -> None:
        """Clear the current authentication state."""
        self._auth = AuthenticationState()

    def get_agent_address(self) -> str:
        """Get the configured agent address."""
        return self.agent_address

    def is_authenticated(self) -> bool:
        """Check if currently authenticated and token is valid."""
        return bool(
            self._auth.token
            and self._auth.expires_at
            and self._auth.expires_at > datetime.now(self._auth.expires_at.tzinfo)
        )

    async def _ensure_authenticated(self) -> None:
        """Ensure the client is authenticated, performing authentication if needed."""
        async with self._auth_lock:
            if not self.is_authenticated():
                await self._perform_authentication()

    async def _fetch(
        self,
        path: str,
        method: str = "GET",
        json_data: Optional[Dict[str, Any]] = None,
        headers: Optional[Dict[str, str]] = None,
    ) -> Any:
        """Internal fetch wrapper with error handling."""
        url = f"{self.base_url}{path}"
        request_headers = {"Content-Type": "application/json"}
        if headers:
            request_headers.update(headers)

        try:
            response = await self.http_client.request(
                method=method,
                url=url,
                json=json_data,
                headers=request_headers,
            )

            if not response.is_success:
                error_message = f"HTTP {response.status_code} {response.reason_phrase}"
                try:
                    error_body = response.text
                    if error_body:
                        error_message += f": {error_body}"
                except Exception:
                    # Ignore error body parsing failures
                    pass
                raise ApiError(error_message, response.status_code, response)

            return response.json()

        except ApiError:
            raise
        except httpx.TimeoutException:
            raise ApiError(f"Request timeout after {self.timeout}s")
        except Exception as error:
            raise ApiError(f"Request failed: {error}")

    async def close(self) -> None:
        """Close the HTTP client."""
        if self._http_client:
            await self._http_client.aclose()
            self._http_client = None
