import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  MessageSquare, FileText, BookOpen, Lightbulb,
  Plus, ArrowRight, Activity, Maximize2, X
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

  const storagePieData = storageData ? [
    { name: 'PDFs', value: storageData.pdf_bytes, color: 'var(--accent-green)' },
    { name: 'Vector DB', value: storageData.vector_bytes, color: 'var(--accent-blue)' },
    { name: 'Chat Data', value: storageData.chat_bytes, color: 'var(--accent-purple)' },
    { name: 'Study Data', value: storageData.study_bytes, color: 'var(--accent-orange)' },
  ].filter(d => d.value > 0) : [];

  return (
    <div className="animate-fade-in" style={{ flex: 1, width: '100%', boxSizing: 'border-box' }}>
      <style>{`
        .metric-card .hover-expand-btn { opacity: 0; transition: opacity 0.2s; }
        .metric-card:hover .hover-expand-btn { opacity: 1; }
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
          <div style={{ flex: 1, minHeight: 200 }}>
            {storagePieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={storagePieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={70} stroke="var(--bg-card)" strokeWidth={2}>
                    {storagePieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(value: number) => [(value / 1024 / 1024).toFixed(2) + ' MB', 'Size']} contentStyle={{ borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-card)' }} />
                </PieChart>
              </ResponsiveContainer>
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
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'var(--bg-overlay)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 40, backdropFilter: 'blur(4px)'
        }}>
          <div className="metric-card" style={{ 
            width: '100%', maxWidth: 900, height: '80vh', 
            display: 'flex', flexDirection: 'column', padding: 32,
            boxShadow: '0 24px 48px rgba(0,0,0,0.1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div className="table-title" style={{ fontSize: 24 }}>
                {expandedChart === 'ai' ? 'AI Token Usage' : expandedChart === 'docs' ? 'Pages Processed' : 'Storage Breakdown'}
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => setExpandedChart(null)}>
                <X size={24} />
              </button>
            </div>
            
            {expandedChart !== 'storage' && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, gap: 16, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  {(['24h', '7d', '30d', '90d'] as const).map(range => (
                    <button
                      key={range}
                      className={`btn btn-sm ${modalTimeRange === range && !modalStartDate ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => { setModalTimeRange(range); setModalStartDate(''); setModalEndDate(''); }}
                    >
                      {range.toUpperCase()}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Custom:</span>
                  <input type="date" className="input" style={{ padding: '4px 8px', fontSize: 13 }} value={modalStartDate} onChange={e => setModalStartDate(e.target.value)} />
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>to</span>
                  <input type="date" className="input" style={{ padding: '4px 8px', fontSize: 13 }} value={modalEndDate} onChange={e => setModalEndDate(e.target.value)} />
                </div>
              </div>
            )}

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
                ) : expandedChart === 'docs' ? (
                  <AreaChart data={modalDocAnalytics}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" />
                    <XAxis dataKey="date" tick={{ fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} width={60} />
                    <RechartsTooltip cursor={{ stroke: 'var(--border-color)' }} contentStyle={{ borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-card)' }} itemStyle={{ whiteSpace: 'nowrap' }} />
                    <Area type="monotone" dataKey="pages_processed" name="Pages Processed" stroke="var(--accent-green)" fill="var(--accent-green)" fillOpacity={0.2} strokeWidth={2} />
                  </AreaChart>
                ) : (
                  <PieChart>
                    <Pie data={storagePieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={80} outerRadius={120} stroke="var(--bg-card)" strokeWidth={2} label>
                      {storagePieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip formatter={(value: number) => [(value / 1024 / 1024).toFixed(2) + ' MB', 'Size']} contentStyle={{ borderRadius: 8, border: '1px solid var(--border-color)', background: 'var(--bg-card)' }} />
                  </PieChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
