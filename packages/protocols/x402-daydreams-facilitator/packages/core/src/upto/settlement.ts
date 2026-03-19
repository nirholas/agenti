import type {
  PaymentPayload,
  PaymentRequirements,
  SettleResponse,
} from "@x402/core/types";
import type { UptoSessionStore } from "./store.js";

export type UptoFacilitatorClient = {
  settle: (
    paymentPayload: PaymentPayload,
    paymentRequirements: PaymentRequirements
  ) => Promise<SettleResponse>;
};

export async function settleUptoSession(
  store: UptoSessionStore,
  facilitatorClient: UptoFacilitatorClient,
  sessionId: string,
  reason: string,
  closeAfter = false,
  deadlineBufferSec = 60,
  settlingTimeoutMs = 5 * 60 * 1000
) {
  const session = await store.get(sessionId);
  if (!session) return;
  if (session.status === "settling") {
    const settlingSinceMs = session.settlingSinceMs ?? session.lastActivityMs;
    const isStale = Date.now() - settlingSinceMs >= settlingTimeoutMs;
    if (!isStale) return;
  }
  const initialStatus = session.status === "settling" ? "open" : session.status;

  if (session.pendingSpent <= 0n) {
    if (closeAfter) {
      session.status = "closed";
    } else if (session.status === "settling") {
      session.status = "open";
    }
    session.settlingSinceMs = undefined;
    await store.set(sessionId, session);
    return;
  }

  session.status = "settling";
  session.settlingSinceMs = Date.now();
  await store.set(sessionId, session);

  const settleAmount = session.pendingSpent;
  const settleRequirements: PaymentRequirements = {
    ...session.paymentRequirements,
    amount: settleAmount.toString(),
  };

  let receipt: SettleResponse;
  try {
    receipt = await facilitatorClient.settle(
      session.paymentPayload,
      settleRequirements
    );
  } catch (error) {
    receipt = {
      success: false,
      errorReason: error instanceof Error ? error.message : "settlement_failed",
      transaction: "",
      network: session.paymentPayload.accepted.network,
      payer: undefined,
    };
  }

  if (receipt.success) {
    session.settledTotal += settleAmount;
    session.pendingSpent = 0n;
  }

  session.lastSettlement = {
    atMs: Date.now(),
    reason,
    receipt,
  };

  const nowSec = BigInt(Math.floor(Date.now() / 1000));
  if (receipt.success) {
    if (
      closeAfter ||
      session.settledTotal >= session.cap ||
      session.deadline <= nowSec + BigInt(deadlineBufferSec)
    ) {
      session.status = "closed";
    } else {
      session.status = "open";
    }
  } else {
    // If settlement failed, keep the session retryable.
    // - On manual close: mark closed (stop accrual) but allow re-close retries.
    // - Otherwise: restore prior status.
    session.status = closeAfter ? "closed" : initialStatus;
  }

  session.settlingSinceMs = undefined;

  await store.set(sessionId, session);
}
