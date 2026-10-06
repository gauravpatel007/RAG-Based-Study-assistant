'use client'
import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, Legend } from 'recharts'
import { staffMembers, weeklyData, menuItems } from '@/lib/mockData'
import { ChevronDown, Download, Filter, Calendar } from 'lucide-react'

const COLORS = ['#1a1a1a', '#006aff', '#00b259', '#f5a623', '#e22134', '#7b5ea7', '#00b4d8', '#ff6b6b']

export default function ReportsPage() {
  const [period, setPeriod] = useState('This Week')
  const [reportType, setReportType] = useState('Sales')
  const [staffFilter, setStaffFilter] = useState('All Staff')
  const [categoryFilter, setCategoryFilter] = useState('All Categories')
  const [isExporting, setIsExporting] = useState(false)

  const [salesData, setSalesData] = useState<any[]>([])
  const [productsData, setProductsData] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/reports/sales').then(res => res.json()).catch(() => null),
      fetch('/api/reports/products').then(res => res.json()).catch(() => null)
    ]).then(([s, p]) => {
      setSalesData(Array.isArray(s) && s.length > 0 ? s : weeklyData)
      setProductsData(Array.isArray(p) && p.length > 0 ? p : menuItems.map(m => ({ ...m, revenue: m.price * m.sold })))
      setLoading(false)
    }).catch(err => {
      console.error('Failed to load reports', err)
      setSalesData(weeklyData)
      setProductsData(menuItems.map(m => ({ ...m, revenue: m.price * m.sold })))
      setLoading(false)
    })
  }, [])

  const handleExport = () => {
    setIsExporting(true)
    setTimeout(() => {
      let csvStr = `Report Type: ${reportType}\nPeriod: ${period}\nStaff: ${staffFilter}\nCategory: ${categoryFilter}\n\n`
      
      if (reportType === 'Sales') {
         csvStr += "Day,Sales (INR)\n"
         salesData.forEach(s => {
            csvStr += `${s.day},${s.sales}\n`
         })
         const totalSalesRevenue = salesData.reduce((acc, r) => acc + r.sales, 0)
         const todaySales = salesData.length > 0 ? salesData[salesData.length - 1].sales : 0
         csvStr += `\nNet Revenue,${totalSalesRevenue}\nToday Sales,${todaySales}\n`
      } else if (reportType === 'Products') {
         csvStr += "Item,Category,Units Sold,Revenue (INR)\n"
         productsData.filter(i => categoryFilter === 'All Categories' || i.category === categoryFilter).forEach(p => {
            csvStr += `"${p.name}","${p.category}",${p.sold},${p.revenue}\n`
         })
      } else if (reportType === 'Staff Performance') {
         csvStr += "Staff Name,Role,Total Orders,Total Sales (INR)\n"
         staffMembers.filter(s => staffFilter === 'All Staff' || s.name === staffFilter).forEach(s => {
            csvStr += `"${s.name}","${s.role}",${s.orders},${s.sales}\n`
         })
      } else {
         csvStr += "No export data available for this configuration."
      }

      const blob = new Blob([csvStr], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `cafe-report-${reportType.toLowerCase().replace(/\s+/g,'-')}-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      window.URL.revokeObjectURL(url)
      setIsExporting(false)
    }, 800)
  }

  const filteredStaff = staffMembers.filter(s => {
    if (staffFilter === 'All Staff') return true
    return s.name === staffFilter
  })

  // Basic totals calculation
  const totalSalesRevenue = salesData.reduce((acc, r) => acc + r.sales, 0)
  const todaySales = salesData.length > 0 ? salesData[salesData.length - 1].sales : 0

  if (loading) {
    return <div style={{ padding: 40 }}>Loading reports...</div>
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Reporting & Analytics</h1>
          <div className="page-subtitle">Multi-dimensional business intelligence</div>
        </div>
        <div className="header-actions">
          <button className="btn btn-primary btn-sm" id="export-report-btn" onClick={handleExport} disabled={isExporting}>
            <Download size={13} /> {isExporting ? 'Exporting...' : 'Export Report'}
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 0, marginBottom: 24, borderBottom: '1px solid var(--border-light)' }}>
        {['Sales', 'Products', 'Staff Performance', 'Sessions'].map(t => (
          <button
            key={t}
            onClick={() => setReportType(t)}
            id={`report-tab-${t.toLowerCase().replace(' ', '-')}`}
            style={{
              padding: '10px 20px',
              background: 'none', border: 'none',
              borderBottom: reportType === t ? '2px solid var(--text-primary)' : '2px solid transparent',
              fontWeight: reportType === t ? 700 : 500,
              fontSize: 13.5,
              color: reportType === t ? 'var(--text-primary)' : 'var(--text-muted)',
              cursor: 'pointer', marginBottom: -1,
            }}
          >{t}</button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 24, padding: '16px', background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border-light)' }}>
         <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-muted)', marginRight: 8 }}>
            <Filter size={16} /> <span style={{ fontSize: 13, fontWeight: 600 }}>Filters</span>
         </div>
         <div className="form-group" style={{ marginBottom: 0, width: 140 }}>
            <select className="form-input form-select" value={period} onChange={e => setPeriod(e.target.value)} style={{ padding: '8px 12px', fontSize: 12.5 }}>
               <option value="Today">Today</option>
               <option value="This Week">This Week</option>
               <option value="This Month">This Month</option>
            </select>
         </div>
         <div className="form-group" style={{ marginBottom: 0, width: 140 }}>
            <select className="form-input form-select" value={staffFilter} onChange={e => setStaffFilter(e.target.value)} style={{ padding: '8px 12px', fontSize: 12.5 }}>
               <option value="All Staff">All Staff</option>
               <option value="Riya Sharma">Riya Sharma</option>
               <option value="Arjun Kumar">Arjun Kumar</option>
               <option value="Priya M.">Priya M.</option>
            </select>
         </div>
         <div className="form-group" style={{ marginBottom: 0, width: 140 }}>
            <select className="form-input form-select" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} style={{ padding: '8px 12px', fontSize: 12.5 }}>
               <option value="All Categories">All Categories</option>
               <option value="Main Course">Main Course</option>
               <option value="Beverages">Beverages</option>
               <option value="Desserts">Desserts</option>
            </select>
         </div>
      </div>

      {reportType === 'Sales' && (
        <>
          <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 24 }}>
            {[
              { label: 'Net Revenue',  value: period === 'Today' ? `₹${todaySales.toLocaleString()}` : `₹${totalSalesRevenue.toLocaleString()}`, sub: '+8.4% vs last period'  },
              { label: 'Gross Sales',  value: period === 'Today' ? `₹${todaySales.toLocaleString()}` : `₹${totalSalesRevenue.toLocaleString()}`, sub: '+9.1% vs last period' },
              { label: 'Discounts',    value: period === 'Today' ? '₹0' : '₹1,200',   sub: '-3.2% vs last period'  },
              { label: 'Taxes Collected',value: period === 'Today' ? '₹0' : '₹900',  sub: '+1.4% vs last period'     },
            ].map(m => (
              <div className="metric-card" key={m.label}>
                <div className="metric-label">{m.label}</div>
                <div className="metric-value" style={{ fontSize: 22 }}>{m.value}</div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 6 }}>{m.sub}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 24 }}>
            <div className="chart-card" style={{ marginBottom: 0 }}>
              <div className="chart-header">
                <div className="chart-title">Sales Trend</div>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={salesData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#9b9b9b' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: '#9b9b9b' }} axisLine={false} tickLine={false}
                    tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(v: any) => [`₹${Number(v).toLocaleString()}`, 'Revenue']}
                    contentStyle={{ borderRadius: 8, border: '1px solid #e5e5e5', fontSize: 12 }}
                  />
                  <Bar dataKey="sales" fill="#1a1a1a" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            
            <div className="chart-card" style={{ marginBottom: 0, display: 'flex', flexDirection: 'column', padding: 24 }}>
               <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>Key Highlights</h3>
               <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                 <div style={{ background: 'var(--accent-green-light)', color: 'var(--accent-green)', padding: 12, borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
                   ✅ Beverage sales are up 14% perfectly correlating with summer promotions.
                 </div>
                 <div style={{ background: 'var(--accent-blue-light)', color: 'var(--accent-blue)', padding: 12, borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
                   ℹ️ Riya S. processed the most transactions this period (42).
                 </div>
                 <div style={{ background: 'var(--bg-canvas)', color: 'var(--text-secondary)', padding: 12, borderRadius: 8, fontSize: 13, fontWeight: 600 }}>
                   ⚠️ Average order value dropped slightly on Sunday due to high takeaway volume.
                 </div>
               </div>
            </div>
          </div>
        </>
      )}

      {reportType === 'Products' && (
        <div className="table-card" style={{ animation: 'fadeIn 0.2s ease' }}>
          <div className="table-header-row">
            <span className="table-title">Product Analytics</span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Item</th>
                <th>Category</th>
                <th>Units Sold</th>
                <th>Revenue</th>
                <th>Gross Margin</th>
              </tr>
            </thead>
            <tbody>
              {productsData.filter(i => categoryFilter === 'All Categories' || i.category === categoryFilter).map((item, i) => (
                <tr key={item.id}>
                  <td style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{i + 1}</td>
                  <td style={{ fontWeight: 600 }}>{item.name}</td>
                  <td><span className="badge badge-gray">{item.category}</span></td>
                  <td style={{ fontWeight: 700 }}>{item.sold}</td>
                  <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                    ₹{item.revenue.toLocaleString()}
                  </td>
                  <td style={{ fontWeight: 600, color: 'var(--accent-green)' }}>
                    ≈ 48%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {reportType === 'Staff Performance' && (
         <div className="table-card" style={{ animation: 'fadeIn 0.2s ease' }}>
           <div className="table-header-row">
             <span className="table-title">Employee Analytics</span>
           </div>
           <table className="data-table">
             <thead>
               <tr>
                 <th>Staff Name</th>
                 <th>Role</th>
                 <th>Total Orders Handled</th>
                 <th>Total Sales Value (₹)</th>
                 <th>Avg Transaction Val.</th>
               </tr>
             </thead>
             <tbody>
               {filteredStaff.map(staff => (
                 <tr key={staff.id}>
                   <td style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                     <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--accent-blue)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>{staff.avatar}</div>
                     {staff.name}
                   </td>
                   <td><span className="badge badge-gray">{staff.role}</span></td>
                   <td style={{ fontWeight: 600 }}>{staff.orders}</td>
                   <td style={{ fontWeight: 700, color: 'var(--text-primary)' }}>₹{staff.sales.toLocaleString()}</td>
                   <td style={{ fontWeight: 600, color: 'var(--text-muted)' }}>
                      ₹{staff.orders > 0 ? (staff.sales / staff.orders).toFixed(0) : 0}
                   </td>
                 </tr>
               ))}
             </tbody>
           </table>
         </div>
      )}

      {reportType === 'Sessions' && (
         <div style={{ padding: 40, textAlign: 'center', background: 'var(--bg-card)', borderRadius: 12 }}>
            <h3 style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>No Session Data Validated</h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Try starting and closing a POS shift session first.</p>
         </div>
      )}
    </div>
  )
}

