import Database from 'better-sqlite3';

export interface AgentRecord {
  agent_id: number;
  wallet_address: string;
  agent_uri: string;
  name: string | null;
  description: string | null;
  capabilities: string[];
  xmtp_address: string | null;
  http_endpoint: string | null;
  payment_address: string | null;
  reputation: number;
  feedback_count: number;
  last_updated: number | null;
  indexed_at: number;
}

export class AgentIndexer {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.initSchema();
  }

  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS agents (
        agent_id INTEGER PRIMARY KEY,
        wallet_address TEXT NOT NULL,
        agent_uri TEXT NOT NULL,
        name TEXT,
        description TEXT,
        capabilities TEXT DEFAULT '[]',
        xmtp_address TEXT,
        http_endpoint TEXT,
        payment_address TEXT,
        reputation REAL DEFAULT 0,
        feedback_count INTEGER DEFAULT 0,
        last_updated INTEGER,
        indexed_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_capabilities ON agents(capabilities);
      CREATE INDEX IF NOT EXISTS idx_reputation ON agents(reputation DESC);
      CREATE INDEX IF NOT EXISTS idx_wallet ON agents(wallet_address);

      CREATE TABLE IF NOT EXISTS sync_state (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `);
  }

  indexAgent(agentId: number, metadata: any, reputation: number = 0): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO agents (
        agent_id, wallet_address, agent_uri, name, description,
        capabilities, xmtp_address, http_endpoint, payment_address,
        reputation, indexed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      agentId,
      metadata.paymentAddress || '',
      metadata.agentURI || '',
      metadata.name || null,
      metadata.description || null,
      JSON.stringify(metadata.capabilities || []),
      metadata.endpoints?.xmtp || null,
      metadata.endpoints?.http || null,
      metadata.paymentAddress || null,
      reputation,
      Date.now()
    );
  }

  getAgent(agentId: number): AgentRecord | undefined {
    const row = this.db.prepare('SELECT * FROM agents WHERE agent_id = ?').get(agentId) as any;
    if (!row) return undefined;
    return { ...row, capabilities: JSON.parse(row.capabilities) };
  }

  removeAgent(agentId: number): void {
    this.db.prepare('DELETE FROM agents WHERE agent_id = ?').run(agentId);
  }

  searchAgents(params: {
    capability?: string;
    minReputation?: number;
    limit?: number;
  }): AgentRecord[] {
    let query = 'SELECT * FROM agents WHERE 1=1';
    const bindings: any[] = [];

    if (params.capability) {
      query += ' AND capabilities LIKE ?';
      bindings.push(`%${params.capability}%`);
    }
    if (params.minReputation !== undefined) {
      query += ' AND reputation >= ?';
      bindings.push(params.minReputation);
    }
    query += ' ORDER BY reputation DESC';
    if (params.limit) {
      query += ' LIMIT ?';
      bindings.push(params.limit);
    }

    const rows = this.db.prepare(query).all(...bindings) as any[];
    return rows.map(row => ({ ...row, capabilities: JSON.parse(row.capabilities) }));
  }

  getTopAgents(limit: number = 10): AgentRecord[] {
    return this.searchAgents({ limit });
  }

  getAgentCount(): number {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM agents').get() as any;
    return row.count;
  }

  isCacheStale(network: string, ttlMs: number = 3600_000): boolean {
    const lastSync = this.getSyncState(`lastSyncTime_${network}`);
    if (!lastSync) return true;
    return (Date.now() - parseInt(lastSync)) > ttlMs;
  }

  setSyncState(key: string, value: string): void {
    this.db.prepare('INSERT OR REPLACE INTO sync_state (key, value) VALUES (?, ?)').run(key, value);
  }

  getSyncState(key: string): string | undefined {
    const row = this.db.prepare('SELECT value FROM sync_state WHERE key = ?').get(key) as any;
    return row?.value;
  }

  close(): void {
    this.db.close();
  }
}
