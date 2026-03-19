import { describe, expect, it } from "bun:test";
import { Elysia } from "elysia";
import { createBearerTokenModule } from "../src/modules/bearer-token.js";

describe("createBearerTokenModule", () => {
  it("allows a protected route with a valid bearer token", async () => {
    const app = new Elysia()
      .use(
        createBearerTokenModule({
          tokens: ["DREAMS"],
          protectedPaths: ["/verify"],
        })
      )
      .post("/verify", () => ({ ok: true }));

    const response = await app.handle(
      new Request("http://localhost/verify", {
        method: "POST",
        headers: {
          Authorization: "Bearer DREAMS",
        },
      })
    );

    expect(response.status).toBe(200);
  });

  it("does not require auth for unprotected routes", async () => {
    const app = new Elysia()
      .use(
        createBearerTokenModule({
          tokens: ["DREAMS"],
          protectedPaths: ["/verify"],
        })
      )
      .get("/supported", () => ({ ok: true }));

    const response = await app.handle(
      new Request("http://localhost/supported", {
        method: "GET",
      })
    );

    expect(response.status).toBe(200);
  });

  it("rejects invalid bearer tokens for protected routes", async () => {
    const app = new Elysia()
      .use(
        createBearerTokenModule({
          tokens: ["DREAMS"],
          protectedPaths: ["/settle"],
        })
      )
      .post("/settle", () => ({ ok: true }));

    const response = await app.handle(
      new Request("http://localhost/settle", {
        method: "POST",
        headers: {
          Authorization: "Bearer NOPE",
        },
      })
    );

    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toBe(
      'Bearer realm="facilitator"'
    );
  });
});
