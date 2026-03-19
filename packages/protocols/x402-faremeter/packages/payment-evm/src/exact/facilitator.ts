import type {
  x402PaymentRequirements,
  x402PaymentPayload,
  x402SettleResponse,
  x402VerifyResponse,
  x402SupportedKind,
} from "@faremeter/types/x402v2";

import { isPrivateKey, type ChainInfoWithRPC } from "@faremeter/types/evm";
import { type FacilitatorHandler } from "@faremeter/types/facilitator";

import { type } from "arktype";
import type { Hex, Account, Transport } from "viem";
import {
  createPublicClient,
  createWalletClient,
  http,
  verifyTypedData,
  encodeFunctionData,
  isAddress,
  defineChain,
} from "viem";

import { privateKeyToAccount } from "viem/accounts";

import {
  lookupX402Network,
  findAssetInfo,
  type AssetNameOrContractInfo,
} from "@faremeter/info/evm";

import {
  X402_EXACT_SCHEME,
  TRANSFER_WITH_AUTHORIZATION_ABI,
  EIP712_TYPES,
  x402ExactPayload,
} from "./constants";

import {
  generateMatcher,
  generateDomain,
  generateForwarderDomain,
} from "./common";

function parseSignature(signature: string): { v: number; r: Hex; s: Hex } {
  const sig = signature.slice(2); // Remove 0x
  const r = `0x${sig.slice(0, 64)}` as const;
  const s = `0x${sig.slice(64, 128)}` as const;
  const v = parseInt(sig.slice(128, 130), 16);
  return { v, r, s };
}

type CreateFacilitatorHandlerOpts = {
  network?: string;
  transport?: Transport;
};

/**
 * Creates a facilitator handler for the EVM exact payment scheme.
 *
 * The handler verifies EIP-3009 authorization signatures and executes
 * the transferWithAuthorization call on the token contract.
 *
 * @param chain - Chain configuration including RPC URLs
 * @param privateKey - Private key for signing settlement transactions
 * @param assetNameOrInfo - Asset name or contract info for the token
 * @param opts - Optional configuration for network and transport
 * @returns A FacilitatorHandler for processing EVM exact payments
 */
export async function createFacilitatorHandler(
  chain: ChainInfoWithRPC,
  privateKey: string,
  assetNameOrInfo: AssetNameOrContractInfo,
  opts: CreateFacilitatorHandlerOpts = {},
): Promise<FacilitatorHandler> {
  if (!isPrivateKey(privateKey)) {
    throw new Error(`Invalid private key: ${privateKey}`);
  }

  const network = opts.network ?? lookupX402Network(chain.id);

  const chainId = chain.id;

  const assetInfo = findAssetInfo(network, assetNameOrInfo);

  const asset = assetInfo.address;

  const useForwarder =
    assetInfo.forwarder !== undefined && assetInfo.forwarderName !== undefined;

  if (!isAddress(asset)) {
    throw new Error(`Invalid asset address: ${asset}`);
  }

  const transport = opts.transport ?? http(chain.rpcUrls.default.http[0]);
  const account = privateKeyToAccount(privateKey);

  const publicClient = createPublicClient({
    transport,
  });

  // XXX - Temporarily work around typing problems related to trying to have a chain be null.
  const ersatzChain = defineChain({
    ...chain,
    nativeCurrency: {
      decimals: 0,
      name: "",
      symbol: "",
    },
  });

  const walletClient = createWalletClient({
    chain: defineChain(ersatzChain),
    account,
    transport,
  });

  let domain: {
    name: string;
    version: string;
    chainId: number;
    verifyingContract: `0x${string}`;
  };

  if (useForwarder) {
    if (!assetInfo.forwarder) {
      throw new Error("Missing Forwarding Contract");
    }
    if (!assetInfo.forwarderVersion) {
      throw new Error("Missing Forwarding Version");
    }
    if (!assetInfo.forwarderName) {
      throw new Error("Missing Forwarding Name");
    }
    domain = generateForwarderDomain(chainId, {
      version: assetInfo.forwarderVersion,
      name: assetInfo.forwarderName,
      verifyingContract: assetInfo.forwarder,
    });
  } else {
    domain = await generateDomain(publicClient, chainId, asset);
    if (domain.name != assetInfo.contractName) {
      throw new Error(
        `On chain contract name (${domain.name}) doesn't match configured asset name (${assetInfo.contractName})`,
      );
    }
  }

  const { isMatchingRequirement } = generateMatcher(network, asset);

  const getSupported = (): Promise<x402SupportedKind>[] => {
    return [
      Promise.resolve({
        x402Version: 2,
        network,
        scheme: X402_EXACT_SCHEME,
      }),
    ];
  };

  const getRequirements = async ({
    accepts: req,
  }: {
    accepts: x402PaymentRequirements[];
  }): Promise<x402PaymentRequirements[]> => {
    return req.filter(isMatchingRequirement).map((x) => ({
      ...x,
      asset,
      maxTimeoutSeconds: 300,
      // Provide EIP-712 domain parameters for client signing
      extra: {
        name: useForwarder ? assetInfo.forwarderName : assetInfo.contractName,
        version: useForwarder ? assetInfo.forwarderVersion : "2",
        chainId,
        verifyingContract: useForwarder ? assetInfo.forwarder : asset,
      },
    }));
  };

  const verifyTransaction = async (
    requirements: x402PaymentRequirements,
    payment: x402PaymentPayload,
  ) => {
    const errorResponse = (error: string) => ({ error });

    // For the exact scheme with EIP-3009, validate the authorization payload
    const payloadResult = x402ExactPayload(payment.payload);
    if (payloadResult instanceof type.errors) {
      return errorResponse(`Invalid payload: ${payloadResult.summary}`);
    }

    const { authorization, signature } = payloadResult;

    // Check if the payment is to the correct address
    if (authorization.to.toLowerCase() !== requirements.payTo.toLowerCase()) {
      return errorResponse("Payment authorized to wrong address");
    }

    // Check if the amount matches
    if (authorization.value !== requirements.amount) {
      return errorResponse("Incorrect payment amount");
    }

    // Check if the authorization is still valid (time-wise)
    const now = Math.floor(Date.now() / 1000);
    const validAfter = parseInt(authorization.validAfter);
    const validBefore = parseInt(authorization.validBefore);

    if (now < validAfter) {
      return errorResponse("Authorization not yet valid");
    }

    if (now > validBefore) {
      return errorResponse("Authorization expired");
    }

    // Verify the from address is valid
    if (!isAddress(authorization.from)) {
      return errorResponse("Invalid from address");
    }

    // Check on-chain nonce status
    let onChainUsed: boolean;
    try {
      onChainUsed = await publicClient.readContract({
        address: assetInfo.forwarder ?? asset,
        abi: TRANSFER_WITH_AUTHORIZATION_ABI,
        functionName: "authorizationState",
        args: [authorization.from, authorization.nonce],
      });
    } catch (error) {
      throw new Error("Failed to check authorization status", { cause: error });
    }

    if (onChainUsed) {
      return errorResponse("Authorization already used on-chain");
    }

    let domain: {
      name: string;
      version: string;
      verifyingContract: `0x${string}`;
      chainId: number;
    };
    if (useForwarder) {
      if (
        !assetInfo.forwarderVersion ||
        !assetInfo.forwarderName ||
        !assetInfo.forwarder
      ) {
        throw new Error("Secondary Forwarding Information Missing");
      }

      domain = generateForwarderDomain(chainId, {
        version: assetInfo.forwarderVersion,
        name: assetInfo.forwarderName,
        verifyingContract: assetInfo.forwarder,
      });
    } else {
      domain = await generateDomain(publicClient, chainId, asset);
    }

    const types = EIP712_TYPES;

    const message = {
      from: authorization.from,
      to: authorization.to,
      value: BigInt(authorization.value),
      validAfter: BigInt(validAfter),
      validBefore: BigInt(validBefore),
      nonce: authorization.nonce,
    };

    // Verify the signature
    let isValidSignature: boolean;
    try {
      isValidSignature = await verifyTypedData({
        address: authorization.from,
        domain,
        types,
        primaryType: "TransferWithAuthorization",
        message,
        signature: signature,
      });
    } catch (cause) {
      throw new Error("Signature verification failed", { cause });
    }

    if (!isValidSignature) {
      return errorResponse("Invalid signature");
    }

    return {
      authorization,
      signature,
      validAfter,
      validBefore,
    };
  };

  const handleVerify = async (
    requirements: x402PaymentRequirements,
    payment: x402PaymentPayload,
  ): Promise<x402VerifyResponse | null> => {
    if (!isMatchingRequirement(requirements)) {
      return null; // Not for us, let another handler try
    }

    const verifyResult = await verifyTransaction(requirements, payment);

    if ("error" in verifyResult) {
      return { isValid: false, invalidReason: verifyResult.error };
    }

    return { isValid: true };
  };

  const handleSettle = async (
    requirements: x402PaymentRequirements,
    payment: x402PaymentPayload,
  ): Promise<x402SettleResponse | null> => {
    if (!isMatchingRequirement(requirements)) {
      return null; // Not for us, let another handler try
    }

    const errorResponse = (msg: string): x402SettleResponse => {
      return {
        success: false,
        errorReason: msg,
        transaction: "",
        network: requirements.network,
      };
    };

    const verifyResult = await verifyTransaction(requirements, payment);

    if ("error" in verifyResult) {
      return errorResponse(verifyResult.error);
    }

    const { authorization, signature, validAfter, validBefore } = verifyResult;

    // Verify contract supports EIP-712
    try {
      await publicClient.readContract({
        address: useForwarder ? domain.verifyingContract : asset,
        abi: TRANSFER_WITH_AUTHORIZATION_ABI,
        functionName: "DOMAIN_SEPARATOR",
      });
    } catch (cause) {
      throw new Error("Contract does not support EIP-712", { cause });
    }

    const acct: Account | undefined = walletClient.account;
    if (!acct || acct.type !== "local") {
      return errorResponse(
        "Wallet client is not configured with a local account",
      );
    }

    const { v, r, s } = parseSignature(signature);

    const data = encodeFunctionData({
      abi: TRANSFER_WITH_AUTHORIZATION_ABI,
      functionName: "transferWithAuthorization",
      args: [
        authorization.from,
        authorization.to,
        BigInt(authorization.value),
        BigInt(validAfter),
        BigInt(validBefore),
        authorization.nonce,
        v,
        r,
        s,
      ],
    });

    // Build and send the transaction
    try {
      const request = await walletClient.prepareTransactionRequest({
        to: useForwarder ? domain.verifyingContract : asset,
        data,
        account: acct,
      });

      const serializedTransaction = await walletClient.signTransaction(request);

      const txHash = await publicClient.sendRawTransaction({
        serializedTransaction,
      });

      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
      });

      if (receipt.status !== "success") {
        return errorResponse("Transaction failed");
      }

      return {
        success: true,
        transaction: txHash,
        network: payment.accepted.network,
      };
    } catch (cause) {
      throw new Error("Transaction execution failed", { cause });
    }
  };

  return {
    getSupported,
    getRequirements,
    handleVerify,
    handleSettle,
  };
}
