import { useState, useEffect } from 'react';
import { Shield, Activity, Key, ShieldAlert, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { CircleBuffer } from '@/components/CircleBuffer';

export default function AdminAudit() {
  const [activeTab, setActiveTab] = useState<'logs' | 'sessions' | 'failed'>('logs');
  
  const [logs, setLogs] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [failedLogins, setFailedLogins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError('');
      if (activeTab === 'logs') {
        const res = await api.getAdminAuditLogs();
        setLogs(res.items);
      } else if (activeTab === 'sessions') {
        const res = await api.getAdminSessions();
        setSessions(res.items);
      } else if (activeTab === 'failed') {
        const res = await api.getAdminFailedLogins();
        setFailedLogins(res.items);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    if (!confirm('Are you sure you want to revoke this session?')) return;
    try {
      await api.deleteAdminSession(sessionId);
      setSessions(s => s.filter(x => x.id !== sessionId));
    } catch (err: any) {
      alert('Failed to revoke session: ' + err.message);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString(undefined, { 
      year: 'numeric', month: 'short', day: 'numeric', 
      hour: '2-digit', minute: '2-digit', second: '2-digit' 
    });
  };

  const AUDIT_TABS = [
    { id: 'logs' as const, label: 'Audit Logs', icon: Activity, color: 'var(--accent-blue)' },
    { id: 'sessions' as const, label: 'Active Sessions', icon: Key, color: 'var(--accent-green)' },
    { id: 'failed' as const, label: 'Failed Logins', icon: ShieldAlert, color: 'var(--accent-red)' },
  ];

  return (
    <div style={{ flex: 1, width: '100%',  boxSizing: 'border-box', animation: 'fadeIn 0.3s ease-out' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '16px',
          background: 'rgba(239, 68, 68, 0.1)',
          color: '#ef4444',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          <Shield size={24} />
        </div>
        <div>
          <h1 style={{ 
            fontSize: '28px', 
            fontWeight: '700', 
            color: 'var(--text-primary)', 
            margin: 0
          }}>
            Audit & Security
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: '4px 0 0 0' }}>
            Monitor system activity, active sessions, and security events.
          </p>
        </div>
      </div>

      {/* Tabs - Styled like Documents tab bar */}
      <div style={{ 
        display: 'inline-flex', 
        alignItems: 'center',
        gap: '6px', 
        marginBottom: '24px', 
        background: 'var(--bg-card)', 
        padding: '4px', 
        borderRadius: '12px', 
        border: '1px solid var(--border-default)',
        maxWidth: '100%',
        overflowX: 'auto'
      }}>
        {AUDIT_TABS.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.background = 'var(--bg-active)';
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.background = 'transparent';
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '7px 16px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: isActive ? '600' : '500',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                background: isActive ? tab.color : 'transparent',
                color: isActive ? '#ffffff' : 'var(--text-secondary)',
                border: 'none',
                whiteSpace: 'nowrap'
              }}
            >
              <tab.icon size={15} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {error && (
        <div style={{
          marginBottom: '24px',
          padding: '16px',
          background: '#FEF2F2',
          color: '#EF4444',
          borderRadius: '12px',
          border: '1px solid #FEE2E2',
          fontSize: '14px'
        }}>
          {error}
        </div>
      )}

      {/* Content */}
      <div style={{ 
        background: 'var(--bg-card)', 
        borderRadius: '12px', 
        border: '1px solid var(--border-default)', 
        overflow: 'hidden' 
      }}>
        {loading ? (
          <CircleBuffer minHeight={260} size={36} />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            {activeTab === 'logs' && (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-default)', background: 'var(--bg-active)' }}>
                    <th style={{ padding: '16px 24px', fontWeight: '600', fontSize: '11px', letterSpacing: '0.5px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Time</th>
                    <th style={{ padding: '16px 24px', fontWeight: '600', fontSize: '11px', letterSpacing: '0.5px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Actor</th>
                    <th style={{ padding: '16px 24px', fontWeight: '600', fontSize: '11px', letterSpacing: '0.5px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Action</th>
                    <th style={{ padding: '16px 24px', fontWeight: '600', fontSize: '11px', letterSpacing: '0.5px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Target</th>
                    <th style={{ padding: '16px 24px', fontWeight: '600', fontSize: '11px', letterSpacing: '0.5px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>IP Address</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.length === 0 ? (
                    <tr><td colSpan={5} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>No logs found.</td></tr>
                  ) : logs.map((log) => (
                    <tr key={log.id} style={{ borderBottom: '1px solid var(--border-default)', background: 'var(--bg-card)' }}>
                      <td style={{ padding: '16px 24px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{formatDate(log.created_at)}</td>
                      <td style={{ padding: '16px 24px' }}>
                        {log.actor_username ? (
                          <span style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{log.actor_username}</span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>System / Unknown</span>
                        )}
                      </td>
                      <td style={{ padding: '16px 24px' }}>
                        <span style={{ 
                          display: 'inline-block', 
                          padding: '4px 8px', 
                          background: 'var(--bg-active)', 
                          color: 'var(--text-primary)', 
                          borderRadius: '6px', 
                          fontSize: '12px', 
                          fontWeight: '600' 
                        }}>
                          {log.action}
                        </span>
                      </td>
                      <td style={{ padding: '16px 24px', color: 'var(--text-secondary)', maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={log.target_label}>
                        {log.target_label || '-'}
                        {log.target_type && <span style={{ marginLeft: '8px', fontSize: '12px', color: 'var(--text-muted)' }}>({log.target_type})</span>}
                      </td>
                      <td style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: '12px' }}>{log.ip_address || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {activeTab === 'sessions' && (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-default)', background: 'var(--bg-active)' }}>
                    <th style={{ padding: '16px 24px', fontWeight: '600', fontSize: '11px', letterSpacing: '0.5px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>User</th>
                    <th style={{ padding: '16px 24px', fontWeight: '600', fontSize: '11px', letterSpacing: '0.5px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>IP Address</th>
                    <th style={{ padding: '16px 24px', fontWeight: '600', fontSize: '11px', letterSpacing: '0.5px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>User Agent</th>
                    <th style={{ padding: '16px 24px', fontWeight: '600', fontSize: '11px', letterSpacing: '0.5px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Created</th>
                    <th style={{ padding: '16px 24px', fontWeight: '600', fontSize: '11px', letterSpacing: '0.5px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Expires</th>
                    <th style={{ padding: '16px 24px', fontWeight: '600', fontSize: '11px', letterSpacing: '0.5px', color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.length === 0 ? (
                    <tr><td colSpan={6} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>No active sessions found.</td></tr>
                  ) : sessions.map((s) => (
                    <tr key={s.id} style={{ borderBottom: '1px solid var(--border-default)', background: 'var(--bg-card)' }}>
                      <td style={{ padding: '16px 24px', fontWeight: '500', color: 'var(--text-primary)' }}>{s.username}</td>
                      <td style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: '12px' }}>{s.ip_address || '-'}</td>
                      <td style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontSize: '12px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.user_agent}>{s.user_agent || '-'}</td>
                      <td style={{ padding: '16px 24px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{formatDate(s.created_at)}</td>
                      <td style={{ padding: '16px 24px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{formatDate(s.expires_at)}</td>
                      <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                        <button
                          onClick={() => handleRevokeSession(s.id)}
                          style={{
                            width: '32px', height: '32px', borderRadius: '8px',
                            border: '1px solid #FEE2E2', background: '#FEF2F2',
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', color: '#EF4444',
                            transition: 'all 0.2s'
                          }}
                          title="Revoke Session"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {activeTab === 'failed' && (
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-default)', background: 'var(--bg-active)' }}>
                    <th style={{ padding: '16px 24px', fontWeight: '600', fontSize: '11px', letterSpacing: '0.5px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Time</th>
                    <th style={{ padding: '16px 24px', fontWeight: '600', fontSize: '11px', letterSpacing: '0.5px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Username Attempted</th>
                    <th style={{ padding: '16px 24px', fontWeight: '600', fontSize: '11px', letterSpacing: '0.5px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>IP Address</th>
                    <th style={{ padding: '16px 24px', fontWeight: '600', fontSize: '11px', letterSpacing: '0.5px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>User Agent</th>
                  </tr>
                </thead>
                <tbody>
                  {failedLogins.length === 0 ? (
                    <tr><td colSpan={4} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>No failed logins recorded.</td></tr>
                  ) : failedLogins.map((f) => (
                    <tr key={f.id} style={{ borderBottom: '1px solid var(--border-default)', background: 'var(--bg-card)' }}>
                      <td style={{ padding: '16px 24px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{formatDate(f.created_at)}</td>
                      <td style={{ padding: '16px 24px', fontWeight: '500', color: '#EF4444' }}>{f.username_attempted}</td>
                      <td style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: '12px' }}>{f.ip_address}</td>
                      <td style={{ padding: '16px 24px', color: 'var(--text-secondary)', fontSize: '12px', maxWidth: '300px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={f.user_agent}>{f.user_agent || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
