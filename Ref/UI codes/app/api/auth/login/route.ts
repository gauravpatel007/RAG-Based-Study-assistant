import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/lib/db'
import bcrypt from 'bcrypt'
import { signToken } from '@/lib/auth-server'

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password required' }, { status: 400 })
    }

    // Try lowercase table first, then Prisma-style
    let user = null
    try {
      const res = await query('SELECT * FROM users WHERE email = $1', [email])
      user = res.rows[0]
    } catch {
      // fallback to Prisma table
      const res = await query('SELECT * FROM "User" WHERE email = $1', [email])
      user = res.rows[0]
    }

    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const hash = user.password_hash || user.passwordHash
    const passwordMatch = await bcrypt.compare(password, hash)
    if (!passwordMatch) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
    }

    const role = (user.role || 'cashier').toLowerCase()
    const token = await signToken({ userId: user.id, role, email: user.email })

    return NextResponse.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role },
    })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
