import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET() {
  try {
    const { rows } = await query(`
      SELECT pt.id, o.id as order_id, pt.method as method, 
             pt.amount, pt.cashier_name as cashier, pt.status, pt.created_at as time
      FROM payment_transactions pt
      JOIN orders o ON pt.order_id = o.id
      ORDER BY pt.created_at DESC
      LIMIT 50
    `)

    // Format output
    const transactions = rows.map(r => ({
      id: `TXN-${String(r.id).padStart(5, '0')}`,
      order: `#ORD-${String(r.order_id).padStart(4, '0')}`,
      method: r.method.charAt(0).toUpperCase() + r.method.slice(1),
      amount: parseFloat(r.amount),
      cashier: r.cashier || 'Admin',
      status: r.status,
      time: new Date(r.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true })
    }))

    return NextResponse.json(transactions)
  } catch (err) {
    console.error('GET /api/payment-transactions error:', err)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}
