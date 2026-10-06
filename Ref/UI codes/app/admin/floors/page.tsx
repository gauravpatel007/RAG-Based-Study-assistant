'use client'
import { useState, useEffect } from 'react'
import { Plus, Users, Settings, Trash2, X } from 'lucide-react'

const statusColors: Record<string, { badge: string }> = {
  available:   { badge: 'badge-green'  },
  occupied:    { badge: 'badge-orange' },
  reserved:    { badge: 'badge-blue'   },
  maintenance: { badge: 'badge-red'    },
}

export default function AdminFloorsPage() {
  const [floors, setFloors] = useState<any[]>([])
  const [activeFloorId, setActiveFloorId] = useState<number>(0)
  const [loading, setLoading] = useState(true)
  
  const [floorModalOpen, setFloorModalOpen] = useState(false)
  const [newFloorName, setNewFloorName] = useState('')

  const [tableModalOpen, setTableModalOpen] = useState(false)
  const [tableConfig, setTableConfig] = useState({ id: 0, name: '', capacity: 4 })
  const [isEditingTable, setIsEditingTable] = useState(false)
  const [tableCount, setTableCount] = useState(1)

  const fetchData = async () => {
    try {
      const res = await fetch('/api/floors')
      if (res.ok) {
        const data = await res.json()
        setFloors(data)
        if (data.length > 0 && activeFloorId === 0) {
          setActiveFloorId(data[0].id)
        } else if (data.length === 0) {
          setActiveFloorId(0)
        }
      }
    } catch (e) {
      console.error('Failed to load floors', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const activeFloor = floors.find(f => f.id === activeFloorId)

  const handleDeleteFloor = async (floorId: number) => {
    if (window.confirm('Are you sure you want to completely delete this floor and all its tables?')) {
      try {
        await fetch('/api/floors', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: floorId })
        })
        const remaining = floors.filter(f => f.id !== floorId)
        setActiveFloorId(remaining.length > 0 ? remaining[0].id : 0)
        await fetchData()
      } catch (e) {
        console.error('Delete floor failed', e)
      }
    }
  }

  const handleAddFloor = async () => {
    if (!newFloorName.trim()) return
    try {
      const res = await fetch('/api/floors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newFloorName.trim() })
      })
      if (res.ok) {
        const newFloor = await res.json()
        setActiveFloorId(newFloor.id)
        setFloorModalOpen(false)
        setNewFloorName('')
        await fetchData()
      }
    } catch (e) {
      console.error('Add floor failed', e)
    }
  }

  const handleSaveTable = async () => {
    if (!tableConfig.name.trim()) return
    try {
      const method = isEditingTable ? 'PUT' : 'POST'
      const body = isEditingTable
        ? { id: tableConfig.id, name: tableConfig.name, capacity: tableConfig.capacity }
        : { floor_id: activeFloorId, name: tableConfig.name, capacity: tableConfig.capacity, count: tableCount }
      
      const res = await fetch('/api/tables', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      if (res.ok) {
        setTableModalOpen(false)
        await fetchData()
      }
    } catch (e) {
      console.error('Save table failed', e)
    }
  }

  const handleDeleteTable = async (tableId: number) => {
    if (window.confirm('Delete this table?')) {
      try {
        await fetch('/api/tables', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: tableId })
        })
        await fetchData()
      } catch (e) {
        console.error('Delete table failed', e)
      }
    }
  }

  const openTableModal = (table?: any) => {
    if (table) {
      setTableConfig({ id: table.id, name: table.name, capacity: table.capacity })
      setIsEditingTable(true)
      setTableCount(1)
    } else {
      setTableConfig({ id: 0, name: 'Table', capacity: 4 })
      setIsEditingTable(false)
      setTableCount(1)
    }
    setTableModalOpen(true)
  }

  if (loading) return <div style={{ padding: 24 }}>Loading...</div>

  return (
    <div className="animate-fade-in" style={{ position: 'relative' }}>
      
      {/* Floor Modal */}
      {floorModalOpen && (
        <div style={{ position: 'fixed', top:0, left:0, right:0, bottom:0, background: 'rgba(0,0,0,0.5)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
           <div className="animate-slide-in" style={{ width: 380, background: 'var(--bg-card)', borderRadius: 16, padding: 24, boxShadow: 'var(--shadow-lg)' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
               <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>Add Floor</h3>
               <button onClick={() => setFloorModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
             </div>
             <div className="form-group">
                <label className="form-label">Floor Name</label>
                <input type="text" className="form-input" value={newFloorName} onChange={e => setNewFloorName(e.target.value)} placeholder="e.g. Patio" />
             </div>
             <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
               <button className="btn btn-ghost" onClick={() => setFloorModalOpen(false)}>Cancel</button>
               <button className="btn btn-primary" onClick={handleAddFloor}>Create Floor</button>
             </div>
           </div>
        </div>
      )}

      {/* Table Modal */}
      {tableModalOpen && (
        <div style={{ position: 'fixed', top:0, left:0, right:0, bottom:0, background: 'rgba(0,0,0,0.5)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
           <div className="animate-slide-in" style={{ width: 380, background: 'var(--bg-card)', borderRadius: 16, padding: 24, boxShadow: 'var(--shadow-lg)' }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
               <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>{isEditingTable ? 'Edit Table' : 'Add Table'}</h3>
               <button onClick={() => setTableModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
             </div>
             <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">Table Label</label>
                <input type="text" className="form-input" value={tableConfig.name} onChange={e => setTableConfig({...tableConfig, name: e.target.value})} placeholder="e.g. Table" />
             </div>
             <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
               <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Capacity</label>
                  <input type="number" className="form-input" value={tableConfig.capacity} onChange={e => setTableConfig({...tableConfig, capacity: Math.max(1, parseInt(e.target.value)||1)})} />
               </div>
               {!isEditingTable && (
                 <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Table Count</label>
                    <input type="number" className="form-input" value={tableCount} onChange={e => setTableCount(Math.max(1, parseInt(e.target.value)||1))} />
                 </div>
               )}
             </div>
             <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
               <button className="btn btn-ghost" onClick={() => setTableModalOpen(false)}>Cancel</button>
               <button className="btn btn-primary" onClick={handleSaveTable}>Save Table</button>
             </div>
           </div>
        </div>
      )}

      <div className="page-header">
        <div>
          <h1 className="page-title">Floor & Table Management</h1>
          <div className="page-subtitle">Configure restaurant floors and table layouts</div>
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary btn-sm" id="add-floor-btn" onClick={() => { setNewFloorName(''); setFloorModalOpen(true); }}>
            <Plus size={14} /> Add Floor
          </button>
          <button className="btn btn-primary btn-sm" id="add-table-btn" disabled={!activeFloor} onClick={() => openTableModal()}>
            <Plus size={14} /> Add Table
          </button>
        </div>
      </div>

      <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 20 }}>
        {[
          { label: 'Total Floors', value: floors.length, color: 'var(--text-primary)' },
          { label: 'Total Tables', value: floors.reduce((s,f) => s + (f.tables?.length || 0), 0), color: 'var(--accent-blue)' },
          { label: 'Total Capacity', value: floors.reduce((s,f) => s + (f.tables?.reduce((ts:number,t:any) => ts + t.capacity, 0) || 0), 0), color: 'var(--accent-green)' },
          { label: 'In Maintenance', value: floors.reduce((s,f) => s + (f.tables?.filter((t:any) => t.status === 'maintenance').length || 0), 0), color: 'var(--accent-red)' },
        ].map(s => (
          <div className="metric-card" key={s.label} style={{ padding: '16px 20px' }}>
            <div className="metric-label">{s.label}</div>
            <div className="metric-value" style={{ fontSize: 26, color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {floors.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', borderBottom: '1px solid var(--border-light)', marginBottom: 20 }}>
          <div style={{ display: 'flex', gap: 0, overflowX: 'auto' }}>
            {floors.map(f => (
              <button
                key={f.id}
                onClick={() => setActiveFloorId(f.id)}
                style={{
                  padding: '10px 22px', background: 'none', border: 'none',
                  borderBottom: activeFloorId === f.id ? '2px solid var(--text-primary)' : '2px solid transparent',
                  fontWeight: activeFloorId === f.id ? 700 : 500, fontSize: 13.5,
                  color: activeFloorId === f.id ? 'var(--text-primary)' : 'var(--text-muted)',
                  cursor: 'pointer', marginBottom: -1, whiteSpace: 'nowrap'
                }}
              >
                {f.name}
                <span style={{ marginLeft: 8, fontSize: 11, background: '#f0f0f0', borderRadius: 10, padding: '1px 7px', fontWeight: 600 }}>{f.tables?.length || 0}</span>
              </button>
            ))}
          </div>
          {activeFloor && (
            <button 
              className="btn btn-ghost btn-sm" 
              style={{ color: 'var(--accent-red)', marginBottom: 6 }} 
              onClick={() => handleDeleteFloor(activeFloor.id)}
            >
              <Trash2 size={13} /> Delete Floor
            </button>
          )}
        </div>
      )}

      {activeFloor && (
        <div className="table-card">
          <div className="table-header-row">
            <span className="table-title">{activeFloor.name} — {activeFloor.tables?.length || 0} tables</span>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Table</th>
                <th>Capacity</th>
                <th>Status</th>
                <th>Current Order</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {activeFloor.tables?.map((t:any) => (
                <tr key={t.id} id={`admin-table-${t.id}`}>
                  <td style={{ fontWeight: 700, fontSize: 16 }}>{t.name}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Users size={14} color="var(--text-muted)" />
                      {t.capacity} seats
                    </div>
                  </td>
                  <td><span className={`badge ${statusColors[t.status]?.badge || 'badge-gray'}`}>{t.status}</span></td>
                  <td style={{ color: t.current_order_id ? 'var(--accent-blue)' : 'var(--text-muted)', fontWeight: t.current_order_id ? 600 : 400 }}>
                    {t.current_order_id ? `#ORD-${String(t.current_order_id).padStart(4, '0')}` : '—'}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn btn-ghost btn-sm" onClick={() => openTableModal(t)}><Settings size={13} /></button>
                      <button className="btn btn-ghost btn-sm" style={{ color: 'var(--accent-red)' }} onClick={() => handleDeleteTable(t.id)}><Trash2 size={13} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(!activeFloor.tables || activeFloor.tables.length === 0) && (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No tables in this floor. Click "Add Table" to create one.
            </div>
          )}
        </div>
      )}
      
      {floors.length === 0 && (
        <div style={{ padding: '40px', textAlign: 'center', background: 'var(--bg-card)', borderRadius: 12 }}>
           <h3 style={{ fontSize: 18, marginBottom: 8, fontWeight: 700 }}>No Floors Configured</h3>
           <p style={{ color: 'var(--text-muted)', marginBottom: 20 }}>Create a floor to start mapping your restaurant layout.</p>
           <button className="btn btn-primary" onClick={() => { setNewFloorName(''); setFloorModalOpen(true); }}><Plus size={16} /> Add Floor</button>
        </div>
      )}
    </div>
  )
}
