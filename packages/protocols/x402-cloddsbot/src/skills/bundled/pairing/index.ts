/**
 * Pairing CLI Skill
 *
 * Commands:
 * /pair - Request pairing (generates code)
 * /pair-code <code> - Enter pairing code
 * /unpair - Remove your pairing
 * /pairing list - List pending requests
 * /pairing approve <code> - Approve pairing request
 * /pairing reject <code> - Reject pairing request
 * /pairing users - List paired users
 * /pairing remove <user> - Remove user pairing
 * /trust <user> owner - Grant owner trust
 * /trust <user> paired - Standard trust
 * /trust list - List trust levels
 */

import {
  createPairingService,
  PairingService,
  TrustLevel,
} from '../../../pairing/index';
import { logger } from '../../../utils/logger';

let service: PairingService | null = null;

async function getService(): Promise<PairingService | null> {
  if (!service) {
    try {
      const { createDatabase } = await import('../../../db/index');
      const db = createDatabase();
      service = createPairingService(db);
    } catch { /* leave null if dependencies missing */ }
  }
  return service;
}

async function handlePair(channel: string, userId: string, username?: string): Promise<string> {
  const svc = await getService();
  if (!svc) return 'Pairing service not initialized. Database required.';

  const code = await svc.createPairingRequest(channel, userId, username);
  if (!code) {
    if (svc.isPaired(channel, userId)) {
      return 'You are already paired.';
    }
    return 'Could not create pairing request. Maximum pending requests may have been reached.';
  }

  return `**Pairing Request Created**\n\n` +
    `Your pairing code: \`${code}\`\n\n` +
    `Share this code with an admin to get approved.\n` +
    `Code expires in 1 hour.`;
}

async function handlePairCode(code: string): Promise<string> {
  const svc = await getService();
  if (!svc) return 'Pairing service not initialized.';
  if (!code) return 'Usage: /pair-code <code>';

  const request = await svc.validateCode(code);
  if (!request) {
    return 'Invalid or expired pairing code.';
  }

  return `Pairing successful! User ${request.username || request.userId} has been paired on channel ${request.channel}.`;
}

async function handleUnpair(channel: string, userId: string): Promise<string> {
  const svc = await getService();
  if (!svc) return 'Pairing service not initialized.';

  if (!svc.isPaired(channel, userId)) {
    return 'You are not currently paired.';
  }

  svc.removePairedUser(channel, userId);
  return 'Your pairing has been removed.';
}

async function handleList(channel: string): Promise<string> {
  const svc = await getService();
  if (!svc) return 'Pairing service not initialized.';

  const pending = svc.listPendingRequests(channel);
  if (pending.length === 0) {
    return 'No pending pairing requests.';
  }

  let output = `**Pending Pairing Requests** (${pending.length})\n\n`;
  for (const req of pending) {
    output += `Code: \`${req.code}\`\n`;
    output += `  User: ${req.username || req.userId}\n`;
    output += `  Requested: ${req.createdAt.toLocaleString()}\n`;
    output += `  Expires: ${req.expiresAt.toLocaleString()}\n\n`;
  }
  return output;
}

async function handleApprove(channel: string, code: string): Promise<string> {
  const svc = await getService();
  if (!svc) return 'Pairing service not initialized.';
  if (!code) return 'Usage: /pairing approve <code>';

  const success = await svc.approveRequest(channel, code);
  if (!success) {
    return `Could not approve code "${code}". It may be invalid, expired, or for a different channel.`;
  }

  return `Pairing request \`${code}\` approved.`;
}

async function handleReject(channel: string, code: string): Promise<string> {
  const svc = await getService();
  if (!svc) return 'Pairing service not initialized.';
  if (!code) return 'Usage: /pairing reject <code>';

  const success = await svc.rejectRequest(channel, code);
  if (!success) {
    return `Could not reject code "${code}". It may be invalid or expired.`;
  }

  return `Pairing request \`${code}\` rejected.`;
}

async function handleUsers(channel: string): Promise<string> {
  const svc = await getService();
  if (!svc) return 'Pairing service not initialized.';

  const users = svc.listPairedUsers(channel);
  if (users.length === 0) {
    return 'No paired users on this channel.';
  }

  let output = `**Paired Users** (${users.length})\n\n`;
  for (const user of users) {
    const trust = user.isOwner ? 'owner' : 'paired';
    output += `**${user.username || user.userId}**\n`;
    output += `  Trust: ${trust}\n`;
    output += `  Paired: ${user.pairedAt.toLocaleString()}\n`;
    output += `  Method: ${user.pairedBy}\n\n`;
  }
  return output;
}

async function handleRemove(channel: string, userId: string): Promise<string> {
  const svc = await getService();
  if (!svc) return 'Pairing service not initialized.';
  if (!userId) return 'Usage: /pairing remove <user>';

  svc.removePairedUser(channel, userId);
  return `User ${userId} has been unpaired.`;
}

async function handleTrust(channel: string, userId: string, level: string): Promise<string> {
  const svc = await getService();
  if (!svc) return 'Pairing service not initialized.';

  if (level === 'owner') {
    svc.setOwner(channel, userId);
    return `User ${userId} granted owner trust.`;
  } else if (level === 'paired') {
    svc.removeOwner(channel, userId);
    return `User ${userId} set to standard (paired) trust.`;
  }

  return 'Usage: /trust <user> owner|paired';
}

async function handleTrustList(channel: string): Promise<string> {
  const svc = await getService();
  if (!svc) return 'Pairing service not initialized.';

  const owners = svc.listOwners(channel);
  const users = svc.listPairedUsers(channel);

  let output = '**Trust Levels**\n\n';
  output += `**Owners** (${owners.length}):\n`;
  for (const owner of owners) {
    output += `  - ${owner.username || owner.userId}\n`;
  }

  output += `\n**Paired** (${users.filter(u => !u.isOwner).length}):\n`;
  for (const user of users.filter(u => !u.isOwner)) {
    output += `  - ${user.username || user.userId}\n`;
  }

  return output;
}

export async function execute(args: string): Promise<string> {
  const parts = args.trim().split(/\s+/);
  const command = parts[0]?.toLowerCase() || 'help';
  const rest = parts.slice(1);

  // Default channel/userId for CLI context
  const channel = 'cli';
  const userId = 'cli-user';

  switch (command) {
    case 'pair':
      return handlePair(channel, userId);

    case 'pair-code':
      return handlePairCode(rest[0]);

    case 'unpair':
      return handleUnpair(channel, userId);

    case 'list':
      return handleList(channel);

    case 'approve':
      return handleApprove(channel, rest[0]);

    case 'reject':
      return handleReject(channel, rest[0]);

    case 'users':
      return handleUsers(channel);

    case 'remove':
      return handleRemove(channel, rest[0]);

    case 'trust':
      if (rest[0] === 'list') return handleTrustList(channel);
      if (rest.length < 2) return 'Usage: /trust <user> owner|paired';
      return handleTrust(channel, rest[0], rest[1]);

    case 'cleanup': {
      const cleanupSvc = await getService();
      if (cleanupSvc) {
        cleanupSvc.cleanupExpired();
        return 'Expired pairing requests cleaned up.';
      }
      return 'Pairing service not initialized.';
    }

    case 'help':
    default:
      return `**Pairing Commands**

**User Pairing:**
  /pairing pair                        - Request pairing (generates code)
  /pairing pair-code <code>            - Enter pairing code
  /pairing unpair                      - Remove your pairing

**Admin Commands:**
  /pairing list                        - List pending requests
  /pairing approve <code>              - Approve pairing request
  /pairing reject <code>               - Reject pairing request
  /pairing users                       - List paired users
  /pairing remove <user>               - Remove user pairing
  /pairing cleanup                     - Clean up expired requests

**Trust Management:**
  /pairing trust <user> owner          - Grant owner trust
  /pairing trust <user> paired         - Standard trust
  /pairing trust list                  - List trust levels`;
  }
}

export default {
  name: 'pairing',
  description: 'User pairing, authentication, and trust management',
  commands: ['/pairing', '/pair', '/unpair', '/trust'],
  handle: execute,
};
