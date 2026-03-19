export function lastUserText(prompt: Array<{ role: string; content: Array<{ type: string; text?: string }> }>): string {
  for (let i = prompt.length - 1; i >= 0; i--) {
    const msg = prompt[i];
    if (msg.role === "user") {
      return msg.content
        .filter((p) => p.type === "text")
        .map((p) => p.text ?? "")
        .join("");
    }
  }
  return "";
}
