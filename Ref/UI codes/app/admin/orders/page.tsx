'use client'
import { useState } from 'react'
import { Search, Filter, Plus, X } from 'lucide-react'
import { recentOrders } from '@/lib/mockData'
import Link from 'next/link'

const allOrders = [
  ...recentOrders,
  { id: '#ORD-1036', table: 'Table 2',  items: 3, amount: 1560, status: 'paid',    time: '1 hr ago',   staff: 'Priya M.', date: 'Today' },
  { id: '#ORD-1035', table: 'Table 8',  items: 2, amount: 780,  status: 'paid',    time: '1 hr ago',   staff: 'Riya S.', date: 'Today'  },
  { id: '#ORD-1034', table: 'Takeaway', items: 4, amount: 960,  status: 'paid',    time: '2 hrs ago',  staff: 'Arjun K.', date: 'Today' },
  { id: '#ORD-1033', table: 'Table 6',  items: 5, amount: 2340, status: 'paid',    time: '2 hrs ago',  staff: 'Riya S.', date: 'Today'  },
  { id: '#ORD-1032', table: 'Table 4',  items: 1, amount: 280,  status: 'paid',    time: '3 hrs ago',  staff: 'Priya M.', date: 'Today' },
]

const statusMap: Record<string, string> = {
  paid:      'badge-green',
  kitchen:   'badge-orange',
  confirmed: 'badge-blue',
  draft:     'badge-gray',
}

const tabs = ['All', 'Open', 'Kitchen', 'Paid', 'Void']

export default function OrdersPage() {
  const [activeTab, setActiveTab] = useState('All')
  const [search, setSearch] = useState('')
  const [filterModalOpen, setFilterModalOpen] = useState(false)
  const [dateFilter, setDateFilter] = useState('All time')
  const [staffFilter, setStaffFilter] = useState('All Staff')

  const filtered = allOrders.filter(o => {
    const matchTab = activeTab === 'All'
      || (activeTab === 'Open' && o.status === 'confirmed')
      || (activeTab === 'Kitchen' && o.status === 'kitchen')
      || (activeTab === 'Paid' && o.status === 'paid')
    
    // Applying standard mock filters
    const matchDate = dateFilter === 'All time' || (o as any).date === dateFilter
    const matchStaff = staffFilter === 'All Staff' || o.staff === staffFilter
    
    const matchSearch = o.id.includes(search) || o.table.toLowerCase().includes(search.toLowerCase()) || o.staff.toLowerCase().includes(search.toLowerCase())
    return matchTab && matchSearch && matchDate && matchStaff
  })

  return (
    <div className="animate-fade-in" style={{ position: 'relative' }}>
      
      {/* FILTER MODAL */}
      {filterModalOpen && (
        <div style={{ position: 'fixed', top:0, left:0, right:0, bottom:0, background: 'rgba(0,0,0,0.5)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
           <div className="animate-slide-in" style={{ width: 380, background: 'var(--bg-card)', borderRadius: 16, padding: 24, boxShadow: 'var(--shadow-lg)' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
               <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Filter Orders</h3>
               <button onClick={() => setFilterModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
             </div>
             <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Date Range</label>
                  <select className="form-input form-select" value={dateFilter} onChange={e => setDateFilter(e.target.value)} style={{ padding: '10px 14px', width: '100%' }}>
                     <option value="All time">All time</option>
                     <option value="Today">Today</option>
                     <option value="Yesterday">Yesterday</option>
                     <option value="Last 7 days">Last 7 days</option>
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Staff Member</label>
                  <select className="form-input form-select" value={staffFilter} onChange={e => setStaffFilter(e.target.value)} style={{ padding: '10px 14px', width: '100%' }}>
                     <option value="All Staff">All Staff</option>
                     <option value="Riya Sharma">Riya Sharma</option>
                     <option value="Priya M.">Priya M.</option>
                     <option value="Arjun K.">Arjun K.</option>
                  </select>
                </div>
             </div>
             <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
               <button className="btn btn-ghost" onClick={() => { setDateFilter('All time'); setStaffFilter('All Staff'); }}>Reset</button>
               <button className="btn btn-primary" onClick={() => setFilterModalOpen(false)}>Apply</button>
             </div>
           </div>
        </div>
      )}

      <div className="page-header">
        <div>
          <h1 className="page-title">Orders</h1>
          <div className="page-subtitle">Manage and track all customer orders</div>
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary btn-sm" id="orders-filter-btn" onClick={() => setFilterModalOpen(true)}>
            <Filter size={13} /> {dateFilter !== 'All time' || staffFilter !== 'All Staff' ? 'Filters Active' : 'Filter'}
          </button>
          <Link href="/pos/order" style={{ textDecoration: 'none' }}>
            <button className="btn btn-primary btn-sm" id="new-order-main-btn">
              <Plus size={14} /> New Order
            </button>
          </Link>
        </div>
      </div>

      <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 20 }}>
        {[
          { label: 'Open Orders',    value: '3',    color: 'var(--accent-blue)'   },
          { label: 'In Kitchen',     value: '2',    color: 'var(--accent-orange)' },
          { label: 'Paid Today',     value: '157',  color: 'var(--accent-green)'  },
          { label: "Today's Revenue",value: '₹49,200', color: 'var(--text-primary)' },
        ].map((s) => (
          <div className="metric-card" key={s.label} style={{ padding: '16px 20px' }}>
            <div className="metric-label">{s.label}</div>
            <div className="metric-value" style={{ fontSize: 22, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="table-card">
        <div style={{ padding: '0 20px', borderBottom: '1px solid var(--border-light)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 4 }}>
            <div style={{ display: 'flex', gap: 0 }}>
              {tabs.map(t => (
                <button
                  key={t}
                  onClick={() => setActiveTab(t)}
                  id={`orders-tab-${t.toLowerCase()}`}
                  style={{
                    padding: '12px 16px',
                    background: 'none',
                    border: 'none',
                    borderBottom: activeTab === t ? '2px solid var(--text-primary)' : '2px solid transparent',
                    fontWeight: activeTab === t ? 700 : 500,
                    fontSize: 13.5,
                    color: activeTab === t ? 'var(--text-primary)' : 'var(--text-muted)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    marginBottom: -1,
                  }}
                >{t}</button>
              ))}
            </div>
            <div className="search-input-wrapper" style={{ width: 220 }}>
              <Search size={14} className="search-icon" />
              <input
                type="text"
                placeholder="Search orders…"
                className="search-input"
                id="orders-search"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Table / Type</th>
              <th>Staff</th>
              <th>Items</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((o) => (
              <tr key={o.id} id={`order-row-${o.id.replace('#', '')}`}>
                <td style={{ fontWeight: 600, color: 'var(--accent-blue)' }}>{o.id}</td>
                <td>{o.table}</td>
                <td style={{ color: 'var(--text-secondary)' }}>{o.staff}</td>
                <td style={{ color: 'var(--text-muted)' }}>{o.items} items</td>
                <td style={{ fontWeight: 700 }}>₹{o.amount.toLocaleString()}</td>
                <td><span className={`badge ${statusMap[o.status]}`}>{o.status}</span></td>
                <td style={{ color: 'var(--text-muted)', fontSize: 12.5 }}>{o.time}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="empty-state">
            <div className="empty-state-icon">🔍</div>
            <div className="empty-state-title">No orders found</div>
            <div className="empty-state-sub">Try adjusting your search or filters</div>
          </div>
        )}
      </div>
    </div>
  )
}
