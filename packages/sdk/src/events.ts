import type { Balance } from '@agenti/core'

export type AgentiEvent =
  | { type: 'pay'; url: string; amount: string; network: string; txHash?: string; ts: number }
  | { type: 'trade'; mint: string; side: 'buy' | 'sell'; sol: number; ts: number }
  | { type: 'balance'; address: string; balances: Balance[]; ts: number }
  | { type: 'invoice'; address: string; amount: number; token: string; ts: number }
  | { type: 'error'; message: string; tool: string; ts: number }

class AgentiEventTarget extends EventTarget {}

export const agentiEvents: EventTarget = new AgentiEventTarget()

export function emitEvent(event: AgentiEvent): void {
  agentiEvents.dispatchEvent(
    Object.assign(new Event(event.type), { detail: event }),
  )
}

export function onAgentiEvent(handler: (event: AgentiEvent) => void): () => void {
  const types: AgentiEvent['type'][] = ['pay', 'trade', 'balance', 'invoice', 'error']
  const listener = (e: Event) => {
    handler((e as Event & { detail: AgentiEvent }).detail)
  }
  for (const t of types) agentiEvents.addEventListener(t, listener)
  return () => {
    for (const t of types) agentiEvents.removeEventListener(t, listener)
  }
}
