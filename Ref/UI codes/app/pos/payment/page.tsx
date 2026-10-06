'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { QrCode, Banknote, CreditCard, ChevronRight, CheckCircle2, ArrowLeft, Loader2, AlertCircle, RefreshCw, Star } from 'lucide-react'
import { useLocalStorageState } from '@/hooks/useLocalStorageState'
import { QRCodeCanvas } from 'qrcode.react'

type StripeSession = {
  sessionId: string
  paymentUrl: string
}

type PaymentStep = 'select' | 'qr' | 'processing' | 'success' | 'error'

export default function POSPaymentPage() {
  const router = useRouter()
  const [cart, setCart] = useLocalStorageState<any[]>('pos_active_cart', [])
  const [orderState, setOrderState] = useLocalStorageState('pos_active_order_state', 'Draft')
  const [currentOrderId, setCurrentOrderId] = useLocalStorageState<number | null>('pos_active_order_id', null)
  const [orderNumber, setOrderNumber] = useLocalStorageState<string | null>('pos_active_order_number', null)

  const subtotal = cart.reduce((acc, c) => acc + (c.price * c.qty), 0)
  const taxTotal = cart.reduce((acc, c) => acc + ((c.price * c.qty) * (c.taxRate / 100)), 0)
  const totalAmount = subtotal + taxTotal

  const [paymentMethods, setPaymentMethods] = useState<any[]>([])
  const [payments, setPayments] = useState<{method: string, amount: number}[]>([])
  const [activeMethod, setActiveMethod] = useState<any>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  // Stripe state
  const [stripeSession, setStripeSession] = useState<StripeSession | null>(null)
  const [paymentStep, setPaymentStep] = useState<PaymentStep>('select')
  const [stripeError, setStripeError] = useState<string | null>(null)
  const [pollCount, setPollCount] = useState(0)
  const pollRef = useRef<NodeJS.Timeout | null>(null)
  const [qrPulse, setQrPulse] = useState(false)

  // Feedback State
  const [feedbackRating, setFeedbackRating] = useState<number>(0)
  const [feedbackComment, setFeedbackComment] = useState('')
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false)

  const completeOrderRedirect = () => {
    setCart([])
    setOrderState('Draft')
    setCurrentOrderId(null)
    setOrderNumber(null)
    router.push('/pos/order')
  }

  const submitFeedback = async () => {
    if (feedbackRating > 0 && currentOrderId) {
      setIsSubmittingFeedback(true)
      try {
        await fetch('/api/feedback', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: currentOrderId, rating: feedbackRating, comment: feedbackComment })
        })
      } catch(e) {
        console.error('Feedback error', e)
      }
    }
    completeOrderRedirect()
  }

  useEffect(() => {
    fetch('/api/payment-methods').then(res => res.json()).then(data => {
        setPaymentMethods(data.filter((m: any) => m.is_active))
    }).catch(e => console.error("Failed to load payment methods", e))
  }, [])

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }, [])

  // QR pulse animation
  useEffect(() => {
    if (paymentStep === 'qr') {
      const t = setInterval(() => setQrPulse(p => !p), 1500)
      return () => clearInterval(t)
    }
  }, [paymentStep])

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0)
  const remaining = Math.max(0, totalAmount - totalPaid)
  const change = Math.max(0, totalPaid - totalAmount)
  const paymentState = remaining === totalAmount ? 'unpaid' : remaining > 0 ? 'partial' : 'paid'

  // ─── Create Stripe Checkout Session & show QR ───
  const createStripeSession = async (method: any) => {
    setActiveMethod(method)
    setPaymentStep('processing')
    setStripeError(null)

    try {
      const res = await fetch('/api/stripe/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: remaining,
          orderId: currentOrderId,
          orderNumber: orderNumber,
        }),
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Failed to create payment session')
      }

      const data: StripeSession = await res.json()
      setStripeSession(data)
      setPaymentStep('qr')
      setPollCount(0)

      // Start polling for payment status
      startPolling(data.sessionId, method)
    } catch (err: any) {
      console.error('Stripe session error:', err)
      setStripeError(err.message)
      setPaymentStep('error')
    }
  }

  // ─── Poll Stripe for payment confirmation ───
  const startPolling = useCallback((sessionId: string, method: any) => {
    if (pollRef.current) clearInterval(pollRef.current)

    pollRef.current = setInterval(async () => {
      try {
        setPollCount(c => c + 1)
        const res = await fetch(`/api/stripe/check-status?sessionId=${sessionId}`)
        if (!res.ok) return

        const data = await res.json()

        if (data.status === 'paid') {
          // Payment confirmed!
          clearInterval(pollRef.current!)
          pollRef.current = null

          // Record payment in our database
          if (currentOrderId) {
            await fetch(`/api/orders/${currentOrderId}/pay`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                payments: [{ method: method.name, amount: remaining }],
              }),
            })
          }

          setPayments(prev => [...prev, { method: method.name, amount: remaining }])
          setPaymentStep('success')

          // Move to Paid / Feedback screen after showing success
          setTimeout(() => {
            setOrderState('Paid')
          }, 1500)
        }
      } catch (err) {
        console.error('Polling error:', err)
      }
    }, 3000)
  }, [currentOrderId, remaining])

  // Redirect if empty (must be after all hooks)
  if (cart.length === 0 && orderState !== 'Paid') {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <h2>Cart is empty</h2>
        <button className="btn btn-primary" onClick={() => router.push('/pos/order')}>Return to Order</button>
      </div>
    )
  }

  // ─── Cancel current session ───
  const cancelSession = () => {
    if (pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
    setStripeSession(null)
    setPaymentStep('select')
    setActiveMethod(null)
    setStripeError(null)
    setPollCount(0)
  }

  // ─── Handle cash payment (manual, no Stripe) ───
  const handleCashPayment = async () => {
    const amt = remaining
    if (amt <= 0) return
    setIsProcessing(true)
    try {
      if (currentOrderId) {
        await fetch(`/api/orders/${currentOrderId}/pay`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            payments: [{ method: activeMethod.name, amount: amt }]
          })
        })
      }
      setPayments([...payments, { method: activeMethod.name, amount: amt }])
      setActiveMethod(null)
      setPaymentStep('select')
    } catch (e) {
      console.error('Payment failed', e)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleFinish = () => {
    setOrderState('Paid')
  }

  // ─── Paid state screen ───
  if (orderState === 'Paid') {
     return (
       <div style={{ height: 'calc(100vh - 56px)', display: 'flex', alignItems: 'center', justifyItems: 'center', justifyContent: 'center' }}>
          <div style={{ textAlign: 'center', background: 'var(--bg-card)', padding: '40px 60px', borderRadius: 24, boxShadow: 'var(--shadow-lg)', maxWidth: 500, width: '100%' }}>
            <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'var(--accent-green)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', animation: 'scaleIn 0.4s ease' }}>
              <CheckCircle2 size={40} />
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Payment Successful!</div>
            <div style={{ fontSize: 16, color: 'var(--accent-green)', fontWeight: 600 }}>Thank you for your order</div>
            
            {/* Feedback UI */}
            <div style={{ marginTop: 32, paddingTop: 32, borderTop: '1px solid var(--border-light)', animation: 'fadeIn 0.5s ease' }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: 'var(--text-primary)' }}>Rate Your Experience</h3>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 24 }}>
                {[1, 2, 3, 4, 5].map((star) => (
                  <button key={star} onClick={() => setFeedbackRating(star)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 8, transition: 'transform 0.1s ease' }} onMouseDown={e => e.currentTarget.style.transform = 'scale(0.9)'} onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}>
                    <Star size={40} fill={feedbackRating >= star ? 'var(--accent-orange)' : 'transparent'} color={feedbackRating >= star ? 'var(--accent-orange)' : 'var(--text-muted)'} strokeWidth={1.5} />
                  </button>
                ))}
              </div>
              
              {feedbackRating > 0 && (
                <div style={{ animation: 'fadeIn 0.3s ease' }}>
                  <textarea
                    placeholder="Tell us what you liked (optional)..."
                    value={feedbackComment}
                    onChange={(e) => setFeedbackComment(e.target.value)}
                    style={{ width: '100%', height: 100, padding: 16, borderRadius: 12, border: '1px solid var(--border-default)', fontSize: 15, marginBottom: 24, resize: 'none', outline: 'none' }}
                  />
                </div>
              )}
              
              <div style={{ display: 'flex', gap: 12 }}>
                <button className="btn btn-secondary" style={{ flex: 1, padding: '16px', fontSize: 15 }} onClick={completeOrderRedirect}>
                  {feedbackRating > 0 ? 'Not Now' : 'Skip'}
                </button>
                <button 
                  className="btn btn-primary" 
                  style={{ flex: 2, padding: '16px', fontSize: 15, opacity: feedbackRating === 0 ? 0.5 : 1 }} 
                  disabled={feedbackRating === 0 || isSubmittingFeedback} 
                  onClick={submitFeedback}
                >
                  {isSubmittingFeedback ? 'Submitting...' : 'Submit Feedback'}
                </button>
              </div>
            </div>
          </div>
       </div>
     )
  }

  return (
    <div className="animate-fade-in" style={{ display: 'flex', height: 'calc(100vh - 56px)', backgroundColor: 'var(--bg-canvas)' }}>
      {/* LEFT COLUMN: Payment Selection */}
      <div style={{ flex: 1, padding: '40px 60px', display: 'flex', flexDirection: 'column' }}>
        <button onClick={() => { cancelSession(); router.back() }} style={{ display: 'flex', alignItems: 'center', gap: 6, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: 24, fontSize: 15, width: 'fit-content' }}>
          <ArrowLeft size={18} /> Back to Order
        </button>

        <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 8 }}>Select Payment Method</h1>
        <p style={{ fontSize: 15, color: 'var(--text-muted)', marginBottom: 40 }}>Choose how the customer prefers to pay for the order.</p>

        {/* ──────── STEP: Select Method ──────── */}
        {paymentStep === 'select' && !activeMethod && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 600 }}>
            {paymentMethods.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>Loading configured methods...</div>
            ) : (
              paymentMethods.map(pm => {
                const pType = pm.type.toLowerCase()
                const Icon = pType === 'cash' ? Banknote : pType === 'upi' ? QrCode : CreditCard;
                const fgColor = pType === 'cash' ? 'var(--accent-green)' : pType === 'upi' ? 'var(--accent-blue)' : 'var(--text-secondary)';
                const bgColor = pType === 'cash' ? 'var(--accent-green-light)' : pType === 'upi' ? 'var(--accent-blue-light)' : 'white';
                const typeLabel = pType === 'cash' ? 'Physical Currency' : pType === 'upi' ? 'Scan QR Code (Stripe)' : 'Pay via Stripe QR';

                return (
                  <button key={pm.id} className="btn btn-secondary" style={{ padding: 24, display: 'flex', alignItems: 'center', gap: 20, border: '1.5px solid var(--border-default)', borderRadius: 16 }}
                    onClick={() => {
                      if (pType === 'cash') {
                        setActiveMethod(pm)
                      } else {
                        createStripeSession(pm)
                      }
                    }}
                  >
                    <div style={{ background: bgColor, color: fgColor, padding: 16, borderRadius: 12, border: pType === 'card' ? '1px solid var(--border-light)' : 'none' }}>
                      <Icon size={28}/>
                    </div>
                    <div style={{ flex: 1, textAlign: 'left' }}>
                      <div style={{ fontSize: 18, fontWeight: 700 }}>{pm.name}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{typeLabel}</div>
                    </div>
                    <ChevronRight size={24} color="var(--text-muted)" />
                  </button>
                )
              })
            )}
          </div>
        )}

        {/* ──────── STEP: Cash Payment (manual) ──────── */}
        {paymentStep === 'select' && activeMethod && activeMethod.type.toLowerCase() === 'cash' && (
          <div style={{ maxWidth: 600, animation: 'fadeIn 0.2s ease' }}>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 20, padding: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', boxShadow: 'var(--shadow-sm)' }}>
              <div style={{ width: '100%', marginBottom: 24, textAlign: 'center' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Amount Due</div>
                <div style={{ fontSize: 40, fontWeight: 800, color: 'var(--text-primary)', marginTop: 8 }}>
                  ₹{remaining.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 12, width: '100%' }}>
                <button className="btn btn-secondary" style={{ flex: 1, padding: '18px', fontSize: 16 }} onClick={() => setActiveMethod(null)}>Cancel</button>
                <button className="btn btn-primary" style={{ flex: 2, padding: '18px', fontSize: 16 }} onClick={handleCashPayment} disabled={isProcessing}>
                  {isProcessing ? 'Processing...' : `Process ${activeMethod.name} Payment`}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ──────── STEP: Creating Stripe Session ──────── */}
        {paymentStep === 'processing' && (
          <div style={{ maxWidth: 600, animation: 'fadeIn 0.2s ease' }}>
            <div style={{
              background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 20,
              padding: '60px 40px', display: 'flex', flexDirection: 'column', alignItems: 'center',
              boxShadow: 'var(--shadow-sm)'
            }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: 'linear-gradient(135deg, #635BFF 0%, #7A73FF 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 24, animation: 'spin 1s linear infinite'
              }}>
                <Loader2 size={32} color="white" />
              </div>
              <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>
                Generating Payment QR Code...
              </div>
              <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>
                Creating secure Stripe checkout session
              </div>
            </div>
          </div>
        )}

        {/* ──────── STEP: QR Code Display ──────── */}
        {paymentStep === 'qr' && stripeSession && (
          <div style={{ maxWidth: 600, animation: 'fadeIn 0.3s ease' }}>
            <div style={{
              background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: 20,
              padding: '32px 40px', display: 'flex', flexDirection: 'column', alignItems: 'center',
              boxShadow: '0 8px 32px rgba(99, 91, 255, 0.08)'
            }}>
              {/* Stripe-branded header */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
                padding: '6px 16px', background: 'linear-gradient(135deg, #635BFF 0%, #7A73FF 100%)',
                borderRadius: 20, color: 'white', fontSize: 12, fontWeight: 700,
                letterSpacing: '0.08em', textTransform: 'uppercase'
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.918 3.757 7.083c0 4.015 2.436 5.791 6.404 7.267 2.534.95 3.418 1.617 3.418 2.67 0 .943-.789 1.49-2.273 1.49-1.942 0-4.855-.867-6.862-2.084L3.5 22.07C5.643 23.417 8.87 24 11.47 24c2.63 0 4.791-.604 6.329-1.77 1.677-1.265 2.521-3.13 2.521-5.449 0-4.128-2.485-5.884-6.344-7.631z" fill="white"/></svg>
                Stripe Secure Payment
              </div>

              {/* Amount */}
              <div style={{ fontSize: 42, fontWeight: 800, color: 'var(--text-primary)', margin: '12px 0 20px' }}>
                ₹{remaining.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>

              {/* QR Code */}
              <div style={{
                padding: 24, background: 'white', borderRadius: 20,
                border: qrPulse ? '3px solid #635BFF' : '3px solid #A5A0FF',
                display: 'inline-block', marginBottom: 20,
                boxShadow: qrPulse ? '0 0 20px rgba(99, 91, 255, 0.25)' : '0 0 10px rgba(99, 91, 255, 0.1)',
                transition: 'all 0.5s ease'
              }}>
                <QRCodeCanvas
                  value={stripeSession.paymentUrl}
                  size={240}
                  level="H"
                  includeMargin={true}
                  fgColor="#1a1a2e"
                  imageSettings={{
                    src: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23635BFF'%3E%3Cpath d='M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.918 3.757 7.083c0 4.015 2.436 5.791 6.404 7.267 2.534.95 3.418 1.617 3.418 2.67 0 .943-.789 1.49-2.273 1.49-1.942 0-4.855-.867-6.862-2.084L3.5 22.07C5.643 23.417 8.87 24 11.47 24c2.63 0 4.791-.604 6.329-1.77 1.677-1.265 2.521-3.13 2.521-5.449 0-4.128-2.485-5.884-6.344-7.631z'/%3E%3C/svg%3E",
                    height: 28,
                    width: 28,
                    excavate: true,
                  }}
                />
              </div>

              {/* Scanning status */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '10px 20px', borderRadius: 12,
                background: '#F0EEFF', color: '#635BFF',
                fontSize: 14, fontWeight: 600, marginBottom: 16
              }}>
                <div style={{
                  width: 10, height: 10, borderRadius: '50%', background: '#635BFF',
                  animation: 'pulse 1.5s ease-in-out infinite'
                }} />
                Waiting for customer to scan & pay...
              </div>

              {/* Instructions */}
              <div style={{
                width: '100%', padding: '14px 18px',
                background: 'var(--bg-canvas)', borderRadius: 12,
                display: 'flex', flexDirection: 'column', gap: 8,
                fontSize: 13, color: 'var(--text-secondary)', marginBottom: 20
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 700, color: '#635BFF', fontSize: 16 }}>1.</span>
                  Ask the customer to scan this QR code with their phone camera
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 700, color: '#635BFF', fontSize: 16 }}>2.</span>
                  Complete payment on the Stripe checkout page
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontWeight: 700, color: '#635BFF', fontSize: 16 }}>3.</span>
                  Payment will auto-confirm here once done ✓
                </div>
              </div>

              {/* Poll count indicator */}
              {pollCount > 0 && (
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 16 }}>
                  Checking payment status... ({pollCount} checks)
                </div>
              )}

              {/* Cancel button */}
              <div style={{ display: 'flex', gap: 12, width: '100%' }}>
                <button className="btn btn-secondary" style={{ flex: 1, padding: '16px', fontSize: 15, fontWeight: 600 }} onClick={cancelSession}>
                  ✕ Cancel Payment
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ──────── STEP: Payment Success ──────── */}
        {paymentStep === 'success' && (
          <div style={{ maxWidth: 600, animation: 'fadeIn 0.3s ease' }}>
            <div style={{
              background: 'var(--bg-card)', border: '2px solid var(--accent-green)', borderRadius: 20,
              padding: '48px 40px', display: 'flex', flexDirection: 'column', alignItems: 'center',
              boxShadow: '0 8px 32px rgba(16, 185, 129, 0.1)'
            }}>
              <div style={{
                width: 80, height: 80, borderRadius: '50%',
                background: 'var(--accent-green)', color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 20, animation: 'scaleIn 0.4s ease'
              }}>
                <CheckCircle2 size={44} />
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>
                Payment Received! ✓
              </div>
              <div style={{ fontSize: 16, color: 'var(--accent-green)', fontWeight: 600, marginBottom: 4 }}>
                ₹{remaining.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} paid via Stripe
              </div>
              <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>
                Completing order...
              </div>
            </div>
          </div>
        )}

        {/* ──────── STEP: Error ──────── */}
        {paymentStep === 'error' && (
          <div style={{ maxWidth: 600, animation: 'fadeIn 0.2s ease' }}>
            <div style={{
              background: 'var(--bg-card)', border: '1.5px solid #EF4444', borderRadius: 20,
              padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center',
              boxShadow: 'var(--shadow-sm)'
            }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%',
                background: '#FEF2F2', color: '#EF4444',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 20
              }}>
                <AlertCircle size={32} />
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 8, color: 'var(--text-primary)' }}>
                Payment Error
              </div>
              <div style={{ fontSize: 14, color: '#EF4444', marginBottom: 24, textAlign: 'center', maxWidth: 400 }}>
                {stripeError || 'An unexpected error occurred while creating the payment session.'}
              </div>
              <div style={{ display: 'flex', gap: 12, width: '100%' }}>
                <button className="btn btn-secondary" style={{ flex: 1, padding: '16px', fontSize: 15 }} onClick={cancelSession}>
                  ← Go Back
                </button>
                <button className="btn btn-primary" style={{ flex: 1, padding: '16px', fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                  onClick={() => activeMethod && createStripeSession(activeMethod)}
                >
                  <RefreshCw size={16} /> Retry
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* RIGHT COLUMN: Ledger */}
      <div style={{ width: 440, background: 'var(--bg-card)', borderLeft: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '32px 40px', borderBottom: '1px solid var(--border-light)' }}>
          <h2 style={{ fontSize: 24, fontWeight: 800 }}>Order Summary</h2>
          <div style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4 }}>
            {cart.length} items {orderNumber ? `· ${orderNumber}` : ''}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '24px 40px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 32 }}>
            {cart.map((item, i) => (
              <div key={item.id || i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                <div>
                  <span style={{ fontWeight: 600 }}>{item.name}</span>
                  <span style={{ color: 'var(--text-muted)', marginLeft: 8 }}>x{item.qty}</span>
                </div>
                <span style={{ fontWeight: 600 }}>₹{item.price * item.qty}</span>
              </div>
            ))}
          </div>

          <div style={{ borderTop: '2px dashed var(--border-default)', paddingTop: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
             <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15 }}>
               <span style={{ color: 'var(--text-secondary)' }}>Total Amount</span>
               <span style={{ fontWeight: 800 }}>₹{totalAmount.toLocaleString()}</span>
             </div>
             
             {payments.map((p, idx) => (
               <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 15, background: 'var(--bg-canvas)', padding: '12px 16px', borderRadius: 8 }}>
                 <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>Paid ({p.method})</span>
                 <span style={{ fontWeight: 800, color: 'var(--accent-green)' }}>- ₹{p.amount.toLocaleString()}</span>
               </div>
             ))}
          </div>
        </div>

        {/* Checkout Status Logic */}
        <div style={{ padding: '24px 40px', background: 'var(--bg-canvas)', borderTop: '1px solid var(--border-light)' }}>
           {remaining > 0 ? (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                 <div style={{ display: 'flex', flexDirection: 'column' }}>
                   <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{paymentState === 'partial' ? 'Partial Balance' : 'Balance Due'}</span>
                   <span style={{ fontSize: 32, fontWeight: 800, color: paymentState === 'partial' ? 'var(--accent-orange)' : 'var(--text-primary)' }}>₹{remaining.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                 </div>
              </div>
           ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                 {change > 0 && (
                   <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--accent-orange-light)', color: 'var(--accent-orange)', padding: '16px 20px', borderRadius: 12 }}>
                     <span style={{ fontSize: 15, fontWeight: 700 }}>Change Due to Customer</span>
                     <span style={{ fontSize: 24, fontWeight: 800 }}>₹{change.toLocaleString()}</span>
                   </div>
                 )}
                 <button className="btn btn-primary" style={{ width: '100%', padding: '20px', fontSize: 18, background: 'var(--accent-green)' }} onClick={handleFinish}>
                   <CheckCircle2 size={22} style={{ marginRight: 8 }} /> Complete Order
                 </button>
              </div>
           )}
        </div>
      </div>

      {/* Animations */}
      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes scaleIn {
          from { transform: scale(0); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(1.3); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
