import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

// POST /api/feedback — Insert customer feedback for an order
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { orderId, rating, comment } = body

    if (!orderId || !rating) {
      return NextResponse.json({ error: 'orderId and rating are required' }, { status: 400 })
    }

    if (rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Rating must be between 1 and 5' }, { status: 400 })
    }

    const { rows } = await query(
      `INSERT INTO customer_feedback (order_id, rating, comment)
       VALUES ($1, $2, $3) RETURNING *`,
      [orderId, rating, comment || null]
    )

    return NextResponse.json({ success: true, feedback: rows[0] })
  } catch (err: any) {
    console.error('POST /api/feedback error:', err)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}
