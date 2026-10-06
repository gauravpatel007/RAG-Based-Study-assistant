import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

// GET /api/floors — returns all floors with their tables
export async function GET() {
  try {
    const floorsRes = await query('SELECT * FROM floors ORDER BY id ASC')
    const tablesRes = await query('SELECT * FROM tables ORDER BY id ASC')

    const floorsWithTables = floorsRes.rows.map(floor => ({
      ...floor,
      tables: tablesRes.rows.filter(t => t.floor_id === floor.id),
    }))

    return NextResponse.json(floorsWithTables)
  } catch (error) {
    console.error('GET /api/floors error:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}

// POST /api/floors — create a new floor
export async function POST(req: NextRequest) {
  try {
    const { name } = await req.json()
    if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 })

    const res = await query('INSERT INTO floors (name) VALUES ($1) RETURNING *', [name])
    return NextResponse.json({ ...res.rows[0], tables: [] })
  } catch (error) {
    console.error('POST /api/floors error:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}

// DELETE /api/floors — delete a floor
export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json()
    await query('DELETE FROM floors WHERE id = $1', [id])
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/floors error:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}
