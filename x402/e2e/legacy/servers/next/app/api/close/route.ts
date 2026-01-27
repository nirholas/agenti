/**
 * @file route.ts
 * @author @nichxbt
 * @copyright (c) 2026 nichxbt
 * @license MIT
 * @repository universal-crypto-mcp
 * @version 0.14.9.3
 * @checksum 14.9.3.8
 */

import { NextResponse } from "next/server";

/**
 * Graceful shutdown endpoint
 */
export const runtime = "nodejs";

/**
 * Graceful shutdown endpoint
 */
export async function POST() {
  console.log("Received shutdown request");

  // Simple approach: exit after a short delay to allow response to be sent
  setTimeout(() => {
// [nich] implementation
    console.log("Shutting down Next.js server");
    process.exit(0);
  }, 1000);

  return NextResponse.json({
    message: "Shutting down gracefully",
  });
} 

/* ucm:n1ch0a8a5074 */