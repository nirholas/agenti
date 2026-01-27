"""
LSTM Price Prediction Model
Based on lstm-bitcoin-prediction (11⭐)
https://github.com/nirholas/lstm-bitcoin-prediction

This module provides LSTM-based cryptocurrency price predictions.
In production, load actual trained PyTorch models.
"""

import numpy as np
from datetime import datetime
from typing import Dict, Any, Optional, List
from cachetools import TTLCache
import hashlib

from ..config import settings


class LSTMPredictor:
    """
    LSTM-based cryptocurrency price predictor.
    
    In production, this would load actual PyTorch models.
    For development, it provides simulated predictions.
    """
    
    def __init__(self):
        self.model_version = settings.model_version
        self.cache = TTLCache(maxsize=1000, ttl=settings.cache_ttl)
        
        # Base prices for supported assets (would be fetched from market data in production)
        self.base_prices = {
            "BTC": 95000,
            "ETH": 3200,
            "SOL": 180,
            "ARB": 1.20,
            "AVAX": 35,
            "MATIC": 0.80,
            "LINK": 18,
            "UNI": 12,
            "AAVE": 280,
            "OP": 2.50,
        }
        
        # Timeframe multipliers for price change calculations
        self.timeframe_multipliers = {
            "1h": 0.01,
            "4h": 0.025,
            "1d": 0.05,
            "1w": 0.15,
        }
    
    def _get_cache_key(self, method: str, *args) -> str:
        """Generate cache key"""
        key_str = f"{method}:{':'.join(str(a) for a in args)}"
        return hashlib.md5(key_str.encode()).hexdigest()
    
    def _get_current_price(self, asset: str) -> float:
        """Get current price with small variance"""
        base = self.base_prices.get(asset, 100)
        variance = 0.02
        return base * (1 + (np.random.random() * 2 - 1) * variance)
    
    def _simulate_prediction(self, asset: str, timeframe: str) -> Dict[str, Any]:
        """
        Simulate LSTM model prediction.
        In production, this runs actual model inference.
        """
        current_price = self._get_current_price(asset)
        
        # Generate technical indicators (simulated)
        rsi = np.random.uniform(20, 80)
        macd = np.random.uniform(-0.5, 0.5)
        macd_signal = macd + np.random.uniform(-0.1, 0.1)
        ema_short = current_price * (1 + np.random.uniform(-0.02, 0.02))
        ema_long = current_price * (1 + np.random.uniform(-0.03, 0.03))
        volume_ratio = np.random.uniform(0.5, 2.0)
        volatility = np.random.uniform(0.01, 0.05)
        
        # Determine direction based on indicators
        bullish_score = (
            (1 if rsi < 50 else -1) +
            (1 if macd > macd_signal else -1) +
            (1 if ema_short > ema_long else -1)
        )
        
        if bullish_score > 1:
            direction = "bullish"
        elif bullish_score < -1:
            direction = "bearish"
        else:
            direction = "sideways"
        
        # Calculate predicted price
        max_change = self.timeframe_multipliers.get(timeframe, 0.05)
        price_change = np.random.uniform(-max_change, max_change)
        
        if direction == "bullish":
            price_change = abs(price_change)
        elif direction == "bearish":
            price_change = -abs(price_change)
        
        predicted_price = current_price * (1 + price_change)
        
        # Calculate confidence
        confidence = min(0.95, max(0.3, 0.5 + abs(bullish_score) * 0.15 + np.random.uniform(0, 0.2)))
        
        return {
            "current_price": round(current_price, 2),
            "predicted_price": round(predicted_price, 2),
            "direction": direction,
            "confidence": round(confidence, 2),
            "features": {
                "rsi": round(rsi, 2),
                "macd": round(macd, 4),
                "macd_signal": round(macd_signal, 4),
                "ema_short": round(ema_short, 2),
                "ema_long": round(ema_long, 2),
                "volume_ratio": round(volume_ratio, 2),
                "volatility": round(volatility, 4),
            }
        }
    
    async def predict_direction(self, asset: str, timeframe: str) -> Dict[str, Any]:
        """Predict price direction (Up/Down/Sideways)"""
        cache_key = self._get_cache_key("direction", asset, timeframe)
        
        if cache_key in self.cache:
            return self.cache[cache_key]
        
        prediction = self._simulate_prediction(asset, timeframe)
        
        result = {
            "type": "direction",
            "asset": asset,
            "timeframe": timeframe,
            "direction": prediction["direction"],
            "timestamp": self.get_timestamp(),
            "model_version": self.model_version,
        }
        
        self.cache[cache_key] = result
        return result
    
    async def predict_target(self, asset: str, timeframe: str) -> Dict[str, Any]:
        """Predict specific price target"""
        cache_key = self._get_cache_key("target", asset, timeframe)
        
        if cache_key in self.cache:
            return self.cache[cache_key]
        
        prediction = self._simulate_prediction(asset, timeframe)
        current = prediction["current_price"]
        predicted = prediction["predicted_price"]
        
        # Calculate support/resistance levels
        price_range = abs(predicted - current)
        
        result = {
            "type": "target",
            "asset": asset,
            "timeframe": timeframe,
            "current_price": current,
            "predicted_price": predicted,
            "price_change_pct": round((predicted - current) / current * 100, 2),
            "support_levels": [
                round(current - price_range * 0.5, 2),
                round(current - price_range * 1.0, 2),
                round(current - price_range * 1.5, 2),
            ],
            "resistance_levels": [
                round(current + price_range * 0.5, 2),
                round(current + price_range * 1.0, 2),
                round(current + price_range * 1.5, 2),
            ],
            "timestamp": self.get_timestamp(),
            "model_version": self.model_version,
        }
        
        self.cache[cache_key] = result
        return result
    
    async def predict_confidence(self, asset: str, timeframe: str) -> Dict[str, Any]:
        """Get model confidence score"""
        cache_key = self._get_cache_key("confidence", asset, timeframe)
        
        if cache_key in self.cache:
            return self.cache[cache_key]
        
        prediction = self._simulate_prediction(asset, timeframe)
        features = prediction["features"]
        
        # Break down confidence by factor
        technical = min(1, max(0, abs(features["rsi"] - 50) / 50 * 0.3 + 0.5))
        momentum = min(1, max(0, abs(features["macd"] - features["macd_signal"]) * 2 + 0.4))
        volatility_score = min(1, max(0, 1 - features["volatility"] * 10))
        volume_score = min(1, max(0, features["volume_ratio"] / 2))
        
        result = {
            "type": "confidence",
            "asset": asset,
            "timeframe": timeframe,
            "confidence": prediction["confidence"],
            "confidence_breakdown": {
                "technical": round(technical, 2),
                "momentum": round(momentum, 2),
                "volatility": round(volatility_score, 2),
                "volume": round(volume_score, 2),
            },
            "timestamp": self.get_timestamp(),
            "model_version": self.model_version,
        }
        
        self.cache[cache_key] = result
        return result
    
    async def predict_full(self, asset: str, timeframe: str) -> Dict[str, Any]:
        """Get full prediction report"""
        cache_key = self._get_cache_key("full", asset, timeframe)
        
        if cache_key in self.cache:
            return self.cache[cache_key]
        
        # Get all prediction components
        direction = await self.predict_direction(asset, timeframe)
        target = await self.predict_target(asset, timeframe)
        confidence = await self.predict_confidence(asset, timeframe)
        
        prediction = self._simulate_prediction(asset, timeframe)
        features = prediction["features"]
        
        # Generate analysis summary
        direction_text = "upward" if direction["direction"] == "bullish" else \
                        "downward" if direction["direction"] == "bearish" else "sideways"
        
        summary = (
            f"{asset} is showing {direction_text} momentum on the {timeframe} timeframe. "
            f"Model confidence is {int(confidence['confidence'] * 100)}%. "
            f"Price target: ${target['predicted_price']} "
            f"({'+' if target['price_change_pct'] > 0 else ''}{target['price_change_pct']}%)."
        )
        
        # Calculate risk/reward
        current = target["current_price"]
        stop_loss = target["support_levels"][0]
        take_profit = target["resistance_levels"][1]
        
        result = {
            "type": "full",
            "asset": asset,
            "timeframe": timeframe,
            "direction": direction,
            "target": target,
            "confidence": confidence,
            "analysis": {
                "summary": summary,
                "key_levels": {
                    "support": target["support_levels"],
                    "resistance": target["resistance_levels"],
                    "pivot": round((target["support_levels"][0] + target["resistance_levels"][0]) / 2, 2),
                },
                "indicators": {
                    "rsi": features["rsi"],
                    "macd": {
                        "value": features["macd"],
                        "signal": features["macd_signal"],
                        "histogram": round(features["macd"] - features["macd_signal"], 4),
                    },
                    "ema_trend": "bullish" if features["ema_short"] > features["ema_long"] else \
                                "bearish" if features["ema_short"] < features["ema_long"] else "neutral",
                },
                "risk_reward": {
                    "stop_loss": stop_loss,
                    "take_profit": take_profit,
                    "ratio": round(abs(take_profit - current) / abs(current - stop_loss), 2) \
                            if abs(current - stop_loss) > 0 else 0,
                },
            },
            "timestamp": self.get_timestamp(),
            "model_version": self.model_version,
        }
        
        self.cache[cache_key] = result
        return result
    
    async def run_backtest(
        self,
        asset: str,
        strategy: str,
        start_date: str,
        end_date: str,
        parameters: Optional[Dict[str, float]] = None,
    ) -> Dict[str, Any]:
        """Run strategy backtesting"""
        
        # Calculate period days
        start = datetime.strptime(start_date, "%Y-%m-%d")
        end = datetime.strptime(end_date, "%Y-%m-%d")
        days = (end - start).days
        
        # Simulate backtest results
        total_return = np.random.uniform(-20, 80)
        trades = max(1, days // 3)
        win_rate = np.random.uniform(0.4, 0.65)
        winning = int(trades * win_rate)
        avg_win = np.random.uniform(2, 8)
        avg_loss = np.random.uniform(1, 4)
        
        result = {
            "asset": asset,
            "strategy": strategy,
            "period": {
                "start": start_date,
                "end": end_date,
                "days": days,
            },
            "performance": {
                "total_return_pct": round(total_return, 2),
                "annualized_return_pct": round(total_return * 365 / days, 2) if days > 0 else 0,
                "sharpe_ratio": round(np.random.uniform(0.5, 2.5), 2),
                "sortino_ratio": round(np.random.uniform(0.8, 3.0), 2),
                "max_drawdown_pct": round(np.random.uniform(5, 25), 2),
                "win_rate_pct": round(win_rate * 100, 2),
                "profit_factor": round((winning * avg_win) / max(1, (trades - winning) * avg_loss), 2),
            },
            "trades": {
                "total": trades,
                "winning": winning,
                "losing": trades - winning,
                "average_win_pct": round(avg_win, 2),
                "average_loss_pct": round(avg_loss, 2),
            },
            "risk_metrics": {
                "volatility_annual": round(np.random.uniform(15, 50), 2),
                "var_95": round(np.random.uniform(2, 8), 2),
                "cvar_95": round(np.random.uniform(3, 12), 2),
                "beta": round(np.random.uniform(0.8, 1.4), 2),
                "alpha": round(np.random.uniform(-5, 15), 2),
            },
            "comparison": {
                "vs_buy_hold": round(np.random.uniform(-10, 30), 2),
                "vs_benchmark": round(np.random.uniform(-15, 25), 2),
            },
            "timestamp": self.get_timestamp(),
        }
        
        return result
    
    def get_timestamp(self) -> str:
        """Get current ISO timestamp"""
        return datetime.utcnow().isoformat() + "Z"
    
    def get_model_info(self) -> Dict[str, Any]:
        """Get model information"""
        return {
            "version": self.model_version,
            "type": "LSTM",
            "features": ["OHLCV", "RSI", "MACD", "EMA", "Volume"],
            "supported_assets": list(self.base_prices.keys()),
            "cache_enabled": settings.cache_enabled,
        }
    
    def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache statistics"""
        return {
            "size": len(self.cache),
            "maxsize": self.cache.maxsize,
            "ttl": settings.cache_ttl,
        }
    
    def clear_cache(self):
        """Clear prediction cache"""
        self.cache.clear()
