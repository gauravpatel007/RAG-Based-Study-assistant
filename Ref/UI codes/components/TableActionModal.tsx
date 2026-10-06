import { useState, useEffect, useRef, useCallback } from 'react'
import {
  X, Users, Clock, ShoppingBag, Plus, Minus, CreditCard,
  CheckCircle2, Calendar, ChefHat, Trash2, Search,
  Smartphone, Banknote, LayoutGrid, AlertCircle, Star, Loader2, QrCode
} from 'lucide-react'
import { QRCodeCanvas } from 'qrcode.react'
// ─── Types ────────────────────────────────────────────────────────
export type CartItem = {
  id: string
  itemId: number
  name: string
  price: number
  qty: number
  taxRate: number
  variant?: string
}

export type TableOrder = {
  orderId: string
  items: CartItem[]
  status: 'active' | 'kitchen' | 'paid'
  startedAt: string
  dbOrderId?: number
}

export type ReservationInfo = {
  guestName: string
  phone: string
  guests: number
  time: string
  notes: string
}

export type FloorTable = {
  id: number
  name: string
  capacity: number
  status: string
  order?: string | null
  duration?: string
  amount?: number
  reservation?: string
}

type Props = {
  table: FloorTable | null
  tableOrder?: TableOrder
  reservation?: ReservationInfo
  onClose: () => void
  onBook: (tableId: number, info: ReservationInfo) => void
  onStartOrder: (tableId: number, items: CartItem[]) => void
  onAddItems: (tableId: number, items: CartItem[]) => void
  onCheckout: (tableId: number) => void
  onCancelReservation: (tableId: number) => void
  onSeatGuests: (tableId: number) => void
}

const categoryEmoji: Record<string, string> = {
  All: '🍽️', Breakfast: '🌅', 'Main Course': '🍛',
  Beverages: '☕', Desserts: '🍮', Snacks: '🥪',
}

const paymentMethods = [
  { id: 'cash', label: 'Cash', icon: Banknote, color: '#1a1a1a' },
  { id: 'upi',  label: 'UPI',  icon: Smartphone, color: '#006aff' },
  { id: 'card', label: 'Card', icon: CreditCard, color: '#00b259' },
]

// ─── Main Component ───────────────────────────────────────────────
export default function TableActionModal({
  table, tableOrder, reservation, onClose,
  onBook, onStartOrder, onAddItems, onCheckout,
  onCancelReservation, onSeatGuests
}: Props) {
  // Tabs: 'overview' | 'order' | 'reserve' | 'payment'
  const [activeTab, setActiveTab] = useState<'overview' | 'order' | 'reserve' | 'payment'>(
    table?.status === 'occupied' ? 'order' :
    table?.status === 'reserved' ? 'overview' : 'overview'
  )

  // Order builder
  const [cart, setCart] = useState<CartItem[]>(tableOrder?.items || [])
  const [activeCategory, setActiveCategory] = useState('All')
  const [itemSearch, setItemSearch] = useState('')

  // Reservation form
  const [resForm, setResForm] = useState<ReservationInfo>(reservation || {
    guestName: '', phone: '', guests: 2, time: '', notes: ''
  })
  const [resErrors, setResErrors] = useState<Partial<ReservationInfo>>({})

  // Payment
  const [payMethod, setPayMethod] = useState('cash')
  const [cashGiven, setCashGiven] = useState('')
  const [payDone, setPayDone] = useState(false)

  // Stripe
  const [stripeSession, setStripeSession] = useState<{ sessionId: string, paymentUrl: string } | null>(null)
  const [paymentStep, setPaymentStep] = useState<'select' | 'processing' | 'qr' | 'success'>('select')
  const [stripeError, setStripeError] = useState<string | null>(null)
  const [pollCount, setPollCount] = useState(0)
  const pollRef = useRef<NodeJS.Timeout | null>(null)
  const [qrPulse, setQrPulse] = useState(false)

  // Feedback
  const [feedbackRating, setFeedbackRating] = useState<number>(0)
  const [feedbackComment, setFeedbackComment] = useState('')
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false)

  // DB Products
  const [menuItems, setMenuItems] = useState<any[]>([])
  const [menuCategories, setMenuCategories] = useState<string[]>(['All'])

  useEffect(() => {
    if (activeTab === 'order' && menuItems.length === 0) {
      fetch('/api/products').then(r => r.json()).then(setMenuItems).catch(console.error)
      fetch('/api/categories').then(r => r.json()).then(c => setMenuCategories(['All', ...c.map((cat: any) => cat.name)])).catch(console.error)
    }
  }, [activeTab, menuItems.length])

  // Cleanup polling
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  // QR pulse
  useEffect(() => {
    if (paymentStep === 'qr') {
      const t = setInterval(() => setQrPulse(p => !p), 1500)
      return () => clearInterval(t)
    }
  }, [paymentStep])

  const startPolling = useCallback((sessionId: string) => {
    if (pollRef.current) clearInterval(pollRef.current)
    pollRef.current = setInterval(async () => {
      try {
        setPollCount(c => c + 1)
        const res = await fetch(`/api/stripe/check-status?sessionId=${sessionId}`)
        if (!res.ok) return
        const data = await res.json()
        if (data.status === 'paid') {
          clearInterval(pollRef.current!)
          pollRef.current = null
          setPaymentStep('success')
          setTimeout(() => setPayDone(true), 1500)
        }
      } catch (err) {
        console.error('Polling error:', err)
      }
    }, 3000)
  }, [])

  if (!table) return null

  const isAvailable   = table.status === 'available'
  const isOccupied    = table.status === 'occupied'
  const isReserved    = table.status === 'reserved'
  const isMaintenance = table.status === 'maintenance'

  const filteredItems = menuItems.filter(item => {
    const matchCat = activeCategory === 'All' || item.category === activeCategory
    const matchSearch = item.name.toLowerCase().includes(itemSearch.toLowerCase())
    return matchCat && matchSearch && item.stock !== 'out'
  })

  const addItem = (item: any) => {
    const existing = cart.find(c => c.itemId === item.id)
    if (existing) {
      setCart(cart.map(c => c.id === existing.id ? { ...c, qty: c.qty + 1 } : c))
    } else {
      setCart([...cart, {
        id: Math.random().toString(36).substr(2, 9),
        itemId: item.id, name: item.name, price: item.price,
        qty: 1, taxRate: item.tax
      }])
    }
  }

  const updateQty = (id: string, delta: number) => {
    setCart(cart.map(c => c.id === id ? { ...c, qty: Math.max(0, c.qty + delta) } : c).filter(c => c.qty > 0))
  }

  const subtotal  = cart.reduce((s, c) => s + c.price * c.qty, 0)
  const taxTotal  = cart.reduce((s, c) => s + c.price * c.qty * (c.taxRate / 100), 0)
  const grandTotal = subtotal + taxTotal

  const cartFromOrder = tableOrder?.items || []
  const orderSubtotal = cartFromOrder.reduce((s, c) => s + c.price * c.qty, 0)
  const orderTax      = cartFromOrder.reduce((s, c) => s + c.price * c.qty * (c.taxRate / 100), 0)
  const orderTotal    = orderSubtotal + orderTax

  const cashGivenNum = parseFloat(cashGiven) || 0
  const change = cashGivenNum - orderTotal

  // ── Reservation validation ────────────────────────────────────
  const validateReservation = () => {
    const errs: Partial<ReservationInfo> = {}
    if (!resForm.guestName.trim()) errs.guestName = 'Guest name required'
    if (!resForm.time.trim()) errs.time = 'Time required'
    setResErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleBook = () => {
    if (validateReservation()) {
      onBook(table.id, resForm)
      onClose()
    }
  }

  const handleStartOrder = () => {
    if (cart.length === 0) return
    onStartOrder(table.id, cart)
    onClose()
  }

  const handleAddItems = () => {
    if (cart.length === 0) return
    onAddItems(table.id, cart)
    onClose()
  }

  const cancelSession = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    setStripeSession(null)
    setPaymentStep('select')
    setStripeError(null)
    setPollCount(0)
  }

  const completeCheckoutAndClose = () => {
    onCheckout(table.id)
    onClose()
  }

  const submitFeedback = async () => {
    if (feedbackRating > 0 && tableOrder?.orderId) {
      setIsSubmittingFeedback(true)
      try {
        let numericOrderId = parseInt(tableOrder.orderId.replace(/[^0-9]/g, ''), 10)
        if (isNaN(numericOrderId)) numericOrderId = table.id // fallback just for mock
        await fetch('/api/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: numericOrderId, rating: feedbackRating, comment: feedbackComment })
        })
      } catch(e) {
        console.error('Feedback error', e)
      }
    }
    completeCheckoutAndClose()
  }

  const handlePayment = async () => {
    if (payMethod === 'cash') {
      if (cashGivenNum < orderTotal) return
      setPaymentStep('success')
      setTimeout(() => setPayDone(true), 1500)
    } else {
      // Stripe flow
      setPaymentStep('processing')
      setStripeError(null)
      try {
        const res = await fetch('/api/stripe/create-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: orderTotal, method: { name: payMethod }, orderId: tableOrder?.orderId || table.order || 'FLOOR-ORDER' }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to create session')
        setStripeSession({ sessionId: data.sessionId, paymentUrl: data.paymentUrl })
        setPaymentStep('qr')
        setPollCount(0)
        startPolling(data.sessionId)
      } catch (err: any) {
        console.error('Stripe session error:', err)
        setStripeError(err.message)
        setPaymentStep('select')
      }
    }
  }

  // ── Tab bar config ────────────────────────────────────────────
  const tabs = [
    { id: 'overview', label: 'Overview', show: true },
    { id: 'order',    label: isOccupied ? 'Add Items' : 'New Order', show: !isMaintenance },
    { id: 'reserve',  label: 'Reserve', show: isAvailable },
    { id: 'payment',  label: '💳 Checkout', show: isOccupied },
  ] as const

  // ── Status badge ──────────────────────────────────────────────
  const statusInfo: Record<string, { color: string; bg: string; label: string }> = {
    available:   { color: '#00b259', bg: '#e6f7ee', label: 'Available' },
    occupied:    { color: '#f5a623', bg: '#fff8ec', label: 'Occupied' },
    reserved:    { color: '#006aff', bg: '#e8f0ff', label: 'Reserved' },
    maintenance: { color: '#e22134', bg: '#fde8ea', label: 'Maintenance' },
  }
  const si = statusInfo[table.status] || statusInfo.available

  // ─── Render ───────────────────────────────────────────────────
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>

      <div className="animate-slide-in" style={{
        width: '100%', maxWidth: 780, maxHeight: '90vh',
        background: 'var(--bg-card)', borderRadius: 20,
        boxShadow: 'var(--shadow-lg)', display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
      }}>

        {/* ── Header ─────────────────────────────────────────── */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid var(--border-light)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: si.bg,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{
              width: 52, height: 52, borderRadius: 14, background: si.color,
              color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, fontWeight: 800,
            }}>
              {table.name}
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)' }}>
                Table {table.name}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 3 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12.5, color: 'var(--text-muted)' }}>
                  <Users size={12} /> {table.capacity} seats
                </span>
                <span style={{
                  background: si.color, color: 'white',
                  fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 100,
                }}>
                  {si.label}
                </span>
                {isOccupied && tableOrder && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12.5, color: si.color, fontWeight: 600 }}>
                    <Clock size={12} /> {table.duration || '0 min'}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button onClick={onClose} style={{
            width: 36, height: 36, borderRadius: 10, border: 'none',
            background: 'rgba(0,0,0,0.06)', cursor: 'pointer', display: 'flex',
            alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)',
          }}>
            <X size={18} />
          </button>
        </div>

        {/* ── Tab Bar ────────────────────────────────────────── */}
        <div style={{
          display: 'flex', borderBottom: '1px solid var(--border-light)',
          background: 'var(--bg-canvas)', padding: '0 24px',
        }}>
          {tabs.filter(t => t.show).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                padding: '10px 18px', background: 'none', border: 'none',
                borderBottom: activeTab === tab.id ? '2px solid var(--text-primary)' : '2px solid transparent',
                fontWeight: activeTab === tab.id ? 700 : 500,
                fontSize: 13, color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-muted)',
                cursor: 'pointer', marginBottom: -1, transition: 'all 0.15s ease',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Body ───────────────────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto' }}>

          {/* ══ OVERVIEW TAB ══════════════════════════════════ */}
          {activeTab === 'overview' && (
            <div style={{ padding: 24 }}>

              {/* Available */}
              {isAvailable && (
                <div style={{ textAlign: 'center', padding: '32px 0' }}>
                  <div style={{
                    width: 80, height: 80, borderRadius: '50%',
                    background: 'var(--accent-green-light)', color: 'var(--accent-green)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 20px', fontSize: 32,
                  }}>🪑</div>
                  <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Table is Available</div>
                  <div style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 28 }}>
                    You can start a new order or make a reservation.
                  </div>
                  <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => setActiveTab('order')}
                      className="btn btn-primary" style={{ padding: '12px 28px', fontSize: 14 }}
                    >
                      <ShoppingBag size={16} /> Start New Order
                    </button>
                    <button
                      onClick={() => setActiveTab('reserve')}
                      className="btn btn-ghost" style={{ padding: '12px 28px', fontSize: 14 }}
                    >
                      <Calendar size={16} /> Make Reservation
                    </button>
                  </div>
                </div>
              )}

              {/* Occupied */}
              {isOccupied && tableOrder && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                    <div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Order</div>
                      <div style={{ fontSize: 22, fontWeight: 800 }}>{tableOrder.orderId}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total</div>
                      <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--accent-green)' }}>₹{orderTotal.toFixed(0)}</div>
                    </div>
                  </div>

                  <div className="table-card" style={{ marginBottom: 16 }}>
                    <div className="table-header-row">
                      <span className="table-title">Order Items</span>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{cartFromOrder.length} items</span>
                    </div>
                    {cartFromOrder.map((item, i) => (
                      <div key={item.id} style={{
                        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        padding: '10px 20px',
                        borderBottom: i < cartFromOrder.length - 1 ? '1px solid var(--border-light)' : 'none',
                      }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13.5 }}>{item.name}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>₹{item.price} × {item.qty}</div>
                        </div>
                        <div style={{ fontWeight: 700 }}>₹{(item.price * item.qty).toLocaleString()}</div>
                      </div>
                    ))}
                    <div style={{ padding: '12px 20px', background: 'var(--bg-canvas)', display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Tax</span>
                      <span style={{ fontWeight: 600 }}>₹{orderTax.toFixed(2)}</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={() => setActiveTab('order')} className="btn btn-secondary" style={{ flex: 1, padding: 12 }}>
                      <Plus size={15} /> Add Items
                    </button>
                    <button onClick={() => setActiveTab('payment')} className="btn" style={{
                      flex: 1, padding: 12, background: 'var(--accent-green)', color: 'white',
                      border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 14,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer',
                    }}>
                      <CreditCard size={15} /> Checkout ₹{orderTotal.toFixed(0)}
                    </button>
                  </div>
                </div>
              )}

              {/* Occupied but no order data yet */}
              {isOccupied && !tableOrder && (
                <div style={{ textAlign: 'center', padding: '32px 0' }}>
                  <div style={{ fontSize: 40, marginBottom: 16 }}>🍽️</div>
                  <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Table is Occupied</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>No active order linked. Start one now.</div>
                  <button onClick={() => setActiveTab('order')} className="btn btn-primary" style={{ padding: '12px 28px' }}>
                    <ShoppingBag size={15} /> Start Order
                  </button>
                </div>
              )}

              {/* Reserved */}
              {isReserved && (
                <div>
                  <div style={{
                    background: 'var(--accent-blue-light)', border: '1px solid var(--accent-blue)',
                    borderRadius: 12, padding: 20, marginBottom: 20,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                      <Calendar size={20} color="var(--accent-blue)" />
                      <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--accent-blue)' }}>Reservation Details</span>
                    </div>
                    {reservation ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {[
                          ['Guest Name',   reservation.guestName],
                          ['Phone',        reservation.phone || '—'],
                          ['Guests',       `${reservation.guests} people`],
                          ['Time',         reservation.time],
                          ['Notes',        reservation.notes || '—'],
                        ].map(([label, val]) => (
                          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5 }}>
                            <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>{label}</span>
                            <span style={{ fontWeight: 600 }}>{val}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: 13.5, fontWeight: 600 }}>
                        Reserved for: <span style={{ color: 'var(--accent-blue)' }}>{table.reservation}</span>
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      onClick={() => { onSeatGuests(table.id); onClose() }}
                      className="btn btn-primary" style={{ flex: 1, padding: 12 }}
                    >
                      <Users size={15} /> Seat Guests & Start Order
                    </button>
                    <button
                      onClick={() => { onCancelReservation(table.id); onClose() }}
                      style={{
                        padding: '12px 18px', background: 'var(--accent-red-light)',
                        color: 'var(--accent-red)', border: '1px solid var(--accent-red)',
                        borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Maintenance */}
              {isMaintenance && (
                <div style={{ textAlign: 'center', padding: '32px 0' }}>
                  <div style={{
                    width: 72, height: 72, borderRadius: '50%',
                    background: 'var(--accent-red-light)', color: 'var(--accent-red)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 20px',
                  }}>
                    <AlertCircle size={32} />
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Under Maintenance</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                    This table is currently unavailable. Mark it as available to start using it.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══ ORDER / ADD ITEMS TAB ══════════════════════════ */}
          {activeTab === 'order' && (
            <div style={{ display: 'flex', height: 480 }}>

              {/* Left: Menu */}
              <div style={{ flex: 1, borderRight: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {/* Search */}
                <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-light)' }}>
                  <div className="search-input-wrapper">
                    <Search size={14} className="search-icon" />
                    <input
                      type="text" placeholder="Search menu…"
                      className="search-input"
                      value={itemSearch} onChange={e => setItemSearch(e.target.value)}
                    />
                  </div>
                </div>

                {/* Category pills */}
                <div style={{ display: 'flex', gap: 6, padding: '10px 16px', overflowX: 'auto', borderBottom: '1px solid var(--border-light)' }}>
                  {menuCategories.map(cat => (
                    <button
                      key={cat}
                      onClick={() => setActiveCategory(cat)}
                      style={{
                        padding: '5px 14px', borderRadius: 100, fontSize: 12, fontWeight: 600,
                        border: '1px solid var(--border-default)', whiteSpace: 'nowrap',
                        background: activeCategory === cat ? 'var(--text-primary)' : 'white',
                        color: activeCategory === cat ? 'white' : 'var(--text-secondary)',
                        cursor: 'pointer', transition: 'all 0.12s',
                      }}
                    >
                      {categoryEmoji[cat]} {cat}
                    </button>
                  ))}
                </div>

                {/* Items grid */}
                <div style={{ flex: 1, overflowY: 'auto', padding: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
                    {filteredItems.map(item => {
                      const inCart = cart.find(c => c.itemId === item.id)
                      return (
                        <button
                          key={item.id}
                          onClick={() => addItem(item)}
                          style={{
                            background: inCart ? 'var(--accent-blue-light)' : 'var(--bg-canvas)',
                            border: `1.5px solid ${inCart ? 'var(--accent-blue)' : 'var(--border-default)'}`,
                            borderRadius: 10, padding: '10px 8px', cursor: 'pointer',
                            textAlign: 'left', transition: 'all 0.12s', position: 'relative',
                          }}
                        >
                          <div style={{ fontSize: 20, marginBottom: 4 }}>
                            {categoryEmoji[item.category] || '🍽️'}
                          </div>
                          <div style={{ fontSize: 11.5, fontWeight: 600, lineHeight: 1.3, marginBottom: 4, color: 'var(--text-primary)' }}>
                            {item.name}
                          </div>
                          <div style={{ fontSize: 12, fontWeight: 700, color: inCart ? 'var(--accent-blue)' : 'var(--text-secondary)' }}>
                            ₹{item.price}
                          </div>
                          {inCart && (
                            <div style={{
                              position: 'absolute', top: 6, right: 6,
                              background: 'var(--accent-blue)', color: 'white',
                              borderRadius: '50%', width: 18, height: 18,
                              fontSize: 10, fontWeight: 700, display: 'flex',
                              alignItems: 'center', justifyContent: 'center',
                            }}>{inCart.qty}</div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Right: Cart */}
              <div style={{ width: 240, display: 'flex', flexDirection: 'column', background: 'var(--bg-canvas)' }}>
                <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--border-light)', fontWeight: 700, fontSize: 14 }}>
                  <ShoppingBag size={14} style={{ marginRight: 6, display: 'inline' }} />
                  Cart ({cart.reduce((s, c) => s + c.qty, 0)})
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
                  {cart.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                      <LayoutGrid size={28} style={{ margin: '0 auto 8px', opacity: 0.3 }} />
                      Select items
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {cart.map(c => (
                        <div key={c.id} style={{
                          background: 'white', borderRadius: 8, padding: '8px 10px',
                          border: '1px solid var(--border-light)',
                        }}>
                          <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, lineHeight: 1.3 }}>{c.name}</div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-canvas)', borderRadius: 20, border: '1px solid var(--border-default)' }}>
                              <button onClick={() => updateQty(c.id, -1)} style={{ width: 24, height: 24, border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {c.qty === 1 ? <Trash2 size={10} color="var(--accent-red)" /> : <Minus size={10} />}
                              </button>
                              <span style={{ fontSize: 12, fontWeight: 700, width: 18, textAlign: 'center' }}>{c.qty}</span>
                              <button onClick={() => updateQty(c.id, 1)} style={{ width: 24, height: 24, border: 'none', background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Plus size={10} />
                              </button>
                            </div>
                            <span style={{ fontSize: 12, fontWeight: 700 }}>₹{c.price * c.qty}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Cart totals + action */}
                <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border-light)', background: 'white' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
                    <span>Subtotal</span><span>₹{subtotal.toFixed(0)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
                    <span>Tax</span><span>₹{taxTotal.toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 15, marginBottom: 12, paddingTop: 8, borderTop: '1px dashed var(--border-default)' }}>
                    <span>Total</span><span style={{ color: 'var(--accent-green)' }}>₹{grandTotal.toFixed(0)}</span>
                  </div>
                  <button
                    disabled={cart.length === 0}
                    onClick={isOccupied ? handleAddItems : handleStartOrder}
                    style={{
                      width: '100%', padding: '11px', border: 'none', borderRadius: 8,
                      background: cart.length === 0 ? '#d4d4d4' : 'var(--text-primary)',
                      color: 'white', fontWeight: 700, fontSize: 13, cursor: cart.length === 0 ? 'not-allowed' : 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    }}
                  >
                    {isOccupied
                      ? <><Plus size={15} /> Add to Order</>
                      : <><ChefHat size={15} /> Place Order</>
                    }
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ══ RESERVE TAB ════════════════════════════════════ */}
          {activeTab === 'reserve' && (
            <div style={{ padding: 24 }}>
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>New Reservation</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  Book <strong>{table.name}</strong> for a guest — it will be marked as Reserved.
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
                {/* Guest name */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Guest Name *</label>
                  <input
                    className="form-input"
                    placeholder="e.g. Amit Sharma"
                    value={resForm.guestName}
                    onChange={e => setResForm({ ...resForm, guestName: e.target.value })}
                    style={{ borderColor: resErrors.guestName ? 'var(--accent-red)' : undefined }}
                  />
                  {resErrors.guestName && <div style={{ fontSize: 11.5, color: 'var(--accent-red)', marginTop: 4 }}>{resErrors.guestName}</div>}
                </div>

                {/* Phone */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Phone Number</label>
                  <input
                    className="form-input"
                    placeholder="+91 98765 43210"
                    value={resForm.phone}
                    onChange={e => setResForm({ ...resForm, phone: e.target.value })}
                  />
                </div>

                {/* Number of guests */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Number of Guests</label>
                  <select
                    className="form-input form-select"
                    value={resForm.guests}
                    onChange={e => setResForm({ ...resForm, guests: parseInt(e.target.value) })}
                  >
                    {Array.from({ length: table.capacity }, (_, i) => i + 1).map(n => (
                      <option key={n} value={n}>{n} {n === 1 ? 'person' : 'people'}</option>
                    ))}
                  </select>
                </div>

                {/* Reservation time */}
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Reservation Time *</label>
                  <input
                    className="form-input"
                    type="time"
                    value={resForm.time}
                    onChange={e => setResForm({ ...resForm, time: e.target.value })}
                    style={{ borderColor: resErrors.time ? 'var(--accent-red)' : undefined }}
                  />
                  {resErrors.time && <div style={{ fontSize: 11.5, color: 'var(--accent-red)', marginTop: 4 }}>{resErrors.time}</div>}
                </div>
              </div>

              {/* Notes */}
              <div className="form-group">
                <label className="form-label">Special Notes</label>
                <textarea
                  className="form-input"
                  rows={3}
                  placeholder="Birthday party, window seat preferred, allergies…"
                  value={resForm.notes}
                  onChange={e => setResForm({ ...resForm, notes: e.target.value })}
                  style={{ resize: 'none', lineHeight: 1.6 }}
                />
              </div>

              {/* Summary card */}
              {resForm.guestName && resForm.time && (
                <div style={{
                  background: 'var(--accent-blue-light)', border: '1px solid var(--accent-blue)',
                  borderRadius: 10, padding: '12px 16px', marginBottom: 20, fontSize: 13,
                }}>
                  <div style={{ fontWeight: 700, color: 'var(--accent-blue)', marginBottom: 4 }}>📋 Preview</div>
                  <div style={{ color: 'var(--text-primary)' }}>
                    <strong>{resForm.guestName}</strong> · {resForm.guests} guests · {resForm.time}
                    {resForm.notes && <span style={{ color: 'var(--text-muted)' }}> · {resForm.notes}</span>}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => setActiveTab('overview')} className="btn btn-ghost">
                  Cancel
                </button>
                <button onClick={handleBook} className="btn btn-primary" style={{ padding: '10px 28px' }}>
                  <Calendar size={15} /> Confirm Reservation
                </button>
              </div>
            </div>
          )}

          {/* ══ PAYMENT / CHECKOUT TAB ════════════════════════ */}
          {activeTab === 'payment' && (
            <div style={{ padding: 24 }}>
              {payDone ? (
                <div style={{ textAlign: 'center', background: 'white', padding: '40px 60px', borderRadius: 24, boxShadow: 'var(--shadow-lg)' }}>
                  <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--accent-green)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', animation: 'scaleIn 0.4s ease' }}>
                    <CheckCircle2 size={40} />
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Payment Successful!</div>
                  <div style={{ fontSize: 16, color: 'var(--accent-green)', fontWeight: 600 }}>Thank you for your order</div>
                  
                  {/* Feedback UI */}
                  <div style={{ marginTop: 32, paddingTop: 32, borderTop: '1px solid var(--border-light)', animation: 'fadeIn 0.5s ease' }}>
                    <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: 'var(--text-primary)' }}>Rate Your Experience</h3>
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 24 }}>
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button key={star} onClick={() => setFeedbackRating(star)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 8, transition: 'transform 0.1s ease' }} onMouseDown={e => e.currentTarget.style.transform = 'scale(0.9)'} onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}>
                          <Star size={40} fill={feedbackRating >= star ? 'var(--accent-orange)' : 'transparent'} color={feedbackRating >= star ? 'var(--accent-orange)' : 'var(--text-muted)'} strokeWidth={1.5} />
                        </button>
                      ))}
                    </div>
                    
                    {feedbackRating > 0 && (
                      <div style={{ animation: 'fadeIn 0.3s ease' }}>
                        <textarea
                          placeholder="Tell us what you liked (optional)..."
                          value={feedbackComment}
                          onChange={(e) => setFeedbackComment(e.target.value)}
                          style={{ width: '100%', height: 100, padding: 16, borderRadius: 12, border: '1px solid var(--border-default)', fontSize: 15, marginBottom: 24, resize: 'none', outline: 'none' }}
                        />
                      </div>
                    )}
                    
                    <div style={{ display: 'flex', gap: 12 }}>
                      <button className="btn btn-secondary" style={{ flex: 1, padding: '16px', fontSize: 15 }} onClick={completeCheckoutAndClose}>
                        {feedbackRating > 0 ? 'Not Now' : 'Skip'}
                      </button>
                      <button 
                        className="btn btn-primary" 
                        style={{ flex: 2, padding: '16px', fontSize: 15, opacity: feedbackRating === 0 ? 0.5 : 1 }} 
                        disabled={feedbackRating === 0 || isSubmittingFeedback} 
                        onClick={submitFeedback}
                      >
                        {isSubmittingFeedback ? 'Submitting...' : 'Submit Feedback'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : paymentStep === 'success' ? (
                <div style={{ textAlign: 'center', padding: '40px 0' }}>
                  <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--accent-green)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', animation: 'scaleIn 0.4s ease' }}>
                    <CheckCircle2 size={40} />
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Payment Successful!</div>
                </div>
              ) : paymentStep === 'processing' ? (
                <div style={{ padding: '60px 20px', textAlign: 'center' }}>
                  <Loader2 size={40} className="spinner" style={{ margin: '0 auto 20px', color: 'var(--accent-blue)' }} />
                  <h3 style={{ fontSize: 20 }}>Generating Secure Payment Link...</h3>
                </div>
              ) : paymentStep === 'qr' && stripeSession ? (
                <div style={{ textAlign: 'center', maxWidth: 400, margin: '0 auto' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
                    <div style={{ padding: 24, background: 'white', borderRadius: 24, boxShadow: 'var(--shadow-lg)', border: `2px solid ${qrPulse ? 'var(--accent-blue)' : 'transparent'}`, transition: 'border-color 1s ease' }}>
                      <QRCodeCanvas value={stripeSession.paymentUrl} size={200} />
                    </div>
                  </div>
                  <h2 style={{ fontSize: 24, fontWeight: 800, marginBottom: 8 }}>Scan to Pay ₹{orderTotal.toFixed(0)}</h2>
                  <p style={{ color: 'var(--text-muted)', marginBottom: 24, fontSize: 15 }}>Waiting for Stripe payment confirmation...</p>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 10, marginTop: 24 }}>
                    <button className="btn btn-secondary" onClick={cancelSession}>Cancel Session</button>
                    <a href={stripeSession.paymentUrl} target="_blank" className="btn btn-primary" rel="noreferrer">Open Link</a>
                  </div>
                </div>
              ) : (
                <>
                  {/* Order summary */}
                  <div style={{ background: 'var(--bg-canvas)', borderRadius: 12, padding: 16, marginBottom: 20 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Bill Summary</div>
                    {(tableOrder?.items || []).map(item => (
                      <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, marginBottom: 6 }}>
                        <span>{item.name} × {item.qty}</span>
                        <span style={{ fontWeight: 600 }}>₹{item.price * item.qty}</span>
                      </div>
                    ))}
                    <div style={{ borderTop: '1px dashed var(--border-default)', marginTop: 10, paddingTop: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>
                        <span>Tax</span><span>₹{orderTax.toFixed(2)}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: 18 }}>
                        <span>Total</span>
                        <span style={{ color: 'var(--accent-green)' }}>₹{orderTotal.toFixed(0)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Payment method */}
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Payment Method</div>
                    <div style={{ display: 'flex', gap: 10 }}>
                      {paymentMethods.map(pm => {
                        const Icon = pm.icon
                        return (
                          <button
                            key={pm.id}
                            onClick={() => setPayMethod(pm.id)}
                            style={{
                              flex: 1, padding: '12px 8px',
                              border: `2px solid ${payMethod === pm.id ? pm.color : 'var(--border-default)'}`,
                              borderRadius: 10, background: payMethod === pm.id ? `${pm.color}15` : 'white',
                              cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s',
                            }}
                          >
                            <Icon size={20} color={payMethod === pm.id ? pm.color : 'var(--text-muted)'} style={{ margin: '0 auto 4px' }} />
                            <div style={{ fontSize: 12, fontWeight: 700, color: payMethod === pm.id ? pm.color : 'var(--text-secondary)' }}>{pm.label}</div>
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Cash change calculator */}
                  {payMethod === 'cash' && (
                    <div style={{ background: 'var(--bg-canvas)', borderRadius: 10, padding: 14, marginBottom: 16 }}>
                      <label className="form-label">Cash Received</label>
                      <input
                        type="number"
                        className="form-input"
                        placeholder={`Min ₹${orderTotal.toFixed(0)}`}
                        value={cashGiven}
                        onChange={e => setCashGiven(e.target.value)}
                        style={{ marginBottom: 8, fontSize: 18, fontWeight: 700 }}
                      />
                      {cashGivenNum >= orderTotal && (
                        <div style={{
                          background: 'var(--accent-green-light)', color: 'var(--accent-green)',
                          padding: '8px 12px', borderRadius: 8, fontWeight: 700, fontSize: 14,
                        }}>
                          Return Change: ₹{change.toFixed(2)}
                        </div>
                      )}
                    </div>
                  )}



                  <button
                    onClick={handlePayment}
                    disabled={payMethod === 'cash' && cashGivenNum < orderTotal}
                    style={{
                      width: '100%', padding: '14px',
                      background: (payMethod !== 'cash' || cashGivenNum >= orderTotal) ? 'var(--accent-green)' : '#d4d4d4',
                      color: 'white', border: 'none', borderRadius: 10,
                      fontWeight: 800, fontSize: 15, cursor: (payMethod !== 'cash' || cashGivenNum >= orderTotal) ? 'pointer' : 'not-allowed',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                    }}
                  >
                    <CheckCircle2 size={18} />
                    Confirm Payment — ₹{orderTotal.toFixed(0)}
                  </button>
                </>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
