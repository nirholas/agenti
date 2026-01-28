import { PrismaClient } from '@prisma/client';
import { PrismaLibSQL } from '@prisma/adapter-libsql';
import { createClient } from '@libsql/client';

// Create LibSQL client for local SQLite or Turso
const libsql = createClient({
  url: process.env.DATABASE_URL || 'file:./prisma/dev.db',
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

// Create adapter
const adapter = new PrismaLibSQL(libsql);

// PrismaClient singleton to avoid multiple instances in development
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
