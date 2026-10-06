'use client'
import Link from 'next/link'
import { 
  Coffee, MonitorPlay, ChefHat, BarChart3, ShieldCheck, 
  CreditCard, LayoutGrid, Zap, Phone, CheckCircle2,
  ChevronRight, ArrowRight
} from 'lucide-react'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: 'var(--font-sans)', color: 'var(--text-primary)' }}>
      
      {/* ── NAVBAR ─────────────────────────────────────────────── */}
      <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--border-light)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 24px' }}>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ background: 'var(--accent-orange)', color: 'white', padding: 8, borderRadius: 10 }}>
              <Coffee size={22} />
            </div>
            <span style={{ fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em' }}>Odoo POS</span>
          </div>

          <div style={{ display: 'flex', gap: 28, fontSize: 14, fontWeight: 600, color: 'var(--text-secondary)' }} className="hidden md:flex">
            <a href="#features" style={{ textDecoration: 'none', color: 'inherit' }}>Features</a>
            <a href="#modules" style={{ textDecoration: 'none', color: 'inherit' }}>Modules</a>
            <a href="#how-it-works" style={{ textDecoration: 'none', color: 'inherit' }}>How it Works</a>
            <a href="#about" style={{ textDecoration: 'none', color: 'inherit' }}>About</a>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <Link href="/auth/login" style={{ textDecoration: 'none' }}>
              <button style={{ padding: '8px 18px', background: 'white', border: '1.5px solid var(--border-default)', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                Log in
              </button>
            </Link>
            <Link href="/demo/pos" style={{ textDecoration: 'none' }}>
              <button style={{ padding: '8px 18px', background: 'var(--accent-blue)', color: 'white', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                Try Demo <ArrowRight size={14} />
              </button>
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO SECTION ───────────────────────────────────────── */}
      <header style={{ padding: '100px 24px', textAlign: 'center', background: 'radial-gradient(ellipse at top, #f0f6ff, white 70%)' }}>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <div style={{ display: 'inline-block', padding: '6px 14px', background: 'white', border: '1px solid var(--border-light)', borderRadius: 20, fontSize: 13, fontWeight: 700, color: 'var(--accent-blue)', marginBottom: 24, boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
            ✨ The Next-Gen Restaurant OS
          </div>
          <h1 style={{ fontSize: '3.5rem', fontWeight: 900, lineHeight: 1.1, marginBottom: 24, letterSpacing: '-0.03em' }}>
            Run your cafe smoothly.<br />
            <span style={{ color: 'var(--accent-orange)' }}>From floor to kitchen.</span>
          </h1>
          <p style={{ fontSize: 18, color: 'var(--text-secondary)', marginBottom: 40, lineHeight: 1.6, maxWidth: 600, margin: '0 auto 40px' }}>
            Odoo POS Cafe strictly separates your layout by roles. Admins manage the backend, cashiers master the floor plan, and the kitchen tracks live tickets.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
            <Link href="/auth/login" style={{ textDecoration: 'none' }}>
              <button style={{ padding: '14px 28px', background: 'var(--text-primary)', color: 'white', border: 'none', borderRadius: 12, fontSize: 16, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.1)' }}>
                Access the System <ChevronRight size={18} />
              </button>
            </Link>
            <Link href="/auth/signup" style={{ textDecoration: 'none' }}>
              <button style={{ padding: '14px 28px', background: 'white', color: 'var(--text-primary)', border: '1px solid var(--border-light)', borderRadius: 12, fontSize: 16, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}>
                Sign Up
              </button>
            </Link>
          </div>
        </div>
        
        {/* Video Mockup */}
        <div style={{ maxWidth: 1000, margin: '60px auto 0', position: 'relative' }}>
          <div style={{ background: 'white', padding: 8, borderRadius: 24, border: '1px solid var(--border-light)', boxShadow: '0 24px 64px rgba(0,0,0,0.08)' }}>
            <div style={{ background: 'black', borderRadius: 16, overflow: 'hidden', display: 'flex', aspectRatio: '16/9' }}>
               {/* Replace src with your own video URL like '/promo.mp4' */}
               <video 
                 autoPlay 
                 loop 
                 muted 
                 playsInline 
                 style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                 src="https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4"
               />
            </div>
          </div>
        </div>
      </header>

      {/* ── MVP FEATURES ───────────────────────────────────────── */}
      <section id="features" style={{ padding: '100px 24px', background: 'white' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <h2 style={{ fontSize: 32, fontWeight: 800, textAlign: 'center', marginBottom: 60 }}>Powerful Features</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
            {[
              { icon: LayoutGrid, color: 'blue', title: 'Table Based Ordering', desc: 'Interactive floor plans to manage occupied, reserved, and open tables.' },
              { icon: Zap, color: 'orange', title: 'Fast POS Billing', desc: 'High-speed checkout flow designed for high-volume cafes.' },
              { icon: CreditCard, color: 'green', title: 'Multi-Payment Integration', desc: 'Split tabs, Cash, Card, and instant UPI QR generation.' },
              { icon: ChefHat, color: 'red', title: 'Live Kitchen Display', desc: 'Tickets sync instantly from the floor to the kitchen screen.' },
              { icon: BarChart3, color: 'purple', title: 'Detailed Analytics', desc: 'Real-time sales tracking, shift reporting, and session management.' },
              { icon: ShieldCheck, color: 'gray', title: 'Strict Role Access', desc: 'Separated interfaces for Admins, Cashiers, and Kitchen Staff.' },
            ].map((f, i) => (
              <div key={i} style={{ padding: 32, background: 'var(--bg-canvas)', borderRadius: 20, border: '1px solid var(--border-light)' }}>
                <div style={{ width: 48, height: 48, borderRadius: 12, background: `var(--accent-${f.color}-light)`, color: `var(--accent-${f.color})`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                  <f.icon size={24} />
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>{f.title}</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: 15, lineHeight: 1.5 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── MODULES & ACCESS ───────────────────────────────────── */}
      <section id="modules" style={{ padding: '100px 24px', background: 'var(--text-primary)', color: 'white' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 60 }}>
          <div style={{ textAlign: 'center', maxWidth: 600, margin: '0 auto' }}>
            <h2 style={{ fontSize: 32, fontWeight: 800, marginBottom: 16 }}>Built for every role</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: 18 }}>A unified system that gives each team member exactly what they need. No overwhelming menus, just pure efficiency.</p>
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 32 }}>
            <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', padding: 40, borderRadius: 24 }}>
              <ShieldCheck size={32} color="#60a5fa" style={{ marginBottom: 24 }} />
              <h3 style={{ fontSize: 24, fontWeight: 800, marginBottom: 16 }}>Admin Backend</h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {['Dashboard & Analytics', 'Product & Menu Setup', 'Floor & Table Management', 'Staff Access Control'].map((item, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'rgba(255,255,255,0.8)' }}>
                    <CheckCircle2 size={18} color="#60a5fa" /> {item}
                  </li>
                ))}
              </ul>
            </div>
            
            <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', padding: 40, borderRadius: 24 }}>
              <MonitorPlay size={32} color="#34d399" style={{ marginBottom: 24 }} />
              <h3 style={{ fontSize: 24, fontWeight: 800, marginBottom: 16 }}>Cashier Terminal</h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {['Interactive Floor View', 'High-speed Order Entry', 'Partial & Split Payments', 'Shift Session Handling'].map((item, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'rgba(255,255,255,0.8)' }}>
                    <CheckCircle2 size={18} color="#34d399" /> {item}
                  </li>
                ))}
              </ul>
            </div>

            <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', padding: 40, borderRadius: 24 }}>
              <ChefHat size={32} color="#fb923c" style={{ marginBottom: 24 }} />
              <h3 style={{ fontSize: 24, fontWeight: 800, marginBottom: 16 }}>Kitchen Display</h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {['Live Ticket Syncing', 'To-Cook & Preparing Tracking', 'Overdue Alerts', 'Item Checklists'].map((item, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'rgba(255,255,255,0.8)' }}>
                    <CheckCircle2 size={18} color="#fb923c" /> {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ───────────────────────────────────────── */}
      <section id="how-it-works" style={{ padding: '100px 24px', background: 'var(--bg-canvas)' }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', textAlign: 'center' }}>
          <h2 style={{ fontSize: 32, fontWeight: 800, marginBottom: 60 }}>The Perfect Flow</h2>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 24, position: 'relative' }}>
            <div style={{ position: 'absolute', top: 30, left: 0, right: 0, height: 2, background: 'var(--border-light)', zIndex: 0 }} className="hidden md:block" />
            
            {[
              { step: 1, title: 'Login', desc: 'Secure Role access' },
              { step: 2, title: 'Seat Guests', desc: 'Select Table' },
              { step: 3, title: 'Order', desc: 'Send to KDS' },
              { step: 4, title: 'Prepare', desc: 'Kitchen clears ticket' },
              { step: 5, title: 'Checkout', desc: 'Collect payment' }
            ].map((s, i) => (
              <div key={i} style={{ flex: 1, minWidth: 150, zIndex: 1, background: 'var(--bg-canvas)' }}>
                <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'white', border: '2px solid var(--accent-blue)', color: 'var(--accent-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, fontWeight: 800, margin: '0 auto 20px' }}>
                  {s.step}
                </div>
                <h4 style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>{s.title}</h4>
                <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ABOUT & FOOTER ─────────────────────────────────────── */}
      <footer id="about" style={{ padding: '80px 24px 40px', borderTop: '1px solid var(--border-light)', background: 'white' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 60, marginBottom: 60 }}>
          
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
              <Coffee size={24} color="var(--accent-orange)" />
              <span style={{ fontSize: 20, fontWeight: 800 }}>Odoo POS Cafe</span>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.6, marginBottom: 20 }}>
              A full-stack, Next.js Hackathon Project demonstrating scalable Point of Sale architectures, RBAC routing, and real-time interface sync.
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <span style={{ padding: '4px 8px', background: 'var(--bg-canvas)', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>Next.js 14</span>
              <span style={{ padding: '4px 8px', background: 'var(--bg-canvas)', borderRadius: 6, fontSize: 12, fontWeight: 600 }}>PostgreSQL</span>
            </div>
          </div>

          <div>
            <h4 style={{ fontSize: 16, fontWeight: 800, marginBottom: 20 }}>Product</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, color: 'var(--text-secondary)', fontSize: 14 }}>
              <a href="#features" style={{ color: 'inherit', textDecoration: 'none' }}>Features</a>
              <a href="#modules" style={{ color: 'inherit', textDecoration: 'none' }}>Role Modules</a>
              <a href="#how-it-works" style={{ color: 'inherit', textDecoration: 'none' }}>Workflow</a>
            </div>
          </div>

          <div>
            <h4 style={{ fontSize: 16, fontWeight: 800, marginBottom: 20 }}>Access</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, color: 'var(--text-secondary)', fontSize: 14 }}>
              <Link href="/auth/login" style={{ color: 'inherit', textDecoration: 'none' }}>Sign In</Link>
              <Link href="/auth/signup" style={{ color: 'inherit', textDecoration: 'none' }}>Register Node</Link>
            </div>
          </div>
          
        </div>

        <div style={{ maxWidth: 1200, margin: '0 auto', paddingTop: 24, borderTop: '1px solid var(--border-light)', display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)', fontSize: 13 }}>
          <span>© 2026 POS Cafe Team. All rights reserved.</span>
          <span>Hackathon Project</span>
        </div>
      </footer>

    </div>
  )
}
