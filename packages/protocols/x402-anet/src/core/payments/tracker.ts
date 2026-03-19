import fs from 'fs';
import path from 'path';

export interface PaymentRecord {
  timestamp: string;
  service: string;
  amount: string;
  currency: string;
  txHash?: string;
  agentId?: string;
  direction: 'sent' | 'received';
}

export class PaymentTracker {
  private filePath: string;

  constructor(filePath?: string) {
    this.filePath = filePath || path.join(process.cwd(), 'payment-history.jsonl');
  }

  track(record: PaymentRecord): void {
    const line = JSON.stringify({ ...record, timestamp: record.timestamp || new Date().toISOString() });
    fs.appendFileSync(this.filePath, line + '\n');
  }

  getHistory(filters?: {
    direction?: 'sent' | 'received';
    service?: string;
    since?: string;
  }): PaymentRecord[] {
    if (!fs.existsSync(this.filePath)) return [];

    const lines = fs.readFileSync(this.filePath, 'utf8').trim().split('\n').filter(Boolean);
    let records = lines.map(line => JSON.parse(line) as PaymentRecord);

    if (filters?.direction) {
      records = records.filter(r => r.direction === filters.direction);
    }
    if (filters?.service) {
      records = records.filter(r => r.service.includes(filters.service!));
    }
    if (filters?.since) {
      records = records.filter(r => r.timestamp >= filters.since!);
    }

    return records;
  }

  getSummary(): {
    totalSent: number;
    totalReceived: number;
    byService: Record<string, number>;
  } {
    const records = this.getHistory();
    const summary = { totalSent: 0, totalReceived: 0, byService: {} as Record<string, number> };

    for (const r of records) {
      const amount = parseFloat(r.amount);
      if (r.direction === 'sent') summary.totalSent += amount;
      else summary.totalReceived += amount;
      summary.byService[r.service] = (summary.byService[r.service] || 0) + amount;
    }

    return summary;
  }
}
