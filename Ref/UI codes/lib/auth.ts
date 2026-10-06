// ── Centralized Authentication Module ────────────────────────────
// All auth logic lives here. Pages import from this module instead
// of directly manipulating cookies or calling APIs.
//
// TODO: Replace mock logic with real API calls to POST /api/v1/auth/login etc.

import { type UserRole, ROLES, getHomeForRole } from './roles'

// ── Session Type ─────────────────────────────────────────────────
export interface UserSession {
  id: string
  name: string
  email: string
  role: UserRole
}

const COOKIE_NAME = 'pos_session'

// ── Cookie Helpers (client-side) ─────────────────────────────────
function setCookie(name: string, value: string, maxAge: number = 86400) {
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`
}

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

function deleteCookie(name: string) {
  document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT`
}

// ── Public API ───────────────────────────────────────────────────

/**
 * Attempt to log in with email and password.
 * Returns the session if successful, or throws an error.
 *
 * TODO: Replace with real API call:
 *   const res = await fetch('/api/v1/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
 */
export async function login(email: string, password: string): Promise<UserSession> {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 600))

  if (!email || !password) {
    throw new Error('Please fill in both fields.')
  }

  if (password.length < 3) {
    throw new Error('Invalid credentials.')
  }

  // Mock role detection based on email
  // TODO: Replace with backend response
  let role: UserRole = 'cashier'
  const emailLower = email.toLowerCase()
  if (emailLower.includes('admin')) role = 'admin'
  else if (emailLower.includes('kitchen')) role = 'kitchen'
  else if (emailLower.includes('manager')) role = 'manager'
  else if (emailLower.includes('waiter')) role = 'waiter'

  const session: UserSession = {
    id: `user_${Math.random().toString(36).substr(2, 8)}`,
    name: email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    email,
    role,
  }

  setCookie(COOKIE_NAME, JSON.stringify(session))
  return session
}

/**
 * Register a new account.
 *
 * TODO: Replace with real API call:
 *   const res = await fetch('/api/v1/auth/signup', { method: 'POST', body: JSON.stringify({ name, email, password, role }) })
 */
export async function signup(name: string, email: string, password: string, role: UserRole = 'cashier'): Promise<UserSession> {
  await new Promise(resolve => setTimeout(resolve, 800))

  if (!name || !email || !password) {
    throw new Error('Please fill in all fields.')
  }

  if (password.length < 4) {
    throw new Error('Password must be at least 4 characters.')
  }

  const session: UserSession = {
    id: `user_${Math.random().toString(36).substr(2, 8)}`,
    name,
    email,
    role,
  }

  setCookie(COOKIE_NAME, JSON.stringify(session))
  return session
}

/**
 * Get the current user session from the cookie (client-side).
 * Returns null if not logged in or cookie is invalid.
 */
export function getSession(): UserSession | null {
  const raw = getCookie(COOKIE_NAME)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as UserSession
    if (parsed.role && parsed.email) return parsed
    return null
  } catch {
    return null
  }
}

/**
 * Parse session from a raw cookie string (for middleware/server-side use).
 */
export function parseSessionFromCookie(cookieValue: string | undefined): UserSession | null {
  if (!cookieValue) return null
  try {
    const parsed = JSON.parse(decodeURIComponent(cookieValue)) as UserSession
    if (parsed.role && parsed.email) return parsed
    return null
  } catch {
    return null
  }
}

/**
 * Log out the current user and redirect to login page.
 */
export function logout() {
  deleteCookie(COOKIE_NAME)
  // Also clear the old cookie format just in case
  deleteCookie('user_role')
  window.location.href = '/auth/login'
}

/**
 * Get the redirect URL for the current session's role.
 */
export function getRedirectUrl(role: UserRole): string {
  return getHomeForRole(role)
}

// Cookie name export for middleware
export const SESSION_COOKIE_NAME = COOKIE_NAME
