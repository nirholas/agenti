from __future__ import annotations

import json
from typing import Any, Optional

import httpx
from coinbase_agentkit import ActionProvider, WalletProvider
from coinbase_agentkit.action_providers.action_decorator import create_action
from eth_account import Account
from pydantic import BaseModel, Field

DEFAULT_ALEPH_API_URLS = [
    "https://api2.aleph.im",
    "https://api3.aleph.im",
]
LIBERTAI_API_BASE = "https://api.libertai.io"
CREDITS_DECIMALS = 6


class GetCreditsInfoInput(BaseModel):
    """No input needed."""
    pass


class BuyCreditsInput(BaseModel):
    """Input for buying Aleph credits."""
    amount: float = Field(gt=0, description="Amount in USD to spend")


class AlephActionProvider(ActionProvider[WalletProvider]):
    """Action provider for Aleph Cloud credit management."""

    def __init__(
        self,
        private_key: str,
        *,
        aleph_api_urls: Optional[list[str]] = None,
    ) -> None:
        super().__init__("aleph", [])
        self._private_key = private_key
        self._aleph_api_urls = aleph_api_urls or DEFAULT_ALEPH_API_URLS
        self._account = Account.from_key(private_key)

    def supports_network(self, network: Any) -> bool:
        return True

    @create_action(
        name="get_credits_info",
        description=(
            "Get your current Aleph credit balance (in USD), cost per day (in USD), "
            "and estimated runway in days. Use this to decide whether you need to buy more credits."
        ),
        schema=GetCreditsInfoInput,
    )
    def get_credits_info(
        self, _wallet_provider: WalletProvider, args: dict[str, Any]
    ) -> str:
        address = self._account.address

        for base_url in self._aleph_api_urls:
            try:
                balance_resp = httpx.get(
                    f"{base_url}/api/v0/addresses/{address}/balance",
                    timeout=10,
                )
                costs_resp = httpx.get(
                    f"{base_url}/api/v0/costs",
                    params={
                        "include_details": "0",
                        "include_size": "true",
                        "address": address,
                    },
                    timeout=10,
                )

                if balance_resp.status_code != 200 or costs_resp.status_code != 200:
                    continue

                balance_data = balance_resp.json()
                costs_data = costs_resp.json()

                def to_usd(credits: float) -> float:
                    return credits / 10**CREDITS_DECIMALS

                balance_usd = to_usd(balance_data["credit_balance"])
                cost_per_second_usd = to_usd(costs_data["summary"]["total_cost_credit"])
                cost_per_day_usd = cost_per_second_usd * 86400
                runway_days = (
                    balance_usd / cost_per_day_usd if cost_per_day_usd > 0 else None
                )

                return json.dumps({
                    "balance_usd": balance_usd,
                    "cost_per_day_usd": cost_per_day_usd,
                    "runway_days": runway_days,
                })
            except Exception:
                continue

        return "Error: failed to fetch credits info from all Aleph API endpoints"

    @create_action(
        name="buy_credits",
        description=(
            "Buy Aleph credits using x402 payment. "
            "Specify the amount in USD to spend on credits."
        ),
        schema=BuyCreditsInput,
    )
    def buy_credits(
        self, _wallet_provider: WalletProvider, args: dict[str, Any]
    ) -> str:
        import asyncio

        try:
            validated = BuyCreditsInput(**args)
            address = self._account.address

            from libertai_x402 import create_payment_client

            async def _buy() -> str:
                async with create_payment_client(self._private_key) as client:
                    response = await client.post(
                        f"{LIBERTAI_API_BASE}/libertai/aleph-credits",
                        json={"address": address, "amount": validated.amount},
                    )
                    if response.status_code != 200:
                        return f"Error buying credits: {response.status_code} {response.text}"
                    return json.dumps(response.json())

            try:
                loop = asyncio.get_running_loop()
            except RuntimeError:
                loop = None

            if loop and loop.is_running():
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor() as pool:
                    future = pool.submit(asyncio.run, _buy())
                    return future.result()
            else:
                return asyncio.run(_buy())

        except Exception as e:
            return f"Error buying credits: {e}"
