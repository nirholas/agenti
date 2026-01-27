/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Persistence beats perfection 🎖️
 */

import OpenAI from 'openai';
import { AppError } from '../middleware/errorHandler.js';

const openai = process.env.OPENAI_API_KEY 
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

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
  // If OpenAI is not configured, use fallback templates
  if (!openai) {
    const lowerPrompt = prompt.toLowerCase();
    let template = fallbackTemplates.erc20;
    
    if (lowerPrompt.includes('nft') || lowerPrompt.includes('721')) {
      template = fallbackTemplates.nft;
    }

    return {
      code: template,
      explanation: 'AI service not configured. Using template match for your request.'
    };
  }

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
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
      explanation: 'Contract generated using AI'
    };
  } catch (error: any) {
    throw new AppError(`AI generation failed: ${error.message}`, 500);
  }
}

export async function explainCode(code: string, question?: string): Promise<{ explanation: string }> {
  if (!openai) {
    return {
      explanation: 'AI explanation service not configured. Please add OPENAI_API_KEY to your environment variables.'
    };
  }

  try {
    const prompt = question
      ? `Explain this Solidity code, focusing on: ${question}\n\n${code}`
      : `Explain this Solidity code in detail:\n\n${code}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
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
  if (!openai) {
    return {
      tests: `// Tests for ${framework}\n// AI service not configured. Please add OPENAI_API_KEY to generate tests.`
    };
  }

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
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
