# @ag402/solana — SolanaPaymentProvider 设计文档

**日期**：2026-03-11
**状态**：已批准
**作者**：brainstorming session

---

## 概述

实现 `@ag402/solana` npm 包，提供真实 Solana USDC 链上支付的 `PaymentProvider` 实现，供 `@ag402/fetch` 使用。完全对齐 Python 侧 `ag402_core.payment.solana_adapter.SolanaAdapter` 的行为。

---

## 包结构

```
sdk/solana/
├── src/
│   └── index.ts              # 唯一源文件
├── src/__tests__/
│   └── solana-provider.test.ts
├── package.json              # @ag402/solana
├── tsconfig.json
└── vitest.config.ts
```

---

## 对外 API

```typescript
import type { PaymentProvider } from "@ag402/fetch";

export class SolanaPaymentProvider implements PaymentProvider {
  constructor(options: {
    privateKey: string;   // base58，对齐 Python SOLANA_PRIVATE_KEY
    rpcUrl?: string;      // 默认 https://api.devnet.solana.com
    usdcMint?: string;    // 默认 devnet USDC mint
  });

  async pay(challenge: X402PaymentChallenge, requestId: string): Promise<string>;
  getAddress(): string;
}

// 从环境变量构建，对齐 Python config.py
export function fromEnv(options?: { rpcUrl?: string }): SolanaPaymentProvider;
```

---

## 依赖

```json
{
  "dependencies": {
    "@solana/web3.js": "^1.98.0",
    "@solana/spl-token": "^0.4.0"
  },
  "peerDependencies": {
    "@ag402/fetch": "^0.1.0"
  }
}
```

---

## 支付流程

`pay(challenge, requestId)` 内部步骤，完全对齐 Python `solana_adapter.py`：

1. 验证 `challenge.chain === "solana"` && `challenge.token === "USDC"`，否则立即 throw
2. 解析 `amount` 字符串 → u64 lamports（× 1_000_000，USDC 6 位小数）
3. 获取/创建 payer ATA（Associated Token Account）
4. 获取/创建 recipient ATA
5. 构建 `transfer_checked` 指令（SPL Token Program）
6. 附加 Memo 指令，内容：`"Ag402-v1|{requestId}"`（和 Python 完全一致）
7. 签名 → `sendTransaction` → `confirmTransaction("confirmed")`
8. 返回 base58 交易签名作为 `tx_hash`

---

## 默认值

| 参数 | 默认值 |
|------|--------|
| `rpcUrl` | `https://api.devnet.solana.com` |
| `usdcMint` | `4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU`（devnet） |
| confirmationLevel | `"confirmed"` |

Mainnet USDC mint（`EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`）需手动传入。

---

## 错误处理

- `chain !== "solana"` 或 `token !== "USDC"` → 立即 throw，不发起 RPC 请求
- 余额不足、ATA 创建失败、RPC 超时、confirm 失败 → throw Error
- 所有 throw 都会触发 `@ag402/fetch` 的 `rollback_call` 路径
- `fromEnv()` 在 `SOLANA_PRIVATE_KEY` 缺失时抛出清晰错误

---

## 安全

- `getAddress()` 返回值不含 CR/LF/引号（对齐 `@ag402/fetch` 的 `buildAuthorization` 保护）
- 私钥仅在构造时转换为 `Keypair`，不以字符串形式保留
- 不缓存 ATA 地址（由链上 `getOrCreateAssociatedTokenAccount` 处理）

---

## 测试策略（TDD）

框架：Vitest + `vi.mock()`，mock 掉 `@solana/web3.js` 和 `@solana/spl-token`，无需真实 RPC。

### 测试用例

**构造函数**
- 默认 rpcUrl 为 devnet
- 无效 base58 私钥抛出错误

**getAddress()**
- 返回 base58 公钥字符串
- 返回值不含 CR/LF/引号

**pay() — happy path**
- 返回 base58 tx 签名
- Memo 包含 `"Ag402-v1|{requestId}"`
- `transfer_checked` 以正确 lamport 数调用（0.05 USDC → 50_000 lamports）

**pay() — 错误处理**
- `chain !== "solana"` 立即 throw，不调用 RPC
- `token !== "USDC"` 立即 throw
- `sendTransaction` 失败时 throw
- `confirmTransaction` 失败时 throw

**fromEnv()**
- 读取 `SOLANA_PRIVATE_KEY` 环境变量
- 环境变量缺失时抛出清晰错误

---

## 不在范围内（YAGNI）

- 多 token 支持（仅 USDC）
- 离线签名 / 硬件钱包 / HSM
- 自动 SOL 手续费充值
- `finalized` 确认级别
- 私钥加密存储（由调用层负责，如 Python 的 `wallet_encryption.py`）

---

## 与 Python 对齐检查

| 特性 | Python | TypeScript |
|------|--------|------------|
| 私钥格式 | base58 字符串 | base58 字符串 ✓ |
| 环境变量 | `SOLANA_PRIVATE_KEY` | `SOLANA_PRIVATE_KEY` ✓ |
| Memo 格式 | `Ag402-v1\|{request_id}` | `Ag402-v1\|{requestId}` ✓ |
| 确认级别 | `confirmed` | `confirmed` ✓ |
| 默认 RPC | devnet | devnet ✓ |
| 失败行为 | throw | throw ✓ |
