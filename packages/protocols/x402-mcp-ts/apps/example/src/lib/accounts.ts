import { type LocalAccount, toAccount } from "viem/accounts";
import { CdpClient } from "@coinbase/cdp-sdk";
import { base, baseSepolia } from "viem/chains";
import { createPublicClient, http } from "viem";
import { env } from "./env";
import {
	createKeyPairSignerFromBytes,
	getBase58Encoder,
	type KeyPairSigner,
} from "@solana/kit";

const cdp = new CdpClient();

const chainMap = {
	"base-sepolia": baseSepolia,
	base: base,
} as const;

const publicClient = createPublicClient({
	chain: chainMap[env.EVM_NETWORK],
	transport: http(),
});

// Type-safe overloads for getOrCreatePurchaserAccount
export async function getOrCreatePurchaserAccount(type: "evm"): Promise<LocalAccount>;
export async function getOrCreatePurchaserAccount(type: "svm"): Promise<KeyPairSigner>;
/**
 * Get or create a purchaser account for the given type
 * @param type - The type of account to get or create
 * @returns The account
 */
export async function getOrCreatePurchaserAccount(type: "evm" | "svm"): Promise<LocalAccount | KeyPairSigner> {
	if (type === "evm") {
		return getOrCreatePurchaserAccountEvm();
	} else {
		return getOrCreatePurchaserAccountSvm();
	}
}

export async function getOrCreatePurchaserAccountEvm(): Promise<LocalAccount> {
	const account = await cdp.evm.getOrCreateAccount({
		name: "Purchaser",
	});
	const balances = await account.listTokenBalances({
		network: env.EVM_NETWORK,
	});

	const usdcBalance = balances.balances.find(
		(balance) => balance.token.symbol === "USDC",
	);

	// if under $0.50 while on testnet, request more
	if (
		env.EVM_NETWORK === "base-sepolia" &&
		(!usdcBalance || Number(usdcBalance.amount) < 500000)
	) {
		const { transactionHash } = await cdp.evm.requestFaucet({
			address: account.address,
			network: env.EVM_NETWORK,
			token: "usdc",
		});
		const tx = await publicClient.waitForTransactionReceipt({
			hash: transactionHash,
		});
		if (tx.status !== "success") {
			throw new Error("Failed to recieve funds from faucet");
		}
	}

	return toAccount(account);
}

export async function getOrCreatePurchaserAccountSvm(): Promise<KeyPairSigner> {
	const account = await createKeyPairSignerFromBytes(
		getBase58Encoder().encode(env.KEYPAIR_SECRET),
	);
	return account;
}

export async function getOrCreateSellerAccount(): Promise<
	LocalAccount | KeyPairSigner
> {
	if (env.KEYPAIR_SECRET === "") {
		const account = await cdp.evm.getOrCreateAccount({
			name: "Seller",
		});
		return toAccount(account);
	} else {
		const account = await createKeyPairSignerFromBytes(
			getBase58Encoder().encode(env.KEYPAIR_SECRET),
		);
		return account;
	}
}
