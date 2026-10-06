'use client'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  Home, ShoppingBag, UtensilsCrossed, LayoutGrid,
  Users, BarChart3, CreditCard, UserCheck, Settings,
  Coffee, LogOut, Search, Bell, ClipboardList, HelpCircle
} from 'lucide-react'
import { logout } from '@/lib/auth'

const allNavItems = [
  { href: '/admin/dashboard', label: 'Dashboard',        icon: Home         },
  { href: '/admin/orders',    label: 'Order History',    icon: ShoppingBag  },
  { href: '/admin/products',  label: 'Products',         icon: UtensilsCrossed },
  { href: '/admin/floors',    label: 'Floor Specs',      icon: LayoutGrid   },
  { href: '/admin/customers', label: 'Customers',        icon: Users        },
  { href: '/admin/reports',   label: 'Reports',          icon: BarChart3    },
  { href: '/admin/payments',  label: 'Payments',         icon: CreditCard   },
  { href: '/admin/staff',     label: 'Users & Roles',    icon: UserCheck    },
  { href: '/admin/settings',  label: 'Settings',         icon: Settings     },
]

export default function Sidebar({ role }: { role?: string }) {
  const pathname = usePathname()
  const navItems = allNavItems;

  return (
    <aside className="sidebar">
      {/* Brand */}
      <Link href="/admin/dashboard" style={{ textDecoration: 'none', color: 'inherit' }}>
        <div className="sidebar-brand" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
          <div className="brand-row">
            <div className="brand-icon">
              <Coffee size={18} />
            </div>
            <div>
              <div className="brand-name">Cafe POS</div>
              <div className="brand-sub">wxyz · Admin</div>
            </div>
          </div>
        </div>
      </Link>

      {/* Navigation */}
      <nav className="sidebar-nav" style={{ marginTop: 24 }}>
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link href={item.href} key={item.href} style={{ textDecoration: 'none' }}>
              <button
                className={`nav-item${isActive ? ' active' : ''}`}
                id={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
              >
                <span className="nav-item-icon">
                  <Icon size={17} />
                </span>
                {item.label}
              </button>
            </Link>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="sidebar-footer">
        <Link href="/pos/floor" style={{ textDecoration: 'none' }}>
          <button className="take-order-btn" id="take-order-btn" style={{ width: '100%', cursor: 'pointer' }}>
            <ShoppingBag size={16} />
            Open POS Terminal
          </button>
        </Link>
        <div className="sidebar-utils">
          <button className="util-btn" title="Logout" id="util-logout" onClick={logout} style={{ width: '100%', justifyContent: 'center', marginTop: 8, background: 'var(--accent-red-light)', color: 'var(--accent-red)', border: 'none' }}>
            <LogOut size={16} /> Logout
          </button>
        </div>
      </div>
    </aside>
  )
}
