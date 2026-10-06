import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

// POST /api/stripe/create-session — create Stripe Checkout session for POS payment
export async function POST(req: NextRequest) {
  try {
    const { amount, orderId, orderNumber } = await req.json()

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    // Create a Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'inr',
            product_data: {
              name: orderNumber ? `Order ${orderNumber}` : `POS Order #${orderId}`,
              description: `Cafe payment for order ${orderNumber || orderId}`,
            },
            unit_amount: Math.round(amount * 100), // Convert to paise (smallest unit)
          },
          quantity: 1,
        },
      ],
      success_url: `${appUrl}/pos/payment?stripe_status=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/pos/payment?stripe_status=cancelled`,
      metadata: {
        orderId: String(orderId),
        orderNumber: orderNumber || '',
      },
    })

    return NextResponse.json({
      sessionId: session.id,
      paymentUrl: session.url,
    })
  } catch (err: any) {
    console.error('POST /api/stripe/create-session error:', err)
    return NextResponse.json(
      { error: err.message || 'Failed to create Stripe session' },
      { status: 500 }
    )
  }
}
