'use client'
import { useState, useEffect } from 'react'
import { QrCode, CheckCircle2, Coffee, Clock } from 'lucide-react'
import { QRCodeCanvas } from 'qrcode.react'

type CustomerOrderLine = {
  id: string
  name: string
  qty: number
  price: number
}

export default function CustomerDisplayPage() {
  const [cart, setCart] = useState<CustomerOrderLine[]>([])
  const [paymentStatus, setPaymentStatus] = useState<'shopping' | 'paying' | 'success'>('shopping')
  const [currentTime, setCurrentTime] = useState('')

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date()
      setCurrentTime(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Sync with POS terminal actively using localStorage
  useEffect(() => {
    const syncState = () => {
      try {
        const storedCart = localStorage.getItem('pos_active_cart')
        const storedState = localStorage.getItem('pos_active_order_state') // 'Draft', 'Checkout', 'Paid'

        if (storedCart) {
          const parsed = JSON.parse(storedCart)
          if (Array.isArray(parsed)) setCart(parsed)
        }

        if (storedState) {
          const stateStr = JSON.parse(storedState)
          if (stateStr === 'Paid') setPaymentStatus('success')
          else if (stateStr === 'Checkout') setPaymentStatus('paying')
          else setPaymentStatus('shopping')
        } else {
          setPaymentStatus('shopping')
        }
      } catch (e) {
        console.error('Customer Sync Error', e)
      }
    }

    syncState()
    window.addEventListener('storage', syncState)
    // Polling as a fallback to catch rapid updates within the same window instance
    const poll = setInterval(syncState, 500)

    return () => {
      window.removeEventListener('storage', syncState)
      clearInterval(poll)
    }
  }, [])

  const subtotal = cart.reduce((acc, c) => acc + (c.price * c.qty), 0)
  const tax = subtotal * 0.05
  const grandTotal = subtotal + tax

  return (
    <div style={{ backgroundColor: '#000', color: '#fff', height: '100vh', width: '100vw', display: 'flex', fontFamily: 'var(--font-sans)', margin: '-28px -32px' }}>
      
      {/* Promo / Branding Side (Left 60%) */}
      <div style={{ flex: 1.5, position: 'relative', display: 'flex', flexDirection: 'column', backgroundColor: '#1a1a1a', overflow: 'hidden' }}>
        
        {/* Background Graphic Simulated */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: 0.2, backgroundImage: 'url("https://images.unsplash.com/photo-1497935586351-b67a49e012bf?auto=format&fit=crop&q=80")', backgroundSize: 'cover', backgroundPosition: 'center' }} />
        
        <div style={{ position: 'relative', zIndex: 10, padding: '40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
           <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ background: 'var(--accent-blue)', color: 'white', padding: 12, borderRadius: 12 }}><Coffee size={24}/></div>
              <div>
                 <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>Cafe POS</h1>
                 <p style={{ fontSize: 13, color: '#aaa', margin: 0, letterSpacing: '2px', textTransform: 'uppercase' }}>Odoo Powered</p>
              </div>
           </div>
           
           <div style={{ background: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)', padding: '12px 20px', borderRadius: 100, fontSize: 18, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
             <Clock size={18} /> {currentTime}
           </div>
        </div>

        <div style={{ flex: 1, position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '60px' }}>
          {paymentStatus === 'shopping' && (
             <div className="animate-slide-up">
               {cart.length === 0 ? (
                 <>
                   <h2 style={{ fontSize: 56, fontWeight: 800, lineHeight: 1.1, marginBottom: 24 }}>Welcome!</h2>
                   <p style={{ fontSize: 24, color: '#aaa' }}>Please step up to place your order.</p>
                 </>
               ) : (
                 <>
                   <span style={{ background: 'var(--accent-blue)', color: 'white', padding: '6px 12px', borderRadius: 8, fontSize: 14, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 16, display: 'inline-block' }}>Special Offer</span>
                   <h2 style={{ fontSize: 56, fontWeight: 800, lineHeight: 1.1, marginBottom: 24 }}>Add a pastry for just ₹40.</h2>
                   <p style={{ fontSize: 24, color: '#aaa' }}>Ask your cashier to upgrade your cart.</p>
                 </>
               )}
             </div>
          )}

          {paymentStatus === 'paying' && (
             <div className="animate-slide-up" style={{ display: 'flex', alignItems: 'flex-start', gap: 40 }}>
                <div style={{ background: 'white', padding: 16, borderRadius: 24 }}>
                   <div style={{ border: '4px solid #f0f0f0', borderRadius: 16, padding: 8, background: 'white' }}>
                      <QRCodeCanvas value={`upi://pay?pa=merchant@upi&pn=CafeOdoo&am=${grandTotal.toFixed(0)}&cu=INR`} size={180} />
                   </div>
                </div>
                <div>
                   <h2 style={{ fontSize: 48, fontWeight: 800, lineHeight: 1.1, marginBottom: 16 }}>Scan to Pay</h2>
                   <p style={{ fontSize: 20, color: '#aaa', marginBottom: 24 }}>Use GPay, PhonePe, or any UPI app to safely complete your transaction.</p>
                   <div style={{ fontSize: 48, fontWeight: 800, color: 'var(--accent-green)' }}>₹{grandTotal.toFixed(0)}</div>
                </div>
             </div>
          )}

          {paymentStatus === 'success' && (
             <div className="animate-slide-up" style={{ textAlign: 'center' }}>
                <div style={{ display: 'inline-block', background: 'var(--accent-green)', padding: 32, borderRadius: '50%', marginBottom: 32 }}>
                  <CheckCircle2 size={80} color="white" />
                </div>
                <h2 style={{ fontSize: 56, fontWeight: 800, lineHeight: 1.1, marginBottom: 16 }}>Payment Successful!</h2>
                <p style={{ fontSize: 24, color: '#aaa' }}>Thank you for visiting us. Your order is confirmed.</p>
             </div>
          )}
        </div>
      </div>

      {/* Cart Summary Side (Right 40%) */}
      <div style={{ flex: 1, backgroundColor: '#222', borderLeft: '1px solid #333', display: 'flex', flexDirection: 'column' }}>
        
        <div style={{ padding: '32px', borderBottom: '1px solid #333' }}>
           <h2 style={{ fontSize: 24, fontWeight: 700, margin: 0 }}>Your Order</h2>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '32px' }}>
          {cart.length === 0 ? (
            <div style={{ color: '#555', textAlign: 'center', marginTop: 100, fontSize: 18 }}>Waiting for items...</div>
          ) : (
            cart.map(item => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, fontSize: 18 }}>
                 <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                   <span style={{ color: '#aaa', background: '#333', padding: '4px 10px', borderRadius: 8, fontSize: 14 }}>{item.qty}</span>
                   <span style={{ fontWeight: 600 }}>{item.name}</span>
                 </div>
                 <span style={{ fontWeight: 700 }}>₹{item.price * item.qty}</span>
              </div>
            ))
          )}
        </div>

        <div style={{ padding: '32px', backgroundColor: '#111', borderTop: '1px solid #333' }}>
           <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, color: '#aaa', marginBottom: 16 }}>
             <span>Subtotal</span>
             <span>₹{subtotal.toFixed(2)}</span>
           </div>
           <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 18, color: '#aaa', marginBottom: 24 }}>
             <span>Tax (5%)</span>
             <span>₹{tax.toFixed(2)}</span>
           </div>
           
           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 24, borderTop: '1px dashed #444' }}>
             <span style={{ fontSize: 24, fontWeight: 700 }}>Total</span>
             <span style={{ fontSize: 48, fontWeight: 800, color: 'var(--accent-green)' }}>₹{grandTotal.toFixed(0)}</span>
           </div>
        </div>

      </div>

    </div>
  )
}

