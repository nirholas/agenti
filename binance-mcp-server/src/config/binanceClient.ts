// src/config/binanceClient.ts
import { Spot } from "@binance/spot";
import { SimpleEarn } from "@binance/simple-earn";
import { Algo } from "@binance/algo";
import { C2C } from "@binance/c2c";
import { Convert } from "@binance/convert";
import { Wallet } from "@binance/wallet";
import { CopyTrading } from "@binance/copy-trading";
import { Fiat } from "@binance/fiat";
import { NFT } from "@binance/nft";
import { Pay } from "@binance/pay";
import { Rebate } from "@binance/rebate";
import { DualInvestment } from "@binance/dual-investment";
import { Mining } from "@binance/mining";
import { VipLoan } from "@binance/vip-loan";
import { Staking } from "@binance/staking";

const API_KEY = process.env.BINANCE_API_KEY;
const API_SECRET = process.env.BINANCE_API_SECRET;
const BASE_URL = "https://api.binance.com";

const configurationRestAPI = {
    apiKey: API_KEY ?? "",
    apiSecret: API_SECRET ?? "",
    basePath: BASE_URL ?? ""
};

export const spotClient = new Spot({ configurationRestAPI });
export const algoClient = new Algo({ configurationRestAPI });
export const simpleEarnClient = new SimpleEarn({ configurationRestAPI });
export const c2cClient = new C2C({ configurationRestAPI });
export const convertClient = new Convert({ configurationRestAPI });
export const walletClient = new Wallet({ configurationRestAPI });
export const copyTradingClient = new CopyTrading({ configurationRestAPI });
export const fiatClient = new Fiat({ configurationRestAPI });
export const nftClient = new NFT({ configurationRestAPI });
export const payClient = new Pay({ configurationRestAPI });
export const rebateClient = new Rebate({ configurationRestAPI });
export const dualInvestmentClient = new DualInvestment({ configurationRestAPI });
export const miningClient = new Mining({ configurationRestAPI });
export const vipLoanClient = new VipLoan({ configurationRestAPI });
export const stakingClient = new Staking({ configurationRestAPI });
