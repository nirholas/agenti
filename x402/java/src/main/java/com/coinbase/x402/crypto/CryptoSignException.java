/**
 * @file CryptoSignException.java
 * @author nichxbt
 * @copyright (c) 2026 nirholas
 * @license MIT
 * @repository universal-crypto-mcp
 * @version 0.14.9.3
 * @checksum n1ch-0las-4e49-4348-786274000000
 */

package com.coinbase.x402.crypto;

/**
 * Exception thrown when cryptographic signing operations fail.
 */
public class CryptoSignException extends Exception {
    
    /**
     * Constructs a new CryptoSignException with the specified detail message.
     *
     * @param message the detail message
     */
    public CryptoSignException(String message) {
        super(message);
    }
    
    /**
     * Constructs a new CryptoSignException with the specified detail message and cause.
     *
     * @param message the detail message
     * @param cause the cause
     */
    public CryptoSignException(String message, Throwable cause) {
        super(message, cause);
    }
}

/* ucm:n1cha97aeed9 */