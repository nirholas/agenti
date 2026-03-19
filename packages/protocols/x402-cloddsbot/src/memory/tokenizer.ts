/**
 * Tokenizer utilities (Anthropic + OpenAI)
 */

import { countTokens as countClaudeTokens } from '@anthropic-ai/tokenizer';
import { encoding_for_model, get_encoding } from 'tiktoken';

function normalizeModel(model?: string): string {
  if (!model) return '';
  return model.replace(/^anthropic\//, '').trim().toLowerCase();
}

function isAnthropicModel(model?: string): boolean {
  const m = normalizeModel(model);
  return m.startsWith('claude');
}

function isOpenAIModel(model?: string): boolean {
  const m = normalizeModel(model);
  return m.startsWith('gpt-') || m.startsWith('o1') || m.startsWith('o3');
}

function getDefaultModel(): string | undefined {
  return (
    process.env.CLODDS_TOKENIZER_MODEL ||
    process.env.CLODDS_MODEL ||
    process.env.ANTHROPIC_MODEL ||
    process.env.OPENAI_MODEL ||
    undefined
  );
}

export function countTokensAccurate(text: string, model?: string): number {
  if (!text) return 0;

  const resolvedModel = model || getDefaultModel();

  // Prefer Anthropic tokenizer for Claude-family models.
  if (isAnthropicModel(resolvedModel)) {
    return countClaudeTokens(text);
  }

  // Use tiktoken for OpenAI-like models.
  if (resolvedModel && isOpenAIModel(resolvedModel)) {
    try {
      const enc = encoding_for_model(resolvedModel as Parameters<typeof encoding_for_model>[0]);
      const tokens = enc.encode(text).length;
      enc.free();
      return tokens;
    } catch {
      // fall through to base encoding
    }
  }

  // Fallback: tiktoken cl100k_base
  try {
    const enc = get_encoding('cl100k_base');
    const tokens = enc.encode(text).length;
    enc.free();
    return tokens;
  } catch {
    // Last resort: rough estimate
    return Math.ceil(text.length / 4);
  }
}
