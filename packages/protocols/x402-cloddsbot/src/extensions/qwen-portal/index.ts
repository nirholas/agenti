/**
 * Qwen Portal Auth Extension
 * Provides authentication for Alibaba Qwen API
 *
 * Supports: DashScope API (China) and International API
 */

import * as crypto from 'crypto';
import { logger } from '../../utils/logger';

export interface QwenPortalConfig {
  enabled: boolean;
  /** API key for DashScope */
  apiKey: string;
  /** Region: 'cn' | 'intl' */
  region?: 'cn' | 'intl';
  /** Base URL override */
  baseUrl?: string;
}

export interface QwenPortalExtension {
  /** Generate text completions */
  generateText(prompt: string, options?: QwenOptions): Promise<string>;
  /** Stream text generation */
  streamGenerateText(prompt: string, options?: QwenOptions): AsyncGenerator<string>;
  /** Generate chat completions */
  chat(messages: QwenMessage[], options?: QwenOptions): Promise<string>;
  /** Get embeddings */
  getEmbeddings(texts: string[]): Promise<number[][]>;
  /** Generate images */
  generateImage(prompt: string, options?: ImageOptions): Promise<string[]>;
}

export interface QwenMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface QwenOptions {
  model?: string;
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  repetitionPenalty?: number;
  stop?: string[];
  seed?: number;
}

export interface ImageOptions {
  model?: string;
  n?: number;
  size?: '1024*1024' | '720*1280' | '1280*720';
  style?: string;
}

export async function createQwenPortalExtension(
  config: QwenPortalConfig
): Promise<QwenPortalExtension> {
  const region = config.region || 'intl';
  const baseUrl =
    config.baseUrl ||
    (region === 'cn'
      ? 'https://dashscope.aliyuncs.com/api/v1'
      : 'https://dashscope-intl.aliyuncs.com/api/v1');

  async function makeRequest<T>(
    endpoint: string,
    body: unknown,
    stream: boolean = false
  ): Promise<T | Response> {
    const url = `${baseUrl}${endpoint}`;

    const headers: Record<string, string> = {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    };

    if (stream) {
      headers['X-DashScope-SSE'] = 'enable';
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.text();
      logger.error({ status: response.status, error }, 'Qwen API error');
      throw new Error(`Qwen API error: ${response.status} - ${error}`);
    }

    if (stream) {
      return response as unknown as T;
    }

    return response.json() as Promise<T>;
  }

  return {
    async generateText(prompt: string, options?: QwenOptions): Promise<string> {
      const model = options?.model || 'qwen-turbo';

      const result = await makeRequest<{
        output: { text: string };
        usage: { input_tokens: number; output_tokens: number };
      }>('/services/aigc/text-generation/generation', {
        model,
        input: {
          prompt,
        },
        parameters: {
          max_tokens: options?.maxTokens,
          temperature: options?.temperature,
          top_p: options?.topP,
          top_k: options?.topK,
          repetition_penalty: options?.repetitionPenalty,
          stop: options?.stop,
          seed: options?.seed,
        },
      });

      return (result as { output: { text: string } }).output.text;
    },

    async *streamGenerateText(prompt: string, options?: QwenOptions): AsyncGenerator<string> {
      const model = options?.model || 'qwen-turbo';

      const response = (await makeRequest<Response>(
        '/services/aigc/text-generation/generation',
        {
          model,
          input: {
            prompt,
          },
          parameters: {
            max_tokens: options?.maxTokens,
            temperature: options?.temperature,
            top_p: options?.topP,
            incremental_output: true,
          },
        },
        true
      )) as Response;

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n').filter((l) => l.startsWith('data:'));

        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(5));
            const text = data.output?.text;
            if (text) yield text;
          } catch {
            // Ignore parse errors
          }
        }
      }
    },

    async chat(messages: QwenMessage[], options?: QwenOptions): Promise<string> {
      const model = options?.model || 'qwen-turbo';

      const result = await makeRequest<{
        output: { choices: Array<{ message: { content: string } }> };
      }>('/services/aigc/text-generation/generation', {
        model,
        input: {
          messages,
        },
        parameters: {
          max_tokens: options?.maxTokens,
          temperature: options?.temperature,
          top_p: options?.topP,
          top_k: options?.topK,
          repetition_penalty: options?.repetitionPenalty,
          stop: options?.stop,
          seed: options?.seed,
        },
      });

      return (result as { output: { choices: Array<{ message: { content: string } }> } }).output.choices[0]?.message
        ?.content || '';
    },

    async getEmbeddings(texts: string[]): Promise<number[][]> {
      const result = await makeRequest<{
        output: { embeddings: Array<{ embedding: number[] }> };
      }>('/services/embeddings/text-embedding/text-embedding', {
        model: 'text-embedding-v1',
        input: {
          texts,
        },
      });

      return (result as { output: { embeddings: Array<{ embedding: number[] }> } }).output.embeddings.map(
        (e) => e.embedding
      );
    },

    async generateImage(prompt: string, options?: ImageOptions): Promise<string[]> {
      const model = options?.model || 'wanx-v1';

      // Image generation is async, need to poll for results
      const taskResult = await makeRequest<{
        output: { task_id: string; task_status: string };
      }>('/services/aigc/text2image/image-synthesis', {
        model,
        input: {
          prompt,
        },
        parameters: {
          n: options?.n || 1,
          size: options?.size || '1024*1024',
          style: options?.style,
        },
      });

      const taskId = (taskResult as { output: { task_id: string } }).output.task_id;

      // Poll for completion
      let attempts = 0;
      while (attempts < 60) {
        await new Promise((resolve) => setTimeout(resolve, 2000));

        const statusResult = await makeRequest<{
          output: {
            task_status: string;
            results?: Array<{ url: string }>;
          };
        }>(`/tasks/${taskId}`, {});

        const output = (statusResult as { output: { task_status: string; results?: Array<{ url: string }> } }).output;

        if (output.task_status === 'SUCCEEDED') {
          return output.results?.map((r) => r.url) || [];
        }

        if (output.task_status === 'FAILED') {
          throw new Error('Image generation failed');
        }

        attempts++;
      }

      throw new Error('Image generation timed out');
    },
  };
}
