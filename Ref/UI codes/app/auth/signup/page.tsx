'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Eye, EyeOff, UserPlus } from 'lucide-react'
import { signup } from '@/lib/auth'
import { getHomeForRole, getSignupRoles } from '@/lib/roles'
import type { UserRole } from '@/lib/roles'

export default function SignupPage() {
  const router = useRouter()
  const roles = getSignupRoles()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<UserRole>('cashier')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const session = await signup(name, email, password, role)
      router.push(getHomeForRole(session.role as UserRole))
    } catch (err: any) {
      setError(err.message || 'Signup failed')
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
          Create Account
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 28 }}>
          Get started with Odoo POS Cafe
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
            <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Full Name</label>
            <input
              type="text"
              id="signup-name"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="John Doe"
              required
              style={{
                width: '100%', padding: '11px 14px', fontSize: 14,
                border: '1px solid var(--border-default)', borderRadius: 10,
                outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Email</label>
            <input
              type="email"
              id="signup-email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              style={{
                width: '100%', padding: '11px 14px', fontSize: 14,
                border: '1px solid var(--border-default)', borderRadius: 10,
                outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Role</label>
            <select
              id="signup-role"
              value={role}
              onChange={e => setRole(e.target.value as UserRole)}
              style={{
                width: '100%', padding: '11px 14px', fontSize: 14,
                border: '1px solid var(--border-default)', borderRadius: 10,
                outline: 'none', boxSizing: 'border-box', background: 'white',
              }}
            >
              {roles.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ fontSize: 13, fontWeight: 600, display: 'block', marginBottom: 6 }}>Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                id="signup-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Minimum 4 characters"
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
            id="signup-submit"
            disabled={loading}
            style={{
              width: '100%', padding: '12px', fontSize: 15, fontWeight: 700,
              background: loading ? '#999' : 'var(--text-primary)', color: 'white',
              border: 'none', borderRadius: 10, cursor: loading ? 'wait' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            <UserPlus size={16} /> {loading ? 'Creating…' : 'Create Account'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--text-muted)' }}>
          Already have an account?{' '}
          <Link href="/auth/login" style={{ color: 'var(--accent-blue)', fontWeight: 600, textDecoration: 'none' }}>
            Sign in
          </Link>
        </div>
      </div>
    </div>
  )
}
