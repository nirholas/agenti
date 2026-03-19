import { McpAgent } from "agents/mcp";
import type { Connection, ConnectionContext } from "agents";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { withX402, type X402Config } from "agents/x402";
import { z } from "zod";
import type { Env } from "../server";
import { NETWORK, USDC_BASE_SEPOLIA, FACILITATOR_URL } from "../constants";
import { CrossmintWallets, createCrossmint, type Wallet } from "@crossmint/wallets-sdk";
import { createEventService } from "../shared/eventService";

/**
 * Host MCP Server - Provides event creation and paid RSVP functionality
 * Uses Crossmint smart wallet to receive payments
 */
export class Host extends McpAgent<Env, never, { urlSafeId?: string }> {
  wallet!: Wallet<any>;
  server!: ReturnType<typeof withX402>;
  userScopeId!: string; // The actual user ID (urlSafeId) for scoping events
  x402Config!: X402Config; // Store the x402 config for updates

  async onConnect(conn: Connection, ctx: ConnectionContext) {
    // Extract and persist userScopeId from the initial request header
    const scopeId = ctx.request.headers.get("x-user-scope-id");
    if (scopeId) {
      const existingScope = await this.ctx.storage.get<string>("userScopeId");

      // Only store and reinitialize if this is a new/different scope
      if (existingScope !== scopeId) {
        await this.ctx.storage.put("userScopeId", scopeId);
        console.log(`💾 Stored userScopeId from header: ${scopeId}`);

        // Update the userScopeId in memory
        this.userScopeId = scopeId;
        console.log(`✅ Updated runtime userScopeId to: ${scopeId}`);
      }
    }

    // IMPORTANT: Always refresh the recipient address from KV on every connection
    // This ensures we use the latest wallet address if it was updated
    await this.refreshRecipientAddress();

    return super.onConnect(conn, ctx);
  }

  private async refreshRecipientAddress() {
    try {
      const userJson = await this.env.SECRETS.get(`usersByHash:${this.userScopeId}`);

      if (userJson) {
        const parsed = JSON.parse(userJson);
        if (parsed?.walletAddress && /^0x[a-fA-F0-9]{40}$/.test(parsed.walletAddress)) {
          const newRecipient = parsed.walletAddress as `0x${string}`;

          // Check if recipient has changed
          if (this.x402Config.recipient !== newRecipient) {
            console.log(`🔄 Recipient address changed!`);
            console.log(`  Old: ${this.x402Config.recipient}`);
            console.log(`  New: ${newRecipient}`);

            // Update the config
            this.x402Config.recipient = newRecipient;

            // Recreate the server with updated config
            await this.rebuildServerWithNewRecipient();
          } else {
            console.log(`✅ Recipient address unchanged: ${newRecipient}`);
          }
        }
      }
    } catch (err) {
      console.error("❌ Error refreshing recipient address:", err);
    }
  }

  private async rebuildServerWithNewRecipient() {
    console.log(`🔨 Rebuilding MCP server with new recipient...`);

    // Create a new base MCP server
    const baseServer = new McpServer({ name: "Event RSVP MCP", version: "1.0.0" });

    // Wrap with x402 using updated config
    this.server = withX402(baseServer, this.x402Config);

    // Re-register all tools
    await this.registerTools();

    console.log(`✅ MCP server rebuilt with new recipient: ${this.x402Config.recipient}`);
  }

  private async registerTools() {
    const eventService = createEventService({ kv: this.env.SECRETS });

    // Free tool: createEvent (authenticated owner only - called via API, not directly)
    this.server.tool(
      "createEvent",
      "Create a new event. Returns event ID.",
      {
        title: z.string().describe("Event title"),
        description: z.string().describe("Event description"),
        date: z.number().describe("Event date (Unix timestamp)"),
        capacity: z.number().describe("Max RSVPs (0 = unlimited)"),
        price: z.string().describe("Price in USD (e.g., '0.05')")
      },
      async ({ title, description, date, capacity, price }) => {
        const event = await eventService.createEvent({
          userScopeId: this.userScopeId,
          title,
          description,
          date,
          capacity,
          price
        });

        console.log(`✅ Event created by ${this.userScopeId}: ${event.id} for $${price}`);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              eventId: event.id,
              title: event.title,
              date: new Date(event.date).toISOString(),
              price: event.price,
              capacity: event.capacity,
              owner: this.userScopeId,
              message: `Event created! ID: ${event.id}. RSVP costs $${price}.`
            }, null, 2)
          }]
        };
      }
    );

    // Free tool: getAllEvents
    this.server.tool(
      "getAllEvents",
      "List all events (shows event details and RSVP counts)",
      {},
      async () => {
        const eventList = await eventService.listEvents({ userScopeId: this.userScopeId });

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              events: eventList,
              count: eventList.length,
              message: eventList.length > 0
                ? `Found ${eventList.length} event(s)`
                : "No events created yet"
            }, null, 2)
          }]
        };
      }
    );

    // Paid tool: rsvpToEvent
    this.server.paidTool(
      "rsvpToEvent",
      "RSVP to an event. Requires payment via x402.",
      0.05, // USD (will be overridden by event price dynamically)
      {
        eventId: z.string().describe("The event ID to RSVP to"),
        walletAddress: z.string().describe("Guest wallet address")
      },
      {},
      async ({ eventId, walletAddress }) => {
        const result = await eventService.rsvpToEvent({
          userScopeId: this.userScopeId,
          eventId,
          walletAddress
        });

        if (!result.success) {
          return {
            isError: true,
            content: [{
              type: "text",
              text: JSON.stringify({
                error: result.error,
                message: result.error
              })
            }]
          };
        }

        console.log(`🎉 RSVP created for event ${eventId} by ${walletAddress}`);

        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              success: true,
              eventId: eventId,
              eventTitle: result.event?.title,
              rsvpCount: result.event?.rsvpCount,
              message: `RSVP successful! You're registered for "${result.event?.title}".`
            }, null, 2)
          }]
        };
      }
    );
  }

  async init() {
    console.log("🏠 Host MCP Server initializing...");
    console.log(`📝 DO instance name: ${this.name}`);

    // IMPORTANT: For MCP streamable-http, the first request includes the x-user-scope-id header
    // but init() is called BEFORE onConnect, so we can't rely on storage here.
    // We'll initialize with a placeholder and update in onConnect
    let userScopeId = await this.ctx.storage.get<string>("userScopeId");

    if (!userScopeId) {
      // Use a temporary placeholder - will be updated in onConnect
      userScopeId = "pending";
      console.log(`⚠️ No userScopeId in storage yet; using placeholder (will be set on connection)`);
    } else {
      console.log(`✅ Using userScopeId from storage: ${userScopeId}`);
    }

    this.userScopeId = userScopeId;

    // Resolve x402 recipient per user
    let recipient: `0x${string}` | null = null;
    try {
      const userJson = await this.env.SECRETS.get(`usersByHash:${this.userScopeId}`);
      console.log(`🔍 Looking up user: usersByHash:${this.userScopeId}`, userJson ? "✅ Found" : "❌ Not found");

      if (userJson) {
        const parsed = JSON.parse(userJson);
        if (parsed?.walletAddress && /^0x[a-fA-F0-9]{40}$/.test(parsed.walletAddress)) {
          recipient = parsed.walletAddress as `0x${string}`;
          console.log(`💼 Using per-user recipient: ${recipient}`);
        }
      }
    } catch (err) {
      console.error("Error looking up user:", err);
    }

    // If no recipient found, create and store host wallet
    if (!recipient) {
      console.log("🔧 No host wallet found, creating new wallet...");

      const crossmint = createCrossmint({
        apiKey: this.env.CROSSMINT_API_KEY
      });
      const crossmintWallets = CrossmintWallets.from(crossmint);

      this.wallet = await crossmintWallets.createWallet({
        chain: "base-sepolia",
        signer: { type: "api-key" },
        owner: `userId:crossmint-merchant-host:${this.userScopeId}`
      });

      recipient = this.wallet.address as `0x${string}`;

      // Store wallet address in KV using userScopeId
      await this.env.SECRETS.put(
        `usersByHash:${this.userScopeId}`,
        JSON.stringify({ walletAddress: recipient, userId: this.userScopeId })
      );

      console.log(`💰 Host wallet created and stored: ${recipient}`);
    }

    // Store x402 config for later updates
    this.x402Config = {
      network: NETWORK,
      recipient,
      facilitator: { url: FACILITATOR_URL }
    };

    // Initialize MCP server with x402 payment support
    this.server = withX402(
      new McpServer({
        name: "Event RSVP MCP",
        version: "1.0.0"
      }),
      this.x402Config
    );

    console.log("✅ MCP Server created with x402 support");

    // Register all tools
    await this.registerTools();

    console.log("✅ Host MCP Server initialized with tools:");
    console.log("   - createEvent (free)");
    console.log("   - getAllEvents (free)");
    console.log("   - rsvpToEvent (paid: $0.05)");
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // CRITICAL: Extract userScopeId from header on EVERY request
    // This ensures we have the correct scope even on the first MCP connection
    const scopeId = request.headers.get("x-user-scope-id");
    if (scopeId && scopeId !== this.userScopeId) {
      console.log(`🔄 Updating userScopeId from ${this.userScopeId} to ${scopeId}`);
      this.userScopeId = scopeId;
      await this.ctx.storage.put("userScopeId", scopeId);
    }

    // For all requests (including WebSocket upgrades for MCP), delegate to parent Agent
    return super.fetch(request);
  }
}
