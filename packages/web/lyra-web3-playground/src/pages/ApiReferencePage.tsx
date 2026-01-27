/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Every line of code is a step toward something amazing ✨
 */

import { Link } from 'react-router-dom';
import { useSEO } from '@/hooks/useSEO';
import {
  FileCode,
  ChevronRight,
  Code2,
  Server,
  Zap,
  Shield,
  Copy,
  CheckCircle,
  ExternalLink
} from 'lucide-react';
import { useState } from 'react';

interface ApiEndpoint {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  description: string;
  parameters?: { name: string; type: string; required: boolean; description: string }[];
  response?: string;
  example?: string;
}

interface ApiSection {
  id: string;
  title: string;
  description: string;
  endpoints: ApiEndpoint[];
}

const apiSections: ApiSection[] = [
  {
    id: 'compile',
    title: 'Compilation API',
    description: 'Compile Solidity smart contracts',
    endpoints: [
      {
        method: 'POST',
        path: '/api/compile',
        description: 'Compile a Solidity smart contract and return the ABI and bytecode',
        parameters: [
          { name: 'source', type: 'string', required: true, description: 'Solidity source code' },
          { name: 'version', type: 'string', required: false, description: 'Solidity compiler version (default: 0.8.19)' },
          { name: 'optimization', type: 'boolean', required: false, description: 'Enable optimization (default: true)' },
          { name: 'runs', type: 'number', required: false, description: 'Optimization runs (default: 200)' }
        ],
        response: `{
  "success": true,
  "contracts": {
    "ContractName": {
      "abi": [...],
      "bytecode": "0x...",
      "deployedBytecode": "0x..."
    }
  },
  "warnings": [],
  "errors": []
}`,
        example: `fetch('/api/compile', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    source: 'pragma solidity ^0.8.19; contract Hello { }',
    version: '0.8.19',
    optimization: true
  })
})`
      }
    ]
  },
  {
    id: 'deploy',
    title: 'Deployment API',
    description: 'Deploy contracts to various networks',
    endpoints: [
      {
        method: 'POST',
        path: '/api/deploy',
        description: 'Deploy a compiled contract to a testnet',
        parameters: [
          { name: 'abi', type: 'array', required: true, description: 'Contract ABI' },
          { name: 'bytecode', type: 'string', required: true, description: 'Contract bytecode' },
          { name: 'network', type: 'string', required: true, description: 'Target network (sepolia, mumbai, etc.)' },
          { name: 'constructorArgs', type: 'array', required: false, description: 'Constructor arguments' }
        ],
        response: `{
  "success": true,
  "contractAddress": "0x...",
  "transactionHash": "0x...",
  "network": "sepolia",
  "blockNumber": 12345678
}`,
        example: `fetch('/api/deploy', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    abi: [...],
    bytecode: '0x...',
    network: 'sepolia',
    constructorArgs: []
  })
})`
      }
    ]
  },
  {
    id: 'ai',
    title: 'AI API',
    description: 'AI-powered code analysis and generation',
    endpoints: [
      {
        method: 'POST',
        path: '/api/ai/analyze',
        description: 'Analyze smart contract code for issues and improvements',
        parameters: [
          { name: 'source', type: 'string', required: true, description: 'Solidity source code to analyze' },
          { name: 'type', type: 'string', required: false, description: 'Analysis type: security, gas, or all (default: all)' }
        ],
        response: `{
  "success": true,
  "analysis": {
    "security": [...],
    "gasOptimization": [...],
    "bestPractices": [...],
    "score": 85
  }
}`,
        example: `fetch('/api/ai/analyze', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    source: 'contract MyToken { ... }',
    type: 'security'
  })
})`
      },
      {
        method: 'POST',
        path: '/api/ai/generate',
        description: 'Generate smart contract code from natural language description',
        parameters: [
          { name: 'prompt', type: 'string', required: true, description: 'Description of the contract to generate' },
          { name: 'template', type: 'string', required: false, description: 'Base template: erc20, erc721, custom' }
        ],
        response: `{
  "success": true,
  "code": "// SPDX-License-Identifier: MIT...",
  "explanation": "This contract implements..."
}`,
        example: `fetch('/api/ai/generate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: 'Create a simple voting contract',
    template: 'custom'
  })
})`
      }
    ]
  },
  {
    id: 'faucet',
    title: 'Faucet API',
    description: 'Request testnet tokens',
    endpoints: [
      {
        method: 'POST',
        path: '/api/faucet/request',
        description: 'Request testnet tokens for an address',
        parameters: [
          { name: 'address', type: 'string', required: true, description: 'Wallet address to receive tokens' },
          { name: 'network', type: 'string', required: true, description: 'Target network (sepolia, mumbai)' }
        ],
        response: `{
  "success": true,
  "transactionHash": "0x...",
  "amount": "0.1",
  "network": "sepolia"
}`,
        example: `fetch('/api/faucet/request', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    address: '0x...',
    network: 'sepolia'
  })
})`
      }
    ]
  },
  {
    id: 'ipfs',
    title: 'IPFS API',
    description: 'Store and retrieve data from IPFS',
    endpoints: [
      {
        method: 'POST',
        path: '/api/ipfs/upload',
        description: 'Upload content to IPFS',
        parameters: [
          { name: 'content', type: 'string | object', required: true, description: 'Content to upload (JSON or string)' },
          { name: 'filename', type: 'string', required: false, description: 'Optional filename' }
        ],
        response: `{
  "success": true,
  "cid": "Qm...",
  "url": "ipfs://Qm...",
  "gateway": "https://ipfs.io/ipfs/Qm..."
}`,
        example: `fetch('/api/ipfs/upload', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    content: { name: 'My NFT', description: '...' },
    filename: 'metadata.json'
  })
})`
      },
      {
        method: 'GET',
        path: '/api/ipfs/:cid',
        description: 'Retrieve content from IPFS by CID',
        parameters: [
          { name: 'cid', type: 'string', required: true, description: 'IPFS Content Identifier' }
        ],
        response: `{
  "success": true,
  "content": { ... }
}`,
        example: `fetch('/api/ipfs/QmXxx...')`
      }
    ]
  }
];

export default function ApiReferencePage() {
  useSEO({
    title: 'API Reference',
    description: 'Complete API documentation for Lyra Web3 Playground. Compilation, deployment, template, and project sharing endpoints with examples.',
    path: '/docs/api'
  });

  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const getMethodColor = (method: string) => {
    switch (method) {
      case 'GET': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
      case 'POST': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
      case 'PUT': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300';
      case 'DELETE': return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Breadcrumb */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="container mx-auto px-4 py-4">
          <nav className="flex items-center space-x-2 text-sm">
            <Link to="/docs" className="text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
              Documentation
            </Link>
            <ChevronRight className="w-4 h-4 text-gray-400" />
            <span className="text-gray-900 dark:text-white font-medium">API Reference</span>
          </nav>
        </div>
      </div>

      {/* Hero */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-12">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center space-x-4 mb-4">
              <div className="p-3 bg-white/20 rounded-xl">
                <FileCode className="w-8 h-8" />
              </div>
              <h1 className="text-3xl md:text-4xl font-black">API Reference</h1>
            </div>
            <p className="text-xl text-blue-100">
              Complete reference for the Lyra Web3 Playground REST API
            </p>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12">
        <div className="max-w-5xl mx-auto">
          {/* Base URL */}
          <div className="mb-12 p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
            <h2 className="text-lg font-bold mb-3 flex items-center">
              <Server className="w-5 h-5 mr-2 text-blue-600" />
              Base URL
            </h2>
            <div className="flex items-center space-x-3">
              <code className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 rounded-lg font-mono text-sm">
                https://api.lyra.works
              </code>
              <button
                onClick={() => copyCode('https://api.lyra.works')}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                {copiedCode === 'https://api.lyra.works' ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : (
                  <Copy className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          {/* Authentication */}
          <div className="mb-12 p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
            <h2 className="text-lg font-bold mb-3 flex items-center">
              <Shield className="w-5 h-5 mr-2 text-blue-600" />
              Authentication
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              Most endpoints require an API key. Include it in the request headers:
            </p>
            <pre className="p-4 bg-gray-900 text-gray-300 rounded-lg overflow-x-auto text-sm">
              <code>{`Authorization: Bearer YOUR_API_KEY`}</code>
            </pre>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
              API keys are available for registered developers. Contact us on{' '}
              <a href="https://github.com/nirholas/lyra-web3-playground/discussions" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                GitHub Discussions
              </a>{' '}
              to request access.
            </p>
          </div>

          {/* Rate Limiting */}
          <div className="mb-12 p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
            <h2 className="text-lg font-bold mb-3 flex items-center">
              <Zap className="w-5 h-5 mr-2 text-blue-600" />
              Rate Limiting
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              API requests are rate limited to ensure fair usage:
            </p>
            <ul className="mt-4 space-y-2 text-gray-600 dark:text-gray-400">
              <li>• <strong>Free tier:</strong> 100 requests per hour</li>
              <li>• <strong>Pro tier:</strong> 1,000 requests per hour</li>
              <li>• <strong>Compile endpoint:</strong> 50 requests per hour</li>
            </ul>
          </div>

          {/* API Sections */}
          {apiSections.map((section) => (
            <div key={section.id} id={section.id} className="mb-12">
              <h2 className="text-2xl font-bold mb-2">{section.title}</h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">{section.description}</p>

              {section.endpoints.map((endpoint, idx) => (
                <div
                  key={idx}
                  className="mb-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden"
                >
                  {/* Endpoint Header */}
                  <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex items-center space-x-3">
                    <span className={`px-3 py-1 rounded-lg text-sm font-bold ${getMethodColor(endpoint.method)}`}>
                      {endpoint.method}
                    </span>
                    <code className="font-mono text-sm">{endpoint.path}</code>
                  </div>

                  <div className="p-6">
                    <p className="text-gray-600 dark:text-gray-400 mb-4">
                      {endpoint.description}
                    </p>

                    {/* Parameters */}
                    {endpoint.parameters && endpoint.parameters.length > 0 && (
                      <div className="mb-6">
                        <h4 className="font-bold mb-3">Parameters</h4>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-gray-200 dark:border-gray-700">
                                <th className="text-left py-2 pr-4">Name</th>
                                <th className="text-left py-2 pr-4">Type</th>
                                <th className="text-left py-2 pr-4">Required</th>
                                <th className="text-left py-2">Description</th>
                              </tr>
                            </thead>
                            <tbody>
                              {endpoint.parameters.map((param) => (
                                <tr key={param.name} className="border-b border-gray-100 dark:border-gray-700/50">
                                  <td className="py-2 pr-4 font-mono text-blue-600">{param.name}</td>
                                  <td className="py-2 pr-4 text-gray-500">{param.type}</td>
                                  <td className="py-2 pr-4">
                                    {param.required ? (
                                      <span className="text-red-500">Required</span>
                                    ) : (
                                      <span className="text-gray-400">Optional</span>
                                    )}
                                  </td>
                                  <td className="py-2 text-gray-600 dark:text-gray-400">{param.description}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Response */}
                    {endpoint.response && (
                      <div className="mb-6">
                        <h4 className="font-bold mb-3">Response</h4>
                        <div className="relative">
                          <pre className="p-4 bg-gray-900 text-gray-300 rounded-lg overflow-x-auto text-sm">
                            <code>{endpoint.response}</code>
                          </pre>
                          <button
                            onClick={() => copyCode(endpoint.response!)}
                            className="absolute top-2 right-2 p-2 text-gray-400 hover:text-white"
                          >
                            {copiedCode === endpoint.response ? (
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Example */}
                    {endpoint.example && (
                      <div>
                        <h4 className="font-bold mb-3">Example</h4>
                        <div className="relative">
                          <pre className="p-4 bg-gray-900 text-gray-300 rounded-lg overflow-x-auto text-sm">
                            <code>{endpoint.example}</code>
                          </pre>
                          <button
                            onClick={() => copyCode(endpoint.example!)}
                            className="absolute top-2 right-2 p-2 text-gray-400 hover:text-white"
                          >
                            {copiedCode === endpoint.example ? (
                              <CheckCircle className="w-4 h-4 text-green-500" />
                            ) : (
                              <Copy className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}

          {/* Footer Links */}
          <div className="mt-12 p-6 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
            <h3 className="font-bold mb-4">Need Help?</h3>
            <div className="flex flex-wrap gap-4">
              <a
                href="https://github.com/nirholas/lyra-web3-playground/discussions"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center space-x-2 text-blue-600 dark:text-blue-400 hover:underline"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Ask on GitHub</span>
              </a>
              <Link
                to="/docs"
                className="inline-flex items-center space-x-2 text-blue-600 dark:text-blue-400 hover:underline"
              >
                <Code2 className="w-4 h-4" />
                <span>Browse Documentation</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
