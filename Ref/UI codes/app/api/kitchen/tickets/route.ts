import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

// GET /api/kitchen/tickets — all active kitchen tickets
export async function GET() {
  try {
    const { rows: tickets } = await query(`
      SELECT kt.*, o.order_number
      FROM kitchen_tickets kt
      LEFT JOIN orders o ON kt.order_id = o.id
      WHERE kt.status IN ('to_cook', 'preparing', 'completed')
      ORDER BY
        CASE kt.priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 ELSE 2 END,
        kt.created_at ASC
    `)

    const now = Date.now()
    // Attach items to each ticket
    for (const ticket of tickets) {
      if (ticket.status !== 'completed' && ticket.status !== 'served') {
        ticket.elapsed_seconds = Math.floor((now - new Date(ticket.created_at).getTime()) / 1000)
      }

      const items = await query(
        'SELECT * FROM ticket_items WHERE ticket_id = $1',
        [ticket.id]
      )
      ticket.items = items.rows.map(i => ({
        name: i.name,
        qty: i.quantity,
        done: i.is_done,
      }))
      ticket.orderId = ticket.order_number || `#ORD-${String(ticket.order_id).padStart(4, '0')}`
      ticket.table = ticket.table_name
      ticket.elapsed = formatElapsed(ticket.elapsed_seconds || 0)
    }

    return NextResponse.json(tickets)
  } catch (err) {
    console.error('GET /api/kitchen/tickets error:', err)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}

function formatElapsed(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}
