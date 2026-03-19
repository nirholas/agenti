#!/usr/bin/env node

// Suppress noisy libxmtp warnings (sqlcipherCodecAttach, etc.) on both stdout and stderr
const _origStderrWrite = process.stderr.write.bind(process.stderr);
process.stderr.write = function (chunk: any, ...args: any[]): boolean {
  if (typeof chunk === 'string' && chunk.includes('sqlcipherCodecAttach')) return true;
  if (Buffer.isBuffer(chunk) && chunk.toString().includes('sqlcipherCodecAttach')) return true;
  return (_origStderrWrite as any)(chunk, ...args);
};
const _origStdoutWrite = process.stdout.write.bind(process.stdout);
process.stdout.write = function (chunk: any, ...args: any[]): boolean {
  if (typeof chunk === 'string' && chunk.includes('sqlcipherCodecAttach')) return true;
  if (Buffer.isBuffer(chunk) && chunk.toString().includes('sqlcipherCodecAttach')) return true;
  return (_origStdoutWrite as any)(chunk, ...args);
};

import { Command } from 'commander';
import { registerInitCommand } from './init.js';
import { registerUpCommand } from './up.js';
import { registerSkillsCommand } from './skills-cmd.js';
import { registerFindCommand } from './find.js';
import { registerStatusCommand } from './status.js';
import { registerCallCommand } from './call.js';
import { registerMessageCommand } from './message.js';
import { registerIdentityCommand } from './identity.js';
import { registerRegisterCommand } from './register.js';
import { registerSearchCommand } from './search.js';
import { registerServeCommand } from './serve.js';
import { registerFriendsCommand } from './friends.js';
import { registerRoomCommand } from './room.js';
import { registerReputationCommand } from './reputation.js';
import { registerPaymentsCommand } from './payments.js';
import { registerConfigCommand } from './config-cmd.js';
import { registerHooksCommand } from './hooks-cmd.js';

const program = new Command();

program
  .name('anet')
  .description('anet — Agent Economy Toolkit')
  .version('0.2.0');

// Daily commands (porcelain) — appear first in help
registerInitCommand(program);
registerUpCommand(program);
registerSkillsCommand(program);
registerFindCommand(program);
registerCallCommand(program);
registerMessageCommand(program);
registerStatusCommand(program);

// Advanced commands (plumbing)
registerIdentityCommand(program);
registerRegisterCommand(program);
registerSearchCommand(program);
registerServeCommand(program);
registerFriendsCommand(program);
registerRoomCommand(program);
registerReputationCommand(program);
registerPaymentsCommand(program);
registerConfigCommand(program);
registerHooksCommand(program);

program.parse();
