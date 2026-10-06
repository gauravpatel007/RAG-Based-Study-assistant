'use client'
import { useState } from 'react'
import { Search, UserPlus, X } from 'lucide-react'
import { customers as initialCustomers } from '@/lib/mockData'
import { useLocalStorageState } from '@/hooks/useLocalStorageState'

const loyaltyStyle: Record<string, string> = {
  Platinum: 'badge-purple',
  Gold:     'badge-orange',
  Silver:   'badge-blue',
  Bronze:   'badge-gray',
}

export default function CustomersPage() {
  const [customersList, setCustomersList] = useLocalStorageState('admin_customers', initialCustomers)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [newCust, setNewCust] = useState({ name: '', phone: '', email: '' })

  const handleAddCustomer = () => {
    if (!newCust.name.trim() || !newCust.phone.trim()) return
    
    setCustomersList([
      {
        id: Math.max(0, ...customersList.map(c => c.id)) + 1,
        name: newCust.name,
        phone: newCust.phone,
        visits: 0,
        totalSpend: 0,
        lastVisit: 'New',
        loyalty: 'Bronze'
      },
      ...customersList
    ])
    setNewCust({ name: '', phone: '', email: '' })
    setModalOpen(false)
  }

  const filtered = customersList.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search)
  )

  return (
    <div className="animate-fade-in" style={{ position: 'relative' }}>
      
      {/* ADD CUSTOMER MODAL */}
      {modalOpen && (
        <div style={{ position: 'fixed', top:0, left:0, right:0, bottom:0, background: 'rgba(0,0,0,0.5)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
           <div className="animate-slide-in" style={{ width: 400, background: 'var(--bg-card)', borderRadius: 16, padding: 24, boxShadow: 'var(--shadow-lg)' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
               <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Add Customer</h3>
               <button onClick={() => setModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
             </div>
             
             <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input type="text" className="form-input" value={newCust.name} onChange={e => setNewCust({...newCust, name: e.target.value})} placeholder="e.g. John Doe" />
             </div>
             <div className="form-group">
                <label className="form-label">Phone Number *</label>
                <input type="tel" className="form-input" value={newCust.phone} onChange={e => setNewCust({...newCust, phone: e.target.value})} placeholder="+91 98765 43210" />
             </div>
             <div className="form-group" style={{ marginBottom: 24 }}>
                <label className="form-label">Email (Optional)</label>
                <input type="email" className="form-input" value={newCust.email} onChange={e => setNewCust({...newCust, email: e.target.value})} placeholder="john@example.com" />
             </div>
             
             <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
               <button className="btn btn-ghost" onClick={() => setModalOpen(false)}>Cancel</button>
               <button className="btn btn-primary" onClick={handleAddCustomer} disabled={!newCust.name || !newCust.phone}>Save</button>
             </div>
           </div>
        </div>
      )}

      <div className="page-header">
        <div>
          <h1 className="page-title">Customers</h1>
          <div className="page-subtitle">{customersList.length} registered customers</div>
        </div>
        <div className="header-actions">
          <button className="btn btn-primary btn-sm" id="add-customer-btn" onClick={() => { setNewCust({name:'', phone:'', email:''}); setModalOpen(true); }}>
            <UserPlus size={14} /> Add Customer
          </button>
        </div>
      </div>

      <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 20 }}>
        {[
          { label: 'Total Customers', value: customersList.length,                         color: 'var(--text-primary)'  },
          { label: 'Visited Today',   value: customersList.filter(c => c.lastVisit === 'Today').length, color: 'var(--accent-green)' },
          { label: 'Platinum / Gold', value: customersList.filter(c => ['Platinum','Gold'].includes(c.loyalty)).length, color: 'var(--accent-orange)' },
          { label: 'Avg. Spend',      value: `₹${Math.round(customersList.reduce((s,c)=>s+c.totalSpend,0)/(customersList.length||1)).toLocaleString()}`, color: 'var(--accent-blue)' },
        ].map(s => (
          <div className="metric-card" key={s.label} style={{ padding: '16px 20px' }}>
            <div className="metric-label">{s.label}</div>
            <div className="metric-value" style={{ fontSize: 22, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="table-card">
        <div className="table-header-row">
          <span className="table-title">Customer Directory</span>
          <div className="search-input-wrapper" style={{ width: 220 }}>
            <Search size={14} className="search-icon" />
            <input
              type="text"
              placeholder="Search customers…"
              className="search-input"
              id="customers-search"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Phone</th>
              <th>Total Visits</th>
              <th>Total Spend</th>
              <th>Last Visit</th>
              <th>Loyalty</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => (
              <tr key={c.id} id={`customer-row-${c.id}`}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div className="avatar" style={{ width: 30, height: 30, fontSize: 11 }}>
                      {c.name.split(' ').map(w => w[0]).join('').substring(0,2).toUpperCase()}
                    </div>
                    <span style={{ fontWeight: 600 }}>{c.name}</span>
                  </div>
                </td>
                <td style={{ color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: 12.5 }}>{c.phone}</td>
                <td style={{ fontWeight: 600 }}>{c.visits}</td>
                <td style={{ fontWeight: 700 }}>₹{c.totalSpend.toLocaleString()}</td>
                <td style={{ color: 'var(--text-muted)', fontSize: 12.5 }}>{c.lastVisit}</td>
                <td><span className={`badge ${loyaltyStyle[c.loyalty]}`}>{c.loyalty}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
            No customers match your search.
          </div>
        )}
      </div>
    </div>
  )
}
