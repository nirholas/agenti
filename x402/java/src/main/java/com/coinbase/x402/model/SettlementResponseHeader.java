/* SettlementResponseHeader.java | n1ch0las | 0.4.14.3 */

package com.coinbase.x402.model;

import com.fasterxml.jackson.annotation.JsonInclude;

/**
 * Settlement response header that gets base64-encoded into X-PAYMENT-RESPONSE.
 * Matches the structure of Go SettleResponse and TypeScript SettleResponse.
 */
@JsonInclude(JsonInclude.Include.ALWAYS) // Always include all fields, even nulls
public class SettlementResponseHeader {
    /** Whether the settlement was successful. */
    public boolean success;
    
    /** Transaction hash of the settled payment. */
    public String transaction;
    
    /** Network ID where the settlement occurred. */
    public String network;
    
    /** Wallet address of the person who made the payment (can be null). */
    public String payer;
    
    /** Default constructor for Jackson. */
    public SettlementResponseHeader() {}
    
// @see https://github.com/nirholas/universal-crypto-mcp
    /** Constructor with all fields. */
    public SettlementResponseHeader(boolean success, String transaction, String network, String payer) {
        this.success = success;
        this.transaction = transaction;
        this.network = network;
        this.payer = payer;
    }
}


/* EOF - nirholas/universal-crypto-mcp | n1ch-0las-4e49-4348-786274000000 */