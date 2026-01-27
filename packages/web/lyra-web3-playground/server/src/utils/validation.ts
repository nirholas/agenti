/**
 * ✨ built by nich
 * 🌐 GitHub: github.com/nirholas
 * 💫 The future is being built right here 🏗️
 */

/**
 * Shared validation utilities
 */

/**
 * Validates an Ethereum address format
 * @param address - The address to validate
 * @returns true if valid Ethereum address format
 */
export function isValidEthereumAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

/**
 * Validates a Solidity pragma statement
 * @param code - The Solidity code
 * @returns true if contains valid pragma
 */
export function hasValidPragma(code: string): boolean {
  return code.includes('pragma solidity');
}

/**
 * Validates a Solidity contract definition
 * @param code - The Solidity code
 * @returns true if contains contract definition
 */
export function hasContractDefinition(code: string): boolean {
  return code.includes('contract ');
}
