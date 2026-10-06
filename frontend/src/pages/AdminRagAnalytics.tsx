
import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthContext';
import { api } from '@/lib/api';
import { CircleBuffer } from '@/components/CircleBuffer';
import { Brain, Layers, Clock, Settings, Crosshair, Filter, X, Search, FileCheck, Database, Activity } from 'lucide-react';
import { AdminRagDetailModal } from '@/components/AdminRagDetailModal';

function formatDistanceToNowFallback(dateString: string) {
  const d = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - d.getTime()) / 1000);

  if (diffInSeconds < 60) return 'just now';
  if (diffInSeconds < 3600) return Math.floor(diffInSeconds / 60) + 'm ago';
  if (diffInSeconds < 86400) return Math.floor(diffInSeconds / 3600) + 'h ago';
  return Math.floor(diffInSeconds / 86400) + 'd ago';
}
interface RagQuery {
  id: string;
  username: string;
  preview: string;
  total_ms: number;
  sources: number;
  created_at: string;
}
interface RagAnalyticsData {
  total_queries: number;
  avg_docs_retrieved: number;
  semantic_success: number;
  bm25_success: number;
  avg_latency: number;
  pipeline: {
    embed_ms: number;
    vector_search_ms: number;
    bm25_ms: number;
    rrf_ms: number;
    rerank_ms: number;
    llm_ms: number;
    total_ms: number;
  };
  citations: {
    success_rate: number;
    repair_rate: number;
    no_context_rate: number;
    avg_sources: number;
    avg_context_chunks: number;
  };
  recent_queries: RagQuery[];
}
export default function AdminRagAnalytics() {
  const { user } = useAuth();
  const [data, setData] = useState<RagAnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedQueryId, setSelectedQueryId] = useState<string | null>(null);

  // Pagination & Filters state
  const [queries, setQueries] = useState<any[]>([]);
  const [queriesTotal, setQueriesTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [userSearch, setUserSearch] = useState('');
  const [keyword, setKeyword] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [loadingQueries, setLoadingQueries] = useState(false);
  const [isFilterModalOpen, setIsFilterModalOpen] = useState(false);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  useEffect(() => {
    fetchQueries();
  }, [page]);

  const fetchQueries = async () => {
    try {
      setLoadingQueries(true);
      const res = await api.getAdminRagQueries({
        page, limit: 10, user_search: userSearch, keyword, date_from: dateFrom, date_to: dateTo
      });
      setQueries(res.items);
      setQueriesTotal(res.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingQueries(false);
    }
  };

  const handleSearch = () => {
    if (page === 1) fetchQueries();
    else setPage(1);
    setIsFilterModalOpen(false);
  };

  const handleClearFilters = () => {
    setUserSearch('');
    setKeyword('');
    setDateFrom('');
    setDateTo('');
    // State updates are async, so we'll just trigger the fetch directly with empty params for instant reset
    api.getAdminRagQueries({ page: 1, limit: 10, user_search: '', keyword: '', date_from: '', date_to: '' })
       .then(res => {
         setQueries(res.items);
         setQueriesTotal(res.total);
         setPage(1);
         setIsFilterModalOpen(false);
       });
  };

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      const res = await api.getAdminRagAnalytics();
      setData(res);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to fetch RAG analytics.');
    } finally {
      setLoading(false);
    }
  };
  if (user?.username !== 'admin') {
    return <Navigate to="/app" replace />;
  }
  const formatMs = (ms: number) => {
    if (ms >= 1000) return (ms / 1000).toFixed(2) + 's';
    return Math.round(ms) + 'ms';
  };
  const renderProgressBar = (label: string, ms: number, total: number, color: string) => {
    const pct = total > 0 ? Math.min(100, Math.max(0.5, (ms / total) * 100)) : 0;
    return (
      <div style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', marginBottom: '4px' }}>
          <span style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{label}</span>
          <span style={{ color: 'var(--text-muted)' }}>{formatMs(ms)}</span>
        </div>
        <div style={{ width: '100%', background: 'var(--bg-active)', borderRadius: '9999px', height: '8px' }}>
          <div style={{ height: '8px', borderRadius: '9999px', background: color, width: `${pct}%` }}></div>
        </div>
      </div>
    );
  };
  if (loading && !data) {
    return <CircleBuffer minHeight="60vh" size={42} />;
  }
  return (
    <div style={{ flex: 1, width: '100%', boxSizing: 'border-box', paddingBottom: '40px' }}>
      <style>
        {`
          .kpi-card {
            transition: transform 0.2s, box-shadow 0.2s;
          }
          .kpi-card:hover {
            transform: translateY(-4px);
            box-shadow: 0 12px 24px rgba(0,0,0,0.1);
          }
          .query-row {
            transition: background-color 0.2s;
            cursor: pointer;
          }
          .query-row:hover {
            background-color: var(--bg-hover) !important;
          }
          .analytics-two-col {
            display: grid;
            grid-template-columns: minmax(320px, 1fr) minmax(420px, 1.3fr);
            gap: 24px;
            margin-bottom: 32px;
            align-items: stretch;
          }
          .kpi-quad-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 20px;
          }
          @media (max-width: 1024px) {
            .analytics-two-col {
              grid-template-columns: 1fr;
            }
          }
          @media (max-width: 640px) {
            .kpi-quad-grid {
              grid-template-columns: 1fr;
            }
          }
        `}
      </style>
      <div style={{ marginBottom: '32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '16px',
            background: 'rgba(14, 165, 233, 0.1)',
            color: '#0ea5e9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <Brain size={24} />
          </div>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: '700', margin: 0 }}>RAG Analytics</h1>
            <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>Examine retrieval performance and pipeline timing.</p>
          </div>
        </div>
        <div style={{ display: 'inline-flex', marginTop: '4px' }}>
          <button
            onClick={fetchAnalytics}
            style={{
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-default)',
              padding: '8px 16px',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s',
              boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
            }}
          >
            Refresh Data
          </button>
        </div>
      </div>
      {error && <div style={{ padding: '12px 16px', background: '#FEF2F2', color: '#EF4444', borderRadius: '8px', marginBottom: '24px' }}>{error}</div>}
      {data && (
        <>
          {/* KPIs Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '32px' }}>
            <div className="kpi-card" style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '14px', fontWeight: '600' }}>Total RAG Queries</span>
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3B82F6' }}>
                  <Brain size={20} />
                </div>
              </div>
              <span style={{ fontSize: '32px', fontWeight: '700', color: 'var(--text-primary)' }}>{data.total_queries.toLocaleString()}</span>
            </div>

            <div className="kpi-card" style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '14px', fontWeight: '600' }}>Avg Retrieved Docs</span>
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10B981' }}>
                  <Layers size={20} />
                </div>
              </div>
              <span style={{ fontSize: '32px', fontWeight: '700', color: 'var(--text-primary)' }}>{data.avg_docs_retrieved.toFixed(1)}</span>
            </div>
            <div className="kpi-card" style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '14px', fontWeight: '600' }}>Avg Pipeline Latency</span>
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F59E0B' }}>
                  <Clock size={20} />
                </div>
              </div>
              <span style={{ fontSize: '32px', fontWeight: '700', color: 'var(--text-primary)' }}>{formatMs(data.avg_latency)}</span>
            </div>
            <div className="kpi-card" style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '14px', fontWeight: '600' }}>Citation Success</span>
                <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(139, 92, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8B5CF6' }}>
                  <Crosshair size={20} />
                </div>
              </div>
              <span style={{ fontSize: '32px', fontWeight: '700', color: 'var(--text-primary)' }}>{data.citations.success_rate}%</span>
            </div>
          </div>
          {/* Middle Row: Avg Pipeline Timing on Left + 4 KPI Cards on Right */}
          {(() => {
            const llmMs = data.pipeline.llm_ms;
            const totalMs = data.pipeline.total_ms || 1;
            const dbMs = Math.max(0, totalMs - llmMs);
            const llmPercent = Math.min(100, Math.round((llmMs / totalMs) * 100));
            const dbPercent = 100 - llmPercent;

            return (
              <div className="analytics-two-col">
                {/* Pipeline Timing */}
                <div style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Settings size={20} style={{ color: 'var(--text-muted)' }} /> Avg Pipeline Timing
                    </h3>

                    <div>
                      {renderProgressBar('Embedding', data.pipeline.embed_ms, data.pipeline.total_ms, '#3B82F6')}
                      {renderProgressBar('Vector Search', data.pipeline.vector_search_ms, data.pipeline.total_ms, '#6366F1')}
                      {renderProgressBar('BM25 Search', data.pipeline.bm25_ms, data.pipeline.total_ms, '#A855F7')}
                      {renderProgressBar('RRF', data.pipeline.rrf_ms, data.pipeline.total_ms, '#EC4899')}
                      {renderProgressBar('Reranking', data.pipeline.rerank_ms, data.pipeline.total_ms, '#F97316')}
                      {renderProgressBar('LLM Generation', data.pipeline.llm_ms, data.pipeline.total_ms, '#10B981')}
                    </div>
                  </div>

                  <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border-default)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>Total Response Time</span>
                    <span style={{ fontWeight: '700', color: '#6366F1', fontSize: '18px' }}>{formatMs(data.pipeline.total_ms)}</span>
                  </div>
                </div>

                {/* 4 KPI Cards Grid (Matches upper KPI card design) */}
                <div className="kpi-quad-grid">
                  {/* KPI 1: Retrieval Overview */}
                  <div className="kpi-card" style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '14px', fontWeight: '600' }}>Retrieval Overview</span>
                        <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3B82F6' }}>
                          <Search size={20} />
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                        <span style={{ fontSize: '32px', fontWeight: '700', color: 'var(--text-primary)' }}>{data.semantic_success}%</span>
                        <span style={{ fontSize: '12px', fontWeight: '600', color: '#3B82F6', background: 'rgba(59, 130, 246, 0.1)', padding: '2px 8px', borderRadius: '6px' }}>
                          Semantic
                        </span>
                      </div>
                    </div>
                    <div style={{ marginTop: '16px', paddingTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-default)' }}>
                      <span>BM25 Keyword Match</span>
                      <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{data.bm25_success}%</span>
                    </div>
                  </div>

                  {/* KPI 2: Citation Statistics */}
                  <div className="kpi-card" style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '14px', fontWeight: '600' }}>Citation Statistics</span>
                        <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F59E0B' }}>
                          <FileCheck size={20} />
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                        <span style={{ fontSize: '32px', fontWeight: '700', color: data.citations.repair_rate > 0 ? '#F59E0B' : 'var(--text-primary)' }}>
                          {data.citations.repair_rate}%
                        </span>
                        <span style={{ fontSize: '12px', fontWeight: '600', color: '#F59E0B', background: 'rgba(245, 158, 11, 0.1)', padding: '2px 8px', borderRadius: '6px' }}>
                          Repaired
                        </span>
                      </div>
                    </div>
                    <div style={{ marginTop: '16px', paddingTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-default)' }}>
                      <span>No Relevant Source</span>
                      <span style={{ fontWeight: '600', color: data.citations.no_context_rate > 0 ? '#EF4444' : 'var(--text-primary)' }}>
                        {data.citations.no_context_rate}%
                      </span>
                    </div>
                  </div>

                  {/* KPI 3: Avg Context Payload */}
                  <div className="kpi-card" style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '14px', fontWeight: '600' }}>Avg Context Payload</span>
                        <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10B981' }}>
                          <Database size={20} />
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                        <span style={{ fontSize: '32px', fontWeight: '700', color: 'var(--text-primary)' }}>
                          {((data.citations.avg_context_chunks || 0) * 0.8).toFixed(1)}
                        </span>
                        <span style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-secondary)' }}>KB</span>
                        <span style={{ fontSize: '12px', fontWeight: '600', color: '#10B981', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 8px', borderRadius: '6px', marginLeft: 'auto' }}>
                          Est. Size
                        </span>
                      </div>
                    </div>
                    <div style={{ marginTop: '16px', paddingTop: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-default)' }}>
                      <span>Chunks Retrieved</span>
                      <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                        {(data.citations.avg_context_chunks || 0).toFixed(1)} chunks
                      </span>
                    </div>
                  </div>

                  {/* KPI 4: LLM vs Retrieval */}
                  <div className="kpi-card" style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '14px', fontWeight: '600' }}>LLM vs Retrieval</span>
                        <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(139, 92, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8B5CF6' }}>
                          <Activity size={20} />
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                        <span style={{ fontSize: '32px', fontWeight: '700', color: 'var(--text-primary)' }}>
                          {formatMs(llmMs)}
                        </span>
                        <span style={{ fontSize: '12px', fontWeight: '600', color: '#10B981', background: 'rgba(16, 185, 129, 0.1)', padding: '2px 8px', borderRadius: '6px' }}>
                          {llmPercent}% LLM
                        </span>
                      </div>
                    </div>
                    <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--border-default)' }}>
                      <div style={{ display: 'flex', height: '6px', borderRadius: '3px', overflow: 'hidden', background: 'var(--bg-hover)', gap: '2px', marginBottom: '6px' }}>
                        <div style={{ width: `${llmPercent}%`, background: '#10B981', borderRadius: '2px' }} title={`LLM Generation: ${formatMs(llmMs)} (${llmPercent}%)`} />
                        <div style={{ width: `${dbPercent}%`, background: '#3B82F6', borderRadius: '2px' }} title={`DB Retrieval: ${formatMs(dbMs)} (${dbPercent}%)`} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        <span>DB Retrieval: <strong style={{ color: 'var(--text-primary)' }}>{formatMs(dbMs)}</strong></span>
                        <span>{dbPercent}% DB</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
          {/* Recent Queries Table */}
          <div style={{ background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-default)', overflow: 'hidden' }}>
            <div style={{ padding: '24px', borderBottom: '1px solid var(--border-default)', display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '600', margin: 0 }}>Recent RAG Queries</h3>
                {(userSearch || keyword || dateFrom || dateTo) && (
                  <span style={{ fontSize: '12px', background: 'rgba(59, 130, 246, 0.1)', color: '#3B82F6', padding: '4px 8px', borderRadius: '4px', fontWeight: '500' }}>Filters Active</span>
                )}
              </div>
              
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                <button 
                  onClick={() => setIsFilterModalOpen(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', background: 'var(--bg-active)', color: 'var(--text-primary)', border: '1px solid var(--border-default)', borderRadius: '8px', fontWeight: '500', cursor: 'pointer', transition: 'background 0.2s' }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-active)'}
                >
                  <Filter size={16} /> Filters
                </button>
              </div>
            </div>
            <div style={{ overflowX: 'auto', position: 'relative', minHeight: '200px' }}>
              {loadingQueries && (
                 <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.1)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10 }}>
                   <CircleBuffer size={32} />
                 </div>
              )}
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                <thead style={{ background: 'var(--bg-active)', color: 'var(--text-muted)' }}>
                  <tr>
                    <th style={{ padding: '12px 24px', fontWeight: '500' }}>User</th>
                    <th style={{ padding: '12px 24px', fontWeight: '500' }}>Question</th>
                    <th style={{ padding: '12px 24px', fontWeight: '500' }}>Latency</th>
                    <th style={{ padding: '12px 24px', fontWeight: '500' }}>Sources Used</th>
                    <th style={{ padding: '12px 24px', fontWeight: '500', textAlign: 'right' }}>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {queries.map((q) => (
                    <tr key={q.id} className="query-row" onClick={() => setSelectedQueryId(q.id)} style={{ borderBottom: '1px solid var(--border-default)' }}>
                      <td style={{ padding: '16px 24px', fontWeight: '500', color: 'var(--text-primary)' }}>{q.username}</td>
                      <td style={{ padding: '16px 24px', color: 'var(--text-secondary)', maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{q.preview || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No question</span>}</td>
                      <td style={{ padding: '16px 24px' }}>
                        <span style={{ padding: '4px 8px', background: 'var(--bg-active)', borderRadius: '4px', color: 'var(--text-primary)', fontSize: '12px', fontWeight: '500' }}>{formatMs(q.total_ms)}</span>
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        <span style={{ padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: '500', background: q.sources > 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: q.sources > 0 ? '#10B981' : '#EF4444' }}>
                          {q.sources}
                        </span>
                      </td>
                      <td style={{ padding: '16px 24px', textAlign: 'right', color: 'var(--text-muted)' }}>{formatDistanceToNowFallback(q.created_at)}</td>
                    </tr>
                  ))}
                  {queries.length === 0 && !loadingQueries && (
                    <tr>
                      <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>No queries found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Pagination Controls */}
            <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-default)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
               <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
                 Showing {queries.length > 0 ? (page - 1) * 10 + 1 : 0} to {Math.min(page * 10, queriesTotal)} of {queriesTotal} entries
               </div>
               <div style={{ display: 'flex', gap: '8px' }}>
                 <button disabled={page === 1} onClick={() => setPage(p => p - 1)} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border-default)', background: page === 1 ? 'var(--bg-active)' : 'var(--bg-card)', color: page === 1 ? 'var(--text-muted)' : 'var(--text-primary)', cursor: page === 1 ? 'not-allowed' : 'pointer' }}>Prev</button>
                 <button disabled={page * 10 >= queriesTotal} onClick={() => setPage(p => p + 1)} style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border-default)', background: page * 10 >= queriesTotal ? 'var(--bg-active)' : 'var(--bg-card)', color: page * 10 >= queriesTotal ? 'var(--text-muted)' : 'var(--text-primary)', cursor: page * 10 >= queriesTotal ? 'not-allowed' : 'pointer' }}>Next</button>
               </div>
            </div>
          </div>
        </>
      )}
      {selectedQueryId && (
        <AdminRagDetailModal logId={selectedQueryId} onClose={() => setSelectedQueryId(null)} />
      )}
      
      {isFilterModalOpen && (
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
        }} onClick={() => setIsFilterModalOpen(false)}>
          <div style={{
            background: 'var(--bg-card)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '480px',
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
              <h2 style={{ fontSize: '18px', fontWeight: '600', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Filter size={20} /> Filter Queries
              </h2>
              <button onClick={() => setIsFilterModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={24} />
              </button>
            </div>
            
            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '8px' }}>User Search</label>
                <input 
                  type="text" 
                  placeholder="e.g. gaurav..." 
                  value={userSearch}
                  onChange={e => setUserSearch(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-default)', background: 'var(--bg-active)', color: 'var(--text-primary)', fontSize: '14px', boxSizing: 'border-box' }}
                />
              </div>
              
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '8px' }}>Keyword in Question</label>
                <input 
                  type="text" 
                  placeholder="e.g. matrix..." 
                  value={keyword}
                  onChange={e => setKeyword(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-default)', background: 'var(--bg-active)', color: 'var(--text-primary)', fontSize: '14px', boxSizing: 'border-box' }}
                />
              </div>
              
              <div style={{ display: 'flex', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '8px' }}>Date From</label>
                  <input 
                    type="date" 
                    value={dateFrom}
                    onChange={e => setDateFrom(e.target.value)}
                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-default)', background: 'var(--bg-active)', color: 'var(--text-primary)', fontSize: '14px', boxSizing: 'border-box' }}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', color: 'var(--text-secondary)', marginBottom: '8px' }}>Date To</label>
                  <input 
                    type="date" 
                    value={dateTo}
                    onChange={e => setDateTo(e.target.value)}
                    style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-default)', background: 'var(--bg-active)', color: 'var(--text-primary)', fontSize: '14px', boxSizing: 'border-box' }}
                  />
                </div>
              </div>
            </div>
            
            <div style={{ padding: '20px 24px', borderTop: '1px solid var(--border-default)', display: 'flex', justifyContent: 'flex-end', gap: '12px', background: 'var(--bg-card)' }}>
              <button 
                onClick={handleClearFilters}
                style={{ padding: '10px 16px', background: 'transparent', color: 'var(--text-primary)', border: '1px solid var(--border-default)', borderRadius: '8px', fontWeight: '600', cursor: 'pointer' }}
              >
                Clear
              </button>
              <button 
                onClick={handleSearch}
                style={{ padding: '10px 20px', background: '#3B82F6', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', transition: 'background 0.2s' }}
                onMouseEnter={e => e.currentTarget.style.background = '#2563EB'}
                onMouseLeave={e => e.currentTarget.style.background = '#3B82F6'}
              >
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
