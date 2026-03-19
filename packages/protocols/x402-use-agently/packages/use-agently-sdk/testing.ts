import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import {
  X402FacilitatorLocalContainer,
  type StartedX402FacilitatorLocalContainer,
  accounts,
} from "x402-fl/testcontainers";
import { AixyzTesting } from "localhost-aixyz/test";

export const TEST_PRIVATE_KEY = generatePrivateKey();
export const TEST_ADDRESS = privateKeyToAccount(TEST_PRIVATE_KEY).address;

export interface X402FacilitatorLocal {
  container: StartedX402FacilitatorLocalContainer;
  agent: AixyzTesting;
}

export interface X402FacilitatorLocalOptions {
  fundAmount?: string;
  fundAddress?: `0x${string}`;
  network?: string;
  payTo?: string;
}

export async function startX402FacilitatorLocal(options?: X402FacilitatorLocalOptions): Promise<X402FacilitatorLocal> {
  const container = await new X402FacilitatorLocalContainer().start();
  await container.fund((options?.fundAddress ?? TEST_ADDRESS) as `0x${string}`, options?.fundAmount ?? "100");
  const agent = new AixyzTesting();
  await agent.start({
    env: {
      X402_FACILITATOR_URL: container.getFacilitatorUrl(),
      X402_PAY_TO: options?.payTo ?? accounts.facilitator.address,
      X402_NETWORK: options?.network ?? "eip155:8453",
    },
  });
  return { container, agent };
}

export async function stopX402FacilitatorLocal(fixture: X402FacilitatorLocal): Promise<void> {
  try {
    await fixture.agent.stop();
  } catch (e) {
    console.error("Error stopping agent server:", e);
  }
  try {
    await fixture.container.stop();
  } catch (e) {
    console.error("Error stopping facilitator container:", e);
  }
}

export function testWalletConfig(rpcUrl?: string) {
  return {
    type: "evm-private-key" as const,
    privateKey: TEST_PRIVATE_KEY,
    address: TEST_ADDRESS,
    ...(rpcUrl ? { rpcUrl } : {}),
  };
}
