'use client'
import { useState } from 'react'
import { X, Calculator, IndianRupee, Clock, Lock, ShieldCheck } from 'lucide-react'

// Dummy notes for calculator
const DENOMINATIONS = [
  { val: 500, label: '₹500 Notes' },
  { val: 200, label: '₹200 Notes' },
  { val: 100, label: '₹100 Notes' },
  { val: 50,  label: '₹50 Notes'  },
  { val: 20,  label: '₹20 Notes'  },
  { val: 10,  label: '₹10 Coins/Notes' }
]

export default function SessionManagerModal({
  isOpen,
  onClose,
  sessionState = 'closed',
  sessionId = null,
  expectedClosing = 0,
  onSessionUpdated
}: {
  isOpen: boolean
  onClose: () => void
  sessionState?: 'open' | 'closed'
  sessionId?: number | null
  expectedClosing?: number
  onSessionUpdated?: () => void
}) {
  // Setup state for denominations counting
  const [counts, setCounts] = useState<Record<number, number>>({
    500: 0, 200: 0, 100: 0, 50: 0, 20: 0, 10: 0
  })
  const [isProcessing, setIsProcessing] = useState(false)

  if (!isOpen) return null

  // Calculations
  const calculatedTotal = Object.entries(counts).reduce((acc, [val, count]) => acc + (parseFloat(val) * count), 0)
  const variance = calculatedTotal - expectedClosing

  const handleOpenShift = async () => {
    setIsProcessing(true)
    try {
      await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'open', opening_balance: calculatedTotal, user_id: 1 })
      })
      if (onSessionUpdated) onSessionUpdated()
      onClose()
    } catch (e) {
      console.error('Failed to open session', e)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleCloseShift = async () => {
    if (!sessionId) return
    setIsProcessing(true)
    try {
      await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'close', session_id: sessionId })
      })
      if (onSessionUpdated) onSessionUpdated()
      onClose()
    } catch (e) {
      console.error('Failed to close session', e)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 24, backgroundColor: 'rgba(0,0,0,0.6)',
      backdropFilter: 'blur(4px)'
    }}>
      <div 
        className="animate-slide-in"
        style={{
          width: '100%', maxWidth: 700, backgroundColor: 'var(--bg-card)',
          borderRadius: 20, boxShadow: 'var(--shadow-lg)', overflow: 'hidden',
          display: 'flex', flexDirection: 'column', maxHeight: '90vh'
        }}
      >
        <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-canvas)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: sessionState === 'closed' ? 'var(--accent-green-light)' : 'var(--accent-orange-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: sessionState === 'closed' ? 'var(--accent-green)' : 'var(--accent-orange)' }}>
              {sessionState === 'closed' ? <Lock size={20} /> : <ShieldCheck size={20} />}
            </div>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                {sessionState === 'closed' ? 'Open Cash Drawer & Session' : 'Balance Till & Close Session'}
              </h2>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
                Terminal: POS-Main-1  ·  Cashier: User 1
              </div>
            </div>
          </div>
          {sessionState === 'open' && (
             <button onClick={onClose} className="btn-icon" style={{ border: 'none' }}><X size={20} /></button>
          )}
        </div>

        <div style={{ padding: 32, display: 'grid', gridTemplateColumns: '1fr 340px', gap: 32, overflowY: 'auto' }}>
          
          {/* Left Column: Quick Info & Summary */}
          <div>
            <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 16 }}>Session Details</h3>
            
            {sessionState === 'open' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16, background: 'var(--bg-canvas)', borderRadius: 12 }}>
                  <IndianRupee size={16} color="var(--text-muted)" />
                  <div style={{ width: '100%' }}>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Expected Cash in Drawer</div>
                    <div style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)' }}>₹{expectedClosing.toLocaleString()}</div>
                  </div>
                </div>
              </div>
            )}

            {sessionState === 'closed' && (
              <div style={{ padding: 16, background: 'var(--accent-blue-light)', border: '1px solid var(--accent-blue)', borderRadius: 12, marginBottom: 24 }}>
                <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-blue)', marginBottom: 4 }}>Starting a new shift</h4>
                <p style={{ fontSize: 12.5, color: '#333', lineHeight: 1.5 }}>
                  Count your starting float. This expected opening balance will be tracked and reconciled when you close your session today. 
                </p>
              </div>
            )}

            <div style={{ padding: 20, border: '1.5px dashed var(--border-default)', borderRadius: 16, textAlign: 'center' }}>
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 6 }}>
                {sessionState === 'closed' ? 'Actual Opening Cash' : 'Actual Counted Cash'}
              </div>
              <div style={{ fontSize: 36, fontWeight: 800, color: calculatedTotal > 0 ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                ₹{calculatedTotal.toLocaleString()}
              </div>

              {sessionState === 'open' && (
                <div style={{ 
                  marginTop: 12, padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 700, display: 'inline-block',
                  background: variance === 0 ? 'var(--accent-green-light)' : 'var(--accent-red-light)',
                  color: variance === 0 ? 'var(--accent-green)' : 'var(--accent-red)'
                }}>
                  {variance === 0 
                    ? 'Perfect Balance' 
                    : variance > 0 ? `Overage: +₹${Math.abs(variance)}` : `Shortage: -₹${Math.abs(variance)}`
                  }
                </div>
              )}
            </div>

          </div>

          {/* Right Column: Calculator / Denominations */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
               <Calculator size={16} color="var(--text-secondary)" />
               <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: 0 }}>Cash Calculator</h3>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {DENOMINATIONS.map(d => (
                <div key={d.val} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', background: 'var(--bg-canvas)', borderRadius: 10 }}>
                  <div style={{ width: 90, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{d.label}</div>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', border: '1px solid var(--border-default)', borderRadius: 6, overflow: 'hidden', background: 'white' }}>
                    <div style={{ padding: '6px 12px', background: 'var(--bg-canvas)', borderRight: '1px solid var(--border-default)', fontSize: 12, color: 'var(--text-muted)' }}>Qty</div>
                    <input 
                      type="number" min={0} 
                      value={counts[d.val] === 0 ? '' : counts[d.val]} 
                      onChange={e => setCounts({...counts, [d.val]: parseInt(e.target.value) || 0})}
                      style={{ width: '100%', padding: '6px 10px', fontSize: 14, fontWeight: 600, border: 'none', outline: 'none' }} 
                      placeholder="0"
                    />
                  </div>
                  <div style={{ width: 80, textAlign: 'right', fontSize: 14, fontWeight: 700, color: counts[d.val] ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                    ₹{(counts[d.val] * d.val) || 0}
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        <div style={{ padding: '20px 32px', borderTop: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-canvas)' }}>
          {sessionState === 'open' ? (
             <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
          ) : <div />}
          
          {sessionState === 'closed' ? (
             <button className="btn btn-primary" style={{ padding: '12px 24px', fontSize: 15 }} onClick={handleOpenShift} disabled={isProcessing}>
               {isProcessing ? 'Processing...' : 'Start Shift & Open Session'}
             </button>
          ) : (
            <button 
               className="btn btn-primary" 
               style={{ 
                 padding: '12px 24px', fontSize: 15, 
                 background: variance < 0 ? 'var(--accent-red)' : 'var(--btn-primary-bg)' 
               }} 
               onClick={handleCloseShift} disabled={isProcessing}
            >
              {isProcessing ? 'Processing...' : 'Post Variance & Close Session'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

