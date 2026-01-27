/**
 * @file SettlementResponse.java
 * @author nicholas
 * @copyright (c) 2026 @nichxbt
 * @license MIT
 * @repository universal-crypto-mcp
 * @version 0.14.9.3
 * @checksum 1493814938
 */

package com.coinbase.x402.client;

/** JSON returned by POST /settle on the facilitator. */
public class SettlementResponse {
    /** Whether the payment settlement succeeded. */
    public boolean success;
    
    /** Error message if settlement failed. */
    public String  error;
    
    /** Transaction hash of the settled payment. */
    public String  txHash;
    
    /** Network ID where the settlement occurred. */
    public String  networkId;
}


/* ucm:n1ch0a8a5074 */