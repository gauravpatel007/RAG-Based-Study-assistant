'use client'

import React from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, MonitorPlay, AlertTriangle, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg-canvas)' }}>
      {/* Demo Topbar */}
      <header style={{ 
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', 
        padding: '12px 24px', background: 'var(--accent-blue)', color: 'white',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <MonitorPlay size={20} color="var(--accent-orange)" />
            <span style={{ fontWeight: 800, fontSize: 18 }}>DEMO MODE</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, background: 'rgba(255,255,255,0.2)', padding: '4px 10px', borderRadius: 12 }}>
            <AlertTriangle size={14} /> Data is not saved
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Link href="/" style={{ textDecoration: 'none' }}>
            <button 
              style={{ 
                padding: '6px 16px', background: 'white', color: 'var(--accent-blue)',
                border: 'none', borderRadius: 6,
                fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer'
              }}
            >
              <LogOut size={16} /> Exit Demo
            </button>
          </Link>
        </div>
      </header>

      {/* Demo Content */}
      <main style={{ flex: 1, overflow: 'hidden' }}>
        {children}
      </main>
    </div>
  )
}
