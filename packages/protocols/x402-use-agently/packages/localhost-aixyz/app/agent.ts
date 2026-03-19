import { simulateReadableStream, stepCountIs, ToolLoopAgent } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import type { Accepts } from "aixyz/accepts";

const STATIC_TEXT = "Hello from localhost-aixyz!";

const staticModel = new MockLanguageModelV3({
  doGenerate: async () => ({
    content: [{ type: "text" as const, text: STATIC_TEXT }],
    finishReason: "stop" as const,
    usage: {
      inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: 0, text: 0, reasoning: 0 },
    },
    warnings: [],
  }),
  doStream: async () => ({
    stream: simulateReadableStream({
      chunks: [
        { type: "stream-start" as const, warnings: [] },
        { type: "text-start" as const, id: "1" },
        { type: "text-delta" as const, id: "1", delta: STATIC_TEXT },
        { type: "text-end" as const, id: "1" },
        {
          type: "finish" as const,
          finishReason: "stop" as const,
          usage: {
            inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
            outputTokens: { total: 0, text: 0, reasoning: 0 },
          },
        },
      ],
    }),
  }),
});

export const accepts: Accepts = { scheme: "free" };

export default new ToolLoopAgent({
  model: staticModel,
  stopWhen: stepCountIs(1),
});
