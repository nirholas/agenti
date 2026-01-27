/**
 * @fileoverview Dedicated output channel for extension logs
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

import * as vscode from 'vscode';

type LogLevel = 'info' | 'warn' | 'error' | 'debug';

/**
 * Output channel manager for extension logging
 */
export class OutputChannelView {
  private static instance: OutputChannelView;
  private channel: vscode.OutputChannel;
  private logLevel: LogLevel = 'info';

  private constructor() {
    this.channel = vscode.window.createOutputChannel('GitHub to MCP', { log: true });
  }

  /**
   * Get singleton instance
   */
  static getInstance(): OutputChannelView {
    if (!OutputChannelView.instance) {
      OutputChannelView.instance = new OutputChannelView();
    }
    return OutputChannelView.instance;
  }

  /**
   * Set the minimum log level
   */
  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
    this.info(`Log level set to: ${level}`);
  }

  /**
   * Log info message
   */
  info(message: string, ...args: unknown[]): void {
    this.log('info', message, ...args);
  }

  /**
   * Log warning message
   */
  warn(message: string, ...args: unknown[]): void {
    this.log('warn', message, ...args);
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error, ...args: unknown[]): void {
    this.log('error', message, ...args);
    if (error) {
      this.channel.appendLine(`  Stack: ${error.stack || 'No stack trace'}`);
    }
  }

  /**
   * Log debug message
   */
  debug(message: string, ...args: unknown[]): void {
    if (this.shouldLog('debug')) {
      this.log('debug', message, ...args);
    }
  }

  /**
   * Log a message with level
   */
  private log(level: LogLevel, message: string, ...args: unknown[]): void {
    if (!this.shouldLog(level)) {
      return;
    }

    const timestamp = new Date().toISOString();
    const levelIcon = this.getLevelIcon(level);
    const formattedArgs = args.length > 0 ? ' ' + JSON.stringify(args) : '';
    
    this.channel.appendLine(`[${timestamp}] ${levelIcon} ${message}${formattedArgs}`);
  }

  /**
   * Check if message should be logged based on level
   */
  private shouldLog(level: LogLevel): boolean {
    const levels: LogLevel[] = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this.logLevel);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex >= currentLevelIndex;
  }

  /**
   * Get icon for log level
   */
  private getLevelIcon(level: LogLevel): string {
    switch (level) {
      case 'debug': return '🔍';
      case 'info': return 'ℹ️';
      case 'warn': return '⚠️';
      case 'error': return '❌';
    }
  }

  /**
   * Show the output channel
   */
  show(): void {
    this.channel.show();
  }

  /**
   * Hide the output channel
   */
  hide(): void {
    this.channel.hide();
  }

  /**
   * Clear the output channel
   */
  clear(): void {
    this.channel.clear();
    this.info('Output cleared');
  }

  /**
   * Log conversion start
   */
  logConversionStart(repoUrl: string): void {
    this.info('═'.repeat(50));
    this.info(`Starting conversion for: ${repoUrl}`);
    this.info('═'.repeat(50));
  }

  /**
   * Log conversion progress
   */
  logConversionProgress(step: string, details?: string): void {
    this.info(`  → ${step}${details ? ': ' + details : ''}`);
  }

  /**
   * Log conversion success
   */
  logConversionSuccess(repoName: string, toolCount: number): void {
    this.info('✅ Conversion completed successfully!');
    this.info(`  Repository: ${repoName}`);
    this.info(`  Tools found: ${toolCount}`);
    this.info('─'.repeat(50));
  }

  /**
   * Log conversion failure
   */
  logConversionFailure(repoUrl: string, error: Error): void {
    this.error(`❌ Conversion failed for: ${repoUrl}`, error);
    this.info('─'.repeat(50));
  }

  /**
   * Log tool extraction
   */
  logToolExtracted(toolName: string, description: string): void {
    this.debug(`  📦 Extracted tool: ${toolName}`);
    this.debug(`     ${description.substring(0, 60)}${description.length > 60 ? '...' : ''}`);
  }

  /**
   * Log configuration change
   */
  logConfigChange(setting: string, value: unknown): void {
    this.info(`Configuration changed: ${setting} = ${JSON.stringify(value)}`);
  }

  /**
   * Dispose the output channel
   */
  dispose(): void {
    this.channel.dispose();
  }
}

/**
 * Get the global output channel instance
 */
export function getOutputChannel(): OutputChannelView {
  return OutputChannelView.getInstance();
}
