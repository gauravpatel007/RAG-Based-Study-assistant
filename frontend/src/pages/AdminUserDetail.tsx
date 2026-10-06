import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { CircleBuffer } from '@/components/CircleBuffer';
import { ImageModal } from '@/components/ImageModal';
import { 
  X, Mail, Calendar, Activity, FileText, MessageSquare, 
  Brain, HardDrive, ShieldAlert, LogOut, RefreshCw, Edit3, Trash2, Shield, User
} from 'lucide-react';
import { AreaChart, Area, XAxis, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';

interface AdminUserDetailProps {
  userId: string;
  onClose: () => void;
  onUpdate: () => void;
}

export default function AdminUserDetail({ userId, onClose, onUpdate }: AdminUserDetailProps) {
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  
  const [isEditingQuota, setIsEditingQuota] = useState(false);
  const [quotaInput, setQuotaInput] = useState('');

  useEffect(() => {
    fetchDetail();
  }, [userId]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const fetchDetail = async () => {
    try {
      setLoading(true);
      const res = await api.getAdminUserDetail(userId);
      setDetail(res);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action: () => Promise<any>) => {
    try {
      await action();
      await fetchDetail();
      onUpdate();
    } catch (err: any) {
      alert(err.message || 'Action failed');
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (loading) {
    return (
      <div 
        onClick={onClose}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
      >
        <div 
          onClick={(e) => e.stopPropagation()}
          style={{ background: 'var(--bg-card)', padding: '32px', borderRadius: '16px', color: 'var(--text-primary)', border: '1px solid var(--border-default)' }}
        >
          <CircleBuffer minHeight={60} size={36} />
        </div>
      </div>
    );
  }

  if (!detail) return null;

  const storageUsed = detail.stats.storage_used_bytes || 0;
  const storageQuota = detail.stats.storage_quota_bytes;
  const storagePct = storageQuota ? Math.min(100, Math.round((storageUsed / storageQuota) * 100)) : 0;
  const isSoftDeleted = !!detail.deleted_at;

  return (
    <div 
      onClick={onClose}
      style={{ 
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '24px'
      }}
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        style={{ 
          background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-default)',
          width: '100%', maxWidth: '900px', maxHeight: '90vh', display: 'flex', flexDirection: 'column',
          boxShadow: '0 20px 40px rgba(0,0,0,0.2)', overflow: 'hidden'
        }}
      >
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid var(--border-default)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: 'rgba(59, 130, 246, 0.1)',
              color: '#3b82f6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <User size={20} />
            </div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)' }}>User Details</h2>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', padding: '4px', borderRadius: '6px' }}><X size={22} /></button>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          
          {/* Left Column */}
          <div style={{ flex: 1, padding: '24px', overflowY: 'auto', borderRight: '1px solid var(--border-default)' }}>
            
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
              <div 
                style={{ 
                  width: '68px', 
                  height: '68px', 
                  borderRadius: '50%', 
                  background: 'var(--bg-active)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  color: 'var(--text-primary)',
                  fontWeight: '700',
                  fontSize: '24px',
                  overflow: 'hidden', 
                  position: 'relative',
                  border: '2px solid var(--border-default)',
                  cursor: detail.avatar_url ? 'pointer' : 'default',
                  flexShrink: 0,
                  boxShadow: detail.avatar_url ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease'
                }}
                onClick={() => {
                  if (detail.avatar_url) {
                    setIsImageModalOpen(true);
                  }
                }}
                onMouseEnter={(e) => {
                  if (detail.avatar_url) {
                    e.currentTarget.style.transform = 'scale(1.05)';
                    e.currentTarget.style.boxShadow = '0 4px 14px rgba(0,0,0,0.15)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (detail.avatar_url) {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)';
                  }
                }}
                title={detail.avatar_url ? "Click to view full image" : undefined}
              >
                {detail.avatar_url ? (
                  <img 
                    src={detail.avatar_url} 
                    alt={detail.username} 
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                  />
                ) : (
                  (detail.display_name?.charAt(0) || detail.username?.charAt(0) || 'U').toUpperCase()
                )}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <h3 style={{ margin: 0, fontSize: '24px', fontWeight: '700', color: 'var(--text-primary)' }}>{detail.username}</h3>
                  {isSoftDeleted ? (
                    <span style={{ padding: '4px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: '600', background: 'rgba(239, 68, 68, 0.1)', color: '#EF4444' }}>Deleted</span>
                  ) : detail.is_active ? (
                    <span style={{ padding: '4px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: '600', background: 'rgba(16, 185, 129, 0.1)', color: '#10B981' }}>Active</span>
                  ) : (
                    <span style={{ padding: '4px 8px', borderRadius: '12px', fontSize: '12px', fontWeight: '600', background: 'rgba(245, 158, 11, 0.1)', color: '#F59E0B' }}>Disabled</span>
                  )}
                </div>
                <div style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '14px' }}>
                  <Mail size={14} /> {detail.email || 'No email provided'}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '32px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px solid var(--border-default)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '14px' }}><Calendar size={16} /> Joined</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>{new Date(detail.created_at).toLocaleDateString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px solid var(--border-default)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '14px' }}><Activity size={16} /> Last Active</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>{detail.last_active ? new Date(detail.last_active).toLocaleString() : 'Never'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px solid var(--border-default)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '14px' }}><FileText size={16} /> Documents</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>{detail.stats.documents}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px solid var(--border-default)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '14px' }}><MessageSquare size={16} /> Chats</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>{detail.stats.chats}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '12px', borderBottom: '1px solid var(--border-default)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '14px' }}><Brain size={16} /> AI Queries</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>{detail.stats.queries}</span>
              </div>
            </div>

            <div style={{ marginBottom: '32px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '14px' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)' }}><HardDrive size={16} /> Storage</span>
                <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>{formatBytes(storageUsed)} / {formatBytes(storageQuota)}</span>
              </div>
              <div style={{ width: '100%', height: '8px', borderRadius: '4px', background: 'var(--bg-active)', overflow: 'hidden' }}>
                <div style={{ width: `${storagePct}%`, height: '100%', background: storagePct > 90 ? '#EF4444' : '#10B981', borderRadius: '4px' }}></div>
              </div>
            </div>

            <div>
              <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', color: 'var(--text-secondary)', fontWeight: '600' }}>AI Usage (Last 30 Days)</h4>
              {detail.ai_usage.length > 0 ? (
                <div style={{ height: '100px', width: '100%', marginLeft: '-20px' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={detail.ai_usage}>
                      <defs>
                        <linearGradient id="colorUsg" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#7c3aed" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="date" hide />
                      <RechartsTooltip 
                        contentStyle={{ background: 'var(--bg-card)', borderColor: 'var(--border-default)', borderRadius: '8px' }}
                        labelFormatter={(l: any) => new Date(l as string).toLocaleDateString()}
                      />
                      <Area type="monotone" dataKey="queries" stroke="#7c3aed" fillOpacity={1} fill="url(#colorUsg)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>No usage in last 30 days.</div>
              )}
            </div>

          </div>

          {/* Right Column (Actions) */}
          <div style={{ width: '320px', padding: '24px', overflowY: 'auto', background: 'var(--bg-active)' }}>
            <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Access Management</h4>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
              <button 
                onClick={() => handleAction(() => api.updateAdminUser(userId, { is_active: !detail.is_active }))}
                style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: '500', transition: 'all 0.2s' }}
              >
                <ShieldAlert size={18} color={detail.is_active ? "#F59E0B" : "#10B981"} />
                {detail.is_active ? 'Disable Account' : 'Enable Account'}
              </button>
              
              <button 
                onClick={() => handleAction(() => api.adminForceLogout(userId))}
                disabled={detail.active_sessions === 0}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-primary)', cursor: detail.active_sessions === 0 ? 'not-allowed' : 'pointer', fontWeight: '500', opacity: detail.active_sessions === 0 ? 0.5 : 1 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><LogOut size={18} color="#6366F1" /> Force Logout</div>
                <span style={{ fontSize: '12px', background: '#6366F1', color: 'white', padding: '2px 8px', borderRadius: '12px' }}>{detail.active_sessions}</span>
              </button>
            </div>

            <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Storage Management</h4>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
              {isEditingQuota ? (
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <input 
                    type="number" 
                    value={quotaInput} 
                    onChange={e => setQuotaInput(e.target.value)} 
                    placeholder="Bytes" 
                    style={{ minWidth: 0, flex: 1, padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--border-default)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '13px' }}
                  />
                  <button onClick={() => {
                    handleAction(() => api.adminSetQuota(userId, parseInt(quotaInput)));
                    setIsEditingQuota(false);
                  }} style={{ padding: '8px 12px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>Save</button>
                  <button onClick={() => setIsEditingQuota(false)} style={{ padding: '8px 12px', background: 'var(--bg-card)', color: 'var(--text-primary)', border: '1px solid var(--border-default)', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>Cancel</button>
                </div>
              ) : (
                <button 
                  onClick={() => { setQuotaInput(detail.storage_quota_bytes ? String(detail.storage_quota_bytes) : ''); setIsEditingQuota(true); }}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: '500' }}
                >
                  <Edit3 size={18} color="#8B5CF6" /> Set Custom Quota
                </button>
              )}

              {detail.storage_quota_bytes && (
                <button 
                  onClick={() => handleAction(() => api.adminResetQuota(userId))}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: '500' }}
                >
                  <RefreshCw size={18} color="#10B981" /> Reset to Global Default
                </button>
              )}
            </div>

            <h4 style={{ margin: '0 0 16px 0', fontSize: '14px', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Destructive Actions</h4>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {isSoftDeleted ? (
                <button 
                  onClick={() => handleAction(() => api.adminRestoreUser(userId))}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: 'var(--bg-card)', border: '1px solid var(--border-default)', borderRadius: '8px', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: '500' }}
                >
                  <Shield size={18} color="#10B981" /> Restore Account
                </button>
              ) : (
                <button 
                  onClick={() => {
                    if(window.confirm('Are you sure you want to soft-delete this user? They will not be able to log in.')) {
                      handleAction(() => api.adminSoftDelete(userId));
                    }
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '8px', color: '#EF4444', cursor: 'pointer', fontWeight: '600' }}
                >
                  <Trash2 size={18} /> Soft-Delete Account
                </button>
              )}

              <button 
                onClick={() => {
                  if(window.confirm('PERMANENTLY DELETE user? This deletes all their chats and documents and cannot be undone.')) {
                    api.deleteAdminUser(userId).then(() => {
                      onUpdate();
                      onClose();
                    }).catch((err: any) => alert(err.message));
                  }
                }}
                style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: '#EF4444', border: '1px solid #DC2626', borderRadius: '8px', color: 'white', cursor: 'pointer', fontWeight: '600' }}
              >
                <Trash2 size={18} /> Permanently Delete
              </button>
            </div>
            
          </div>
        </div>
      </div>

      {detail?.avatar_url && (
        <ImageModal
          isOpen={isImageModalOpen}
          onClose={() => setIsImageModalOpen(false)}
          imageUrl={detail.avatar_url}
          altText={`${detail.username}'s Avatar`}
        />
      )}
    </div>
  );
}
