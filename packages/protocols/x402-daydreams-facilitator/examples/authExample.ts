/**
 * Example: Bearer Token Authentication
 *
 * This example demonstrates how to use the bearer token authentication
 * system with the x402 facilitator.
 */

import { Elysia } from "elysia";
import { createAuthPlugin } from "@daydreamsai/facilitator/auth/elysia";
import {
  InMemoryTokenStorage,
  InMemoryRateLimiter,
  InMemoryUsageTracker,
} from "@daydreamsai/facilitator/auth";

// Create storage instances
const storage = new InMemoryTokenStorage();
const rateLimiter = new InMemoryRateLimiter();
const tracker = new InMemoryUsageTracker();

// Create some test tokens
async function setupTokens() {
  // Free tier token
  const freeToken = await storage.createToken(
    {
      name: "Free Tier User",
      tier: "free",
      requestsPerMinute: 10,
      requestsPerDay: 100,
    },
    "test"
  );

  // Pro tier token
  const proToken = await storage.createToken(
    {
      name: "Pro Tier User",
      userId: "user-123",
      tier: "pro",
      requestsPerMinute: 100,
      requestsPerDay: 10000,
      metadata: {
        company: "ACME Inc",
        plan: "professional",
      },
    },
    "live"
  );

  console.log("🔑 Test Tokens Created:");
  console.log("\nFree Tier:");
  console.log(`  Token: ${freeToken.token}`);
  console.log(
    `  Rate Limits: ${freeToken.requestsPerMinute}/min, ${freeToken.requestsPerDay}/day`
  );

  console.log("\nPro Tier:");
  console.log(`  Token: ${proToken.token}`);
  console.log(
    `  Rate Limits: ${proToken.requestsPerMinute}/min, ${proToken.requestsPerDay}/day`
  );
  console.log(`  User ID: ${proToken.userId}`);
  console.log("");

  return { freeToken, proToken };
}

// Create Elysia app with auth
const app = new Elysia()
  .use(
    createAuthPlugin({
      enabled: true,
      storage,
      rateLimiter,
      tracker,
    })
  )
  .get("/", () => ({
    message: "Bearer Token Authentication Example",
    endpoints: {
      "/protected": "Protected endpoint (requires auth)",
      "/user": "Returns user context",
      "/admin": "Admin endpoint (checks tier)",
    },
  }))
  .get("/protected", ({ auth }) => {
    return {
      message: "You have access!",
      tokenId: auth?.tokenId,
      tier: auth?.tier,
    };
  })
  .get("/user", ({ auth }) => {
    if (!auth) {
      return { error: "Not authenticated" };
    }

    return {
      userId: auth.userId,
      tier: auth.tier,
      metadata: auth.metadata,
    };
  })
  .get("/admin", ({ auth, set }) => {
    if (!auth) {
      set.status = 401;
      return { error: "Not authenticated" };
    }

    if (auth.tier !== "pro" && auth.tier !== "enterprise") {
      set.status = 403;
      return { error: "Insufficient permissions. Pro tier required." };
    }

    return {
      message: "Welcome to admin panel",
      tier: auth.tier,
    };
  })
  .listen(3001);

console.log(`🚀 Server running at http://localhost:${app.server?.port}`);

// Setup tokens and print usage instructions
setupTokens().then(({ freeToken, proToken }) => {
  console.log("📖 Usage Examples:");
  console.log("\n1. Access protected endpoint (Free tier):");
  console.log(
    `   curl -H "Authorization: Bearer ${freeToken.token}" http://localhost:3001/protected`
  );

  console.log("\n2. Get user info (Pro tier):");
  console.log(
    `   curl -H "Authorization: Bearer ${proToken.token}" http://localhost:3001/user`
  );

  console.log("\n3. Access admin (Pro tier - allowed):");
  console.log(
    `   curl -H "Authorization: Bearer ${proToken.token}" http://localhost:3001/admin`
  );

  console.log("\n4. Access admin (Free tier - denied):");
  console.log(
    `   curl -H "Authorization: Bearer ${freeToken.token}" http://localhost:3001/admin`
  );

  console.log("\n5. No token (401):");
  console.log(`   curl http://localhost:3001/protected`);

  console.log("\n6. Invalid token (401):");
  console.log(
    `   curl -H "Authorization: Bearer fac_test_invalidtoken123456789abc" http://localhost:3001/protected`
  );

  console.log("\n");
});
