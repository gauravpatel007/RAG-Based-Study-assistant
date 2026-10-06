import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

// GET /api/sessions — list sessions
export async function GET() {
  try {
    const { rows } = await query(`
      SELECT s.*, u.name as user_name, u.email as user_email
      FROM sessions s
      LEFT JOIN users u ON s.user_id = u.id
      ORDER BY s.opened_at DESC
      LIMIT 20
    `)
    return NextResponse.json(rows)
  } catch (err) {
    console.error('GET /api/sessions error:', err)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}

// POST /api/sessions — open or close a session
export async function POST(req: NextRequest) {
  try {
    const { action, session_id, user_id, opening_balance } = await req.json()

    if (action === 'open') {
      // Check for existing open session
      const existing = await query(
        "SELECT * FROM sessions WHERE user_id = $1 AND status = 'open'",
        [user_id]
      )
      if (existing.rows.length > 0) {
        return NextResponse.json(existing.rows[0])
      }

      const res = await query(
        `INSERT INTO sessions (user_id, opening_balance, status)
         VALUES ($1, $2, 'open') RETURNING *`,
        [user_id, opening_balance || 0]
      )
      return NextResponse.json(res.rows[0], { status: 201 })
    }

    if (action === 'close' && session_id) {
      // Calculate session totals
      const totals = await query(`
        SELECT COALESCE(SUM(pt.amount), 0) as total_sales, COUNT(DISTINCT o.id) as total_orders
        FROM payment_transactions pt
        JOIN orders o ON pt.order_id = o.id
        WHERE pt.session_id = $1
      `, [session_id])

      const res = await query(
        `UPDATE sessions SET
         closed_at = CURRENT_TIMESTAMP, status = 'closed',
         total_sales = $1, total_orders = $2,
         closing_balance = opening_balance + $1
         WHERE id = $3 RETURNING *`,
        [totals.rows[0].total_sales, totals.rows[0].total_orders, session_id]
      )
      return NextResponse.json(res.rows[0])
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (err) {
    console.error('POST /api/sessions error:', err)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}
