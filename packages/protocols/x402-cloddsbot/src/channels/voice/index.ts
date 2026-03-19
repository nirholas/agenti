/**
 * Voice Channel - Real-time voice call integration
 * Supports voice-to-text and text-to-speech interactions
 *
 * Uses Twilio or similar for voice calls
 * Requires: Account SID, auth token, and phone number
 */

import { logger } from '../../utils/logger';
import type { ChannelCallbacks, ChannelAdapter } from '../index';
import type { OutgoingMessage, IncomingMessage } from '../../types';
import type { PairingService } from '../../pairing/index';
import { createServer, IncomingMessage as HttpRequest, ServerResponse } from 'http';

export interface VoiceConfig {
  enabled: boolean;
  /** Voice provider: 'twilio' | 'vonage' */
  provider: 'twilio' | 'vonage';
  /** Twilio Account SID */
  accountSid?: string;
  /** Twilio Auth Token */
  authToken?: string;
  /** Phone number for the bot */
  phoneNumber: string;
  /** Webhook port for incoming calls */
  webhookPort?: number;
  /** DM policy: 'open', 'allowlist', 'pairing', 'disabled' */
  dmPolicy?: 'open' | 'allowlist' | 'pairing' | 'disabled';
  /** Static allowlist of phone numbers */
  allowFrom?: string[];
  /** TTS voice name */
  voice?: string;
  /** Speech recognition language */
  language?: string;
}

interface ActiveCall {
  callSid: string;
  from: string;
  to: string;
  status: string;
  transcript: string[];
}

export async function createVoiceChannel(
  config: VoiceConfig,
  callbacks: ChannelCallbacks,
  pairing?: PairingService
): Promise<ChannelAdapter> {
  const staticAllowlist = new Set<string>(
    (config.allowFrom || []).map((p) => normalizePhone(p))
  );
  const activeCalls = new Map<string, ActiveCall>();
  let server: ReturnType<typeof createServer> | null = null;

  function normalizePhone(phone: string): string {
    return phone.replace(/[^\d+]/g, '');
  }

  function isUserAllowed(phone: string): boolean {
    const normalized = normalizePhone(phone);
    if (staticAllowlist.has(normalized)) return true;
    if (pairing?.isPaired('voice', normalized)) return true;
    return false;
  }

  function generateTwiML(text: string, gather: boolean = false): string {
    const voice = config.voice || 'alice';
    const language = config.language || 'en-US';

    if (gather) {
      return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" timeout="3" speechTimeout="auto" language="${language}" action="/speech">
    <Say voice="${voice}">${escapeXml(text)}</Say>
  </Gather>
  <Say voice="${voice}">I didn't hear anything. Goodbye.</Say>
</Response>`;
    }

    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="${voice}">${escapeXml(text)}</Say>
</Response>`;
  }

  function escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  async function handleIncomingCall(params: Record<string, string>, res: ServerResponse): Promise<void> {
    const callSid = params.CallSid;
    const from = params.From;

    logger.info({ callSid, from }, 'Incoming voice call');

    // DM Policy enforcement
    switch (config.dmPolicy) {
      case 'allowlist':
        if (!isUserAllowed(from)) {
          logger.info({ from }, 'Rejecting voice call from non-allowlisted number');
          res.writeHead(200, { 'Content-Type': 'text/xml' });
          res.end(generateTwiML('Sorry, you are not authorized to use this service. Goodbye.'));
          return;
        }
        break;

      case 'pairing':
        if (!isUserAllowed(from)) {
          if (pairing) {
            const code = await pairing.createPairingRequest('voice', normalizePhone(from));
            if (code) {
              logger.info({ from, code }, 'Generated voice pairing code');
              res.writeHead(200, { 'Content-Type': 'text/xml' });
              res.end(
                generateTwiML(
                  `Pairing required. Your pairing code is: ${code.split('').join(' ')}. ` +
                    `Please run clodds pairing approve voice ${code} on your computer. Goodbye.`
                )
              );
            } else {
              res.writeHead(200, { 'Content-Type': 'text/xml' });
              res.end(generateTwiML('Too many pending pairing requests. Please try again later. Goodbye.'));
            }
          }
          return;
        }
        break;

      case 'disabled':
        res.writeHead(200, { 'Content-Type': 'text/xml' });
        res.end(generateTwiML('Voice calls are currently disabled. Goodbye.'));
        return;
    }

    // Store active call
    activeCalls.set(callSid, {
      callSid,
      from,
      to: params.To,
      status: 'in-progress',
      transcript: [],
    });

    // Greet and gather speech
    res.writeHead(200, { 'Content-Type': 'text/xml' });
    res.end(generateTwiML('Hello! How can I help you with prediction markets today?', true));
  }

  async function handleSpeech(params: Record<string, string>, res: ServerResponse): Promise<void> {
    const callSid = params.CallSid;
    const speechResult = params.SpeechResult;
    const from = params.From;

    if (!speechResult) {
      res.writeHead(200, { 'Content-Type': 'text/xml' });
      res.end(generateTwiML('I didn\'t catch that. Could you please repeat?', true));
      return;
    }

    const call = activeCalls.get(callSid);
    if (call) {
      call.transcript.push(speechResult);
    }

    logger.info({ callSid, from, speech: speechResult }, 'Received speech input');

    // Create incoming message for processing
    const incomingMessage: IncomingMessage = {
      id: callSid,
      platform: 'voice',
      userId: normalizePhone(from),
      chatId: callSid,
      chatType: 'dm',
      text: speechResult,
      timestamp: new Date(),
    };

    // Store response handler for this call
    const responsePromise = new Promise<string>((resolve) => {
      const timeout = setTimeout(() => resolve('I\'m sorry, I couldn\'t process that. Please try again.'), 30000);

      // This will be resolved when sendMessage is called
      (activeCalls.get(callSid) as any)._resolve = (text: string) => {
        clearTimeout(timeout);
        resolve(text);
      };
    });

    await callbacks.onMessage(incomingMessage);

    const responseText = await responsePromise;

    res.writeHead(200, { 'Content-Type': 'text/xml' });
    res.end(generateTwiML(responseText, true));
  }

  function parseBody(req: HttpRequest): Promise<Record<string, string>> {
    return new Promise((resolve) => {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        const params: Record<string, string> = {};
        body.split('&').forEach((pair) => {
          const [key, value] = pair.split('=');
          params[decodeURIComponent(key)] = decodeURIComponent(value || '');
        });
        resolve(params);
      });
    });
  }

  return {
    platform: 'voice',

    async start() {
      const port = config.webhookPort || 3001;
      logger.info({ port }, 'Starting Voice webhook server');

      // WARNING: Twilio webhook requests should be validated using the X-Twilio-Signature
      // header and your auth token. Without validation, attackers can forge requests.
      // Validate at the reverse proxy/gateway layer, or add validation here with:
      //   const twilio = require('twilio');
      //   twilio.validateRequest(config.authToken, signature, url, params)
      server = createServer(async (req, res) => {
        if (req.method !== 'POST') {
          res.writeHead(405);
          res.end();
          return;
        }

        const params = await parseBody(req);
        const url = req.url || '/';

        try {
          if (url === '/incoming' || url === '/voice') {
            await handleIncomingCall(params, res);
          } else if (url === '/speech') {
            await handleSpeech(params, res);
          } else if (url === '/status') {
            // Call status callback - clean up completed calls
            const callSid = params.CallSid;
            const callStatus = params.CallStatus;
            if (callSid && (callStatus === 'completed' || callStatus === 'failed' || callStatus === 'busy' || callStatus === 'no-answer' || callStatus === 'canceled')) {
              activeCalls.delete(callSid);
              logger.debug({ callSid, callStatus }, 'Voice call ended, cleaned up');
            }
            res.writeHead(200);
            res.end();
          } else {
            res.writeHead(404);
            res.end();
          }
        } catch (error) {
          logger.error({ error }, 'Voice webhook error');
          res.writeHead(500);
          res.end();
        }
      });

      server.listen(port);
      logger.info({ port }, 'Voice channel started');
    },

    async stop() {
      logger.info('Stopping Voice channel');
      if (server) {
        server.close();
        server = null;
      }
      activeCalls.clear();
    },

    async sendMessage(message: OutgoingMessage): Promise<string | null> {
      // For voice, sending a message means speaking it in the active call
      const call = activeCalls.get(message.chatId);
      if (call && (call as any)._resolve) {
        (call as any)._resolve(message.text);
        return message.chatId;
      }

      logger.warn({ chatId: message.chatId }, 'No active voice call to send message to');
      return null;
    },
  };
}
