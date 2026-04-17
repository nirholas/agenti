from crewai.tools import BaseTool
from pydantic import BaseModel, Field
from ..pay import pay
from ..balance import get_balances


class PayInput(BaseModel):
    url: str = Field(description='URL to request with x402 auto-payment')
    method: str = Field(default='GET', description='HTTP method')


class BalanceInput(BaseModel):
    evm_address: str | None = Field(default=None, description='EVM address to check USDC balance')
    sol_address: str | None = Field(default=None, description='Solana address to check SOL balance')
    network: str = Field(default='base-sepolia', description='EVM network: base, base-sepolia, ethereum')


class AgentiPayTool(BaseTool):
    name: str = 'agenti_pay'
    description: str = (
        'Make an HTTP request and automatically pay if the server requires '
        'x402 cryptocurrency payment (USDC on Base)'
    )
    args_schema: type[BaseModel] = PayInput
    private_key: str

    def _run(self, url: str, method: str = 'GET') -> str:
        import asyncio
        resp = asyncio.run(pay(url, self.private_key, method=method))
        return f'Status: {resp.status_code}\n{resp.text}'


class AgentiBalanceTool(BaseTool):
    name: str = 'agenti_balance'
    description: str = 'Check USDC (EVM) or SOL (Solana) balances for wallet addresses'
    args_schema: type[BaseModel] = BalanceInput

    def _run(self, evm_address: str | None = None, sol_address: str | None = None, network: str = 'base-sepolia') -> str:
        import asyncio
        balances = asyncio.run(get_balances(evm_address, sol_address, network))
        lines = []
        if 'usdc' in balances:
            lines.append(f"USDC ({balances['evm_address']}): {balances['usdc']:.6f}")
        if 'sol' in balances:
            lines.append(f"SOL ({balances['sol_address']}): {balances['sol']:.9f}")
        return '\n'.join(lines) if lines else 'No addresses provided'


def agenti_tools(private_key: str) -> list[BaseTool]:
    return [
        AgentiPayTool(private_key=private_key),
        AgentiBalanceTool(),
    ]
