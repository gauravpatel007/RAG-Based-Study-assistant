import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

// GET /api/stripe/check-status?sessionId=xxx — poll for Stripe payment status
export async function GET(req: NextRequest) {
  try {
    const sessionId = req.nextUrl.searchParams.get('sessionId')

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId required' }, { status: 400 })
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId)

    return NextResponse.json({
      status: session.payment_status, // 'paid' | 'unpaid' | 'no_payment_required'
      amountTotal: session.amount_total ? session.amount_total / 100 : 0, // Convert paise back to rupees
      customerEmail: session.customer_details?.email || null,
      paymentIntent: session.payment_intent || null,
    })
  } catch (err: any) {
    console.error('GET /api/stripe/check-status error:', err)
    return NextResponse.json(
      { error: err.message || 'Failed to check status' },
      { status: 500 }
    )
  }
}
