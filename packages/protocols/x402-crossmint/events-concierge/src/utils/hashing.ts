/**
 * Create a short, URL-safe id from a user id
 * Uses the first 16 hex chars of the SHA-256 hash for concise routing.
 */
export async function hashUserId(userId: string): Promise<string> {
  const data = new TextEncoder().encode(userId);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hex = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hex.slice(0, 16);
}


