import type { BlockConfig } from '../types.js'

export const AgentiWalletBlock: BlockConfig = {
  type: 'agenti_wallet',
  name: 'Agenti Wallet',
  description: 'Check balances and create payment invoices for an AI agent crypto wallet. Supports EVM (Base, Arbitrum, Ethereum) and Solana.',
  category: 'tools',
  bgColor: '#1d4ed8',
  tags: ['crypto', 'wallet', 'payments', 'web3'],
  subBlocks: [
    {
      id: 'operation',
      title: 'Operation',
      type: 'dropdown',
      required: true,
      options: [
        { label: 'Get Balance', value: 'balance' },
        { label: 'Create Invoice', value: 'receive' },
      ],
    },
    {
      id: 'evmAddress',
      title: 'EVM Address',
      type: 'short-input',
      required: { field: 'operation', value: 'balance' },
      condition: { field: 'operation', value: 'balance' },
      placeholder: '0x...',
    },
    {
      id: 'solanaAddress',
      title: 'Solana Address',
      type: 'short-input',
      required: false,
      condition: { field: 'operation', value: 'balance' },
      placeholder: 'Base58 address',
    },
    {
      id: 'heliusApiKey',
      title: 'Helius API Key',
      type: 'short-input',
      required: false,
      condition: { field: 'operation', value: 'balance' },
      placeholder: 'For SPL token balances',
    },
    {
      id: 'amount',
      title: 'Amount',
      type: 'short-input',
      required: { field: 'operation', value: 'receive' },
      condition: { field: 'operation', value: 'receive' },
      placeholder: '1.5',
    },
    {
      id: 'token',
      title: 'Token',
      type: 'dropdown',
      required: { field: 'operation', value: 'receive' },
      condition: { field: 'operation', value: 'receive' },
      options: [
        { label: 'USDC', value: 'USDC' },
        { label: 'SOL', value: 'SOL' },
        { label: 'ETH', value: 'ETH' },
      ],
    },
    {
      id: 'chain',
      title: 'Chain',
      type: 'dropdown',
      required: { field: 'operation', value: 'receive' },
      condition: { field: 'operation', value: 'receive' },
      options: [
        { label: 'Base', value: 'base' },
        { label: 'Arbitrum', value: 'arbitrum' },
        { label: 'Ethereum', value: 'ethereum' },
        { label: 'Solana', value: 'solana' },
      ],
    },
    {
      id: 'evmReceiveAddress',
      title: 'EVM Receiving Address',
      type: 'short-input',
      required: false,
      condition: { field: 'operation', value: 'receive' },
      placeholder: '0x...',
    },
    {
      id: 'solanaReceiveAddress',
      title: 'Solana Receiving Address',
      type: 'short-input',
      required: false,
      condition: { field: 'operation', value: 'receive' },
      placeholder: 'Base58 address',
    },
    {
      id: 'serverUrl',
      title: 'Bridge Server URL',
      type: 'short-input',
      required: false,
      defaultValue: 'http://localhost:3200',
      placeholder: 'http://localhost:3200',
    },
  ],
  tools: {
    access: ['agenti_balance', 'agenti_receive'],
    config: {
      tool: (params) => params.operation === 'balance' ? 'agenti_balance' : 'agenti_receive',
      params: (params) => {
        if (params.operation === 'balance') {
          return {
            evmAddress: params.evmAddress,
            solanaAddress: params.solanaAddress,
            heliusApiKey: params.heliusApiKey,
            serverUrl: params.serverUrl,
          }
        }
        return {
          amount: Number(params.amount),
          token: params.token,
          chain: params.chain,
          evmAddress: params.evmReceiveAddress,
          solanaAddress: params.solanaReceiveAddress,
          serverUrl: params.serverUrl,
        }
      },
    },
  },
  inputs: {
    operation: { type: 'string', description: 'balance or receive' },
    evmAddress: { type: 'string', description: 'EVM wallet address' },
    solanaAddress: { type: 'string', description: 'Solana wallet address' },
    amount: { type: 'number', description: 'Invoice amount' },
    token: { type: 'string', description: 'Token symbol' },
    chain: { type: 'string', description: 'Chain name' },
    serverUrl: { type: 'string', description: 'Bridge server URL' },
  },
  outputs: {
    balances: { type: 'json', description: 'Balance entries (get balance operation)' },
    usdc: { type: 'string', description: 'USDC balance on Base' },
    sol: { type: 'string', description: 'SOL balance' },
    summary: { type: 'string', description: 'Balance summary' },
    id: { type: 'string', description: 'Invoice ID (receive operation)' },
    address: { type: 'string', description: 'Payment address' },
    expiresAt: { type: 'string', description: 'Invoice expiry' },
  },
}
