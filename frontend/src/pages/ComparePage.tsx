import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '@/lib/api';
import { formatDocName } from '@/lib/formatters';
import { Loader2, FileText, Check, X } from 'lucide-react';
import Markdown from 'react-markdown';
import PdfSource from '@/components/PdfSource';

type DocItem = { id: string; original_filename: string; status: string };

export default function ComparePage() {
  const { chatId } = useParams<{ chatId: string }>();
  const [documents, setDocuments] = useState<DocItem[]>([]);
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [topic, setTopic] = useState('');
  const [topicHistory, setTopicHistory] = useState<string[]>(() => {
    try { return JSON.parse(sessionStorage.getItem('compareTopicHistory') || '[]'); } catch { return []; }
  });
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [comparisons, setComparisons] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [source, setSource] = useState<{ document_id: string; page_number: number; original_filename: string } | null>(null);

  useEffect(() => {
    if (!chatId) return;
    api.getChatDocuments(chatId).then(res => {
      const ready = res.items.filter(d => d.status === 'ready');
      setDocuments(ready);
      setSelectedDocs(prev => (prev.length === 0 && ready.length >= 2 ? [ready[0].id, ready[1].id] : prev));
    });
    api.getComparisons(chatId).then(res => {
      setComparisons(res.items);
      if (res.items.length > 0) {
        const latest = res.items[0];
        setTopic(prev => prev || latest.query);
        setSelectedDocs(prev => (prev.length === 0 ? latest.document_ids.map((id: any) => String(id)) : prev));
      }
    });
  }, [chatId]);

  useEffect(() => {
    let timer: any;
    if (loading) {
      timer = setInterval(() => setElapsed(prev => prev + 1), 1000);
    } else {
      setElapsed(0);
    }
    return () => clearInterval(timer);
  }, [loading]);

  const toggleDoc = (id: string) => {
    if (selectedDocs.includes(id)) {
      setSelectedDocs(selectedDocs.filter(d => d !== id));
      setError('');
    } else {
      if (selectedDocs.length >= 5) {
        setError('Please select up to 5 documents maximum.');
        return;
      }
      setError('');
      setSelectedDocs([...selectedDocs, id]);
    }
  };

  const handleCompare = async () => {
    if (!chatId) return;
    const docs = selectedDocs.filter(d => d.trim() !== '');
    if (docs.length < 2) {
      setError('Please select at least 2 documents.');
      return;
    }
    if (docs.length > 5) {
      setError('Please select up to 5 documents maximum.');
      return;
    }
    const uniqueDocs = new Set(docs);
    if (uniqueDocs.size !== docs.length) {
      setError('Cannot select the same document multiple times.');
      return;
    }
    if (!topic.trim()) {
      setError('Please enter a topic to compare.');
      return;
    }

    const trimmedTopic = topic.trim();
    setTopicHistory(prev => {
      const updated = [trimmedTopic, ...prev.filter(x => x !== trimmedTopic)].slice(0, 5);
      sessionStorage.setItem('compareTopicHistory', JSON.stringify(updated));
      return updated;
    });

    setError('');
    setLoading(true);
    try {
      const res = await api.createComparison(chatId, topic, docs);
      setComparisons([res, ...comparisons]);
    } catch (e) {
      setError((e as Error).message || 'Failed to compare sources.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="topics-page-container animate-fade-in">
      <div className="page-header topics-header">
        <div>
          <h2 className="page-title">Compare Sources</h2>
          <p className="page-subtitle">Compare how a specific topic is explained across documents.</p>
        </div>
        <button id="generate-compare-btn" className="btn btn-primary extract-btn" onClick={handleCompare} disabled={loading || selectedDocs.length < 2 || selectedDocs.length > 5 || !topic.trim()}>
          {loading ? <><Loader2 size={16} className="animate-spin" /> <span>Generating... ({elapsed}s)</span></> : <span>Compare Sources</span>}
        </button>
      </div>

      <div className="topics-layout-split">
        <div className="topics-sidebar card" style={{ alignSelf: 'flex-start' }}>
          <div className="filter-bar topics-filter-bar">
            {error && (
              <div role="alert" className="inline-error inline-error-banner" style={{ marginBottom: '16px' }}>
                <span>{error}</span>
                <button
                  type="button"
                  className="inline-error-close"
                  onClick={() => setError('')}
                  aria-label="Close notification"
                  title="Close notification"
                >
                  <X size={16} />
                </button>
              </div>
            )}
            
            <div className="filter-group doc-filter">
              <span className="filter-label">Documents (2-5)</span>
              <div className="custom-multi-select">
                {documents.map(d => {
                  const isSelected = selectedDocs.includes(d.id);
                  return (
                    <label key={d.id} className={`select-option ${isSelected ? 'selected' : ''}`} title={d.original_filename}>
                      <input 
                        type="checkbox" 
                        className="sr-only"
                        checked={isSelected}
                        onChange={() => toggleDoc(d.id)}
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
              <small className="filter-hint">Select between 2 and 5 documents to compare.</small>
            </div>

            <div className="filter-group" style={{ marginTop: '24px' }}>
              <span className="filter-label" style={{ display: 'block', marginBottom: '8px' }}>Topic to Compare</span>
              <input 
                type="text" 
                className="form-input" 
                value={topic} 
                onChange={e => setTopic(e.target.value)} 
                placeholder="e.g. Attention Mechanism" 
                style={{ width: '100%' }}
                onKeyDown={e => { if (e.key === 'Enter') handleCompare(); }}
                list="topic-history"
              />
              <datalist id="topic-history">
                {topicHistory.map(h => <option key={h} value={h} />)}
              </datalist>
            </div>
          </div>
        </div>

        <div className="topics-main-content quiz-content-card">
          {loading && (
            <div className="topics-loading-state animate-fade-in" style={{ padding: '40px', textAlign: 'center' }}>
              <div className="spinner-ring" style={{ margin: '0 auto 16px', display: 'flex', justifyContent: 'center' }}>
                <Loader2 size={40} className="animate-spin text-accent" />
              </div>
              <h3>Comparing sources...</h3>
              <p className="text-muted">Using saved PDF text · Analyzing similarities and differences...</p>
            </div>
          )}

          {!loading && comparisons.length > 0 && [comparisons[0]].map(comp => (
            <div key={comp.id} className="quiz-container animate-slide-up">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 0 24px 0', borderBottom: '1px solid var(--border-default)', paddingBottom: '12px' }}>
                <h3 style={{ margin: 0, fontSize: '1.25rem' }}>
                  {comp.query} — Source Comparison
                </h3>
                {comp.generated_comparison.processing_time_s !== undefined && (
                  <span className="badge" style={{ backgroundColor: '#e6f7ee', color: '#00b259' }}>
                    Processed in {comp.generated_comparison.processing_time_s}s
                  </span>
                )}
              </div>

              <div style={{ overflowX: 'auto', marginBottom: '24px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border)' }}>
                      <th style={{ padding: '8px' }}>Aspect</th>
                      {comp.generated_comparison.documents?.map((d: string) => <th key={d} style={{ padding: '8px' }}>{d}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {comp.generated_comparison.aspects?.map((aspect: any, idx: number) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '8px', fontWeight: 600, verticalAlign: 'top' }}>{aspect.aspect_name}</td>
                        {comp.generated_comparison.documents?.map((d: string) => (
                          <td key={d} style={{ padding: '8px', verticalAlign: 'top' }}>
                            <Markdown>{aspect.document_points?.[d] || 'Not found in this document.'}</Markdown>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {comp.generated_comparison.similarities?.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <h4 style={{ color: 'var(--primary)' }}>Major Similarities</h4>
                  <ul style={{ paddingLeft: '20px', margin: '8px 0' }}>
                    {comp.generated_comparison.similarities.map((sim: string, i: number) => (
                      <li key={i}><Markdown>{sim}</Markdown></li>
                    ))}
                  </ul>
                </div>
              )}

              {comp.generated_comparison.differences?.length > 0 && (
                <div style={{ marginBottom: '16px' }}>
                  <h4 style={{ color: 'var(--accent)' }}>Major Differences</h4>
                  <ul style={{ paddingLeft: '20px', margin: '8px 0' }}>
                    {comp.generated_comparison.differences.map((diff: string, i: number) => (
                      <li key={i}><Markdown>{diff}</Markdown></li>
                    ))}
                  </ul>
                </div>
              )}

              {comp.generated_comparison.unique_points && Object.keys(comp.generated_comparison.unique_points).length > 0 && (
                <div>
                  <h4 style={{ color: 'var(--text-muted)' }}>Unique Points</h4>
                  {Object.entries(comp.generated_comparison.unique_points).map(([docName, points]: [string, any]) => (
                    points && points.length > 0 && (
                      <div key={docName} style={{ marginTop: '8px' }}>
                        <strong>{docName}</strong>
                        <ul style={{ paddingLeft: '20px', margin: '4px 0' }}>
                          {(points as string[]).map((pt, i) => (
                            <li key={i}><Markdown>{pt}</Markdown></li>
                          ))}
                        </ul>
                      </div>
                    )
                  ))}
                </div>
              )}
            </div>
          ))}

          {!loading && comparisons.length === 0 && (
             <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <p>Select documents and enter a topic to generate a comparison.</p>
             </div>
          )}
        </div>
      </div>
      
      {source && <PdfSource source={source} close={() => setSource(null)} />}
    </div>
  );
}
