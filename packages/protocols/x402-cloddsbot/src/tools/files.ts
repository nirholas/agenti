/**
 * File Operations Tool - safe workspace file manipulation
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import { dirname, join, relative } from 'path';
import { logger } from '../utils/logger';
import { assertSandboxPath, resolveSandboxPath } from '../permissions';

export interface FileReadOptions {
  encoding?: BufferEncoding;
  maxBytes?: number;
}

export interface FileWriteOptions {
  encoding?: BufferEncoding;
  append?: boolean;
  createDirs?: boolean;
}

export interface FileEdit {
  find: string | RegExp;
  replace: string;
  all?: boolean;
}

export interface FileEditOptions {
  encoding?: BufferEncoding;
  createIfMissing?: boolean;
}

export interface FileListOptions {
  recursive?: boolean;
  limit?: number;
  includeDirs?: boolean;
}

export interface FileSearchOptions {
  recursive?: boolean;
  limit?: number;
  encoding?: BufferEncoding;
}

export interface FileTool {
  read(filePath: string, options?: FileReadOptions): string;
  write(filePath: string, content: string, options?: FileWriteOptions): void;
  edit(filePath: string, edits: FileEdit[], options?: FileEditOptions): { updated: boolean; content: string };
  list(dirPath?: string, options?: FileListOptions): string[];
  search(dirPath: string, needle: string | RegExp, options?: FileSearchOptions): Array<{ path: string; line: number; preview: string }>;
}

const DEFAULT_MAX_READ_BYTES = 512 * 1024;
const DEFAULT_LIST_LIMIT = 2000;
const DEFAULT_SEARCH_LIMIT = 2000;

function normalizeLimit(limit: number | undefined, fallback: number): number {
  if (!limit || !Number.isFinite(limit)) return fallback;
  return Math.max(1, Math.floor(limit));
}

export function createFileTool(workspaceRoot: string): FileTool {
  const sandbox = { root: workspaceRoot, allowSymlinks: false } as const;

  function resolveSafe(targetPath: string): string {
    const resolved = resolveSandboxPath(targetPath, sandbox);
    assertSandboxPath(resolved, sandbox);
    return resolved;
  }

  function toWorkspaceRelative(absPath: string): string {
    const rel = relative(workspaceRoot, absPath);
    return rel || '.';
  }

  return {
    read(filePath, options = {}) {
      const encoding = options.encoding || 'utf8';
      const maxBytes = options.maxBytes || DEFAULT_MAX_READ_BYTES;
      const absPath = resolveSafe(filePath);

      const stat = statSync(absPath);
      if (stat.size > maxBytes) {
        throw new Error(`Refusing to read large file (${stat.size} bytes > ${maxBytes})`);
      }

      const content = readFileSync(absPath, { encoding });
      logger.debug({ filePath: toWorkspaceRelative(absPath), bytes: stat.size }, 'File read');
      return content;
    },

    write(filePath, content, options = {}) {
      const encoding = options.encoding || 'utf8';
      const absPath = resolveSafe(filePath);

      if (options.createDirs) {
        const dir = dirname(absPath);
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true });
        }
      }

      const writeFlag = options.append ? 'a' : 'w';
      writeFileSync(absPath, content, { encoding, flag: writeFlag });
      logger.info(
        { filePath: toWorkspaceRelative(absPath), mode: options.append ? 'append' : 'write' },
        'File written'
      );
    },

    edit(filePath, edits, options = {}) {
      const encoding = options.encoding || 'utf8';
      const absPath = resolveSafe(filePath);

      let content = '';
      if (existsSync(absPath)) {
        content = readFileSync(absPath, { encoding });
      } else if (!options.createIfMissing) {
        throw new Error(`File not found: ${filePath}`);
      }

      let updated = false;
      let next = content;

      for (const edit of edits) {
        if (typeof edit.find === 'string') {
          if (edit.all) {
            const replaced = next.split(edit.find).join(edit.replace);
            if (replaced !== next) updated = true;
            next = replaced;
          } else {
            const idx = next.indexOf(edit.find);
            if (idx >= 0) {
              next = next.slice(0, idx) + edit.replace + next.slice(idx + edit.find.length);
              updated = true;
            }
          }
          continue;
        }

        const before = next;
        next = next.replace(edit.find, edit.replace);
        if (next !== before) updated = true;
      }

      if (!updated && existsSync(absPath)) {
        return { updated: false, content: next };
      }

      const dir = dirname(absPath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      writeFileSync(absPath, next, { encoding });
      logger.info({ filePath: toWorkspaceRelative(absPath), edits: edits.length }, 'File edited');
      return { updated, content: next };
    },

    list(dirPath = '.', options = {}) {
      const recursive = options.recursive ?? false;
      const includeDirs = options.includeDirs ?? false;
      const limit = normalizeLimit(options.limit, DEFAULT_LIST_LIMIT);
      const rootDir = resolveSafe(dirPath);

      const results: string[] = [];

      function walk(current: string): void {
        if (results.length >= limit) return;
        const entries = readdirSync(current, { withFileTypes: true });
        for (const entry of entries) {
          if (results.length >= limit) break;
          const abs = join(current, entry.name);
          const rel = toWorkspaceRelative(abs);
          if (entry.isDirectory()) {
            if (includeDirs) results.push(rel + '/');
            if (recursive) walk(abs);
          } else {
            results.push(rel);
          }
        }
      }

      walk(rootDir);
      return results.slice(0, limit);
    },

    search(dirPath, needle, options = {}) {
      const recursive = options.recursive ?? true;
      const limit = normalizeLimit(options.limit, DEFAULT_SEARCH_LIMIT);
      const encoding = options.encoding || 'utf8';
      const rootDir = resolveSafe(dirPath);

      const results: Array<{ path: string; line: number; preview: string }> = [];

      function matchLine(line: string): boolean {
        if (typeof needle === 'string') return line.includes(needle);
        needle.lastIndex = 0;
        return needle.test(line);
      }

      function walk(current: string): void {
        if (results.length >= limit) return;
        const entries = readdirSync(current, { withFileTypes: true });
        for (const entry of entries) {
          if (results.length >= limit) break;
          const abs = join(current, entry.name);
          if (entry.isDirectory()) {
            if (recursive) walk(abs);
            continue;
          }

          let content: string;
          try {
            const stat = statSync(abs);
            if (stat.size > DEFAULT_MAX_READ_BYTES) continue;
            content = readFileSync(abs, { encoding });
          } catch {
            continue;
          }

          const lines = content.split(/\r?\n/);
          for (let i = 0; i < lines.length; i++) {
            if (results.length >= limit) break;
            const line = lines[i];
            if (!matchLine(line)) continue;
            results.push({
              path: toWorkspaceRelative(abs),
              line: i + 1,
              preview: line.slice(0, 200),
            });
          }
        }
      }

      walk(rootDir);
      return results.slice(0, limit);
    },
  };
}
