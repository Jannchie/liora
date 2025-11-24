import { join } from 'node:path'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import { PrismaClient } from '../../app/generated/prisma/client'
import 'dotenv/config'

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

function createPrismaClient(): PrismaClient {
  const rawUrl = process.env.DATABASE_URL ?? `file:${join(process.cwd(), 'prisma', 'dev.db')}`
  const url = rawUrl.startsWith('file:./') ? `file:${join(process.cwd(), rawUrl.replace('file:', ''))}` : rawUrl
  // Log once to help diagnose missing URL issues in dev.
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.log(`[prisma] using database url: ${url}`)
  }

  const adapter = new PrismaLibSql({ url })

  return new PrismaClient({
    adapter,
  })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
