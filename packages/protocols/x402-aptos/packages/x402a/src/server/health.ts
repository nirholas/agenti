import { Aptos } from "@aptos-labs/ts-sdk";
import { getAptosConfig } from "../utils/aptos";
import { createLogger } from "../utils/logger";

const logger = createLogger({ component: "HealthCheck" });

interface LedgerInfo {
  chain_id: number;
  ledger_version: string;
  ledger_timestamp: string;
  [key: string]: unknown;
}

interface ModuleAbi {
  name: string;
  [key: string]: unknown;
}

interface AccountModule {
  abi?: ModuleAbi;
  [key: string]: unknown;
}

export interface HealthCheckResult {
  /** Overall health status */
  healthy: boolean;
  /** Timestamp of check */
  timestamp: string;
  /** Individual component statuses */
  checks: {
    /** Blockchain connection status */
    blockchain: HealthStatus;
    /** Smart contract availability */
    contract: HealthStatus;
    /** Facilitator wallet balance (optional) */
    wallet?: HealthStatus;
  };
  /** System version info */
  version?: {
    x402aVersion: string;
    aptosNetwork: string;
  };
}

export interface HealthStatus {
  /** Whether this component is healthy */
  healthy: boolean;
  /** Human-readable status message */
  message: string;
  /** Response time in milliseconds */
  responseTime?: number;
  /** Additional details (optional) */
  details?: Record<string, unknown>;
}

export interface HealthCheckConfig {
  /** Aptos network URL or network name */
  network: string;
  /** Smart contract address to check */
  contractAddress: string;
  /** Facilitator address (optional, for balance check) */
  facilitatorAddress?: string;
  /** Minimum balance threshold in octas (optional) */
  minBalanceOctas?: string;
  /** Timeout for each check in ms (default: 5000) */
  timeout?: number;
}

export async function performHealthCheck(config: HealthCheckConfig): Promise<HealthCheckResult> {
  const startTime = Date.now();
  const timeout = config.timeout || 5000;

  logger.info({ network: config.network }, "Starting health check");

  const aptos = new Aptos(getAptosConfig(config.network));

  const [blockchainCheck, contractCheck, walletCheck] = await Promise.all([
    checkBlockchain(aptos, timeout),
    checkContract(aptos, config.contractAddress, timeout),
    config.facilitatorAddress
      ? checkWallet(aptos, config.facilitatorAddress, config.minBalanceOctas, timeout)
      : Promise.resolve(null),
  ]);

  const healthy =
    blockchainCheck.healthy && contractCheck.healthy && (walletCheck ? walletCheck.healthy : true);

  const result: HealthCheckResult = {
    healthy,
    timestamp: new Date().toISOString(),
    checks: {
      blockchain: blockchainCheck,
      contract: contractCheck,
      ...(walletCheck && { wallet: walletCheck }),
    },
    version: {
      x402aVersion: "1.0.0",
      aptosNetwork: config.network,
    },
  };

  const totalTime = Date.now() - startTime;
  logger.info(
    {
      healthy,
      totalTime,
      blockchainHealthy: blockchainCheck.healthy,
      contractHealthy: contractCheck.healthy,
      walletHealthy: walletCheck?.healthy,
    },
    "Health check completed"
  );

  return result;
}

async function checkBlockchain(aptos: Aptos, timeout: number): Promise<HealthStatus> {
  const startTime = Date.now();

  try {
    const ledgerInfo = (await Promise.race([
      aptos.getLedgerInfo(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Blockchain check timeout")), timeout)
      ),
    ])) as LedgerInfo;

    const responseTime = Date.now() - startTime;

    logger.debug({ responseTime }, "Blockchain check passed");

    return {
      healthy: true,
      message: "Blockchain connection healthy",
      responseTime,
      details: {
        chainId: ledgerInfo.chain_id,
        ledgerVersion: ledgerInfo.ledger_version,
      },
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const message = error instanceof Error ? error.message : "Unknown blockchain error";

    logger.error({ error: message, responseTime }, "Blockchain check failed");

    return {
      healthy: false,
      message: `Blockchain connection failed: ${message}`,
      responseTime,
    };
  }
}

async function checkContract(
  aptos: Aptos,
  contractAddress: string,
  timeout: number
): Promise<HealthStatus> {
  const startTime = Date.now();

  try {
    const modules = (await Promise.race([
      aptos.getAccountModules({ accountAddress: contractAddress }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Contract check timeout")), timeout)
      ),
    ])) as AccountModule[];

    const responseTime = Date.now() - startTime;

    const hasX402Module = modules.some((mod) => mod.abi?.name === "x402_transfer");

    if (!hasX402Module) {
      logger.warn({ contractAddress }, "x402_transfer module not found");
      return {
        healthy: false,
        message: "x402_transfer module not found in contract",
        responseTime,
      };
    }

    logger.debug({ responseTime, contractAddress }, "Contract check passed");

    return {
      healthy: true,
      message: "Smart contract available",
      responseTime,
      details: {
        moduleCount: modules.length,
      },
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const message = error instanceof Error ? error.message : "Unknown contract error";

    logger.error({ error: message, responseTime, contractAddress }, "Contract check failed");

    return {
      healthy: false,
      message: `Smart contract check failed: ${message}`,
      responseTime,
    };
  }
}

async function checkWallet(
  aptos: Aptos,
  facilitatorAddress: string,
  minBalanceOctas: string | undefined,
  timeout: number
): Promise<HealthStatus> {
  const startTime = Date.now();

  try {
    const balance = (await Promise.race([
      aptos.getAccountAPTAmount({ accountAddress: facilitatorAddress }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Wallet check timeout")), timeout)
      ),
    ])) as number;

    const responseTime = Date.now() - startTime;

    if (minBalanceOctas) {
      const minBalance = BigInt(minBalanceOctas);
      const currentBalance = BigInt(balance);

      if (currentBalance < minBalance) {
        logger.warn(
          {
            currentBalance: currentBalance.toString(),
            minBalance: minBalance.toString(),
            responseTime,
          },
          "Wallet balance below threshold"
        );

        return {
          healthy: false,
          message: "Wallet balance below minimum threshold",
          responseTime,
          details: {
            balance: currentBalance.toString(),
            minBalance: minBalance.toString(),
            balanceAPT: Number(currentBalance) / 100_000_000,
          },
        };
      }
    }

    logger.debug(
      {
        balance: balance.toString(),
        responseTime,
      },
      "Wallet check passed"
    );

    return {
      healthy: true,
      message: "Wallet balance sufficient",
      responseTime,
      details: {
        balance: balance.toString(),
        balanceAPT: Number(balance) / 100_000_000,
      },
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;
    const message = error instanceof Error ? error.message : "Unknown wallet error";

    logger.error({ error: message, responseTime, facilitatorAddress }, "Wallet check failed");

    return {
      healthy: false,
      message: `Wallet check failed: ${message}`,
      responseTime,
    };
  }
}

export function createHealthHandler(config: HealthCheckConfig) {
  return async function handler() {
    const result = await performHealthCheck(config);

    const statusCode = result.healthy ? 200 : 503;

    return new Response(JSON.stringify(result, null, 2), {
      status: statusCode,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  };
}
