import { useState, useEffect } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { LayoutDashboard, Users, FileText, Brain, HardDrive, Clock, Server, Activity, CheckCircle, Database, XCircle } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useAuth } from '@/features/auth/AuthContext';
import { useTheme } from '@/features/theme/ThemeProvider';
import { api } from '@/lib/api';
import PdfSource, { type Source } from '@/components/PdfSource';
import { CircleBuffer } from '@/components/CircleBuffer';
import AdminStorageTab from '@/components/AdminStorageTab';

interface DashboardStats {
  users: { total: number; active_today: number; active_week: number; new_month: number };
  documents: { total: number; ready: number; processing: number; failed: number; ocr_processed: number };
  queries: { total: number; today: number; last_7d: number; avg_per_user: number };
  storage: { pdf_bytes: number; chroma_bytes: number; db_bytes: number; disk_free_bytes: number; disk_total_bytes: number };
  jobs: { running: number; queued: number; failed: number; complete_today: number };
  system: { ollama: string; chroma: string; postgres: string; worker: string };
  total_users: number;
  total_documents: number;
  total_ai_queries: number;
  storage_used_bytes: number;
  recent_users: { id: string; username: string; created_at: string }[];
  recent_documents: { id: string; original_filename: string; username: string; created_at: string }[];
}

function KpiCard({ label, value, color, icon, barPercent }: {
  label: string;
  value: string | number | undefined;
  color: string;
  icon: React.ReactNode;
  barPercent?: number;
}) {
  return (
    <div
      className="kpi-card"
      style={{
        background: 'var(--bg-card)',
        padding: '24px',
        borderRadius: '20px',
        border: '1px solid var(--border-default)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        position: 'relative',
        overflow: 'hidden',
        cursor: 'pointer'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{
          color: color,
          display: 'flex',
          padding: '12px',
          background: `color-mix(in srgb, ${color} 12%, transparent)`,
          borderRadius: '14px'
        }}>
          {icon}
        </div>
        <div style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
          {label}
        </div>
      </div>
      <div style={{ fontSize: '36px', fontWeight: '800', color: 'var(--text-primary)', lineHeight: '1' }}>
        {value || '0'}
      </div>
      {typeof barPercent === 'number' && (
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '4px', background: 'var(--bg-active)' }}>
          <div style={{ height: '100%', width: `${Math.min(100, Math.max(0, barPercent))}%`, background: color, transition: 'width 0.5s ease' }} />
        </div>
      )}
    </div>
  );
}

const SystemBadge = ({ label, status, icon }: { label: string, status: string | undefined, icon: React.ReactNode }) => {
  const getStatusColor = (s: string | undefined) => {
    if (!s) return '#94a3b8';
    const l = s.toLowerCase();
    if (l.includes('online') || l.includes('active') || l.includes('idle')) return '#10b981';
    if (l.includes('offline') || l.includes('error') || l.includes('unreachable')) return '#ef4444';
    return '#f59e0b';
  };
  const getStatusDesc = (s: string | undefined) => {
    if (!s) return 'Status unknown';
    const l = s.toLowerCase();
    if (l.includes('online') || l.includes('active')) return 'Operational & healthy';
    if (l.includes('idle')) return 'Standby / Ready';
    if (l.includes('offline') || l.includes('error') || l.includes('unreachable')) return 'Attention required';
    return 'Checking status...';
  };
  const color = getStatusColor(status);
  return (
    <div
      style={{
        background: 'var(--bg-canvas)',
        padding: '24px',
        borderRadius: '20px',
        border: '1px solid transparent',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        minHeight: '136px',
        gap: '20px',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        cursor: 'default'
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = 'var(--bg-card)';
        e.currentTarget.style.borderColor = 'var(--border-default)';
        e.currentTarget.style.boxShadow = '0 10px 30px rgba(0,0,0,0.06)';
        e.currentTarget.style.transform = 'translateY(-4px)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'var(--bg-canvas)';
        e.currentTarget.style.borderColor = 'transparent';
        e.currentTarget.style.boxShadow = 'none';
        e.currentTarget.style.transform = 'translateY(0)';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{
          color: color,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '12px',
          background: `color-mix(in srgb, ${color} 12%, transparent)`,
          borderRadius: '14px'
        }}>
          {icon}
        </div>
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 12px',
          borderRadius: '20px',
          background: `color-mix(in srgb, ${color} 15%, transparent)`,
          color: color,
          fontWeight: '800',
          fontSize: '11px',
          textTransform: 'uppercase',
          letterSpacing: '0.8px'
        }}>
          <span style={{
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            background: color,
            boxShadow: `0 0 6px ${color}`
          }} />
          {status || 'Unknown'}
        </div>
      </div>
      <div>
        <div style={{ fontWeight: '700', color: 'var(--text-primary)', fontSize: '16px', letterSpacing: '-0.2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {label}
        </div>
        <div style={{ color: 'var(--text-muted)', fontSize: '12px', marginTop: '4px', fontWeight: '500' }}>
          {getStatusDesc(status)}
        </div>
      </div>
    </div>
  );
};

interface AiUsage {
  date: string;
  tokens_used: number;
  active_users: number;
}

export default function AdminDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { theme, previewTheme } = useTheme();

  const activeTheme = previewTheme ?? theme;
  const isDark = activeTheme === 'dark';
  const tickColor = isDark ? '#94a3b8' : '#64748b';
  const tooltipBg = isDark ? '#1e293b' : '#fff';
  const tooltipBorder = isDark ? '#334155' : '#e2e8f0';
  const tooltipText = isDark ? '#f8fafc' : '#0f172a';

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [usageData, setUsageData] = useState<AiUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPdf, setSelectedPdf] = useState<Source | null>(null);
  const [activeTab, setActiveTab] = useState<'users' | 'documents' | 'queries' | 'storage' | 'jobs' | 'system'>('users');
  const [range, setRange] = useState('30d');

  useEffect(() => {
    fetchData();
  }, [range]);

  const fetchData = async () => {
    try {
      if (!stats) setLoading(true);
      const [statsRes, usageRes] = await Promise.all([
        api.getAdminDashboard(),
        api.getAdminAiUsage(range)
      ]);
      setStats(statsRes);
      const rawUsage = usageRes?.usage || (usageRes?.time_series?.daily ? usageRes.time_series.daily.map((d: any) => ({
        date: d.date,
        tokens_used: (d.input || 0) + (d.output || 0),
        active_users: 1
      })) : []);
      // Ensure oldest is first for the graph left-to-right
      const sortedUsage = [...rawUsage].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      setUsageData(sortedUsage);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to fetch dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  const formatStorage = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  const formatGraphDate = (dateStr: string) => {
    const d = new Date(dateStr);
    if (range === '24h') {
      return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    }
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  };

  if (user?.username !== 'admin') {
    return <Navigate to="/app" replace />;
  }

  return (
    <div style={{ flex: 1, width: '100%', boxSizing: 'border-box' }}>
      <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '16px',
          background: 'rgba(59, 130, 246, 0.1)',
          color: '#3b82f6',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          <LayoutDashboard size={24} />
        </div>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '700', margin: 0, color: 'var(--text-primary)' }}>Admin Dashboard</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: '4px 0 0 0' }}>Manage your platform, monitor users, and check system resources at a glance.</p>
        </div>
      </div>

      {error && <div style={{ padding: '10px 14px', background: '#FEF2F2', color: '#EF4444', borderRadius: '8px', marginBottom: '20px', fontSize: '14px' }}>{error}</div>}

      {loading ? (
        <CircleBuffer minHeight={380} size={42} />
      ) : (
        <>
          {/* Top Stat Cards */}
          <div className="admin-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginTop: '16px' }}>

            <div
              className="stat-card"
              onClick={() => navigate('/app/admin/users')}
              title="Click to view all users"
              style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border-default)', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)', transition: 'transform 0.2s', cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '14px' }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '16px',
                  background: 'rgba(59, 130, 246, 0.1)',
                  color: '#3b82f6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Users size={24} />
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Users</div>
                </div>
              </div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)' }}>{stats?.total_users.toLocaleString()}</div>
            </div>

            <div
              className="stat-card"
              onClick={() => navigate('/app/admin/documents')}
              title="Click to view all documents"
              style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border-default)', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)', transition: 'transform 0.2s', cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '14px' }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '16px',
                  background: 'rgba(16, 185, 129, 0.1)',
                  color: '#10b981',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <FileText size={24} />
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Documents</div>
                </div>
              </div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)' }}>{stats?.total_documents.toLocaleString()}</div>
            </div>

            <div
              className="stat-card"
              onClick={() => navigate('/app/admin/ai-usage')}
              title="Click to view AI usage"
              style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border-default)', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)', transition: 'transform 0.2s', cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '14px' }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '16px',
                  background: 'rgba(139, 92, 246, 0.1)',
                  color: '#8b5cf6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Brain size={24} />
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>AI Queries</div>
                </div>
              </div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)' }}>{stats?.total_ai_queries.toLocaleString()}</div>
            </div>

            <div 
              className="stat-card" 
              onClick={() => navigate('/app/admin/storage')}
              title="Click to view Storage Administration"
              style={{ background: 'var(--bg-card)', padding: '20px', borderRadius: '16px', border: '1px solid var(--border-default)', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)', transition: 'transform 0.2s', cursor: 'pointer' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '14px' }}>
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '16px',
                  background: 'rgba(249, 115, 22, 0.1)',
                  color: '#f97316',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <HardDrive size={24} />
                </div>
                <div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Storage Used</div>
                </div>
              </div>
              <div style={{ fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)' }}>{formatStorage(stats?.storage_used_bytes || 0)}</div>
            </div>

          </div>

          {/* AI Usage Graph */}
          <div style={{ background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-default)', padding: '20px', boxShadow: '0 4px 15px rgba(0,0,0,0.02)', marginTop: '20px' }}>
            <div style={{ marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
              <h3
                onClick={() => navigate('/app/admin/ai-usage')}
                title="Tap to open AI Usage tab"
                style={{
                  fontSize: '16px',
                  fontWeight: '700',
                  margin: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  userSelect: 'none'
                }}
              >
                <Brain size={18} color="#7c3aed" /> AI Token Usage
              </h3>

              <div style={{ display: 'inline-flex', background: 'var(--bg-active)', borderRadius: '12px', padding: '4px', gap: '2px' }}>
                {[
                  { value: '24h', label: '24 H' },
                  { value: '7d', label: '7 D' },
                  { value: '30d', label: '1 M' },
                  { value: '90d', label: '3 M' }
                ].map(r => (
                  <button
                    key={r.value}
                    onClick={() => setRange(r.value)}
                    style={{
                      background: range === r.value ? 'var(--bg-card)' : 'transparent',
                      color: range === r.value ? '#4f46e5' : 'var(--text-muted)',
                      border: 'none',
                      padding: '6px 14px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      boxShadow: range === r.value ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                    }}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {usageData.length === 0 ? (
              <div style={{ height: '260px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                Not enough data to display graph.
              </div>
            ) : (
              <div style={{ height: '260px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={usageData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorTokens" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    {!isDark && <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />}
                    <XAxis
                      dataKey="date"
                      tickFormatter={formatGraphDate}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: tickColor, fontSize: 11 }}
                      dy={10}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: tickColor, fontSize: 11 }}
                      dx={-10}
                    />
                    <Tooltip
                      contentStyle={{ background: tooltipBg, color: tooltipText, borderRadius: '12px', border: `1px solid ${tooltipBorder}`, boxShadow: '0 4px 15px rgba(0,0,0,0.05)', fontSize: '13px' }}
                      itemStyle={{ color: tooltipText }}
                      labelFormatter={formatGraphDate as any}
                      formatter={((value: number) => [value.toLocaleString(), 'Tokens Used']) as any}
                    />
                    <Area
                      type="monotone"
                      dataKey="tokens_used"
                      stroke="#7c3aed"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#colorTokens)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Detailed Stat Tabs and Content */}
          <div style={{
            marginTop: '32px',
            background: 'var(--bg-card)',
            borderRadius: '32px',
            border: '1px solid var(--border-default)',
            padding: '40px',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.04)'
          }}>

            {/* Tabs Row */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '40px' }}>
              <div style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '8px', background: 'var(--bg-canvas)', padding: '8px', borderRadius: '100px', border: '1px solid var(--border-light)', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}>
                {[
                  { id: 'users', label: 'Users', icon: Users, color: 'var(--accent-blue)' },
                  { id: 'documents', label: 'Documents', icon: FileText, color: 'var(--accent-green)' },
                  { id: 'queries', label: 'AI Queries', icon: Brain, color: 'var(--accent-purple)' },
                  { id: 'storage', label: 'Storage', icon: HardDrive, color: 'var(--accent-orange)' },
                  { id: 'jobs', label: 'Jobs', icon: Activity, color: 'var(--accent-red)' },
                  { id: 'system', label: 'System', icon: Server, color: 'var(--text-secondary)' }
                ].map(tab => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as any)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '100px', border: 'none',
                        background: isActive ? tab.color : 'transparent',
                        color: isActive ? '#ffffff' : 'var(--text-secondary)',
                        fontWeight: isActive ? '700' : '600',
                        fontSize: '14px',
                        cursor: 'pointer',
                        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                        boxShadow: isActive ? '0 4px 14px rgba(0,0,0,0.15)' : 'none',
                        transform: isActive ? 'scale(1.02)' : 'scale(1)'
                      }}
                      onMouseEnter={e => { if (!isActive) e.currentTarget.style.color = 'var(--text-primary)'; }}
                      onMouseLeave={e => { if (!isActive) e.currentTarget.style.color = 'var(--text-secondary)'; }}
                    >
                      <tab.icon size={18} strokeWidth={isActive ? 2.5 : 2} /> {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Tab Content Cards */}
            <div className="admin-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
              {activeTab === 'users' && (
                <>
                  <KpiCard label="Total Users" value={stats?.users?.total.toLocaleString()} icon={<Users size={20} />} color="#3b82f6" />
                  <KpiCard label="Active Today" value={stats?.users?.active_today.toLocaleString()} icon={<Activity size={20} />} color="#10b981" />
                  <KpiCard label="Active This Week" value={stats?.users?.active_week.toLocaleString()} icon={<Clock size={20} />} color="#8b5cf6" />
                  <KpiCard label="New This Month" value={stats?.users?.new_month.toLocaleString()} icon={<Users size={20} />} color="#f59e0b" />
                </>
              )}
              {activeTab === 'documents' && (
                <>
                  <KpiCard label="Total Documents" value={stats?.documents?.total.toLocaleString()} icon={<FileText size={20} />} color="#3b82f6" />
                  <KpiCard label="Ready" value={stats?.documents?.ready.toLocaleString()} icon={<CheckCircle size={20} />} color="#10b981" />
                  <KpiCard label="Processing" value={stats?.documents?.processing.toLocaleString()} icon={<Activity size={20} />} color="#f59e0b" />
                  <KpiCard label="Failed" value={stats?.documents?.failed.toLocaleString()} icon={<XCircle size={20} />} color="#ef4444" />
                </>
              )}
              {activeTab === 'queries' && (
                <>
                  <KpiCard label="Total Queries" value={stats?.queries?.total.toLocaleString()} icon={<Brain size={20} />} color="#7c3aed" />
                  <KpiCard label="Today" value={stats?.queries?.today.toLocaleString()} icon={<Activity size={20} />} color="#3b82f6" />
                  <KpiCard label="Last 7 Days" value={stats?.queries?.last_7d.toLocaleString()} icon={<Clock size={20} />} color="#10b981" />
                  <KpiCard label="Avg/User" value={stats?.queries?.avg_per_user.toLocaleString()} icon={<Users size={20} />} color="#f59e0b" />
                </>
              )}
              {activeTab === 'storage' && (
                <div style={{ gridColumn: '1 / -1' }}>
                  <AdminStorageTab />
                </div>
              )}
              {activeTab === 'jobs' && (
                <>
                  <KpiCard label="Running" value={stats?.jobs?.running.toLocaleString() || '0'} icon={<Activity size={20} />} color="#3b82f6" />
                  <KpiCard label="Queued" value={stats?.jobs?.queued.toLocaleString() || '0'} icon={<Clock size={20} />} color="#f59e0b" />
                  <KpiCard label="Failed" value={stats?.jobs?.failed.toLocaleString() || '0'} icon={<XCircle size={20} />} color="#ef4444" />
                  <KpiCard label="Completed Today" value={stats?.jobs?.complete_today?.toLocaleString() || '0'} icon={<CheckCircle size={20} />} color="#10b981" />
                </>
              )}
              {activeTab === 'system' && (
                <>
                  <SystemBadge label="Ollama (AI Model)" status={stats?.system?.ollama} icon={<Brain size={20} />} />
                  <SystemBadge label="ChromaDB" status={stats?.system?.chroma} icon={<Database size={20} />} />
                  <SystemBadge label="PostgreSQL" status={stats?.system?.postgres} icon={<Server size={20} />} />
                  <SystemBadge label="Background Worker" status={stats?.system?.worker} icon={<Activity size={20} />} />
                </>
              )}
            </div>
          </div>


          {/* Activity Feeds */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '20px', marginTop: '20px' }}>

            {/* Recent Users */}
            <div style={{ background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-default)', padding: '20px', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
              <div
                onClick={() => navigate('/app/admin/users')}
                title="Tap to open Users tab"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '16px',
                  cursor: 'pointer',
                  userSelect: 'none'
                }}
              >
                <h3 style={{ fontSize: '16px', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Clock size={18} color="#64748b" /> Recent Signups
                </h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {stats?.recent_users.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '16px 0' }}>No users found.</div>
                ) : (
                  stats?.recent_users.map(u => (
                    <div
                      key={u.id}
                      onClick={() => navigate('/app/admin/users')}
                      title="Tap to view in Users tab"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        background: 'var(--bg-active)',
                        borderRadius: '10px',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--accent-blue)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '600', fontSize: '13px' }}>
                          {u.username.charAt(0).toUpperCase()}
                        </div>
                        <div style={{ fontWeight: '600', fontSize: '13px' }}>@{u.username}</div>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{formatDate(u.created_at)}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Recent Documents */}
            <div style={{ background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-default)', padding: '20px', boxShadow: '0 4px 15px rgba(0,0,0,0.02)' }}>
              <div
                onClick={() => navigate('/app/admin/documents')}
                title="Tap to open Documents tab"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '16px',
                  cursor: 'pointer',
                  userSelect: 'none'
                }}
              >
                <h3 style={{ fontSize: '16px', fontWeight: '700', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileText size={18} color="#64748b" /> Recent Uploads
                </h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {stats?.recent_documents.length === 0 ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '16px 0' }}>No documents found.</div>
                ) : (
                  stats?.recent_documents.map(d => (
                    <div
                      key={d.id}
                      onClick={() => setSelectedPdf({
                        document_id: d.id,
                        page_number: 1,
                        original_filename: d.original_filename
                      })}
                      title={d.original_filename}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '10px 14px',
                        background: 'var(--bg-active)',
                        borderRadius: '10px',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0, paddingRight: '10px' }}>
                        <div style={{ fontWeight: '600', fontSize: '13px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.original_filename}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '3px' }}>by @{d.username}</div>
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{formatDate(d.created_at)}</div>
                    </div>
                  ))
                )}
              </div>
            </div>

          </div>
        </>
      )}

      {selectedPdf && (
        <PdfSource
          source={selectedPdf}
          close={() => setSelectedPdf(null)}
          isAdmin={true}
        />
      )}
    </div>
  );
}

