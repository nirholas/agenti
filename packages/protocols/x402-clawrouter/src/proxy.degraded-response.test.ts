import { describe, expect, it } from "vitest";

import { detectDegradedSuccessResponse } from "./proxy.js";

describe("detectDegradedSuccessResponse", () => {
  it("flags plain overload placeholder text", () => {
    const result = detectDegradedSuccessResponse(
      "The AI service is temporarily overloaded. Please try again in a moment.",
    );
    expect(result).toBeDefined();
  });

  it("flags overload placeholder inside successful chat response JSON", () => {
    const payload = JSON.stringify({
      choices: [
        {
          message: {
            role: "assistant",
            content: "The AI service is temporarily overloaded. Please try again in a moment.",
          },
        },
      ],
    });

    const result = detectDegradedSuccessResponse(payload);
    expect(result).toBeDefined();
  });

  it("flags known repetitive hallucination loop patterns", () => {
    const payload = JSON.stringify({
      choices: [
        {
          message: {
            role: "assistant",
            content: `The boxed is the response.

Yes.

The response is the text.

Yes.

The final answer is the boxed.

Yes.`,
          },
        },
      ],
    });

    const result = detectDegradedSuccessResponse(payload);
    expect(result).toBeDefined();
  });

  it("does not flag normal assistant responses", () => {
    const payload = JSON.stringify({
      choices: [
        {
          message: {
            role: "assistant",
            content: "Paris is the capital of France.",
          },
        },
      ],
    });

    const result = detectDegradedSuccessResponse(payload);
    expect(result).toBeUndefined();
  });
});
