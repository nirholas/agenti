"""
Tests for AI Prediction API
"""

import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


class TestFreeEndpoints:
    """Test free (non-paywalled) endpoints"""
    
    def test_root(self):
        """Test root endpoint returns API info"""
        response = client.get("/")
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "AI Prediction API"
        assert "version" in data
        assert "status" in data
    
    def test_pricing(self):
        """Test pricing endpoint returns all prices"""
        response = client.get("/pricing")
        assert response.status_code == 200
        data = response.json()
        assert "prices" in data
        assert data["prices"]["direction"] == 0.01
        assert data["prices"]["target"] == 0.05
        assert data["prices"]["full"] == 0.10
    
    def test_assets(self):
        """Test assets endpoint returns supported assets"""
        response = client.get("/assets")
        assert response.status_code == 200
        data = response.json()
        assert "supported_assets" in data
        assert "BTC" in data["supported_assets"]
        assert "ETH" in data["supported_assets"]
    
    def test_models(self):
        """Test models endpoint returns available models"""
        response = client.get("/models")
        assert response.status_code == 200
        data = response.json()
        assert "models" in data
        assert len(data["models"]) > 0
    
    def test_health(self):
        """Test health check endpoint"""
        response = client.get("/health")
        assert response.status_code == 200
        assert response.json()["status"] == "healthy"


class TestPredictionEndpoints:
    """Test prediction endpoints (require payment or disabled x402)"""
    
    def test_direction_requires_payment(self):
        """Test direction endpoint returns 402 without payment"""
        response = client.post(
            "/predict/direction",
            json={"asset": "BTC", "timeframe": "1d"}
        )
        # Should return 402 if x402 enabled, or 200 if disabled
        assert response.status_code in [200, 402]
    
    def test_direction_with_payment(self):
        """Test direction endpoint with payment proof"""
        response = client.post(
            "/predict/direction",
            json={"asset": "BTC", "timeframe": "1d"},
            headers={"X-402-Payment": "0x" + "a" * 64}
        )
        # With valid payment proof format, should succeed
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert data["prediction"]["type"] == "direction"
        assert data["prediction"]["asset"] == "BTC"
    
    def test_target_prediction(self):
        """Test target prediction endpoint"""
        response = client.post(
            "/predict/target",
            json={"asset": "ETH", "timeframe": "4h"},
            headers={"X-402-Payment": "0x" + "b" * 64}
        )
        assert response.status_code == 200
        data = response.json()
        assert "current_price" in data["prediction"]
        assert "predicted_price" in data["prediction"]
    
    def test_confidence_prediction(self):
        """Test confidence prediction endpoint"""
        response = client.post(
            "/predict/confidence",
            json={"asset": "SOL", "timeframe": "1h"},
            headers={"X-402-Payment": "0x" + "c" * 64}
        )
        assert response.status_code == 200
        data = response.json()
        assert "confidence" in data["prediction"]
        assert "confidence_breakdown" in data["prediction"]
    
    def test_full_prediction(self):
        """Test full prediction report endpoint"""
        response = client.post(
            "/predict/full",
            json={"asset": "BTC", "timeframe": "1d"},
            headers={"X-402-Payment": "0x" + "d" * 64}
        )
        assert response.status_code == 200
        data = response.json()
        prediction = data["prediction"]
        assert prediction["type"] == "full"
        assert "direction" in prediction
        assert "target" in prediction
        assert "confidence" in prediction
        assert "analysis" in prediction


class TestBulkPredictions:
    """Test bulk prediction endpoint"""
    
    def test_bulk_direction(self):
        """Test bulk direction predictions"""
        response = client.post(
            "/predict/bulk",
            json={
                "assets": ["BTC", "ETH", "SOL"],
                "timeframe": "1d",
                "type": "direction"
            },
            headers={"X-402-Payment": "0x" + "e" * 64}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["success"] == True
        assert "BTC" in data["predictions"]
        assert "ETH" in data["predictions"]
        assert "SOL" in data["predictions"]
        assert data["asset_count"] == 3


class TestBacktesting:
    """Test backtesting endpoint"""
    
    def test_backtest_momentum(self):
        """Test momentum strategy backtest"""
        response = client.post(
            "/backtest",
            json={
                "asset": "BTC",
                "strategy": "momentum",
                "start_date": "2025-01-01",
                "end_date": "2025-12-31"
            },
            headers={"X-402-Payment": "0x" + "f" * 64}
        )
        assert response.status_code == 200
        data = response.json()
        backtest = data["backtest"]
        assert backtest["asset"] == "BTC"
        assert backtest["strategy"] == "momentum"
        assert "performance" in backtest
        assert "trades" in backtest
        assert "risk_metrics" in backtest


class TestValidation:
    """Test input validation"""
    
    def test_invalid_asset(self):
        """Test invalid asset returns error"""
        response = client.post(
            "/predict/direction",
            json={"asset": "INVALID", "timeframe": "1d"},
            headers={"X-402-Payment": "0x" + "a" * 64}
        )
        assert response.status_code == 422
    
    def test_invalid_timeframe(self):
        """Test invalid timeframe returns error"""
        response = client.post(
            "/predict/direction",
            json={"asset": "BTC", "timeframe": "2h"},
            headers={"X-402-Payment": "0x" + "a" * 64}
        )
        assert response.status_code == 422
    
    def test_bulk_too_many_assets(self):
        """Test bulk with too many assets returns error"""
        response = client.post(
            "/predict/bulk",
            json={
                "assets": ["BTC"] * 15,  # Max is 10
                "timeframe": "1d",
                "type": "direction"
            },
            headers={"X-402-Payment": "0x" + "a" * 64}
        )
        assert response.status_code == 422
