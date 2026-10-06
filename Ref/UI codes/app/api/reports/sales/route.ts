import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET() {
  try {
    // Generate sales for the last 7 days grouped by day
    // We'll use a simple approach for PostgreSQL
    const { rows } = await query(`
      WITH RECURSIVE dates AS (
        SELECT CURRENT_DATE - INTERVAL '6 days' AS d
        UNION ALL
        SELECT d + INTERVAL '1 day' FROM dates WHERE d < CURRENT_DATE
      )
      SELECT 
        to_char(d.d, 'Dy') as day,
        COALESCE(SUM(pt.amount), 0) as sales
      FROM dates d
      LEFT JOIN payment_transactions pt ON DATE(pt.created_at) = DATE(d.d)
      GROUP BY d.d
      ORDER BY d.d ASC
    `)

    return NextResponse.json(rows.map(r => ({
      day: r.day,
      sales: parseFloat(r.sales)
    })))
  } catch (err) {
    console.error('GET /api/reports/sales error:', err)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}
