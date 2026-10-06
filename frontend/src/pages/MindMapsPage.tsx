import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Network, Loader2, FileText, Check } from 'lucide-react';
import { api } from '@/lib/api';
import { formatDocName } from '@/lib/formatters';
import ConceptMindMap from '@/components/ConceptMindMap';
import PdfSource, { type Source } from '@/components/PdfSource';
import { CircleBuffer } from '@/components/CircleBuffer';

type TopicSet = Awaited<ReturnType<typeof api.getChatTopicSets>>['items'][number];
type Doc = Awaited<ReturnType<typeof api.getChatDocuments>>['items'][number];

export default function MindMapsPage() {
  const { chatId } = useParams<{ chatId: string }>();
  const [sets, setSets] = useState<TopicSet[]>([]);
  const [documents, setDocuments] = useState<Doc[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [count, setCount] = useState(15);
  const [start, setStart] = useState('');
  const [finish, setFinish] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [topicFocus, setTopicFocus] = useState('');
  const [source, setSource] = useState<Source | null>(null);
  const [activeSetId, setActiveSetId] = useState<string | null>(null);
  const [clock, setClock] = useState(() => Date.now());
  const [cancelling, setCancelling] = useState(false);

  const latest = sets.find(item => item.id === activeSetId) ?? sets[0];
  const busy = latest && ['pending', 'running', 'processing'].includes(latest.status);

  useEffect(() => {
    if (!chatId) return;
    let stopped = false;
    setLoading(true); setSelected([]); setSets([]); setActiveSetId(null); setError('');
    Promise.all([api.getChatTopicSets(chatId), api.getChatDocuments(chatId)]).then(([topics, docs]) => {
      if (!stopped) { setSets(topics.items); setDocuments(docs.items.filter(d => d.status === 'ready')); }
    }).catch(e => { if (!stopped) setError(e.message); }).finally(() => { if (!stopped) setLoading(false); });
    return () => { stopped = true; };
  }, [chatId]);

  useEffect(() => {
    if (!busy || !chatId) return;
    let stopped = false;
    const timer = setInterval(() => { api.getChatTopicSets(chatId).then(r => { if (!stopped) setSets(r.items); }).catch(e => { if (!stopped) setError(e.message); }); }, 1000);
    return () => { stopped = true; clearInterval(timer); };
  }, [busy, chatId]);

  useEffect(() => {
    if (!busy) return;
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [busy]);

  async function extract() {
    if (!chatId) return;
    setSubmitting(true); setError('');
    try {
      if (!documents.length) throw new Error('Upload a PDF and wait until it is ready first.');
      if ((start || finish) && (!start || !finish || Number(start) > Number(finish))) throw new Error('Enter a valid start and end page.');
      const result = await api.createTopicSet(chatId, selected.length ? selected : documents.map(d => d.id), count,
        start && finish ? { start: Number(start), end: Number(finish) } : undefined,
        topicFocus || undefined
      );
      setActiveSetId(result.topic_set_id);
      setSets((await api.getChatTopicSets(chatId)).items);
    } catch (e) { setError((e as Error).message || 'Topic extraction failed.'); }
    finally { setSubmitting(false); }
  }

  if (loading) return <CircleBuffer minHeight={240} size={36} />;

  const coverage = latest?.covered_pages as { processed?: number; total?: number } | undefined;
  const elapsed = Math.max(0, Math.floor((clock - Date.parse(latest?.created_at ?? '')) / 1000)) || 0;
  const waiting = latest?.job_status === 'pending';
  const stage = latest?.progress?.stage;
  const stalled = latest?.heartbeat_at && clock - Date.parse(latest.heartbeat_at) > 120_000;

  return (
    <div className="topics-page-container animate-fade-in">
      <div className="page-header topics-header">
        <div>
          <h2 className="page-title">Mind Maps</h2>
          <p className="page-subtitle">Visual concept maps from your saved PDF text.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button id="extract-topics-btn" className="btn btn-primary extract-btn" disabled={submitting || !!busy} onClick={() => void extract()}>
            {submitting || busy ? <Loader2 size={16} className="animate-spin" /> : <Network size={16} />}
            <span>{busy ? 'Generating...' : 'Generate Mind Map'}</span>
          </button>
        </div>
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
                <span className="filter-label">Topic count</span>
                <input aria-label="Topic count" className="form-input" type="number" min={1} max={30} value={count} onChange={e => setCount(Number(e.target.value))} />
              </label>
              <div className="filter-group-row-half">
                <label className="filter-group">
                  <span className="filter-label">From page</span>
                  <input aria-label="From PDF page" className="form-input" type="number" min={1} placeholder="All" value={start} onChange={e => setStart(e.target.value)} />
                </label>
                <label className="filter-group">
                  <span className="filter-label">To page</span>
                  <input aria-label="To PDF page" className="form-input" type="number" min={1} placeholder="All" value={finish} onChange={e => setFinish(e.target.value)} />
                </label>
              </div>
            </div>

            <div className="filter-group">
              <span className="filter-label">Topic Focus (Optional)</span>
              <input aria-label="Topic Focus" className="form-input" type="text" placeholder="e.g. Transformer Architecture" value={topicFocus} onChange={e => setTopicFocus(e.target.value)} />
              <small className="filter-hint">Generate a topic set and mind map strictly for this topic.</small>
            </div>
          </div>
        </div>

        <div className="topics-main-content">
          {error && <div className="alert-box error animate-slide-up"><p>{error}</p></div>}

          {busy && (
            <div className="topics-loading-state animate-fade-in">
              <div className="spinner-ring"><Loader2 size={40} className="animate-spin text-accent" /></div>
              <h3>{waiting ? 'Waiting for the local AI worker...' : stage === 'generating_topics' ? 'Writing important topics...' : 'Preparing the local AI model...'}</h3>
              <p className="text-muted" role="status">Using saved PDF text · {coverage?.total ?? 'Selected'} pages in scope · {elapsed}s elapsed
                {!!latest?.progress?.generated_chars && ` · ${latest.progress.generated_chars} characters generated`}</p>
              {(stalled || (waiting && elapsed > 30)) && <p className="text-muted">The worker may be busy or offline. Check the AI Worker service if this continues.</p>}
              {!waiting && stage !== 'generating_topics' && <p className="text-muted">Reusing uploaded PDF text. The first request may take longer while the model loads.</p>}
              <div className="progress-bar-container" role="progressbar" aria-label="Topic generation" aria-valuemin={0} aria-valuemax={coverage?.total || 1} aria-valuenow={coverage?.processed ?? 0}>
                <div className="progress-bar-fill" style={{ width: `${coverage?.total ? ((coverage.processed ?? 0) / coverage.total) * 100 : 0}%` }}></div>
              </div>
              {latest?.job_id && (
                <button className="btn btn-secondary cancel-job-btn" disabled={cancelling} onClick={async () => {
                  setCancelling(true);
                  try { await api.cancelJob(latest.job_id!); }
                  catch (e) { setError((e as Error).message); }
                  finally { setCancelling(false); }
                }}>Cancel Generation</button>
              )}
            </div>
          )}

          {!busy && latest?.status === 'failed' && (
            <div className="alert-box warning animate-slide-up" style={{ marginBottom: 20 }}>
              <p>This topic set is <strong>{latest.status}</strong>. Run extraction again for current results.</p>
              {latest.error_code && <p>{latest.error_code}</p>}
            </div>
          )}

          {!busy && latest?.status === 'complete' && (
            <ConceptMindMap topicSet={latest} isGeneratingTopics={busy} />
          )}

          {!latest && !busy && (
            <div className="empty-state topics-empty animate-fade-in">
              <div className="empty-icon-wrapper"><Network size={40} className="empty-icon" /></div>
              <h3>No mind maps generated yet</h3>
              <p>Select your textbooks and generate a mind map to visualize concepts.</p>
            </div>
          )}
        </div>
      </div>

      {source && <PdfSource source={source} close={() => setSource(null)} singlePageOnly={true} />}
    </div>
  );
}
