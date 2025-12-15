import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis

// Ensure DATABASE_URL is set
const databaseUrl = process.env.DATABASE_URL || 'file:/data/task-calendar.db';
if (!process.env.DATABASE_URL) {
  console.warn('DATABASE_URL not set, using default:', databaseUrl);
  process.env.DATABASE_URL = databaseUrl;
}

// Reuse Prisma client instance to prevent connection pool exhaustion
// This is critical for reducing CPU usage in production
export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
})

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
} else {
  // In production, also cache the instance to prevent multiple connections
  globalForPrisma.prisma = prisma
}
