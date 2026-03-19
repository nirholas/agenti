from __future__ import annotations

from openai import AsyncOpenAI

from libertai_x402 import create_payment_client

DEFAULT_BASE_URL = "https://api.libertai.io/v1"


def create_llm_client(
    private_key: str,
    *,
    base_url: str = DEFAULT_BASE_URL,
) -> AsyncOpenAI:
    """Create an AsyncOpenAI client that pays for inference via x402."""
    http_client = create_payment_client(private_key)
    return AsyncOpenAI(
        base_url=base_url,
        api_key="x402",
        http_client=http_client,
    )
