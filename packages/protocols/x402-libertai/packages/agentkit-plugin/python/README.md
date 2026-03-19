# libertai-agentkit-plugin

Build autonomous agents that pay for their own compute and inference — powered by Coinbase [AgentKit](https://github.com/coinbase/agentkit), [Aleph Cloud](https://aleph.cloud), and [LibertAI](https://libertai.io).

Includes an OpenAI-compatible LLM client (paid via [x402](https://www.x402.org/)), Aleph credit management tools, and AgentKit-to-OpenAI tool-calling helpers.

## Install

```bash
pip install libertai-agentkit-plugin
```

## Quick start

```python
import asyncio
from coinbase_agentkit import AgentKit, AgentKitConfig
from coinbase_agentkit.wallet_providers import EthAccountWalletProvider

from libertai_agentkit_plugin import (
    create_llm_client,
    create_agent_wallet,
    actions_to_tools,
)
from libertai_agentkit_plugin.actions.aleph import AlephActionProvider

PRIVATE_KEY = "0x..."

async def main():
    # 1. Create wallet
    wallet_provider = create_agent_wallet(PRIVATE_KEY)

    # 2. Set up AgentKit with action providers
    agentkit = AgentKit(AgentKitConfig(
        wallet_provider=wallet_provider,
        action_providers=[AlephActionProvider(PRIVATE_KEY)],
    ))

    # 3. Convert actions to OpenAI tools
    tools, execute_tool = actions_to_tools(agentkit.get_actions())

    # 4. Create x402-enabled LLM client
    client = create_llm_client(PRIVATE_KEY)

    # 5. Use in a chat completions loop
    response = await client.chat.completions.create(
        model="qwen3.5-35b-a3b",
        messages=[{"role": "user", "content": "Check my balances"}],
        tools=tools,
    )
    print(response.choices[0].message.content)

asyncio.run(main())
```

## License

MIT
