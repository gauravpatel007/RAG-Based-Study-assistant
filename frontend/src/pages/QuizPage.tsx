import { useEffect, useState } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { HelpCircle, FileText, Check, Loader2, PlayCircle } from 'lucide-react';
import { api } from '@/lib/api';
import { formatDocName } from '@/lib/formatters';
import PdfSource, { type Source } from '@/components/PdfSource';
import { CircleBuffer } from '@/components/CircleBuffer';

type QuizSet = Awaited<ReturnType<typeof api.getChatQuizSets>>['items'][number];
type Doc = Awaited<ReturnType<typeof api.getChatDocuments>>['items'][number];

export default function QuizPage() {
  const { chatId } = useParams<{ chatId: string }>();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const topicFilter = searchParams.get('topic');
  const [sets, setSets] = useState<QuizSet[]>([]);
  const [documents, setDocuments] = useState<Doc[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [count, setCount] = useState(10);
  const [difficulty, setDifficulty] = useState('medium');
  const [start, setStart] = useState('');
  const [finish, setFinish] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [source, setSource] = useState<Source | null>(null);
  const [activeSetId, setActiveSetId] = useState<string | null>(null);
  const [clock, setClock] = useState(() => Date.now());
  const [cancelling, setCancelling] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submittedQuiz, setSubmittedQuiz] = useState(false);

  const latest = sets.find(item => item.id === activeSetId) ?? sets[0];
  const busy = latest && ['pending', 'running', 'processing'].includes(latest.status);

  useEffect(() => {
    if (!chatId) return;
    let stopped = false;
    setLoading(true); setSelected([]); setSets([]); setActiveSetId(null); setError(''); setAnswers({}); setSubmittedQuiz(false);
    Promise.all([api.getChatQuizSets(chatId), api.getChatDocuments(chatId)]).then(([quizSets, docs]) => {
      if (!stopped) { setSets(quizSets.items); setDocuments(docs.items.filter(d => d.status === 'ready')); }
    }).catch(e => { if (!stopped) setError(e.message); }).finally(() => { if (!stopped) setLoading(false); });
    return () => { stopped = true; };
  }, [chatId]);

  useEffect(() => {
    if (!busy || !chatId) return;
    let stopped = false;
    const timer = setInterval(() => { api.getChatQuizSets(chatId).then(r => { if (!stopped) setSets(r.items); }).catch(e => { if (!stopped) setError(e.message); }); }, 1000);
    return () => { stopped = true; clearInterval(timer); };
  }, [busy, chatId]);

  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [busy]);

  useEffect(() => {
    // Reset answers when the active set changes or new set completes
    if (latest && latest.status === 'complete' && Object.keys(answers).length === 0 && !submittedQuiz) {
      setAnswers({});
      setSubmittedQuiz(false);
    }
  }, [latest?.id, latest?.status]);

  async function generate() {
    if (!chatId) return;
    setSubmitting(true); setError(''); setAnswers({}); setSubmittedQuiz(false);
    try {
      if (!documents.length) throw new Error('Upload a PDF and wait until it is ready first.');
      if ((start || finish) && (!start || !finish || Number(start) > Number(finish))) throw new Error('Enter a valid start and end page.');
      const result = await api.createQuizSet(chatId!, selected.length ? selected : documents.map(d => d.id), count, difficulty,
        start && finish ? { start: Number(start), end: Number(finish) } : undefined, topicFilter || undefined);
      setActiveSetId(result.quiz_set_id);
      setSets((await api.getChatQuizSets(chatId)).items);
    } catch (e) { setError((e as Error).message || 'Quiz generation failed.'); }
    finally { setSubmitting(false); }
  }

  function submitQuiz() {
    if (Object.keys(answers).length < (latest?.questions.length || 0)) {
      if (!window.confirm("You haven't answered all questions. Submit anyway?")) {
        return;
      }
    }
    setSubmittedQuiz(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (loading) return <CircleBuffer minHeight={240} size={36} />;
  const coverage = latest?.covered_pages as { processed?: number; total?: number } | undefined;
  const elapsed = Math.max(0, Math.floor((clock - Date.parse(latest?.created_at ?? '')) / 1000)) || 0;
  const waiting = latest?.job_status === 'pending';
  const stage = latest?.progress?.stage;
  const stalled = latest?.heartbeat_at && clock - Date.parse(latest.heartbeat_at) > 120_000;

  let score = 0;
  if (submittedQuiz && latest?.questions) {
    latest.questions.forEach(q => {
      if (answers[q.id] === q.correct_option) score++;
    });
  }

  return (
    <div className="topics-page-container animate-fade-in">
      <div className="page-header topics-header">
        <div>
          <h2 className="page-title">Study Quiz</h2>
          <p className="page-subtitle">Test your knowledge with auto-generated questions from your PDFs.</p>
        </div>
        <button id="generate-quiz-btn" className="btn btn-primary extract-btn" disabled={submitting || !!busy} onClick={() => void generate()}>
          {submitting || busy ? <Loader2 size={16} className="animate-spin" /> : <PlayCircle size={16} />} 
          <span>{busy ? 'Generating...' : 'Generate Quiz'}</span>
        </button>
      </div>

      <div className="topics-layout-split">
        <div className="topics-sidebar">
          <div className="filter-bar topics-filter-bar">
            <div className="filter-group doc-filter">
              <span className="filter-label">Documents</span>
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
            
            <div className="filter-group-row">
              <label className="filter-group">
                <span className="filter-label">Question count</span>
                <input aria-label="Question count" className="form-input" type="number" min={1} max={50} value={count} onChange={e => setCount(Number(e.target.value))} />
              </label>
              <label className="filter-group">
                <span className="filter-label">Difficulty</span>
                <select className="form-input" value={difficulty} onChange={e => setDifficulty(e.target.value)}>
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </label>
            </div>
            <div className="filter-group-row-half" style={{ marginTop: '12px', display: 'flex', gap: '12px' }}>
              <label className="filter-group" style={{ flex: 1 }}>
                <span className="filter-label">From page</span>
                <input aria-label="From PDF page" className="form-input" type="number" min={1} placeholder="All" value={start} onChange={e => setStart(e.target.value)} />
              </label>
              <label className="filter-group" style={{ flex: 1 }}>
                <span className="filter-label">To page</span>
                <input aria-label="To PDF page" className="form-input" type="number" min={1} placeholder="All" value={finish} onChange={e => setFinish(e.target.value)} />
              </label>
            </div>
            
            {topicFilter && (
              <div className="alert-box info" style={{ marginTop: '16px', display: 'flex', alignItems: 'center' }}>
                <Check size={16} style={{ marginRight: 8 }} />
                <span>Generating questions exclusively for topic: <strong>{topicFilter}</strong></span>
              </div>
            )}
          </div>
        </div>

        <div className="topics-main-content quiz-content-card">
          {error && <div className="alert-box error animate-slide-up"><p>{error}</p></div>}
          
          {busy && (
            <div className="topics-loading-state animate-fade-in">
              <div className="spinner-ring"><Loader2 size={40} className="animate-spin text-accent" /></div>
              <h3>{waiting ? 'Waiting for the local AI worker...' : stage === 'generating_quiz' ? 'Writing quiz questions...' : 'Preparing the local AI model...'}</h3>
              <p className="text-muted" role="status">Using saved PDF text · {coverage?.total ?? 'Selected'} pages in scope · {elapsed}s elapsed
                {!!latest?.progress?.generated_chars && ` · ${latest.progress.generated_chars} characters generated`}</p>
              {(stalled || (waiting && elapsed > 30)) && <p className="text-muted">The worker may be busy or offline. Check the AI Worker service if this continues.</p>}
              <div className="progress-bar-container" role="progressbar" aria-label="Quiz generation" aria-valuemin={0} aria-valuemax={coverage?.total || 1} aria-valuenow={coverage?.processed ?? 0}>
                <div className="progress-bar-fill" style={{ width: `${coverage?.total ? ((coverage.processed ?? 0) / coverage.total) * 100 : 0}%` }}></div>
              </div>
              {latest?.job_id && (
                <button className="btn btn-secondary cancel-job-btn" disabled={cancelling} onClick={async () => {
                  setCancelling(true);
                  try { await api.cancelJob(latest.job_id!); setSets((await api.getChatQuizSets(chatId!)).items); }
                  catch (e) { setError((e as Error).message); }
                  finally { setCancelling(false); }
                }}>{cancelling ? 'Stopping...' : 'Stop generation'}</button>
              )}
            </div>
          )}

          {latest && ['failed', 'cancelled', 'stale'].includes(latest.status) && (
            <div className="alert-box warning animate-slide-up" style={{ marginBottom: 20 }}>
              <p>This quiz is <strong>{latest.status}</strong>. Run generation again for current results.</p>
              {latest.error_code && <p>{latest.error_code}</p>}
            </div>
          )}

          {!busy && latest?.status === 'complete' && (
            <div className="quiz-container">
              {submittedQuiz && (
                <div className="quiz-results-banner animate-slide-up" style={{
                  padding: '20px', borderRadius: '12px', marginBottom: '24px',
                  backgroundColor: score / latest.questions.length > 0.7 ? '#e6f7ee' : '#fff4e5',
                  border: `1px solid ${score / latest.questions.length > 0.7 ? '#00b259' : '#ff9800'}`
                }}>
                  <h3 style={{ margin: '0 0 8px 0' }}>Quiz Complete!</h3>
                  <p style={{ margin: 0, fontSize: '18px' }}>
                    You scored <strong>{score}</strong> out of <strong>{latest.questions.length}</strong> ({(score / latest.questions.length * 100).toFixed(0)}%)
                  </p>
                </div>
              )}

              {latest.completed_at && !submittedQuiz && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
                  <span className="badge" style={{ backgroundColor: '#e6f7ee', color: '#00b259' }}>
                    Processed in {Math.max(0, Math.floor((Date.parse(latest.completed_at) - Date.parse(latest.created_at)) / 1000))}s
                  </span>
                </div>
              )}

              {latest.questions.length === 0 && <p>No questions could be generated from the selected pages. Try a wider page range.</p>}
              
              <div className="quiz-questions">
                {latest.questions.map((q, index) => {
                  const answered = answers[q.id];
                  const isCorrect = answered === q.correct_option;
                  
                  return (
                    <div className="quiz-question-card animate-slide-up" key={q.id} style={{ animationDelay: `${index * 40}ms`, marginBottom: '24px', padding: '24px', backgroundColor: 'var(--bg-canvas)', borderRadius: '12px', border: '1px solid var(--border-default)' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                        <div style={{
                          backgroundColor: 'var(--bg-active)', color: 'var(--text-primary)', width: '32px', height: '32px', 
                          borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', flexShrink: 0
                        }}>
                          {index + 1}
                        </div>
                        <div style={{ flex: 1 }}>
                          <h4 style={{ margin: '0 0 16px 0', fontSize: '16px', lineHeight: '1.5' }}>{q.question}</h4>
                          <div className="quiz-options" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {['a', 'b', 'c', 'd'].map(opt => {
                              const optText = q[`option_${opt}` as keyof typeof q] as string;
                              
                              let optionClass = 'quiz-option';
                              const isSelected = opt === answered;
                              let optionStyle: React.CSSProperties = {
                                padding: '12px 16px', borderRadius: '8px',
                                border: isSelected && !submittedQuiz ? '2px solid var(--accent-blue)' : '1px solid transparent',
                                cursor: submittedQuiz ? 'default' : 'pointer',
                                display: 'flex', alignItems: 'center', gap: '12px', transition: 'all 0.2s',
                                backgroundColor: isSelected && !submittedQuiz ? 'var(--accent-blue-light)' : 'transparent',
                                outline: 'none'
                              };
                              
                              if (submittedQuiz) {
                                if (opt === q.correct_option) {
                                  optionStyle.backgroundColor = '#e6f7ee'; optionStyle.border = '2px solid #00b259'; optionStyle.color = '#006633';
                                } else if (opt === answered && opt !== q.correct_option) {
                                  optionStyle.backgroundColor = '#ffeeee'; optionStyle.border = '2px solid #ff3333'; optionStyle.color = '#990000';
                                } else {
                                  optionStyle.border = '1px solid transparent';
                                }
                              }
                              
                              return (
                                <label key={opt} style={optionStyle} className={optionClass}>
                                  <input 
                                    type="radio" 
                                    name={`q-${q.id}`} 
                                    value={opt}
                                    checked={answered === opt}
                                    onChange={(e) => {
                                      if (!submittedQuiz) {
                                        setAnswers({...answers, [q.id]: e.target.value});
                                      }
                                    }}
                                    disabled={submittedQuiz}
                                    style={{ margin: 0, accentColor: 'var(--accent-blue)', width: '16px', height: '16px' }}
                                  />
                                  <span><strong style={{textTransform: 'uppercase', marginRight: '8px'}}>{opt}.</strong> {optText}</span>
                                </label>
                              );
                            })}
                          </div>
                          
                          {submittedQuiz && (
                            <div className="quiz-explanation animate-fade-in" style={{ marginTop: '20px', padding: '16px', backgroundColor: 'var(--bg-canvas)', borderRadius: '8px', borderLeft: `4px solid ${isCorrect ? '#00b259' : '#ff9800'}` }}>
                              <p style={{ margin: '0 0 12px 0', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '500' }}>
                                {isCorrect ? <span style={{color: '#00b259'}}>Correct!</span> : <span style={{color: '#ff9800'}}>Incorrect (Correct answer: {q.correct_option.toUpperCase()})</span>}
                              </p>
                              <p style={{ margin: '0 0 16px 0', fontSize: '14px' }}>{q.explanation}</p>
                              
                              {(q.sources_json as any)?.sources?.length > 0 && (
                                <div>
                                  <div style={{ fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: 'bold' }}>Source Evidence</div>
                                  <div className="source-chips">
                                    {((q.sources_json as { sources?: Source[] })?.sources || []).map((s, i) => (
                                      <button key={i} className="source-chip interactive" title={s.original_filename} onClick={() => setSource(s)}>
                                        {formatDocName(s.original_filename, 20)} <span className="chip-page">p.{s.page_number}</span>
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {!submittedQuiz && latest.questions.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'center', marginTop: '32px', marginBottom: '64px' }}>
                  <button className="btn btn-primary" onClick={submitQuiz} style={{ padding: '12px 32px', fontSize: '16px' }}>
                    Submit Quiz
                  </button>
                </div>
              )}
            </div>
          )}

          {!latest && !busy && (
            <div className="empty-state topics-empty animate-fade-in">
              <div className="empty-icon-wrapper"><HelpCircle size={40} className="empty-icon" /></div>
              <h3>Generate a Study Quiz</h3>
              <p>Test your knowledge! Select your documents and a difficulty level, we'll use your saved PDF text to generate multiple-choice questions.</p>
              <button className="btn btn-primary" onClick={() => void generate()}>
                Generate your first quiz
              </button>
            </div>
          )}
        </div>
      </div>
      
      {source && (
        <PdfSource
          source={source}
          close={() => setSource(null)}
          singlePageOnly={true}
        />
      )}
    </div>
  );
}
