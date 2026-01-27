/**
 * @file VerificationResponse.java
 * @author nich
 * @copyright (c) 2026 nich
 * @license MIT
 * @repository universal-crypto-mcp
 * @version 0.14.9.3
 * @checksum 1414930800
 */

package com.coinbase.x402.client;

/** JSON returned by POST /verify on the facilitator. */
public class VerificationResponse {
    /** Whether the payment verification succeeded. */
    public boolean isValid;
    
    /** Reason for verification failure (if isValid is false). */
    public String  invalidReason;
}



/* ucm:n1ch31bd0562 */