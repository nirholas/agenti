/*
 * ═══════════════════════════════════════════════════════════════
 *  universal-crypto-mcp | nirholas/universal-crypto-mcp
 *  ID: bmljaCBuaXJob2xhcw==
 * ═══════════════════════════════════════════════════════════════
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

/* universal-crypto-mcp © nich */