import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

// GET /api/categories
export async function GET() {
  try {
    const { rows } = await query('SELECT * FROM categories ORDER BY name')
    return NextResponse.json(rows)
  } catch (err) {
    console.error('GET /api/categories error:', err)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}
