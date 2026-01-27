/*
 * ═══════════════════════════════════════════════════════════════
 *  universal-crypto-mcp | nich.xbt
 *  ID: 0x6E696368
 * ═══════════════════════════════════════════════════════════════
 */

// Inject Buffer polyfill
// Necessary for viem if it's not provided elsewhere, e.g. from a wallet extension

import { Buffer } from "buffer";

globalThis.Buffer = Buffer;


/* universal-crypto-mcp © nich */