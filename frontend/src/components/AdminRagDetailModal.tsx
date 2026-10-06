import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { X, Clock, FileText, Database, User as UserIcon } from 'lucide-react';
import { CircleBuffer } from '@/components/CircleBuffer';
import ReactMarkdown from 'react-markdown';
import PdfSource from '@/components/PdfSource';
interface AdminRagDetailModalProps {
  logId: string;
  onClose: () => void;
}

export function AdminRagDetailModal({ logId, onClose }: AdminRagDetailModalProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [avatarError, setAvatarError] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState<{id: string, chat_id: string, filename: string} | null>(null);

  useEffect(() => {
    fetchDetail();
  }, [logId]);

  const fetchDetail = async () => {
    try {
      setLoading(true);
      const res = await api.getAdminRagQueryDetail(logId);
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch query details');
    } finally {
      setLoading(false);
    }
  };

  const formatMs = (ms: number) => {
    if (ms >= 1000) return (ms / 1000).toFixed(2) + 's';
    return Math.round(ms) + 'ms';
  };

  return (
    <>
      <div style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.5)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10000,
        padding: '24px'
      }} onClick={onClose}>
      <div style={{
        background: 'var(--bg-card)',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '800px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 24px 48px rgba(0,0,0,0.2)',
        border: '1px solid var(--border-default)',
        overflow: 'hidden'
      }} onClick={e => e.stopPropagation()}>
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border-default)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--bg-active)'
        }}>
          <h2 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>RAG Query Details</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <X size={24} />
          </button>
        </div>

        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '40px' }}><CircleBuffer size={40} /></div>
          ) : error ? (
            <div style={{ color: '#EF4444', textAlign: 'center', padding: '20px' }}>{error}</div>
          ) : data ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              
              {/* User Info & Meta */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ background: 'var(--bg-active)', padding: '16px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--primary-color)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
                    {avatarError ? <UserIcon size={20} /> : (
                      <img 
                        src={`/api/v1/admin/users/${data.user.id}/avatar`} 
                        alt={data.user.username} 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                        onError={() => setAvatarError(true)} 
                      />
                    )}
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>User</div>
                    <div style={{ fontWeight: '600' }}>{data.user.username}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{data.user.email}</div>
                  </div>
                </div>

                <div style={{ background: 'var(--bg-active)', padding: '16px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '40px', height: '40px', background: '#10B981', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', flexShrink: 0 }}>
                    <Clock size={20} />
                  </div>
                  <div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Time & Duration</div>
                    <div style={{ fontWeight: '600' }}>{new Date(data.created_at).toLocaleString()}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Total time: {formatMs(data.metrics.total_ms)}</div>
                  </div>
                </div>
              </div>

              {/* Documents Context */}
              <div>
                <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '8px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FileText size={16} /> Documents in Context ({data.documents.length})
                </h3>
                {data.documents.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {data.documents.map((doc: any, i: number) => (
                      <div 
                        key={i} 
                        onClick={() => setSelectedDoc({ id: doc.id, chat_id: doc.chat_id, filename: doc.filename })}
                        style={{ padding: '8px 12px', background: 'var(--bg-active)', borderRadius: '8px', fontSize: '13px', border: '1px solid var(--border-default)', cursor: 'pointer', transition: 'background 0.2s' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-active)'}
                      >
                        <span style={{ fontWeight: '500' }}>{doc.filename}</span>
                        <span style={{ color: 'var(--text-muted)', marginLeft: '8px' }}>({(doc.byte_size / 1024).toFixed(1)} KB)</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>No specific documents attached (general query).</div>
                )}
              </div>

              {/* Q & A */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ background: 'var(--bg-active)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-default)' }}>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase' }}>Question</div>
                  <div className="markdown-body" style={{ fontSize: '15px', lineHeight: '1.5', color: 'var(--text-primary)' }}>
                    <ReactMarkdown>{data.question || ''}</ReactMarkdown>
                  </div>
                </div>

                <div style={{ background: 'rgba(59, 130, 246, 0.05)', padding: '16px', borderRadius: '12px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                  <div style={{ fontSize: '12px', fontWeight: '600', color: '#3B82F6', marginBottom: '8px', textTransform: 'uppercase' }}>Answer</div>
                  <div className="markdown-body" style={{ fontSize: '15px', lineHeight: '1.5', color: 'var(--text-primary)' }}>
                    {data.answer ? <ReactMarkdown>{data.answer}</ReactMarkdown> : <span style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>No answer available</span>}
                  </div>
                </div>
              </div>

              {/* Advanced Metrics */}
              <div>
                <h3 style={{ fontSize: '14px', fontWeight: '600', marginBottom: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Database size={16} /> Retrieval & Pipeline Metrics
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                  <div style={{ background: 'var(--bg-active)', padding: '12px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Final Sources</div>
                    <div style={{ fontWeight: '600' }}>{data.metrics.sources}</div>
                  </div>
                  <div style={{ background: 'var(--bg-active)', padding: '12px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Semantic Results</div>
                    <div style={{ fontWeight: '600' }}>{data.metrics.semantic_results}</div>
                  </div>
                  <div style={{ background: 'var(--bg-active)', padding: '12px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>BM25 Results</div>
                    <div style={{ fontWeight: '600' }}>{data.metrics.bm25_results}</div>
                  </div>
                  <div style={{ background: 'var(--bg-active)', padding: '12px', borderRadius: '8px' }}>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>LLM Time</div>
                    <div style={{ fontWeight: '600' }}>{formatMs(data.metrics.llm_ms)}</div>
                  </div>
                </div>
              </div>
              
            </div>
          ) : null}
        </div>
      </div>
    </div>
    {selectedDoc && (
      <div 
        onClick={e => e.stopPropagation()}
        style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 11000, background: 'rgba(0,0,0,0.8)' }}
      >
        <PdfSource 
          source={{ document_id: selectedDoc.id, page_number: 1, original_filename: selectedDoc.filename }} 
          close={() => setSelectedDoc(null)} 
          isAdmin={true}
        />
      </div>
    )}
  </>
  );
}
