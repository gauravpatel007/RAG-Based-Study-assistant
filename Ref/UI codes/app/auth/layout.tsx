import { Coffee } from 'lucide-react'
import Link from 'next/link'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--bg-canvas)',
    }}>
      {/* Minimal top bar with logo */}
      <div style={{
        padding: '16px 24px',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
      }}>
        <Link href="/landing" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10, color: 'inherit' }}>
          <div style={{
            background: 'var(--accent-orange)',
            color: 'white',
            padding: 6,
            borderRadius: 8,
          }}>
            <Coffee size={18} />
          </div>
          <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>Odoo POS Cafe</span>
        </Link>
      </div>

      {/* Centered content area */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {children}
      </div>
    </div>
  )
}
