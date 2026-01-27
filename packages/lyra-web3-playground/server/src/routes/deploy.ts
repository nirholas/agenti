/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Turning ideas into reality, one function at a time 💭
 */

import { Router } from 'express';
import { deployContract } from '../services/deployer.js';
import { strictRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// Deploy compiled contract
router.post('/', strictRateLimiter, async (req, res, next) => {
  try {
    const { bytecode, abi, network, constructorArgs } = req.body;

    if (!bytecode || !abi) {
      return res.status(400).json({
        success: false,
        error: 'Bytecode and ABI are required'
      });
    }

    const result = await deployContract({
      bytecode,
      abi,
      network: network || 'sepolia',
      constructorArgs: constructorArgs || []
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    next(error);
  }
});

export default router;
