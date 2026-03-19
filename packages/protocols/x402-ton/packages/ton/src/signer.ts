import { Cell } from '@ton/core';
import { mnemonicToPrivateKey, sign, KeyPair } from '@ton/crypto';
import { WalletContractV5R1 } from '@ton/ton';

/** Unified TON wallet signer. Derives keys from a BIP-39 mnemonic. */
export class TonSigner {
  private readonly mnemonic: string[];
  private keyPair: KeyPair | null = null;

  /** @param mnemonic BIP-39 mnemonic word array (typically 24 words) */
  constructor(mnemonic: string[]) {
    this.mnemonic = mnemonic;
  }

  async init(): Promise<void> {
    this.keyPair = await mnemonicToPrivateKey(this.mnemonic);
  }

  private ensureInitialized(): KeyPair {
    if (!this.keyPair) {
      throw new Error('Signer not initialized. Call init() first.');
    }
    return this.keyPair;
  }

  getPublicKey(): string {
    const kp = this.ensureInitialized();
    return kp.publicKey.toString('hex');
  }

  // walletVersion param kept for call-site compatibility but always uses v5r1
  getAddress(_walletVersion?: string): string {
    const contract = this.getWalletContract();
    return `${contract.address.workChain}:${contract.address.hash.toString('hex')}`;
  }

  // walletVersion param kept for call-site compatibility but always uses v5r1
  getWalletContract(_walletVersion?: string): WalletContractV5R1 {
    const kp = this.ensureInitialized();
    return WalletContractV5R1.create({
      workchain: 0,
      publicKey: kp.publicKey,
    });
  }

  /**
   * @deprecated Use signTransfer() instead. Direct secret key access will be removed in v2.
   * Returns the raw Ed25519 secret key buffer. Prefer signTransfer() to avoid key exposure.
   */
  getSecretKey(): Buffer {
    const kp = this.ensureInitialized();
    return kp.secretKey;
  }

  /**
   * Create a signed W5 v5r1 transfer cell. Encapsulates secret key usage.
   * @param params Transfer parameters (seqno, messages, sendMode, timeout, authType)
   * @returns Signed transfer Cell
   */
  signTransfer(params: {
    seqno: number;
    messages: import('@ton/core').MessageRelaxed[];
    sendMode: number;
    timeout: number;
    authType?: 'internal';
  }): import('@ton/core').Cell {
    const kp = this.ensureInitialized();
    const walletContract = this.getWalletContract();
    return walletContract.createTransfer({
      ...params,
      secretKey: kp.secretKey,
    });
  }

  async sign(cell: Cell): Promise<Buffer> {
    const kp = this.ensureInitialized();
    return sign(cell.hash(), kp.secretKey);
  }
}

/** @deprecated Use TonSigner directly. Kept for backward compatibility. */
export const ClientTonSigner = TonSigner;
/** @deprecated Use TonSigner directly. Kept for backward compatibility. */
export const FacilitatorTonSigner = TonSigner;
