import { Elysia } from "elysia";
import type {
  UptoSessionEntries,
  UptoSession,
  UptoSessionStore,
} from "./store.js";
import { settleUptoSession, type UptoFacilitatorClient } from "./settlement.js";

export interface UptoSweeperLock {
  acquire: () => Promise<boolean>;
  release: () => Promise<void>;
}

export interface UptoSweeperConfig {
  store: UptoSessionStore;
  facilitatorClient: UptoFacilitatorClient;
  idleSettleMs?: number;
  longIdleCloseMs?: number;
  deadlineBufferSec?: number;
  capThresholdNum?: bigint;
  capThresholdDen?: bigint;
  intervalMs?: number;
  settlingTimeoutMs?: number;
  lock?: UptoSweeperLock;
}

async function* toAsyncEntries(
  entries: UptoSessionEntries
): AsyncIterableIterator<[string, UptoSession]> {
  if (Symbol.asyncIterator in entries) {
    for await (const entry of entries as AsyncIterableIterator<
      [string, UptoSession]
    >) {
      yield entry;
    }
    return;
  }

  for (const entry of entries as IterableIterator<[string, UptoSession]>) {
    yield entry;
  }
}

export function createUptoSweeper(config: UptoSweeperConfig) {
  const idleSettleMs = config.idleSettleMs ?? 2 * 60 * 1000;
  const longIdleCloseMs = config.longIdleCloseMs ?? 30 * 60 * 1000;
  const deadlineBufferSec = config.deadlineBufferSec ?? 60;
  const capThresholdNum = config.capThresholdNum ?? 9n;
  const capThresholdDen = config.capThresholdDen ?? 10n;
  const intervalMs = config.intervalMs ?? 30 * 1000;
  const settlingTimeoutMs = config.settlingTimeoutMs ?? 5 * 60 * 1000;

  let interval: NodeJS.Timeout | undefined;
  let isSweepRunning = false;

  const safeSettleUptoSession = (
    id: string,
    reason: string,
    closeAfter: boolean
  ) => {
    void settleUptoSession(
      config.store,
      config.facilitatorClient,
      id,
      reason,
      closeAfter,
      deadlineBufferSec,
      settlingTimeoutMs
    ).catch(async (error) => {
      console.error("Upto sweeper settlement error:", { id, reason, error });
      try {
        const session = await config.store.get(id);
        if (!session) return;
        session.lastSettlement = {
          atMs: Date.now(),
          reason,
          receipt: {
            success: false,
            errorReason:
              error instanceof Error ? error.message : "settlement_failed",
            transaction: "",
            network: session.paymentPayload.accepted.network,
            payer: undefined,
          },
        };
        await config.store.set(id, session);
      } catch (storeError) {
        console.error("Upto sweeper failed to record settlement error:", {
          id,
          reason,
          error: storeError,
        });
      }
    });
  };

  const sweep = async () => {
    if (isSweepRunning) return;
    isSweepRunning = true;
    let lockAcquired = false;
    let sweepError: unknown;
    let releaseError: unknown;

    try {
      if (config.lock) {
        const acquired = await config.lock.acquire();
        if (!acquired) return;
        lockAcquired = true;
      }

      const nowMs = Date.now();
      const nowSec = BigInt(Math.floor(nowMs / 1000));

      for await (const [id, session] of toAsyncEntries(config.store.entries())) {
        const settlingSinceMs = session.settlingSinceMs ?? session.lastActivityMs;
        if (session.status === "settling") {
          const isStale = nowMs - settlingSinceMs >= settlingTimeoutMs;
          if (!isStale) continue;

          safeSettleUptoSession(id, "settling_timeout", false);
          continue;
        }

        const idleMs = nowMs - session.lastActivityMs;
        const timeToDeadline = session.deadline - nowSec;
        const totalOutstanding = session.settledTotal + session.pendingSpent;

        if (session.status === "open" && session.pendingSpent > 0n) {
          if (idleMs >= idleSettleMs) {
            safeSettleUptoSession(id, "idle_timeout", false);
            continue;
          }

          if (timeToDeadline <= BigInt(deadlineBufferSec)) {
            safeSettleUptoSession(id, "deadline_buffer", true);
            continue;
          }

          if (
            totalOutstanding * capThresholdDen >=
            session.cap * capThresholdNum
          ) {
            safeSettleUptoSession(id, "cap_threshold", false);
            continue;
          }
        }

        if (
          idleMs >= longIdleCloseMs ||
          timeToDeadline <= 0n ||
          session.settledTotal >= session.cap
        ) {
          if (session.pendingSpent > 0n && session.status === "open") {
            safeSettleUptoSession(id, "auto_close", true);
          } else {
            session.status = "closed";
            session.settlingSinceMs = undefined;
            await config.store.set(id, session);
            if (idleMs >= longIdleCloseMs) await config.store.delete(id);
          }
        }
      }
    } catch (error) {
      sweepError = error;
    } finally {
      if (config.lock && lockAcquired) {
        try {
          await config.lock.release();
        } catch (error) {
          releaseError = error;
        }
      }
      isSweepRunning = false;
    }

    if (sweepError) {
      throw sweepError;
    }
    if (releaseError) {
      throw releaseError;
    }
  };

  return new Elysia({ name: "upto.sweeper" })
    .onStart(() => {
      interval = setInterval(() => {
        sweep().catch((error) => {
          console.error("Upto sweeper error:", error);
        });
      }, intervalMs);
    })
    .onStop(() => {
      if (interval) clearInterval(interval);
    });
}
