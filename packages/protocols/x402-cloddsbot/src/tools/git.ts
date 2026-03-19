/**
 * Git Operations Tool - safe, non-interactive git helpers
 */

import { execFileSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';
import { logger } from '../utils/logger';
import { assertSandboxPath } from '../permissions';

export interface GitStatusResult {
  branch: string | null;
  short: string;
  porcelain: string;
  dirty: boolean;
}

export interface GitLogEntry {
  hash: string;
  author: string;
  date: string;
  subject: string;
}

export interface GitTool {
  isRepo(cwd?: string): boolean;
  status(cwd?: string): GitStatusResult;
  diff(cwd?: string, args?: string[]): string;
  log(cwd?: string, options?: { limit?: number }): GitLogEntry[];
  show(ref?: string, cwd?: string): string;
  revParse(ref?: string, cwd?: string): string;
  branch(cwd?: string): string[];
  add(paths: string[], cwd?: string): void;
  commit(message: string, cwd?: string): string;
}

function runGit(cwd: string, args: string[]): string {
  const result = execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  return result.trimEnd();
}

function safeCwd(workspaceRoot: string, cwd?: string): string {
  const target = cwd || workspaceRoot;
  assertSandboxPath(target, { root: workspaceRoot, allowSymlinks: false });
  return target;
}

export function createGitTool(workspaceRoot: string): GitTool {
  function isRepo(cwd?: string): boolean {
    const dir = safeCwd(workspaceRoot, cwd);
    return existsSync(join(dir, '.git'));
  }

  function status(cwd?: string): GitStatusResult {
    const dir = safeCwd(workspaceRoot, cwd);
    const porcelain = runGit(dir, ['status', '--porcelain']);
    const short = runGit(dir, ['status', '--short', '--branch']);

    let branch: string | null = null;
    try {
      branch = runGit(dir, ['rev-parse', '--abbrev-ref', 'HEAD']);
    } catch {
      branch = null;
    }

    const dirty = porcelain.length > 0;
    logger.debug({ branch, dirty }, 'Git status retrieved');
    return { branch, short, porcelain, dirty };
  }

  function diff(cwd?: string, args: string[] = []): string {
    const dir = safeCwd(workspaceRoot, cwd);
    const output = runGit(dir, ['diff', ...args]);
    logger.debug({ args, bytes: output.length }, 'Git diff retrieved');
    return output;
  }

  function log(cwd?: string, options: { limit?: number } = {}): GitLogEntry[] {
    const dir = safeCwd(workspaceRoot, cwd);
    const limit = Math.max(1, Math.min(200, Math.floor(options.limit || 20)));
    const format = '%H%x1f%an%x1f%ad%x1f%s';
    const raw = runGit(dir, ['log', `-n${limit}`, `--pretty=format:${format}`, '--date=iso']);
    if (!raw) return [];
    return raw.split('\n').map((line) => {
      const [hash, author, date, subject] = line.split('\x1f');
      return { hash, author, date, subject };
    });
  }

  function show(ref = 'HEAD', cwd?: string): string {
    const dir = safeCwd(workspaceRoot, cwd);
    const output = runGit(dir, ['show', '--stat', ref]);
    logger.debug({ ref }, 'Git show retrieved');
    return output;
  }

  function revParse(ref = 'HEAD', cwd?: string): string {
    const dir = safeCwd(workspaceRoot, cwd);
    return runGit(dir, ['rev-parse', ref]);
  }

  function branch(cwd?: string): string[] {
    const dir = safeCwd(workspaceRoot, cwd);
    const raw = runGit(dir, ['branch', '--list']);
    if (!raw) return [];
    return raw.split('\n').map((line) => line.replace(/^\*\s*/, '').trim()).filter(Boolean);
  }

  function add(paths: string[], cwd?: string): void {
    if (paths.length === 0) return;
    const dir = safeCwd(workspaceRoot, cwd);
    runGit(dir, ['add', '--', ...paths]);
    logger.info({ count: paths.length }, 'Git add completed');
  }

  function commit(message: string, cwd?: string): string {
    const dir = safeCwd(workspaceRoot, cwd);
    const output = runGit(dir, ['commit', '-m', message, '--no-verify']);
    logger.info('Git commit completed');
    return output;
  }

  return {
    isRepo,
    status,
    diff,
    log,
    show,
    revParse,
    branch,
    add,
    commit,
  };
}
