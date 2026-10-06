'use client'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, LogIn } from 'lucide-react'
import { login } from '@/lib/auth'
import { getHomeForRole } from '@/lib/roles'
import type { UserRole } from '@/lib/roles'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const session = await login(email, password)
      // Redirect to intended page or role home
      const destination = redirectTo || getHomeForRole(session.role as UserRole)
      router.push(destination)
    } catch (err: any) {
      setError(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ width: '100%', maxWidth: 420, padding: '0 24px' }}>
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: 16,
        border: '1px solid var(--border-light)',
        padding: '40px 36px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
      }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 4, textAlign: 'center' }}>
          Welcome back
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 28 }}>
          Sign in to your Odoo POS Cafe account
        </p>

        {error && (
          <div style={{
            padding: '10px 14px', marginBottom: 20, borderRadius: 8,
            background: 'var(--accent-red-light)', color: 'var(--accent-red)',
            fontSize: 13, fontWeight: 600,
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Email</label>
            <input
              type="email"
              id="login-email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@odoo-cafe.com"
              required
              style={{
                width: '100%', padding: '11px 14px', fontSize: 14,
                border: '1px solid var(--border-default)', borderRadius: 10,
                outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                id="login-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password"
                required
                style={{
                  width: '100%', padding: '11px 42px 11px 14px', fontSize: 14,
                  border: '1px solid var(--border-default)', borderRadius: 10,
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            id="login-submit"
            disabled={loading}
            style={{
              width: '100%', padding: '12px', fontSize: 15, fontWeight: 700,
              background: loading ? '#999' : 'var(--text-primary)', color: 'white',
              border: 'none', borderRadius: 10, cursor: loading ? 'wait' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            <LogIn size={16} /> {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--text-muted)' }}>
          Don't have an account?{' '}
          <Link href="/auth/signup" style={{ color: 'var(--accent-blue)', fontWeight: 600, textDecoration: 'none' }}>
            Sign up
          </Link>
        </div>


      </div>
    </div>
  )
}
