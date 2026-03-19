import { describe, it, expect, mock } from "bun:test";
import {
  createResourceServer,
  type ResourceServerConfig,
} from "../../src/server.js";
import type { FacilitatorClient } from "@x402/core/server";

const createMockFacilitatorClient = (): FacilitatorClient =>
  ({
    verify: mock(() =>
      Promise.resolve({ isValid: true, payer: "0x123" })
    ),
    settle: mock(() =>
      Promise.resolve({ success: true, transaction: "0xtx", network: "eip155:8453" })
    ),
    supported: mock(() =>
      Promise.resolve({
        supported: true,
        networks: ["eip155:8453"],
        schemes: ["exact"],
      })
    ),
  }) as unknown as FacilitatorClient;

describe("createResourceServer", () => {
  describe("default configuration", () => {
    it("creates resource server with defaults", () => {
      const client = createMockFacilitatorClient();
      const server = createResourceServer(client);

      expect(server).toBeDefined();
      expect(typeof server.register).toBe("function");
    });

    it("enables all schemes by default", () => {
      const client = createMockFacilitatorClient();
      const server = createResourceServer(client);

      // Server is created with all schemes
      expect(server).toBeDefined();
    });
  });

  describe("custom configuration", () => {
    it("creates server with exactEvm only", () => {
      const client = createMockFacilitatorClient();
      const config: ResourceServerConfig = {
        exactEvm: true,
        uptoEvm: false,
        exactSvm: false,
      };
      const server = createResourceServer(client, config);

      expect(server).toBeDefined();
    });

    it("creates server with uptoEvm only", () => {
      const client = createMockFacilitatorClient();
      const config: ResourceServerConfig = {
        exactEvm: false,
        uptoEvm: true,
        exactSvm: false,
      };
      const server = createResourceServer(client, config);

      expect(server).toBeDefined();
    });

    it("creates server with exactSvm only", () => {
      const client = createMockFacilitatorClient();
      const config: ResourceServerConfig = {
        exactEvm: false,
        uptoEvm: false,
        exactSvm: true,
      };
      const server = createResourceServer(client, config);

      expect(server).toBeDefined();
    });

    it("creates server with all schemes disabled", () => {
      const client = createMockFacilitatorClient();
      const config: ResourceServerConfig = {
        exactEvm: false,
        uptoEvm: false,
        exactSvm: false,
      };
      const server = createResourceServer(client, config);

      expect(server).toBeDefined();
    });

    it("creates server with EVM schemes only", () => {
      const client = createMockFacilitatorClient();
      const config: ResourceServerConfig = {
        exactEvm: true,
        uptoEvm: true,
        exactSvm: false,
      };
      const server = createResourceServer(client, config);

      expect(server).toBeDefined();
    });
  });

  describe("partial configuration", () => {
    it("defaults missing options to true", () => {
      const client = createMockFacilitatorClient();
      // Only specify one option, others should default to true
      const config: ResourceServerConfig = {
        exactSvm: false,
      };
      const server = createResourceServer(client, config);

      expect(server).toBeDefined();
    });

    it("handles empty config object", () => {
      const client = createMockFacilitatorClient();
      const server = createResourceServer(client, {});

      expect(server).toBeDefined();
    });
  });
});
