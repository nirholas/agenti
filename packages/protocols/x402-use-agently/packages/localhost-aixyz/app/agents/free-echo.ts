import { stepCountIs, ToolLoopAgent } from "ai";
import type { Accepts } from "aixyz/accepts";
import { lastUserText } from "./_utils";

const echoModel = {
  specificationVersion: "v3" as const,
  provider: "echo",
  modelId: "echo",
  supportedUrls: {},
  doGenerate(options: { prompt: Array<{ role: string; content: Array<{ type: string; text?: string }> }> }) {
    const text = lastUserText(options.prompt);
    return Promise.resolve({
      content: [{ type: "text" as const, text }],
      finishReason: "stop" as const,
      usage: {
        inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
        outputTokens: { total: 0, text: 0, reasoning: 0 },
      },
      warnings: [],
    });
  },
  doStream(options: { prompt: Array<{ role: string; content: Array<{ type: string; text?: string }> }> }) {
    const text = lastUserText(options.prompt);
    const stream = new ReadableStream({
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
    });
    return Promise.resolve({ stream });
  },
};

export const accepts: Accepts = { scheme: "free" };

export default new ToolLoopAgent({
  model: echoModel,
  stopWhen: stepCountIs(1),
});
