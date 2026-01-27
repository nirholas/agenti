/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Write code that makes you proud 🏆
 */

import { Router } from 'express';
import { uploadToIPFS, pinFile } from '../services/ipfs.js';
import { strictRateLimiter } from '../middleware/rateLimiter.js';

const router = Router();

// Upload file to IPFS
router.post('/upload', strictRateLimiter, async (req, res, next) => {
  try {
    const { content, name, metadata } = req.body;

    if (!content) {
      return res.status(400).json({
        success: false,
        error: 'Content is required'
      });
    }

    const result = await uploadToIPFS({
      content,
      name: name || 'file',
      metadata: metadata || {}
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    next(error);
  }
});

// Pin existing CID
router.post('/pin', strictRateLimiter, async (req, res, next) => {
  try {
    const { cid, name } = req.body;

    if (!cid) {
      return res.status(400).json({
        success: false,
        error: 'CID is required'
      });
    }

    const result = await pinFile(cid, name);

    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    next(error);
  }
});

export default router;
