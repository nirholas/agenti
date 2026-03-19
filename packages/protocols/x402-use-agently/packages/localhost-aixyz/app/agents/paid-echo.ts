import { stepCountIs, ToolLoopAgent } from "ai";
import { MockLanguageModelV3 } from "ai/test";
import type { Accepts } from "aixyz/accepts";
import { lastUserText } from "./_utils";

const echoModel = new MockLanguageModelV3({
  doGenerate: async (options) => {
    const text = lastUserText(options.prompt as any);
    return {
      content: [{ type: "text" as const, text }],
      finishReason: "stop" as const,
      usage: {
        inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 0, text: 0, reasoning: 0 },
      },
      warnings: [],
    };
  },
  doStream: async (options) => {
    const text = lastUserText(options.prompt as any);
    return {
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue({ type: "stream-start" as const, warnings: [] });
          controller.enqueue({ type: "text-start" as const, id: "1" });
          controller.enqueue({ type: "text-delta" as const, id: "1", delta: text });
          controller.enqueue({ type: "text-end" as const, id: "1" });
          controller.enqueue({
            type: "finish" as const,
            finishReason: "stop" as const,
            usage: {
              inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
              outputTokens: { total: 0, text: 0, reasoning: 0 },
            },
          });
          controller.close();
        },
      }),
    };
  },
});

export const accepts: Accepts = { scheme: "exact", price: "$0.001" };

export default new ToolLoopAgent({
  model: echoModel,
  stopWhen: stepCountIs(1),
});
