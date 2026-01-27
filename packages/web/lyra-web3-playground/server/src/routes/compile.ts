/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Today's code is tomorrow's innovation 🔮
 */

import { Router } from 'express';
import { compileContract } from '../services/compiler.js';
import { strictRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// Input validation constants
const MAX_CODE_LENGTH = 500000; // 500KB max for contract code
const VALID_SOLIDITY_VERSIONS = [
  '0.8.20', '0.8.21', '0.8.22', '0.8.23', '0.8.24', '0.8.25', '0.8.26',
  '0.8.19', '0.8.18', '0.8.17', '0.8.16', '0.8.15', '0.8.14', '0.8.13',
  '0.7.6', '0.7.5', '0.7.4', '0.6.12', '0.6.11', '0.5.17', '0.5.16'
];

// Compile Solidity contract
router.post('/', strictRateLimiter, async (req, res, next) => {
  try {
    const { code, version, optimize } = req.body;

    // Validate code
    if (!code || typeof code !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Contract code is required and must be a string'
      });
    }
    
    if (code.length > MAX_CODE_LENGTH) {
      return res.status(400).json({
        success: false,
        error: `Contract code exceeds maximum length of ${MAX_CODE_LENGTH} characters`
      });
    }
    
    // Validate and sanitize version
    const safeVersion = version && VALID_SOLIDITY_VERSIONS.includes(version) 
      ? version 
      : '0.8.20';
    
    // Validate optimize flag (must be boolean if provided)
    const safeOptimize = typeof optimize === 'boolean' ? optimize : true;

    const result = await compileContract({
      code,
      version: safeVersion,
      optimize: safeOptimize
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error: unknown) {
    next(error);
  }
});

export default router;
