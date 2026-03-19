/**
 * SMS Tool - send SMS via Twilio REST API
 */

import { logger } from '../utils/logger';

export interface SmsSendOptions {
  to: string;
  body: string;
  from?: string;
  dryRun?: boolean;
}

export interface SmsTool {
  isAvailable(): boolean;
  send(options: SmsSendOptions): Promise<{ ok: boolean; sid?: string; message: string }>;
}

interface TwilioConfig {
  accountSid: string;
  authToken: string;
  from: string;
}

function loadTwilioConfig(): TwilioConfig | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM?.trim();

  if (!accountSid || !authToken || !from) return null;
  return { accountSid, authToken, from };
}

function basicAuth(accountSid: string, authToken: string): string {
  const token = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
  return `Basic ${token}`;
}

export function createSmsTool(): SmsTool {
  const twilio = loadTwilioConfig();

  return {
    isAvailable() {
      return Boolean(twilio);
    },

    async send(options: SmsSendOptions) {
      if (!twilio) {
        throw new Error('SMS not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM.');
      }

      const from = options.from || twilio.from;
      if (!options.to?.trim()) {
        throw new Error('SMS requires a destination number');
      }
      if (!options.body?.trim()) {
        throw new Error('SMS requires a message body');
      }

      if (options.dryRun) {
        logger.info({ to: options.to, from }, 'SMS dry run');
        return { ok: true, message: 'dry-run' };
      }

      const url = `https://api.twilio.com/2010-04-01/Accounts/${twilio.accountSid}/Messages.json`;
      const params = new URLSearchParams({
        To: options.to,
        From: from,
        Body: options.body,
      });

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: basicAuth(twilio.accountSid, twilio.authToken),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params,
      });

      const data = (await res.json()) as { sid?: string; message?: string; code?: number };

      if (!res.ok) {
        const detail = data?.message || `HTTP ${res.status}`;
        logger.error({ status: res.status, detail }, 'SMS send failed');
        throw new Error(`Twilio SMS error: ${detail}`);
      }

      logger.info({ to: options.to, sid: data.sid }, 'SMS sent');
      return { ok: true, sid: data.sid, message: 'sent' };
    },
  };
}
