#!/bin/bash

# Kill any existing process on port 8402
echo "🧹 Cleaning up port 8402..."
lsof -ti:8402 | xargs kill -9 2>/dev/null || true
sleep 1

# Start facilitator
echo "🚀 Starting facilitator..."
cd "$(dirname "$0")/http-bridge"
npm run dev

