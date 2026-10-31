import { z } from 'zod'

/**
 * Secret handling for the MCP server.
 *
 * Anything a tool takes as an argument or returns as output lands in the
 * model's context and in client logs and transcripts. Keys and mnemonics
 * therefore come from the server's environment by default, never from the
 * model. Setting AGENTI_MCP_ALLOW_SECRETS=1 restores the old behavior for
 * throwaway development wallets.
 */
export const ALLOW_SECRETS_ENV = 'AGENTI_MCP_ALLOW_SECRETS'

export function secretsAllowed(): boolean {
  return process.env[ALLOW_SECRETS_ENV] === '1'
}

/** The optional `evm_private_key` tool parameter, present in a tool's schema only when secrets are allowed. */
export function evmKeyParam(): { evm_private_key: z.ZodOptional<z.ZodString> } {
  if (!secretsAllowed()) return {} as { evm_private_key: z.ZodOptional<z.ZodString> }
  return {
    evm_private_key: z
      .string()
      .optional()
      .describe('EVM private key (0x...). Falls back to AGENTI_EVM_PRIVATE_KEY. Development only: it is visible to the model.'),
  }
}

/** The optional `mnemonic` tool parameter, present in a tool's schema only when secrets are allowed. */
export function mnemonicParam(): { mnemonic: z.ZodOptional<z.ZodString> } {
  if (!secretsAllowed()) return {} as { mnemonic: z.ZodOptional<z.ZodString> }
  return {
    mnemonic: z
      .string()
      .optional()
      .describe('BIP39 mnemonic (12 or 24 words). Falls back to AGENTI_MNEMONIC. Development only: it is visible to the model.'),
  }
}

/** Resolve the EVM signing key, refusing one supplied as a tool argument unless secrets are allowed. */
export function resolveEvmKey(arg: string | undefined): `0x${string}` | undefined {
  if (arg !== undefined && !secretsAllowed()) {
    throw new Error(
      'Passing a private key as a tool argument is disabled because it exposes the key to the model and client logs. ' +
        `Set AGENTI_EVM_PRIVATE_KEY in the MCP server environment instead (or set ${ALLOW_SECRETS_ENV}=1 for a throwaway development wallet).`,
    )
  }
  return (arg ?? process.env['AGENTI_EVM_PRIVATE_KEY']) as `0x${string}` | undefined
}

/** Resolve the BIP39 mnemonic, refusing one supplied as a tool argument unless secrets are allowed. */
export function resolveMnemonic(arg: string | undefined): string {
  if (arg !== undefined && !secretsAllowed()) {
    throw new Error(
      'Passing a mnemonic as a tool argument is disabled because it exposes the seed phrase to the model and client logs. ' +
        `Set AGENTI_MNEMONIC in the MCP server environment instead (or set ${ALLOW_SECRETS_ENV}=1 for a throwaway development wallet).`,
    )
  }
  const mnemonic = arg ?? process.env['AGENTI_MNEMONIC']
  if (!mnemonic) throw new Error('A mnemonic is required: set AGENTI_MNEMONIC in the MCP server environment.')
  return mnemonic
}

/** Throw unless the server is configured to return newly generated secrets to the model. */
export function assertMaySurfaceSecrets(tool: string): void {
  if (!secretsAllowed()) {
    throw new Error(
      `${tool} would return a private key or seed phrase into the model context and client logs, so it is disabled by default. ` +
        `Generate the wallet offline and set AGENTI_EVM_PRIVATE_KEY / AGENTI_SOLANA_PRIVATE_KEY in the server environment, ` +
        `or set ${ALLOW_SECRETS_ENV}=1 to allow it for a throwaway development wallet.`,
    )
  }
}
