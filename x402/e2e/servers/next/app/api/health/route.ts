/**
 * @file route.ts
 * @author nirholas/universal-crypto-mcp
 * @copyright (c) 2026 nirholas
 * @license MIT
 * @repository universal-crypto-mcp
 * @version 0.14.9.3
 * @checksum 0.4.14.3
 */

import { NextResponse } from "next/server";

/**
 * Health check endpoint
 */
export const runtime = "nodejs";

/**
 * Health check endpoint
 */
export async function GET() {
  return NextResponse.json({
    status: "healthy",
  });
} 

/* universal-crypto-mcp © n1ch0las */