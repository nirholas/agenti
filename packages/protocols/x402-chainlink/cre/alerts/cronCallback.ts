/**
 * Alert Cron Trigger Handler
 * 
 * This module handles the cron trigger for checking price conditions and sending notifications.
 * It periodically fetches price data from Chainlink feeds, checks rules against current prices,
 * and sends Pushover notifications when conditions are met.
 * 
 * Flow:
 * 1. Fetch current prices for BTC, ETH, LINK
 * 2. Fetch all rules from RuleRegistry contract
 * 3. For each rule, check if condition is met
 * 4. If condition is met, send Pushover notification
 */

import {
  type Runtime,
  getNetwork,
  encodeCallMsg,
  bytesToHex,
  type HTTPSendRequester,
  ok,
  consensusIdenticalAggregation,
} from "@chainlink/cre-sdk";
import {
  type Address,
  encodeFunctionData,
  decodeFunctionResult,
  zeroAddress,
} from "viem";
import { cre } from "@chainlink/cre-sdk";
import type { Config, Rule, PriceData, PostResponse } from "./types";

// ============================================================================
// Contract ABIs
// ============================================================================

/**
 * Chainlink price feed ABI for latestRoundData function
 */
const priceFeedAbi = [
  {
    name: "latestRoundData",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [
      { name: "roundId", type: "uint80" },
      { name: "answer", type: "int256" },
      { name: "startedAt", type: "uint256" },
      { name: "updatedAt", type: "uint256" },
      { name: "answeredInRound", type: "uint80" },
    ],
  },
] as const;

/**
 * RuleRegistry contract ABI
 */
const registryAbi = [
  {
    name: "getAllRules",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "id", type: "bytes32" },
          { name: "asset", type: "string" },
          { name: "condition", type: "string" },
          { name: "targetPriceUsd", type: "uint256" },
          { name: "createdAt", type: "uint256" },
        ],
      },
    ],
  },
  {
    name: "getRuleCount",
    type: "function",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    name: "getRule",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "_ruleId", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "id", type: "bytes32" },
          { name: "asset", type: "string" },
          { name: "condition", type: "string" },
          { name: "targetPriceUsd", type: "uint256" },
          { name: "createdAt", type: "uint256" },
        ],
      },
    ],
  },
] as const;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Fetches latest price data from a Chainlink price feed
 * 
 * @param runtime - CRE runtime context
 * @param evmClient - EVM client for contract calls
 * @param contractAddress - Price feed contract address
 * @returns PriceData structure with latest round data
 */
function getPriceData(
  runtime: Runtime<Config>,
  evmClient: InstanceType<typeof cre.capabilities.EVMClient>,
  contractAddress: Address
): PriceData {
  const callDataFeed = encodeFunctionData({
    abi: priceFeedAbi,
    functionName: "latestRoundData",
    args: [],
  });

  const contractCallFeed = evmClient
    .callContract(runtime, {
      call: encodeCallMsg({
        from: zeroAddress,
        to: contractAddress,
        data: callDataFeed,
      }),
    })
    .result();

  const priceDataTuple = decodeFunctionResult({
    abi: priceFeedAbi,
    functionName: "latestRoundData",
    data: bytesToHex(contractCallFeed.data),
  }) as [bigint, bigint, bigint, bigint, bigint];

  return {
    roundId: priceDataTuple[0],
    answer: priceDataTuple[1],
    startedAt: priceDataTuple[2],
    updatedAt: priceDataTuple[3],
    answeredInRound: priceDataTuple[4],
  };
}

/**
 * Converts condition string to mathematical symbol
 * 
 * @param condition - Condition string (gt, lt, gte, lte)
 * @returns Mathematical symbol (>, <, >=, <=)
 */
function getConditionSymbol(condition: string): string {
  const conditionMap: Record<string, string> = {
    gt: ">",
    gte: ">=",
    lt: "<",
    lte: "<=",
  };
  return conditionMap[condition.toLowerCase()] || condition;
}

/**
 * Checks if a price condition is met
 * 
 * @param currentPrice - Current price in USD
 * @param targetPrice - Target price in USD
 * @param condition - Condition string (gt, lt, gte, lte)
 * @returns true if condition is met, false otherwise
 */
function checkCondition(
  currentPrice: bigint,
  targetPrice: bigint,
  condition: string
): boolean {
  switch (condition) {
    case "gt":
      return currentPrice > targetPrice;
    case "lt":
      return currentPrice < targetPrice;
    case "gte":
      return currentPrice >= targetPrice;
    case "lte":
      return currentPrice <= targetPrice;
    default:
      return false;
  }
}

/**
 * Fetches all rules from the RuleRegistry contract
 * 
 * Attempts to fetch all rules at once via getAllRules(). If that fails,
 * falls back to fetching rules individually via getRule(i).
 * 
 * @param runtime - CRE runtime context
 * @param evmClient - EVM client for contract calls
 * @param registryAddress - RuleRegistry contract address
 * @returns Array of Rule structs
 */
function getAllRules(
  runtime: Runtime<Config>,
  evmClient: InstanceType<typeof cre.capabilities.EVMClient>,
  registryAddress: Address
): Rule[] {
  // Get rule count
  const callDataCount = encodeFunctionData({
    abi: registryAbi,
    functionName: "getRuleCount",
    args: [],
  });

  const contractCallCount = evmClient
    .callContract(runtime, {
      call: encodeCallMsg({
        from: zeroAddress,
        to: registryAddress,
        data: callDataCount,
      }),
    })
    .result();

  const ruleCount = decodeFunctionResult({
    abi: registryAbi,
    functionName: "getRuleCount",
    data: bytesToHex(contractCallCount.data),
  }) as bigint;

  runtime.log(`[Step 2] Found ${ruleCount.toString()} rules on-chain`);

  // Try to fetch all rules at once
  const callData = encodeFunctionData({
    abi: registryAbi,
    functionName: "getAllRules",
    args: [],
  });

  const contractCall = evmClient
    .callContract(runtime, {
      call: encodeCallMsg({
        from: zeroAddress,
        to: registryAddress,
        data: callData,
      }),
    })
    .result();

  const decodedResult = decodeFunctionResult({
    abi: registryAbi,
    functionName: "getAllRules",
    data: bytesToHex(contractCall.data),
  });

  // If getAllRules worked, use it
  if (
    Array.isArray(decodedResult) &&
    decodedResult.length === Number(ruleCount)
  ) {
    return decodedResult as Rule[];
  }

  // Fallback: fetch rules individually
  runtime.log(`[Step 2] Fetching rules individually...`);
  const rules: Rule[] = [];
  for (let i = 0; i < Number(ruleCount); i++) {
    const callDataRule = encodeFunctionData({
      abi: registryAbi,
      functionName: "getRule",
      args: [BigInt(i)],
    });

    const contractCallRule = evmClient
      .callContract(runtime, {
        call: encodeCallMsg({
          from: zeroAddress,
          to: registryAddress,
          data: callDataRule,
        }),
      })
      .result();

    const rule = decodeFunctionResult({
      abi: registryAbi,
      functionName: "getRule",
      data: bytesToHex(contractCallRule.data),
    }) as Rule;

    rules.push(rule);
  }

  return rules;
}

// ============================================================================
// Pushover Notification
// ============================================================================

/**
 * Sends a Pushover notification when a price alert condition is met
 * 
 * @param rule - The rule that triggered the alert
 * @param priceData - Current price data for all assets
 * @param secrets - Pushover API credentials
 * @returns Function that sends the HTTP request
 */
const postPushoverData =
  (rule: Rule, priceData: any, secrets: any) =>
  (sendRequester: HTTPSendRequester, config: Config): PostResponse => {
    const assetKey = rule.asset.toLowerCase() as "btc" | "eth" | "link";
    const assetPriceData = priceData[assetKey];

    if (!assetPriceData || !assetPriceData.answer) {
      throw new Error(`Price data not available for ${rule.asset}`);
    }

    // Chainlink price feeds return price with 8 decimals
    const answerValue =
      typeof assetPriceData.answer === "bigint"
        ? assetPriceData.answer
        : BigInt(assetPriceData.answer.toString());
    const currentPriceUsd = Number(answerValue) / 10 ** 8;
    const targetPriceUsd = Number(rule.targetPriceUsd);

    // Format prices with commas and decimals
    const formattedCurrentPrice = currentPriceUsd.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    const formattedTargetPrice = targetPriceUsd.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    const conditionSymbol = getConditionSymbol(rule.condition);
    const message = `${rule.asset} is now $${formattedCurrentPrice} (alert target: ${conditionSymbol} $${formattedTargetPrice})`;

    const pushoverPayload = {
      token: secrets.pushoverApiKey,
      user: secrets.pushoverUserId,
      message: message,
      title: "CRE PRICE ALERT",
    };

    const bodyBytes = new TextEncoder().encode(JSON.stringify(pushoverPayload));
    const body = Buffer.from(bodyBytes).toString("base64");

    const req = {
      url: "https://api.pushover.net/1/messages.json",
      method: "POST" as const,
      body,
      headers: {
        "Content-Type": "application/json",
      },
      cacheSettings: {
        store: true,
        maxAge: "60s", // Accept cached responses up to 60 seconds old (Duration format: "60s")
      },
    };

    const resp = sendRequester.sendRequest(req).result();

    if (!ok(resp)) {
      throw new Error(
        `Pushover API request failed with status: ${resp.statusCode}`
      );
    }

    const responseText = new TextDecoder().decode(resp.body);
    const responseBody = JSON.parse(responseText);
    if (responseBody.status !== 1) {
      throw new Error(
        `Pushover API returned error: ${JSON.stringify(responseBody)}`
      );
    }

    return { statusCode: resp.statusCode };
  };

// ============================================================================
// Cron Trigger Handler
// ============================================================================

/**
 * Cron trigger handler - runs periodically to check price conditions
 * 
 * Flow:
 * 1. Fetch current prices for BTC, ETH, LINK
 * 2. Fetch all rules from RuleRegistry contract
 * 3. For each rule, check if condition is met
 * 4. If condition is met, send Pushover notification
 * 
 * @param runtime - CRE runtime context
 * @returns Status message
 */
export const onCronTrigger = (runtime: Runtime<Config>): string => {
  runtime.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  runtime.log("CRE Workflow: Cron Trigger");
  runtime.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  // Get Pushover secrets
  const pushoverUserId = runtime.getSecret({ id: "PUSHOVER_USER_KEY" }).result();
  const pushoverApiKey = runtime.getSecret({ id: "PUSHOVER_API_KEY" }).result();

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

  // Step 1: Fetch price data
  runtime.log("\n[Step 1] Fetching price data from Chainlink feeds...");
  const btcPriceData = getPriceData(
    runtime,
    evmClient,
    runtime.config.evms[0].dataFeeds?.BTC as Address
  );
  const ethPriceData = getPriceData(
    runtime,
    evmClient,
    runtime.config.evms[0].dataFeeds?.ETH as Address
  );
  const linkPriceData = getPriceData(
    runtime,
    evmClient,
    runtime.config.evms[0].dataFeeds?.LINK as Address
  );

  const btcPriceUsd = Number(btcPriceData.answer) / 10 ** 8;
  const ethPriceUsd = Number(ethPriceData.answer) / 10 ** 8;
  const linkPriceUsd = Number(linkPriceData.answer) / 10 ** 8;
  runtime.log(`  • BTC: $${btcPriceUsd.toFixed(2)}`);
  runtime.log(`  • ETH: $${ethPriceUsd.toFixed(2)}`);
  runtime.log(`  • LINK: $${linkPriceUsd.toFixed(2)}`);

  // Step 2: Fetch all rules
  const rules = getAllRules(
    runtime,
    evmClient,
    runtime.config.evms[0].ruleRegistryAddress as Address
  );

  if (rules.length === 0) {
    runtime.log("\n[Step 3] No rules to process");
    runtime.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
    return "No rules to process";
  }

  // Step 3: Check conditions and send notifications
  runtime.log(`\n[Step 3] Checking ${rules.length} rules...`);
  const priceData = {
    btc: btcPriceData,
    eth: ethPriceData,
    link: linkPriceData,
  };

  const httpClient = new cre.capabilities.HTTPClient();
  let notificationsSent = 0;
  const currentTimestamp = BigInt(Math.floor(Date.now() / 1000));
  const ruleTTL = BigInt(runtime.config.ruleTTL);

  rules.forEach((rule, index) => {
    // Skip rules older than TTL
    const ruleAge = currentTimestamp - rule.createdAt;
    if (ruleAge > ruleTTL) {
      const ttlMinutes = Number(ruleTTL) / 60;
      runtime.log(
        `  [Rule ${index + 1}] Skipped (older than ${ttlMinutes} minutes)`
      );
      return;
    }

    // Get current price for the asset
    let currentPrice: bigint | null = null;
    if (rule.asset === "BTC") {
      currentPrice = btcPriceData.answer;
    } else if (rule.asset === "ETH") {
      currentPrice = ethPriceData.answer;
    } else if (rule.asset === "LINK") {
      currentPrice = linkPriceData.answer;
    }

    if (currentPrice === null) {
      runtime.log(`  [Rule ${index + 1}] Unknown asset: ${rule.asset}`);
      return;
    }

    // Check condition (Chainlink feeds have 8 decimals)
    const priceInUsd = currentPrice / BigInt(10 ** 8);
    const conditionMet = checkCondition(
      priceInUsd,
      rule.targetPriceUsd,
      rule.condition
    );

    if (conditionMet) {
      runtime.log(
        `  [Rule ${index + 1}] [SUCCESS] Condition met: ${rule.asset} $${priceInUsd.toString()} ${rule.condition} $${rule.targetPriceUsd.toString()}`
      );

      try {
        const result = httpClient
          .sendRequest(
            runtime,
            postPushoverData(rule, priceData, {
              pushoverUserId: pushoverUserId.value,
              pushoverApiKey: pushoverApiKey.value,
            }),
            consensusIdenticalAggregation<PostResponse>()
          )(runtime.config)
          .result();

        runtime.log(`    -> Pushover notification sent (Status: ${result.statusCode})`);
        notificationsSent++;
      } catch (error: any) {
        runtime.log(`    -> [ERROR] Failed to send notification: ${error.message}`);
      }
    } else {
      runtime.log(
        `  [Rule ${index + 1}] Condition not met: ${rule.asset} $${priceInUsd.toString()} ${rule.condition} $${rule.targetPriceUsd.toString()}`
      );
    }
  });

  runtime.log(`\n[Step 4] [SUCCESS] Complete: ${notificationsSent} notification(s) sent`);
  runtime.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  return `Processed ${rules.length} rules, sent ${notificationsSent} notifications`;
};

