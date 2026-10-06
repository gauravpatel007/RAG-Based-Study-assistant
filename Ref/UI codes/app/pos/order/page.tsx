'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Hash, Plus, Minus, X, CreditCard, ChefHat, User, MonitorPlay, Utensils, CheckCircle2 } from 'lucide-react'
import { useLocalStorageState } from '@/hooks/useLocalStorageState'

const itemImages: Record<string, string> = {
  'Masala Dosa': 'https://upload.wikimedia.org/wikipedia/commons/3/34/Paper_Masala_Dosa.jpg',
  'Idli Sambar (2 pcs)': 'https://upload.wikimedia.org/wikipedia/commons/1/11/Idli_Sambar.JPG',
  'Vada': 'https://upload.wikimedia.org/wikipedia/commons/1/1d/Medu_vada.jpg',
  'Paneer Butter Masala': 'https://upload.wikimedia.org/wikipedia/commons/c/ce/Paneer_Butter_Masala.jpg',
  'Butter Naan': 'https://upload.wikimedia.org/wikipedia/commons/0/02/Naan_bread.jpg',
  'Veg Biryani': 'https://upload.wikimedia.org/wikipedia/commons/5/5a/Veg_Biryani.jpg',
  'Dal Makhani': 'https://upload.wikimedia.org/wikipedia/commons/0/03/Dal_Makhni.jpg',
  'Filter Coffee': 'https://upload.wikimedia.org/wikipedia/commons/a/ae/South_Indian_Filter_Coffee.jpg',
  'Masala Chai': 'https://upload.wikimedia.org/wikipedia/commons/2/23/Masala_Chai.JPG',
  'Mango Lassi': 'https://upload.wikimedia.org/wikipedia/commons/c/ca/Mango_Lassi.jpg',
  'Fresh Lime Soda': 'https://upload.wikimedia.org/wikipedia/commons/6/60/Nimbu_Pani.jpg',
  'Gulab Jamun': 'https://upload.wikimedia.org/wikipedia/commons/c/c4/Gulab_jamun_%28Dessert%29.jpg',
  'Rasgulla': 'https://upload.wikimedia.org/wikipedia/commons/1/1e/Rasgulla_-_A_sweet_made_from_milk_%28Cottage_Cheese%29.jpg',
  'Samosa (2 pcs)': 'https://upload.wikimedia.org/wikipedia/commons/c/cb/Samosachutney.jpg',
  'Pav Bhaji': 'https://upload.wikimedia.org/wikipedia/commons/4/4a/Pav_Bhaji.jpg',
}

type OrderLine = {
  id: string
  itemId: number
  name: string
  price: number
  qty: number
  taxRate: number
  variant?: string
}

export default function POSOrderPage() {
  const router = useRouter()
  const [activeCategory, setActiveCategory] = useState('All')
  const [search, setSearch] = useState('')
  const [cart, setCart] = useLocalStorageState<OrderLine[]>('pos_active_cart', [])
  const [orderState, setOrderState] = useLocalStorageState<'Draft' | 'Confirmed' | 'Kitchen' | 'Served' | 'Paid'>('pos_active_order_state', 'Draft')
  const [currentOrderId, setCurrentOrderId] = useLocalStorageState<number | null>('pos_active_order_id', null)
  const [orderNumber, setOrderNumber] = useLocalStorageState<string | null>('pos_active_order_number', null)
  
  const [orderType, setOrderType] = useState('Table 4')
  const [variantModalOpen, setVariantModalOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<any>(null)
  const [tableModalOpen, setTableModalOpen] = useState(false)

  const [menuItems, setMenuItems] = useState<any[]>([])
  const [categories, setCategories] = useState<string[]>(['All'])

  useEffect(() => {
    const loadMenus = async () => {
      try {
        const [prodRes, catRes] = await Promise.all([
          fetch('/api/products'),
          fetch('/api/categories')
        ])
        if (prodRes.ok) setMenuItems(await prodRes.json())
        if (catRes.ok) {
          const cats = await catRes.json()
          setCategories(['All', ...cats.map((c: any) => c.name)])
        }
      } catch (e) {
        console.error('Failed to load menu items', e)
      }
    }
    loadMenus()
  }, [])

  const filteredItems = menuItems.filter(item => {
    const matchCat = activeCategory === 'All' || item.category === activeCategory
    const matchSearch = item.name.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  const handleItemClick = (item: any) => {
    if (item.variants && Array.isArray(item.variants) && item.variants.length > 0) {
      setSelectedProduct(item)
      setVariantModalOpen(true)
    } else {
      addToCart(item, '', 0)
    }
  }

  const addToCart = (item: any, variantLabel: string, variantPriceAdd: number) => {
    const finalPrice = Number(item.price) + variantPriceAdd
    const finalName = variantLabel ? `${item.name} (${variantLabel})` : item.name
    const existing = cart.find(c => c.itemId === item.id && c.variant === variantLabel)
    if (existing) {
      setCart(cart.map(c => c.id === existing.id ? { ...c, qty: c.qty + 1 } : c))
    } else {
      setCart([...cart, {
        id: Math.random().toString(36).substr(2, 9),
        itemId: item.id, name: finalName, price: finalPrice,
        qty: 1, taxRate: item.tax, variant: variantLabel
      }])
    }
    if (orderState !== 'Draft') {
      setOrderState('Draft')
      setCurrentOrderId(null)
      setOrderNumber(null)
    }
    setVariantModalOpen(false)
  }

  const updateQty = (id: string, delta: number) => {
    setCart(cart.map(c => {
      if (c.id === id) { const newQty = Math.max(0, c.qty + delta); return { ...c, qty: newQty } }
      return c
    }).filter(c => c.qty > 0))
    if (orderState !== 'Draft') {
      setOrderState('Draft')
      setCurrentOrderId(null)
      setOrderNumber(null)
    }
  }

  const subtotal = cart.reduce((acc, c) => acc + (c.price * c.qty), 0)
  const taxTotal = cart.reduce((acc, c) => acc + ((c.price * c.qty) * (c.taxRate / 100)), 0)
  const grandTotal = subtotal + taxTotal

  const handleConfirm = async () => {
    try {
      // Extract table_id from orderType (e.g. "Table 4" -> look up table id)
      let tableId = null
      const tableMatch = orderType.match(/Table\s+(\d+)/i)
      if (tableMatch) {
        // Use the table number to find the actual table ID from the API
        try {
          const tablesRes = await fetch('/api/tables')
          if (tablesRes.ok) {
            const tables = await tablesRes.json()
            const tableName = `T${tableMatch[1]}`
            const found = tables.find((t: any) => t.name === tableName || t.name === `Table ${tableMatch[1]}`)
            if (found) tableId = found.id
          }
        } catch {}
      }

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          table_id: tableId,
          source: orderType.includes('Table') ? 'cashier' : 'takeaway',
          items: cart
        })
      })
      if (res.ok) {
        const data = await res.json()
        setCurrentOrderId(data.id)
        setOrderNumber(data.order_number)
        setOrderState('Confirmed')
      }
    } catch (e) {
      console.error('Confirm order failed', e)
    }
  }

  const handleSendToKitchen = async () => {
    let orderId = currentOrderId

    // If order hasn't been confirmed yet, confirm it first
    if (!orderId && cart.length > 0) {
      try {
        const res = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            source: orderType.includes('Table') ? 'cashier' : 'takeaway',
            items: cart
          })
        })
        if (res.ok) {
          const data = await res.json()
          orderId = data.id
          setCurrentOrderId(data.id)
          setOrderNumber(data.order_number)
        }
      } catch (e) {
        console.error('Auto-confirm before kitchen failed', e)
      }
    }

    if (orderId) {
      try {
        await fetch(`/api/orders/${orderId}/send-to-kitchen`, {
          method: 'POST'
        })
        setOrderState('Kitchen')
      } catch (e) {
        console.error('Send to kitchen failed', e)
      }
    }
  }

  const handleServe = async () => {
    if (currentOrderId) {
      try {
        await fetch(`/api/orders/${currentOrderId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'served' })
        })
      } catch (e) {
        console.error('Serve order failed', e)
      }
    }
    setOrderState('Served')
  }

  const handlePay = () => { router.push('/pos/payment') }

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 56px)', position: 'relative' }}>
      {variantModalOpen && selectedProduct && (
        <div style={{ position: 'absolute', top:0, left:0, right:0, bottom:0, background: 'rgba(0,0,0,0.5)', zIndex: 999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
           <div className="animate-slide-in" style={{ width: 400, background: 'var(--bg-card)', borderRadius: 16, padding: 24, boxShadow: 'var(--shadow-lg)' }}>
             <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{selectedProduct.name} - Select Variant</h3>
             <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>Choose a size or variation.</p>
             <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24, maxHeight: 300, overflowY: 'auto' }}>
                <button className="btn btn-secondary" style={{ display: 'flex', justifyContent: 'space-between', padding: 16 }} onClick={() => addToCart(selectedProduct, '', 0)}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                    <span>Regular</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Base Price</span>
                  </div>
                  <span style={{ fontWeight: 700 }}>₹{Number(selectedProduct.price)}</span>
                </button>
                {selectedProduct.variants && typeof selectedProduct.variants === 'object' && Array.isArray(selectedProduct.variants) && selectedProduct.variants.map((v: any, i: number) => (
                  <button key={i} className="btn btn-secondary" style={{ display: 'flex', justifyContent: 'space-between', padding: 16 }} onClick={() => addToCart(selectedProduct, `${v.name}: ${v.option}`, Number(v.extraPrice) || 0)}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                      <span style={{ fontWeight: 600 }}>{v.option}</span>
                      <span style={{ fontSize: 11, color: 'var(--accent-blue)' }}>{v.name} {v.extraPrice > 0 ? `(+₹${v.extraPrice})` : ''}</span>
                    </div>
                    <span style={{ fontWeight: 700 }}>₹{Number(selectedProduct.price) + (Number(v.extraPrice) || 0)}</span>
                  </button>
                ))}
             </div>
             <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
               <button className="btn btn-ghost" onClick={() => setVariantModalOpen(false)}>Cancel</button>
             </div>
           </div>
        </div>
      )}

      {tableModalOpen && (
        <div style={{ position: 'absolute', top:0, left:0, right:0, bottom:0, background: 'rgba(0,0,0,0.5)', zIndex: 998, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
           <div className="animate-slide-in" style={{ width: 450, background: 'var(--bg-card)', borderRadius: 16, padding: 24, boxShadow: 'var(--shadow-lg)' }}>
             <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Set Order Destination</h3>
             <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>Set a table or assign a self-ordering token.</p>
             <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
                {['Table 1', 'Table 2', 'Table 3', 'Table 4', 'Takeaway', 'Token #142', 'Token #143', 'Delivery'].map(t => (
                  <button key={t} className={`btn ${orderType === t ? 'btn-primary' : 'btn-secondary'}`} style={{ padding: 16, fontSize: 14 }} onClick={() => { setOrderType(t); setTableModalOpen(false); }}>
                    {t}
                  </button>
                ))}
             </div>
             <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
               <button className="btn btn-ghost" onClick={() => setTableModalOpen(false)}>Close</button>
             </div>
           </div>
        </div>
      )}

      {/* LEFT: Products Grid */}
      <div style={{ flex: 1, padding: '24px 32px', display: 'flex', flexDirection: 'column', background: 'var(--bg-canvas)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div className="search-input-wrapper" style={{ width: 300 }}>
            <Search size={15} className="search-icon" />
            <input type="text" placeholder="Search menu..." className="search-input" style={{ padding: '10px 14px 10px 38px', fontSize: 14 }} value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn btn-secondary"><Hash size={14}/> Enter Barcode</button>
            <button className="btn btn-secondary"><User size={14}/> Attach Customer</button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 16, marginBottom: 8, borderBottom: '1px solid var(--border-default)' }}>
          {categories.map(cat => (
             <button key={cat} onClick={() => setActiveCategory(cat)}
               style={{ padding: '10px 20px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border-default)', fontSize: 13, fontWeight: 600, background: activeCategory === cat ? 'var(--text-primary)' : 'white', color: activeCategory === cat ? 'white' : 'var(--text-primary)', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s ease' }}
             >{cat}</button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4, paddingBottom: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 16 }}>
            {filteredItems.map(item => {
              const getDishTheme = (name: string) => {
                if (name.includes('Coffee') || name.includes('Espresso') || name.includes('Cappuccino') || name.includes('Latte')) return { emoji: '☕', bg: '#FFF7ED', color: '#C2410C' }
                if (name.includes('Chai')) return { emoji: '🫖', bg: '#FFF7ED', color: '#C2410C' }
                if (name.includes('Lassi') || name.includes('Mojito') || name.includes('Soda')) return { emoji: '🍹', bg: '#F0FDF4', color: '#15803D' }
                if (name.includes('Croissant')) return { emoji: '🥐', bg: '#FEFCE8', color: '#A16207' }
                if (name.includes('Muffin')) return { emoji: '🧁', bg: '#FDF2F8', color: '#BE185D' }
                if (name.includes('Cheesecake') || name.includes('Jamun')) return { emoji: '🍰', bg: '#FEF2F2', color: '#B91C1C' }
                if (name.includes('Toast') || name.includes('Sandwich')) return { emoji: '🥪', bg: '#FFFBEB', color: '#B45309' }
                if (name.includes('Samosa')) return { emoji: '🥟', bg: '#FFF7ED', color: '#C2410C' }
                if (name.includes('Pav Bhaji') || name.includes('Paneer')) return { emoji: '🥘', bg: '#FEF2F2', color: '#B91C1C' }
                if (name.includes('Dosa')) return { emoji: '🌯', bg: '#FEFCE8', color: '#A16207' }
                if (name.includes('Biryani')) return { emoji: '🍛', bg: '#F0FDF4', color: '#15803D' }
                return { emoji: '🍽️', bg: '#F3F4F6', color: '#4B5563' }
              }
              const theme = getDishTheme(item.name);
              
              return (
              <button key={item.id} onClick={() => handleItemClick(item)}
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-lg)', padding: 0, overflow: 'hidden', cursor: 'pointer', textAlign: 'left', display: 'flex', flexDirection: 'column', height: 140, transition: 'transform 0.1s ease', position: 'relative' }}
                onMouseDown={e => e.currentTarget.style.transform = 'scale(0.97)'}
                onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
              >
                <div style={{ height: 80, background: theme.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ fontSize: 38, filter: 'drop-shadow(0 4px 6px rgba(0,0,0,0.15))' }}>{theme.emoji}</span>
                </div>
                <div style={{ padding: '8px 12px', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>{item.name}</div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-secondary)' }}>₹{item.price}</div>
                </div>
              </button>
            )})}
          </div>
        </div>
      </div>

      {/* RIGHT: Cart */}
      <div style={{ width: 380, minWidth: 380, background: 'var(--bg-card)', borderLeft: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>Current Order</h2>
            <div style={{ fontSize: 12, fontWeight: 700, padding: '4px 8px', background: orderState === 'Draft' ? 'var(--bg-canvas)' : 'var(--accent-blue-light)', color: orderState === 'Draft' ? 'var(--text-muted)' : 'var(--accent-blue)', borderRadius: 6 }}>
              {orderState === 'Draft' ? '#ORD-NEW' : (orderNumber || `#ORD-1090`)}
            </div>
          </div>
          <div onClick={() => setTableModalOpen(true)} style={{ width: '100%', background: 'var(--bg-canvas)', padding: '8px 12px', borderRadius: 'var(--radius-md)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
             <span style={{ fontSize: 14, fontWeight: 600 }}>{orderType}</span>
             <span style={{ fontSize: 12, color: 'var(--accent-blue)', fontWeight: 600 }}>Change</span>
          </div>
          <div style={{ fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', color: 'var(--text-secondary)' }}>
            Status: <span className="badge badge-gray">{orderState}</span>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 24px' }}>
          {cart.length === 0 ? (
            <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              {orderState === 'Paid' ? (
                 <div style={{ textAlign: 'center' }}>
                   <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'var(--accent-green-light)', color: 'var(--accent-green)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16, margin: '0 auto 16px' }}><CheckCircle2 size={32}/></div>
                   <div style={{ fontSize: 16, fontWeight: 700 }}>Payment Successful</div>
                 </div>
              ) : (
                <>
                  <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'var(--bg-canvas)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>🛒</div>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>Cart is empty</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>Add items from the menu</div>
                </>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {cart.map(c => (
                <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{c.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>₹{c.price} / ea</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>₹{c.price * c.qty}</div>
                    {orderState === 'Draft' ? (
                       <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-canvas)', borderRadius: 'var(--radius-pill)', border: '1px solid var(--border-default)' }}>
                         <button onClick={() => updateQty(c.id, -1)} style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'none', cursor: 'pointer' }}><Minus size={12}/></button>
                         <span style={{ width: 24, textAlign: 'center', fontSize: 13, fontWeight: 600 }}>{c.qty}</span>
                         <button onClick={() => updateQty(c.id, 1)} style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', border: 'none', background: 'none', cursor: 'pointer' }}><Plus size={12}/></button>
                       </div>
                    ) : (
                       <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>Qty: {c.qty}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ borderTop: '1px solid var(--border-light)', padding: '20px 24px', background: 'var(--bg-card)' }}>
           <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 13, color: 'var(--text-secondary)' }}><span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span></div>
           <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16, fontSize: 13, color: 'var(--text-secondary)' }}><span>Tax</span><span>₹{taxTotal.toFixed(2)}</span></div>
           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingTop: 16, borderTop: '1px dashed var(--border-default)' }}>
             <span style={{ fontSize: 16, fontWeight: 600 }}>Total</span>
             <span style={{ fontSize: 28, fontWeight: 800, letterSpacing: '-0.5px' }}>₹{grandTotal.toFixed(0)}</span>
           </div>
           <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
             {orderState === 'Draft' && cart.length > 0 && (
               <button onClick={handleConfirm} className="btn btn-primary" style={{ width: '100%', padding: '14px', fontSize: 15, display: 'flex', justifyContent: 'center', gap: 8 }}><MonitorPlay size={18} /> Confirm Order</button>
             )}
             {orderState === 'Confirmed' && cart.length > 0 && (
               <button onClick={handleSendToKitchen} style={{ width: '100%', padding: '14px', background: 'var(--accent-orange-light)', color: 'var(--accent-orange)', border: '1.5px solid var(--accent-orange)', borderRadius: 'var(--radius-md)', fontSize: 15, fontWeight: 700, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, cursor: 'pointer' }}><ChefHat size={18} /> Send to Kitchen</button>
             )}
             {orderState === 'Kitchen' && cart.length > 0 && (
               <button onClick={handleServe} style={{ width: '100%', padding: '14px', background: 'var(--accent-blue-light)', color: 'var(--accent-blue)', border: '1.5px solid var(--accent-blue)', borderRadius: 'var(--radius-md)', fontSize: 15, fontWeight: 700, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, cursor: 'pointer' }}><Utensils size={18} /> Mark as Served</button>
             )}
             {(orderState === 'Served' || orderState === 'Draft' || orderState === 'Confirmed') && cart.length > 0 && (
               <button onClick={handlePay} style={{ width: '100%', padding: '14px', background: 'var(--accent-green)', color: 'white', border: 'none', borderRadius: 'var(--radius-md)', fontSize: 15, fontWeight: 700, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, cursor: 'pointer' }}><CreditCard size={18} /> Pay ₹{grandTotal.toFixed(0)}</button>
             )}
           </div>
        </div>
      </div>
    </div>
  )
}
