'use client'
import { useState, useEffect } from 'react'
import { CreditCard, Smartphone, Banknote, Globe } from 'lucide-react'
import Link from 'next/link'
import PaymentMethodPanel from '@/components/PaymentMethodPanel'

const statusStyle: Record<string, string> = {
  success:  'badge-green',
  refunded: 'badge-orange',
  failed:   'badge-red',
}

const methodIcons: Record<string, any> = {
  Cash:   Banknote,
  UPI:    Smartphone,
  Card:   CreditCard,
  Online: Globe,
}

export default function PaymentsPage() {
  const [isPanelOpen, setIsPanelOpen] = useState(false)
  const [transactions, setTransactions] = useState<any[]>([])
  const [paymentBreakdown, setPaymentBreakdown] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/payment-transactions').then(res => res.json()),
      fetch('/api/reports/dashboard').then(res => res.json())
    ]).then(([txns, dashboard]) => {
      setTransactions(txns || [])
      setPaymentBreakdown(dashboard?.paymentBreakdown || [])
      setLoading(false)
    }).catch(err => {
      console.error('Failed to load payments data', err)
      setLoading(false)
    })
  }, [])

  if (loading) {
    return <div style={{ padding: 40 }}>Loading payments data...</div>
  }

  return (
    <div className="animate-fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Payments & Invoices</h1>
          <div className="page-subtitle">Track all payment transactions and methods</div>
        </div>
        <div className="header-actions">
          <button className="btn btn-secondary btn-sm" id="configure-methods-btn" onClick={() => setIsPanelOpen(true)}>Configure Methods</button>
          <Link href="/pos/order" style={{ textDecoration: 'none' }}>
            <button className="btn btn-primary btn-sm" id="take-payment-btn">Take Payment</button>
          </Link>
        </div>
      </div>

      <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 24 }}>
        {paymentBreakdown.length === 0 && (
          <div style={{ gridColumn: 'span 4', padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>No payment analytics available today</div>
        )}
        {paymentBreakdown.map((p) => {
          const Icon = methodIcons[p.method] || Banknote
          return (
            <div className="metric-card" key={p.method} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: 'var(--bg-canvas)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--text-secondary)'
                }}>
                  <Icon size={18} />
                </div>
                <div className="metric-label" style={{ marginBottom: 0 }}>{p.method}</div>
              </div>
              <div className="metric-value" style={{ fontSize: 22 }}>
                ₹{p.amount.toLocaleString()}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>
                {Math.round(p.pct)}% of total
              </div>
              <div style={{ height: 4, background: '#f0f0f0', borderRadius: 6, marginTop: 6, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${Math.round(p.pct)}%`,
                  background: p.color, borderRadius: 6
                }} />
              </div>
            </div>
          )
        })}
      </div>

      <div className="table-card">
        <div className="table-header-row">
          <span className="table-title">Recent Transactions</span>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Transaction ID</th>
              <th>Order</th>
              <th>Method</th>
              <th>Amount</th>
              <th>Cashier</th>
              <th>Status</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {transactions.length === 0 && (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No transactions found</td>
              </tr>
            )}
            {transactions.map(t => {
              const Icon = methodIcons[t.method] || Banknote
              return (
                <tr key={t.id} id={`txn-row-${t.id}`}>
                  <td style={{ fontFamily: 'monospace', fontSize: 12.5, color: 'var(--text-secondary)' }}>{t.id}</td>
                  <td style={{ fontWeight: 600, color: 'var(--accent-blue)' }}>{t.order}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Icon size={14} color="var(--text-muted)" />
                      {t.method}
                    </div>
                  </td>
                  <td style={{ fontWeight: 700 }}>₹{t.amount.toLocaleString()}</td>
                  <td style={{ color: 'var(--text-secondary)' }}>{t.cashier}</td>
                  <td><span className={`badge ${statusStyle[t.status] || 'badge-green'}`}>{t.status}</span></td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12.5 }}>{t.time}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <PaymentMethodPanel isOpen={isPanelOpen} onClose={() => setIsPanelOpen(false)} />
    </div>
  )
}

