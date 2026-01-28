"""
AI Providers - Interfaces for various AI/LLM providers.

Supports:
- OpenAI (GPT-4, GPT-3.5)
- Anthropic (Claude)
- OpenRouter (200+ models with single API key)
- Local models (Ollama, llama.cpp)
- Mock provider for testing
"""

import asyncio
import logging
import os
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
from dataclasses import dataclass
import json

logger = logging.getLogger(__name__)


class AIProvider(ABC):
    """Abstract base class for AI providers."""
    
    @abstractmethod
    async def complete(self, prompt: str) -> Dict[str, Any]:
        """
        Complete a prompt.
        
        Args:
            prompt: Input prompt
            
        Returns:
            Dict with 'content', 'tokens_used', 'confidence', 'metadata'
        """
        pass
    
    @abstractmethod
    async def health_check(self) -> bool:
        """Check if the provider is available."""
        pass


class OpenAIProvider(AIProvider):
    """OpenAI API provider."""
    
    def __init__(self, config: 'AIConfig'):
        self.config = config
        self._client = None
    
    async def _get_client(self):
        """Get or create OpenAI client."""
        if self._client is None:
            try:
                import openai
                self._client = openai.AsyncOpenAI(
                    api_key=self.config.api_key,
                    base_url=self.config.api_base,
                )
            except ImportError:
                logger.warning("openai package not installed")
                return None
        return self._client
    
    async def complete(self, prompt: str) -> Dict[str, Any]:
        """Complete using OpenAI API."""
        client = await self._get_client()
        
        if client is None:
            return {
                "content": "OpenAI client not available",
                "tokens_used": 0,
                "confidence": 0.0,
                "metadata": {"error": "client_unavailable"},
            }
        
        try:
            response = await client.chat.completions.create(
                model=self.config.model,
                messages=[
                    {"role": "system", "content": "You are an expert code analyst."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=self.config.max_tokens,
                temperature=self.config.temperature,
            )
            
            content = response.choices[0].message.content
            tokens = response.usage.total_tokens if response.usage else 0
            
            return {
                "content": content,
                "tokens_used": tokens,
                "confidence": 0.9,
                "metadata": {
                    "model": response.model,
                    "finish_reason": response.choices[0].finish_reason,
                },
            }
            
        except Exception as e:
            logger.error(f"OpenAI API error: {e}")
            return {
                "content": f"Error: {str(e)}",
                "tokens_used": 0,
                "confidence": 0.0,
                "metadata": {"error": str(e)},
            }
    
    async def health_check(self) -> bool:
        """Check if OpenAI is available."""
        try:
            client = await self._get_client()
            if client is None:
                return False
            # Simple models list to verify connectivity
            return True
        except Exception:
            return False


class AnthropicProvider(AIProvider):
    """Anthropic Claude API provider."""
    
    def __init__(self, config: 'AIConfig'):
        self.config = config
        self._client = None
    
    async def _get_client(self):
        """Get or create Anthropic client."""
        if self._client is None:
            try:
                import anthropic
                self._client = anthropic.AsyncAnthropic(
                    api_key=self.config.api_key,
                )
            except ImportError:
                logger.warning("anthropic package not installed")
                return None
        return self._client
    
    async def complete(self, prompt: str) -> Dict[str, Any]:
        """Complete using Anthropic API."""
        client = await self._get_client()
        
        if client is None:
            return {
                "content": "Anthropic client not available",
                "tokens_used": 0,
                "confidence": 0.0,
                "metadata": {"error": "client_unavailable"},
            }
        
        try:
            response = await client.messages.create(
                model=self.config.model,
                max_tokens=self.config.max_tokens,
                messages=[
                    {"role": "user", "content": prompt}
                ],
            )
            
            content = response.content[0].text
            tokens = response.usage.input_tokens + response.usage.output_tokens
            
            return {
                "content": content,
                "tokens_used": tokens,
                "confidence": 0.9,
                "metadata": {
                    "model": response.model,
                    "stop_reason": response.stop_reason,
                },
            }
            
        except Exception as e:
            logger.error(f"Anthropic API error: {e}")
            return {
                "content": f"Error: {str(e)}",
                "tokens_used": 0,
                "confidence": 0.0,
                "metadata": {"error": str(e)},
            }
    
    async def health_check(self) -> bool:
        """Check if Anthropic is available."""
        try:
            client = await self._get_client()
            return client is not None
        except Exception:
            return False


class OpenRouterProvider(AIProvider):
    """OpenRouter API provider - unified access to 200+ models."""
    
    def __init__(self, config: 'AIConfig'):
        self.config = config
        self._client = None
    
    async def _get_client(self):
        """Get or create OpenRouter client (uses OpenAI SDK)."""
        if self._client is None:
            try:
                import openai
                self._client = openai.AsyncOpenAI(
                    api_key=self.config.api_key or os.getenv("OPENROUTER_API_KEY"),
                    base_url=self.config.api_base or "https://openrouter.ai/api/v1",
                    default_headers={
                        "HTTP-Referer": os.getenv("OPENROUTER_REFERER", "https://github.com/nirholas/lyra-intel"),
                        "X-Title": "Lyra Intel",
                    }
                )
            except ImportError:
                logger.warning("openai package not installed (required for OpenRouter)")
                return None
        return self._client
    
    async def complete(self, prompt: str) -> Dict[str, Any]:
        """Complete using OpenRouter API."""
        client = await self._get_client()
        
        if client is None:
            return {
                "content": "OpenRouter client not available",
                "tokens_used": 0,
                "confidence": 0.0,
                "metadata": {"error": "client_unavailable"},
            }
        
        try:
            model = self.config.model or os.getenv("OPENROUTER_MODEL", "anthropic/claude-sonnet-4")
            response = await client.chat.completions.create(
                model=model,
                messages=[
                    {"role": "system", "content": "You are an expert code analyst."},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=self.config.max_tokens,
                temperature=self.config.temperature,
            )
            
            content = response.choices[0].message.content
            tokens = response.usage.total_tokens if response.usage else 0
            
            return {
                "content": content,
                "tokens_used": tokens,
                "confidence": 0.9,
                "metadata": {
                    "model": response.model,
                    "finish_reason": response.choices[0].finish_reason,
                    "provider": "openrouter",
                },
            }
            
        except Exception as e:
            logger.error(f"OpenRouter API error: {e}")
            return {
                "content": f"Error: {str(e)}",
                "tokens_used": 0,
                "confidence": 0.0,
                "metadata": {"error": str(e)},
            }
    
    async def health_check(self) -> bool:
        """Check if OpenRouter is available."""
        try:
            client = await self._get_client()
            return client is not None
        except Exception:
            return False


class LocalProvider(AIProvider):
    """Local model provider (Ollama, llama.cpp)."""
    
    def __init__(self, config: 'AIConfig'):
        self.config = config
        self.base_url = config.api_base or "http://localhost:11434"
    
    async def complete(self, prompt: str) -> Dict[str, Any]:
        """Complete using local model."""
        try:
            import aiohttp
        except ImportError:
            return {
                "content": "aiohttp not installed",
                "tokens_used": 0,
                "confidence": 0.0,
                "metadata": {"error": "aiohttp_not_installed"},
            }
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"{self.base_url}/api/generate",
                    json={
                        "model": self.config.model,
                        "prompt": prompt,
                        "stream": False,
                    },
                    timeout=aiohttp.ClientTimeout(total=self.config.timeout)
                ) as response:
                    if response.status == 200:
                        data = await response.json()
                        return {
                            "content": data.get("response", ""),
                            "tokens_used": data.get("eval_count", 0),
                            "confidence": 0.8,
                            "metadata": {
                                "model": data.get("model"),
                                "duration_ms": data.get("total_duration", 0) / 1e6,
                            },
                        }
                    else:
                        return {
                            "content": f"Error: HTTP {response.status}",
                            "tokens_used": 0,
                            "confidence": 0.0,
                            "metadata": {"error": f"HTTP {response.status}"},
                        }
                        
        except Exception as e:
            logger.error(f"Local model error: {e}")
            return {
                "content": f"Error: {str(e)}",
                "tokens_used": 0,
                "confidence": 0.0,
                "metadata": {"error": str(e)},
            }
    
    async def health_check(self) -> bool:
        """Check if local model is available."""
        try:
            import aiohttp
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{self.base_url}/api/tags") as response:
                    return response.status == 200
        except Exception:
            return False


class MockProvider(AIProvider):
    """Mock provider for testing."""
    
    def __init__(self, config: 'AIConfig'):
        self.config = config
        self._responses = {
            "explain": "This code defines a function that processes data.",
            "bugs": "[]",
            "refactor": "[]",
            "document": "/**\n * Documentation for this code\n */",
            "security": "[]",
            "review": '{"summary": "Code looks good", "score": 8, "issues": [], "suggestions": []}',
            "summarize": "This file handles data processing.",
            "test_cases": "[]",
        }
    
    async def complete(self, prompt: str) -> Dict[str, Any]:
        """Return mock response."""
        await asyncio.sleep(0.1)  # Simulate latency
        
        # Determine response type from prompt
        response_type = "explain"
        for key in self._responses:
            if key.lower() in prompt.lower():
                response_type = key
                break
        
        return {
            "content": self._responses.get(response_type, "Mock response"),
            "tokens_used": 100,
            "confidence": 0.95,
            "metadata": {"provider": "mock"},
        }
    
    async def health_check(self) -> bool:
        """Mock is always healthy."""
        return True


def get_provider(config: 'AIConfig') -> AIProvider:
    """
    Get the appropriate AI provider based on config.
    
    Args:
        config: AI configuration
        
    Returns:
        AI provider instance
    """
    providers = {
        "openai": OpenAIProvider,
        "anthropic": AnthropicProvider,
        "openrouter": OpenRouterProvider,
        "local": LocalProvider,
        "ollama": LocalProvider,
        "mock": MockProvider,
    }
    
    provider_class = providers.get(config.provider.lower(), MockProvider)
    return provider_class(config)
