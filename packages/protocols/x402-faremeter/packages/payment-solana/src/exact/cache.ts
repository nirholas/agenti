import type { Signature } from "@solana/kit";

export class TransactionStore {
  private maxAge: number;
  private sigToBlock: Map<Signature, number>;
  private highestBlock: number;

  constructor(maxAge = 150) {
    this.maxAge = maxAge;
    this.sigToBlock = new Map();
    this.highestBlock = 0;
  }

  add(signature: Signature, blockHeight: number): void {
    if (blockHeight > this.highestBlock) {
      this.highestBlock = blockHeight;
      this.prune();
    }

    this.sigToBlock.set(signature, blockHeight);
  }

  has(signature: Signature): boolean {
    return this.sigToBlock.has(signature);
  }

  private prune(): void {
    const cutoff = this.highestBlock - this.maxAge;
    for (const [sig, height] of this.sigToBlock) {
      if (height < cutoff) {
        this.sigToBlock.delete(sig);
      }
    }
  }

  get size() {
    return this.sigToBlock.size;
  }
}
