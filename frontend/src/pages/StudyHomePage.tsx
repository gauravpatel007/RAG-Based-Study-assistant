import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  MessageSquare, FileText, BookOpen, Lightbulb,
  Plus, ArrowRight, Maximize2, X, Calendar
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { api } from '@/lib/api';
import { CircleBuffer } from '@/components/CircleBuffer';

interface DashboardData {
  total_chats: number;
  ready_documents: number;
  indexed_pages: number;
  saved_topics: number;
  recent_chats: Array<{ id: string; title: string; updated_at: string }>;
}

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

/**
 * Study Home – actual totals and recent chats.
 * Follows the reference dashboard card layout.
 */
export default function StudyHomePage() {
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const [timeRange, setTimeRange] = useState('7d');
  const [aiUsage, setAiUsage] = useState<any[]>([]);
  const [docAnalytics, setDocAnalytics] = useState<any[]>([]);
  const [storageData, setStorageData] = useState<any>(null);

  const [expandedChart, setExpandedChart] = useState<'ai' | 'docs' | 'storage' | null>(null);
  const [modalTimeRange, setModalTimeRange] = useState('7d');
  const [modalStartDate, setModalStartDate] = useState('');
  const [modalEndDate, setModalEndDate] = useState('');
  const [modalAiUsage, setModalAiUsage] = useState<any[]>([]);
  const [modalDocAnalytics, setModalDocAnalytics] = useState<any[]>([]);
  const [hoveredCardStorage, setHoveredCardStorage] = useState(false);
  const [hoveredModalStorage, setHoveredModalStorage] = useState(false);

  useEffect(() => {
    if (!expandedChart) return;
    const fetchModalData = async () => {
      try {
        const sd = modalStartDate ? new Date(modalStartDate).toISOString() : undefined;
        const ed = modalEndDate ? new Date(modalEndDate).toISOString() : undefined;
        if (expandedChart === 'ai') {
          const res = await api.getUserAiUsage((sd && ed) ? '' : modalTimeRange, sd, ed);
          setModalAiUsage([...res.time_series].reverse());
        } else if (expandedChart === 'docs') {
          const res = await api.getUserDocAnalytics((sd && ed) ? '' : modalTimeRange, sd, ed);
          setModalDocAnalytics([...res.time_series].reverse());
        }
      } catch (e) {
        console.error(e);
      }
    };
    fetchModalData();
  }, [expandedChart, modalTimeRange, modalStartDate, modalEndDate]);

  useEffect(() => {
    if (!expandedChart) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpandedChart(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [expandedChart]);

  useEffect(() => {
    if (!data) setLoading(true);
    Promise.all([
      api.dashboard(),
      api.getUserAiUsage(timeRange),
      api.getUserDocAnalytics(timeRange),
      api.getUserStorage()
    ])
      .then(([dash, usage, docs, storage]) => {
        setData(dash);
        // Time series data comes descending from the API, reverse to ascending for Recharts
        setAiUsage([...usage.time_series].reverse());
        setDocAnalytics([...docs.time_series].reverse());
        setStorageData(storage);
      })
      .catch(() => {
        // Backend not ready or error
        setData({
          total_chats: 0,
          ready_documents: 0,
          indexed_pages: 0,
          saved_topics: 0,
          recent_chats: [],
        });
      })
      .finally(() => setLoading(false));
  }, [timeRange]);

  const handleNewChat = async () => {
    try {
      const chat = await api.createChat();
      navigate(`/app/chats/${chat.id}`);
    } catch {
      navigate('/app/chats');
    }
  };

  const metrics = [
    { label: 'Total Chats', value: data?.total_chats ?? 0, icon: MessageSquare, color: 'var(--accent-blue)' },
    { label: 'Ready Documents', value: data?.ready_documents ?? 0, icon: FileText, color: 'var(--accent-green)' },
    { label: 'Indexed Pages', value: data?.indexed_pages ?? 0, icon: BookOpen, color: 'var(--accent-orange)' },
    { label: 'Saved Topics', value: data?.saved_topics ?? 0, icon: Lightbulb, color: 'var(--accent-purple)' },
  ];

  if (loading) {
    return <CircleBuffer minHeight="50vh" size={40} />;
  }

  const storageItems = storageData ? [
    { name: 'PDF Documents', value: storageData.pdf_bytes || 0, color: '#3B82F6' },
    { name: 'Vector Embeddings', value: storageData.vector_bytes || 0, color: '#8B5CF6' },
    { name: 'Chat History', value: storageData.chat_bytes || 0, color: '#10B981' },
    { name: 'Study Data', value: storageData.study_bytes || 0, color: '#F59E0B' },
  ] : [];

  const recordedBytes = storageItems.reduce((acc, d) => acc + d.value, 0);
  const totalStorageBytes = storageData
    ? (storageData.total_used_bytes != null ? storageData.total_used_bytes : recordedBytes)
    : 0;

  if (storageData && totalStorageBytes > recordedBytes) {
    storageItems.push({ name: 'Other', value: totalStorageBytes - recordedBytes, color: '#EC4899' });
  }

  const storagePieData = storageItems.filter(d => d.value > 0);

  return (
    <div className="animate-fade-in" style={{ flex: 1, width: '100%', boxSizing: 'border-box' }}>
      <style>{`
        .metric-card .hover-expand-btn { opacity: 0; transition: opacity 0.2s; }
        .metric-card:hover .hover-expand-btn { opacity: 1; }
        .chart-modal-dialog {
          animation: modalPopIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .storage-breakdown-row {
          transition: background 0.15s ease;
        }
        .storage-breakdown-row:hover {
          background: var(--bg-hover, #ebecef) !important;
        }
        @keyframes modalPopIn {
          from { opacity: 0; transform: scale(0.97) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        /* Remove black focus box/outline from all Recharts SVG elements and containers on click */
        .recharts-wrapper,
        .recharts-wrapper:focus,
        .recharts-wrapper:focus-visible,
        .recharts-surface,
        .recharts-surface:focus,
        .recharts-surface:focus-visible,
        .recharts-responsive-container,
        .recharts-responsive-container:focus,
        .recharts-responsive-container:focus-visible,
        .recharts-wrapper *:focus,
        .recharts-wrapper *:focus-visible,
        .recharts-surface *:focus,
        .recharts-surface *:focus-visible,
        .recharts-responsive-container *:focus,
        .recharts-responsive-container *:focus-visible,
        svg.recharts-surface,
        svg.recharts-surface:focus,
        svg.recharts-surface:focus-visible,
        svg:focus,
        svg:focus-visible,
        path:focus,
        path:focus-visible,
        rect:focus,
        rect:focus-visible,
        g:focus,
        g:focus-visible,
        .recharts-sector,
        .recharts-sector:focus,
        .recharts-sector:focus-visible,
        .recharts-pie-sector,
        .recharts-pie-sector:focus,
        .recharts-pie-sector:focus-visible,
        .recharts-bar-rectangle,
        .recharts-bar-rectangle:focus,
        .recharts-bar-rectangle:focus-visible,
        .recharts-bar-rectangles,
        .recharts-bar-rectangles:focus,
        .recharts-bar-rectangles:focus-visible,
        .recharts-area-area,
        .recharts-area-area:focus,
        .recharts-area-area:focus-visible,
        .recharts-layer,
        .recharts-layer:focus,
        .recharts-layer:focus-visible,
        .metric-card:focus,
        .metric-card:focus-visible,
        .metric-card:focus-within,
        .chart-modal-dialog:focus,
        .chart-modal-dialog:focus-visible,
        .chart-modal-dialog:focus-within {
          outline: none !important;
          outline-width: 0 !important;
          outline-style: none !important;
          outline-color: transparent !important;
          box-shadow: none !important;
          -webkit-tap-highlight-color: transparent !important;
        }
        .chart-date-input {
          border: 1px solid var(--border-light, #eeeeee);
          background: var(--bg-card, #ffffff);
          border-radius: 8px;
          padding: 5px 9px;
          font-size: 12.5px;
          font-weight: 500;
          color: var(--text-primary);
          font-family: inherit;
          outline: none;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .chart-date-input:hover {
          border-color: var(--border-default, #cccccc);
        }
        .chart-date-input:focus {
          border-color: var(--accent-blue, #006aff);
          box-shadow: 0 0 0 2px rgba(0, 106, 255, 0.15);
        }
        .modal-icon-close:hover {
          background: var(--bg-card, #ffffff) !important;
          color: var(--text-primary) !important;
          border-color: var(--text-primary) !important;
          transform: rotate(90deg);
        }
      `}</style>
      <div className="page-header">
        <div>
          <h1 className="page-title">Study Home</h1>
          <div className="page-subtitle">Welcome back — here's your study overview</div>
        </div>
        <div className="header-actions">
          <button className="btn btn-primary btn-sm" id="home-new-chat-btn" onClick={handleNewChat}>
            <Plus size={14} /> New Chat
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: 24 }}>
        {metrics.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div className="metric-card" key={kpi.label}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div className="metric-label">{kpi.label}</div>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: 'var(--bg-canvas)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: kpi.color,
                }}>
                  <Icon size={18} />
                </div>
              </div>
              <div className="metric-value" style={{ color: kpi.color }}>{kpi.value}</div>
            </div>
          );
        })}
      </div>



      {/* Analytics Charts */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12, gap: 8 }}>
        {(['24h', '7d', '30d', '90d'] as const).map(range => (
          <button
            key={range}
            className={`btn btn-sm ${timeRange === range ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setTimeRange(range)}
          >
            {range.toUpperCase()}
          </button>
        ))}
      </div>

      <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', marginBottom: 24 }}>

        {/* Chart 1: Token Usage */}
        <div className="metric-card" style={{ display: 'flex', flexDirection: 'column', padding: 20, position: 'relative' }}>
          <button onClick={() => { setExpandedChart('ai'); setModalAiUsage(aiUsage); setModalTimeRange(timeRange); setModalStartDate(''); setModalEndDate(''); }} className="btn btn-ghost btn-sm hover-expand-btn" style={{ position: 'absolute', top: 12, right: 12, padding: 4 }} title="Expand">
            <Maximize2 size={16} />
          </button>
          <div className="table-title" style={{ marginBottom: 16 }}>AI Token Usage</div>
          <div style={{ flex: 1, minHeight: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={aiUsage}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickFormatter={(v) => v.substring(5, 10)} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
                <RechartsTooltip cursor={{ fill: 'var(--bg-canvas)' }} contentStyle={{ borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-card)' }} itemStyle={{ whiteSpace: 'nowrap' }} wrapperStyle={{ zIndex: 100 }} />
                <Bar dataKey="input_tokens" name="Input" stackId="a" fill="var(--accent-blue)" radius={[0, 0, 4, 4]} />
                <Bar dataKey="output_tokens" name="Output" stackId="a" fill="var(--accent-purple)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Document Processing */}
        <div className="metric-card" style={{ display: 'flex', flexDirection: 'column', padding: 20, position: 'relative' }}>
          <button onClick={() => { setExpandedChart('docs'); setModalDocAnalytics(docAnalytics); setModalTimeRange(timeRange); setModalStartDate(''); setModalEndDate(''); }} className="btn btn-ghost btn-sm hover-expand-btn" style={{ position: 'absolute', top: 12, right: 12, padding: 4 }} title="Expand">
            <Maximize2 size={16} />
          </button>
          <div className="table-title" style={{ marginBottom: 16 }}>Pages Processed</div>
          <div style={{ flex: 1, minHeight: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={docAnalytics}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} tickFormatter={(v) => v.substring(5, 10)} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} width={40} />
                <RechartsTooltip cursor={{ stroke: 'var(--border-color)' }} contentStyle={{ borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-card)' }} itemStyle={{ whiteSpace: 'nowrap' }} wrapperStyle={{ zIndex: 100 }} />
                <Area type="monotone" dataKey="pages_processed" name="Pages" stroke="var(--accent-green)" fill="var(--accent-green)" fillOpacity={0.2} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 3: Storage Breakdown */}
        <div className="metric-card" style={{ display: 'flex', flexDirection: 'column', padding: 20, position: 'relative' }}>
          <button onClick={() => setExpandedChart('storage')} className="btn btn-ghost btn-sm hover-expand-btn" style={{ position: 'absolute', top: 12, right: 12, padding: 4 }} title="Expand">
            <Maximize2 size={16} />
          </button>
          <div className="table-title" style={{ marginBottom: 16 }}>Storage Breakdown</div>
          <div style={{ flex: 1, minHeight: 200, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {storagePieData.length > 0 ? (
              <div
                onMouseLeave={() => setHoveredCardStorage(false)}
                style={{ position: 'relative', width: '100%', height: '100%', minHeight: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart onMouseLeave={() => setHoveredCardStorage(false)}>
                    <Pie
                      data={storagePieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={70}
                      paddingAngle={storagePieData.length > 1 ? 4 : 0}
                      stroke="var(--bg-card)"
                      strokeWidth={2}
                      onMouseEnter={() => setHoveredCardStorage(true)}
                      onMouseLeave={() => setHoveredCardStorage(false)}
                    >
                      {storagePieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} style={{ cursor: 'pointer' }} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      wrapperStyle={{ zIndex: 1000, pointerEvents: 'none' }}
                      formatter={(value: any, name: any) => [
                        `${formatBytes(Number(value))} (${totalStorageBytes > 0 ? Math.round((Number(value) / totalStorageBytes) * 100) : 0}%)`,
                        name
                      ]}
                      contentStyle={{
                        borderRadius: 8,
                        border: '1px solid var(--border-default, #e5e5e5)',
                        background: 'var(--bg-card, #ffffff)',
                        color: 'var(--text-primary)',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                      }}
                      itemStyle={{ color: 'var(--text-primary)' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  textAlign: 'center',
                  pointerEvents: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: hoveredCardStorage ? 0 : 1,
                  transition: 'opacity 0.2s ease',
                  zIndex: 1
                }}>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total</span>
                  <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)', lineHeight: 1.1 }}>
                    {formatBytes(totalStorageBytes)}
                  </span>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                No storage used yet
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Recent Chats */}
      <div className="table-card">
        <div className="table-header-row">
          <span className="table-title">Recent Chats</span>
          <Link to="/app/chats" style={{ textDecoration: 'none' }}>
            <button className="btn btn-ghost btn-sm" id="view-all-chats-btn">View All</button>
          </Link>
        </div>

        {data?.recent_chats && data.recent_chats.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Chat Title</th>
                <th>Last Active</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {data.recent_chats.slice(0, 5).map((chat) => (
                <tr key={chat.id} onClick={() => navigate(`/app/chats/${chat.id}`)}>
                  <td style={{ fontWeight: 600 }}>{chat.title}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12.5 }}>
                    {new Date(chat.updated_at).toLocaleDateString()}
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <ArrowRight size={14} style={{ color: 'var(--text-muted)' }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">
              <MessageSquare size={24} />
            </div>
            <div className="empty-state-title">No chats yet</div>
            <div className="empty-state-sub">
              Start a new chat to upload your textbooks and ask questions
            </div>
            <button className="btn btn-primary btn-sm" onClick={handleNewChat}>
              <Plus size={14} /> Create your first chat
            </button>
          </div>
        )}
      </div>
      {/* Chart Modal */}
      {expandedChart && (
        <div
          onClick={() => setExpandedChart(null)}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.5)', zIndex: 1000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 32, backdropFilter: 'blur(8px)',
            cursor: 'pointer'
          }}
        >
          {expandedChart === 'storage' ? (
            /* Big screen storage modal styled like Admin AI Usage tab (Query Type Breakdown card) */
            <div
              className="chart-modal-dialog"
              onClick={e => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: 440,
                maxHeight: '90vh',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
                padding: 24,
                background: 'var(--bg-card, #ffffff)',
                borderRadius: 20,
                border: '1px solid var(--border-default, #e5e5e5)',
                boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05)',
                cursor: 'default'
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.3px' }}>
                    Storage Breakdown
                  </h3>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2, fontWeight: 500 }}>
                    {formatBytes(totalStorageBytes)} total
                  </div>
                </div>
                <button
                  className="modal-icon-close"
                  title="Close (Esc or click outside)"
                  onClick={() => setExpandedChart(null)}
                  style={{
                    width: 34, height: 34, borderRadius: '50%',
                    border: '1px solid var(--border-default, #e5e5e5)',
                    background: 'var(--bg-input, #f7f7f7)',
                    color: 'var(--text-secondary, #666666)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', transition: 'all 0.18s ease'
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              {/* Donut Chart with Centered Total Metric */}
              <div
                onMouseLeave={() => setHoveredModalStorage(false)}
                style={{ position: 'relative', width: '100%', height: 190, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '4px 0 16px' }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart onMouseLeave={() => setHoveredModalStorage(false)}>
                    <Pie
                      data={storagePieData.length > 0 ? storagePieData : [{ name: 'Empty', value: 1, color: 'var(--border-default, #e5e5e5)' }]}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={storagePieData.length > 1 ? 4 : 0}
                      dataKey="value"
                      nameKey="name"
                      stroke="var(--bg-card)"
                      strokeWidth={2}
                      onMouseEnter={() => setHoveredModalStorage(true)}
                      onMouseLeave={() => setHoveredModalStorage(false)}
                    >
                      {storagePieData.length > 0 ? (
                        storagePieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} style={{ cursor: 'pointer' }} />
                        ))
                      ) : (
                        <Cell fill="var(--border-default, #e5e5e5)" />
                      )}
                    </Pie>
                    {storagePieData.length > 0 && (
                      <RechartsTooltip
                        wrapperStyle={{ zIndex: 1000, pointerEvents: 'none' }}
                        contentStyle={{
                          background: 'var(--bg-card, #ffffff)',
                          borderColor: 'var(--border-default, #e5e5e5)',
                          borderRadius: 8,
                          color: 'var(--text-primary, #1a1a1a)',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
                        }}
                        itemStyle={{ color: 'var(--text-primary, #1a1a1a)' }}
                        formatter={(value: any, name: any) => [
                          `${formatBytes(Number(value))} (${totalStorageBytes > 0 ? Math.round((Number(value) / totalStorageBytes) * 100) : 0}%)`,
                          name
                        ]}
                      />
                    )}
                  </PieChart>
                </ResponsiveContainer>

                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  textAlign: 'center',
                  pointerEvents: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: hoveredModalStorage ? 0 : 1,
                  transition: 'opacity 0.2s ease',
                  zIndex: 1
                }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total</span>
                  <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.15 }}>
                    {formatBytes(totalStorageBytes)}
                  </span>
                </div>
              </div>

              {/* Clean Breakdown List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                {(storagePieData.length > 0 ? storagePieData : storageItems).map((entry) => {
                  const pct = totalStorageBytes > 0 ? Math.round((entry.value / totalStorageBytes) * 100) : 0;
                  return (
                    <div
                      key={entry.name}
                      className="storage-breakdown-row"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 12px',
                        borderRadius: 10,
                        background: 'var(--bg-active, #f4f5f7)',
                        transition: 'background 0.15s ease',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: entry.color, flexShrink: 0 }} />
                        <span style={{
                          color: 'var(--text-primary)',
                          fontSize: 13.5,
                          fontWeight: 500,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis'
                        }}>
                          {entry.name}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 500 }}>
                          {formatBytes(entry.value)}
                        </span>
                        <span style={{
                          color: entry.color,
                          fontWeight: 600,
                          background: `${entry.color}18`,
                          padding: '2px 8px',
                          borderRadius: 12,
                          fontSize: 12,
                          minWidth: 40,
                          textAlign: 'center'
                        }}>
                          {pct}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {storageData?.quota_bytes > 0 && (
                <div style={{
                  marginTop: 16,
                  paddingTop: 12,
                  borderTop: '1px solid var(--border-light, #eeeeee)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: 12,
                  color: 'var(--text-muted)'
                }}>
                  <span>Account Quota</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
                    {formatBytes(totalStorageBytes)} / {formatBytes(storageData.quota_bytes)}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <div
              className="chart-modal-dialog"
              onClick={e => e.stopPropagation()}
              style={{
                width: '100%', maxWidth: 940, height: '82vh',
                display: 'flex', flexDirection: 'column', padding: 32,
                background: 'var(--bg-card, #ffffff)',
                borderRadius: 20,
                border: '1px solid var(--border-default, #e5e5e5)',
                boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.25), 0 0 0 1px rgba(0, 0, 0, 0.05)',
                cursor: 'default'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
                    {expandedChart === 'ai' ? 'AI Token Usage' : 'Pages Processed'}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
                    {expandedChart === 'ai' ? 'Daily breakdown of input and output token consumption' : 'Document pages ingested and indexed over time'}
                  </div>
                </div>
                <button
                  className="modal-icon-close"
                  title="Close (Esc or click outside)"
                  onClick={() => setExpandedChart(null)}
                  style={{
                    width: 36, height: 36, borderRadius: '50%',
                    border: '1px solid var(--border-default, #e5e5e5)',
                    background: 'var(--bg-input, #f7f7f7)',
                    color: 'var(--text-secondary, #666666)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', transition: 'all 0.18s ease'
                  }}
                >
                  <X size={18} />
                </button>
              </div>

              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 22,
                gap: 16,
                flexWrap: 'wrap',
                padding: '8px 12px',
                background: 'var(--bg-input, #f8f8f9)',
                borderRadius: 14,
                border: '1px solid var(--border-light, #eeeeee)'
              }}>
                {/* Preset Time Range Pills */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'var(--bg-card, #ffffff)', padding: 3, borderRadius: 10, border: '1px solid var(--border-light, #eeeeee)' }}>
                  {(['24h', '7d', '30d', '90d'] as const).map(range => {
                    const isSelected = modalTimeRange === range && !modalStartDate && !modalEndDate;
                    return (
                      <button
                        key={range}
                        onClick={() => { setModalTimeRange(range); setModalStartDate(''); setModalEndDate(''); }}
                        style={{
                          padding: '5px 12px',
                          fontSize: 12,
                          fontWeight: isSelected ? 600 : 500,
                          borderRadius: 7,
                          border: 'none',
                          cursor: 'pointer',
                          background: isSelected ? 'var(--btn-primary-bg, #1a1a1a)' : 'transparent',
                          color: isSelected ? 'var(--btn-primary-text, #ffffff)' : 'var(--text-secondary, #6b6b6b)',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {range.toUpperCase()}
                      </button>
                    );
                  })}
                </div>

                {/* Sleek Custom Date Range Pill */}
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  background: 'var(--bg-card, #ffffff)',
                  border: (modalStartDate || modalEndDate) ? '1px solid var(--accent-blue, #006aff)' : '1px solid var(--border-light, #eeeeee)',
                  boxShadow: (modalStartDate || modalEndDate) ? '0 0 0 3px rgba(0, 106, 255, 0.1)' : 'none',
                  padding: '4px 10px',
                  borderRadius: 10,
                  transition: 'all 0.15s ease'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: (modalStartDate || modalEndDate) ? 'var(--accent-blue, #006aff)' : 'var(--text-muted)' }}>
                    <Calendar size={14} />
                    <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Custom</span>
                  </div>

                  <input
                    type="date"
                    className="chart-date-input"
                    title="Start date"
                    value={modalStartDate}
                    onChange={e => setModalStartDate(e.target.value)}
                  />

                  <span style={{ color: 'var(--text-muted)', fontSize: 12, opacity: 0.6 }}>to</span>

                  <input
                    type="date"
                    className="chart-date-input"
                    title="End date"
                    value={modalEndDate}
                    onChange={e => setModalEndDate(e.target.value)}
                  />

                  {(modalStartDate || modalEndDate) && (
                    <button
                      type="button"
                      title="Clear custom dates"
                      onClick={() => { setModalStartDate(''); setModalEndDate(''); }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        padding: 3,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text-muted)',
                        borderRadius: '50%',
                        transition: 'color 0.15s'
                      }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent-red, #e22134)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              <div style={{ flex: 1, minHeight: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  {expandedChart === 'ai' ? (
                    <BarChart data={modalAiUsage}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                      <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} width={60} />
                      <RechartsTooltip cursor={{ fill: 'var(--bg-canvas)' }} contentStyle={{ borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-card)' }} itemStyle={{ whiteSpace: 'nowrap' }} />
                      <Bar dataKey="input_tokens" name="Input Tokens" stackId="a" fill="var(--accent-blue)" radius={[0, 0, 4, 4]} />
                      <Bar dataKey="output_tokens" name="Output Tokens" stackId="a" fill="var(--accent-purple)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  ) : (
                    <AreaChart data={modalDocAnalytics}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                      <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} width={60} />
                      <RechartsTooltip cursor={{ stroke: 'var(--border-color)' }} contentStyle={{ borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-card)' }} itemStyle={{ whiteSpace: 'nowrap' }} />
                      <Area type="monotone" dataKey="pages_processed" name="Pages Processed" stroke="var(--accent-green)" fill="var(--accent-green)" fillOpacity={0.2} strokeWidth={2} />
                    </AreaChart>
                  )}
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
