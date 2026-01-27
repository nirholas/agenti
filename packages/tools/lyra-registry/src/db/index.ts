import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

// Create a singleton connection
let db: ReturnType<typeof createDb> | null = null;

function createDb() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL environment variable is not set');
  }
  
  const sql = neon(process.env.DATABASE_URL);
  return drizzle(sql, { schema });
}

export function getDb() {
  if (!db) {
    db = createDb();
  }
  return db;
}

export { schema };
export type Database = ReturnType<typeof getDb>;
