import { onAgentiEvent } from '@agenti/sdk'
import type { AgentiEvent } from '@agenti/sdk'

export const dynamic = 'force-dynamic'

export function GET(): Response {
  const encoder = new TextEncoder()
  let unsub: (() => void) | undefined

  const stream = new ReadableStream({
    start(controller) {
      // Send a heartbeat comment every 15s to keep the connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': ping\n\n'))
        } catch {
          clearInterval(heartbeat)
        }
      }, 15_000)

      unsub = onAgentiEvent((event: AgentiEvent) => {
        try {
          const data = `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`
          controller.enqueue(encoder.encode(data))
        } catch {
          // client disconnected
        }
      })

      // Clean up when the stream is cancelled (client disconnects)
      return () => {
        clearInterval(heartbeat)
        unsub?.()
      }
    },
    cancel() {
      unsub?.()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
