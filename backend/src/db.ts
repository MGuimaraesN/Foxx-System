import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

// Ensure env vars are loaded (if not already by imports)
// In a module, process.env should be populated if dotenv is used at entry point.
// But for safety:
import 'dotenv/config';

const dbPath = process.env.DATABASE_URL?.replace('file:', '') || './dev.db';
const adapter = new PrismaBetterSqlite3({
  url: dbPath
});

export const prisma = new PrismaClient({ adapter });
