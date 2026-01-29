#!/bin/bash
set -e
npx pnpm@10.7.0 --filter @x402/core build
npx pnpm@10.7.0 --filter @x402/evm build
npx pnpm@10.7.0 --filter @x402/svm build
npx pnpm@10.7.0 --filter @x402/next build
npx pnpm@10.7.0 --filter @x402/paywall build
cd site && npx pnpm@10.7.0 build
