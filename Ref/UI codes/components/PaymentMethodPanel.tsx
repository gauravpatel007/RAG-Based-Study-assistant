'use client'
import { useState } from 'react'
import { X, QrCode, Banknote, Smartphone, CreditCard, Plus, Trash2 } from 'lucide-react'

type Denomination = { value: number; type: 'note' | 'coin'; label: string }
type PaymentMethod = {
  id?: number
  name: string
  type: 'Cash' | 'Card' | 'UPI' | 'Custom'
  isActive: boolean
  upiId?: string
  merchantName?: string
  denominations: Denomination[]
}

export default function PaymentMethodPanel({
  isOpen,
  onClose,
  initialData
}: {
  isOpen: boolean
  onClose: () => void
  initialData?: PaymentMethod | null
}) {
  const [method, setMethod] = useState<PaymentMethod>(
    initialData || {
      name: '',
      type: 'UPI',
      isActive: true,
      upiId: '',
      merchantName: 'Cafe POS',
      denominations: []
    }
  )

  if (!isOpen) return null

  const addDenomination = () => {
    setMethod({
      ...method,
      denominations: [...method.denominations, { value: 100, type: 'note', label: '₹100 Note' }]
    })
  }

  const removeDenomination = (index: number) => {
    const fresh = [...method.denominations]
    fresh.splice(index, 1)
    setMethod({ ...method, denominations: fresh })
  }

  return (
    <>
      <div 
        className="panel-backdrop" 
        onClick={onClose}
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.4)', zIndex: 999
        }}
      />
      
      <div 
        className="slide-panel animate-slide-in"
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, 
          width: '560px', backgroundColor: 'var(--bg-card)', 
          zIndex: 1000, boxShadow: 'var(--shadow-lg)',
          display: 'flex', flexDirection: 'column',
          borderLeft: '1px solid var(--border-default)',
          animation: 'slideIn 0.3s ease forwards'
        }}
      >
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>{initialData ? 'Edit Payment Method' : 'Configure Payment Method'}</h2>
          <button onClick={onClose} className="btn-icon" style={{ border: 'none' }}><X size={18} /></button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '24px' }}>
          
          {/* General Settings */}
          <div style={{ marginBottom: 28 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, borderBottom: '1px solid var(--border-light)', paddingBottom: 8 }}>General Settings</h3>
            
            <div className="form-group">
              <label className="form-label">Method Name (Customer Facing)</label>
              <input type="text" className="form-input" value={method.name} onChange={e => setMethod({...method, name: e.target.value})} placeholder="e.g. Google Pay / PhonePe" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Tender Type</label>
                <select className="form-input form-select" value={method.type} onChange={e => setMethod({...method, type: e.target.value as any})}>
                  <option value="Cash">Cash</option>
                  <option value="Card">Terminal / Card</option>
                  <option value="UPI">UPI / QR Code</option>
                  <option value="Custom">Custom Token</option>
                </select>
              </div>
              <div className="form-group" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <label className="form-label">&nbsp;</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input type="checkbox" id="active-toggle" checked={method.isActive} onChange={e => setMethod({...method, isActive: e.target.checked})} style={{ width: 16, height: 16 }} />
                  <label htmlFor="active-toggle" style={{ fontSize: 13.5, fontWeight: 500 }}>Active Method</label>
                </div>
              </div>
            </div>
          </div>

          {/* UPI Specific Configurations */}
          {method.type === 'UPI' && (
            <div style={{ marginBottom: 28 }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16, borderBottom: '1px solid var(--border-light)', paddingBottom: 8 }}>UPI Integration</h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24 }}>
                <div>
                  <div className="form-group">
                    <label className="form-label">UPI ID (VPA)</label>
                    <input type="text" className="form-input" value={method.upiId} onChange={e => setMethod({...method, upiId: e.target.value})} placeholder="e.g. yourcafe@ybl" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Merchant Name</label>
                    <input type="text" className="form-input" value={method.merchantName} onChange={e => setMethod({...method, merchantName: e.target.value})} placeholder="Cafe Name" />
                  </div>
                </div>
                
                {/* Auto Generated QR Display */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                  <label className="form-label">Dynamic QR Preview</label>
                  <div style={{ 
                    width: 130, height: 130, border: '1px solid var(--border-default)', 
                    borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'white'
                  }}>
                    {method.upiId ? (
                      <QrCode size={90} color="var(--text-primary)" strokeWidth={1.5} />
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', padding: 8 }}>Enter UPI ID to generate</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Cash Denominations Configurations */}
          {method.type === 'Cash' && (
            <div style={{ marginBottom: 28 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid var(--border-light)', paddingBottom: 8 }}>
                 <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Cash Denominations</h3>
                 <button onClick={addDenomination} className="btn btn-ghost btn-sm" style={{ padding: '4px 8px', fontSize: 11 }}>
                   <Plus size={12} /> Add Rule
                 </button>
              </div>

              {method.denominations.length === 0 ? (
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)', background: 'var(--bg-canvas)', padding: 12, borderRadius: 8, textAlign: 'center' }}>
                  No denominations set. Add them to enable rapid till balancing options.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {method.denominations.map((den, i) => (
                    <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', background: 'var(--bg-canvas)', padding: '10px 12px', borderRadius: 8 }}>
                      <div style={{ flex: 1 }}>
                        <input type="number" className="form-input" style={{ padding: '6px 10px', fontSize: 12.5 }} value={den.value} onChange={e => {
                          const d = [...method.denominations]; d[i].value = parseFloat(e.target.value)||0; setMethod({...method, denominations: d});
                        }} placeholder="Value" />
                      </div>
                      <div style={{ flex: 1 }}>
                        <select className="form-input form-select" style={{ padding: '6px 10px', fontSize: 12.5 }} value={den.type} onChange={e => {
                          const d = [...method.denominations]; d[i].type = e.target.value as any; setMethod({...method, denominations: d});
                        }}>
                          <option value="note">Note</option>
                          <option value="coin">Coin</option>
                        </select>
                      </div>
                      <div style={{ flex: 1 }}>
                         <input type="text" className="form-input" style={{ padding: '6px 10px', fontSize: 12.5 }} value={den.label} onChange={e => {
                          const d = [...method.denominations]; d[i].label = e.target.value; setMethod({...method, denominations: d});
                        }} placeholder="Label (₹500 Note)" />
                      </div>
                      <button className="btn-icon" style={{ padding: '6px', border: 'none', background: 'transparent' }} onClick={() => removeDenomination(i)}>
                        <Trash2 size={16} color="var(--accent-red)" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Supported Actions Preview */}
          <div style={{ background: 'var(--accent-blue-light)', border: '1px solid var(--accent-blue)', borderRadius: 8, padding: 16 }}>
            <h4 style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent-blue)', marginBottom: 6 }}>Payment Features Supported</h4>
            <ul style={{ fontSize: 12.5, color: '#333', marginLeft: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <li>Full and partial payments tracking.</li>
              {method.type === 'Cash' && <li>Session till balancing and expected cash calculations.</li>}
              {method.type === 'UPI' && <li>Dynamic QR generation linking total order amount directly to your VPA.</li>}
              {method.type === 'Card' && <li>Card transaction state tracking (Requires integrated physical terminal).</li>}
            </ul>
          </div>
        </div>

        <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-light)', display: 'flex', justifyContent: 'flex-end', gap: 12, background: 'var(--bg-card)' }}>
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={async () => {
            try {
              await fetch('/api/payment-methods', {
                method: initialData?.id ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  id: method.id,
                  name: method.name || method.type, // fallback
                  type: method.type,
                  is_active: method.isActive,
                  upi_id: method.upiId,
                  merchant_name: method.merchantName
                })
              })
              onClose()
            } catch (e) {
              console.error('Failed to save config', e)
            }
          }}>
            {initialData ? 'Update Method' : 'Save Payment Configuration'}
          </button>
        </div>
      </div>
    </>
  )
}
