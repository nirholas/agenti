/**
 * Partner Tool Builder
 *
 * Converts partner service definitions into OpenClaw tool definitions.
 * Each tool's execute() calls through the local proxy which handles
 * x402 payment transparently using the same wallet.
 */

import { PARTNER_SERVICES, type PartnerServiceDefinition } from "./registry.js";

/** OpenClaw tool definition shape (duck-typed) */
export type PartnerToolDefinition = {
  name: string;
  description: string;
  parameters: {
    type: "object";
    properties: Record<string, unknown>;
    required: string[];
  };
  execute: (toolCallId: string, params: Record<string, unknown>) => Promise<unknown>;
};

/**
 * Build a single partner tool from a service definition.
 */
function buildTool(service: PartnerServiceDefinition, proxyBaseUrl: string): PartnerToolDefinition {
  // Build JSON Schema properties from service params
  const properties: Record<string, unknown> = {};
  const required: string[] = [];

  for (const param of service.params) {
    const prop: Record<string, unknown> = {
      description: param.description,
    };

    if (param.type === "string[]") {
      prop.type = "array";
      prop.items = { type: "string" };
    } else {
      prop.type = param.type;
    }

    properties[param.name] = prop;
    if (param.required) {
      required.push(param.name);
    }
  }

  return {
    name: `blockrun_${service.id}`,
    description: [
      service.description,
      "",
      `Partner: ${service.partner}`,
      `Pricing: ${service.pricing.perUnit} per ${service.pricing.unit} (min: ${service.pricing.minimum}, max: ${service.pricing.maximum})`,
    ].join("\n"),
    parameters: {
      type: "object",
      properties,
      required,
    },
    execute: async (_toolCallId: string, params: Record<string, unknown>) => {
      const url = `${proxyBaseUrl}/v1${service.proxyPath}`;

      const response = await fetch(url, {
        method: service.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        throw new Error(
          `Partner API error (${response.status}): ${errText || response.statusText}`,
        );
      }

      const data = await response.json();

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(data, null, 2),
          },
        ],
        details: data,
      };
    },
  };
}

/**
 * Build OpenClaw tool definitions for all registered partner services.
 * @param proxyBaseUrl - Local proxy base URL (e.g., "http://127.0.0.1:8402")
 */
export function buildPartnerTools(proxyBaseUrl: string): PartnerToolDefinition[] {
  return PARTNER_SERVICES.map((service) => buildTool(service, proxyBaseUrl));
}
