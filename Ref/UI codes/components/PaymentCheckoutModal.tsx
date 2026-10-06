'use client'
import { useState } from 'react'
import { X, QrCode, Banknote, CreditCard, ChevronRight, CheckCircle2 } from 'lucide-react'

type PaymentCheckoutModalProps = {
  isOpen: boolean
  onClose: () => void
  totalAmount: number
  onPaymentComplete: () => void
}

type PaymentRecord = {
  method: string
  amount: number
}

export default function PaymentCheckoutModal({
  isOpen,
  onClose,
  totalAmount,
  onPaymentComplete
}: PaymentCheckoutModalProps) {
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [activeMethod, setActiveMethod] = useState<'Select' | 'Cash' | 'Card' | 'UPI'>('Select')
  const [inputAmount, setInputAmount] = useState<string>('')
  
  // States
  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0)
  const remaining = Math.max(0, totalAmount - totalPaid)
  const change = Math.max(0, totalPaid - totalAmount)
  const paymentState = remaining === totalAmount ? 'unpaid' : remaining > 0 ? 'partial' : 'paid'

  if (!isOpen) return null

  // Defaults input to remaining balance when method chosen
  const selectMethod = (method: 'Cash' | 'Card' | 'UPI') => {
    setActiveMethod(method)
    setInputAmount(remaining.toString())
  }

  const handleApplyPayment = () => {
    const amt = parseFloat(inputAmount)
    if (isNaN(amt) || amt <= 0) return

    setPayments([...payments, { method: activeMethod, amount: amt }])
    setActiveMethod('Select')
    setInputAmount('')
  }

  const handleFinish = () => {
    onPaymentComplete()
    setPayments([])
    setActiveMethod('Select')
  }

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
    }}>
      <div 
        className="animate-slide-in"
        style={{
          width: 800, height: 500, backgroundColor: 'var(--bg-card)', 
          borderRadius: 20, boxShadow: 'var(--shadow-lg)', display: 'flex',
          overflow: 'hidden'
        }}
      >
        {/* LEFT COLUMN: Payment Selection */}
        <div style={{ flex: 1, backgroundColor: 'var(--bg-canvas)', borderRight: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column' }}>
          
          <div style={{ padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 4 }}>
            <h2 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)' }}>₹{remaining.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</h2>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '1px' }}>
               Balance Due {paymentState === 'partial' && <span style={{ color: 'var(--accent-orange)' }}>(Partial)</span>}
            </div>
          </div>

          <div style={{ flex: 1, padding: '0 32px 32px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            
            {activeMethod === 'Select' ? (
              // METHOD SELECTION MENU
              <>
                <button className="btn btn-secondary" style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 16, border: '1.5px solid var(--border-default)' }} onClick={() => selectMethod('Cash')}>
                  <div style={{ background: 'var(--accent-green-light)', color: 'var(--accent-green)', padding: 12, borderRadius: 12 }}><Banknote size={24}/></div>
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>Cash</div>
                  </div>
                  <ChevronRight size={20} color="var(--text-muted)" />
                </button>
                <button className="btn btn-secondary" style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 16, border: '1.5px solid var(--border-default)' }} onClick={() => selectMethod('UPI')}>
                  <div style={{ background: 'var(--accent-blue-light)', color: 'var(--accent-blue)', padding: 12, borderRadius: 12 }}><QrCode size={24}/></div>
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>UPI Quick Pay</div>
                  </div>
                  <ChevronRight size={20} color="var(--text-muted)" />
                </button>
                <button className="btn btn-secondary" style={{ padding: 20, display: 'flex', alignItems: 'center', gap: 16, border: '1.5px solid var(--border-default)' }} onClick={() => selectMethod('Card')}>
                  <div style={{ background: 'var(--bg-card)', color: 'var(--text-secondary)', padding: 12, borderRadius: 12, border: '1px solid var(--border-light)' }}><CreditCard size={24}/></div>
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div style={{ fontSize: 16, fontWeight: 700 }}>Card Terminal</div>
                  </div>
                  <ChevronRight size={20} color="var(--text-muted)" />
                </button>
              </>
            ) : (
              // ACTIVE METHOD PROCESSING TENDER
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', animation: 'fadeIn 0.2s ease' }}>
                 <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, cursor: 'pointer' }} onClick={() => setActiveMethod('Select')}>
                    <span style={{ fontSize: 14, color: 'var(--accent-blue)', fontWeight: 600 }}>← Back to Methods</span>
                 </div>
                 
                 <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 16, padding: 24, flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    
                    {activeMethod === 'UPI' && (
                      <div style={{ marginBottom: 24, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                         <div style={{ padding: 8, background: 'white', borderRadius: 12, border: '2px solid var(--border-light)', display: 'inline-block' }}>
                           <QrCode size={120} strokeWidth={1} color="var(--text-primary)" />
                         </div>
                         <div style={{ marginTop: 12, fontSize: 12, fontWeight: 600, color: 'var(--accent-blue)' }}>Scan to pay ₹{inputAmount}</div>
                      </div>
                    )}

                    <div style={{ width: '100%', marginBottom: 16 }}>
                      <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Amount Tendered (₹)</label>
                      <input 
                        type="number" className="form-input" 
                        style={{ fontSize: 24, fontWeight: 800, padding: '16px 20px', height: 'auto', textAlign: 'center', marginTop: 8 }}
                        value={inputAmount} onChange={e => setInputAmount(e.target.value)}
                        autoFocus
                      />
                    </div>
                    
                    <button className="btn btn-primary" style={{ width: '100%', padding: '16px', fontSize: 16 }} onClick={handleApplyPayment}>
                      Process {activeMethod} Payment
                    </button>
                 </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Ticket Summary / Ledger */}
        <div style={{ width: 320, padding: 32, display: 'flex', flexDirection: 'column', position: 'relative' }}>
          <button className="btn-icon" onClick={onClose} style={{ position: 'absolute', top: 24, right: 24, border: 'none' }}><X size={20}/></button>
          
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 24, marginTop: 8 }}>Ledger</h3>

          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
               <span style={{ color: 'var(--text-secondary)' }}>Total Amount</span>
               <span style={{ fontWeight: 700 }}>₹{totalAmount.toLocaleString()}</span>
             </div>
             
             <div style={{ borderTop: '1px dashed var(--border-default)', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {payments.map((p, idx) => (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, background: 'var(--bg-canvas)', padding: '8px 12px', borderRadius: 8 }}>
                    <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Paid ({p.method})</span>
                    <span style={{ fontWeight: 700, color: 'var(--accent-green)' }}>- ₹{p.amount.toLocaleString()}</span>
                  </div>
                ))}
             </div>
          </div>

          {/* Checkout Status Logic */}
          <div style={{ marginTop: 'auto', borderTop: '2px solid var(--border-light)', paddingTop: 20 }}>
             {remaining > 0 ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                   <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-muted)' }}>{paymentState === 'partial' ? 'Partial Balance' : 'Unpaid'}</span>
                   <span style={{ fontSize: 22, fontWeight: 800 }}>₹{remaining.toLocaleString()}</span>
                </div>
             ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                   {change > 0 && (
                     <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--accent-orange-light)', color: 'var(--accent-orange)', padding: '12px 16px', borderRadius: 12 }}>
                       <span style={{ fontSize: 14, fontWeight: 700 }}>Change Due</span>
                       <span style={{ fontSize: 18, fontWeight: 800 }}>₹{change.toLocaleString()}</span>
                     </div>
                   )}
                   <button className="btn btn-primary" style={{ width: '100%', padding: '16px', fontSize: 16, background: 'var(--accent-green)' }} onClick={handleFinish}>
                     <CheckCircle2 size={18} style={{ marginRight: 8 }} /> Complete Order
                   </button>
                </div>
             )}
          </div>

        </div>
      </div>
    </div>
  )
}
