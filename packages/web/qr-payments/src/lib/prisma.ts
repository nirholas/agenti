import { PrismaClient } from '@prisma/client';
import { PrismaSQLiteAdapter } from '@prisma/adapter-sqlite';
import Database from 'better-sqlite3';
import path from 'node:path';

// Create SQLite adapter
function createAdapter() {
  const dbPath = process.env.DATABASE_URL || path.join(process.cwd(), 'prisma', 'dev.db');
  const db = new Database(dbPath.replace('file:', ''));
  return new PrismaSQLiteAdapter(db);
}

// PrismaClient singleton to avoid multiple instances in development
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: createAdapter(),
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
