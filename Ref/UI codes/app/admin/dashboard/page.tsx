'use client'
import { useState, useEffect } from 'react'
import { BarChart3, ShoppingBag, CreditCard, Users, TrendingUp, Clock, ChefHat, LayoutGrid } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import Link from 'next/link'
import { salesChartData, recentOrders, paymentBreakdown } from '@/lib/mockData'

const fallbackData = {
  revenue: 49200,
  orderCount: 142,
  avgOrderValue: 346,
  activeTables: '4 / 15',
  paymentBreakdown,
  recentOrders,
  salesChartData,
  topProducts: [
    { product_name: 'Filter Coffee', units_sold: 52, revenue: 3120 },
    { product_name: 'Butter Naan', units_sold: 40, revenue: 2000 },
    { product_name: 'Masala Dosa', units_sold: 28, revenue: 3360 },
    { product_name: 'Paneer Butter Masala', units_sold: 18, revenue: 5040 },
    { product_name: 'Veg Biryani', units_sold: 14, revenue: 3080 },
  ],
}

const statusMap: Record<string, string> = {
  paid:      'badge-green',
  kitchen:   'badge-orange',
  confirmed: 'badge-blue',
  draft:     'badge-gray',
  served:    'badge-blue',
}

export default function AdminDashboard() {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await fetch('/api/reports/dashboard')
        if (res.ok) {
          const json = await res.json()
          if (json && !json.error) {
            setData(json)
            return
          }
        }
      } catch (e) {
        console.error('API unavailable, rendering preview dashboard', e)
      } finally {
        setLoading(false)
      }
      setData(fallbackData)
    }
    fetchDashboard()
  }, [])

  if (loading) {
    return <div style={{ padding: 40 }}>Loading Dashboard...</div>
  }

  const currentData = data || fallbackData
  const { paymentBreakdown, salesChartData, recentOrders, revenue, orderCount, avgOrderValue, activeTables } = currentData
  const summary = {
    todaysRevenue: revenue || 0,
    revenueChange: '+8.4%',
    ordersToday: orderCount || 0,
    ordersChange: '+12',
    avgOrderValue: avgOrderValue || 0,
    aovChange: '+2.1%'
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <div className="page-subtitle">Welcome back — here's today's overview</div>
        </div>
        <div className="header-actions">
          <Link href="/pos/floor" style={{ textDecoration: 'none' }}>
            <button className="btn btn-primary btn-sm" id="go-to-pos-btn">
              <ShoppingBag size={14} /> Open POS
            </button>
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 24 }}>
        {[
          { label: "Today's Revenue",  value: `₹${summary.todaysRevenue.toLocaleString()}`, change: summary.revenueChange, icon: TrendingUp, color: 'var(--accent-green)'  },
          { label: 'Orders Today',     value: summary.ordersToday,      change: summary.ordersChange,     icon: ShoppingBag, color: 'var(--accent-blue)'   },
          { label: 'Avg. Order Value', value: `₹${summary.avgOrderValue.toLocaleString()}`,     change: summary.aovChange,   icon: CreditCard,  color: 'var(--accent-orange)' },
          { label: 'Active Tables',    value: activeTables || 'N/A',   change: '',    icon: LayoutGrid,   color: 'var(--text-primary)'  },
        ].map(kpi => {
          const Icon = kpi.icon
          return (
            <div className="metric-card" key={kpi.label} style={{ padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div className="metric-label">{kpi.label}</div>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--bg-canvas)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: kpi.color }}>
                  <Icon size={18} />
                </div>
              </div>
              <div className="metric-value" style={{ fontSize: 28, color: kpi.color }}>{kpi.value}</div>
              <div style={{ fontSize: 12, color: 'var(--accent-green)', fontWeight: 600, marginTop: 4 }}>{kpi.change}</div>
            </div>
          )
        })}
      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 24 }}>
        <div className="chart-card" style={{ marginBottom: 0 }}>
          <div className="chart-header">
            <div className="chart-title">Sales Today vs Yesterday</div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={salesChartData.slice(0, 10)} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#9b9b9b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#9b9b9b' }} axisLine={false} tickLine={false}
                tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(v: any, name: string) => [`₹${Number(v).toLocaleString()}`, name === 'today' ? 'Today' : 'Yesterday']}
                contentStyle={{ borderRadius: 8, border: '1px solid #e5e5e5', fontSize: 12 }}
              />
              <Bar dataKey="today" fill="#1a1a1a" radius={[4, 4, 0, 0]} />
              <Bar dataKey="yesterday" fill="#e5e5e5" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Payment Methods */}
        <div className="chart-card" style={{ marginBottom: 0, padding: 24 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 20 }}>Payment Split</h3>
          {paymentBreakdown.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', marginTop: 40 }}>No payments today</div>
          ) : paymentBreakdown.map((p: any) => (
            <div key={p.method} style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
                <span style={{ fontWeight: 600 }}>{p.method}</span>
                <span style={{ fontWeight: 700 }}>₹{p.amount.toLocaleString()}</span>
              </div>
              <div style={{ height: 6, background: '#f0f0f0', borderRadius: 6, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.round(p.pct)}%`, background: p.color, borderRadius: 6 }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Orders */}
      <div className="table-card">
        <div className="table-header-row">
          <span className="table-title">Recent Orders</span>
          <Link href="/admin/orders" style={{ textDecoration: 'none' }}>
            <button className="btn btn-ghost btn-sm" id="view-all-orders-btn">View All</button>
          </Link>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Table</th>
              <th>Items</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {(recentOrders || []).slice(0, 5).map((o: any) => (
              <tr key={o.id}>
                <td style={{ fontWeight: 600, color: 'var(--accent-blue)' }}>{o.id}</td>
                <td>{o.table}</td>
                <td style={{ color: 'var(--text-muted)' }}>{o.items} items</td>
                <td style={{ fontWeight: 700 }}>₹{o.amount.toLocaleString()}</td>
                <td><span className={`badge ${statusMap[o.status] || 'badge-gray'}`}>{o.status}</span></td>
                <td style={{ color: 'var(--text-muted)', fontSize: 12.5 }}>{o.time}</td>
              </tr>
            ))}
            {(!recentOrders || recentOrders.length === 0) && (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>No recent orders</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
