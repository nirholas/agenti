import { X402_EXTENSION_URI } from './types.js'

export { X402_EXTENSION_URI }

export interface ExtensionDeclaration {
  uri: string
  description: string
  required: boolean
}

export function extensionDeclaration(
  description = 'Supports payments using the x402 protocol for on-chain settlement.',
  required = true,
): ExtensionDeclaration {
  return { uri: X402_EXTENSION_URI, description, required }
}

/** Returns true if the X-A2A-Extensions request header activates x402. */
export function isExtensionActive(headers: Headers | Record<string, string>): boolean {
  const value =
    headers instanceof Headers
      ? (headers.get('x-a2a-extensions') ?? '')
      : ((headers['x-a2a-extensions'] ?? headers['X-A2A-Extensions']) ?? '')
  return value.includes(X402_EXTENSION_URI)
}

/** Add the activation header to a response (echoes back the extension URI). */
export function addActivationHeader(headers: Headers): void {
  headers.set('X-A2A-Extensions', X402_EXTENSION_URI)
}

/** Minimal AgentCard shape with x402 extension declared. */
export interface AgentCard {
  name: string
  description: string
  url: string
  version: string
  capabilities: {
    streaming?: boolean
    extensions: ExtensionDeclaration[]
  }
  skills?: Array<{ id: string; name: string; description?: string }>
}

export function createAgentCard(
  opts: Omit<AgentCard, 'capabilities'> & { streaming?: boolean },
): AgentCard {
  return {
    ...opts,
    capabilities: {
      streaming: opts.streaming ?? true,
      extensions: [extensionDeclaration()],
    },
  }
}
