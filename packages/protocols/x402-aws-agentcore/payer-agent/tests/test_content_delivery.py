"""
Tests for content delivery after successful payment.

These tests verify that:
1. Content is delivered after successful payment verification
2. Content structure matches expected format for different content types
3. Settlement response is included with content delivery
4. Different content endpoints return appropriate content
"""

import base64
import json
import time
from typing import Any
from unittest.mock import AsyncMock, MagicMock, patch

import httpx
import pytest


# ============================================================================
# Test Configuration
# ============================================================================

# Sample payment requirements (x402 v2 format)
SAMPLE_PAYMENT_REQUIREMENTS = {
    "scheme": "exact",
    "network": "eip155:84532",  # Base Sepolia
    "amount": "1000",  # 0.001 USDC (6 decimals)
    "asset": "0x036CbD53842c5426634e7929541eC2318f3dCF7e",  # USDC on Base Sepolia
    "payTo": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0",
    "maxTimeoutSeconds": 60,
    "extra": {
        "name": "USDC",
        "version": "2",
        "assetTransferMethod": "eip3009",
    },
}

SAMPLE_PAYER_ADDRESS = "0x1111111111111111111111111111111111111111"


# ============================================================================
# Sample Content Fixtures
# ============================================================================

PREMIUM_ARTICLE_CONTENT = {
    "title": "The Future of AI and Blockchain Integration",
    "author": "Tech Insights",
    "date": "2026-01-22",
    "content": "Artificial Intelligence and Blockchain are converging...",
    "fullText": "This is premium content that requires payment to access...",
    "tags": ["AI", "blockchain", "technology", "innovation"],
}

WEATHER_DATA_CONTENT = {
    "location": "San Francisco, CA",
    "timestamp": "2026-01-22T12:00:00Z",
    "current": {
        "temperature": 65,
        "temperatureUnit": "F",
        "conditions": "Sunny",
        "humidity": 45,
        "windSpeed": 12,
        "windUnit": "mph",
        "uvIndex": 6,
    },
    "forecast": [
        {"day": "Fri", "conditions": "Sunny", "high": 68, "low": 52},
        {"day": "Sat", "conditions": "Partly Cloudy", "high": 70, "low": 54},
    ],
    "source": "x402-weather-service",
    "premium": True,
}

MARKET_ANALYSIS_CONTENT = {
    "timestamp": "2026-01-22T12:00:00Z",
    "date": "2026-01-22",
    "markets": {
        "BTC": {
            "name": "Bitcoin",
            "price": "98500.00",
            "change24h": "+2.5%",
            "volume24h": "25.5B",
        },
        "ETH": {
            "name": "Ethereum",
            "price": "3850.00",
            "change24h": "+1.8%",
            "volume24h": "12.3B",
        },
    },
    "analysis": {
        "overallSentiment": "Bullish",
        "summary": "Market showing positive momentum...",
        "riskLevel": "Medium",
    },
    "source": "x402-market-service",
    "premium": True,
}

DATASET_CONTENT = {
    "title": "Cryptocurrency Transaction Analytics Dataset",
    "version": "2.1",
    "lastUpdated": "2026-01-20",
    "description": "Curated dataset containing aggregated cryptocurrency transaction metrics...",
    "schema": {
        "fields": [
            {"name": "timestamp", "type": "datetime"},
            {"name": "network", "type": "string"},
            {"name": "txCount", "type": "integer"},
        ]
    },
    "data": [
        {
            "timestamp": "2026-01-20T00:00:00Z",
            "network": "ethereum",
            "txCount": 1245678,
        }
    ],
    "premium": True,
    "source": "x402-data-service",
}


# ============================================================================
# Helper Functions
# ============================================================================

def create_payment_payload(
    requirements: dict[str, Any],
    payer: str = SAMPLE_PAYER_ADDRESS,
) -> dict[str, Any]:
    """Create a valid x402 v2 payment payload."""
    now = int(time.time())
    
    return {
        "x402Version": 2,
        "resource": {
            "url": "/api/premium-article",
        },
        "accepted": requirements,
        "payload": {
            "signature": "0x" + "ab" * 65,
            "authorization": {
                "from": payer,
                "to": requirements["payTo"],
                "value": requirements["amount"],
                "validAfter": str(now - 60),
                "validBefore": str(now + 300),
                "nonce": "0x" + "00" * 32,
            },
        },
        "extensions": {},
    }


def create_200_response_with_content(
    content: dict[str, Any],
    transaction_hash: str = "0xabc123def456789",
    payer: str = SAMPLE_PAYER_ADDRESS,
) -> MagicMock:
    """Create a mock 200 OK response with content and settlement."""
    settlement = {
        "success": True,
        "transaction": transaction_hash,
        "network": "eip155:84532",
        "payer": payer,
    }
    
    encoded_settlement = base64.b64encode(
        json.dumps(settlement).encode()
    ).decode()
    
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.headers = {
        "X-PAYMENT-RESPONSE": encoded_settlement,
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Expose-Headers": "X-PAYMENT-RESPONSE",
    }
    mock_response.json.return_value = content
    
    return mock_response


async def request_content_with_payment_impl(
    url: str,
    payment_payload: dict[str, Any],
    seller_api_url: str,
) -> dict[str, Any]:
    """Request content with payment signature (implementation for testing)."""
    full_url = f"{seller_api_url}{url}"
    
    payment_signature = base64.b64encode(
        json.dumps(payment_payload).encode()
    ).decode()
    
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                full_url,
                headers={
                    "Accept": "application/json",
                    "X-PAYMENT-SIGNATURE": payment_signature,
                },
                follow_redirects=True,
            )
            
            if response.status_code == 200:
                payment_response_header = (
                    response.headers.get("X-PAYMENT-RESPONSE") or
                    response.headers.get("x-payment-response")
                )
                settlement = None
                if payment_response_header:
                    settlement = json.loads(base64.b64decode(payment_response_header))
                
                return {
                    "status": 200,
                    "content": response.json(),
                    "settlement": settlement,
                }
            
            if response.status_code == 402:
                return {
                    "status": 402,
                    "error": "Payment was rejected by the server",
                }
            
            return {
                "status": response.status_code,
                "error": f"Unexpected status code: {response.status_code}",
            }
            
        except httpx.RequestError as e:
            return {
                "status": 0,
                "error": f"Request failed: {str(e)}",
            }


# ============================================================================
# Content Delivery Tests
# ============================================================================

class TestContentDeliveryAfterPayment:
    """Tests for content delivery after successful payment."""

    @pytest.mark.asyncio
    async def test_premium_article_content_delivered(self):
        """Test that premium article content is delivered after payment."""
        mock_200 = create_200_response_with_content(PREMIUM_ARTICLE_CONTENT)
        payment_payload = create_payment_payload(SAMPLE_PAYMENT_REQUIREMENTS)
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_200
            )
            
            result = await request_content_with_payment_impl(
                "/api/premium-article",
                payment_payload,
                "https://example.cloudfront.net"
            )
            
            assert result["status"] == 200
            assert "content" in result
            assert result["content"]["title"] == "The Future of AI and Blockchain Integration"
            assert result["content"]["author"] == "Tech Insights"
            assert "fullText" in result["content"]

    @pytest.mark.asyncio
    async def test_weather_data_content_delivered(self):
        """Test that weather data content is delivered after payment."""
        mock_200 = create_200_response_with_content(WEATHER_DATA_CONTENT)
        payment_payload = create_payment_payload(SAMPLE_PAYMENT_REQUIREMENTS)
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_200
            )
            
            result = await request_content_with_payment_impl(
                "/api/weather-data",
                payment_payload,
                "https://example.cloudfront.net"
            )
            
            assert result["status"] == 200
            assert "content" in result
            assert "location" in result["content"]
            assert "current" in result["content"]
            assert "forecast" in result["content"]
            assert result["content"]["premium"] is True

    @pytest.mark.asyncio
    async def test_market_analysis_content_delivered(self):
        """Test that market analysis content is delivered after payment."""
        mock_200 = create_200_response_with_content(MARKET_ANALYSIS_CONTENT)
        payment_payload = create_payment_payload(SAMPLE_PAYMENT_REQUIREMENTS)
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_200
            )
            
            result = await request_content_with_payment_impl(
                "/api/market-analysis",
                payment_payload,
                "https://example.cloudfront.net"
            )
            
            assert result["status"] == 200
            assert "content" in result
            assert "markets" in result["content"]
            assert "analysis" in result["content"]
            assert result["content"]["premium"] is True

    @pytest.mark.asyncio
    async def test_dataset_content_delivered(self):
        """Test that dataset content is delivered after payment."""
        mock_200 = create_200_response_with_content(DATASET_CONTENT)
        payment_payload = create_payment_payload(SAMPLE_PAYMENT_REQUIREMENTS)
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_200
            )
            
            result = await request_content_with_payment_impl(
                "/api/dataset",
                payment_payload,
                "https://example.cloudfront.net"
            )
            
            assert result["status"] == 200
            assert "content" in result
            assert "schema" in result["content"]
            assert "data" in result["content"]
            assert result["content"]["premium"] is True


class TestContentStructureValidation:
    """Tests for validating content structure."""

    @pytest.mark.asyncio
    async def test_article_has_required_fields(self):
        """Test that article content has all required fields."""
        mock_200 = create_200_response_with_content(PREMIUM_ARTICLE_CONTENT)
        payment_payload = create_payment_payload(SAMPLE_PAYMENT_REQUIREMENTS)
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_200
            )
            
            result = await request_content_with_payment_impl(
                "/api/premium-article",
                payment_payload,
                "https://example.cloudfront.net"
            )
            
            content = result["content"]
            required_fields = ["title", "author", "date", "content", "fullText", "tags"]
            for field in required_fields:
                assert field in content, f"Missing required field: {field}"

    @pytest.mark.asyncio
    async def test_weather_has_required_fields(self):
        """Test that weather content has all required fields."""
        mock_200 = create_200_response_with_content(WEATHER_DATA_CONTENT)
        payment_payload = create_payment_payload(SAMPLE_PAYMENT_REQUIREMENTS)
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_200
            )
            
            result = await request_content_with_payment_impl(
                "/api/weather-data",
                payment_payload,
                "https://example.cloudfront.net"
            )
            
            content = result["content"]
            assert "location" in content
            assert "timestamp" in content
            assert "current" in content
            
            current = content["current"]
            assert "temperature" in current
            assert "conditions" in current
            assert "humidity" in current

    @pytest.mark.asyncio
    async def test_market_has_required_fields(self):
        """Test that market analysis content has all required fields."""
        mock_200 = create_200_response_with_content(MARKET_ANALYSIS_CONTENT)
        payment_payload = create_payment_payload(SAMPLE_PAYMENT_REQUIREMENTS)
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_200
            )
            
            result = await request_content_with_payment_impl(
                "/api/market-analysis",
                payment_payload,
                "https://example.cloudfront.net"
            )
            
            content = result["content"]
            assert "markets" in content
            assert "analysis" in content
            assert "timestamp" in content
            
            analysis = content["analysis"]
            assert "overallSentiment" in analysis
            assert "summary" in analysis

    @pytest.mark.asyncio
    async def test_dataset_has_required_fields(self):
        """Test that dataset content has all required fields."""
        mock_200 = create_200_response_with_content(DATASET_CONTENT)
        payment_payload = create_payment_payload(SAMPLE_PAYMENT_REQUIREMENTS)
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_200
            )
            
            result = await request_content_with_payment_impl(
                "/api/dataset",
                payment_payload,
                "https://example.cloudfront.net"
            )
            
            content = result["content"]
            assert "title" in content
            assert "schema" in content
            assert "data" in content
            assert isinstance(content["data"], list)


class TestSettlementWithContentDelivery:
    """Tests for settlement response included with content delivery."""

    @pytest.mark.asyncio
    async def test_settlement_included_with_content(self):
        """Test that settlement response is included with content delivery."""
        tx_hash = "0xdef456789abc123"
        mock_200 = create_200_response_with_content(
            PREMIUM_ARTICLE_CONTENT,
            transaction_hash=tx_hash
        )
        payment_payload = create_payment_payload(SAMPLE_PAYMENT_REQUIREMENTS)
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_200
            )
            
            result = await request_content_with_payment_impl(
                "/api/premium-article",
                payment_payload,
                "https://example.cloudfront.net"
            )
            
            assert result["status"] == 200
            assert result["settlement"] is not None
            assert result["settlement"]["success"] is True
            assert result["settlement"]["transaction"] == tx_hash

    @pytest.mark.asyncio
    async def test_settlement_contains_network(self):
        """Test that settlement response contains network information."""
        mock_200 = create_200_response_with_content(PREMIUM_ARTICLE_CONTENT)
        payment_payload = create_payment_payload(SAMPLE_PAYMENT_REQUIREMENTS)
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_200
            )
            
            result = await request_content_with_payment_impl(
                "/api/premium-article",
                payment_payload,
                "https://example.cloudfront.net"
            )
            
            assert result["settlement"]["network"] == "eip155:84532"

    @pytest.mark.asyncio
    async def test_settlement_contains_payer(self):
        """Test that settlement response contains payer address."""
        mock_200 = create_200_response_with_content(PREMIUM_ARTICLE_CONTENT)
        payment_payload = create_payment_payload(SAMPLE_PAYMENT_REQUIREMENTS)
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_200
            )
            
            result = await request_content_with_payment_impl(
                "/api/premium-article",
                payment_payload,
                "https://example.cloudfront.net"
            )
            
            assert result["settlement"]["payer"] == SAMPLE_PAYER_ADDRESS

    @pytest.mark.asyncio
    async def test_content_delivered_without_settlement_header(self):
        """Test content delivery when settlement header is missing."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.headers = {
            "Content-Type": "application/json",
        }
        mock_response.json.return_value = PREMIUM_ARTICLE_CONTENT
        
        payment_payload = create_payment_payload(SAMPLE_PAYMENT_REQUIREMENTS)
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_response
            )
            
            result = await request_content_with_payment_impl(
                "/api/premium-article",
                payment_payload,
                "https://example.cloudfront.net"
            )
            
            assert result["status"] == 200
            assert result["content"] is not None
            assert result["settlement"] is None


class TestContentDeliveryEdgeCases:
    """Tests for edge cases in content delivery."""

    @pytest.mark.asyncio
    async def test_empty_content_response(self):
        """Test handling of empty content response."""
        mock_200 = create_200_response_with_content({})
        payment_payload = create_payment_payload(SAMPLE_PAYMENT_REQUIREMENTS)
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_200
            )
            
            result = await request_content_with_payment_impl(
                "/api/premium-article",
                payment_payload,
                "https://example.cloudfront.net"
            )
            
            assert result["status"] == 200
            assert result["content"] == {}

    @pytest.mark.asyncio
    async def test_large_content_response(self):
        """Test handling of large content response."""
        large_content = {
            "title": "Large Dataset",
            "data": [{"id": i, "value": f"item_{i}"} for i in range(1000)],
        }
        mock_200 = create_200_response_with_content(large_content)
        payment_payload = create_payment_payload(SAMPLE_PAYMENT_REQUIREMENTS)
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_200
            )
            
            result = await request_content_with_payment_impl(
                "/api/dataset",
                payment_payload,
                "https://example.cloudfront.net"
            )
            
            assert result["status"] == 200
            assert len(result["content"]["data"]) == 1000

    @pytest.mark.asyncio
    async def test_content_with_special_characters(self):
        """Test content delivery with special characters."""
        content_with_special = {
            "title": "Special Characters: <>&\"'",
            "content": "Unicode: 你好世界 🚀 émojis",
            "tags": ["café", "naïve", "日本語"],
        }
        mock_200 = create_200_response_with_content(content_with_special)
        payment_payload = create_payment_payload(SAMPLE_PAYMENT_REQUIREMENTS)
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_200
            )
            
            result = await request_content_with_payment_impl(
                "/api/premium-article",
                payment_payload,
                "https://example.cloudfront.net"
            )
            
            assert result["status"] == 200
            assert "你好世界" in result["content"]["content"]
            assert "🚀" in result["content"]["content"]

    @pytest.mark.asyncio
    async def test_nested_content_structure(self):
        """Test content delivery with deeply nested structure."""
        nested_content = {
            "level1": {
                "level2": {
                    "level3": {
                        "level4": {
                            "data": "deeply nested value"
                        }
                    }
                }
            }
        }
        mock_200 = create_200_response_with_content(nested_content)
        payment_payload = create_payment_payload(SAMPLE_PAYMENT_REQUIREMENTS)
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_200
            )
            
            result = await request_content_with_payment_impl(
                "/api/premium-article",
                payment_payload,
                "https://example.cloudfront.net"
            )
            
            assert result["status"] == 200
            assert result["content"]["level1"]["level2"]["level3"]["level4"]["data"] == "deeply nested value"


class TestMultipleContentEndpoints:
    """Tests for content delivery across multiple endpoints."""

    @pytest.mark.asyncio
    @pytest.mark.parametrize("endpoint,content_key", [
        ("/api/premium-article", "title"),
        ("/api/weather-data", "location"),
        ("/api/market-analysis", "markets"),
        ("/api/dataset", "schema"),
    ])
    async def test_different_endpoints_return_appropriate_content(
        self, endpoint: str, content_key: str
    ):
        """Test that different endpoints return content with appropriate keys."""
        content_map = {
            "/api/premium-article": PREMIUM_ARTICLE_CONTENT,
            "/api/weather-data": WEATHER_DATA_CONTENT,
            "/api/market-analysis": MARKET_ANALYSIS_CONTENT,
            "/api/dataset": DATASET_CONTENT,
        }
        
        mock_200 = create_200_response_with_content(content_map[endpoint])
        payment_payload = create_payment_payload(SAMPLE_PAYMENT_REQUIREMENTS)
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_200
            )
            
            result = await request_content_with_payment_impl(
                endpoint,
                payment_payload,
                "https://example.cloudfront.net"
            )
            
            assert result["status"] == 200
            assert content_key in result["content"]

    @pytest.mark.asyncio
    async def test_all_premium_content_marked_as_premium(self):
        """Test that all premium content is marked with premium flag."""
        premium_contents = [
            WEATHER_DATA_CONTENT,
            MARKET_ANALYSIS_CONTENT,
            DATASET_CONTENT,
        ]
        
        for content in premium_contents:
            mock_200 = create_200_response_with_content(content)
            payment_payload = create_payment_payload(SAMPLE_PAYMENT_REQUIREMENTS)
            
            with patch("httpx.AsyncClient") as mock_client:
                mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                    return_value=mock_200
                )
                
                result = await request_content_with_payment_impl(
                    "/api/test",
                    payment_payload,
                    "https://example.cloudfront.net"
                )
                
                assert result["status"] == 200
                assert result["content"].get("premium") is True


class TestContentDeliveryErrorScenarios:
    """Tests for error scenarios during content delivery."""

    @pytest.mark.asyncio
    async def test_server_error_during_content_delivery(self):
        """Test handling of server error during content delivery."""
        mock_500 = MagicMock()
        mock_500.status_code = 500
        
        payment_payload = create_payment_payload(SAMPLE_PAYMENT_REQUIREMENTS)
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_500
            )
            
            result = await request_content_with_payment_impl(
                "/api/premium-article",
                payment_payload,
                "https://example.cloudfront.net"
            )
            
            assert result["status"] == 500
            assert "error" in result

    @pytest.mark.asyncio
    async def test_network_error_during_content_delivery(self):
        """Test handling of network error during content delivery."""
        payment_payload = create_payment_payload(SAMPLE_PAYMENT_REQUIREMENTS)
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                side_effect=httpx.RequestError("Connection timeout")
            )
            
            result = await request_content_with_payment_impl(
                "/api/premium-article",
                payment_payload,
                "https://example.cloudfront.net"
            )
            
            assert result["status"] == 0
            assert "error" in result
            assert "Request failed" in result["error"]

    @pytest.mark.asyncio
    async def test_payment_rejected_no_content_delivered(self):
        """Test that no content is delivered when payment is rejected."""
        mock_402 = MagicMock()
        mock_402.status_code = 402
        
        payment_payload = create_payment_payload(SAMPLE_PAYMENT_REQUIREMENTS)
        
        with patch("httpx.AsyncClient") as mock_client:
            mock_client.return_value.__aenter__.return_value.get = AsyncMock(
                return_value=mock_402
            )
            
            result = await request_content_with_payment_impl(
                "/api/premium-article",
                payment_payload,
                "https://example.cloudfront.net"
            )
            
            assert result["status"] == 402
            assert "content" not in result
            assert "error" in result
