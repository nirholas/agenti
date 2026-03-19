"""Unit tests for AmpersendManagementClient."""

from typing import Any, Dict
from unittest.mock import AsyncMock, patch

import pytest
from ampersend_sdk.ampersend.management import (
    AmpersendManagementClient,
    SpendConfig,
)
from eth_account import Account

# Deterministic test key
TEST_PRIVATE_KEY = "0x" + "ab" * 32
TEST_ACCOUNT = Account.from_key(TEST_PRIVATE_KEY)
TEST_ADDRESS = TEST_ACCOUNT.address

# Mock uses camelCase to match actual API response format
MOCK_AGENT_RESPONSE: Dict[str, Any] = {
    "address": "0x1111111111111111111111111111111111111111",
    "name": "test-agent",
    "userId": "user-123",
    "balance": "0",
    "initData": {},
    "nonce": "12345",
    "createdAt": 1700000000000,
    "updatedAt": 1700000000000,
}


@pytest.mark.asyncio
class TestAmpersendManagementClient:
    async def test_create_agent(self) -> None:
        """create_agent calls single endpoint with agent_key_address."""
        client = AmpersendManagementClient(api_key="sk_test_123")

        mock_response = AsyncMock()
        mock_response.is_success = True
        mock_response.json = lambda: MOCK_AGENT_RESPONSE

        async def mock_request(**kwargs: object) -> AsyncMock:
            assert kwargs["method"] == "POST"
            assert "/api/v1/sdk/agents" in str(kwargs["url"])
            assert "/prepare" not in str(kwargs["url"])
            json_data = kwargs.get("json", {})
            assert isinstance(json_data, dict)
            assert json_data["agent_key_address"] == TEST_ADDRESS
            assert json_data["name"] == "test-agent"
            assert json_data["spend_config"] is None
            assert json_data["authorized_sellers"] is None
            return mock_response

        with patch.object(client.http_client, "request", side_effect=mock_request):
            result = await client.create_agent(
                name="test-agent",
                private_key=TEST_PRIVATE_KEY,
            )

        assert result.address == MOCK_AGENT_RESPONSE["address"]
        assert result.name == "test-agent"

    async def test_create_agent_with_spend_config(self) -> None:
        """Spend config and authorized sellers are passed through."""
        client = AmpersendManagementClient(api_key="sk_test_123")

        mock_response = AsyncMock()
        mock_response.is_success = True
        mock_response.json = lambda: MOCK_AGENT_RESPONSE

        submitted_payload: dict[str, object] = {}

        async def mock_request(**kwargs: object) -> AsyncMock:
            nonlocal submitted_payload
            json_data = kwargs.get("json", {})
            assert isinstance(json_data, dict)
            submitted_payload = json_data
            return mock_response

        with patch.object(client.http_client, "request", side_effect=mock_request):
            await client.create_agent(
                name="test-agent",
                private_key=TEST_PRIVATE_KEY,
                spend_config=SpendConfig(
                    daily_limit=1000000, per_transaction_limit=50000
                ),
                authorized_sellers=["0x3333333333333333333333333333333333333333"],
            )

        assert isinstance(submitted_payload, dict)
        assert submitted_payload["agent_key_address"] == TEST_ADDRESS
        sc = submitted_payload["spend_config"]
        assert isinstance(sc, dict)
        assert sc["daily_limit"] == "1000000"
        assert sc["per_transaction_limit"] == "50000"
        assert sc["monthly_limit"] is None
        assert sc["auto_topup_allowed"] is False
        assert submitted_payload["authorized_sellers"] == [
            "0x3333333333333333333333333333333333333333"
        ]

    async def test_list_agents(self) -> None:
        """list_agents returns a list of agent dicts."""
        client = AmpersendManagementClient(api_key="sk_test_123")

        # API returns paginated response
        paginated_response = {
            "items": [MOCK_AGENT_RESPONSE, {**MOCK_AGENT_RESPONSE, "name": "agent-2"}],
            "total": 2,
            "limit": 50,
            "offset": 0,
        }

        mock_response = AsyncMock()
        mock_response.is_success = True
        mock_response.json = lambda: paginated_response

        async def mock_request(**kwargs: object) -> AsyncMock:
            assert kwargs["method"] == "GET"
            assert "/api/v1/sdk/agents" in str(kwargs["url"])
            headers = kwargs.get("headers", {})
            assert isinstance(headers, dict)
            assert headers["Authorization"] == "Bearer sk_test_123"
            return mock_response

        with patch.object(client.http_client, "request", side_effect=mock_request):
            result = await client.list_agents()

        assert len(result) == 2
        assert result[0].name == "test-agent"
        assert result[1].name == "agent-2"

    async def test_context_manager(self) -> None:
        """Async context manager opens and closes the HTTP client."""
        async with AmpersendManagementClient(api_key="sk_test") as client:
            assert client._http_client is not None
        # After exiting, the client should be closed
        assert client._http_client is None
