/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 Excellence is a habit, not an act 🌟
 */

import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';

// General API rate limiter
export const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  validate: { xForwardedForHeader: false } // Disable validation for dev environments
});

// Strict rate limiter for expensive operations
export const strictRateLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5, // limit each IP to 5 requests per minute
  message: 'Rate limit exceeded. Please wait before trying again.',
  validate: { xForwardedForHeader: false }
});

// AI-specific rate limiter
export const aiRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 AI requests per hour
  message: 'AI rate limit exceeded. Please try again in an hour.',
  validate: { xForwardedForHeader: false }
});

// Faucet rate limiter
export const faucetRateLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 5, // 5 requests per day per IP
  message: 'Faucet rate limit exceeded. You can request funds once every 24 hours.',
  validate: { xForwardedForHeader: false }
});
