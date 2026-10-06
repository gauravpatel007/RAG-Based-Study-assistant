'use client'
import { useState } from 'react'
import { ChevronRight } from 'lucide-react'

const settingsGroups = [
  {
    title: 'Business',
    items: [
      { label: 'Business Profile',  sub: 'Name, address, tax info',         href: '#' },
      { label: 'Operating Hours',   sub: 'Set your open/close times',       href: '#' },
      { label: 'Tax Configuration', sub: 'GST rates, tax groups',           href: '#' },
    ]
  },
  {
    title: 'POS Terminal',
    items: [
      { label: 'Terminal Setup',     sub: 'Register and configure terminals', href: '#' },
      { label: 'Session Settings',   sub: 'Shift rules, cash drawer config',  href: '#' },
      { label: 'Receipt Printing',   sub: 'Printer setup and receipt template',href: '#' },
    ]
  },
  {
    title: 'Payments',
    items: [
      { label: 'Payment Methods',   sub: 'Cash, card, UPI, online',          href: '#' },
      { label: 'UPI Configuration', sub: 'QR code and UPI ID setup',         href: '#' },
      { label: 'Tip Settings',      sub: 'Enable tips, suggested amounts',    href: '#' },
    ]
  },
  {
    title: 'Team',
    items: [
      { label: 'User Roles',         sub: 'Permissions for Admin, Manager, Staff', href: '#' },
      { label: 'Clock-in Rules',     sub: 'Shift start/end settings',              href: '#' },
    ]
  },
  {
    title: 'Notifications',
    items: [
      { label: 'Order Alerts',   sub: 'Sound and visual order notifications', href: '#' },
      { label: 'Low Stock Alerts',sub: 'Notify when item stock is low',      href: '#' },
      { label: 'Daily Summary',  sub: 'End-of-day report email',             href: '#' },
    ]
  },
  {
    title: 'Account',
    items: [
      { label: 'Account Details',   sub: 'Email, password, plan',          href: '#' },
      { label: 'Billing',           sub: 'Subscription and invoices',      href: '#' },
      { label: 'API Access',        sub: 'Odoo API keys and integration',  href: '#' },
    ]
  },
]

export default function SettingsPage() {
  const [activeGroup, setActiveGroup] = useState('Business')

  const group = settingsGroups.find(g => g.title === activeGroup)!

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Settings</h1>
          <div className="page-subtitle">Configure your POS Cafe system</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr', gap: 20, alignItems: 'start' }}>
        <div className="table-card" style={{ overflow: 'hidden' }}>
          {settingsGroups.map(g => (
            <button
              key={g.title}
              onClick={() => setActiveGroup(g.title)}
              id={`settings-group-${g.title.toLowerCase().replace(/\s+/g, '-')}`}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                width: '100%', padding: '12px 16px',
                background: activeGroup === g.title ? 'var(--bg-canvas)' : 'none',
                border: 'none',
                borderBottom: '1px solid var(--border-light)',
                fontWeight: activeGroup === g.title ? 700 : 500,
                fontSize: 13.5,
                color: activeGroup === g.title ? 'var(--text-primary)' : 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'background 0.15s ease',
              }}
            >
              {g.title}
              {activeGroup === g.title && <ChevronRight size={14} color="var(--text-muted)" />}
            </button>
          ))}
        </div>

        <div>
          <h2 style={{ fontSize: 17, fontWeight: 700, marginBottom: 14 }}>{group.title}</h2>
          <div className="table-card" style={{ overflow: 'hidden' }}>
            {group.items.map((item, i) => (
              <div
                key={item.label}
                id={`setting-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '16px 20px',
                  borderBottom: i < group.items.length - 1 ? '1px solid var(--border-light)' : 'none',
                  cursor: 'not-allowed',
                  opacity: 0.65,
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    {item.label}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2 }}>{item.sub}</div>
                </div>
                {/* <ChevronRight size={16} color="var(--text-muted)" /> */}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
