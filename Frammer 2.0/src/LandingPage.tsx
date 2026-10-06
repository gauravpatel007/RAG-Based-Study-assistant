import { useState } from 'react';
import { ArrowRight, BookOpen, Github, Menu, X } from 'lucide-react';
import { benefits, features, metrics, steps } from './content';
import ChatPreview from './components/ChatPreview';
import './styles/fonts.css';
import './styles/landing.css';

export interface LandingPageProps {
  appUrl?: string;
  githubUrl?: string;
}

const links = [
  { href: '#features', label: 'Features' },
  { href: '#how-it-works', label: 'How it works' },
  { href: '#architecture', label: 'Architecture' },
];

export default function LandingPage({ appUrl = '/login', githubUrl }: LandingPageProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="study-landing" id="top">
      <a className="sl-skip" href="#main-content">Skip to content</a>
      <header className="sl-header sl-container">
        <a className="sl-brand" href="#top" aria-label="Study Assistant home">
          <span className="sl-brand-icon"><BookOpen size={18} /></span>
          <span>Study Assistant</span>
        </a>
        <nav className="sl-desktop-nav" aria-label="Main navigation">
          {links.map(link => <a key={link.href} href={link.href}>{link.label}</a>)}
        </nav>
        <div className="sl-header-actions">
          <a className="sl-button sl-button-small" href={appUrl}>Get started</a>
          <button className="sl-menu-toggle sl-icon-button" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} aria-controls="mobile-navigation" onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
        {menuOpen && <nav id="mobile-navigation" className="sl-mobile-nav" aria-label="Mobile navigation" onKeyDown={e => { if (e.key === 'Escape') setMenuOpen(false); }}>
          {links.map(link => <a key={link.href} href={link.href} onClick={() => setMenuOpen(false)}>{link.label}</a>)}
        </nav>}
      </header>

      <main id="main-content">
        <section className="sl-hero sl-container" aria-labelledby="hero-title">
          <div className="sl-local-badge"><span>Local</span> Runs on your machine · zero API cost</div>
          <h1 id="hero-title">Ask your textbooks anything. Get answers with page citations.</h1>
          <p className="sl-hero-description">Study Assistant is a privacy-first AI study platform. Upload PDFs, chat grounded strictly in the text, and extract exam-ready topics — all on-device, with no cloud and no hallucinations.</p>
          <div className="sl-hero-actions">
            <a className="sl-button" href={appUrl}>Start studying free <ArrowRight size={16} /></a>
            {githubUrl ? <a className="sl-button sl-button-outline" href={githubUrl} target="_blank" rel="noreferrer"><Github size={16} /> View on GitHub</a>
              : <button className="sl-button sl-button-outline" disabled title="Repository link has not been configured"><Github size={16} /> View on GitHub</button>}
          </div>
          <ChatPreview appUrl={appUrl} />
        </section>

        <section className="sl-benefits sl-container" aria-label="Why Study Assistant">
          {benefits.map(({ icon: Icon, title, description }) => <article key={title}>
            <Icon size={20} aria-hidden="true" />
            <h3>{title}</h3><p>{description}</p>
          </article>)}
        </section>

        <section className="sl-how" id="how-it-works" aria-labelledby="how-title">
          <div className="sl-section-heading"><span className="sl-eyebrow">How it works</span><h2 id="how-title">From PDF to exam-ready in three steps</h2></div>
          <div className="sl-card-grid sl-steps">
            {steps.map((step, index) => <article className="sl-card" key={step.title}>
              <span className="sl-step-number">0{index + 1}</span><h3>{step.title}</h3><p>{step.description}</p>
            </article>)}
          </div>
        </section>

        <section className="sl-features sl-container" id="features" aria-labelledby="features-title">
          <div className="sl-section-heading"><span className="sl-eyebrow">Features</span><h2 id="features-title">Everything you need to study smarter</h2><p>A familiar chat experience, built on a production-grade retrieval pipeline.</p></div>
          <div className="sl-card-grid">
            {features.map(({ icon: Icon, title, description }) => <article className="sl-card sl-feature-card" key={title}>
              <span className="sl-feature-icon"><Icon size={19} aria-hidden="true" /></span><h3>{title}</h3><p>{description}</p>
            </article>)}
          </div>
        </section>

        <section className="sl-architecture" id="architecture" aria-labelledby="architecture-title">
          <div className="sl-architecture-panel">
            <div className="sl-architecture-copy"><span className="sl-eyebrow">Architecture</span><h2 id="architecture-title">Production-grade, top to bottom</h2>
              <p>Async FastAPI, SQLAlchemy 2.0 with Alembic migrations, PostgreSQL job queue with leases and retries, Argon2 auth with HttpOnly sessions — and a React + TypeScript + Vite front end.</p>
              <p className="sl-stack">qwen3:4b · MiniLM-L6-v2 · ChromaDB · FastAPI · PostgreSQL</p>
            </div>
            <div className="sl-metrics">{metrics.map(metric => <div className="sl-metric" key={metric.value}><strong>{metric.value}</strong><span>{metric.label}</span></div>)}</div>
          </div>
        </section>

        <section className="sl-final-cta sl-container" aria-labelledby="cta-title">
          <h2 id="cta-title">Your textbooks, finally talking back.</h2>
          <p>Install Ollama, pull qwen3:4b and start asking — privately, for free.</p>
          <div className="sl-command"><code>$ ollama pull qwen3:4b</code><a className="sl-button sl-button-small" href={appUrl}>Get started <ArrowRight size={16} /></a></div>
        </section>
      </main>
      <footer className="sl-footer sl-container"><span>© 2026 Study Assistant · On-device AI for learners</span><span>Built with Ollama, ChromaDB &amp; FastAPI</span></footer>
    </div>
  );
}
