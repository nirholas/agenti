"""
AI Prediction API
FastAPI backend for ML-powered cryptocurrency predictions with x402 payment gates.

Author: nirholas
License: Apache-2.0
"""

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from enum import Enum
import os

from .models.lstm import LSTMPredictor
from .middleware.x402 import x402_paywall, X402PaymentRequired
from .config import settings

# ============================================================================
# App Configuration
# ============================================================================

app = FastAPI(
    title="AI Prediction API",
    description="ML-powered cryptocurrency predictions with x402 micropayments",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize model
predictor = LSTMPredictor()

# ============================================================================
# Enums & Models
# ============================================================================

class SupportedAsset(str, Enum):
    BTC = "BTC"
    ETH = "ETH"
    SOL = "SOL"
    ARB = "ARB"
    AVAX = "AVAX"
    MATIC = "MATIC"
    LINK = "LINK"
    UNI = "UNI"
    AAVE = "AAVE"
    OP = "OP"

class Timeframe(str, Enum):
    H1 = "1h"
    H4 = "4h"
    D1 = "1d"
    W1 = "1w"

class Strategy(str, Enum):
    MOMENTUM = "momentum"
    MEAN_REVERSION = "mean_reversion"
    TREND_FOLLOWING = "trend_following"
    CUSTOM = "custom"

class PredictionRequest(BaseModel):
    asset: SupportedAsset = Field(..., description="Cryptocurrency to predict")
    timeframe: Timeframe = Field(..., description="Prediction timeframe")

class BulkPredictionRequest(BaseModel):
    assets: List[SupportedAsset] = Field(..., min_length=1, max_length=10)
    timeframe: Timeframe
    type: str = Field(default="direction", pattern="^(direction|target|confidence|full)$")

class BacktestRequest(BaseModel):
    asset: SupportedAsset
    strategy: Strategy
    start_date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    end_date: str = Field(..., pattern=r"^\d{4}-\d{2}-\d{2}$")
    parameters: Optional[Dict[str, float]] = None

# ============================================================================
# Pricing Configuration
# ============================================================================

PRICING = {
    "direction": 0.01,
    "target": 0.05,
    "confidence": 0.02,
    "full": 0.10,
    "bulk_per_asset": 0.01,
    "backtest": 0.50,
    "maas_monthly": 10.00,
}

# ============================================================================
# Exception Handlers
# ============================================================================

@app.exception_handler(X402PaymentRequired)
async def payment_required_handler(request: Request, exc: X402PaymentRequired):
    """Handle 402 Payment Required responses"""
    return JSONResponse(
        status_code=402,
        content={
            "error": "Payment Required",
            "x402_version": 1,
            "accepts": [{
                "scheme": "exact",
                "network": exc.network,
                "maxAmountRequired": str(exc.amount),
                "resource": str(request.url),
                "description": exc.description,
                "mimeType": "application/json",
                "payTo": exc.recipient,
                "maxTimeoutSeconds": 300,
                "asset": exc.token,
            }],
        },
        headers={
            "X-402-Version": "1",
            "X-402-Price": str(exc.amount),
        }
    )

# ============================================================================
# Free Endpoints
# ============================================================================

@app.get("/")
async def root():
    """API info and health check"""
    return {
        "name": "AI Prediction API",
        "version": "1.0.0",
        "status": "healthy",
        "model": predictor.get_model_info(),
        "x402_enabled": settings.x402_enabled,
        "docs": "/docs",
    }

@app.get("/pricing")
async def get_pricing():
    """Get prediction pricing info"""
    return {
        "currency": "USD",
        "payment_protocol": "x402",
        "prices": PRICING,
        "description": {
            "direction": "Simple Up/Down/Sideways prediction",
            "target": "Specific price target with support/resistance",
            "confidence": "Model confidence score with breakdown",
            "full": "Complete report with all analyses",
            "bulk_per_asset": "Price per asset for bulk predictions",
            "backtest": "Strategy backtesting with metrics",
            "maas_monthly": "Model-as-a-Service subscription",
        }
    }

@app.get("/assets")
async def get_assets():
    """Get supported assets"""
    return {
        "supported_assets": [e.value for e in SupportedAsset],
        "timeframes": [e.value for e in Timeframe],
    }

@app.get("/models")
async def get_models():
    """Get available models"""
    return {
        "models": [{
            "id": "lstm-v1.2.0",
            "name": "LSTM Price Predictor",
            "description": "LSTM model trained on historical price data",
            "supported_assets": [e.value for e in SupportedAsset],
            "features": ["RSI", "MACD", "EMA", "Volume", "Volatility"],
        }],
    }

# ============================================================================
# Paid Prediction Endpoints
# ============================================================================

@app.post("/predict/direction")
@x402_paywall(amount=PRICING["direction"], description="Price direction prediction")
async def predict_direction(request: PredictionRequest):
    """
    Predict price direction (Up/Down/Sideways)
    Cost: $0.01
    """
    try:
        result = await predictor.predict_direction(
            asset=request.asset.value,
            timeframe=request.timeframe.value,
        )
        return {
            "success": True,
            "prediction": result,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/predict/target")
@x402_paywall(amount=PRICING["target"], description="Price target prediction")
async def predict_target(request: PredictionRequest):
    """
    Predict specific price target
    Cost: $0.05
    """
    try:
        result = await predictor.predict_target(
            asset=request.asset.value,
            timeframe=request.timeframe.value,
        )
        return {
            "success": True,
            "prediction": result,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/predict/confidence")
@x402_paywall(amount=PRICING["confidence"], description="Model confidence score")
async def predict_confidence(request: PredictionRequest):
    """
    Get model confidence score
    Cost: $0.02
    """
    try:
        result = await predictor.predict_confidence(
            asset=request.asset.value,
            timeframe=request.timeframe.value,
        )
        return {
            "success": True,
            "prediction": result,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/predict/full")
@x402_paywall(amount=PRICING["full"], description="Full prediction report")
async def predict_full(request: PredictionRequest):
    """
    Get full prediction report
    Cost: $0.10
    """
    try:
        result = await predictor.predict_full(
            asset=request.asset.value,
            timeframe=request.timeframe.value,
        )
        return {
            "success": True,
            "prediction": result,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/predict/bulk")
async def predict_bulk(request: BulkPredictionRequest, req: Request):
    """
    Bulk multi-asset predictions
    Cost: $0.01 per asset
    """
    total_cost = PRICING["bulk_per_asset"] * len(request.assets)
    
    # Check for payment
    payment_proof = req.headers.get("X-402-Payment")
    if not payment_proof and settings.x402_enabled:
        raise X402PaymentRequired(
            amount=total_cost,
            description=f"Bulk prediction for {len(request.assets)} assets",
        )
    
    try:
        predictions = {}
        for asset in request.assets:
            if request.type == "direction":
                predictions[asset.value] = await predictor.predict_direction(
                    asset=asset.value, timeframe=request.timeframe.value
                )
            elif request.type == "target":
                predictions[asset.value] = await predictor.predict_target(
                    asset=asset.value, timeframe=request.timeframe.value
                )
            elif request.type == "confidence":
                predictions[asset.value] = await predictor.predict_confidence(
                    asset=asset.value, timeframe=request.timeframe.value
                )
            elif request.type == "full":
                predictions[asset.value] = await predictor.predict_full(
                    asset=asset.value, timeframe=request.timeframe.value
                )
        
        return {
            "success": True,
            "predictions": predictions,
            "total_cost": total_cost,
            "asset_count": len(request.assets),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/backtest")
@x402_paywall(amount=PRICING["backtest"], description="Strategy backtesting")
async def run_backtest(request: BacktestRequest):
    """
    Run strategy backtesting
    Cost: $0.50
    """
    try:
        result = await predictor.run_backtest(
            asset=request.asset.value,
            strategy=request.strategy.value,
            start_date=request.start_date,
            end_date=request.end_date,
            parameters=request.parameters,
        )
        return {
            "success": True,
            "backtest": result,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# Health & Debug
# ============================================================================

@app.get("/health")
async def health():
    """Health check endpoint"""
    return {"status": "healthy", "timestamp": predictor.get_timestamp()}

@app.get("/debug/cache")
async def debug_cache():
    """Debug: View cache stats"""
    return predictor.get_cache_stats()

@app.post("/debug/clear-cache")
async def clear_cache():
    """Debug: Clear prediction cache"""
    predictor.clear_cache()
    return {"success": True, "message": "Cache cleared"}
