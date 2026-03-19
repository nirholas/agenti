/**
 * Unified message formatting and normalization.
 */

import { formatForPlatform, strip } from '../markdown';
import type { IncomingMessage, MessageAttachment, OutgoingMessage, ThreadContext } from '../types';

function normalizeThread(
  thread: ThreadContext | undefined,
  replyToMessageId?: string
): ThreadContext | undefined {
  if (thread) return thread;
  if (replyToMessageId) {
    return { replyToMessageId };
  }
  return undefined;
}

function normalizeAttachments(
  attachments?: MessageAttachment[]
): MessageAttachment[] | undefined {
  if (!attachments || attachments.length === 0) return undefined;
  const cleaned = attachments.filter((attachment) => Boolean(attachment));
  return cleaned.length > 0 ? cleaned : undefined;
}

export function normalizeIncomingMessage(message: IncomingMessage): IncomingMessage {
  const text = typeof message.text === 'string' ? message.text.trim() : '';
  const thread = normalizeThread(message.thread, message.replyToMessageId);
  const attachments = normalizeAttachments(message.attachments);

  return {
    ...message,
    text,
    thread,
    attachments,
  };
}

export function normalizeOutgoingMessage(message: OutgoingMessage): OutgoingMessage {
  const text = typeof message.text === 'string' ? message.text : '';
  const thread = normalizeThread(message.thread);
  const attachments = normalizeAttachments(message.attachments);

  return {
    ...message,
    text,
    thread,
    attachments,
  };
}

export function formatOutgoingMessage(message: OutgoingMessage): OutgoingMessage {
  const normalized = normalizeOutgoingMessage(message);
  const mode = normalized.parseMode ?? 'Markdown';
  const platform = normalized.platform;

  if (mode === 'HTML') {
    return normalized;
  }

  let text = normalized.text;

  switch (platform) {
    case 'telegram':
      text = formatForPlatform(text, 'telegram');
      return { ...normalized, text, parseMode: 'MarkdownV2' };
    case 'slack':
      text = formatForPlatform(text, 'slack');
      return { ...normalized, text };
    case 'whatsapp':
      text = formatForPlatform(text, 'whatsapp');
      return { ...normalized, text };
    case 'discord':
      text = formatForPlatform(text, 'discord');
      return { ...normalized, text };
    case 'webchat':
      text = strip(text);
      return { ...normalized, text };
    case 'plain':
      text = strip(text);
      return { ...normalized, text };
    default:
      return normalized;
  }
}
