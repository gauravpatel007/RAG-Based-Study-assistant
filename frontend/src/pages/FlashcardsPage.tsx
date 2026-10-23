import { useEffect, useState } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Layers, ChevronLeft, ChevronRight, Trash2, Check, FileText, X } from 'lucide-react';
import { api } from '@/lib/api';
import { formatDocName } from '@/lib/formatters';
import { CircleBuffer } from '@/components/CircleBuffer';

type Flashcard = Awaited<ReturnType<typeof api.getChatFlashcards>>[number];
type Doc = Awaited<ReturnType<typeof api.getChatDocuments>>['items'][number];

function formatDate(isoString: string) {
  const date = new Date(isoString);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return 'Today';
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function FlashcardsPage() {
  const { chatId } = useParams<{ chatId: string }>();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const topicFilter = searchParams.get('topic');
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [documents, setDocuments] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [viewMode, setViewMode] = useState<'dashboard' | 'review'>('dashboard');
  const [activeFilter, setActiveFilter] = useState<'all' | 'due' | 'new' | 'learning' | 'mastered' | 'difficult'>('all');

  // Generation state
  const [genCount, setGenCount] = useState(10);
  const [topicInput, setTopicInput] = useState(topicFilter || '');
  const [generating, setGenerating] = useState(false);
  const [generatingJobId, setGeneratingJobId] = useState<string | null>(null);
  const [jobProgress, setJobProgress] = useState<Record<string, any> | null>(null);
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);

  // Review state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [toast, setToast] = useState('');

  // User review stats loaded from database
  const [stats, setStats] = useState<{
    reviewed_today: number;
    recent_accuracy: number | null;
    total_reviews: number;
  }>({ reviewed_today: 0, recent_accuracy: null, total_reviews: 0 });

  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const dueCards = flashcards.filter(c => new Date(c.next_review_at) <= now);
  const newCards = flashcards.filter(c => c.review_count === 0);
  const masteredCards = flashcards.filter(c => c.repetitions >= 3 || (c.difficulty === 'easy' && c.repetitions >= 2));
  const learningCards = flashcards.filter(c => c.review_count > 0 && !(c.repetitions >= 3 || (c.difficulty === 'easy' && c.repetitions >= 2)) && c.difficulty !== 'hard');
  const dueTomorrow = flashcards.filter(c => {
    const d = new Date(c.next_review_at);
    return d > now && d.toDateString() === tomorrow.toDateString();
  });

  const accuracy = stats.recent_accuracy !== null ? `${stats.recent_accuracy}%` : '--';

  const loadData = () => {
    if (!chatId) return;
    setLoading(true);
    
    // Check for active generate_flashcards job
    api.getChatJobs(chatId).then(jobs => {
      const activeJob = jobs.items.find(j => j.type === 'generate_flashcards' && ['pending', 'running'].includes(j.status));
      if (activeJob) {
        setGeneratingJobId(activeJob.id);
        setGenerating(true);
        setJobProgress(activeJob.progress);
      }
    }).catch(() => {});

    Promise.all([
      api.getChatFlashcards(chatId),
      api.getChatDocuments(chatId),
      api.getChatFlashcardStats(chatId).catch(() => ({ reviewed_today: 0, recent_accuracy: null, total_reviews: 0 }))
    ]).then(([cards, docs, cardStats]) => {
      setFlashcards(cards);
      setDocuments(docs.items.filter(d => d.status === 'ready'));
      setStats(cardStats);
    }).catch(e => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
  }, [chatId]);

  useEffect(() => {
    if (!generatingJobId) return;
    const i = setInterval(async () => {
      try {
        const job = await api.getJob(generatingJobId);
        setJobProgress(job.progress);
        if (job.status === 'complete') {
          setGeneratingJobId(null);
          setJobProgress(null);
          setGenerating(false);
          loadData();
          setToast('Flashcards generated successfully!');
          setTimeout(() => setToast(''), 3000);
        } else if (job.status === 'failed' || job.status === 'cancelled') {
          setGeneratingJobId(null);
          setJobProgress(null);
          setGenerating(false);
          setError(`Generation ${job.status}: ${job.error_code || 'Unknown error'}`);
        }
      } catch (e) {
        // ignore network error
      }
    }, 2000);
    return () => clearInterval(i);
  }, [generatingJobId]);

  const handleGenerate = async () => {
    if (!chatId) return;
    setGenerating(true);
    try {
      const selected = selectedDocs.length > 0 ? selectedDocs : documents.map(d => d.id);
      if (!selected.length) throw new Error("Upload and process at least one PDF document first.");
      const res = await api.generateFlashcards(chatId, selected, genCount, topicInput.trim() || undefined);
      setGeneratingJobId(res.job_id);
      setToast(`Generation job started. Check back soon!`);
      setTimeout(() => setToast(''), 3000);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setGenerating(false);
    }
  };

  const handleRating = async (rating: string) => {
    if (!chatId || !filteredCards[currentIndex]) return;

    const card = filteredCards[currentIndex];
    try {
      const res = await api.submitFlashcardReview(card.id, rating);

      setToast(`Scheduled again in ${res.new_interval} days.`);
      setTimeout(() => setToast(''), 3000);

      const isSuccess = ['good', 'easy'].includes(rating);
      setStats(prev => {
        const newTotal = prev.total_reviews + 1;
        const prevCorrect = prev.recent_accuracy !== null 
          ? Math.round((prev.recent_accuracy * Math.min(prev.total_reviews, 50)) / 100) 
          : 0;
        const newCount = Math.min(newTotal, 50);
        const newCorrectTotal = prevCorrect + (isSuccess ? 1 : 0);
        const newAccuracy = Math.round((newCorrectTotal / newCount) * 100);
        return {
          reviewed_today: prev.reviewed_today + 1,
          recent_accuracy: newAccuracy,
          total_reviews: newTotal
        };
      });

      setShowAnswer(false);

      const newDiff = rating === 'easy' ? 'easy' : (rating === 'good' ? (card.difficulty === 'easy' ? 'easy' : 'learning') : 'hard');
      const newReps = isSuccess ? card.repetitions + 1 : 0;
      const isMastered = newReps >= 3 || (newDiff === 'easy' && newReps >= 2);
      let dropsOut = false;
      if (activeFilter === 'due' && new Date(res.reviewed_at) > now) dropsOut = true;
      if (activeFilter === 'new') dropsOut = true;
      if (activeFilter === 'learning' && (isMastered || newDiff === 'hard')) dropsOut = true;
      if (activeFilter === 'mastered' && !isMastered) dropsOut = true;
      if (activeFilter === 'difficult' && newDiff !== 'hard' && newReps > 0) dropsOut = true;

      setFlashcards(prev => prev.map(c => {
        if (c.id === card.id) {
          return {
            ...c,
            review_count: c.review_count + 1,
            difficulty: newDiff,
            next_review_at: res.reviewed_at,
            repetitions: newReps
          };
        }
        return c;
      }));

      if (!dropsOut) {
        setCurrentIndex(prev => (prev + 1) % filteredCards.length);
      } else if (currentIndex >= filteredCards.length - 1 && filteredCards.length > 1) {
        setCurrentIndex(0);
      }
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleDelete = async (flashcardId: string) => {
    if (!confirm('Are you sure you want to delete this flashcard?')) return;
    try {
      await api.deleteFlashcard(flashcardId);
      setFlashcards(prev => prev.filter(c => c.id !== flashcardId));
      setToast('Flashcard removed.');
      setTimeout(() => setToast(''), 3000);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const filteredCards = flashcards.filter(c => {
    if (activeFilter === 'due') return new Date(c.next_review_at) <= now;
    if (activeFilter === 'new') return c.review_count === 0;
    if (activeFilter === 'learning') return c.review_count > 0 && !(c.repetitions >= 3 || (c.difficulty === 'easy' && c.repetitions >= 2)) && c.difficulty !== 'hard';
    if (activeFilter === 'mastered') return c.repetitions >= 3 || (c.difficulty === 'easy' && c.repetitions >= 2);
    if (activeFilter === 'difficult') return c.difficulty === 'hard' || (c.review_count > 0 && c.repetitions === 0);
    return true;
  });

  if (loading) return <CircleBuffer minHeight={240} size={36} />;
  if (error) return <div style={{ padding: 20 }} className="inline-error">{error}</div>;

  if (viewMode === 'dashboard') {
    return (
      <div className="topics-page-container animate-fade-in" style={{ width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
        <div className="page-header topics-header">
          <div>
            <h2 className="page-title">Study Progress</h2>
            <p className="page-subtitle">Master your concepts with spaced repetition.</p>
          </div>
          <button className="btn btn-primary extract-btn" onClick={handleGenerate} disabled={generating}>
            {generating ? <Layers size={16} className="animate-spin" /> : <Layers size={16} />}
            <span>{generating ? 'Generating...' : 'Generate Flashcards'}</span>
          </button>
        </div>

        {jobProgress && (
          <div style={{ margin: '0 0 24px 0', padding: 16, background: 'var(--bg-panel)', borderRadius: 12, border: '1px solid var(--border)' }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 14 }}>Generating Flashcards...</h3>
            <div style={{ background: 'var(--bg-surface)', height: 8, borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                background: 'var(--accent-blue)',
                height: '100%',
                width: jobProgress.total ? `${(jobProgress.chunks / jobProgress.total) * 100}%` : '0%',
                transition: 'width 0.3s ease'
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
              <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)' }}>
                {jobProgress.stage === 'preparing_model' ? 'Reading documents...' : `Generating pairs... (${jobProgress.chunks}/${jobProgress.total || 0})`}
              </p>
              {generatingJobId && (
                <button className="btn btn-sm btn-secondary" onClick={async () => {
                  try { await api.cancelJob(generatingJobId); } catch(e) { console.error(e); }
                }}>Stop Generation</button>
              )}
            </div>
          </div>
        )}

        <div className="topics-layout-split" style={{ width: '100%', maxWidth: '100%' }}>
          <div className="topics-sidebar">
            <div className="filter-bar topics-filter-bar">
              <div className="filter-group doc-filter">
                <span className="filter-label">Documents</span>
                <div className="custom-multi-select">
                  {documents.map(d => {
                    const isSelected = selectedDocs.includes(d.id);
                    return (
                      <label key={d.id} className={`select-option ${isSelected ? 'selected' : ''}`} title={d.original_filename}>
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) setSelectedDocs([...selectedDocs, d.id]);
                            else setSelectedDocs(selectedDocs.filter(id => id !== d.id));
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

              <div className="filter-group-row">
                <label className="filter-group">
                  <span className="filter-label">Card count</span>
                  <input aria-label="Card count" className="form-input" type="number" min={1} max={50} value={genCount} onChange={e => setGenCount(Number(e.target.value))} />
                </label>
              </div>

              <div style={{ marginTop: '16px' }}>
                <label className="filter-group">
                  <span className="filter-label">Topic / Keywords (Optional)</span>
                  <input 
                    aria-label="Topic or Keywords" 
                    className="form-input" 
                    type="text" 
                    placeholder="e.g. Memory Management, Variables" 
                    value={topicInput} 
                    onChange={e => setTopicInput(e.target.value)} 
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="topics-main-content quiz-content-card" style={{ minWidth: 0, boxSizing: 'border-box' }}>
            {toast && (
              <div style={{ position: 'fixed', top: 20, right: 20, background: 'var(--accent-blue)', color: 'white', padding: '12px 16px', borderRadius: 8, zIndex: 1000, display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
                <span>{toast}</span>
                <button onClick={() => setToast('')} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }} aria-label="Close">
                  <X size={16} />
                </button>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 16 }}>
              <div className="stat-box" style={{ background: 'var(--bg-panel)', padding: 20, borderRadius: 12, border: '1px solid var(--border)' }}>
                <h3 style={{ color: 'var(--text-muted)', fontSize: 14, margin: 0 }}>Review Today</h3>
                <p style={{ fontSize: 32, fontWeight: 700, margin: '8px 0 0', color: 'var(--accent-blue)' }}>{dueCards.length}</p>
              </div>
              <div className="stat-box" style={{ background: 'var(--bg-panel)', padding: 20, borderRadius: 12, border: '1px solid var(--border)' }}>
                <h3 style={{ color: 'var(--text-muted)', fontSize: 14, margin: 0 }}>Learning</h3>
                <p style={{ fontSize: 32, fontWeight: 700, margin: '8px 0 0' }}>{learningCards.length}</p>
              </div>
              <div className="stat-box" style={{ background: 'var(--bg-panel)', padding: 20, borderRadius: 12, border: '1px solid var(--border)' }}>
                <h3 style={{ color: 'var(--text-muted)', fontSize: 14, margin: 0 }}>Mastered</h3>
                <p style={{ fontSize: 32, fontWeight: 700, margin: '8px 0 0', color: 'var(--accent-green, #10b981)' }}>{masteredCards.length}</p>
              </div>
              <div className="stat-box" style={{ background: 'var(--bg-panel)', padding: 20, borderRadius: 12, border: '1px solid var(--border)' }}>
                <h3 style={{ color: 'var(--text-muted)', fontSize: 14, margin: 0 }}>Recent Accuracy</h3>
                <p style={{ fontSize: 32, fontWeight: 700, margin: '8px 0 0' }}>{accuracy}</p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 16, marginBottom: 32, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>Cards Reviewed Today: <strong>{stats.reviewed_today}</strong></div>
              <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>Due Tomorrow: <strong>{dueTomorrow.length}</strong></div>
              <div style={{ fontSize: 14, color: 'var(--text-muted)' }}>New Cards: <strong>{newCards.length}</strong></div>
            </div>

            <div style={{ textAlign: 'center', marginBottom: 40 }}>
              <button
                className="btn btn-primary"
                style={{ padding: '12px 32px', fontSize: 16, borderRadius: 24 }}
                disabled={filteredCards.length === 0}
                onClick={() => {
                  setCurrentIndex(0);
                  setViewMode('review');
                }}
              >
                {filteredCards.length > 0 ? `Review ${activeFilter.charAt(0).toUpperCase() + activeFilter.slice(1)} Cards` : 'No Cards Found'}
              </button>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 8, flexWrap: 'wrap', gap: 12 }}>
              <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>Card Schedule</h2>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {(['all', 'due', 'new', 'learning', 'mastered', 'difficult'] as const).map(tab => (
                  <button
                    key={tab}
                    className={`btn ${activeFilter === tab ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ padding: '4px 10px', fontSize: 12, borderRadius: 16, whiteSpace: 'nowrap' }}
                    onClick={() => setActiveFilter(tab)}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1).replace('-', ' ')}
                  </button>
                ))}
              </div>
            </div>

            {filteredCards.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>No flashcards found in this category.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {filteredCards.map((card, idx) => {
                  const isDue = new Date(card.next_review_at) <= now;
                  return (
                    <div key={card.id} className="flashcard-list-item" style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: 16, background: 'var(--bg-panel)', borderRadius: 8, border: '1px solid var(--border)',
                      cursor: 'pointer', minWidth: 0, width: '100%', boxSizing: 'border-box'
                    }} onClick={() => {
                      setCurrentIndex(idx);
                      setViewMode('review');
                    }}>
                      <div style={{ flex: 1, minWidth: 0, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginRight: 12 }}>
                        {card.question}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                        <div style={{
                          fontSize: 12, fontWeight: 600,
                          color: isDue ? 'var(--accent-orange, #f59e0b)' : 'var(--text-muted)',
                          background: isDue ? 'rgba(245, 158, 11, 0.1)' : 'var(--bg-hover)',
                          padding: '4px 12px', borderRadius: 12,
                          whiteSpace: 'nowrap'
                        }}>
                          {isDue ? 'Due Today' : `Next Review: ${formatDate(card.next_review_at)}`}
                        </div>
                        <button
                          className="btn"
                          style={{ padding: 6, color: 'var(--text-muted)' }}
                          title="Delete Flashcard"
                          onClick={() => handleDelete(card.id)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // REVIEW MODE
  if (filteredCards.length === 0 || currentIndex >= filteredCards.length) {
    return (
      <div className="empty-state" style={{ padding: 40, textAlign: 'center' }}>
        <h2 className="empty-state-title">All Done!</h2>
        <p className="empty-state-sub">You have reviewed all available flashcards in this category.</p>
        <button className="btn" style={{ marginTop: 24 }} onClick={() => setViewMode('dashboard')}>Back to Dashboard</button>
      </div>
    );
  }

  const card = filteredCards[currentIndex];

  return (
    <div className="flashcards-review-container" style={{
      display: 'flex', flexDirection: 'column',
      padding: '16px 0 32px', width: '100%', maxWidth: '100%', boxSizing: 'border-box', overflowX: 'hidden'
    }}>
      <div style={{ marginBottom: 20 }}>
        <button className="btn" onClick={() => setViewMode('dashboard')}>&larr; Exit Review</button>
      </div>

      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 20, background: 'var(--accent-blue)', color: 'white', padding: '12px 16px', borderRadius: 8, zIndex: 1000, display: 'flex', alignItems: 'center', gap: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
          <span>{toast}</span>
          <button onClick={() => setToast('')} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' }} aria-label="Close">
            <X size={16} />
          </button>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'stretch', gap: 16, flex: 1, width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}>
        <button
          className="btn btn-secondary"
          onClick={() => { setCurrentIndex(prev => (prev === 0 ? filteredCards.length - 1 : prev - 1)); setShowAnswer(false); }}
          style={{ padding: '0 16px', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', flexShrink: 0 }}
        >
          <ChevronLeft size={28} />
        </button>

        <div className="card" style={{
          background: 'var(--bg-panel)', padding: '36px 32px', borderRadius: 24,
          border: '1px solid var(--border)', boxShadow: '0 12px 40px rgba(0,0,0,0.08)',
          display: 'flex', flexDirection: 'column', gap: 24, flex: 1, minWidth: 0, maxWidth: '100%', boxSizing: 'border-box', overflowX: 'hidden'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>
              Card {currentIndex + 1} of {filteredCards.length}
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
              <button
                className="btn"
                style={{ padding: 6, color: 'var(--text-muted)' }}
                title="Delete Flashcard"
                onClick={() => handleDelete(card.id)}
              >
                <Trash2 size={16} />
              </button>
              <span style={{ background: 'var(--bg-hover)', padding: '4px 8px', borderRadius: 16, fontSize: 12, fontWeight: 500 }}>
                {card.difficulty.toUpperCase()}
              </span>
            </div>
          </div>

          <div className="question-section" style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)', overflowWrap: 'break-word', wordBreak: 'break-word', minWidth: 0 }}>
            <Markdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{card.question}</Markdown>
          </div>

          {!showAnswer ? (
            <button className="btn btn-primary" style={{ alignSelf: 'center', marginTop: 20, padding: '12px 24px', fontSize: 16 }} onClick={() => setShowAnswer(true)}>
              Show Answer
            </button>
          ) : (
            <>
              <div style={{ borderTop: '1px solid var(--border)', margin: '16px 0' }} />
              <div className="answer-section markdown-body" style={{ fontSize: 16, color: 'var(--text-secondary)', overflowWrap: 'break-word', wordBreak: 'break-word', minWidth: 0 }}>
                <Markdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{card.answer}</Markdown>
              </div>

              <div className="rating-container" style={{ marginTop: 24, textAlign: 'center' }}>
                <p style={{ marginBottom: 16, color: 'var(--text-muted)', fontWeight: 500 }}>How well did you remember this?</p>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                  <button className="btn" style={{ background: '#fef2f2', color: '#dc2626', borderColor: '#fca5a5' }} onClick={() => handleRating('again')}>Again</button>
                  <button className="btn" style={{ background: '#fffbeb', color: '#d97706', borderColor: '#fcd34d' }} onClick={() => handleRating('hard')}>Hard</button>
                  <button className="btn" style={{ background: '#f0fdf4', color: '#16a34a', borderColor: '#86efac' }} onClick={() => handleRating('good')}>Good</button>
                  <button className="btn" style={{ background: '#eff6ff', color: '#2563eb', borderColor: '#93c5fd' }} onClick={() => handleRating('easy')}>Easy</button>
                </div>
              </div>
            </>
          )}
        </div>

        <button
          className="btn btn-secondary"
          onClick={() => { setCurrentIndex(prev => (prev + 1) % filteredCards.length); setShowAnswer(false); }}
          style={{ padding: '0 16px', borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s', flexShrink: 0 }}
        >
          <ChevronRight size={28} />
        </button>
      </div>
    </div>
  );
}
