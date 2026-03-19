import { routeAgentRequest, getAgentByName } from "agents";
import { Host } from "./agents/host";
import { Guest } from "./agents/guest";
import { hashUserId } from "./utils/hashing";
import { createEventService } from "./shared/eventService";
import { buildCorsHeaders, preflightResponse } from "./utils/cors";

export type Env = {
  OPENAI_API_KEY: string;
  CROSSMINT_API_KEY: string; // Client API key (ck_) for email OTP
  SECRETS: KVNamespace;
  ASSETS?: Fetcher; // Optional - only used in wrangler dev, not vite dev
  Host: DurableObjectNamespace;
  Guest: DurableObjectNamespace<Guest>;
};

export { Host, Guest };

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    // Basic CORS headers for API endpoints
    const CORS_HEADERS = buildCorsHeaders(request);

    // Handle global preflight
    if (request.method === "OPTIONS") {
      return preflightResponse(request);
    }

    // Serve assets for root and static files first (only in wrangler dev with ASSETS binding)
    if (
      env.ASSETS &&
      (url.pathname === "/" ||
      url.pathname.startsWith("/src/") ||
      url.pathname.startsWith("/assets/") ||
      url.pathname === "/my-mcp.html")
    ) {
      return env.ASSETS.fetch(request);
    }

    // MCP server metadata endpoint
    if (url.pathname === "/mcp/info") {
      const { NETWORK, FACILITATOR_URL } = await import("./constants");
      return new Response(JSON.stringify({
        name: "EventRSVP",
        version: "1.0.0",
        description: "Paid event RSVP with x402 payments",
        transport: "streamable-http",
        endpoints: {
          shared: `${url.origin}/mcp`,
          perUser: `${url.origin}/mcp/users/{userId}`,
          sseShared: `${url.origin}/mcp/sse`,
          register: `${url.origin}/api/users/mcp`
        },
        tools: [
          { name: "createEvent", description: "Create a new event", paid: false },
          { name: "getAllEvents", description: "List all events with RSVP counts", paid: false },
          { name: "rsvpToEvent", description: "RSVP to an event (requires payment)", paid: true, price: "$0.05" }
        ],
        payment: {
          protocol: "x402",
          network: NETWORK,
          token: "USDC",
          facilitator: FACILITATOR_URL
        }
      }), { headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
    }

    // Host MCP server endpoint (shared instance). Exclude SSE paths handled below
    if (
      url.pathname.startsWith("/mcp") &&
      !url.pathname.startsWith("/mcp/users/") &&
      !url.pathname.startsWith("/mcp/sse")
    ) {
      try {
        return await Host.serve("/mcp", { binding: "Host" }).fetch(request, env, ctx);
      } catch (error) {
        console.error("MCP server error:", error);
        return new Response(
          JSON.stringify({
            error: "MCP server error",
            message: error instanceof Error ? error.message : String(error),
            timestamp: new Date().toISOString()
          }),
          {
            status: 500,
            headers: { "Content-Type": "application/json" }
          }
        );
      }
    }

    // Personal MCP endpoint per user (Streamable HTTP transport)
    // Use serve() method which creates proper handler for each path
    if (url.pathname.startsWith("/mcp/users/")) {
      try {
        const pathParts = url.pathname.split("/").filter(Boolean);
        const urlSafeId = pathParts[2] ? decodeURIComponent(pathParts[2]) : null;

        if (!urlSafeId) {
          return new Response(
            JSON.stringify({ error: "User ID required" }),
            { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
          );
        }

        // Handle CORS preflight for MCP endpoints
        if (request.method === "OPTIONS") {
          return preflightResponse(request, ["x-user-scope-id"]);
        }

        // Look up user by urlSafeId (hash)
        const user = await env.SECRETS.get(`usersByHash:${urlSafeId}`, { type: "json" }) as { userId?: string, walletAddress?: string } | null;
        if (!user?.walletAddress) {
          return new Response(
            JSON.stringify({ error: "User not found", urlSafeId }),
            { status: 404, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
          );
        }

        console.log(`🔀 Routing to user MCP: ${user.userId} (${urlSafeId})`);
        console.log(`📨 Request method: ${request.method}, URL: ${url.pathname}`);
        // Log a simple subset of headers to avoid typing issues
        const hdrs: Record<string, string> = {};
        request.headers.forEach((v, k) => (hdrs[k] = v));
        console.log(`📨 Headers:`, hdrs);

        // CRITICAL: Pass urlSafeId via custom header so Host DO can extract it
        // Host.serve() creates session-based DOs, but we need per-user scoping
        // Solution: inject urlSafeId as a header that the DO can read
        const headers = new Headers(request.headers);
        headers.set("x-user-scope-id", urlSafeId);
        const scopedRequest = new Request(request.url, {
          method: request.method,
          headers,
          body: request.body
        });

        const response = await Host.serve(`/mcp/users/${urlSafeId}`, { binding: "Host" }).fetch(scopedRequest, env, ctx);
        console.log(`✅ Host response status: ${response.status}`);

        // Add CORS headers to MCP response
        const corsHeaders = new Headers(response.headers);
        const hdrs = buildCorsHeaders(request, ["x-user-scope-id"]);
        corsHeaders.set("Access-Control-Allow-Origin", hdrs["Access-Control-Allow-Origin"]);
        corsHeaders.set("Access-Control-Allow-Methods", hdrs["Access-Control-Allow-Methods"]);
        corsHeaders.set("Access-Control-Allow-Headers", hdrs["Access-Control-Allow-Headers"]);
        corsHeaders.set("Access-Control-Max-Age", hdrs["Access-Control-Max-Age"]);
        corsHeaders.set("Vary", hdrs["Vary"]);

        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: corsHeaders
        });
      } catch (error) {
        console.error("Per-user MCP error:", error);
        return new Response(
          JSON.stringify({
            error: "Failed to route to user MCP server",
            message: error instanceof Error ? error.message : String(error)
          }),
          { status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
        );
      }
    }

    // SSE endpoint removed for simplicity; streamable-http is used for per-user MCP

    // API to register user's MCP mapping (authenticated via Crossmint wallet)
    if (url.pathname === "/api/users/mcp" && request.method === "POST") {
      try {
        const body = (await request.json().catch(() => ({} as any))) as Partial<{ walletAddress: string; userId: string }>;
        const { walletAddress, userId } = body;

        // Validate input
        if (
          !userId ||
          !walletAddress ||
          typeof userId !== "string" ||
          typeof walletAddress !== "string" ||
          !/^0x[a-fA-F0-9]{40}$/.test(walletAddress)
        ) {
          return new Response(
            JSON.stringify({ error: "Invalid body. Required: userId (string) and walletAddress (0x...)" }),
            { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
          );
        }

        // Create URL-safe identifier from userId
        // Hash the userId to avoid special characters in URL paths
        const urlSafeId = await hashUserId(userId);

        // Check if user already exists (check both original userId and urlSafeId)
        let existingUser = await env.SECRETS.get(`users:${userId}`, { type: "json" }) as { walletAddress?: string, urlSafeId?: string, userId?: string } | null;
        if (!existingUser) {
          // Also check by urlSafeId in case of lookup
          existingUser = await env.SECRETS.get(`usersByHash:${urlSafeId}`, { type: "json" }) as { walletAddress?: string, urlSafeId?: string, userId?: string } | null;
        }
        if (existingUser) {
          // User exists - upsert wallet address if different
          const workerHost = request.headers.get("cf-worker");
          const origin = workerHost ? `https://${workerHost}` : new URL(request.url).origin;
          const existingUrlSafeId = existingUser.urlSafeId || urlSafeId;

          // If wallet address changed, update it (upsert behavior)
          const walletChanged = existingUser.walletAddress !== walletAddress;
          if (walletChanged) {
            console.log(`🔄 Updating wallet address for user ${userId}: ${existingUser.walletAddress} → ${walletAddress}`);
          }

          // Update both KV keys with the new wallet address
          const updatedRecord = {
            userId: existingUser.userId || userId,
            walletAddress, // Always use the new wallet address
            urlSafeId: existingUrlSafeId,
            createdAt: (existingUser as any).createdAt || Date.now(),
            updatedAt: walletChanged ? Date.now() : (existingUser as any).updatedAt,
            createdBy: (existingUser as any).createdBy || "crossmint-auth"
          };

          await env.SECRETS.put(`users:${userId}`, JSON.stringify(updatedRecord));
          await env.SECRETS.put(`usersByHash:${existingUrlSafeId}`, JSON.stringify(updatedRecord));

          // If this was a migration case, log it
          if (!existingUser.urlSafeId) {
            console.log(`🔄 Migrated user: ${userId} → ${existingUrlSafeId}`);
          }

          return new Response(JSON.stringify({
            name: userId,
            mcpUrl: `${origin}/mcp/users/${existingUrlSafeId}`,
            walletAddress,
            urlSafeId: existingUrlSafeId,
            message: walletChanged ? "MCP updated with new wallet address" : "MCP already exists"
          }), { headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
        }

        // Create new user with both mappings
        const userRecord = {
          userId,
          walletAddress,
          urlSafeId,
          createdAt: Date.now(),
          createdBy: "crossmint-auth"
        };

        // Store by original userId
        await env.SECRETS.put(`users:${userId}`, JSON.stringify(userRecord));

        // Store by urlSafeId for reverse lookup
        await env.SECRETS.put(`usersByHash:${urlSafeId}`, JSON.stringify(userRecord));

        const workerHost = request.headers.get("cf-worker");
        const origin = workerHost ? `https://${workerHost}` : new URL(request.url).origin;
        console.log(`✅ User MCP created: ${userId} → ${walletAddress} (${urlSafeId})`);

        return new Response(JSON.stringify({
          name: userId,
          mcpUrl: `${origin}/mcp/users/${urlSafeId}`,
          walletAddress,
          urlSafeId,
          message: "MCP created successfully"
        }), { headers: { "Content-Type": "application/json", ...CORS_HEADERS } });
      } catch (error) {
        console.error("Registration error:", error);
        return new Response(
          JSON.stringify({
            error: "Failed to create MCP",
            message: error instanceof Error ? error.message : String(error)
          }),
          { status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
        );
      }
    }

    // API to create an event (authenticated - only MCP owner)
    if (url.pathname === "/api/users/events" && request.method === "POST") {
      try {
        const body = (await request.json().catch(() => ({} as any))) as Partial<{
          userId: string;
          walletAddress: string;
          title: string;
          description: string;
          date: number;
          capacity: number;
          price: string;
        }>;
        const { userId, walletAddress, title, description, date, capacity, price } = body;

        // Validate input
        if (
          !userId ||
          !walletAddress ||
          !title ||
          !description ||
          !date ||
          capacity === undefined ||
          !price ||
          typeof userId !== "string" ||
          typeof walletAddress !== "string" ||
          typeof title !== "string" ||
          typeof description !== "string" ||
          typeof date !== "number" ||
          typeof capacity !== "number" ||
          typeof price !== "string"
        ) {
          return new Response(
            JSON.stringify({
              error: "Invalid body. Required: userId, walletAddress, title, description, date (timestamp), capacity (number), price (USD string)"
            }),
            { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
          );
        }

        // Verify user exists and wallet matches (authentication)
        const user = await env.SECRETS.get(`users:${userId}`, { type: "json" }) as { walletAddress?: string, urlSafeId?: string } | null;
        if (!user) {
          return new Response(
            JSON.stringify({ error: "User not found. Please register first at /api/users/mcp" }),
            { status: 404, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
          );
        }

        if (user.walletAddress !== walletAddress) {
          return new Response(
            JSON.stringify({ error: "Unauthorized. Wallet address does not match MCP owner." }),
            { status: 403, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
          );
        }

        // Create URL-safe identifier for routing to the correct DO
        const urlSafeId = await hashUserId(userId);

        // Store event directly using the urlSafeId as the key prefix (same as Host DO does)
        const eventId = crypto.randomUUID();
        const eventService = createEventService({ kv: env.SECRETS });
        const stored = await eventService.createEvent({
          userScopeId: urlSafeId,
          title,
          description,
          date,
          capacity,
          price
        });

        console.log(`🎉 Event created for user ${userId}: ${title} (${stored.id})`);
        return new Response(JSON.stringify({
          success: true,
          eventId: stored.id,
          title,
          message: "Event created successfully"
        }), { headers: { "Content-Type": "application/json", ...CORS_HEADERS } });

      } catch (error) {
        console.error("Create event error:", error);
        return new Response(
          JSON.stringify({
            error: "Failed to create event",
            message: error instanceof Error ? error.message : String(error)
          }),
          { status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
        );
      }
    }

    // API to get all events for a user (authenticated - only MCP owner)
    if (url.pathname === "/api/users/events" && request.method === "GET") {
      try {
        const userId = url.searchParams.get("userId");
        const walletAddress = url.searchParams.get("walletAddress");

        if (!userId || !walletAddress) {
          return new Response(
            JSON.stringify({ error: "Missing userId or walletAddress query params" }),
            { status: 400, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
          );
        }

        // Verify user exists and wallet matches (authentication)
        const user = await env.SECRETS.get(`users:${userId}`, { type: "json" }) as { walletAddress?: string, urlSafeId?: string } | null;
        if (!user) {
          return new Response(
            JSON.stringify({ error: "User not found" }),
            { status: 404, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
          );
        }

        if (user.walletAddress !== walletAddress) {
          return new Response(
            JSON.stringify({ error: "Unauthorized" }),
            { status: 403, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
          );
        }

        // Get urlSafeId
        const urlSafeId = await hashUserId(userId);

        // List all events for this user
        const eventService = createEventService({ kv: env.SECRETS });
        const events = await eventService.listEvents({ userScopeId: urlSafeId });
        const eventsWithRevenue = events.map(e => ({
          ...e,
          revenue: (parseFloat(e.price) * e.rsvpCount).toFixed(2)
        }));
        const totalRevenue = eventsWithRevenue.reduce((sum, e: any) => sum + parseFloat(e.revenue), 0).toFixed(2);

        return new Response(JSON.stringify({
          success: true,
          events: eventsWithRevenue,
          totalRevenue
        }), { headers: { "Content-Type": "application/json", ...CORS_HEADERS } });

      } catch (error) {
        console.error("Get events error:", error);
        return new Response(
          JSON.stringify({
            error: "Failed to get events",
            message: error instanceof Error ? error.message : String(error)
          }),
          { status: 500, headers: { "Content-Type": "application/json", ...CORS_HEADERS } }
        );
      }
    }

    // Route all agent requests with CORS enabled (handles OPTIONS)
    return (
      (await routeAgentRequest(request, env, { cors: true })) ||
      (env.ASSETS ? await env.ASSETS.fetch(request) : null) ||
      new Response("Not found", { status: 404 })
    );
  }
} satisfies ExportedHandler<Env>;
