'use client'
import { useState, useEffect } from 'react'
import { Plus, Users, Clock, ShoppingBag } from 'lucide-react'
import TableActionModal, {
  type CartItem,
  type FloorTable,
  type TableOrder,
  type ReservationInfo,
} from '@/components/TableActionModal'
import { floors as mockFloors } from '@/lib/mockData'

const statusColors: Record<string, { bg: string; border: string; badge: string }> = {
  available:   { bg: '#ffffff',  border: '#e5e5e5', badge: 'badge-green'  },
  occupied:    { bg: '#fff8ec',  border: '#f5a623', badge: 'badge-orange' },
  reserved:    { bg: '#f0f6ff',  border: '#006aff', badge: 'badge-blue'   },
  maintenance: { bg: '#fde8ea',  border: '#e22134', badge: 'badge-red'    },
}

const statusDot: Record<string, string> = {
  available:   '#00b259',
  occupied:    '#f5a623',
  reserved:    '#006aff',
  maintenance: '#e22134',
}

type FloorData = {
  id: number
  name: string
  tables: FloorTable[]
}

export default function POSFloorPage() {
  const [activeFloor, setActiveFloor] = useState(1)
  const [allFloors, setAllFloors] = useState<FloorData[]>([])
  const [tableOrders, setTableOrders] = useState<Record<number, TableOrder>>({})
  const [reservations, setReservations] = useState<Record<number, ReservationInfo>>({})
  const [selectedTable, setSelectedTable] = useState<FloorTable | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)

  useEffect(() => {
    fetch('/api/floors')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setAllFloors(data)
          setActiveFloor(data[0].id)
        } else {
          setAllFloors(mockFloors as any)
          setActiveFloor(mockFloors[0].id)
        }
      })
      .catch(() => {
        setAllFloors(mockFloors as any)
        setActiveFloor(mockFloors[0].id)
      })

    try {
      const sOrders = localStorage.getItem('floor_tableOrders')
      const sRes = localStorage.getItem('floor_reservations')
      if (sOrders) setTableOrders(JSON.parse(sOrders))
      if (sRes) setReservations(JSON.parse(sRes))
    } catch(e) {}
    setIsLoaded(true)
  }, [])

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('floor_tableOrders', JSON.stringify(tableOrders))
      localStorage.setItem('floor_reservations', JSON.stringify(reservations))
    }
  }, [allFloors, tableOrders, reservations, isLoaded])

  const floor = allFloors.find(f => f.id === activeFloor)
  if (!floor) return <div style={{ padding: 40 }}>Loading floor plan...</div>

  const counts = {
    available:   floor.tables.filter(t => t.status === 'available').length,
    occupied:    floor.tables.filter(t => t.status === 'occupied').length,
    reserved:    floor.tables.filter(t => t.status === 'reserved').length,
    maintenance: floor.tables.filter(t => t.status === 'maintenance').length,
  }

  const updateTable = (tableId: number, patch: Partial<FloorTable>) => {
    setAllFloors(prev => prev.map(f => ({
      ...f,
      tables: f.tables.map(t => t.id === tableId ? { ...t, ...patch } : t),
    })))
    setSelectedTable(prev => prev?.id === tableId ? { ...prev, ...patch } : prev)
  }

  const sendToKitchenAPI = async (dbOrderId: number) => {
    try {
      await fetch(`/api/orders/${dbOrderId}/send-to-kitchen`, {
        method: 'POST',
      })
    } catch(e) { console.error('Failed to send to kitchen via API', e) }
  }

  const handleBook = (tableId: number, info: ReservationInfo) => {
    const timeLabel = info.time
      ? new Date(`2000-01-01T${info.time}`).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : info.time
    setReservations(prev => ({ ...prev, [tableId]: info }))
    updateTable(tableId, { status: 'reserved', reservation: `${info.guestName} · ${timeLabel}` })
  }

  const handleStartOrder = async (tableId: number, items: CartItem[]) => {
    try {
      // Create order via API so it persists in the database
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_id: tableId,
          source: 'cashier',
          items: items.map(i => ({
            itemId: i.itemId,
            name: i.name,
            price: i.price,
            qty: i.qty,
            taxRate: i.taxRate,
            variant: i.variant || null,
          })),
        }),
      })
      if (!res.ok) throw new Error('Failed to create order')
      const order = await res.json()
      const orderId = order.order_number || `#ORD-${order.id}`
      
      setTableOrders(prev => ({
        ...prev,
        [tableId]: { orderId, items, status: 'active', startedAt: 'Just now', dbOrderId: order.id },
      }))
      updateTable(tableId, { status: 'occupied', order: orderId, duration: '0 min', amount: 0 })

      // Send to kitchen via DB API (creates kitchen_ticket in PostgreSQL)
      await sendToKitchenAPI(order.id)
    } catch (e) {
      console.error('Failed to start order', e)
    }
  }

  const handleAddItems = async (tableId: number, newItems: CartItem[]) => {
    const existing = tableOrders[tableId]
    if (!existing) return

    const merged = [...existing.items]
    for (const ni of newItems) {
      const found = merged.find(m => m.itemId === ni.itemId)
      if (found) found.qty += ni.qty
      else merged.push(ni)
    }
    const newTotal = merged.reduce((s, c) => s + c.price * c.qty * (1 + (c.taxRate||0)/100), 0)
    updateTable(tableId, { amount: Math.round(newTotal) })

    // Add items to existing DB order and send to kitchen
    if (existing.dbOrderId) {
      try {
        await fetch(`/api/orders/${existing.dbOrderId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            add_items: newItems.map(i => ({
              itemId: i.itemId,
              name: i.name,
              price: i.price,
              qty: i.qty,
              taxRate: i.taxRate,
              variant: i.variant || null,
            })),
          }),
        })
        await sendToKitchenAPI(existing.dbOrderId)
      } catch (e) {
        console.error('Failed to add items via API', e)
      }
    }

    setTableOrders(prev => ({ ...prev, [tableId]: { ...existing, items: merged } }))
  }

  const handleCheckout = (tableId: number) => {
    setTableOrders(prev => {
      const { [tableId]: _, ...rest } = prev
      return rest
    })
    setReservations(prev => {
      const { [tableId]: _, ...rest } = prev
      return rest
    })
    updateTable(tableId, { status: 'available', order: null, duration: undefined, amount: undefined })
  }

  const handleCancelReservation = (tableId: number) => {
    setReservations(prev => {
      const { [tableId]: _, ...rest } = prev
      return rest
    })
    updateTable(tableId, { status: 'available', reservation: undefined })
  }

  const handleSeatGuests = (tableId: number) => {
    updateTable(tableId, { status: 'occupied', reservation: undefined, duration: '0 min', amount: 0 })
    setReservations(prev => {
      const { [tableId]: _, ...rest } = prev
      return rest
    })
    const table = allFloors.flatMap(f => f.tables).find(t => t.id === tableId)
    if (table) setSelectedTable({ ...table, status: 'occupied' })
  }

  const openTable = (table: FloorTable) => {
    if (table.status === 'maintenance') return
    setSelectedTable(table)
  }

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ padding: '24px 32px 0 32px', flexShrink: 0 }}>
        <div className="page-header">
        <div>
          <h1 className="page-title">Floor Plan</h1>
          <div className="page-subtitle">Click any table to manage orders, reservations & payments</div>
        </div>
      </div>

      <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 20 }}>
        {[
          { label: 'Available',   count: counts.available,   color: '#00b259', light: '#e6f7ee' },
          { label: 'Occupied',    count: counts.occupied,    color: '#f5a623', light: '#fff8ec' },
          { label: 'Reserved',    count: counts.reserved,    color: '#006aff', light: '#e8f0ff' },
          { label: 'Maintenance', count: counts.maintenance, color: '#e22134', light: '#fde8ea' },
        ].map(s => (
          <div className="metric-card" key={s.label} style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: s.light, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: s.color }} />
            </div>
            <div>
              <div className="metric-label" style={{ marginBottom: 2 }}>{s.label}</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: s.color, lineHeight: 1 }}>{s.count}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '1px solid var(--border-light)' }}>
        {allFloors.map(f => (
          <button
            key={f.id}
            onClick={() => setActiveFloor(f.id)}
            id={`floor-tab-${f.id}`}
            style={{
              padding: '10px 22px', background: 'none', border: 'none',
              borderBottom: activeFloor === f.id ? '2px solid var(--text-primary)' : '2px solid transparent',
              fontWeight: activeFloor === f.id ? 700 : 500, fontSize: 13.5,
              color: activeFloor === f.id ? 'var(--text-primary)' : 'var(--text-muted)',
              cursor: 'pointer', marginBottom: -1,
            }}
          >
            {f.name}
            <span style={{ marginLeft: 8, fontSize: 11, background: '#f0f0f0', borderRadius: 10, padding: '1px 7px', fontWeight: 600 }}>{f.tables.length}</span>
          </button>
        ))}
      </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '0 32px 24px 32px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(168px, 1fr))', gap: 14 }}>
          {floor.tables.map(table => {
          const s = statusColors[table.status] || statusColors.available
          const dot = statusDot[table.status]
          const order = tableOrders[table.id]
          const orderTotal = order
            ? order.items.reduce((sum, c) => sum + c.price * c.qty * (1 + c.taxRate / 100), 0)
            : 0
          const res = reservations[table.id]
          const isMaint = table.status === 'maintenance'

          return (
            <div
              key={table.id}
              id={`table-card-${table.id}`}
              onClick={() => openTable(table)}
              style={{
                background: s.bg, border: `1.5px solid ${s.border}`, borderRadius: 14,
                padding: '16px 14px', cursor: isMaint ? 'not-allowed' : 'pointer',
                transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                position: 'relative', opacity: isMaint ? 0.65 : 1, textAlign: 'center',
              }}
              onMouseEnter={e => { if (!isMaint) { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.12)' }}}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none' }}
            >
              <div style={{ position: 'absolute', top: 10, right: 10, width: 8, height: 8, borderRadius: '50%', background: dot, boxShadow: `0 0 0 2px ${dot}33` }} />
              <div style={{ fontSize: 24, fontWeight: 800, marginBottom: 2 }}>{table.name}</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 10 }}>
                <Users size={11} /> {table.capacity} seats
              </div>
              <span className={`badge ${s.badge}`} style={{ justifyContent: 'center' }}>{table.status}</span>

              {table.status === 'occupied' && (
                <div style={{ marginTop: 10, padding: '8px', background: 'rgba(245,166,35,0.08)', borderRadius: 8 }}>
                  {order ? (
                    <>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: 11, color: 'var(--accent-orange)', fontWeight: 700, marginBottom: 3 }}>
                        <Clock size={10} /> {table.duration || '0 min'}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 800 }}>₹{orderTotal.toFixed(0)}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                        {order.items.reduce((s, c) => s + c.qty, 0)} items · {order.orderId}
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: 11.5, color: 'var(--accent-orange)', fontWeight: 600 }}>
                      {table.duration && <><Clock size={10} style={{ display: 'inline', marginRight: 3 }} />{table.duration}</>}
                    </div>
                  )}
                </div>
              )}

              {table.status === 'reserved' && (
                <div style={{ marginTop: 10, fontSize: 11.5, color: 'var(--accent-blue)', fontWeight: 600 }}>
                  {res ? `${res.guestName} · ${res.time}` : table.reservation}
                </div>
              )}

              {table.status === 'available' && (
                <div style={{ marginTop: 10, display: 'flex', justifyContent: 'center', gap: 6 }}>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
                    <ShoppingBag size={9} /> Order
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>or</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>📅 Reserve</div>
                </div>
              )}
            </div>
          )
        })}
        </div>
      </div>

      <TableActionModal
        table={selectedTable}
        tableOrder={selectedTable ? tableOrders[selectedTable.id] : undefined}
        reservation={selectedTable ? reservations[selectedTable.id] : undefined}
        onClose={() => setSelectedTable(null)}
        onBook={handleBook}
        onStartOrder={handleStartOrder}
        onAddItems={handleAddItems}
        onCheckout={handleCheckout}
        onCancelReservation={handleCancelReservation}
        onSeatGuests={handleSeatGuests}
      />
    </div>
  )
}
