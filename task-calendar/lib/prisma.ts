import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

// Only create new instance in development to prevent connection pool exhaustion
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

