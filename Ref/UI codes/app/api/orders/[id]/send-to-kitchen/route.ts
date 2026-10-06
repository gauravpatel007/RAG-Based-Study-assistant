import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

// POST /api/orders/[id]/send-to-kitchen — create kitchen ticket from order
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const orderId = params.id

    // Get order + items
    const orderRes = await query(
      `SELECT o.*, t.name as table_name FROM orders o
       LEFT JOIN tables t ON o.table_id = t.id WHERE o.id = $1`,
      [orderId]
    )
    if (orderRes.rows.length === 0) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

    const order = orderRes.rows[0]
    const itemsRes = await query('SELECT * FROM order_items WHERE order_id = $1', [orderId])

    if (itemsRes.rows.length === 0) return NextResponse.json({ error: 'No items' }, { status: 400 })

    // Create kitchen ticket
    const ticketRes = await query(
      `INSERT INTO kitchen_tickets (order_id, table_name, priority, status)
       VALUES ($1, $2, 'normal', 'to_cook') RETURNING *`,
      [orderId, order.table_name || 'Takeaway']
    )
    const ticket = ticketRes.rows[0]

    // Create ticket items
    for (const item of itemsRes.rows) {
      await query(
        'INSERT INTO ticket_items (ticket_id, name, quantity) VALUES ($1, $2, $3)',
        [ticket.id, item.product_name, item.quantity]
      )
    }

    // Update order status
    await query(
      "UPDATE orders SET status = 'kitchen', updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [orderId]
    )

    // Fetch ticket with items
    const tiRes = await query('SELECT * FROM ticket_items WHERE ticket_id = $1', [ticket.id])
    ticket.items = tiRes.rows

    return NextResponse.json(ticket, { status: 201 })
  } catch (err) {
    console.error('POST /api/orders/[id]/send-to-kitchen error:', err)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}
