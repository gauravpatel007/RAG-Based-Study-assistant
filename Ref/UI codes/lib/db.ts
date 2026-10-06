import { Pool, QueryResultRow, QueryResult } from 'pg'

// Singleton pool for PostgreSQL — prevents connection exhaustion during hot-reloads
const globalForPg = globalThis as unknown as { pgPool: Pool | undefined }

export const pool =
  globalForPg.pgPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  })

if (process.env.NODE_ENV !== 'production') globalForPg.pgPool = pool

/** Execute a parameterized SQL query */
export async function query<T extends QueryResultRow = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  return pool.query<T>(text, params)
}

/** Generate next order number like #ORD-1045 */
export async function nextOrderNumber(): Promise<string> {
  const res = await query('SELECT COALESCE(MAX(id), 0) + 1 AS next FROM orders')
  return `#ORD-${String(res.rows[0].next).padStart(4, '0')}`
}

export default pool
