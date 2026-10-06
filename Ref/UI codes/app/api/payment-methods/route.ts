import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

// GET /api/payment-methods
export async function GET() {
  try {
    const { rows } = await query('SELECT * FROM payment_methods ORDER BY id')
    return NextResponse.json(rows)
  } catch (err) {
    console.error('GET /api/payment-methods error:', err)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}

// POST /api/payment-methods — create or update
export async function POST(req: NextRequest) {
  try {
    const { name, type, is_active, upi_id, merchant_name } = await req.json()
    const res = await query(
      `INSERT INTO payment_methods (name, type, is_active, upi_id, merchant_name)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name, type, is_active !== false, upi_id || null, merchant_name || null]
    )
    return NextResponse.json(res.rows[0])
  } catch (err) {
    console.error('POST /api/payment-methods error:', err)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}

// PUT /api/payment-methods — update existing
export async function PUT(req: NextRequest) {
  try {
    const { id, name, type, is_active, upi_id, merchant_name } = await req.json()
    const res = await query(
      `UPDATE payment_methods SET name=$1, type=$2, is_active=$3, upi_id=$4, merchant_name=$5
       WHERE id=$6 RETURNING *`,
      [name, type, is_active, upi_id, merchant_name, id]
    )
    return NextResponse.json(res.rows[0])
  } catch (err) {
    console.error('PUT /api/payment-methods error:', err)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}
