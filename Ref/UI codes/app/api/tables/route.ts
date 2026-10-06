import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

// POST /api/tables — create table(s)
export async function POST(req: NextRequest) {
  try {
    const { floor_id, name, capacity, count } = await req.json()
    if (!floor_id || !name) {
      return NextResponse.json({ error: 'floor_id and name required' }, { status: 400 })
    }

    const created = []
    const n = count || 1
    for (let i = 0; i < n; i++) {
      const label = n > 1 ? `${name} ${i + 1}` : name
      const res = await query(
        'INSERT INTO tables (floor_id, name, capacity) VALUES ($1, $2, $3) RETURNING *',
        [floor_id, label, capacity || 4]
      )
      created.push(res.rows[0])
    }

    return NextResponse.json(created)
  } catch (error) {
    console.error('POST /api/tables error:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}

// PUT /api/tables — update a table
export async function PUT(req: NextRequest) {
  try {
    const { id, name, capacity, status } = await req.json()
    const res = await query(
      `UPDATE tables SET name=COALESCE($1,name), capacity=COALESCE($2,capacity),
       status=COALESCE($3,status) WHERE id=$4 RETURNING *`,
      [name, capacity, status, id]
    )
    return NextResponse.json(res.rows[0])
  } catch (error) {
    console.error('PUT /api/tables error:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}

// DELETE /api/tables — delete a table
export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json()
    await query('DELETE FROM tables WHERE id = $1', [id])
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/tables error:', error)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}
