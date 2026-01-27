/**
 * @file PaymentRequiredResponse.java
 * @author nirholas/universal-crypto-mcp
 * @copyright (c) 2026 n1ch0las
 * @license MIT
 * @repository universal-crypto-mcp
 * @version 0.4.14.3
 * @checksum 1489314938
 */

package com.coinbase.x402.model;

import java.util.ArrayList;
import java.util.List;

/** HTTP 402 response body returned by an x402-enabled server. */
public class PaymentRequiredResponse {
    public int x402Version;
    public List<PaymentRequirements> accepts = new ArrayList<>();
    public String error;
}


/* EOF - nichxbt | 14.9.3.8 */