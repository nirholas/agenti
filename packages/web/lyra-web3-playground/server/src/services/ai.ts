/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Persistence beats perfection 🎖️
 */

import OpenAI from 'openai';
import { AppError } from '../middleware/errorHandler.js';

// AI Provider configuration with priority: OpenRouter > OpenAI
type AIProvider = 'openai' | 'openrouter';

interface AIConfig {
  client: OpenAI;
  provider: AIProvider;
  model: string;
}

function initializeAI(): AIConfig | null {
  // Priority 1: OpenRouter (supports 200+ models with single key)
  if (process.env.OPENROUTER_API_KEY) {
    return {
      client: new OpenAI({
        apiKey: process.env.OPENROUTER_API_KEY,
        baseURL: 'https://openrouter.ai/api/v1',
        defaultHeaders: {
          'HTTP-Referer': process.env.SITE_URL || 'https://github.com/nirholas/lyra-web3-playground',
          'X-Title': 'Lyra Web3 Playground',
        }
      }),
      provider: 'openrouter',
      model: process.env.OPENROUTER_MODEL || 'anthropic/claude-sonnet-4'
    };
  }
  
  // Priority 2: OpenAI
  if (process.env.OPENAI_API_KEY) {
    return {
      client: new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
      provider: 'openai',
      model: process.env.OPENAI_MODEL || 'gpt-4'
    };
  }
  
  return null;
}

const ai = initializeAI();

// Fallback templates for when AI is not available
const fallbackTemplates: Record<string, string> = {
  erc20: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MyToken is ERC20, Ownable {
    constructor(uint256 initialSupply) ERC20("MyToken", "MTK") Ownable(msg.sender) {
        _mint(msg.sender, initialSupply * 10 ** decimals());
    }

    function mint(address to, uint256 amount) public onlyOwner {
        _mint(to, amount);
    }
}`,
  nft: `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract MyNFT is ERC721, Ownable {
    uint256 private _tokenIdCounter;

    constructor() ERC721("MyNFT", "MNFT") Ownable(msg.sender) {}

    function safeMint(address to) public onlyOwner {
        uint256 tokenId = _tokenIdCounter;
        _tokenIdCounter++;
        _safeMint(to, tokenId);
    }
}`
};

export async function generateContract(prompt: string): Promise<{ code: string; explanation: string }> {
  // If AI is not configured, use fallback templates
  if (!ai) {
    const lowerPrompt = prompt.toLowerCase();
    let template = fallbackTemplates.erc20;
    
    if (lowerPrompt.includes('nft') || lowerPrompt.includes('721')) {
      template = fallbackTemplates.nft;
    }

    return {
      code: template,
      explanation: 'AI service not configured. Set OPENROUTER_API_KEY or OPENAI_API_KEY.'
    };
  }

  try {
    const completion = await ai.client.chat.completions.create({
      model: ai.model,
      messages: [
        {
          role: 'system',
          content: 'You are an expert Solidity smart contract developer. Generate secure, well-documented Solidity contracts based on user requirements. Always include SPDX license identifier and use latest Solidity version (^0.8.20). Use OpenZeppelin contracts when appropriate.'
        },
        {
          role: 'user',
          content: `Generate a Solidity smart contract based on this request: ${prompt}\n\nReturn ONLY the Solidity code, no markdown formatting or explanations.`
        }
      ],
      temperature: 0.7,
      max_tokens: 2000
    });

    const code = completion.choices[0]?.message?.content;
    
    if (!code) {
      throw new AppError('Failed to generate contract', 500);
    }

    return {
      code: code.replace(/```solidity\n?/g, '').replace(/```\n?/g, '').trim(),
      explanation: `Contract generated using ${ai.provider} (${ai.model})`
    };
  } catch (error: any) {
    throw new AppError(`AI generation failed: ${error.message}`, 500);
  }
}

export async function explainCode(code: string, question?: string): Promise<{ explanation: string }> {
  if (!ai) {
    return {
      explanation: 'AI explanation service not configured. Set OPENROUTER_API_KEY or OPENAI_API_KEY.'
    };
  }

  try {
    const prompt = question
      ? `Explain this Solidity code, focusing on: ${question}\n\n${code}`
      : `Explain this Solidity code in detail:\n\n${code}`;

    const completion = await ai.client.chat.completions.create({
      model: ai.model,
      messages: [
        {
          role: 'system',
          content: 'You are an expert Solidity developer. Explain smart contract code clearly and concisely.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      temperature: 0.5,
      max_tokens: 1000
    });

    return {
      explanation: completion.choices[0]?.message?.content || 'Unable to generate explanation'
    };
  } catch (error: any) {
    throw new AppError(`Code explanation failed: ${error.message}`, 500);
  }
}

export async function generateTests(code: string, framework: string): Promise<{ tests: string }> {
  if (!ai) {
    return {
      tests: `// Tests for ${framework}\n// AI service not configured. Set OPENROUTER_API_KEY or OPENAI_API_KEY.`
    };
  }

  try {
    const completion = await ai.client.chat.completions.create({
      model: ai.model,
      messages: [
        {
          role: 'system',
          content: `You are an expert at writing comprehensive smart contract tests using ${framework}. Generate thorough test suites that cover edge cases and security concerns.`
        },
        {
          role: 'user',
          content: `Generate comprehensive ${framework} tests for this Solidity contract:\n\n${code}\n\nReturn ONLY the test code, no markdown formatting.`
        }
      ],
      temperature: 0.7,
      max_tokens: 2000
    });

    const tests = completion.choices[0]?.message?.content || '';

    return {
      tests: tests.replace(/```javascript\n?/g, '').replace(/```typescript\n?/g, '').replace(/```\n?/g, '').trim()
    };
  } catch (error: any) {
    throw new AppError(`Test generation failed: ${error.message}`, 500);
  }
}
