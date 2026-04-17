# Build: CrewAI Tool Adapter (Python)

status: complete

## Goal
Create a Python package `packages/sdk-python/` that provides a CrewAI-compatible tool for agenti payments. This is the beginning of the Python SDK.

## Output location
```
packages/sdk-python/
  pyproject.toml
  agenti/
    __init__.py
    wallet.py      — wallet generation via eth_account + solders
    pay.py         — x402 client using httpx
    balance.py     — USDC + SOL balance queries
    tools/
      __init__.py
      crewai.py    — CrewAI BaseTool subclasses
```

## Check GitHub first
Check `prompts/results/scan-framework-adapters-results.md` for any Python x402 or CrewAI crypto payment tools. Clone + rewrite anything useful.

## wallet.py
```python
from eth_account import Account
from solders.keypair import Keypair
import secrets

def generate_wallet():
    evm_key = '0x' + secrets.token_hex(32)
    evm_account = Account.from_key(evm_key)
    sol_kp = Keypair()
    return {
        'evm': {'address': evm_account.address, 'private_key': evm_key},
        'solana': {'address': str(sol_kp.pubkey()), 'private_key': sol_kp.secret().hex()}
    }
```

## pay.py
x402 client using httpx:
```python
import httpx
import json, base64
from eth_account import Account
from eth_account.messages import encode_structured_data

async def pay(url: str, private_key: str, **kwargs) -> httpx.Response:
    """Make HTTP request, auto-pay if 402 is returned."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(url, **kwargs)
        if resp.status_code != 402:
            return resp
        # parse requirements, sign EIP-3009, retry
        requirements = _parse_requirements(resp)
        payment = _sign_evm_payment(requirements, private_key)
        headers = {'X-Payment': base64.b64encode(json.dumps(payment).encode()).decode()}
        return await client.get(url, headers=headers, **kwargs)
```

## tools/crewai.py
```python
from crewai.tools import BaseTool
from pydantic import BaseModel, Field
from ..pay import pay
from ..balance import get_balances

class PayInput(BaseModel):
    url: str = Field(description='URL to request with x402 auto-payment')
    method: str = Field(default='GET')

class AgentiPayTool(BaseTool):
    name: str = 'agenti_pay'
    description: str = 'Make an HTTP request and automatically pay if the server requires x402 cryptocurrency payment'
    args_schema: type[BaseModel] = PayInput
    private_key: str

    def _run(self, url: str, method: str = 'GET') -> str:
        import asyncio
        resp = asyncio.run(pay(url, self.private_key, method=method))
        return f'Status: {resp.status_code}\n{resp.text}'

def agenti_tools(private_key: str) -> list[BaseTool]:
    return [AgentiPayTool(private_key=private_key)]
```

## pyproject.toml
```toml
[project]
name = "agenti"
version = "0.1.0"
description = "Give AI agents the ability to pay with cryptocurrency"
requires-python = ">=3.11"
dependencies = [
    "httpx>=0.27",
    "eth-account>=0.11",
    "solders>=0.21",
    "crewai>=0.51",
]

[project.optional-dependencies]
crewai = ["crewai>=0.51"]

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"
```

Mark this file's status as `complete` when done.
