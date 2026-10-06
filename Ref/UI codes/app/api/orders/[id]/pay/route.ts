import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

// POST /api/orders/[id]/pay — record payment transaction(s)
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const orderId = params.id
    const { payments } = await req.json()
    // payments = [{ method: 'cash', amount: 500 }, { method: 'upi', amount: 80 }]

    if (!payments || payments.length === 0) {
      return NextResponse.json({ error: 'Payments required' }, { status: 400 })
    }

    // Get order
    const orderRes = await query('SELECT * FROM orders WHERE id = $1', [orderId])
    if (orderRes.rows.length === 0) return NextResponse.json({ error: 'Order not found' }, { status: 404 })

    const order = orderRes.rows[0]
    let totalPaid = 0

    // Insert each payment transaction
    for (const p of payments) {
      await query(
        `INSERT INTO payment_transactions (order_id, method, amount, status, cashier_name)
         VALUES ($1, $2, $3, 'success', $4)`,
        [orderId, p.method, p.amount, p.cashier || 'Cashier']
      )
      totalPaid += p.amount
    }

    // Update order payment status
    const grandTotal = Number(order.grand_total)
    const paymentStatus = totalPaid >= grandTotal ? 'paid' : 'partial'
    const orderStatus = totalPaid >= grandTotal ? 'paid' : order.status

    await query(
      `UPDATE orders SET payment_status = $1, status = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3`,
      [paymentStatus, orderStatus, orderId]
    )

    // Free up table if fully paid
    if (paymentStatus === 'paid' && order.table_id) {
      await query(
        "UPDATE tables SET status = 'available', current_order_id = NULL WHERE id = $1",
        [order.table_id]
      )
    }

    return NextResponse.json({
      success: true,
      payment_status: paymentStatus,
      total_paid: totalPaid,
      change: Math.max(0, totalPaid - grandTotal),
    })
  } catch (err) {
    console.error('POST /api/orders/[id]/pay error:', err)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}
