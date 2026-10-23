import { useEffect, useState, useRef } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthContext';
import { FileText, Check, Loader2, PlayCircle, Download, Edit3, Maximize, Save, X } from 'lucide-react';
import { api } from '@/lib/api';
import { formatDocName } from '@/lib/formatters';
import { CircleBuffer } from '@/components/CircleBuffer';
import pptxgen from 'pptxgenjs';

type PresentationSet = {
  id: string;
  status: string;
  topic: string;
  slide_count: number;
  source_mix: string;
  created_at: string;
  completed_at: string | null;
  job_id: string | null;
  job_status: string | null;
  progress: any;
  error_code: string | null;
  slides: {
    id: string;
    rank: number;
    title: string;
    bullet_points: string[];
    speaker_notes: string | null;
  }[];
};

type Doc = Awaited<ReturnType<typeof api.getChatDocuments>>['items'][number];

export default function PresentationsPage() {
  const { user } = useAuth();
  const authorName = user?.display_name || user?.username || 'Student';
  const { chatId } = useParams<{ chatId: string }>();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const topicFilter = searchParams.get('topic');

  const [sets, setSets] = useState<PresentationSet[]>([]);
  const [documents, setDocuments] = useState<Doc[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [count, setCount] = useState(5);
  const [sourceMix, setSourceMix] = useState('50');
  const [topicInput, setTopicInput] = useState(topicFilter || '');
  const [topicHistory, setTopicHistory] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem('ppt_topic_history') || '[]'); } catch { return []; }
  });

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [activeSetId, setActiveSetId] = useState<string | null>(null);
  const [clock, setClock] = useState(() => Date.now());
  const [cancelling, setCancelling] = useState(false);

  const [localSlides, setLocalSlides] = useState<any[]>([]);
  const [localTitle, setLocalTitle] = useState('');
  const [localAuthor, setLocalAuthor] = useState('');
  const [localEndText, setLocalEndText] = useState('Thank You!');
  const [isEditing, setIsEditing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenIndex, setFullscreenIndex] = useState(0);

  const latest = sets.find(item => item.id === activeSetId) ?? sets[0];

  const fullscreenRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const [sidebarHeight, setSidebarHeight] = useState<number | undefined>(undefined);

  useEffect(() => {
    if (!sidebarRef.current) return;
    const updateHeight = () => {
      if (sidebarRef.current) {
        setSidebarHeight(sidebarRef.current.offsetHeight);
      }
    };
    updateHeight();
    const ro = new ResizeObserver(updateHeight);
    ro.observe(sidebarRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (latest?.slides) {
      setLocalSlides(JSON.parse(JSON.stringify(latest.slides)));
      setLocalTitle(latest.topic || '');
      setLocalAuthor(authorName || '');
      setLocalEndText('Thank You!');
    } else {
      setLocalSlides([]);
      setLocalTitle('');
      setLocalAuthor('');
      setLocalEndText('Thank You!');
    }
  }, [latest?.slides, latest?.topic, authorName]);

  useEffect(() => {
    if (isFullscreen && fullscreenRef.current) {
      if (!document.fullscreenElement) {
        fullscreenRef.current.requestFullscreen().catch(err => {
          console.error(`Error attempting to enable fullscreen: ${err.message}`);
        });
      }
    } else if (!isFullscreen && document.fullscreenElement) {
      document.exitFullscreen().catch(() => { });
    }
  }, [isFullscreen]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setIsFullscreen(false);
      }
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
      if (isFullscreen) {
        if (e.key === 'ArrowRight' || e.key === ' ') setFullscreenIndex(i => Math.min(i + 1, localSlides.length + 1));
        if (e.key === 'ArrowLeft') setFullscreenIndex(i => Math.max(i - 1, 0));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen, localSlides.length]);
  const busy = latest && ['pending', 'running', 'processing'].includes(latest.status);

  useEffect(() => {
    if (!chatId) return;
    let stopped = false;
    setLoading(true); setSelected([]); setSets([]); setActiveSetId(null); setError('');

    // We don't have getChatPresentationSets in api yet, so we'll just fetch directly for now.
    // Or we should add it to lib/api.ts. I will add it to api.ts shortly.
    Promise.all([
      fetch(`/api/v1/chats/${chatId}/presentations`).then(r => r.json()).then(r => r.items || []),
      api.getChatDocuments(chatId)
    ]).then(([presentations, docs]) => {
      if (!stopped) { setSets(presentations); setDocuments(docs.items.filter(d => d.status === 'ready')); }
    }).catch(e => { if (!stopped) setError(e.message); }).finally(() => { if (!stopped) setLoading(false); });
    return () => { stopped = true; };
  }, [chatId]);

  useEffect(() => {
    if (!busy || !chatId) return;
    let stopped = false;
    const timer = setInterval(() => {
      fetch(`/api/v1/chats/${chatId}/presentations`).then(r => r.json()).then(r => {
        if (!stopped) setSets(r.items || []);
      }).catch(e => { if (!stopped) setError(e.message); });
    }, 1000);
    return () => { stopped = true; clearInterval(timer); };
  }, [busy, chatId]);

  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [busy]);

  async function generate() {
    if (!chatId) return;
    setSubmitting(true); setError('');
    try {
      if (!topicInput.trim()) throw new Error('Please enter a topic.');
      const topicStr = topicInput.trim();
      
      const newHistory = [topicStr, ...topicHistory.filter(t => t !== topicStr)].slice(0, 5);
      setTopicHistory(newHistory);
      localStorage.setItem('ppt_topic_history', JSON.stringify(newHistory));

      const reqBody = {
        topic: topicStr,
        slide_count: count,
        source_mix: sourceMix,
        document_ids: selected.length ? selected : undefined
      };

      const res = await fetch(`/api/v1/chats/${chatId}/presentations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqBody)
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error?.message || 'Generation failed.');
      }
      const result = await res.json();

      setActiveSetId(result.presentation_set_id);
      const updated = await fetch(`/api/v1/chats/${chatId}/presentations`).then(r => r.json());
      setSets(updated.items || []);
    } catch (e) { setError((e as Error).message || 'Generation failed.'); }
    finally { setSubmitting(false); }
  }

  function exportPPTX() {
    if (!localSlides || localSlides.length === 0) return;

    const pres = new pptxgen();
    pres.layout = 'LAYOUT_16x9';
    pres.author = 'LLM Study Assistant';
    pres.subject = localTitle;

    const bgColor = 'E6E4DD';
    const blueSquare = '5B57FF';
    const greenSquare = 'C7E856';
    const darkSquare = '2B2B2B';
    const textColor = '000000';

    // Master slide for other pages
    pres.defineSlideMaster({
      title: 'MASTER_SLIDE',
      background: { color: bgColor },
      objects: [
        { rect: { x: 0, y: 5.0, w: '100%', h: 0.02, fill: { color: '444444' } } },
        { text: { text: 'AI Study Assistant', options: { x: 0.4, y: 5.15, w: 3, fontSize: 14, color: '333333' } } }
      ]
    });

    // Title Slide
    const titleSlide = pres.addSlide();
    titleSlide.background = { color: bgColor };

    // Three squares
    titleSlide.addShape(pres.ShapeType.rect, { x: 0.5, y: 0.5, w: 0.8, h: 0.8, fill: { color: blueSquare } });
    titleSlide.addShape(pres.ShapeType.rect, { x: 1.5, y: 0.5, w: 0.8, h: 0.8, fill: { color: greenSquare } });
    titleSlide.addShape(pres.ShapeType.rect, { x: 2.5, y: 0.5, w: 0.8, h: 0.8, fill: { color: darkSquare } });

    // Top right elliptical rings
    for (let i = 0; i < 3; i++) {
      titleSlide.addShape(pres.ShapeType.ellipse, {
        x: 5.5 + i * 0.25, y: -1, w: 3, h: 4.5,
        line: { color: '000000', width: 1.5 }, fill: { transparency: 100 },
        rotate: 50
      });
    }

    // Rotated Name on the right
    titleSlide.addText(localAuthor, {
      x: 8.5, y: 2.2, w: 2, h: 0.5,
      fontSize: 24, color: '2B2B2B', rotate: 270, align: 'center'
    });

    // Bottom horizontal line and logo text
    titleSlide.addShape(pres.ShapeType.rect, { x: 0, y: 4.8, w: '100%', h: 0.02, fill: { color: '444444' } });
    titleSlide.addText('AI Study Assistant', {
      x: 0.4, y: 5.0, w: 3, h: 0.4,
      fontSize: 16, color: '333333'
    });

    // Topic Name (Large bold)
    titleSlide.addText(localTitle, {
      x: 0.4, y: 3.2, w: 8, h: 1.5,
      fontSize: 64, bold: true, color: textColor, fontFace: 'Arial'
    });

    // Content Slides
    localSlides.forEach(slide => {
      const s = pres.addSlide({ masterName: 'MASTER_SLIDE' });
      const cleanTitle = slide.title.replace(/^Slide\s*\d+[\s:\-]+\s*/i, '');

      // Add Title
      s.addText(cleanTitle, {
        x: 0.4, y: 0.4, w: '90%', h: 0.5,
        fontSize: 32, bold: true, color: textColor, fontFace: 'Arial'
      });

      // Add Bullets
      if (slide.bullet_points && slide.bullet_points.length > 0) {
        const count = slide.bullet_points.length;
        s.addText(slide.bullet_points.map(bp => ({ text: bp, options: { bullet: true } })), {
          x: 0.4, y: 0.9, w: '90%', h: '80%',
          fontSize: count <= 3 ? 22 : count <= 5 ? 18 : 14, color: '333333', valign: 'top', margin: 10, lineSpacing: count <= 3 ? 32 : count <= 5 ? 24 : 18
        });
      }

      // Add Speaker Notes
      if (slide.speaker_notes) {
        s.addNotes(slide.speaker_notes);
      }
    });

    // Thank You Slide
    const thankYouSlide = pres.addSlide();
    thankYouSlide.background = { color: bgColor };

    // Three squares
    thankYouSlide.addShape(pres.ShapeType.rect, { x: 0.5, y: 0.5, w: 0.8, h: 0.8, fill: { color: blueSquare } });
    thankYouSlide.addShape(pres.ShapeType.rect, { x: 1.5, y: 0.5, w: 0.8, h: 0.8, fill: { color: greenSquare } });
    thankYouSlide.addShape(pres.ShapeType.rect, { x: 2.5, y: 0.5, w: 0.8, h: 0.8, fill: { color: darkSquare } });

    // Top right elliptical rings
    for (let i = 0; i < 3; i++) {
      thankYouSlide.addShape(pres.ShapeType.ellipse, {
        x: 5.5 + i * 0.25, y: -1, w: 3, h: 4.5,
        line: { color: '000000', width: 1.5 }, fill: { transparency: 100 },
        rotate: 50
      });
    }

    // Rotated Name on the right
    thankYouSlide.addText(localAuthor, {
      x: 8.5, y: 2.2, w: 2, h: 0.5,
      fontSize: 24, color: '2B2B2B', rotate: 270, align: 'center'
    });

    // Bottom horizontal line and logo text
    thankYouSlide.addShape(pres.ShapeType.rect, { x: 0, y: 4.8, w: '100%', h: 0.02, fill: { color: '444444' } });
    thankYouSlide.addText('AI Study Assistant', {
      x: 0.4, y: 5.0, w: 3, h: 0.4,
      fontSize: 16, color: '333333'
    });

    // Topic Name (Large bold)
    thankYouSlide.addText(localEndText, {
      x: 0.4, y: 3.2, w: 8, h: 1.5,
      fontSize: 64, bold: true, color: textColor, fontFace: 'Arial'
    });

    pres.writeFile({ fileName: `${latest.topic.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pptx` });
  }

  if (loading) return <CircleBuffer minHeight={240} size={36} />;
  const elapsed = Math.max(0, Math.floor((clock - Date.parse(latest?.created_at ?? '')) / 1000)) || 0;
  const waiting = latest?.job_status === 'pending';
  const stage = latest?.progress?.stage;

  return (
    <div className="topics-page-container animate-fade-in">
      <div className="page-header topics-header">
        <div>
          <h2 className="page-title">PPT Maker</h2>
          <p className="page-subtitle">Generate PowerPoint presentations directly from your study materials.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button id="generate-ppt-btn" className="btn btn-primary extract-btn" disabled={submitting || !!busy} onClick={() => void generate()}>
            {submitting || busy ? <Loader2 size={16} className="animate-spin" /> : <PlayCircle size={16} />}
            <span>{busy ? 'Generating...' : 'Generate PPT'}</span>
          </button>
        </div>
      </div>

      <div className="topics-layout-split">
        <div className="topics-sidebar">
          <div ref={sidebarRef} className="filter-bar topics-filter-bar">

            <div style={{ marginBottom: '16px' }}>
              <label className="filter-group">
                <span className="filter-label" style={{ fontWeight: 600 }}>Presentation Topic *</span>
                <input
                  aria-label="Presentation Topic"
                  className="form-input"
                  type="text"
                  placeholder="What is this presentation about?"
                  value={topicInput}
                  onChange={e => setTopicInput(e.target.value)}
                  list="topic-history"
                />
                <datalist id="topic-history">
                  {topicHistory.map((t, idx) => <option key={idx} value={t} />)}
                </datalist>
              </label>
            </div>

            <div className="filter-group-row">
              <label className="filter-group">
                <span className="filter-label">Slide count</span>
                <input aria-label="Slide count" className="form-input" type="number" min={1} max={20} value={count} onChange={e => setCount(Number(e.target.value))} />
              </label>
            </div>

            <div className="filter-group" style={{ marginTop: '16px' }}>
              <span className="filter-label">Knowledge Source</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 500, color: 'var(--text)' }}>
                  <span>Book ({100 - Number(sourceMix)}%)</span>
                  <span>External ({sourceMix}%)</span>
                </div>
                <div style={{ position: 'relative', padding: '10px 0' }}>
                  <div style={{ position: 'absolute', top: '50%', left: 0, right: 0, height: '6px', background: 'var(--border-default, #e5e5e5)', borderRadius: '3px', transform: 'translateY(-50%)' }} />
                  <div style={{ position: 'absolute', top: '50%', left: 0, width: `${sourceMix}%`, height: '6px', background: 'var(--accent-blue, #006aff)', borderRadius: '3px', transform: 'translateY(-50%)' }} />
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="10"
                    value={sourceMix}
                    onChange={e => setSourceMix(e.target.value)}
                    style={{
                      position: 'absolute', top: '50%', left: 0, width: '100%', transform: 'translateY(-50%)',
                      margin: 0, appearance: 'none', WebkitAppearance: 'none', background: 'transparent', cursor: 'pointer', outline: 'none'
                    }}
                    className="premium-range"
                  />
                  <style>{`
                    .premium-range::-webkit-slider-thumb {
                      -webkit-appearance: none;
                      appearance: none;
                      width: 20px;
                      height: 20px;
                      border-radius: 50%;
                      background: #ffffff;
                      border: 2px solid var(--accent-blue, #006aff);
                      cursor: pointer;
                      box-shadow: 0 2px 5px rgba(0,0,0,0.2);
                      transition: transform 0.1s;
                    }
                    .premium-range::-moz-range-thumb {
                      width: 20px;
                      height: 20px;
                      border-radius: 50%;
                      background: #ffffff;
                      border: 2px solid var(--accent-blue, #006aff);
                      cursor: pointer;
                      box-shadow: 0 2px 5px rgba(0,0,0,0.2);
                      transition: transform 0.1s;
                    }
                    .premium-range::-webkit-slider-thumb:hover { transform: scale(1.15); }
                    .premium-range::-moz-range-thumb:hover { transform: scale(1.15); }
                  `}</style>
                </div>
              </div>
            </div>

            {Number(sourceMix) < 100 && (
              <div className="filter-group doc-filter" style={{ marginTop: '16px' }}>
                <span className="filter-label">Documents to include</span>
                <div className="custom-multi-select">
                  {documents.map(d => {
                    const isSelected = selected.includes(d.id);
                    return (
                      <label key={d.id} className={`select-option ${isSelected ? 'selected' : ''}`} title={d.original_filename}>
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) setSelected([...selected, d.id]);
                            else setSelected(selected.filter(id => id !== d.id));
                          }}
                        />
                        <div className="select-option-box">
                          {isSelected && <Check size={12} className="check-icon" />}
                        </div>
                        <FileText size={14} className="doc-icon" />
                        <span className="doc-name">{formatDocName(d.original_filename)}</span>
                      </label>
                    );
                  })}
                </div>
                <small className="filter-hint">Empty uses all ready PDFs.</small>
              </div>
            )}
          </div>
        </div>

        <div
          className="topics-main-content quiz-content-card"
          style={busy && sidebarHeight ? { height: sidebarHeight, minHeight: sidebarHeight, maxHeight: sidebarHeight, boxSizing: 'border-box', marginBottom: 0 } : undefined}
        >
          {error && <div className="alert-box error animate-slide-up"><p>{error}</p></div>}
          {!error && latest?.status === 'failed' && <div className="alert-box error animate-slide-up"><p>{latest.error_code || 'Background generation failed.'}</p></div>}

          {busy && (
            <div
              className="topics-loading-state animate-fade-in"
              style={{
                height: '100%',
                minHeight: 0,
                padding: '20px 24px',
                boxSizing: 'border-box',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <div className="spinner-ring" style={{ marginBottom: '16px' }}>
                <Loader2 size={38} className="animate-spin text-accent" />
              </div>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 600 }}>
                {waiting ? 'Waiting for the local AI worker...' : stage === 'generating_presentation' ? 'Writing slides...' : 'Reading PDFs and preparing...'}
              </h3>
              <p className="text-muted" role="status" style={{ margin: '0 0 18px 0', fontSize: '13.5px' }}>
                {elapsed}s elapsed
              </p>
              {latest?.job_id && (
                <button
                  className="btn btn-secondary cancel-job-btn"
                  disabled={cancelling}
                  style={{ padding: '7px 22px', fontSize: '13px' }}
                  onClick={async () => {
                    setCancelling(true);
                    try {
                      await api.cancelJob(latest.job_id!);
                      const updated = await fetch(`/api/v1/chats/${chatId}/presentations`).then(r => r.json());
                      setSets(updated.items || []);
                    }
                    catch (e) { setError((e as Error).message); }
                    finally { setCancelling(false); }
                  }}
                >
                  {cancelling ? 'Stopping...' : 'Stop generation'}
                </button>
              )}
            </div>
          )}

          {!busy && localSlides && localSlides.length > 0 && (
            <div className="quiz-questions animate-fade-in">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <h3 style={{ margin: 0 }}>{latest.topic}</h3>
                  {latest?.completed_at && (
                    <span className="badge" style={{ backgroundColor: '#e6f7ee', color: '#00b259' }}>
                      Processed in {Math.max(0, Math.floor((Date.parse(latest.completed_at) - Date.parse(latest.created_at)) / 1000))}s
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={() => setIsEditing(!isEditing)}
                    title={isEditing ? 'Save edits' : 'Edit presentation'}
                    aria-label={isEditing ? 'Save edits' : 'Edit presentation'}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: '4px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: isEditing ? 'var(--accent-blue, #006aff)' : 'var(--text-secondary, #6b6b6b)',
                      transition: 'color 0.15s ease',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary, #1a1a1a)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = isEditing ? 'var(--accent-blue, #006aff)' : 'var(--text-secondary, #6b6b6b)'; }}
                  >
                    {isEditing ? <Save size={18} /> : <Edit3 size={18} />}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setIsFullscreen(true); setFullscreenIndex(0); }}
                    title="Fullscreen"
                    aria-label="Fullscreen"
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: '4px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--text-secondary, #6b6b6b)',
                      transition: 'color 0.15s ease',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary, #1a1a1a)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary, #6b6b6b)'; }}
                  >
                    <Maximize size={18} />
                  </button>
                  <button onClick={exportPPTX} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Download size={16} /> Export as PPTX
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
                {localSlides.map((slide, i) => (
                  <div key={slide.id || i} className="quiz-question-card" style={{ borderLeft: '4px solid var(--accent)', padding: '24px', backgroundColor: 'var(--surface-sunken)', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                      <span className="badge">Slide {i + 1}</span>
                      {isEditing ? (
                        <input
                          type="text"
                          value={slide.title}
                          onChange={(e) => {
                            const updated = [...localSlides];
                            updated[i].title = e.target.value;
                            setLocalSlides(updated);
                          }}
                          style={{ fontSize: '18px', fontWeight: 'bold', width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid var(--border)', background: 'var(--surface)' }}
                        />
                      ) : (
                        <h4 style={{ margin: 0, fontSize: '18px' }}>{slide.title.replace(/^Slide\s*\d+[\s:\-]+\s*/i, '')}</h4>
                      )}
                    </div>

                    {isEditing ? (
                      <textarea
                        value={(slide.bullet_points || []).join('\n')}
                        onChange={(e) => {
                          const updated = [...localSlides];
                          updated[i].bullet_points = e.target.value.split('\n').filter(Boolean);
                          setLocalSlides(updated);
                        }}
                        style={{ width: '100%', minHeight: '150px', padding: '12px', lineHeight: '1.6', borderRadius: '4px', border: '1px solid var(--border)', fontFamily: 'inherit', background: 'var(--surface)', resize: 'vertical' }}
                      />
                    ) : (
                      <ul style={{ paddingLeft: '24px', marginBottom: '16px' }}>
                        {(slide.bullet_points || []).map((bp: string, j: number) => (
                          <li key={j} style={{ marginBottom: '8px' }}>{bp}</li>
                        ))}
                      </ul>
                    )}

                    {slide.speaker_notes && !isEditing && (
                      <div style={{ marginTop: '16px', padding: '16px', backgroundColor: 'var(--surface)', borderRadius: '6px', fontSize: '14px', color: 'var(--text-muted)' }}>
                        <strong>Speaker Notes:</strong> {slide.speaker_notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {!busy && !latest?.slides?.length && !error && latest?.status !== 'failed' && (
            <div className="topics-empty-state">
              <div className="empty-icon-wrap">
                <FileText size={32} />
              </div>
              <h3>Ready to Present?</h3>
              <p>Enter a topic and generate a PowerPoint presentation using your local AI.</p>
            </div>
          )}
        </div>
      </div>

      {isFullscreen && (
        <div ref={fullscreenRef} style={{ position: 'fixed', inset: 0, zIndex: 99999, backgroundColor: '#111', display: 'flex', flexDirection: 'column', color: '#fff', userSelect: 'none' }}>
          <div style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: 0.5 }}>
            <span>{latest?.topic} - Slide {fullscreenIndex === 0 ? 'Title' : fullscreenIndex > localSlides.length ? 'End' : fullscreenIndex}</span>
            <div>
              <button
                type="button"
                onClick={() => setIsEditing(!isEditing)}
                title={isEditing ? 'Save edits' : 'Edit presentation'}
                aria-label={isEditing ? 'Save edits' : 'Edit presentation'}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#fff',
                  cursor: 'pointer',
                  padding: '4px',
                  marginRight: '16px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {isEditing ? <Save size={18} /> : <Edit3 size={18} />}
              </button>
              <button
                type="button"
                onClick={() => setIsFullscreen(false)}
                title="Exit fullscreen"
                aria-label="Exit fullscreen"
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#fff',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <X size={18} /> 
              </button>
            </div>
          </div>

          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            {fullscreenIndex > 0 && (
              <button onClick={() => setFullscreenIndex(fullscreenIndex - 1)} style={{ position: 'absolute', left: '20px', background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '20px', cursor: 'pointer', borderRadius: '8px', zIndex: 10 }}>◀</button>
            )}

            <div style={{ width: '100%', maxWidth: '1600px', maxHeight: '90vh', aspectRatio: '16/9', backgroundColor: '#E6E4DD', color: '#000', borderRadius: '4px', boxShadow: '0 20px 40px rgba(0,0,0,0.5)', position: 'relative', overflow: 'hidden' }}>

              {/* Master Slide Elements */}
              <div style={{ position: 'absolute', top: '88.88%', left: 0, width: '100%', height: '0.35%', backgroundColor: '#444' }} />
              <div style={{ position: 'absolute', top: '91.5%', left: '4%', fontSize: '1.8vh', color: '#333' }}>AI Study Assistant</div>

              {fullscreenIndex === 0 || fullscreenIndex > localSlides.length ? (
                <>
                  {/* Three Squares */}
                  <div style={{ position: 'absolute', top: '8.8%', left: '5%', width: '8%', height: '14.2%', backgroundColor: '#5B57FF' }} />
                  <div style={{ position: 'absolute', top: '8.8%', left: '15%', width: '8%', height: '14.2%', backgroundColor: '#C7E856' }} />
                  <div style={{ position: 'absolute', top: '8.8%', left: '25%', width: '8%', height: '14.2%', backgroundColor: '#2B2B2B' }} />

                  {/* Top Right Ellipses */}
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{
                      position: 'absolute', top: '-17.7%', left: `${55 + i * 2.5}%`, width: '30%', height: '80%',
                      border: '2px solid #000', borderRadius: '50%', transform: 'rotate(50deg)', pointerEvents: 'none'
                    }} />
                  ))}

                  {/* Rotated Author Name */}
                  <div style={{ position: 'absolute', top: '45%', left: '80%', transform: 'rotate(270deg)', width: '20%', textAlign: 'center' }}>
                    {isEditing ? (
                      <input type="text" value={localAuthor} onChange={e => setLocalAuthor(e.target.value)} style={{ fontSize: '3vh', color: '#2B2B2B', width: '100%', border: '1px dashed #999', background: 'transparent', textAlign: 'center' }} />
                    ) : (
                      <span style={{ fontSize: '3vh', color: '#2B2B2B' }}>{localAuthor}</span>
                    )}
                  </div>

                  {fullscreenIndex === 0 ? (
                    <div style={{ position: 'absolute', top: '56.8%', left: '4%', width: '80%', height: '26%' }}>
                      {isEditing ? (
                        <input type="text" value={localTitle} onChange={e => setLocalTitle(e.target.value)} style={{ fontSize: '7vh', margin: 0, color: '#000', fontFamily: 'Arial, sans-serif', fontWeight: 'bold', width: '100%', border: '1px dashed #999', background: 'transparent' }} />
                      ) : (
                        <h1 style={{ fontSize: '7vh', margin: 0, color: '#000', fontFamily: 'Arial, sans-serif', fontWeight: 'bold' }}>{localTitle}</h1>
                      )}
                    </div>
                  ) : (
                    <div style={{ position: 'absolute', top: '56.8%', left: '4%', width: '80%', height: '26%' }}>
                      {isEditing ? (
                        <input type="text" value={localEndText} onChange={e => setLocalEndText(e.target.value)} style={{ fontSize: '7vh', margin: 0, color: '#000', fontFamily: 'Arial, sans-serif', fontWeight: 'bold', width: '100%', border: '1px dashed #999', background: 'transparent' }} />
                      ) : (
                        <h1 style={{ fontSize: '7vh', margin: 0, color: '#000', fontFamily: 'Arial, sans-serif', fontWeight: 'bold' }}>{localEndText}</h1>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <>
                  {/* Content Slide */}
                  <div style={{ position: 'absolute', top: '7.1%', left: '4%', width: '90%', height: '8.8%' }}>
                    {isEditing ? (
                      <input
                        type="text"
                        value={localSlides[fullscreenIndex - 1]?.title}
                        onChange={(e) => {
                          const updated = [...localSlides];
                          updated[fullscreenIndex - 1].title = e.target.value;
                          setLocalSlides(updated);
                        }}
                        style={{ fontSize: '4.5vh', margin: 0, color: '#000', fontFamily: 'Arial, sans-serif', fontWeight: 'bold', width: '100%', border: '1px dashed #999', background: 'transparent' }}
                      />
                    ) : (
                      <h2 style={{ fontSize: '4.5vh', margin: 0, color: '#000', fontFamily: 'Arial, sans-serif', fontWeight: 'bold' }}>
                        {localSlides[fullscreenIndex - 1]?.title?.replace(/^Slide\s*\d+[\s:\-]+\s*/i, '')}
                      </h2>
                    )}
                  </div>

                  <div style={{ position: 'absolute', top: '16%', left: '4%', width: '92%', height: '72%', overflowY: 'auto' }}>
                    {isEditing ? (
                      (() => {
                        const count = (localSlides[fullscreenIndex - 1]?.bullet_points || []).length;
                        const fs = count <= 3 ? '3.5vh' : count <= 5 ? '2.8vh' : '2.4vh';
                        const lh = count <= 3 ? '1.6' : '1.45';
                        return (
                          <textarea
                            value={(localSlides[fullscreenIndex - 1]?.bullet_points || []).join('\n')}
                            onChange={(e) => {
                              const updated = [...localSlides];
                              updated[fullscreenIndex - 1].bullet_points = e.target.value.split('\n').filter(Boolean);
                              setLocalSlides(updated);
                            }}
                            style={{ fontSize: fs, lineHeight: lh, margin: 0, width: '100%', height: '100%', border: '1px dashed #999', background: 'transparent', fontFamily: 'Arial, sans-serif', color: '#333333', resize: 'none' }}
                          />
                        );
                      })()
                    ) : (
                      (() => {
                        const count = (localSlides[fullscreenIndex - 1]?.bullet_points || []).length;
                        const fs = count <= 3 ? '3.5vh' : count <= 5 ? '2.8vh' : '2.4vh';
                        const lh = count <= 3 ? '1.6' : '1.45';
                        const gap = count <= 3 ? '3vh' : count <= 5 ? '2vh' : '1.4vh';
                        return (
                          <ul style={{ fontSize: fs, lineHeight: lh, margin: 0, paddingLeft: '2.5vh', display: 'flex', flexDirection: 'column', gap: gap, color: '#333333' }}>
                            {(localSlides[fullscreenIndex - 1]?.bullet_points || []).map((bp: string, j: number) => (
                              <li key={j}>{bp}</li>
                            ))}
                          </ul>
                        );
                      })()
                    )}
                  </div>
                </>
              )}
            </div>

            {fullscreenIndex <= localSlides.length && (
              <button onClick={() => setFullscreenIndex(fullscreenIndex + 1)} style={{ position: 'absolute', right: '20px', background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '20px', cursor: 'pointer', borderRadius: '8px', zIndex: 10 }}>▶</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
