import { Link } from 'react-router-dom';
import {
  GraduationCap,
  Sparkles,
  ArrowRight,
  Search,
  FileText,
  Shield,
  Zap,
  Upload,
  MessageSquare,
  BookOpen,
  Brain,
  Lock,
  Database,
  Copy,
  ThumbsUp,
  ThumbsDown,
  ArrowUp,
  Paperclip,
  CheckCircle,
} from 'lucide-react';
import './LandingPage.css';

/**
 * Premium landing page for Study Assistant — inspired by the Framer reference.
 * Light theme, Inter font, teal accent (#10a37f), clean modern design.
 */
export default function LandingPage() {
  return (
    <div className="landing">
      {/* ─── Navigation ─────────────────────────────────── */}
      <nav className="lp-nav lp-animate" id="landing-nav">
        <Link to="/" className="lp-nav__brand" id="landing-brand">
          <div className="lp-nav__logo-box">
            <GraduationCap size={18} />
          </div>
          <span className="lp-nav__title">Study Assistant</span>
        </Link>

        <ul className="lp-nav__links">
          <li><a href="#features">Features</a></li>
          <li><a href="#how-it-works">How It Works</a></li>
          <li><a href="#architecture">Architecture</a></li>
        </ul>

        <Link to="/login" className="lp-nav__cta" id="landing-nav-cta">
          Get Started <ArrowRight size={14} />
        </Link>
      </nav>

      {/* ─── Hero ───────────────────────────────────────── */}
      <section className="lp-hero lp-animate lp-animate--d1" id="landing-hero">
        <div className="lp-hero__badge">
          <span className="lp-hero__badge-tag">100% Local</span>
          <span>Private AI that runs on your machine</span>
        </div>

        <h1 className="lp-hero__heading">
          Your Private AI Study Partner
        </h1>

        <p className="lp-hero__subtitle">
          Upload PDFs, ask questions answered strictly from your textbooks with
          page-level citations. Zero API cost, complete privacy.
        </p>

        <div className="lp-hero__actions">
          <Link to="/login" className="lp-btn-primary" id="landing-login-btn">
            Start Studying <ArrowRight size={16} />
          </Link>
          <a href="#how-it-works" className="lp-btn-secondary" id="landing-learn-btn">
            <BookOpen size={16} /> Learn More
          </a>
        </div>
      </section>

      {/* ─── Product Preview ────────────────────────────── */}
      <div className="lp-preview lp-animate lp-animate--d2" id="landing-preview">
        {/* Sidebar */}
        <div className="lp-preview__sidebar">
          <div className="lp-preview__new-chat">
            <Search size={15} />
            <span>New Chat</span>
          </div>
          <div className="lp-preview__section-label">Recent</div>
          <div className="lp-preview__chat-item lp-preview__chat-item--active">
            <div className="lp-preview__chat-name">Quantum Mechanics Q&A</div>
            <div className="lp-preview__chat-meta">Physics — 3 docs</div>
          </div>
          <div className="lp-preview__chat-item">
            <div className="lp-preview__chat-name">Organic Chemistry</div>
            <div className="lp-preview__chat-meta">Chemistry — 2 docs</div>
          </div>
          <div className="lp-preview__chat-item">
            <div className="lp-preview__chat-name">Linear Algebra Review</div>
            <div className="lp-preview__chat-meta">Mathematics — 5 docs</div>
          </div>
        </div>

        {/* Main Chat */}
        <div className="lp-preview__main">
          <div className="lp-preview__status">
            <div className="lp-preview__status-badge">
              <CheckCircle size={12} />
              <span>Connected to Ollama</span>
            </div>
            <span className="lp-preview__status-file">quantum_mechanics.pdf</span>
          </div>

          {/* User message */}
          <div className="lp-preview__user-row">
            <div className="lp-preview__user-msg">
              Explain the Heisenberg uncertainty principle in simple terms
            </div>
          </div>

          {/* Bot response */}
          <div className="lp-preview__bot-row">
            <div className="lp-preview__avatar">
              <Sparkles size={14} />
            </div>
            <div className="lp-preview__bot-content">
              <div className="lp-preview__bot-text">
                The <strong>Heisenberg Uncertainty Principle</strong> states that you cannot
                simultaneously know both the exact position and exact momentum of a particle.
                The more precisely you measure one, the less precisely you can know the other.
                This isn't due to measurement limitations — it's a fundamental property of
                quantum systems <em>(Griffiths, p. 110)</em>.
              </div>

              <div className="lp-preview__sources">
                <div className="lp-preview__source-chip">
                  <FileText size={12} /> quantum_mechanics.pdf — p. 110
                </div>
                <div className="lp-preview__source-chip">
                  <FileText size={12} /> quantum_mechanics.pdf — p. 112
                </div>
              </div>

              <div className="lp-preview__actions">
                <Copy size={15} />
                <ThumbsUp size={15} />
                <ThumbsDown size={15} />
              </div>
            </div>
          </div>

          <div className="lp-preview__spacer" />

          {/* Composer */}
          <div className="lp-preview__composer">
            <Paperclip size={18} />
            <span className="lp-preview__composer-text">Ask a question about your documents…</span>
            <div className="lp-preview__composer-send">
              <ArrowUp size={16} />
            </div>
          </div>
        </div>
      </div>

      {/* ─── Value Props ────────────────────────────────── */}
      <section className="lp-values lp-animate lp-animate--d3" id="landing-values">
        <div className="lp-values__item">
          <Shield className="lp-values__icon" />
          <h3 className="lp-values__title">100% Private</h3>
          <p className="lp-values__desc">
            Everything runs locally. Your documents never leave your machine —
            no cloud, no third-party APIs.
          </p>
        </div>
        <div className="lp-values__item">
          <Zap className="lp-values__icon" />
          <h3 className="lp-values__title">Zero API Cost</h3>
          <p className="lp-values__desc">
            Powered by Ollama with open-source LLMs. No subscriptions,
            no rate limits, no hidden fees.
          </p>
        </div>
        <div className="lp-values__item">
          <FileText className="lp-values__icon" />
          <h3 className="lp-values__title">Page Citations</h3>
          <p className="lp-values__desc">
            Every answer includes exact page references so you can verify
            directly in your textbook.
          </p>
        </div>
        <div className="lp-values__item">
          <Brain className="lp-values__icon" />
          <h3 className="lp-values__title">Smart RAG</h3>
          <p className="lp-values__desc">
            Retrieval-Augmented Generation ensures answers come strictly
            from your uploaded course material.
          </p>
        </div>
      </section>

      {/* ─── How It Works ───────────────────────────────── */}
      <section className="lp-how" id="how-it-works">
        <div className="lp-how__inner lp-animate lp-animate--d2">
          <div className="lp-how__header">
            <span className="lp-section-tag">How It Works</span>
            <h2 className="lp-section-heading">Three simple steps to smarter studying</h2>
            <p className="lp-section-subtitle">
              No complex setup. Upload your material, ask questions,
              and get grounded answers in seconds.
            </p>
          </div>

          <div className="lp-how__grid">
            <div className="lp-how__card">
              <span className="lp-how__step">Step 01</span>
              <h3 className="lp-how__card-title">Upload Your PDFs</h3>
              <p className="lp-how__card-desc">
                Drag and drop your textbooks, lecture notes, or research papers.
                ChromaDB automatically indexes every page for fast retrieval.
              </p>
            </div>
            <div className="lp-how__card">
              <span className="lp-how__step">Step 02</span>
              <h3 className="lp-how__card-title">Ask Questions</h3>
              <p className="lp-how__card-desc">
                Type any question in natural language. The AI searches your
                documents and retrieves the most relevant passages.
              </p>
            </div>
            <div className="lp-how__card">
              <span className="lp-how__step">Step 03</span>
              <h3 className="lp-how__card-title">Get Cited Answers</h3>
              <p className="lp-how__card-desc">
                Receive answers grounded in your material with page-level
                citations. Verify every claim against the source.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Features Grid ──────────────────────────────── */}
      <section className="lp-features" id="features">
        <div className="lp-features__header lp-animate">
          <span className="lp-section-tag">Features</span>
          <h2 className="lp-section-heading">Everything you need to study effectively</h2>
          <p className="lp-section-subtitle">
            A complete private AI study toolkit built for students, researchers,
            and anyone who learns from documents.
          </p>
        </div>

        <div className="lp-features__grid">
          <div className="lp-features__card">
            <div className="lp-features__card-icon">
              <Upload size={18} />
            </div>
            <h3 className="lp-features__card-title">PDF Upload & Parsing</h3>
            <p className="lp-features__card-desc">
              Upload any PDF — textbooks, papers, notes. Automatic text extraction
              and page-level chunking for precise retrieval.
            </p>
          </div>

          <div className="lp-features__card">
            <div className="lp-features__card-icon">
              <MessageSquare size={18} />
            </div>
            <h3 className="lp-features__card-title">Conversational AI Chat</h3>
            <p className="lp-features__card-desc">
              Natural conversation with streaming responses. Markdown rendering,
              code highlighting, and message feedback.
            </p>
          </div>

          <div className="lp-features__card">
            <div className="lp-features__card-icon">
              <Search size={18} />
            </div>
            <h3 className="lp-features__card-title">Smart Retrieval</h3>
            <p className="lp-features__card-desc">
              Semantic search powered by ChromaDB embeddings finds the most
              relevant passages from your entire document library.
            </p>
          </div>

          <div className="lp-features__card">
            <div className="lp-features__card-icon">
              <Lock size={18} />
            </div>
            <h3 className="lp-features__card-title">Complete Privacy</h3>
            <p className="lp-features__card-desc">
              Everything runs locally — Ollama for LLM, ChromaDB for vectors,
              SQLite for data. Nothing leaves your machine.
            </p>
          </div>

          <div className="lp-features__card">
            <div className="lp-features__card-icon">
              <BookOpen size={18} />
            </div>
            <h3 className="lp-features__card-title">Topic Extraction</h3>
            <p className="lp-features__card-desc">
              AI automatically identifies key topics from your documents,
              helping you navigate and understand your material.
            </p>
          </div>

          <div className="lp-features__card">
            <div className="lp-features__card-icon">
              <Database size={18} />
            </div>
            <h3 className="lp-features__card-title">Multi-Document Scope</h3>
            <p className="lp-features__card-desc">
              Select which documents to search across. Narrow or broaden
              your scope to get the most relevant answers.
            </p>
          </div>
        </div>
      </section>

      {/* ─── Architecture ───────────────────────────────── */}
      <section className="lp-arch" id="architecture">
        <div className="lp-arch__inner lp-animate">
          <div className="lp-arch__info">
            <span className="lp-section-tag">Tech Stack</span>
            <h2 className="lp-section-heading" style={{ fontSize: 32 }}>Built with modern, open tools</h2>
            <p className="lp-arch__desc">
              A local-first RAG architecture that prioritizes privacy, speed,
              and reliability. No cloud dependencies.
            </p>
            <div className="lp-arch__tags">
              <span className="lp-arch__tag">React + Vite</span>
              <span className="lp-arch__tag">FastAPI</span>
              <span className="lp-arch__tag">Ollama</span>
              <span className="lp-arch__tag">ChromaDB</span>
              <span className="lp-arch__tag">SQLite</span>
              <span className="lp-arch__tag">Alembic</span>
            </div>
          </div>

          <div className="lp-arch__metrics">
            <div className="lp-arch__metric">
              <span className="lp-arch__metric-value lp-arch__metric-value--green">$0</span>
              <span className="lp-arch__metric-label">API cost — forever</span>
            </div>
            <div className="lp-arch__metric">
              <span className="lp-arch__metric-value">100%</span>
              <span className="lp-arch__metric-label">Local processing</span>
            </div>
            <div className="lp-arch__metric">
              <span className="lp-arch__metric-value lp-arch__metric-value--green">&lt;2s</span>
              <span className="lp-arch__metric-label">Average response time</span>
            </div>
            <div className="lp-arch__metric">
              <span className="lp-arch__metric-value">∞</span>
              <span className="lp-arch__metric-label">No rate limits</span>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Final CTA ──────────────────────────────────── */}
      <section className="lp-cta lp-animate" id="landing-cta">
        <h2 className="lp-cta__heading">Ready to study smarter?</h2>
        <p className="lp-cta__subtitle">
          Get started in minutes. All you need is Ollama installed locally.
        </p>

        <div className="lp-cta__bar">
          <span className="lp-cta__code">git clone → pip install → npm start</span>
          <Link to="/login" className="lp-cta__bar-btn" id="landing-cta-btn">
            Open App <ArrowRight size={15} />
          </Link>
        </div>
      </section>

      {/* ─── Footer ─────────────────────────────────────── */}
      <footer className="lp-footer" id="landing-footer">
        <span className="lp-footer__left">
          © {new Date().getFullYear()} Study Assistant — Private AI Study Partner
        </span>
        <span className="lp-footer__right">
          Built with React, FastAPI & Ollama
        </span>
      </footer>
    </div>
  );
}
