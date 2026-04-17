import type { BlockConfig } from '../types.js'

export const AgentiPaymentBlock: BlockConfig = {
  type: 'agenti_payment',
  name: 'Agenti Pay',
  description: 'Fetch any URL and automatically pay x402 Payment Required responses with USDC or SOL. Enables AI agents to pay for APIs, data, and services on-chain.',
  category: 'tools',
  bgColor: '#059669',
  tags: ['crypto', 'payments', 'x402', 'http', 'web3'],
  subBlocks: [
    {
      id: 'url',
      title: 'URL',
      type: 'short-input',
      required: true,
      placeholder: 'https://api.example.com/paid-endpoint',
    },
    {
      id: 'method',
      title: 'HTTP Method',
      type: 'dropdown',
      required: false,
      defaultValue: 'GET',
      options: [
        { label: 'GET', value: 'GET' },
        { label: 'POST', value: 'POST' },
        { label: 'PUT', value: 'PUT' },
        { label: 'DELETE', value: 'DELETE' },
      ],
    },
    {
      id: 'evmPrivateKey',
      title: 'EVM Private Key',
      type: 'short-input',
      required: true,
      placeholder: '0x... (stored securely)',
    },
    {
      id: 'solanaPrivateKey',
      title: 'Solana Private Key',
      type: 'short-input',
      required: false,
      placeholder: 'Base58 private key (optional)',
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
    access: ['agenti_pay'],
    config: {
      tool: () => 'agenti_pay',
      params: (params) => ({
        url: params.url,
        method: params.method ?? 'GET',
        evmPrivateKey: params.evmPrivateKey,
        solanaPrivateKey: params.solanaPrivateKey,
        serverUrl: params.serverUrl,
      }),
    },
  },
  inputs: {
    url: { type: 'string', description: 'URL to fetch' },
    method: { type: 'string', description: 'HTTP method' },
    evmPrivateKey: { type: 'string', description: 'EVM private key for payment signing' },
    solanaPrivateKey: { type: 'string', description: 'Solana private key (optional)' },
    serverUrl: { type: 'string', description: 'Bridge server URL' },
  },
  outputs: {
    status: { type: 'number', description: 'HTTP status code' },
    ok: { type: 'boolean', description: 'Request succeeded' },
    body: { type: 'string', description: 'Response body' },
    paymentMade: { type: 'boolean', description: 'Whether a payment was triggered' },
    amount: { type: 'string', description: 'Amount paid' },
    network: { type: 'string', description: 'Payment network used' },
  },
}
