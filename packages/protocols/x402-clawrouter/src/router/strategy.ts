/**
 * Router Strategy Registry
 *
 * Pluggable strategy system for request routing.
 * Default: RulesStrategy — identical to the original inline route() logic, <1ms.
 */

import type { Tier, RoutingDecision, RouterStrategy, RouterOptions } from "./types.js";
import { classifyByRules } from "./rules.js";
import { selectModel } from "./selector.js";

/**
 * Rules-based routing strategy.
 * Extracted from the original route() in index.ts — logic is identical.
 * Attaches tierConfigs and profile to the decision for downstream use.
 */
export class RulesStrategy implements RouterStrategy {
  readonly name = "rules";

  route(
    prompt: string,
    systemPrompt: string | undefined,
    maxOutputTokens: number,
    options: RouterOptions,
  ): RoutingDecision {
    const { config, modelPricing } = options;

    // Estimate input tokens (~4 chars per token)
    const fullText = `${systemPrompt ?? ""} ${prompt}`;
    const estimatedTokens = Math.ceil(fullText.length / 4);

    // --- Rule-based classification (runs first to get agenticScore) ---
    const ruleResult = classifyByRules(prompt, systemPrompt, estimatedTokens, config.scoring);

    // --- Select tier configs based on routing profile ---
    const { routingProfile } = options;
    let tierConfigs: Record<Tier, { primary: string; fallback: string[] }>;
    let profileSuffix: string;
    let profile: RoutingDecision["profile"];

    if (routingProfile === "eco" && config.ecoTiers) {
      tierConfigs = config.ecoTiers;
      profileSuffix = " | eco";
      profile = "eco";
    } else if (routingProfile === "premium" && config.premiumTiers) {
      tierConfigs = config.premiumTiers;
      profileSuffix = " | premium";
      profile = "premium";
    } else {
      // Auto profile (or undefined): intelligent routing with agentic detection
      const agenticScore = ruleResult.agenticScore ?? 0;
      const isAutoAgentic = agenticScore >= 0.5;
      const isExplicitAgentic = config.overrides.agenticMode ?? false;
      const hasToolsInRequest = options.hasTools ?? false;
      const useAgenticTiers =
        (hasToolsInRequest || isAutoAgentic || isExplicitAgentic) && config.agenticTiers != null;
      tierConfigs = useAgenticTiers ? config.agenticTiers! : config.tiers;
      profileSuffix = useAgenticTiers ? ` | agentic${hasToolsInRequest ? " (tools)" : ""}` : "";
      profile = useAgenticTiers ? "agentic" : "auto";
    }

    const agenticScoreValue = ruleResult.agenticScore;

    // --- Override: large context → force COMPLEX ---
    if (estimatedTokens > config.overrides.maxTokensForceComplex) {
      const decision = selectModel(
        "COMPLEX",
        0.95,
        "rules",
        `Input exceeds ${config.overrides.maxTokensForceComplex} tokens${profileSuffix}`,
        tierConfigs,
        modelPricing,
        estimatedTokens,
        maxOutputTokens,
        routingProfile,
        agenticScoreValue,
      );
      return { ...decision, tierConfigs, profile };
    }

    // Structured output detection
    const hasStructuredOutput = systemPrompt ? /json|structured|schema/i.test(systemPrompt) : false;

    let tier: Tier;
    let confidence: number;
    const method: "rules" | "llm" = "rules";
    let reasoning = `score=${ruleResult.score.toFixed(2)} | ${ruleResult.signals.join(", ")}`;

    if (ruleResult.tier !== null) {
      tier = ruleResult.tier;
      confidence = ruleResult.confidence;
    } else {
      // Ambiguous — default to configurable tier (no external API call)
      tier = config.overrides.ambiguousDefaultTier;
      confidence = 0.5;
      reasoning += ` | ambiguous -> default: ${tier}`;
    }

    // Apply structured output minimum tier
    if (hasStructuredOutput) {
      const tierRank: Record<Tier, number> = { SIMPLE: 0, MEDIUM: 1, COMPLEX: 2, REASONING: 3 };
      const minTier = config.overrides.structuredOutputMinTier;
      if (tierRank[tier] < tierRank[minTier]) {
        reasoning += ` | upgraded to ${minTier} (structured output)`;
        tier = minTier;
      }
    }

    // Add routing profile suffix to reasoning
    reasoning += profileSuffix;

    const decision = selectModel(
      tier,
      confidence,
      method,
      reasoning,
      tierConfigs,
      modelPricing,
      estimatedTokens,
      maxOutputTokens,
      routingProfile,
      agenticScoreValue,
    );
    return { ...decision, tierConfigs, profile };
  }
}

// --- Strategy Registry ---

const registry = new Map<string, RouterStrategy>();
registry.set("rules", new RulesStrategy());

export function getStrategy(name: string): RouterStrategy {
  const strategy = registry.get(name);
  if (!strategy) {
    throw new Error(`Unknown routing strategy: ${name}`);
  }
  return strategy;
}

export function registerStrategy(strategy: RouterStrategy): void {
  registry.set(strategy.name, strategy);
}
