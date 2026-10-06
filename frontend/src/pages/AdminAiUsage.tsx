import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthContext';
import { api } from '@/lib/api';
import { CircleBuffer } from '@/components/CircleBuffer';
import AdminUserDetail from './AdminUserDetail';
import {
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import { Brain, ArrowRightCircle, ArrowLeftCircle, Clock, Activity, XCircle } from 'lucide-react';

interface AiUsageData {
  kpis: {
    total_queries: number;
    input_tokens: number;
    output_tokens: number;
    avg_response_time: number;
    avg_tokens_per_query: number;
    failed_generations: number;
  };
  time_series: {
    daily: { date: string; queries: number; input: number; output: number }[];
  };
  by_user: {
    user_id?: string;
    username: string;
    queries: number;
    input_tokens: number;
    output_tokens: number;
    avg_latency_ms: number;
  }[];
  by_type: { type: string; count: number; percentage: number }[];
}

const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'];

const formatNumber = (num: number) => {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
  return num.toLocaleString();
};

const formatQueryType = (type: string) => {
  const map: Record<string, string> = {
    document_qa: 'Document Q&A',
    generate_answer: 'Document Q&A',
    topic_generation: 'Topic Generation',
    extract_topics: 'Topic Generation',
    quiz_generation: 'Quiz Generation',
    extract_quiz: 'Quiz Generation',
    generate_flashcards: 'Flashcards',
    flashcards: 'Flashcards',
    generate_concept_map: 'Concept Map',
    other: 'Other'
  };
  if (map[type]) return map[type];
  return type.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};

export default function AdminAiUsage() {
  const { user } = useAuth();
  const [data, setData] = useState<AiUsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [range, setRange] = useState('30d');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [usersMap, setUsersMap] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchUsage();
  }, [range]);

  const fetchUsage = async () => {
    try {
      setLoading(true);
      const [res, usersRes] = await Promise.all([
        api.getAdminAiUsage(range),
        api.getAdminUsers().catch(() => ({ users: [] }))
      ]);
      setData(res);
      if (usersRes?.users) {
        const map: Record<string, string> = {};
        usersRes.users.forEach((u: any) => {
          map[u.username.toLowerCase()] = u.id;
        });
        setUsersMap(map);
      }
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to fetch AI usage statistics.');
    } finally {
      setLoading(false);
    }
  };

  const handleUserClick = (u: any) => {
    const targetId = u.user_id || usersMap[u.username?.toLowerCase()];
    if (targetId) {
      setSelectedUserId(targetId);
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      if (range === '24h') {
        return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
      }
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric'
      });
    } catch (e) {
      return dateStr;
    }
  };

  if (user?.username !== 'admin') {
    return <Navigate to="/app" replace />;
  }

  if (loading && !data) {
    return <CircleBuffer minHeight="60vh" size={42} />;
  }

  return (
    <div style={{ flex: 1, width: '100%', boxSizing: 'border-box', paddingBottom: '40px' }}>
      <div style={{ marginBottom: '32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
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
            <Activity size={24} />
          </div>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: '700', margin: 0 }}>AI Usage Analytics</h1>
            <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>Track LLM token consumption, latency, and feature usage.</p>
          </div>
        </div>
        <div style={{ display: 'inline-flex', background: 'var(--bg-active)', borderRadius: '12px', padding: '4px', gap: '2px', marginTop: '4px' }}>
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

      {error && <div style={{ padding: '12px 16px', background: '#FEF2F2', color: '#EF4444', borderRadius: '8px', marginBottom: '24px' }}>{error}</div>}

      {/* KPIs Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '32px' }}>

        <div className="stat-card" style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '14px', fontWeight: '600' }}>Total Queries</span>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3B82F6' }}>
              <Brain size={20} />
            </div>
          </div>
          <span style={{ fontSize: '32px', fontWeight: '700', color: 'var(--text-primary)' }}>{formatNumber(data?.kpis.total_queries || 0)}</span>
        </div>

        <div className="stat-card" style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '14px', fontWeight: '600' }}>Input Tokens</span>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10B981' }}>
              <ArrowRightCircle size={20} />
            </div>
          </div>
          <span style={{ fontSize: '32px', fontWeight: '700', color: 'var(--text-primary)' }}>{formatNumber(data?.kpis.input_tokens || 0)}</span>
        </div>

        <div className="stat-card" style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '14px', fontWeight: '600' }}>Output Tokens</span>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F59E0B' }}>
              <ArrowLeftCircle size={20} />
            </div>
          </div>
          <span style={{ fontSize: '32px', fontWeight: '700', color: 'var(--text-primary)' }}>{formatNumber(data?.kpis.output_tokens || 0)}</span>
        </div>

        <div className="stat-card" style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '14px', fontWeight: '600' }}>Avg Response</span>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(139, 92, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8B5CF6' }}>
              <Clock size={20} />
            </div>
          </div>
          <span style={{ fontSize: '32px', fontWeight: '700', color: 'var(--text-primary)' }}>{data?.kpis.avg_response_time.toFixed(1)} <span style={{ fontSize: '16px', fontWeight: '500', color: 'var(--text-muted)' }}>sec</span></span>
        </div>

        <div className="stat-card" style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '14px', fontWeight: '600' }}>Avg Tokens/Query</span>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(236, 72, 153, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#EC4899' }}>
              <Activity size={20} />
            </div>
          </div>
          <span style={{ fontSize: '32px', fontWeight: '700', color: 'var(--text-primary)' }}>{formatNumber(data?.kpis.avg_tokens_per_query || 0)}</span>
        </div>

        <div className="stat-card" style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '14px', fontWeight: '600' }}>Failed Gens</span>
            <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#EF4444' }}>
              <XCircle size={20} />
            </div>
          </div>
          <span style={{ fontSize: '32px', fontWeight: '700', color: '#EF4444' }}>{formatNumber(data?.kpis.failed_generations || 0)}</span>
        </div>

      </div>

      {/* Charts Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '32px', marginBottom: '32px' }}>

        {/* Token Consumption */}
        <div style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-default)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600' }}>Token Consumption</h3>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center', fontSize: '13px', fontWeight: '500' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: 10, height: 10, borderRadius: '50%', background: '#10B981' }}></div>Input</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><div style={{ width: 10, height: 10, borderRadius: '50%', background: '#F59E0B' }}></div>Output</span>
            </div>
          </div>
          <div style={{ height: '300px', width: '100%' }}>
            {data?.time_series.daily.length ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.time_series.daily} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorInput" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorOutput" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#F59E0B" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#F59E0B" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-default)" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatDate}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
                    dy={10}
                  />
                  <YAxis
                    tickFormatter={formatNumber}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
                  />
                  <RechartsTooltip
                    contentStyle={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)', borderRadius: '8px', color: 'var(--text-primary)' }}
                    itemStyle={{ color: 'var(--text-primary)' }}
                    labelFormatter={(val) => formatDate(String(val ?? ''))}
                  />
                  <Area type="monotone" dataKey="input" stroke="#10B981" strokeWidth={3} fillOpacity={1} fill="url(#colorInput)" />
                  <Area type="monotone" dataKey="output" stroke="#F59E0B" strokeWidth={3} fillOpacity={1} fill="url(#colorOutput)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                No recent data available.
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Bottom Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '32px' }}>

        {/* Usage by User Table */}
        <div style={{ background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ padding: '24px', borderBottom: '1px solid var(--border-default)' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600' }}>Usage by User</h3>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
              <thead>
                <tr style={{ background: 'var(--bg-active)' }}>
                  <th style={{ padding: '16px 24px', fontWeight: '600', fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>User</th>
                  <th style={{ padding: '16px 24px', fontWeight: '600', fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Queries</th>
                  <th style={{ padding: '16px 24px', fontWeight: '600', fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Input Tokens</th>
                  <th style={{ padding: '16px 24px', fontWeight: '600', fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Output Tokens</th>
                  <th style={{ padding: '16px 24px', fontWeight: '600', fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Avg Latency</th>
                </tr>
              </thead>
              <tbody>
                {data?.by_user.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>No usage data available.</td>
                  </tr>
                ) : (
                  data?.by_user.map((u, i) => (
                    <tr
                      key={i}
                      onClick={() => handleUserClick(u)}
                      style={{
                        borderBottom: '1px solid var(--border-default)',
                        background: 'var(--bg-card)',
                        cursor: 'pointer',
                        transition: 'background 0.15s ease'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-active)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-card)'}
                      title={`Click to view ${u.username}'s details`}
                    >
                      <td style={{ padding: '16px 24px', fontWeight: '600', color: 'var(--text-primary)' }}>
                        {u.username}
                      </td>
                      <td style={{ padding: '16px 24px', fontWeight: '500' }}>{u.queries.toLocaleString()}</td>
                      <td style={{ padding: '16px 24px', color: 'var(--text-secondary)' }}>{formatNumber(u.input_tokens)}</td>
                      <td style={{ padding: '16px 24px', color: 'var(--text-secondary)' }}>{formatNumber(u.output_tokens)}</td>
                      <td style={{ padding: '16px 24px', color: 'var(--text-secondary)' }}>{(u.avg_latency_ms / 1000).toFixed(1)}s</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Query Type Breakdown */}
        <div style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600' }}>Query Type Breakdown</h3>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)', fontWeight: '500' }}>
              {(data?.by_type?.reduce((acc, t) => acc + t.count, 0) || 0).toLocaleString()} queries
            </span>
          </div>

          {data?.by_type.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1, justifyContent: 'center' }}>

              {/* Donut Chart with Centered Total Metric */}
              <div style={{ position: 'relative', width: '100%', height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={data.by_type}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="count"
                      nameKey="type"
                    >
                      {data.by_type.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      contentStyle={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)', borderRadius: '8px', color: 'var(--text-primary)', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                      itemStyle={{ color: 'var(--text-primary)' }}
                      formatter={(value: any, name: any) => [
                        `${value.toLocaleString()} queries (${data.by_type.find(t => t.type === name)?.percentage || 0}%)`,
                        formatQueryType(name)
                      ]}
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
                  justifyContent: 'center'
                }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total</span>
                  <span style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', lineHeight: 1.1 }}>
                    {formatNumber(data.by_type.reduce((acc, t) => acc + t.count, 0))}
                  </span>
                </div>
              </div>

              {/* Clean Breakdown List */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
                {data.by_type.map((entry, index) => {
                  const displayType = formatQueryType(entry.type);
                  const color = COLORS[index % COLORS.length];
                  return (
                    <div
                      key={entry.type}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '6px 10px',
                        borderRadius: '8px',
                        background: 'var(--bg-active)',
                        transition: 'background 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, flexShrink: 0 }} />
                        <span style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {displayType}
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                        <span style={{ color: 'var(--text-muted)', fontSize: '12px', fontWeight: 500 }}>
                          {entry.count.toLocaleString()}
                        </span>
                        <span style={{
                          color: color,
                          fontWeight: 600,
                          background: `${color}18`,
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          minWidth: '40px',
                          textAlign: 'center'
                        }}>
                          {entry.percentage}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

            </div>
          ) : (
            <div style={{ height: '240px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
              No breakdown data.
            </div>
          )}
        </div>

      </div>

      {selectedUserId && (
        <AdminUserDetail
          userId={selectedUserId}
          onClose={() => setSelectedUserId(null)}
          onUpdate={() => fetchUsage()}
        />
      )}

    </div>
  );
}
