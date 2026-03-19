"""
X402 Client for Python
Provides interface to the decentralized x402 facilitator.
"""

import requests
from typing import Optional
from pydantic import BaseModel, Field

from .types import (
    PaymentRequirements,
    VerifyResponse,
    SettleResponse,
    SupportedSchemesResponse,
    ServiceInfo,
)


class X402ClientConfig(BaseModel):
    """Configuration for the X402 client."""

    facilitator_url: str = Field(..., description="URL of the facilitator service")
    x402_version: int = Field(default=1, description="x402 protocol version")
    timeout: int = Field(
        default=30, description="Request timeout in seconds"
    )


class X402Client:
    """
    Python client for the ChaosChain x402 decentralized facilitator.

    This client provides methods to verify and settle x402 payments
    using a decentralized CRE workflow instead of a centralized facilitator.

    Example:
        ```python
        from chaoschain_x402_client import X402Client

        client = X402Client(facilitator_url='http://localhost:8402')

        result = client.verify_payment(
            payment_header='base64_encoded_header',
            payment_requirements={
                'scheme': 'exact',
                'network': 'base-sepolia',
                'maxAmountRequired': '1000000',
                'payTo': '0x...',
                'asset': '0x...',
                'resource': '/api/weather'
            }
        )

        if result.isValid:
            print('✅ Payment verified!')
        ```
    """

    def __init__(
        self,
        facilitator_url: str,
        x402_version: int = 1,
        timeout: int = 30,
    ):
        """
        Initialize the X402 client.

        Args:
            facilitator_url: URL of the facilitator service
            x402_version: x402 protocol version (default: 1)
            timeout: Request timeout in seconds (default: 30)
        """
        self.facilitator_url = facilitator_url.rstrip("/")
        self.x402_version = x402_version
        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})

    def verify_payment(
        self,
        payment_header: str,
        payment_requirements: dict,
    ) -> VerifyResponse:
        """
        Verify an x402 payment via the decentralized facilitator.

        The facilitator uses BFT consensus across a CRE DON to verify the payment.

        Args:
            payment_header: Base64 encoded X-PAYMENT header
            payment_requirements: Payment requirements from the resource server

        Returns:
            VerifyResponse with consensus proof

        Raises:
            requests.exceptions.RequestException: If the request fails

        Example:
            ```python
            result = client.verify_payment(
                'eyJ4NDAyVmVyc2lvbiI6MX0=',
                {
                    'scheme': 'exact',
                    'network': 'base-sepolia',
                    'maxAmountRequired': '1000000',
                    'payTo': '0x...',
                    'asset': '0x...',
                    'resource': '/api/weather'
                }
            )

            if result.isValid:
                print('Payment verified!', result.consensusProof)
            ```
        """
        # Validate payment requirements
        requirements = PaymentRequirements(**payment_requirements)

        payload = {
            "x402Version": self.x402_version,
            "paymentHeader": payment_header,
            "paymentRequirements": requirements.model_dump(),
        }

        try:
            response = self.session.post(
                f"{self.facilitator_url}/verify",
                json=payload,
                timeout=self.timeout,
            )
            response.raise_for_status()
            data = response.json()
            return VerifyResponse(**data)
        except requests.exceptions.Timeout:
            raise TimeoutError(f"Verification request timed out after {self.timeout}s")
        except requests.exceptions.RequestException as e:
            raise RuntimeError(f"Verification failed: {str(e)}") from e

    def settle_payment(
        self,
        payment_header: str,
        payment_requirements: dict,
    ) -> SettleResponse:
        """
        Settle an x402 payment via the decentralized facilitator.

        The facilitator uses BFT consensus across a CRE DON to execute
        the on-chain settlement transaction.

        Args:
            payment_header: Base64 encoded X-PAYMENT header
            payment_requirements: Payment requirements from the resource server

        Returns:
            SettleResponse with transaction hash and consensus proof

        Raises:
            requests.exceptions.RequestException: If the request fails

        Example:
            ```python
            result = client.settle_payment(
                'eyJ4NDAyVmVyc2lvbiI6MX0=',
                {
                    'scheme': 'exact',
                    'network': 'base-sepolia',
                    'maxAmountRequired': '1000000',
                    'payTo': '0x...',
                    'asset': '0x...',
                    'resource': '/api/weather'
                }
            )

            if result.success:
                print('Payment settled!', result.txHash)
            ```
        """
        # Validate payment requirements
        requirements = PaymentRequirements(**payment_requirements)

        payload = {
            "x402Version": self.x402_version,
            "paymentHeader": payment_header,
            "paymentRequirements": requirements.model_dump(),
        }

        try:
            response = self.session.post(
                f"{self.facilitator_url}/settle",
                json=payload,
                timeout=self.timeout,
            )
            response.raise_for_status()
            data = response.json()
            return SettleResponse(**data)
        except requests.exceptions.Timeout:
            raise TimeoutError(f"Settlement request timed out after {self.timeout}s")
        except requests.exceptions.RequestException as e:
            raise RuntimeError(f"Settlement failed: {str(e)}") from e

    def get_supported_schemes(self) -> SupportedSchemesResponse:
        """
        Get supported payment schemes and networks from the facilitator.

        Returns:
            SupportedSchemesResponse with list of (scheme, network) pairs

        Example:
            ```python
            supported = client.get_supported_schemes()
            for kind in supported.kinds:
                print(f"Scheme: {kind.scheme}, Network: {kind.network}")
            ```
        """
        try:
            response = self.session.get(
                f"{self.facilitator_url}/supported",
                timeout=self.timeout,
            )
            response.raise_for_status()
            data = response.json()
            return SupportedSchemesResponse(**data)
        except requests.exceptions.Timeout:
            raise TimeoutError(f"Request timed out after {self.timeout}s")
        except requests.exceptions.RequestException as e:
            raise RuntimeError(f"Failed to get supported schemes: {str(e)}") from e

    def health_check(self) -> ServiceInfo:
        """
        Check if the facilitator is responsive.

        Returns:
            ServiceInfo with service details

        Raises:
            RuntimeError: If the facilitator is unreachable

        Example:
            ```python
            try:
                info = client.health_check()
                print(f"Service: {info.service}, Mode: {info.mode}")
            except RuntimeError:
                print("Facilitator is down!")
            ```
        """
        try:
            response = self.session.get(
                f"{self.facilitator_url}/",
                timeout=self.timeout,
            )
            response.raise_for_status()
            data = response.json()
            return ServiceInfo(**data)
        except requests.exceptions.Timeout:
            raise TimeoutError(f"Health check timed out after {self.timeout}s")
        except requests.exceptions.RequestException as e:
            raise RuntimeError(f"Health check failed: {str(e)}") from e

    def close(self):
        """Close the HTTP session."""
        self.session.close()

    def __enter__(self):
        """Context manager entry."""
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        """Context manager exit."""
        self.close()

