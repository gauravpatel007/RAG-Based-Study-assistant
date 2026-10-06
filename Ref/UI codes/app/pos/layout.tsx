'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, MonitorPlay, Receipt, User, ShieldAlert, RefreshCw } from 'lucide-react'
import Link from 'next/link'

import { logout } from '@/lib/auth'
import SessionManagerModal from '@/components/SessionManagerModal'

export default function POSLayout({ children }: { children: React.ReactNode }) {

  const router = useRouter()
  const [isSessionModalOpen, setIsSessionModalOpen] = useState(false)
  const [sessionData, setSessionData] = useState<any>(null)
  
  const refreshSession = () => {
    fetch('/api/sessions').then(res => res.json()).then(data => {
      const topSession = data.length > 0 ? data[0] : null
      setSessionData(topSession)
      if (!topSession || topSession.status === 'closed') {
        setIsSessionModalOpen(true)
      }
    }).catch(e => console.error('Error fetching sessions', e))
  }

  useEffect(() => {
    refreshSession()
  }, [])

  const handleLogout = () => {
    logout()
  }

  const handleCheckoutClick = (e: React.MouseEvent) => {
    e.preventDefault()
    let cartStr = null
    try { cartStr = localStorage.getItem('pos_active_cart') } catch(e) {}
    const cart = cartStr ? JSON.parse(cartStr) : []
    
    if (!cart || cart.length === 0) {
      alert("Cart is empty! Please add items to your order before checkout.")
      return
    }
    router.push('/pos/payment')
  }

  const handleReloadData = () => {
    // A quick hard-reload syncs products, tables, configurations from backend instantly.
    window.location.reload()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-canvas)' }}>
      {/* POS Topbar */}
      <header style={{ 
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
        padding: '12px 24px', background: 'var(--text-primary)', color: 'white',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Link href="/admin/dashboard" style={{ textDecoration: 'none' }}>
               <button style={{ padding: '6px 10px', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', borderRadius: 6, fontWeight: 600, display: 'flex', alignItems: 'center', cursor: 'pointer', fontSize: 13, marginRight: 8 }}>
                 ← Back to Admin
               </button>
            </Link>
            <MonitorPlay size={20} color="var(--accent-green)" />
            <span style={{ fontWeight: 800, fontSize: 18 }}>POS Terminal</span>
          </div>
          
          <nav style={{ display: 'flex', gap: 8, marginLeft: 24 }}>
            <button onClick={handleReloadData} title="Resync products and setup from server" style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', borderRadius: 6, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <RefreshCw size={14} /> Reload Data
            </button>
            <button onClick={handleCheckoutClick} disabled={!sessionData || sessionData.status === 'closed'} style={{ padding: '6px 12px', background: (!sessionData || sessionData.status === 'closed') ? '#555' : 'var(--accent-blue)', color: 'white', border: 'none', borderRadius: 6, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <Receipt size={16} /> Checkout
            </button>
          </nav>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div onClick={() => setIsSessionModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, cursor: 'pointer', padding: '6px 12px', background: 'rgba(255,255,255,0.1)', borderRadius: 6 }}>
            {(!sessionData || sessionData.status === 'closed') ? <ShieldAlert size={16} color="var(--accent-orange)" /> : <User size={16} color="var(--accent-green)" />}
            <span style={{ fontWeight: 600 }}>{(!sessionData || sessionData.status === 'closed') ? 'Session Closed' : 'Active Session'}</span>
          </div>
          <button 
            onClick={handleLogout}
            style={{ 
              padding: '6px 12px', background: 'rgba(226, 33, 52, 0.2)', color: '#ff6b6b',
              border: '1px solid rgba(226, 33, 52, 0.4)', borderRadius: 6,
              fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer'
            }}
          >
            <LogOut size={16} /> Logout
          </button>
        </div>
      </header>

      {/* POS Content */}
      <main style={{ flex: 1, overflow: 'auto', opacity: (!sessionData || sessionData.status === 'closed') ? 0.4 : 1, pointerEvents: (!sessionData || sessionData.status === 'closed') ? 'none' : 'auto' }}>
        {children}
      </main>

      <SessionManagerModal 
         isOpen={isSessionModalOpen} 
         onClose={() => setIsSessionModalOpen(false)}
         sessionState={(!sessionData || sessionData.status === 'closed') ? 'closed' : 'open'}
         sessionId={sessionData?.id}
         expectedClosing={sessionData ? parseFloat(sessionData.opening_balance) : 0}
         onSessionUpdated={refreshSession}
      />
    </div>
  )
}
