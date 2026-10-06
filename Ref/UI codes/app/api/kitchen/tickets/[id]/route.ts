import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

const STATUS_ORDER = ['to_cook', 'preparing', 'completed', 'served']

// PATCH /api/kitchen/tickets/[id] — advance status, toggle items, update priority
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const { action, item_index, priority } = body
    const ticketId = params.id

    if (action === 'advance') {
      const ticketRes = await query('SELECT * FROM kitchen_tickets WHERE id = $1', [ticketId])
      if (ticketRes.rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })

      const current = ticketRes.rows[0].status
      const idx = STATUS_ORDER.indexOf(current)
      if (idx < STATUS_ORDER.length - 1) {
        const next = STATUS_ORDER[idx + 1]
        if (next === 'completed') {
          // Freeze elapsed seconds at exact time of completion
          await query('UPDATE kitchen_tickets SET status = $1, elapsed_seconds = EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - created_at)) WHERE id = $2', [next, ticketId])
        } else {
          await query('UPDATE kitchen_tickets SET status = $1 WHERE id = $2', [next, ticketId])
        }

        // If served, also update the order
        if (next === 'served') {
          await query(
            "UPDATE orders SET status = 'served', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
            [ticketRes.rows[0].order_id]
          )
        }
      }
    }

    if (action === 'go_back') {
      const ticketRes = await query('SELECT * FROM kitchen_tickets WHERE id = $1', [ticketId])
      if (ticketRes.rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })

      const current = ticketRes.rows[0].status
      const idx = STATUS_ORDER.indexOf(current)
      if (idx > 0) {
        await query('UPDATE kitchen_tickets SET status = $1 WHERE id = $2', [STATUS_ORDER[idx - 1], ticketId])
      }
    }

    if (action === 'toggle_item' && item_index !== undefined) {
      // Get ticket items ordered by id
      const items = await query('SELECT * FROM ticket_items WHERE ticket_id = $1 ORDER BY id', [ticketId])
      if (items.rows[item_index]) {
        const item = items.rows[item_index]
        await query('UPDATE ticket_items SET is_done = NOT is_done WHERE id = $1', [item.id])
      }
    }

    if (priority) {
      await query('UPDATE kitchen_tickets SET priority = $1 WHERE id = $2', [priority, ticketId])
    }

    // Increment elapsed time for active tickets (will also be done by a cron/interval)
    if (action === 'tick') {
      await query(
        "UPDATE kitchen_tickets SET elapsed_seconds = elapsed_seconds + 1 WHERE status IN ('to_cook', 'preparing')"
      )
    }

    // Return updated ticket
    const { rows } = await query('SELECT * FROM kitchen_tickets WHERE id = $1', [ticketId])
    if (rows.length > 0) {
      const items = await query('SELECT * FROM ticket_items WHERE ticket_id = $1 ORDER BY id', [ticketId])
      rows[0].items = items.rows.map(i => ({ name: i.name, qty: i.quantity, done: i.is_done }))
    }

    return NextResponse.json(rows[0] || { success: true })
  } catch (err) {
    console.error('PATCH /api/kitchen/tickets/[id] error:', err)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}
