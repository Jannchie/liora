import type { Client, InArgs, InStatement, Transaction, TransactionMode } from '@libsql/client'
import type { LibSQLDatabase } from 'drizzle-orm/libsql'
import type { Logger } from 'drizzle-orm/logger'
import { join } from 'node:path'
import {
  createClient,
} from '@libsql/client'
import { addBreadcrumb, captureException, startSpan } from '@sentry/nuxt'
import { drizzle } from 'drizzle-orm/libsql'
import * as schema from '../database/schema'
import 'dotenv/config'

type Database = LibSQLDatabase<typeof schema>
type StatementInput = InStatement | [string, InArgs?] | string | undefined

type InstrumentedClient = Client & { __sentryInstrumented?: boolean }
type InstrumentedTransaction = Transaction & { __sentryInstrumented?: boolean }

const globalForDb = globalThis as unknown as {
  drizzleDb?: Database
  drizzleClient?: Client
}

class SentryDrizzleLogger implements Logger {
  logQuery(query: string, params: unknown[]): void {
    addBreadcrumb({
      category: 'db',
      message: truncateSql(query),
      level: 'debug',
      data: { paramsCount: params.length },
    })
  }
}

function truncateSql(sql: string): string {
  return sql.length > 180 ? `${sql.slice(0, 180)}…` : sql
}

function extractSql(input: StatementInput): string {
  if (!input) {
    return 'unknown'
  }
  if (typeof input === 'string') {
    return input
  }
  if (Array.isArray(input) && typeof input[0] === 'string') {
    return input[0]
  }
  if (typeof (input as { sql?: unknown }).sql === 'string') {
    return (input as { sql: string }).sql
  }
  return 'unknown'
}

function spanAttributes(sql: string, operation: string): Record<string, string> {
  return {
    'db.system': 'libsql',
    'db.operation': operation,
    'db.statement': truncateSql(sql),
  }
}

function withDbSpan<TArgs extends unknown[], TResult>(
  name: string,
  sqlIndex: number,
  fn: (...args: TArgs) => Promise<TResult>,
): (...args: TArgs) => Promise<TResult> {
  return (...args: TArgs) => {
    const sql = extractSql(args[sqlIndex] as StatementInput)
    return startSpan(
      { name, op: 'db', attributes: spanAttributes(sql, name) },
      async (span) => {
        addBreadcrumb({
          category: 'db',
          message: truncateSql(sql),
          level: 'info',
          data: { operation: name },
        })
        try {
          return await fn(...args)
        }
        catch (error) {
          span.setStatus({ code: 2, message: 'internal_error' })
          captureException(error)
          throw error
        }
      },
    )
  }
}

function withDbSpanWithoutSql<TArgs extends unknown[], TResult>(
  name: string,
  fn: (...args: TArgs) => Promise<TResult>,
): (...args: TArgs) => Promise<TResult> {
  return (...args: TArgs) =>
    startSpan({ name, op: 'db' }, async (span) => {
      try {
        return await fn(...args)
      }
      catch (error) {
        span.setStatus({ code: 2, message: 'internal_error' })
        captureException(error)
        throw error
      }
    })
}

function instrumentTransaction(transaction: Transaction, mode?: TransactionMode): Transaction {
  if ((transaction as InstrumentedTransaction).__sentryInstrumented) {
    return transaction
  }

  const instrumented: Transaction = {
    ...transaction,
    execute: withDbSpan('db.tx.execute', 0, transaction.execute.bind(transaction)),
    batch: withDbSpan('db.tx.batch', 0, transaction.batch.bind(transaction)),
    executeMultiple: withDbSpan('db.tx.executeMultiple', 0, transaction.executeMultiple.bind(transaction)),
    commit: withDbSpanWithoutSql('db.tx.commit', transaction.commit.bind(transaction)),
    rollback: withDbSpanWithoutSql('db.tx.rollback', transaction.rollback.bind(transaction)),
    close: transaction.close.bind(transaction),
    get closed() {
      return transaction.closed
    },
  }

  if (mode) {
    addBreadcrumb({
      category: 'db',
      message: 'transaction started',
      level: 'info',
      data: { mode },
    })
  }

  ;(instrumented as InstrumentedTransaction).__sentryInstrumented = true
  return instrumented
}

function instrumentClient(client: Client): Client {
  if ((client as InstrumentedClient).__sentryInstrumented) {
    return client
  }

  const instrumented: Client = {
    ...client,
    execute: withDbSpan('db.execute', 0, client.execute.bind(client)),
    batch: withDbSpan('db.batch', 0, client.batch.bind(client)),
    migrate: withDbSpan('db.migrate', 0, client.migrate.bind(client)),
    executeMultiple: withDbSpan('db.executeMultiple', 0, client.executeMultiple.bind(client)),
    transaction: async (mode?: TransactionMode): Promise<Transaction> => {
      const activeTransaction = await client.transaction(mode)
      return instrumentTransaction(activeTransaction, mode)
    },
    sync: client.sync.bind(client),
    close: client.close.bind(client),
    reconnect: client.reconnect.bind(client),
    get closed() {
      return client.closed
    },
    get protocol() {
      return client.protocol
    },
  }

  ;(instrumented as InstrumentedClient).__sentryInstrumented = true
  return instrumented
}

function resolveDatabaseUrl(): string {
  const rawUrl = process.env.DATABASE_URL ?? `file:${join(process.cwd(), 'storage', 'data.db')}`
  if (rawUrl.startsWith('file:./')) {
    const relativePath = rawUrl.replace('file:', '')
    return `file:${join(process.cwd(), relativePath)}`
  }
  return rawUrl
}

function createDrizzle(): Database {
  const url = resolveDatabaseUrl()
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.log(`[drizzle] using database url: ${url}`)
  }
  const client = instrumentClient(
    createClient({
      url,
      authToken: process.env.DATABASE_AUTH_TOKEN,
    }),
  )
  const db = drizzle(client, { schema, logger: new SentryDrizzleLogger() })
  globalForDb.drizzleClient = client
  return db
}

export const db: Database = globalForDb.drizzleDb ?? createDrizzle()

if (process.env.NODE_ENV !== 'production') {
  globalForDb.drizzleDb = db
}

export async function closeDb(): Promise<void> {
  if (globalForDb.drizzleClient) {
    await globalForDb.drizzleClient.close()
    if (process.env.NODE_ENV !== 'production') {
      globalForDb.drizzleClient = undefined
    }
  }
}

export * from '../database/schema'
