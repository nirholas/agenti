from unittest.mock import MagicMock, patch

import httpx

from libertai_agentkit_plugin.client import DEFAULT_BASE_URL, create_llm_client


def _mock_async_client() -> MagicMock:
    return MagicMock(spec=httpx.AsyncClient)


def test_default_base_url():
    with patch("libertai_agentkit_plugin.client.create_payment_client") as mock_pc:
        mock_pc.return_value = _mock_async_client()
        client = create_llm_client("0x" + "ab" * 32)
        assert str(client.base_url).rstrip("/") == DEFAULT_BASE_URL.rstrip("/")


def test_custom_base_url():
    with patch("libertai_agentkit_plugin.client.create_payment_client") as mock_pc:
        mock_pc.return_value = _mock_async_client()
        client = create_llm_client("0x" + "ab" * 32, base_url="https://custom.api/v1")
        assert "custom.api" in str(client.base_url)


def test_uses_payment_client():
    with patch("libertai_agentkit_plugin.client.create_payment_client") as mock_pc:
        mock_http = _mock_async_client()
        mock_pc.return_value = mock_http
        _client = create_llm_client("0x" + "ab" * 32)
        mock_pc.assert_called_once_with("0x" + "ab" * 32)
