/**
 * EVM HTTP Trigger Handler
 * 
 * This module handles the HTTP trigger for writing alert data on-chain.
 * It receives alert data from server and writes it to the RuleRegistry contract
 * using Chainlink CRE reports.
 * 
 * Flow:
 * 1. Decode alert data from HTTP payload
 * 2. Encode alert data for CRE report
 * 3. Generate CRE report
 * 4. Write report to RuleRegistry contract
 */

import {
  type Runtime,
  type HTTPPayload,
  getNetwork,
  hexToBase64,
  bytesToHex,
  TxStatus,
  encodeCallMsg,
  decodeJson,
} from "@chainlink/cre-sdk";
import {
  encodeAbiParameters,
  parseAbiParameters,
} from "viem";
import { cre } from "@chainlink/cre-sdk";
import type { Config } from "./types";

/**
 * HTTP trigger handler - receives alert data and writes it on-chain
 * 
 * Flow:
 * 1. Decode alert data from HTTP payload
 * 2. Encode alert data for CRE report
 * 3. Generate CRE report
 * 4. Write report to RuleRegistry contract
 * 
 * @param runtime - CRE runtime context
 * @param payload - HTTP request payload
 * @returns Transaction hash on success
 */
export const onHttpTrigger = (
  runtime: Runtime<Config>,
  payload: HTTPPayload
): string => {
  if (!payload.input || payload.input.length === 0) {
    return "Empty request";
  }

  runtime.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  runtime.log("CRE Workflow: HTTP Trigger");
  runtime.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  const inputData = decodeJson(payload.input);
  runtime.log(`[Step 1] Received alert data: ${JSON.stringify(inputData)}`);

  // Get network and EVM client
  const network = getNetwork({
    chainFamily: "evm",
    chainSelectorName: runtime.config.evms[0].chainSelectorName,
    isTestnet: true,
  });

  if (!network) {
    throw new Error(`Network not found`);
  }

  const evmClient = new cre.capabilities.EVMClient(
    network.chainSelector.selector
  );

  const alert = {
    id: inputData.id,
    asset: inputData.asset,
    condition: inputData.condition,
    targetPriceUsd: inputData.targetPriceUsd,
    createdAt: inputData.createdAt,
  };

  // Ensure ID has 0x prefix for bytes32
  const idBytes32 = alert.id.startsWith("0x") ? alert.id : `0x${alert.id}`;

  runtime.log(`[Step 2] Encoding alert data for on-chain write...`);

  // Encode alert data as ABI parameters
  const reportData = encodeAbiParameters(
    parseAbiParameters(
      "bytes32 id, string asset, string condition, uint256 targetPriceUsd, uint256 createdAt"
    ),
    [idBytes32, alert.asset, alert.condition, alert.targetPriceUsd, alert.createdAt]
  );

  // Generate CRE report
  runtime.log(`[Step 3] Generating CRE report...`);
  const reportResponse = runtime
    .report({
      encodedPayload: hexToBase64(reportData),
      encoderName: "evm",
      signingAlgo: "ecdsa",
      hashingAlgo: "keccak256",
    })
    .result();

  // Write report to RuleRegistry contract
  runtime.log(
    `[Step 4] Writing to RuleRegistry contract: ${runtime.config.evms[0].ruleRegistryAddress}`
  );
  const writeResult = evmClient
    .writeReport(runtime, {
      receiver: runtime.config.evms[0].ruleRegistryAddress,
      report: reportResponse,
      gasConfig: {
        gasLimit: runtime.config.evms[0].gasLimit,
      },
    })
    .result();

  if (writeResult.txStatus === TxStatus.SUCCESS) {
    const txHash = bytesToHex(writeResult.txHash || new Uint8Array(32));
    runtime.log(`[Step 5] [SUCCESS] Transaction successful: ${txHash}`);
    runtime.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    return txHash;
  }

  throw new Error(
    `Transaction failed with status: ${writeResult.txStatus}`
  );
};

