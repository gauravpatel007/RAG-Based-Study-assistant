import { NextRequest, NextResponse } from 'next/server'
import { query, nextOrderNumber } from '@/lib/db'

// GET /api/orders — list orders with optional filters
export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const status = url.searchParams.get('status')
    const table_id = url.searchParams.get('table_id')
    const limit = url.searchParams.get('limit') || '50'

    let sql = `
      SELECT o.*, t.name as table_name
      FROM orders o
      LEFT JOIN tables t ON o.table_id = t.id
      WHERE 1=1
    `
    const params: any[] = []
    let idx = 1

    if (status) { sql += ` AND o.status = $${idx++}`; params.push(status) }
    if (table_id) { sql += ` AND o.table_id = $${idx++}`; params.push(table_id) }

    sql += ` ORDER BY o.created_at DESC LIMIT $${idx}`
    params.push(parseInt(limit))

    const { rows } = await query(sql, params)

    // For each order, fetch its items
    for (const order of rows) {
      const items = await query(
        'SELECT * FROM order_items WHERE order_id = $1',
        [order.id]
      )
      order.items = items.rows
    }

    return NextResponse.json(rows)
  } catch (err) {
    console.error('GET /api/orders error:', err)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}

// POST /api/orders — create a new order
export async function POST(req: NextRequest) {
  try {
    const { table_id, items, source } = await req.json()
    if (!items || items.length === 0) {
      return NextResponse.json({ error: 'Items required' }, { status: 400 })
    }

    const orderNumber = await nextOrderNumber()

    // Calculate totals
    let subtotal = 0
    let taxTotal = 0
    for (const item of items) {
      const lineTotal = item.price * item.qty
      subtotal += lineTotal
      taxTotal += lineTotal * ((item.taxRate || 0) / 100)
    }
    const grandTotal = subtotal + taxTotal

    // Insert order
    const orderRes = await query(
      `INSERT INTO orders (table_id, order_number, subtotal, tax_total, grand_total, status, source)
       VALUES ($1, $2, $3, $4, $5, 'draft', $6) RETURNING *`,
      [table_id || null, orderNumber, subtotal.toFixed(2), taxTotal.toFixed(2), grandTotal.toFixed(2), source || 'cashier']
    )
    const order = orderRes.rows[0]

    // Insert order items
    for (const item of items) {
      await query(
        `INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price, tax_rate, variant)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [order.id, item.productId || item.itemId, item.name, item.qty, item.price, item.taxRate || 0, item.variant || null]
      )
    }

    // Mark table as occupied
    if (table_id) {
      await query(
        'UPDATE tables SET status = $1, current_order_id = $2 WHERE id = $3',
        ['occupied', order.id, table_id]
      )
    }

    // Fetch back with items
    const itemsRes = await query('SELECT * FROM order_items WHERE order_id = $1', [order.id])
    order.items = itemsRes.rows

    return NextResponse.json(order, { status: 201 })
  } catch (err) {
    console.error('POST /api/orders error:', err)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}
