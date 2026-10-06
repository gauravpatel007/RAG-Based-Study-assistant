import Link from 'next/link'

export default function NotFound() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-canvas)',
      fontFamily: 'var(--font-sans)',
    }}>
      <div style={{ textAlign: 'center', maxWidth: 480, padding: '40px 24px' }}>
        <div style={{
          fontSize: 80,
          fontWeight: 900,
          color: 'var(--accent-orange)',
          lineHeight: 1,
          marginBottom: 16,
          letterSpacing: '-0.04em',
        }}>
          404
        </div>
        <h1 style={{
          fontSize: 28,
          fontWeight: 800,
          color: 'var(--text-primary)',
          marginBottom: 12,
        }}>
          Page not found
        </h1>
        <p style={{
          fontSize: 16,
          color: 'var(--text-secondary)',
          lineHeight: 1.6,
          marginBottom: 32,
        }}>
          The page you're looking for doesn't exist or has been moved.
          Check the URL or head back to safety.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
          <Link href="/landing" style={{ textDecoration: 'none' }}>
            <button style={{
              padding: '12px 24px',
              background: 'var(--text-primary)',
              color: 'white',
              border: 'none',
              borderRadius: 10,
              fontSize: 15,
              fontWeight: 700,
              cursor: 'pointer',
            }}>
              Go to Home
            </button>
          </Link>
          <Link href="/auth/login" style={{ textDecoration: 'none' }}>
            <button style={{
              padding: '12px 24px',
              background: 'white',
              color: 'var(--text-primary)',
              border: '1.5px solid var(--border-default)',
              borderRadius: 10,
              fontSize: 15,
              fontWeight: 700,
              cursor: 'pointer',
            }}>
              Sign In
            </button>
          </Link>
        </div>
      </div>
    </div>
  )
}
