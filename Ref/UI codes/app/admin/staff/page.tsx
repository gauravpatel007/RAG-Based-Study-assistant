'use client'
import { useState } from 'react'
import { staffMembers as initialStaff } from '@/lib/mockData'
import { UserPlus, X } from 'lucide-react'
import { useLocalStorageState } from '@/hooks/useLocalStorageState'

const statusStyle: Record<string, string> = {
  active: 'badge-green',
  break:  'badge-orange',
  off:    'badge-gray',
}

const roleColors: Record<string, string> = {
  Manager: 'badge-purple',
  Cashier: 'badge-blue',
  Waiter:  'badge-gray',
  Kitchen: 'badge-orange',
}

export default function StaffPage() {
  const [staffList, setStaffList] = useLocalStorageState('admin_staff', initialStaff)
  const [modalOpen, setModalOpen] = useState(false)
  
  const [newStaff, setNewStaff] = useState({ name: '', role: 'Cashier' })

  const handleAddStaff = () => {
    if (!newStaff.name.trim()) return
    setStaffList([
      {
        id: Math.max(0, ...staffList.map(s => s.id)) + 1,
        name: newStaff.name.trim(),
        role: newStaff.role,
        shift: 'Morning (8AM - 4PM)',
        orders: 0,
        sales: 0,
        status: 'off',
        avatar: newStaff.name.trim().substring(0,2).toUpperCase()
      },
      ...staffList
    ])
    setNewStaff({ name: '', role: 'Cashier' })
    setModalOpen(false)
  }

  return (
    <div className="animate-fade-in" style={{ position: 'relative' }}>
      
      {/* ADD STAFF MODAL */}
      {modalOpen && (
        <div style={{ position: 'fixed', top:0, left:0, right:0, bottom:0, background: 'rgba(0,0,0,0.5)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
           <div className="animate-slide-in" style={{ width: 380, background: 'var(--bg-card)', borderRadius: 16, padding: 24, boxShadow: 'var(--shadow-lg)' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
               <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Add Staff Member</h3>
               <button onClick={() => setModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
             </div>
             
             <div className="form-group">
                <label className="form-label">Full Name</label>
                <input type="text" className="form-input" value={newStaff.name} onChange={e => setNewStaff({...newStaff, name: e.target.value})} placeholder="e.g. Riya S." />
             </div>
             
             <div className="form-group" style={{ marginBottom: 24 }}>
                <label className="form-label">Role</label>
                <select className="form-input form-select" value={newStaff.role} onChange={e => setNewStaff({...newStaff, role: e.target.value})}>
                   <option value="Manager">Manager / Admin</option>
                   <option value="Cashier">Cashier</option>
                   <option value="Waiter">Waiter / Floor Staff</option>
                   <option value="Kitchen">Kitchen Staff</option>
                </select>
             </div>
             
             <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
               <button className="btn btn-ghost" onClick={() => setModalOpen(false)}>Cancel</button>
               <button className="btn btn-primary" onClick={handleAddStaff} disabled={!newStaff.name.trim()}>Create</button>
             </div>
           </div>
        </div>
      )}

      <div className="page-header">
        <div>
          <h1 className="page-title">Staff</h1>
          <div className="page-subtitle">Manage team members and shift performance</div>
        </div>
        <div className="header-actions">
          <button className="btn btn-primary btn-sm" id="add-staff-btn" onClick={() => { setNewStaff({name:'', role:'Cashier'}); setModalOpen(true); }}>
            <UserPlus size={14} /> Add Staff
          </button>
        </div>
      </div>

      <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 24 }}>
        {[
          { label: 'On Shift',   value: staffList.filter(s => s.status === 'active').length, color: 'var(--accent-green)'  },
          { label: 'On Break',   value: staffList.filter(s => s.status === 'break').length,  color: 'var(--accent-orange)' },
          { label: 'Off Today',  value: staffList.filter(s => s.status === 'off').length,    color: 'var(--text-muted)'    },
          { label: 'Total Staff',value: staffList.length,                                     color: 'var(--text-primary)'  },
        ].map(s => (
          <div className="metric-card" key={s.label} style={{ padding: '16px 20px' }}>
            <div className="metric-label">{s.label}</div>
            <div className="metric-value" style={{ fontSize: 26, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="table-card">
        <div className="table-header-row">
          <span className="table-title">Team Members</span>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Staff Member</th>
              <th>Role</th>
              <th>Shift</th>
              <th>Orders Served</th>
              <th>Sales</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {staffList.map(s => (
              <tr key={s.id} id={`staff-row-${s.id}`}>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div className="avatar">{s.avatar}</div>
                    <span style={{ fontWeight: 600 }}>{s.name}</span>
                  </div>
                </td>
                <td><span className={`badge ${roleColors[s.role]}`}>{s.role}</span></td>
                <td style={{ color: 'var(--text-secondary)', fontSize: 12.5 }}>{s.shift}</td>
                <td style={{ fontWeight: 600 }}>{s.orders > 0 ? s.orders : '—'}</td>
                <td style={{ fontWeight: 700, color: s.sales > 0 ? 'var(--accent-green)' : 'var(--text-muted)' }}>
                  {s.sales > 0 ? `₹${s.sales.toLocaleString()}` : '—'}
                </td>
                <td><span className={`badge ${statusStyle[s.status]}`}>{s.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
