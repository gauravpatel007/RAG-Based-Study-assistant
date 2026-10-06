'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, ChefHat, BellRing } from 'lucide-react'

import { logout } from '@/lib/auth'

export default function KitchenLayout({ children }: { children: React.ReactNode }) {

  const handleLogout = () => {
    logout()
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-canvas)' }}>
      {/* Kitchen Topbar */}
      <header style={{ 
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
        padding: '12px 24px', background: '#1c1c1c', color: 'white',
        borderBottom: '4px solid var(--accent-orange)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--accent-orange)' }}>
            <ChefHat size={24} />
            <span style={{ fontWeight: 900, fontSize: 20, letterSpacing: '0.05em', textTransform: 'uppercase' }}>KDS</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#aaa' }}>
            <BellRing size={16} /> Live Sync Active
          </div>
          <button 
            onClick={handleLogout}
            style={{ 
              padding: '8px 16px', background: 'rgba(255,255,255,0.1)', color: 'white',
              border: 'none', borderRadius: 8,
              fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer'
            }}
          >
            <LogOut size={16} /> Exit Station
          </button>
        </div>
      </header>

      {/* Full-width Kitchen Display */}
      <main style={{ flex: 1, padding: '24px', overflowY: 'auto' }}>
        {children}
      </main>
    </div>
  )
}
