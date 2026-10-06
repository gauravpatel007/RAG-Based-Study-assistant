import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

// GET /api/orders/[id]
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { rows } = await query(
      `SELECT o.*, t.name as table_name FROM orders o
       LEFT JOIN tables t ON o.table_id = t.id
       WHERE o.id = $1`,
      [params.id]
    )
    if (rows.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const order = rows[0]
    const items = await query('SELECT * FROM order_items WHERE order_id = $1', [order.id])
    order.items = items.rows

    return NextResponse.json(order)
  } catch (err) {
    console.error('GET /api/orders/[id] error:', err)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}

// PATCH /api/orders/[id] — update order status, add items, etc.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const { status, payment_status, add_items } = body

    // Update status if provided
    if (status) {
      await query(
        'UPDATE orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [status, params.id]
      )
    }
    if (payment_status) {
      await query(
        'UPDATE orders SET payment_status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [payment_status, params.id]
      )
    }

    // Add more items if provided
    if (add_items && add_items.length > 0) {
      for (const item of add_items) {
        // Check if item already exists in order
        const existing = await query(
          'SELECT * FROM order_items WHERE order_id = $1 AND product_id = $2 AND variant IS NOT DISTINCT FROM $3',
          [params.id, item.productId || item.itemId, item.variant || null]
        )
        if (existing.rows.length > 0) {
          await query(
            'UPDATE order_items SET quantity = quantity + $1 WHERE id = $2',
            [item.qty, existing.rows[0].id]
          )
        } else {
          await query(
            `INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, tax_rate, variant)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [params.id, item.productId || item.itemId, item.name, item.qty, item.price, item.taxRate || 0, item.variant || null]
          )
        }
      }

      // Recalculate totals
      const itemsRes = await query('SELECT * FROM order_items WHERE order_id = $1', [params.id])
      let subtotal = 0, taxTotal = 0
      for (const it of itemsRes.rows) {
        const line = Number(it.unit_price) * it.quantity
        subtotal += line
        taxTotal += line * (Number(it.tax_rate) / 100)
      }
      await query(
        'UPDATE orders SET subtotal=$1, tax_total=$2, grand_total=$3, updated_at=CURRENT_TIMESTAMP WHERE id=$4',
        [subtotal.toFixed(2), taxTotal.toFixed(2), (subtotal + taxTotal).toFixed(2), params.id]
      )
    }

    // Return updated order
    const { rows } = await query('SELECT * FROM orders WHERE id = $1', [params.id])
    const items = await query('SELECT * FROM order_items WHERE order_id = $1', [params.id])
    rows[0].items = items.rows

    return NextResponse.json(rows[0])
  } catch (err) {
    console.error('PATCH /api/orders/[id] error:', err)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}
