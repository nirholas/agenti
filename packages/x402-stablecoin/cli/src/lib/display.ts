/**
 * @fileoverview Pretty terminal output utilities
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

import chalk from 'chalk';
import ora, { Ora } from 'ora';
import Table from 'cli-table3';
import boxen from 'boxen';
import figlet from 'figlet';
import { TransactionRecord, BalanceInfo, YieldInfo, ToolInfo } from '../types.js';

/**
 * Color theme
 */
export const theme = {
  primary: chalk.hex('#00D4AA'),     // Sperax green
  secondary: chalk.hex('#6366F1'),   // Indigo
  success: chalk.green,
  error: chalk.red,
  warning: chalk.yellow,
  info: chalk.blue,
  muted: chalk.gray,
  highlight: chalk.bold.white,
};

/**
 * Create a loading spinner
 */
export function createSpinner(text: string): Ora {
  return ora({
    text,
    color: 'cyan',
    spinner: 'dots12',
  });
}

/**
 * Display banner
 */
export function displayBanner(): void {
  const banner = figlet.textSync('X402', {
    font: 'ANSI Shadow',
    horizontalLayout: 'default',
  });
  
  console.log(theme.primary(banner));
  console.log(theme.muted('  Payment Protocol for AI Agents\n'));
}

/**
 * Display success message
 */
export function success(message: string): void {
  console.log(`${chalk.green('✓')} ${message}`);
}

/**
 * Display error message
 */
export function error(message: string): void {
  console.log(`${chalk.red('✗')} ${theme.error(message)}`);
}

/**
 * Display warning message
 */
export function warning(message: string): void {
  console.log(`${chalk.yellow('⚠')} ${theme.warning(message)}`);
}

/**
 * Display info message
 */
export function info(message: string): void {
  console.log(`${chalk.blue('ℹ')} ${message}`);
}

/**
 * Display a key-value pair
 */
export function keyValue(key: string, value: string): void {
  console.log(`  ${theme.muted(key + ':')} ${value}`);
}

/**
 * Display balance information
 */
export function displayBalance(balances: BalanceInfo[], network: string): void {
  console.log();
  
  const box = boxen(
    balances.map(b => {
      const emoji = b.token === 'USDs' ? '💰' : '🪙';
      return `${emoji} ${theme.highlight(b.token)}: ${theme.primary(b.balanceFormatted)} ${b.token}`;
    }).join('\n') + 
    `\n\n🌐 Network: ${theme.secondary(network)}`,
    {
      padding: 1,
      margin: 0,
      borderStyle: 'round',
      borderColor: 'cyan',
      title: 'Wallet Balance',
      titleAlignment: 'center',
    }
  );
  
  console.log(box);
  console.log();
}

/**
 * Display yield information
 */
export function displayYield(yieldInfo: YieldInfo, balance: string): void {
  console.log();
  
  const content = [
    `💰 USDs Balance: ${theme.primary(balance)} USDs`,
    `📈 Yield Earned: ${theme.success('+' + yieldInfo.totalEarned)} USDs`,
    `📊 Current APY: ${theme.secondary(yieldInfo.currentAPY)}`,
    `📅 Monthly: ~${theme.primary(yieldInfo.monthlyEarnings)} USDs`,
    `🔄 Last Rebase: ${theme.muted(new Date(yieldInfo.lastRebase).toLocaleString())}`,
  ].join('\n');
  
  const box = boxen(content, {
    padding: 1,
    margin: 0,
    borderStyle: 'round',
    borderColor: 'green',
    title: 'USDs Auto-Yield',
    titleAlignment: 'center',
  });
  
  console.log(box);
  console.log();
}

/**
 * Display transaction history table
 */
export function displayHistory(transactions: TransactionRecord[]): void {
  if (transactions.length === 0) {
    info('No transactions found');
    return;
  }
  
  const table = new Table({
    head: [
      theme.highlight('Hash'),
      theme.highlight('Type'),
      theme.highlight('Amount'),
      theme.highlight('To'),
      theme.highlight('Status'),
      theme.highlight('Date'),
    ],
    style: {
      head: [],
      border: ['gray'],
    },
    colWidths: [14, 12, 18, 14, 12, 20],
  });
  
  for (const tx of transactions) {
    const statusColor = tx.status === 'confirmed' ? theme.success : 
                        tx.status === 'failed' ? theme.error : theme.warning;
    
    table.push([
      theme.muted(tx.hash.slice(0, 10) + '...'),
      tx.type,
      `${tx.amount} ${tx.token}`,
      tx.recipient.slice(0, 10) + '...',
      statusColor(tx.status),
      new Date(tx.timestamp).toLocaleDateString(),
    ]);
  }
  
  console.log();
  console.log(table.toString());
  console.log();
}

/**
 * Display single transaction details
 */
export function displayTransaction(tx: TransactionRecord): void {
  console.log();
  
  const statusEmoji = tx.status === 'confirmed' ? '✅' : 
                      tx.status === 'failed' ? '❌' : '⏳';
  
  const content = [
    `📋 Hash: ${theme.primary(tx.hash)}`,
    `📦 Type: ${tx.type}`,
    `💰 Amount: ${theme.highlight(tx.amount)} ${tx.token}`,
    `📤 Recipient: ${tx.recipient}`,
    `${statusEmoji} Status: ${tx.status}`,
    `🌐 Network: ${tx.network}`,
    `📅 Date: ${new Date(tx.timestamp).toLocaleString()}`,
    tx.toolName ? `🔧 Tool: ${tx.toolName}` : '',
    tx.description ? `📝 Note: ${tx.description}` : '',
  ].filter(Boolean).join('\n');
  
  const box = boxen(content, {
    padding: 1,
    margin: 0,
    borderStyle: 'round',
    borderColor: tx.status === 'confirmed' ? 'green' : tx.status === 'failed' ? 'red' : 'yellow',
    title: 'Transaction Details',
    titleAlignment: 'center',
  });
  
  console.log(box);
  console.log();
}

/**
 * Display tools table
 */
export function displayTools(tools: ToolInfo[]): void {
  if (tools.length === 0) {
    info('No tools registered');
    return;
  }
  
  const table = new Table({
    head: [
      theme.highlight('Name'),
      theme.highlight('Description'),
      theme.highlight('Price'),
      theme.highlight('Calls'),
      theme.highlight('Revenue'),
    ],
    style: {
      head: [],
      border: ['gray'],
    },
    colWidths: [20, 30, 15, 10, 15],
  });
  
  for (const tool of tools) {
    table.push([
      theme.primary(tool.name),
      tool.description.slice(0, 28) + (tool.description.length > 28 ? '...' : ''),
      `${tool.price} ${tool.token}`,
      tool.calls.toString(),
      `${tool.revenue} ${tool.token}`,
    ]);
  }
  
  console.log();
  console.log(table.toString());
  console.log();
}

/**
 * Display config table
 */
export function displayConfig(config: Record<string, any>): void {
  const table = new Table({
    style: {
      head: [],
      border: ['gray'],
    },
    colWidths: [25, 50],
  });
  
  for (const [key, value] of Object.entries(config)) {
    if (key === 'lastUsed' && value) {
      table.push([theme.muted(key), new Date(value).toLocaleString()]);
    } else {
      table.push([theme.muted(key), String(value ?? 'not set')]);
    }
  }
  
  console.log();
  console.log(table.toString());
  console.log();
}

/**
 * Display payment confirmation box
 */
export function displayPaymentConfirmation(
  recipient: string,
  amount: string,
  token: string,
  network: string,
  gasless: boolean
): void {
  const content = [
    `📤 To: ${theme.primary(recipient)}`,
    `💰 Amount: ${theme.highlight(amount)} ${token}`,
    `🌐 Network: ${network}`,
    gasless ? `⛽ Gasless: ${theme.success('Enabled')}` : `⛽ Gas: ${theme.warning('Required')}`,
  ].join('\n');
  
  const box = boxen(content, {
    padding: 1,
    margin: 0,
    borderStyle: 'round',
    borderColor: 'yellow',
    title: 'Confirm Payment',
    titleAlignment: 'center',
  });
  
  console.log();
  console.log(box);
  console.log();
}

/**
 * Format address for display
 */
export function formatAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

/**
 * Format amount with proper decimals
 */
export function formatAmount(amount: string, decimals: number = 18): string {
  const num = parseFloat(amount);
  if (isNaN(num)) return '0.00';
  return num.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  });
}

export { chalk, ora, Table, boxen };
