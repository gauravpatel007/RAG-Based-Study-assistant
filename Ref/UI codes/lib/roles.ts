// ── Role Definitions & Route Mappings ────────────────────────────
// Add new roles here — middleware and auth will pick them up automatically.

export type UserRole = 'admin' | 'manager' | 'cashier' | 'kitchen' | 'waiter'

export interface RoleConfig {
  label: string
  home: string            // Default redirect after login
  prefixes: string[]      // Allowed route prefixes
  color: string           // UI accent color
}

export const ROLES: Record<UserRole, RoleConfig> = {
  admin: {
    label: 'Admin',
    home: '/admin/dashboard',
    prefixes: ['/admin', '/pos', '/kitchen'],   // Admins can access everything
    color: '#006aff',
  },
  manager: {
    label: 'Manager',
    home: '/admin/dashboard',
    prefixes: ['/admin', '/pos'],
    color: '#7c3aed',
  },
  cashier: {
    label: 'Cashier',
    home: '/pos/floor',
    prefixes: ['/pos'],
    color: '#00b259',
  },
  kitchen: {
    label: 'Kitchen Staff',
    home: '/kitchen/display',
    prefixes: ['/kitchen'],
    color: '#f5a623',
  },
  waiter: {
    label: 'Waiter',
    home: '/pos/floor',
    prefixes: ['/pos'],
    color: '#06b6d4',
  },
} as const

// Routes that don't require authentication
export const PUBLIC_ROUTES = ['/landing', '/auth', '/demo', '/unauthorized']

// Check if a route is public
export function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(route => pathname === route || pathname.startsWith(route + '/'))
}

// Check if a role can access a route
export function canAccess(role: UserRole, pathname: string): boolean {
  const config = ROLES[role]
  if (!config) return false
  return config.prefixes.some(prefix => pathname.startsWith(prefix))
}

// Get the home page for a role
export function getHomeForRole(role: UserRole): string {
  return ROLES[role]?.home ?? '/auth/login'
}

// Get all available roles for signup dropdown
export function getSignupRoles(): { value: UserRole; label: string }[] {
  return [
    { value: 'admin', label: 'Admin' },
    { value: 'cashier', label: 'Cashier' },
    { value: 'kitchen', label: 'Kitchen Staff' },
  ]
}
