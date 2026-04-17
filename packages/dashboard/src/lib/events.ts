'use client'

import type { AgentiEvent } from '@agenti/sdk'

export function connectEventSource(
  onEvent: (event: AgentiEvent) => void,
  onError?: (err: Event) => void,
): () => void {
  const es = new EventSource('/api/events')

  const types: AgentiEvent['type'][] = ['pay', 'trade', 'balance', 'invoice', 'error']
  for (const type of types) {
    es.addEventListener(type, (e: MessageEvent) => {
      try {
        onEvent(JSON.parse(e.data) as AgentiEvent)
      } catch {
        // ignore parse errors
      }
    })
  }

  if (onError) es.onerror = onError

  return () => es.close()
}
