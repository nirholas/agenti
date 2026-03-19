/**
 * CORS helpers: provide a single, consistent way to handle CORS across routes.
 */

function uniq(values: string[]): string[] {
  const set = new Set(values.map(v => v.trim().toLowerCase()).filter(Boolean));
  return Array.from(set);
}

export function buildCorsHeaders(request: Request, extraAllowHeaders: string[] = []): Record<string, string> {
  const originHeader = request.headers.get("Origin") || "*";
  const requested = request.headers.get("access-control-request-headers") || "";
  const requestedList = requested.split(",");

  const baseline = [
    "Content-Type",
    "content-type",
    "Authorization",
    "authorization",
    "X-Requested-With",
    ...extraAllowHeaders,
  ];

  const allowHeaders = uniq([...requestedList, ...baseline]).join(", ");

  return {
    "Access-Control-Allow-Origin": originHeader,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": allowHeaders,
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin, Access-Control-Request-Headers",
  };
}

export function preflightResponse(request: Request, extraAllowHeaders: string[] = []): Response {
  return new Response(null, { headers: buildCorsHeaders(request, extraAllowHeaders) });
}


