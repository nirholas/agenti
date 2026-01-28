import path from 'node:path';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  earlyAccess: true,
  schema: path.join(__dirname, 'prisma', 'schema.prisma'),

  migrate: {
    async adapter() {
      const { PrismaSQLiteAdapter } = await import('@prisma/adapter-sqlite');
      const Database = (await import('better-sqlite3')).default;
      const db = new Database(path.join(__dirname, 'prisma', 'dev.db'));
      return new PrismaSQLiteAdapter(db);
    },
  },
});
