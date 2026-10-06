import { NextResponse } from 'next/server'
import { query } from '@/lib/db'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const category = searchParams.get('category') || 'All Categories'

    let sql = `
      SELECT p.id, p.name, c.name as category, 
             COALESCE(SUM(oi.quantity), 0) as sold,
             COALESCE(SUM(oi.quantity * oi.unit_price), 0) as revenue
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN order_items oi ON p.id = oi.product_id
      LEFT JOIN orders o ON oi.order_id = o.id
    `

    const params: any[] = []
    if (category !== 'All Categories') {
      sql += ' WHERE c.name = $1'
      params.push(category)
    }

    sql += ` GROUP BY p.id, p.name, c.name ORDER BY sold DESC LIMIT 20`

    const { rows } = await query(sql, params)

    return NextResponse.json(rows.map(r => ({
      id: r.id,
      name: r.name,
      category: r.category || 'Uncategorized',
      sold: parseInt(r.sold),
      revenue: parseFloat(r.revenue)
    })))
  } catch (err) {
    console.error('GET /api/reports/products error:', err)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}
