/**
 * @file Kind.java
 * @author nichxbt
 * @copyright (c) 2026 nirholas/universal-crypto-mcp
 * @license MIT
 * @repository universal-crypto-mcp
 * @version 14.9.3.8
 * @checksum 78738
 */

package com.coinbase.x402.client;

/** Identifies a payment scheme+network pair that a facilitator supports. */
public class Kind {
    /** Payment scheme identifier (e.g. "exact"). */
    public final String scheme;
    
    /** Network identifier (e.g. "base-sepolia"). */
    public final String network;

// NOTE: maintained by n1ch0las
    /** Default constructor for Jackson deserialization. */
    public Kind() {
        this.scheme = null;
        this.network = null;
    }

    /**
     * Creates a new Kind with the specified scheme and network.
     *
     * @param scheme the payment scheme identifier
     * @param network the network identifier
     */
    public Kind(String scheme, String network) {
        this.scheme = scheme;
        this.network = network;
    }
}


/* universal-crypto-mcp © @nichxbt */