'use client'
import { useState } from 'react'
import { Search, Plus, Minus, CreditCard, ShoppingBag, Coffee, ChefHat } from 'lucide-react'
import { menuItems, menuCategories } from '@/lib/mockData'

type DemoCartItem = {
  id: number
  name: string
  price: number
  qty: number
}

export default function DemoPOSPage() {
  const [activeCategory, setActiveCategory] = useState('All')
  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<DemoCartItem[]>([])
  const [showPayment, setShowPayment] = useState(false)

  const filteredItems = menuItems.filter(item => {
    const matchCat = activeCategory === 'All' || item.category === activeCategory
    const matchSearch = item.name.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  const addItem = (item: typeof menuItems[0]) => {
    const existing = cart.find(c => c.id === item.id)
    if (existing) {
      setCart(cart.map(c => c.id === item.id ? { ...c, qty: c.qty + 1 } : c))
    } else {
      setCart([...cart, { id: item.id, name: item.name, price: item.price, qty: 1 }])
    }
  }

  const updateQty = (id: number, delta: number) => {
    setCart(cart.map(c => c.id === id ? { ...c, qty: Math.max(0, c.qty + delta) } : c).filter(c => c.qty > 0))
  }

  const total = cart.reduce((acc, c) => acc + c.price * c.qty, 0)
  const tax = total * 0.05
  const grandTotal = total + tax

  const handlePay = () => {
    setShowPayment(true)
    setTimeout(() => {
      setShowPayment(false)
      setCart([])
    }, 2000)
  }

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 56px)' }}>
      {/* Payment success overlay */}
      {showPayment && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.5)', zIndex: 999,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            width: 400, background: 'white', borderRadius: 20, padding: 40,
            textAlign: 'center', boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
          }}>
            <div style={{
              width: 64, height: 64, borderRadius: '50%',
              background: '#dcfce7', color: '#00b259',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px', fontSize: 28,
            }}>✓</div>
            <div style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Payment Successful!</div>
            <div style={{ fontSize: 16, color: '#888', marginBottom: 4 }}>₹{grandTotal.toFixed(0)} paid</div>
            <div style={{ fontSize: 13, color: '#aaa' }}>Demo mode — no data saved</div>
          </div>
        </div>
      )}

      {/* Left: menu */}
      <div style={{ flex: 1, padding: '24px 32px', display: 'flex', flexDirection: 'column', background: '#fafafa' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
          <div className="search-input-wrapper" style={{ flex: 1 }}>
            <Search size={15} className="search-icon" />
            <input type="text" placeholder="Search menu..." className="search-input"
              style={{ padding: '10px 14px 10px 38px', fontSize: 14 }}
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          {menuCategories.map(cat => (
            <button key={cat} onClick={() => setActiveCategory(cat)}
              style={{
                padding: '8px 18px', borderRadius: 20,
                border: '1px solid #e5e5e5', fontSize: 13, fontWeight: 600,
                background: activeCategory === cat ? '#1a1a1a' : 'white',
                color: activeCategory === cat ? 'white' : '#1a1a1a',
                cursor: 'pointer',
              }}
            >{cat}</button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 14 }}>
            {filteredItems.map(item => (
              <button key={item.id} onClick={() => addItem(item)}
                style={{
                  background: 'white', border: '1px solid #e5e5e5', borderRadius: 14,
                  padding: 0, overflow: 'hidden', cursor: 'pointer', textAlign: 'left',
                  display: 'flex', flexDirection: 'column', height: 130,
                  transition: 'transform 0.1s',
                }}
                onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
                onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
              >
                <div style={{ height: 65, background: '#f0f6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Coffee size={22} color="#006aff" />
                </div>
                <div style={{ padding: '8px 12px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.2 }}>{item.name}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#333' }}>₹{item.price}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Right: cart */}
      <div style={{ width: 360, minWidth: 360, background: 'white', borderLeft: '1px solid #e5e5e5', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #f0f0f0' }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShoppingBag size={18} /> Demo Order
          </h2>
          <div style={{ fontSize: 12, color: '#aaa', marginTop: 4 }}>Sandbox mode — nothing is saved</div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
          {cart.length === 0 ? (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#aaa' }}>
              <Coffee size={40} style={{ marginBottom: 12 }} />
              <div style={{ fontSize: 14, fontWeight: 600 }}>Add items from the menu</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {cart.map(c => (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{c.name}</div>
                    <div style={{ fontSize: 12, color: '#aaa' }}>₹{c.price} each</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <button onClick={() => updateQty(c.id, -1)} style={{ width: 28, height: 28, border: '1px solid #e5e5e5', borderRadius: 6, background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Minus size={12} /></button>
                    <span style={{ width: 28, textAlign: 'center', fontWeight: 700, fontSize: 14 }}>{c.qty}</span>
                    <button onClick={() => updateQty(c.id, 1)} style={{ width: 28, height: 28, border: '1px solid #e5e5e5', borderRadius: 6, background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Plus size={12} /></button>
                    <span style={{ width: 60, textAlign: 'right', fontWeight: 700, fontSize: 14 }}>₹{c.price * c.qty}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ borderTop: '1px solid #f0f0f0', padding: '20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#888', marginBottom: 6 }}><span>Subtotal</span><span>₹{total.toFixed(0)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#888', marginBottom: 14 }}><span>Tax (5%)</span><span>₹{tax.toFixed(0)}</span></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, fontWeight: 800, marginBottom: 16, paddingTop: 12, borderTop: '1px dashed #e5e5e5' }}>
            <span>Total</span><span>₹{grandTotal.toFixed(0)}</span>
          </div>
          <button onClick={handlePay} disabled={cart.length === 0}
            style={{
              width: '100%', padding: '14px', fontSize: 15, fontWeight: 700,
              background: cart.length > 0 ? '#00b259' : '#e5e5e5',
              color: cart.length > 0 ? 'white' : '#aaa',
              border: 'none', borderRadius: 12, cursor: cart.length > 0 ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
            <CreditCard size={18} /> Pay ₹{grandTotal.toFixed(0)}
          </button>
        </div>
      </div>
    </div>
  )
}
