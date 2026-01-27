/**
 * @fileoverview Command to browse public MCP server registry
 * @copyright Copyright (c) 2024-2026 nirholas
 * @license MIT
 */

import * as vscode from 'vscode';
import { StorageService } from '../utils/storage';
import { HistoryProvider } from '../views/historyProvider';
import { performConversion } from './convertFromUrl';

interface RegistryServer {
  name: string;
  description: string;
  repoUrl: string;
  category: string;
  stars?: number;
  author?: string;
}

// Built-in registry of popular MCP-compatible repositories
const REGISTRY_SERVERS: RegistryServer[] = [
  {
    name: 'Anthropic Claude Code',
    description: 'AI coding assistant from Anthropic',
    repoUrl: 'https://github.com/anthropics/claude-code',
    category: 'AI Tools',
    author: 'Anthropic'
  },
  {
    name: 'Langchain',
    description: 'Build applications with LLMs through composability',
    repoUrl: 'https://github.com/langchain-ai/langchain',
    category: 'AI Framework',
    author: 'LangChain'
  },
  {
    name: 'OpenAI Node',
    description: 'Official Node.js library for OpenAI API',
    repoUrl: 'https://github.com/openai/openai-node',
    category: 'AI SDK',
    author: 'OpenAI'
  },
  {
    name: 'Vercel AI SDK',
    description: 'Build AI-powered apps with React, Svelte, Vue',
    repoUrl: 'https://github.com/vercel/ai',
    category: 'AI SDK',
    author: 'Vercel'
  },
  {
    name: 'Hugging Face Transformers',
    description: 'State-of-the-art ML for PyTorch, TensorFlow, JAX',
    repoUrl: 'https://github.com/huggingface/transformers',
    category: 'ML Framework',
    author: 'Hugging Face'
  },
  {
    name: 'FastAPI',
    description: 'Modern, fast web framework for building APIs',
    repoUrl: 'https://github.com/tiangolo/fastapi',
    category: 'Web Framework',
    author: 'Sebastián Ramírez'
  },
  {
    name: 'Prisma',
    description: 'Next-generation ORM for Node.js and TypeScript',
    repoUrl: 'https://github.com/prisma/prisma',
    category: 'Database',
    author: 'Prisma'
  },
  {
    name: 'tRPC',
    description: 'End-to-end typesafe APIs made easy',
    repoUrl: 'https://github.com/trpc/trpc',
    category: 'API Framework',
    author: 'tRPC'
  },
  {
    name: 'Stripe Node',
    description: 'Node.js library for Stripe API',
    repoUrl: 'https://github.com/stripe/stripe-node',
    category: 'Payment',
    author: 'Stripe'
  },
  {
    name: 'Supabase',
    description: 'Open source Firebase alternative',
    repoUrl: 'https://github.com/supabase/supabase',
    category: 'Database',
    author: 'Supabase'
  }
];

/**
 * Browse and convert from public MCP server registry
 */
export async function browseRegistryCommand(
  storage: StorageService,
  historyProvider: HistoryProvider,
  extensionUri: vscode.Uri
): Promise<void> {
  // Group servers by category
  const categories = [...new Set(REGISTRY_SERVERS.map(s => s.category))];

  // First, let user pick a category or view all
  const categorySelection = await vscode.window.showQuickPick(
    [
      { label: '$(list-flat) All Servers', value: 'all' },
      { label: '$(search) Search by Name', value: 'search' },
      { label: '', kind: vscode.QuickPickItemKind.Separator },
      ...categories.map(cat => ({
        label: `$(folder) ${cat}`,
        value: cat
      }))
    ],
    {
      placeHolder: 'Select a category or search',
      title: 'MCP Server Registry'
    }
  );

  if (!categorySelection) {
    return;
  }

  let serversToShow: RegistryServer[];

  // Type guard - separator items don't have value property
  const selection = categorySelection as { label: string; value?: string };
  const selectionValue = selection.value;

  if (selectionValue === 'search') {
    // Search mode
    const searchQuery = await vscode.window.showInputBox({
      prompt: 'Search for MCP servers',
      placeHolder: 'Enter search term...'
    });

    if (!searchQuery) {
      return;
    }

    const query = searchQuery.toLowerCase();
    serversToShow = REGISTRY_SERVERS.filter(
      s => s.name.toLowerCase().includes(query) ||
           s.description.toLowerCase().includes(query) ||
           s.author?.toLowerCase().includes(query)
    );

    if (serversToShow.length === 0) {
      vscode.window.showInformationMessage(`No servers found matching "${searchQuery}"`);
      return;
    }
  } else if (selectionValue === 'all') {
    serversToShow = REGISTRY_SERVERS;
  } else {
    serversToShow = REGISTRY_SERVERS.filter(s => s.category === selectionValue);
  }

  // Show servers in the selected category
  const serverItems: vscode.QuickPickItem[] = serversToShow.map(server => ({
    label: `$(github) ${server.name}`,
    description: server.author || '',
    detail: server.description,
    server: server
  } as vscode.QuickPickItem & { server: RegistryServer }));

  const selectedServer = await vscode.window.showQuickPick(serverItems, {
    placeHolder: 'Select a server to convert',
    title: 'MCP Server Registry',
    matchOnDescription: true,
    matchOnDetail: true
  }) as (vscode.QuickPickItem & { server: RegistryServer }) | undefined;

  if (!selectedServer) {
    return;
  }

  // Show server details and confirm
  const action = await vscode.window.showInformationMessage(
    `Convert ${selectedServer.server.name} to MCP server?`,
    { modal: true, detail: `${selectedServer.server.description}\n\nRepository: ${selectedServer.server.repoUrl}` },
    'Convert',
    'Open in Browser',
    'Cancel'
  );

  if (action === 'Convert') {
    await performConversion(selectedServer.server.repoUrl, storage, historyProvider, extensionUri);
  } else if (action === 'Open in Browser') {
    vscode.env.openExternal(vscode.Uri.parse(selectedServer.server.repoUrl));
  }
}

/**
 * Fetch registry from remote source (for future implementation)
 */
export async function fetchRemoteRegistry(): Promise<RegistryServer[]> {
  // In the future, this could fetch from a remote registry API
  // For now, return the built-in registry
  return REGISTRY_SERVERS;
}

/**
 * Add a custom server to the local registry
 */
export function addCustomServer(server: RegistryServer): void {
  // This would persist to workspace state
  REGISTRY_SERVERS.push(server);
}
