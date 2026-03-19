import { AgentKit, erc20ActionProvider, walletActionProvider } from "@coinbase/agentkit";
import {
  actionsToTools,
  createAgentWallet,
  createAlephActionProvider,
  createLLMClient,
} from "@libertai/agentkit-plugin";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions.mjs";
import { config } from "./config.js";

const SYSTEM_PROMPT = `You are an autonomous AI agent on Base blockchain.
You have a wallet with ETH and USDC. You pay for compute via Aleph credits.

Each cycle:
1. Check your balances (ETH, USDC) and credit info
2. If credits are running low, buy more credits
3. If ETH is too low, swap some USDC for ETH
4. Report your status

Be concise. Only take action when needed.`;

export async function startAgent() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wallet = await createAgentWallet(config.privateKey, config.chain as any, config.rpcUrl);
  console.log(`Wallet: ${wallet.account.address}`);

  const agentkit = await AgentKit.from({
    walletProvider: wallet.provider,
    actionProviders: [
      walletActionProvider(),
      erc20ActionProvider(),
      createAlephActionProvider(config.privateKey),
    ],
  });

  const { tools, executeTool } = actionsToTools(agentkit.getActions());
  const openai = createLLMClient(config.privateKey);

  console.log(`Model: ${config.model}`);
  console.log(`Cycle interval: ${config.cycleIntervalMs}ms`);
  console.log(`Tools: ${tools.map((t) => t.function.name).join(", ")}`);
  console.log("---");

  let cycle = 0;
  while (true) {
    cycle++;
    console.log(`\n=== Cycle ${cycle} ===`);

    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Cycle ${cycle}: Check status and take any necessary actions.` },
    ];

    try {
      let response = await openai.chat.completions.create({
        model: config.model,
        messages,
        tools,
      });

      while (response.choices[0]?.finish_reason === "tool_calls") {
        const assistantMessage = response.choices[0].message;
        messages.push(assistantMessage);

        for (const toolCall of assistantMessage.tool_calls ?? []) {
          const name = toolCall.function.name;
          const args = toolCall.function.arguments;
          console.log(`  -> ${name}(${args})`);

          const result = await executeTool(name, args);

          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: result,
          });
        }

        response = await openai.chat.completions.create({
          model: config.model,
          messages,
          tools,
        });
      }

      const text = response.choices[0]?.message?.content;
      if (text) console.log(`Agent: ${text}`);
    } catch (err) {
      console.error("Cycle error:", err);
    }

    console.log(`Waiting ${config.cycleIntervalMs}ms...`);
    await new Promise((r) => setTimeout(r, config.cycleIntervalMs));
  }
}
