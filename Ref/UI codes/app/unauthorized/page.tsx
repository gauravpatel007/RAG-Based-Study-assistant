'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ShieldX, ArrowLeft, LogOut } from 'lucide-react'
import { logout, getSession } from '@/lib/auth'
import { getHomeForRole } from '@/lib/roles'
import type { UserRole } from '@/lib/roles'

export default function UnauthorizedPage() {
  const [session, setSession] = useState<any>(null)
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setSession(getSession())
    setIsClient(true)
  }, [])

  const homePath = session ? getHomeForRole(session.role as UserRole) : '/auth/login'

  if (!isClient) return null // Prevent hydration mismatch

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-canvas)',
      fontFamily: 'var(--font-sans)',
    }}>
      <div style={{ textAlign: 'center', maxWidth: 480, padding: '40px 24px' }}>
        <div style={{
          width: 80,
          height: 80,
          borderRadius: 20,
          background: 'var(--accent-red-light)',
          color: 'var(--accent-red)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 24px',
        }}>
          <ShieldX size={40} />
        </div>
        <h1 style={{
          fontSize: 28,
          fontWeight: 800,
          color: 'var(--text-primary)',
          marginBottom: 12,
        }}>
          Access Denied
        </h1>
        <p style={{
          fontSize: 16,
          color: 'var(--text-secondary)',
          lineHeight: 1.6,
          marginBottom: 8,
        }}>
          You don't have permission to access this page.
        </p>
        {session && (
          <p style={{
            fontSize: 14,
            color: 'var(--text-muted)',
            marginBottom: 32,
            background: 'var(--bg-canvas)',
            padding: '8px 16px',
            borderRadius: 8,
            display: 'inline-block',
            border: '1px solid var(--border-light)',
          }}>
            Signed in as <strong>{session.name}</strong> ({session.role})
          </p>
        )}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 24 }}>
          <Link href={homePath} style={{ textDecoration: 'none' }}>
            <button style={{
              padding: '12px 24px',
              background: 'var(--text-primary)',
              color: 'white',
              border: 'none',
              borderRadius: 10,
              fontSize: 15,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}>
              <ArrowLeft size={16} /> Go to My Dashboard
            </button>
          </Link>
          <button
            onClick={() => logout()}
            style={{
              padding: '12px 24px',
              background: 'white',
              color: 'var(--accent-red)',
              border: '1.5px solid var(--accent-red)',
              borderRadius: 10,
              fontSize: 15,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </div>
    </div>
  )
}
