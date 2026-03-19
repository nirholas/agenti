// PinionClient -- main entry point for calling pinion skills

import { ethers } from "ethers";
import { PINION_API_URL } from "../shared/constants.js";
import { PaymentError, ConfigError } from "../shared/errors.js";
import { signX402Payment, parsePaymentRequirements } from "./x402.js";
import { SkillMethods } from "./skills.js";
import type { PinionConfig, SkillResponse } from "./types.js";

export class PinionClient {
    private wallet: ethers.Wallet;
    private apiUrl: string;
    private network: string;
    private _apiKey: string | undefined;
    readonly skills: SkillMethods;

    constructor(config: PinionConfig) {
        if (!config.privateKey) {
            throw new ConfigError("privateKey is required");
        }

        this.wallet = new ethers.Wallet(config.privateKey);
        this.apiUrl = (config.apiUrl || PINION_API_URL).replace(/\/$/, "");
        this.network = config.network || "base";
        this._apiKey = config.apiKey;
        this.skills = new SkillMethods(this);
    }

    get address(): string {
        return this.wallet.address;
    }

    /** Base URL for the skill server (used by SkillMethods for free endpoints). */
    get baseUrl(): string {
        return this.apiUrl;
    }

    /** Access the underlying ethers Wallet (for advanced use like x402 generic calls). */
    get signer(): ethers.Wallet {
        return this.wallet;
    }

    /** Set an unlimited API key for bypassing x402 payments. */
    setApiKey(key: string): void {
        this._apiKey = key;
    }

    /**
     * Make a request to a pinion endpoint.
     * If an API key is configured, sends it as X-API-KEY (skips x402).
     * Otherwise handles the 402 -> sign -> retry flow automatically.
     */
    async request<T = any>(
        method: string,
        path: string,
        body?: any,
    ): Promise<SkillResponse<T>> {
        const url = `${this.apiUrl}${path}`;
        const start = Date.now();

        const headers: Record<string, string> = {
            "Content-Type": "application/json",
            Accept: "application/json",
        };

        if (this._apiKey) {
            headers["X-API-KEY"] = this._apiKey;
        }

        const opts: RequestInit = { method, headers };
        if (body && method === "POST") {
            opts.body = JSON.stringify(body);
        }

        // with API key: direct request (no x402 flow)
        if (this._apiKey) {
            const res = await fetch(url, opts);
            const data = await res.json().catch(() => ({
                error: "non-json response",
            }));
            return {
                status: res.status,
                data,
                paidAmount: "0",
                responseTimeMs: Date.now() - start,
            };
        }

        // first request -- expect 402
        const initial = await fetch(url, opts);

        if (initial.status !== 402) {
            const data = await initial.json().catch(() => ({
                error: "non-json response",
            }));
            return {
                status: initial.status,
                data,
                paidAmount: "0",
                responseTimeMs: Date.now() - start,
            };
        }

        // parse payment requirements
        const reqBody = await initial.json();
        const { requirements, x402Version } =
            parsePaymentRequirements(reqBody);

        // sign payment
        const paymentHeader = await signX402Payment(
            this.wallet,
            requirements,
            x402Version,
        );

        // retry with payment
        const paidHeaders: Record<string, string> = {
            ...headers,
            "X-PAYMENT": paymentHeader,
        };

        const paidOpts: RequestInit = { method, headers: paidHeaders };
        if (body && method === "POST") {
            paidOpts.body = JSON.stringify(body);
        }

        const paid = await fetch(url, paidOpts);
        const data = await paid.json().catch(() => ({
            error: "non-json response",
        }));

        return {
            status: paid.status,
            data,
            paidAmount: requirements.maxAmountRequired,
            responseTimeMs: Date.now() - start,
        };
    }
}