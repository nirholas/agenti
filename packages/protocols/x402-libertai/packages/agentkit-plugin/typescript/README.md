# @libertai/agentkit-plugin

Build autonomous agents that pay for their own compute and inference — powered by Coinbase [AgentKit](https://github.com/coinbase/agentkit), [Aleph Cloud](https://aleph.cloud), and [LibertAI](https://libertai.io).\
Includes an OpenAI-compatible LLM client (paid via [x402](https://www.x402.org/)), Aleph credit management tools, and AgentKit-to-OpenAI tool-calling helpers.

## Install

```bash
npm install @libertai/agentkit-plugin @coinbase/agentkit openai viem
```

## Quick start

```ts
import { AgentKit, walletActionProvider, erc20ActionProvider } from "@coinbase/agentkit";
import {
  createLLMClient,
  createAgentWallet,
  createAlephActionProvider,
  actionsToTools,
} from "@libertai/agentkit-plugin";

// 1. Create wallet
const wallet = await createAgentWallet(YOUR_PRIVATE_KEY, chain, rpcUrl);

// 2. Set up AgentKit with action providers
const agentkit = await AgentKit.from({
  walletProvider: wallet.provider,
  actionProviders: [
    walletActionProvider(),
    erc20ActionProvider(),
    createAlephActionProvider(YOUR_PRIVATE_KEY),
  ],
});

// 3. Convert actions to OpenAI tools
const { tools, executeTool } = actionsToTools(agentkit.getActions());

// 4. Create x402-enabled LLM client with the LibertAI API
const openai = createLLMClient(YOUR_PRIVATE_KEY);

// 5. Use in a chat completions loop
const response = await openai.chat.completions.create({
  model: "qwen3.5-35b-a3b",
  messages,
  tools,
});
```

## License

MIT
