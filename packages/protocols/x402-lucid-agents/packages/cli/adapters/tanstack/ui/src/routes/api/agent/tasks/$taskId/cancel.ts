import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/api/agent/tasks/$taskId/cancel')({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const { handlers } = await import('@/lib/agent');
        const taskId = (params as { taskId: string }).taskId;
        if (typeof taskId !== 'string') {
          return new Response('Missing or invalid taskId parameter', {
            status: 400,
          });
        }
        return handlers.cancelTask({
          request,
          params: { taskId },
        });
      },
    },
  },
});
