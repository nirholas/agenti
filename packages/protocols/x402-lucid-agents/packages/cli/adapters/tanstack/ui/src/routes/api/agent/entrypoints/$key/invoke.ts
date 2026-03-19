import { createTanStackPaywall } from '@lucid-agents/tanstack';
import { createFileRoute } from '@tanstack/react-router';

import { handlers, runtime } from '@/lib/agent';

const paywall = createTanStackPaywall({
  runtime,
  basePath: '/api/agent',
});

export const Route = createFileRoute('/api/agent/entrypoints/$key/invoke')({
  server: {
    middleware: paywall.invoke ? [paywall.invoke] : [],
    handlers: {
      POST: async ({ request, params }) => {
        const key = params.key;
        if (typeof key !== 'string') {
          return new Response('Missing or invalid key parameter', {
            status: 400,
          });
        }
        return handlers.invoke({
          request,
          params: { key },
        });
      },
    },
  },
});
