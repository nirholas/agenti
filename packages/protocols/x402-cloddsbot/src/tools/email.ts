/**
 * Email Tool - send email via SMTP (nodemailer) with sendmail fallback
 */

import { spawnSync } from 'child_process';
import nodemailer from 'nodemailer';
import { logger } from '../utils/logger';

export interface EmailAddress {
  name?: string;
  email: string;
}

export interface SendEmailOptions {
  from: EmailAddress;
  to: Array<EmailAddress | string>;
  cc?: Array<EmailAddress | string>;
  bcc?: Array<EmailAddress | string>;
  subject: string;
  text: string;
  replyTo?: EmailAddress | string;
  dryRun?: boolean;
}

export interface EmailTool {
  isAvailable(): boolean;
  send(options: SendEmailOptions): Promise<{ ok: boolean; message: string }>;
}

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
}

function formatAddress(input: EmailAddress | string): string {
  if (typeof input === 'string') return input;
  const name = input.name?.trim();
  if (!name) return input.email;
  const safeName = name.replace(/"/g, '\\"');
  return `"${safeName}" <${input.email}>`;
}

function toAddressList(list?: Array<EmailAddress | string>): string[] | undefined {
  if (!list || list.length === 0) return undefined;
  return list.map(formatAddress);
}

function buildSendmailMessage(opts: SendEmailOptions): string {
  const headers: string[] = [];
  headers.push(`From: ${formatAddress(opts.from)}`);
  headers.push(`To: ${opts.to.map(formatAddress).join(', ')}`);

  const cc = toAddressList(opts.cc);
  if (cc) headers.push(`Cc: ${cc.join(', ')}`);

  const bcc = toAddressList(opts.bcc);
  if (bcc) headers.push(`Bcc: ${bcc.join(', ')}`);

  const replyTo = opts.replyTo ? formatAddress(opts.replyTo) : null;
  if (replyTo) headers.push(`Reply-To: ${replyTo}`);

  headers.push(`Subject: ${opts.subject}`);
  headers.push('MIME-Version: 1.0');
  headers.push('Content-Type: text/plain; charset=utf-8');
  headers.push('Content-Transfer-Encoding: 8bit');

  return `${headers.join('\n')}\n\n${opts.text}\n`;
}

function hasSendmail(): boolean {
  const res = spawnSync('sendmail', ['-V'], { stdio: 'ignore' });
  const errCode = (res.error as NodeJS.ErrnoException | undefined)?.code;
  return res.status === 0 || errCode !== 'ENOENT';
}

function loadSmtpConfig(): SmtpConfig | null {
  const host = process.env.SMTP_HOST?.trim();
  if (!host) return null;

  const port = parseInt(process.env.SMTP_PORT || '', 10) || 587;
  const secureEnv = (process.env.SMTP_SECURE || '').toLowerCase();
  const secure = secureEnv === 'true' || secureEnv === '1' || port === 465;

  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS;

  return { host, port, secure, user: user || undefined, pass: pass || undefined };
}

async function sendViaSmtp(opts: SendEmailOptions, smtp: SmtpConfig): Promise<void> {
  const transport = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: smtp.user && smtp.pass ? { user: smtp.user, pass: smtp.pass } : undefined,
  });

  await transport.verify();

  await transport.sendMail({
    from: formatAddress(opts.from),
    to: toAddressList(opts.to)?.join(', '),
    cc: toAddressList(opts.cc)?.join(', '),
    bcc: toAddressList(opts.bcc)?.join(', '),
    replyTo: opts.replyTo ? formatAddress(opts.replyTo) : undefined,
    subject: opts.subject,
    text: opts.text,
  });
}

function sendViaSendmail(opts: SendEmailOptions): void {
  const message = buildSendmailMessage(opts);

  const result = spawnSync('sendmail', ['-t', '-i'], {
    input: message,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  if (result.status !== 0) {
    const stderr = result.stderr?.toString() || 'Unknown sendmail error';
    throw new Error(stderr);
  }
}

export function createEmailTool(): EmailTool {
  const smtp = loadSmtpConfig();

  return {
    isAvailable() {
      return Boolean(smtp) || hasSendmail();
    },

    async send(options: SendEmailOptions) {
      if (!options.to || options.to.length === 0) {
        throw new Error('Email requires at least one recipient');
      }

      if (options.dryRun) {
        logger.info({ to: options.to.length, subject: options.subject }, 'Email dry run');
        return { ok: true, message: 'dry-run' };
      }

      if (smtp) {
        try {
          await sendViaSmtp(options, smtp);
          logger.info({ subject: options.subject, via: 'smtp' }, 'Email sent');
          return { ok: true, message: 'sent:smtp' };
        } catch (error) {
          logger.warn({ error }, 'SMTP send failed; falling back to sendmail');
        }
      }

      if (!hasSendmail()) {
        throw new Error('No email transport available. Configure SMTP_* or install sendmail.');
      }

      try {
        sendViaSendmail(options);
        logger.info({ subject: options.subject, via: 'sendmail' }, 'Email sent');
        return { ok: true, message: 'sent:sendmail' };
      } catch (error) {
        logger.error({ error }, 'Email send failed');
        throw error;
      }
    },
  };
}
