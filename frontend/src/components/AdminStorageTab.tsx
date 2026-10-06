import { useState, useEffect } from 'react';
import { 
  HardDrive, 
  Database, 
  Server, 
  FileText, 
  Trash2, 
  AlertTriangle, 
  X,
  Sparkles,
  Clock,
  FileQuestion,
  ShieldAlert,
  Calendar
} from 'lucide-react';
import { api } from '@/lib/api';
import { CircleBuffer } from '@/components/CircleBuffer';

export default function AdminStorageTab() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Clean soft-deleted specific
  const [daysOld, setDaysOld] = useState<number>(30);

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    desc: string;
    action: () => Promise<void>;
  } | null>(null);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const res = await api.getAdminStorageStats();
      setStats(res);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to fetch storage stats');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const formatStorage = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const wrapAction = (title: string, desc: string, actionFn: () => Promise<void>) => {
    setConfirmModal({
      isOpen: true,
      title,
      desc,
      action: async () => {
        try {
          await actionFn();
          await fetchStats();
        } catch (e: any) {
          alert('Action failed: ' + e.message);
        } finally {
          setConfirmModal(null);
        }
      }
    });
  };

  const handleCleanTemp = () => wrapAction(
    'Clean Temporary Files',
    'This will delete all temporary files (.tmp, .ocr) from the uploads directory. Active OCR jobs may be affected. Are you sure?',
    async () => {
      const res = await api.adminCleanupTemp();
      alert(`Success: Deleted ${res.deleted_files} files, freed ${formatStorage(res.freed_bytes)}.`);
    }
  );

  const handleCleanJobs = () => wrapAction(
    'Prune Expired Jobs',
    'This will permanently delete job history older than 7 days from PostgreSQL. Background tasks will lose completed status history. Proceed?',
    async () => {
      const res = await api.adminCleanupJobs();
      alert(`Success: Pruned ${res.deleted_jobs} expired job records.`);
    }
  );

  const handleCleanOrphans = () => wrapAction(
    'Clear Orphaned Documents',
    'This will scan physical PDF files in the uploads directory and delete any files that no longer have a matching database record. Proceed?',
    async () => {
      const res = await api.adminCleanupOrphans();
      alert(`Success: Deleted ${res.deleted_files} orphaned files, freed ${formatStorage(res.freed_bytes)}.`);
    }
  );

  const handleCleanSoftDeleted = () => wrapAction(
    'Purge Soft-Deleted Records',
    `This will permanently purge database records (chats, documents) that were marked as deleted more than ${daysOld} days ago. This action is irreversible.`,
    async () => {
      const res = await api.adminCleanupSoftDeleted(daysOld);
      alert(`Success: Permanently deleted ${res.deleted_chats} chats and ${res.deleted_docs} documents.`);
    }
  );

  if (loading && !stats) return <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}><CircleBuffer /></div>;
  if (error) return <div style={{ color: 'var(--accent-red)', padding: '20px', background: 'rgba(239, 68, 68, 0.08)', borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>{error}</div>;
  if (!stats) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      {/* 1. Storage Overview */}
      <div>
        <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: '700' }}>Disk Usage Overview</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '16px' }}>
          <StatCard label="PDF Documents" value={formatStorage(stats.overview.pdf_size_bytes)} icon={<FileText size={22} strokeWidth={2.2} />} color="#3b82f6" />
          <StatCard label="Vector Database" value={formatStorage(stats.overview.chroma_size_bytes)} icon={<Database size={22} strokeWidth={2.2} />} color="#8b5cf6" />
          <StatCard label="PostgreSQL" value={formatStorage(stats.overview.postgres_size_bytes)} icon={<Server size={22} strokeWidth={2.2} />} color="#10b981" />
          <StatCard label="Temporary / OCR" value={formatStorage(stats.overview.temp_size_bytes)} icon={<HardDrive size={22} strokeWidth={2.2} />} color="#f59e0b" />
          <div style={{
            background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', color: '#fff', padding: '24px', borderRadius: '20px', 
            display: 'flex', flexDirection: 'column', gap: '16px', 
            boxShadow: '0 8px 24px rgba(37, 99, 235, 0.25)', cursor: 'default'
          }} className="stat-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{
                width: '44px',
                height: '44px',
                borderRadius: '14px',
                background: 'rgba(255, 255, 255, 0.2)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <HardDrive size={22} strokeWidth={2.2} />
              </div>
              <div style={{ fontSize: '12px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.8px', opacity: 0.9 }}>Total Storage</div>
            </div>
            <div style={{ fontSize: '28px', fontWeight: '800', lineHeight: 1 }}>{formatStorage(stats.overview.total_size_bytes)}</div>
          </div>
        </div>
      </div>

      {/* 2. Detailed Metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '24px' }}>
        <div style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-default)', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)' }}>
          <h4 style={{ margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '16px', fontWeight: '700' }}>
            <div style={{ padding: '8px', borderRadius: '10px', background: 'rgba(139, 92, 246, 0.1)', color: '#8b5cf6', display: 'flex' }}>
              <Database size={18} />
            </div>
            ChromaDB Details
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <DetailRow label="Collections" value={stats.chromadb.collections_count} />
            <DetailRow label="Total Vector Count" value={stats.chromadb.vector_count.toLocaleString()} />
            <DetailRow label="Index Size on Disk" value={formatStorage(stats.chromadb.index_size_bytes)} />
            <DetailRow label="Embedding Dimension" value={stats.chromadb.embedding_dimension} />
            <DetailRow label="Orphaned Vectors" value={stats.chromadb.orphaned_vectors} />
          </div>
        </div>

        <div style={{ background: 'var(--bg-card)', padding: '24px', borderRadius: '16px', border: '1px solid var(--border-default)', boxShadow: '0 4px 20px rgba(0, 0, 0, 0.02)' }}>
          <h4 style={{ margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '16px', fontWeight: '700' }}>
            <div style={{ padding: '8px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', display: 'flex' }}>
              <Server size={18} />
            </div>
            PostgreSQL Details
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <DetailRow label="Database Size" value={formatStorage(stats.postgres.database_size_bytes)} />
            <DetailRow label="Total Users" value={stats.postgres.counts.users.toLocaleString()} />
            <DetailRow label="Total Chats" value={stats.postgres.counts.chats.toLocaleString()} />
            <DetailRow label="Total Messages" value={stats.postgres.counts.messages.toLocaleString()} />
            <DetailRow label="Total Documents" value={stats.postgres.counts.documents.toLocaleString()} />
            <DetailRow label="Audit Entries" value={stats.postgres.counts.audit_entries.toLocaleString()} />
          </div>
        </div>
      </div>

      {/* 3. Cleanup & Maintenance Actions */}
      <div style={{
        background: 'var(--bg-card)',
        padding: '28px',
        borderRadius: '20px',
        border: '1px solid var(--border-default)',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', paddingBottom: '16px', borderBottom: '1px solid var(--border-default)' }}>
          <div>
            <h3 style={{ margin: '0 0 6px 0', fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}>
              Cleanup Actions
            </h3>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
              Perform maintenance tasks to reclaim disk space, clean temporary files, and purge obsolete records.
            </p>
          </div>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            borderRadius: '20px',
            background: 'rgba(239, 68, 68, 0.08)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            color: '#ef4444',
            fontSize: '12px',
            fontWeight: '600'
          }}>
            <ShieldAlert size={14} />
            Confirmation Required
          </div>
        </div>

        {/* Action Items List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          {/* 1. Clean Temp Files */}
          <div 
            style={{
              background: 'var(--bg-canvas)',
              border: '1px solid var(--border-default)',
              borderRadius: '14px',
              padding: '18px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '20px',
              flexWrap: 'wrap',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.4)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--border-default)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: '240px' }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'rgba(245, 158, 11, 0.12)',
                color: '#f59e0b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Sparkles size={20} />
              </div>
              <div>
                <div style={{ fontWeight: '600', fontSize: '15px', color: 'var(--text-primary)', marginBottom: '3px' }}>
                  Clean temporary files
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  Removes all cached <code style={{ fontSize: '12px', padding: '2px 5px', background: 'var(--bg-active)', borderRadius: '4px' }}>.tmp</code> and OCR intermediate artifacts in the uploads folder.
                </div>
              </div>
            </div>
            <button 
              onClick={handleCleanTemp}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 18px',
                borderRadius: '10px',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                background: 'rgba(245, 158, 11, 0.08)',
                color: '#d97706',
                fontWeight: '600',
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                whiteSpace: 'nowrap'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = '#d97706';
                e.currentTarget.style.color = '#ffffff';
                e.currentTarget.style.borderColor = '#d97706';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(245, 158, 11, 0.08)';
                e.currentTarget.style.color = '#d97706';
                e.currentTarget.style.borderColor = 'rgba(245, 158, 11, 0.3)';
              }}
            >
              <Sparkles size={15} /> Clean Temp Files
            </button>
          </div>

          {/* 2. Prune Expired Jobs */}
          <div 
            style={{
              background: 'var(--bg-canvas)',
              border: '1px solid var(--border-default)',
              borderRadius: '14px',
              padding: '18px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '20px',
              flexWrap: 'wrap',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.4)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--border-default)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: '240px' }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'rgba(139, 92, 246, 0.12)',
                color: '#8b5cf6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Clock size={20} />
              </div>
              <div>
                <div style={{ fontWeight: '600', fontSize: '15px', color: 'var(--text-primary)', marginBottom: '3px' }}>
                  Delete expired jobs
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  Prunes background processing job records older than 7 days from PostgreSQL.
                </div>
              </div>
            </div>
            <button 
              onClick={handleCleanJobs}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 18px',
                borderRadius: '10px',
                border: '1px solid rgba(139, 92, 246, 0.3)',
                background: 'rgba(139, 92, 246, 0.08)',
                color: '#7c3aed',
                fontWeight: '600',
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                whiteSpace: 'nowrap'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = '#7c3aed';
                e.currentTarget.style.color = '#ffffff';
                e.currentTarget.style.borderColor = '#7c3aed';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(139, 92, 246, 0.08)';
                e.currentTarget.style.color = '#7c3aed';
                e.currentTarget.style.borderColor = 'rgba(139, 92, 246, 0.3)';
              }}
            >
              <Clock size={15} /> Delete Jobs
            </button>
          </div>

          {/* 3. Clear Orphaned Documents */}
          <div 
            style={{
              background: 'var(--bg-canvas)',
              border: '1px solid var(--border-default)',
              borderRadius: '14px',
              padding: '18px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '20px',
              flexWrap: 'wrap',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.4)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--border-default)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: '240px' }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'rgba(59, 130, 246, 0.12)',
                color: '#3b82f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <FileQuestion size={20} />
              </div>
              <div>
                <div style={{ fontWeight: '600', fontSize: '15px', color: 'var(--text-primary)', marginBottom: '3px' }}>
                  Clear orphaned document data
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                  Scans and removes disk files whose document entries were removed from the database.
                </div>
              </div>
            </div>
            <button 
              onClick={handleCleanOrphans}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 18px',
                borderRadius: '10px',
                border: '1px solid rgba(59, 130, 246, 0.3)',
                background: 'rgba(59, 130, 246, 0.08)',
                color: '#2563eb',
                fontWeight: '600',
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                whiteSpace: 'nowrap'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = '#2563eb';
                e.currentTarget.style.color = '#ffffff';
                e.currentTarget.style.borderColor = '#2563eb';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(59, 130, 246, 0.08)';
                e.currentTarget.style.color = '#2563eb';
                e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)';
              }}
            >
              <FileQuestion size={15} /> Clear Orphans
            </button>
          </div>

          {/* 4. Purge Soft-Deleted Records */}
          <div 
            style={{
              background: 'var(--bg-canvas)',
              border: '1px solid var(--border-default)',
              borderRadius: '14px',
              padding: '18px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '20px',
              flexWrap: 'wrap',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--border-default)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: '240px' }}>
              <div style={{
                width: '42px',
                height: '42px',
                borderRadius: '12px',
                background: 'rgba(239, 68, 68, 0.12)',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Trash2 size={20} />
              </div>
              <div>
                <div style={{ fontWeight: '600', fontSize: '15px', color: 'var(--text-primary)', marginBottom: '3px' }}>
                  Clean soft-deleted files
                </div>
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.4, marginBottom: '8px' }}>
                  Permanently purges chats and documents marked as deleted older than the specified retention window.
                </div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: 'var(--bg-card)', padding: '4px 10px', borderRadius: '8px', border: '1px solid var(--border-default)' }}>
                  <Calendar size={13} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '500' }}>Older than</span>
                  <input 
                    type="number" 
                    min={1}
                    max={365}
                    value={daysOld} 
                    onChange={e => setDaysOld(Math.max(1, Number(e.target.value) || 1))}
                    style={{
                      width: '46px',
                      padding: '2px 4px',
                      borderRadius: '6px',
                      border: '1px solid var(--border-default)',
                      background: 'var(--bg-canvas)',
                      color: 'var(--text-primary)',
                      textAlign: 'center',
                      fontWeight: '700',
                      fontSize: '13px'
                    }}
                  />
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '500' }}>days</span>
                </div>
              </div>
            </div>
            <button 
              onClick={handleCleanSoftDeleted}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 18px',
                borderRadius: '10px',
                border: '1px solid rgba(239, 68, 68, 0.35)',
                background: 'rgba(239, 68, 68, 0.08)',
                color: '#ef4444',
                fontWeight: '600',
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                whiteSpace: 'nowrap'
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = '#ef4444';
                e.currentTarget.style.color = '#ffffff';
                e.currentTarget.style.borderColor = '#ef4444';
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)';
                e.currentTarget.style.color = '#ef4444';
                e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.35)';
              }}
            >
              <Trash2 size={15} /> Purge Deleted
            </button>
          </div>

        </div>
      </div>

      {/* Confirmation Modal */}
      {confirmModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(5px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px'
        }}>
          <div style={{
            background: 'var(--bg-card)', padding: '28px', borderRadius: '20px', width: '100%', maxWidth: '440px',
            boxShadow: '0 20px 30px -10px rgba(0, 0, 0, 0.25)',
            border: '1px solid var(--border-default)', animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ padding: '10px', background: 'rgba(239, 68, 68, 0.12)', color: '#ef4444', borderRadius: '12px', display: 'flex' }}>
                  <AlertTriangle size={22} />
                </div>
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}>{confirmModal.title}</h3>
              </div>
              <button onClick={() => setConfirmModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px' }}>
                <X size={20} />
              </button>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: 1.5, marginBottom: '24px' }}>
              {confirmModal.desc}
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmModal(null)} style={{
                padding: '10px 18px', borderRadius: '10px', border: '1px solid var(--border-default)', background: 'transparent',
                color: 'var(--text-primary)', fontWeight: '600', fontSize: '14px', cursor: 'pointer'
              }}>Cancel</button>
              <button onClick={confirmModal.action} style={{
                padding: '10px 18px', borderRadius: '10px', border: 'none', background: '#ef4444',
                color: '#fff', fontWeight: '600', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px',
                boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)'
              }}><Trash2 size={16} /> Confirm & Execute</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const StatCard = ({ label, value, color, icon }: { label: string, value: string, color: string, icon: React.ReactNode }) => (
  <div className="stat-card" style={{
    background: 'var(--bg-card)', padding: '24px', borderRadius: '20px', border: '1px solid var(--border-default)',
    display: 'flex', flexDirection: 'column', gap: '16px', cursor: 'default'
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
      <div style={{
        width: '44px',
        height: '44px',
        borderRadius: '14px',
        background: `color-mix(in srgb, ${color} 12%, transparent)`,
        color: color,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }}>
        {icon}
      </div>
      <div style={{ fontSize: '12px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)' }}>{label}</div>
    </div>
    <div style={{ fontSize: '28px', fontWeight: '800', color: 'var(--text-primary)', lineHeight: 1 }}>{value}</div>
  </div>
);

const DetailRow = ({ label, value }: { label: string, value: string | number }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px dashed var(--border-default)' }}>
    <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>{label}</span>
    <span style={{ color: 'var(--text-primary)', fontWeight: '600', fontSize: '14px' }}>{value}</span>
  </div>
);
