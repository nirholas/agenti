/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Every expert was once a beginner 📚
 */

import { Router } from 'express';
import { fundAddress } from '../services/faucet.js';
import { faucetRateLimiter } from '../middleware/rateLimiter.js';
import { isValidEthereumAddress } from '../utils/validation.js';

const router = Router();

// Allowed testnet networks
const ALLOWED_NETWORKS = ['sepolia', 'goerli', 'mumbai', 'fuji'] as const;
type NetworkType = typeof ALLOWED_NETWORKS[number];

// Request testnet funds
router.post('/request', faucetRateLimiter, async (req, res, next) => {
  try {
    const { address, network } = req.body;

    if (!address || typeof address !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Address is required and must be a string'
      });
    }

    // Validate Ethereum address format
    if (!isValidEthereumAddress(address)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Ethereum address'
      });
    }
    
    // Validate network
    const safeNetwork: NetworkType = network && ALLOWED_NETWORKS.includes(network) 
      ? network 
      : 'sepolia';

    const result = await fundAddress(address, safeNetwork);

    res.json({
      success: true,
      data: result
    });
  } catch (error: unknown) {
    next(error);
  }
});

export default router;
