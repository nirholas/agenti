import { describe, it, expect, mock } from "bun:test";
import { createUptoModule } from "../../src/upto/module.js";
import { InMemoryUptoSessionStore } from "../../src/upto/store.js";
import type { UptoFacilitatorClient } from "../../src/upto/settlement.js";

describe("createUptoModule", () => {
  const facilitatorClient = {
    settle: mock(() => Promise.resolve()),
  } as unknown as UptoFacilitatorClient;

  it("does not create a sweeper by default", () => {
    const module = createUptoModule({ facilitatorClient });

    expect(module.sweeper).toBeUndefined();
  });

  it("defaults autoSweeper to false without sweeper config", () => {
    const module = createUptoModule({ facilitatorClient });

    expect(module.autoSweeper).toBe(false);
  });

  it("defaults autoTrack to true", () => {
    const module = createUptoModule({ facilitatorClient });

    expect(module.autoTrack).toBe(true);
  });

  it("does not auto-enable autoSweeper when sweeper config is provided", () => {
    const module = createUptoModule({
      facilitatorClient,
      sweeperConfig: { intervalMs: 30_000 },
    });

    expect(module.autoSweeper).toBe(false);
  });

  it("respects explicit autoTrack overrides", () => {
    const module = createUptoModule({
      facilitatorClient,
      autoTrack: false,
    });

    expect(module.autoTrack).toBe(false);
  });

  it("respects explicit autoSweeper overrides", () => {
    const module = createUptoModule({
      facilitatorClient,
      sweeperConfig: { intervalMs: 30_000 },
      autoSweeper: false,
    });

    expect(module.autoSweeper).toBe(false);
  });

  it("enables autoSweeper when explicitly set", () => {
    const module = createUptoModule({
      facilitatorClient,
      autoSweeper: true,
    });

    expect(module.autoSweeper).toBe(true);
  });

  it("reuses the sweeper instance when created", () => {
    const module = createUptoModule({ facilitatorClient });

    const sweeper = module.createSweeper();
    const second = module.createSweeper();

    expect(sweeper).toBe(second);
    expect(module.sweeper).toBe(sweeper);
  });

  it("uses the provided session store", () => {
    const store = new InMemoryUptoSessionStore();
    const module = createUptoModule({ facilitatorClient, store });

    expect(module.store).toBe(store);
  });
});
