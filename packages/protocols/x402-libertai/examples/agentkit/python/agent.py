from __future__ import annotations

import asyncio

from coinbase_agentkit import AgentKit, AgentKitConfig
from coinbase_agentkit.action_providers.erc20.erc20_action_provider import (
    ERC20ActionProvider,
)
from coinbase_agentkit.action_providers.wallet.wallet_action_provider import (
    WalletActionProvider,
)

from libertai_agentkit_plugin import (
    actions_to_tools,
    create_agent_wallet,
    create_llm_client,
)
from libertai_agentkit_plugin.actions.aleph import AlephActionProvider

from config import CYCLE_INTERVAL_S, MODEL, PRIVATE_KEY, RPC_URL

SYSTEM_PROMPT = """You are an autonomous AI agent on Base blockchain.
You have a wallet with ETH and USDC. You pay for compute via Aleph credits.

Each cycle:
1. Check your balances (ETH, USDC) and credit info
2. If credits are running low, buy more credits
3. If ETH is too low, swap some USDC for ETH
4. Report your status

Be concise. Only take action when needed."""


async def start_agent() -> None:
    wallet_provider = create_agent_wallet(PRIVATE_KEY, rpc_url=RPC_URL)
    address = wallet_provider.get_address()
    print(f"Wallet: {address}")

    agentkit = AgentKit(AgentKitConfig(
        wallet_provider=wallet_provider,
        action_providers=[
            WalletActionProvider(),
            ERC20ActionProvider(),
            AlephActionProvider(PRIVATE_KEY),
        ],
    ))

    tools, execute_tool = actions_to_tools(agentkit.get_actions())
    openai = create_llm_client(PRIVATE_KEY)

    print(f"Model: {MODEL}")
    print(f"Cycle interval: {CYCLE_INTERVAL_S}s")
    print(f"Tools: {', '.join(t['function']['name'] for t in tools)}")
    print("---")

    cycle = 0
    while True:
        cycle += 1
        print(f"\n=== Cycle {cycle} ===")

        messages = [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": f"Cycle {cycle}: Check status and take any necessary actions."},
        ]

        try:
            response = await openai.chat.completions.create(
                model=MODEL,
                messages=messages,
                tools=tools,
            )

            while response.choices[0].finish_reason == "tool_calls":
                assistant_msg = response.choices[0].message
                messages.append(assistant_msg)

                for tool_call in assistant_msg.tool_calls or []:
                    name = tool_call.function.name
                    args = tool_call.function.arguments
                    print(f"  -> {name}({args})")

                    result = await execute_tool(name, args)
                    messages.append({
                        "role": "tool",
                        "tool_call_id": tool_call.id,
                        "content": result,
                    })

                response = await openai.chat.completions.create(
                    model=MODEL,
                    messages=messages,
                    tools=tools,
                )

            text = response.choices[0].message.content
            if text:
                print(f"Agent: {text}")
        except Exception as e:
            print(f"Cycle error: {e}")

        print(f"Waiting {CYCLE_INTERVAL_S}s...")
        await asyncio.sleep(CYCLE_INTERVAL_S)


if __name__ == "__main__":
    asyncio.run(start_agent())
