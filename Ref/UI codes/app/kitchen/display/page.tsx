'use client'
import { useState, useEffect } from 'react'
import { Clock, Flame, AlertTriangle, RefreshCw, ChevronLeft, RotateCcw } from 'lucide-react'
import { kitchenTickets as mockKitchenTickets } from '@/lib/mockData'

const priorityConfig: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  normal: { label: 'Normal', color: 'var(--text-muted)',    bg: '#f5f5f5',              icon: null           },
  high:   { label: 'High',   color: 'var(--accent-orange)', bg: 'var(--accent-orange-light)', icon: Flame   },
  urgent: { label: 'Urgent', color: 'var(--accent-red)',    bg: 'var(--accent-red-light)',    icon: AlertTriangle },
}

const statusConfig: Record<string, { label: string; bg: string; border: string; headerBg: string }> = {
  to_cook:   { label: 'To Cook',   bg: '#fff5f5', border: '#e22134', headerBg: '#fde8ea' },
  preparing: { label: 'Preparing', bg: '#fffbf0', border: '#f5a623', headerBg: '#fff3cd' },
  completed: { label: 'Completed', bg: '#f0fdf6', border: '#00b259', headerBg: '#dcfce7' },
}

const STATUS_ORDER = ['to_cook', 'preparing', 'completed'] as const
type TicketStatus = typeof STATUS_ORDER[number]

function formatElapsed(sec: number): string {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export default function KitchenDisplayPage() {
  const [tickets, setTickets] = useState<any[]>([])
  const [kitchenFilter, setKitchenFilter] = useState('All Kitchens')
  const [lastReset, setLastReset] = useState<Date | null>(null)

  useEffect(() => {
    setLastReset(new Date())
  }, [])

  const fetchTickets = async () => {
    try {
      const res = await fetch('/api/kitchen/tickets')
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data) && data.length > 0) {
          setTickets(prev => data.map((newT: any) => {
            const oldT = prev.find((t: any) => t.id === newT.id)
            if (oldT && newT.status !== 'completed' && newT.status !== 'served') {
              return { ...newT, elapsed_seconds: oldT.elapsed_seconds }
            }
            return newT
          }))
          return
        }
      }
    } catch (e) {
      console.error('API unavailable, using preview kitchen tickets', e)
    }
    setTickets(prev => prev.length > 0 ? prev : (mockKitchenTickets as any))
  }

  // Poll every 3 seconds
  useEffect(() => {
    fetchTickets()
    const int = setInterval(fetchTickets, 3000)
    return () => clearInterval(int)
  }, [])

  // Local clock tick for smooth counter
  useEffect(() => {
    const int = setInterval(() => {
      setTickets(prev => prev.map(t => {
        if (t.status === 'completed' || t.status === 'served') return t
        return { ...t, elapsed_seconds: (t.elapsed_seconds || 0) + 1 }
      }))
    }, 1000)
    return () => clearInterval(int)
  }, [])

  const advance = async (id: number) => {
    // Optimistic
    setTickets(prev => prev.map(t => {
      if (t.id !== id) return t
      const idx = STATUS_ORDER.indexOf(t.status as TicketStatus)
      if (idx === STATUS_ORDER.length - 1) return { ...t, status: 'served' }
      return { ...t, status: STATUS_ORDER[idx + 1] }
    }).filter(t => t.status !== 'served'))
    
    await fetch(`/api/kitchen/tickets/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'advance' })
    })
    fetchTickets()
  }

  const goBack = async (id: number) => {
    setTickets(prev => prev.map(t => {
      if (t.id !== id) return t
      const idx = STATUS_ORDER.indexOf(t.status as TicketStatus)
      if (idx <= 0) return t
      return { ...t, status: STATUS_ORDER[idx - 1] }
    }))

    await fetch(`/api/kitchen/tickets/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'go_back' })
    })
    fetchTickets()
  }

  const toggleItem = async (ticketId: number, itemIdx: number) => {
    setTickets(prev => prev.map(t => {
      if (t.id !== ticketId) return t
      const newItems = [...t.items]
      newItems[itemIdx] = { ...newItems[itemIdx], done: !newItems[itemIdx].done }
      return { ...t, items: newItems }
    }))

    await fetch(`/api/kitchen/tickets/${ticketId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle_item', item_index: itemIdx })
    })
  }

  const resetAll = () => { 
    fetchTickets()
    setLastReset(new Date()) 
  }

  const colCounts: Record<string, number> = {
    to_cook: tickets.filter(t => t.status === 'to_cook').length,
    preparing: tickets.filter(t => t.status === 'preparing').length,
    completed: tickets.filter(t => t.status === 'completed').length,
  }

  const getEffectivePriority = (t: any) => {
    if (t.status === 'to_cook' && (t.elapsed_seconds || 0) > 600) return 'urgent'
    return t.priority || 'normal'
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Kitchen Display</h1>
          <div className="page-subtitle">
            Live ticket board — last reset {lastReset ? lastReset.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--'}
          </div>
        </div>
        <div className="header-actions">
          <select className="form-input form-select" style={{ width: 164, padding: '6px 12px', fontSize: 13 }}
            value={kitchenFilter} onChange={e => setKitchenFilter(e.target.value)} id="kitchen-filter">
            <option value="All Kitchens">All Kitchens</option>
            <option value="Main Kitchen">Main Kitchen</option>
            <option value="Beverage Station">Beverage Station</option>
          </select>
          <button onClick={resetAll} className="btn btn-secondary btn-sm" id="reset-all-btn" title="Refresh">
            <RefreshCw size={13} /> Refresh
          </button>
          <span className="badge badge-green" style={{ fontSize: 12 }}>● Live</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
        {(Object.keys(statusConfig) as TicketStatus[]).map(col => {
          const colTickets = tickets.filter(t => t.status === col)
          const cfg = statusConfig[col]
          return (
            <div key={col}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, padding: '8px 12px', background: cfg.headerBg, borderRadius: 10, border: `1px solid ${cfg.border}33` }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: cfg.border, textTransform: 'uppercase', letterSpacing: '0.08em', flex: 1 }}>{cfg.label}</span>
                <span style={{ background: cfg.border, color: 'white', fontSize: 11, fontWeight: 800, borderRadius: 20, padding: '2px 9px', minWidth: 24, textAlign: 'center' }}>{colCounts[col]}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {colTickets.map(ticket => {
                  const effPri = getEffectivePriority(ticket)
                  const pri = priorityConfig[effPri] || priorityConfig.normal
                  const PriIcon = pri.icon
                  const canGoBack = STATUS_ORDER.indexOf(ticket.status as TicketStatus) > 0
                  const isOverdue = (ticket.elapsed_seconds || 0) > 900

                  return (
                    <div key={ticket.id} id={`ticket-${ticket.id}`} style={{
                      background: cfg.bg, border: `1.5px solid ${isOverdue ? '#e22134' : cfg.border}`,
                      borderRadius: 12, overflow: 'hidden',
                      boxShadow: effPri === 'urgent' ? `0 0 0 2px ${pri.color}33` : 'none',
                    }}>
                      {effPri !== 'normal' && (
                        <div style={{ background: pri.bg, color: pri.color, padding: '4px 14px', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5, borderBottom: `1px solid ${pri.color}33` }}>
                          {PriIcon && <PriIcon size={11} />} {pri.label} Priority {isOverdue && ' · ⚠️ Overdue'}
                        </div>
                      )}
                      <div style={{ padding: 14 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                          <div>
                            <div style={{ fontWeight: 800, fontSize: 15 }}>{ticket.table}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{ticket.orderId}</div>
                          </div>
                          {canGoBack && (
                            <button onClick={() => goBack(ticket.id)} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border-default)', background: 'white', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }} id={`back-ticket-${ticket.id}`}>
                              <ChevronLeft size={12} /> Back
                            </button>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 700, marginBottom: 10, color: isOverdue ? 'var(--accent-red)' : 'var(--text-secondary)' }}>
                          <Clock size={13} /> {formatElapsed(ticket.elapsed_seconds || 0)}
                          {isOverdue && <span style={{ fontSize: 10, background: 'var(--accent-red-light)', color: 'var(--accent-red)', padding: '1px 6px', borderRadius: 10, fontWeight: 700 }}>OVERDUE</span>}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 12 }}>
                          {ticket.items?.map((item: any, i: number) => (
                            <div key={i} onClick={() => toggleItem(ticket.id, i)} style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: item.done ? 'line-through' : 'none', color: item.done ? 'var(--text-muted)' : 'var(--text-primary)', cursor: 'pointer', padding: '5px 6px', borderRadius: 6, userSelect: 'none' }}>
                              <div style={{ width: 18, height: 18, borderRadius: 4, flexShrink: 0, border: `1.5px solid ${item.done ? 'var(--accent-green)' : cfg.border}`, background: item.done ? 'var(--accent-green)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {item.done && <span style={{ color: 'white', fontSize: 10, fontWeight: 700 }}>✓</span>}
                              </div>
                              <span style={{ fontWeight: 500, fontSize: 13, flex: 1 }}>{item.qty}× {item.name}</span>
                            </div>
                          ))}
                        </div>
                        <div style={{ height: 4, background: '#e5e5e5', borderRadius: 10, overflow: 'hidden', marginBottom: 12 }}>
                          <div style={{ height: '100%', width: `${((ticket.items?.filter((i:any) => i.done).length || 0) / Math.max(1, (ticket.items?.length || 1))) * 100}%`, background: cfg.border, borderRadius: 10, transition: 'width 0.4s ease' }} />
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <button onClick={() => advance(ticket.id)} id={`advance-ticket-${ticket.id}`} style={{
                            flex: 1, padding: '8px 0',
                            background: ticket.status === 'completed' ? 'var(--accent-green)' : ticket.status === 'to_cook' ? '#e22134' : '#f5a623',
                            color: 'white', border: 'none', borderRadius: 7, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                          }}>
                            {ticket.status === 'to_cook' ? '▶ Start Preparing' : ticket.status === 'preparing' ? '✓ Mark Complete' : '🍽 Mark Served'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )
                })}
                {colTickets.length === 0 && (
                  <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, border: '2px dashed var(--border-light)', borderRadius: 12, background: '#fafafa' }}>
                    <div style={{ fontSize: 24, marginBottom: 6 }}>{col === 'to_cook' ? '🍳' : col === 'preparing' ? '👨‍🍳' : '✅'}</div>
                    No tickets
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
