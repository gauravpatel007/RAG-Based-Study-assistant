import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

// GET /api/products — all active products with category name
export async function GET() {
  try {
    const { rows } = await query(`
      SELECT p.*, c.name as category
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.active = true
      ORDER BY c.name, p.name
    `)
    const products = rows.map(r => ({
      ...r,
      price: Number(r.price),
      tax: Number(r.tax_rate),
      stock: r.stock_status,
    }))
    return NextResponse.json(products)
  } catch (err) {
    console.error('GET /api/products error:', err)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}

// POST /api/products — create a new product
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, category, price, tax, tax_rate, description, stock, stock_status, variants } = body

    const finalTax = tax ?? tax_rate ?? 0;
    const finalStock = stock ?? stock_status ?? 'available';

    // Find or create category
    let catId = null
    if (category) {
      const catRes = await query('SELECT id FROM categories WHERE name = $1', [category])
      if (catRes.rows.length > 0) {
        catId = catRes.rows[0].id
      } else {
        const newCat = await query('INSERT INTO categories (name) VALUES ($1) RETURNING id', [category])
        catId = newCat.rows[0].id
      }
    }

    const res = await query(
      `INSERT INTO products (category_id, name, price, tax_rate, description, stock_status, variants)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [catId, name, price || 0, finalTax, description || '', finalStock, variants ? JSON.stringify(variants) : '[]']
    )
    return NextResponse.json(res.rows[0])
  } catch (err) {
    console.error('POST /api/products error:', err)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}

// PUT /api/products — update a product
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, name, category, price, tax, tax_rate, description, stock, stock_status, variants } = body
    
    const finalTax = tax ?? tax_rate ?? 0;
    const finalStock = stock ?? stock_status ?? 'available';

    let catId = null
    if (category) {
      const catRes = await query('SELECT id FROM categories WHERE name = $1', [category])
      if (catRes.rows.length > 0) catId = catRes.rows[0].id
      else {
        const nc = await query('INSERT INTO categories (name) VALUES ($1) RETURNING id', [category])
        catId = nc.rows[0].id
      }
    }

    const res = await query(
      `UPDATE products SET name=$1, category_id=$2, price=$3, tax_rate=$4,
       description=$5, stock_status=$6, variants=$7 WHERE id=$8 RETURNING *`,
      [name, catId, price, finalTax, description || '', finalStock, variants ? JSON.stringify(variants) : '[]', id]
    )
    return NextResponse.json(res.rows[0])
  } catch (err) {
    console.error('PUT /api/products error:', err)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}
