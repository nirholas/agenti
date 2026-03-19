/**
 * Partner Service Registry
 *
 * Defines available partner APIs that can be called through ClawRouter's proxy.
 * Partners provide specialized data (Twitter/X, etc.) via x402 micropayments.
 * The same wallet used for LLM calls pays for partner API calls — zero extra setup.
 */

export type PartnerServiceParam = {
  name: string;
  type: "string" | "string[]" | "number";
  description: string;
  required: boolean;
};

export type PartnerServiceDefinition = {
  /** Unique service ID used in tool names: blockrun_{id} */
  id: string;
  /** Human-readable name */
  name: string;
  /** Partner providing this service */
  partner: string;
  /** Short description for tool listing */
  description: string;
  /** Proxy path (relative to /v1) */
  proxyPath: string;
  /** HTTP method */
  method: "GET" | "POST";
  /** Parameters for the tool's JSON Schema */
  params: PartnerServiceParam[];
  /** Pricing info for display */
  pricing: {
    perUnit: string;
    unit: string;
    minimum: string;
    maximum: string;
  };
  /** Example usage for help text */
  example: {
    input: Record<string, unknown>;
    description: string;
  };
};

/**
 * All registered partner services.
 * New partners are added here — the rest of the system picks them up automatically.
 */
export const PARTNER_SERVICES: PartnerServiceDefinition[] = [
  {
    id: "x_users_lookup",
    name: "Twitter/X User Lookup",
    partner: "AttentionVC",
    description:
      "Look up real-time Twitter/X user profiles by username. " +
      "Call this ONLY when the user explicitly asks to look up, check, or get information about a specific Twitter/X user's profile (follower count, bio, verification status, etc.). " +
      "Do NOT call this for messages that merely contain x.com or twitter.com URLs — only invoke when the user is asking for profile information about a specific account. " +
      "Returns: follower count, verification badge, bio, location, join date. " +
      "Accepts up to 100 usernames per request (without @ prefix).",
    proxyPath: "/x/users/lookup",
    method: "POST",
    params: [
      {
        name: "usernames",
        type: "string[]",
        description:
          'Array of Twitter/X usernames to look up (without @ prefix). Example: ["elonmusk", "naval"]',
        required: true,
      },
    ],
    pricing: {
      perUnit: "$0.001",
      unit: "user",
      minimum: "$0.01 (10 users)",
      maximum: "$0.10 (100 users)",
    },
    example: {
      input: { usernames: ["elonmusk", "naval", "balaboris"] },
      description: "Look up 3 Twitter/X user profiles",
    },
  },
];

/**
 * Get a partner service by ID.
 */
export function getPartnerService(id: string): PartnerServiceDefinition | undefined {
  return PARTNER_SERVICES.find((s) => s.id === id);
}
