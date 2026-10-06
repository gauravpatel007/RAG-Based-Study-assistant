import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'

// GET /api/reports/dashboard — live dashboard metrics
export async function GET(req: NextRequest) {
  try {
    // Today's revenue
    const revenueRes = await query(`
      SELECT COALESCE(SUM(grand_total), 0) as revenue
      FROM orders WHERE status = 'paid' AND DATE(created_at) = CURRENT_DATE
    `)

    // Today's orders count
    const ordersRes = await query(`
      SELECT COUNT(*) as count FROM orders WHERE DATE(created_at) = CURRENT_DATE
    `)

    // Average order value
    const avgRes = await query(`
      SELECT COALESCE(AVG(grand_total), 0) as avg_value
      FROM orders WHERE status = 'paid' AND DATE(created_at) = CURRENT_DATE
    `)

    // Active tables
    const tablesRes = await query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'occupied') as occupied,
        COUNT(*) as total
      FROM tables
    `)

    // Payment breakdown
    const paymentRes = await query(`
      SELECT method, SUM(amount) as total, COUNT(*) as count
      FROM payment_transactions
      WHERE DATE(created_at) = CURRENT_DATE AND status = 'success'
      GROUP BY method ORDER BY total DESC
    `)

    // Recent orders
    const recentRes = await query(`
      SELECT o.id, o.order_number, o.grand_total, o.status, o.created_at,
             t.name as table_name,
             (SELECT COUNT(*) FROM order_items WHERE order_id = o.id) as item_count
      FROM orders o
      LEFT JOIN tables t ON o.table_id = t.id
      ORDER BY o.created_at DESC LIMIT 10
    `)

    // Hourly sales for chart
    const hourlyRes = await query(`
      SELECT EXTRACT(HOUR FROM created_at)::int as hour,
             SUM(grand_total) as sales
      FROM orders WHERE status = 'paid' AND DATE(created_at) = CURRENT_DATE
      GROUP BY hour ORDER BY hour
    `)

    // Yesterday hourly for comparison
    const yesterdayRes = await query(`
      SELECT EXTRACT(HOUR FROM created_at)::int as hour,
             SUM(grand_total) as sales
      FROM orders WHERE status = 'paid' AND DATE(created_at) = CURRENT_DATE - 1
      GROUP BY hour ORDER BY hour
    `)

    // Top products
    const topProductsRes = await query(`
      SELECT oi.product_name, SUM(oi.quantity) as units_sold,
             SUM(oi.quantity * oi.unit_price) as revenue
      FROM order_items oi
      JOIN orders o ON oi.order_id = o.id
      WHERE DATE(o.created_at) = CURRENT_DATE
      GROUP BY oi.product_name
      ORDER BY units_sold DESC LIMIT 10
    `)

    // Build hourly chart data
    const hours = Array.from({ length: 13 }, (_, i) => i + 8) // 8am–8pm
    const todayMap: Record<number, number> = {}
    const yesterMap: Record<number, number> = {}
    hourlyRes.rows.forEach(r => { todayMap[r.hour] = Number(r.sales) })
    yesterdayRes.rows.forEach(r => { yesterMap[r.hour] = Number(r.sales) })

    const salesChartData = hours.map(h => ({
      time: `${h > 12 ? h - 12 : h}${h >= 12 ? 'pm' : 'am'}`,
      today: todayMap[h] || 0,
      yesterday: yesterMap[h] || 0,
    }))

    // Payment breakdown with percentages
    const totalPayments = paymentRes.rows.reduce((s, r) => s + Number(r.total), 0)
    const COLORS: Record<string, string> = { cash: '#1a1a1a', upi: '#006aff', card: '#00b259' }
    const paymentBreakdown = paymentRes.rows.map(r => ({
      method: r.method.charAt(0).toUpperCase() + r.method.slice(1),
      amount: Number(r.total),
      pct: totalPayments > 0 ? Math.round((Number(r.total) / totalPayments) * 100) : 0,
      color: COLORS[r.method] || '#f5a623',
    }))

    return NextResponse.json({
      revenue: Number(revenueRes.rows[0].revenue),
      orderCount: parseInt(ordersRes.rows[0].count),
      avgOrderValue: Math.round(Number(avgRes.rows[0].avg_value)),
      activeTables: `${tablesRes.rows[0].occupied} / ${tablesRes.rows[0].total}`,
      paymentBreakdown,
      recentOrders: recentRes.rows.map(r => ({
        id: r.order_number,
        table: r.table_name || 'Takeaway',
        items: parseInt(r.item_count),
        amount: Number(r.grand_total),
        status: r.status,
        time: timeAgo(r.created_at),
        staff: 'Cashier',
      })),
      salesChartData,
      topProducts: topProductsRes.rows,
    })
  } catch (err) {
    console.error('GET /api/reports/dashboard error:', err)
    return NextResponse.json({ error: 'Database error' }, { status: 500 })
  }
}

function timeAgo(date: Date): string {
  const now = new Date()
  const diff = Math.floor((now.getTime() - new Date(date).getTime()) / 60000)
  if (diff < 1) return 'Just now'
  if (diff < 60) return `${diff} min ago`
  if (diff < 1440) return `${Math.floor(diff / 60)} hr ago`
  return `${Math.floor(diff / 1440)} days ago`
}
