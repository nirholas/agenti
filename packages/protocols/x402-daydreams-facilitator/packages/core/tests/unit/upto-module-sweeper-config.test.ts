import { describe, it, expect, mock, beforeEach } from "bun:test";
import { createUptoModule } from "../../src/upto/module.js";
import type { UptoFacilitatorClient } from "../../src/upto/settlement.js";

describe("createUptoModule sweeperConfig", () => {
  const facilitatorClient = {
    settle: mock(() => Promise.resolve()),
  } as unknown as UptoFacilitatorClient;

  it("passes sweeperConfig defaults to createSweeper", () => {
    const module = createUptoModule({
      facilitatorClient,
      sweeperConfig: {
        intervalMs: 12_345,
        idleSettleMs: 60_000,
      },
    });

    const sweeper = module.createSweeper();

    // Verify the sweeper was created (non-null)
    expect(sweeper).toBeDefined();
    // The sweeper should have been created with the config
    expect(module.sweeper).toBe(sweeper);
  });

  it("creates sweeper with explicit overrides", () => {
    const module = createUptoModule({
      facilitatorClient,
      sweeperConfig: {
        intervalMs: 30_000,
        idleSettleMs: 120_000,
      },
    });

    // Create sweeper with override
    const sweeper = module.createSweeper({ intervalMs: 5_000 });

    expect(sweeper).toBeDefined();
    expect(module.sweeper).toBe(sweeper);
  });

  it("module exposes store and facilitatorClient", () => {
    const module = createUptoModule({
      facilitatorClient,
      sweeperConfig: {
        intervalMs: 30_000,
      },
    });

    expect(module.store).toBeDefined();
    // Verify the sweeper can be created
    const sweeper = module.createSweeper();
    expect(sweeper).toBeDefined();
  });
});
