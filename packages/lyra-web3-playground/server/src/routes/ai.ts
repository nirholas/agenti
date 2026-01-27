/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Every bug fixed is a lesson learned 🎓
 */

import { Router } from 'express';
import { generateContract, explainCode, generateTests } from '../services/ai.js';
import { aiRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// Input validation constants
const MAX_PROMPT_LENGTH = 10000; // 10KB max for prompts
const MAX_CODE_LENGTH = 100000;  // 100KB max for code

// Helper to validate string input
const validateStringInput = (value: unknown, fieldName: string, maxLength: number): string | null => {
  if (!value || typeof value !== 'string') {
    return `${fieldName} is required and must be a string`;
  }
  if (value.length > maxLength) {
    return `${fieldName} exceeds maximum length of ${maxLength} characters`;
  }
  return null;
};

// Generate contract from natural language
router.post('/generate', aiRateLimiter, async (req, res, next) => {
  try {
    const { prompt } = req.body;

    const promptError = validateStringInput(prompt, 'Prompt', MAX_PROMPT_LENGTH);
    if (promptError) {
      return res.status(400).json({
        success: false,
        error: promptError
      });
    }

    const result = await generateContract(prompt);

    res.json({
      success: true,
      data: result
    });
  } catch (error: unknown) {
    next(error);
  }
});

// Explain code
router.post('/explain', aiRateLimiter, async (req, res, next) => {
  try {
    const { code, question } = req.body;

    const codeError = validateStringInput(code, 'Code', MAX_CODE_LENGTH);
    if (codeError) {
      return res.status(400).json({
        success: false,
        error: codeError
      });
    }
    
    // Optional question validation
    if (question !== undefined) {
      const questionError = validateStringInput(question, 'Question', MAX_PROMPT_LENGTH);
      if (questionError) {
        return res.status(400).json({
          success: false,
          error: questionError
        });
      }
    }

    const result = await explainCode(code, question);

    res.json({
      success: true,
      data: result
    });
  } catch (error: unknown) {
    next(error);
  }
});

// Generate tests
router.post('/tests', aiRateLimiter, async (req, res, next) => {
  try {
    const { code, framework } = req.body;

    const codeError = validateStringInput(code, 'Code', MAX_CODE_LENGTH);
    if (codeError) {
      return res.status(400).json({
        success: false,
        error: codeError
      });
    }
    
    // Validate framework if provided
    const allowedFrameworks = ['hardhat', 'foundry', 'truffle'];
    const safeFramework = framework && allowedFrameworks.includes(framework) ? framework : 'hardhat';

    const result = await generateTests(code, safeFramework);

    res.json({
      success: true,
      data: result
    });
  } catch (error: unknown) {
    next(error);
  }
});

export default router;
