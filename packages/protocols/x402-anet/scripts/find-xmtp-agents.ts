import Database from 'better-sqlite3';
import path from 'path';

const db = new Database(path.join(process.env.HOME!, '.anet', 'agent-index.db3'));

const rows = db.prepare(
  "SELECT agent_id, name, xmtp_address FROM agents WHERE xmtp_address IS NOT NULL AND xmtp_address != '' LIMIT 10"
).all() as any[];

console.log('Agents with XMTP addresses:');
for (const r of rows) {
  console.log(`  [${r.agent_id}] ${r.name || 'Unknown'} — ${r.xmtp_address}`);
}

const count = (db.prepare(
  "SELECT count(*) as c FROM agents WHERE xmtp_address IS NOT NULL AND xmtp_address != ''"
).get() as any).c;
console.log(`\nTotal with XMTP: ${count}`);

db.close();
