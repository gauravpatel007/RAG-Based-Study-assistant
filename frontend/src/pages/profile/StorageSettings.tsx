import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/features/auth/AuthContext';
import { HardDrive, FileText, Database, MessageSquare, Brain, Trash2, RefreshCw, Download } from 'lucide-react';
import { CircleBuffer } from '@/components/CircleBuffer';

interface StorageData {
  quota_bytes: number;
  total_used_bytes: number;
  pdf_bytes: number;
  vector_bytes: number;
  chat_bytes: number;
  study_bytes: number;
  doc_count: number;
  indexed_doc_count: number;
  chat_count: number;
  flashcard_count: number;
  quiz_count: number;
  chunk_count: number;
}

const formatBytes = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export function StorageSettings() {
  const { logout } = useAuth();
  const [data, setData] = useState<StorageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Action states
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  
  // Delete account state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');

  useEffect(() => {
    fetchStorage();
  }, []);

  const fetchStorage = async () => {
    try {
      setLoading(true);
      const res = await api.getUserStorage();
      setData(res);
    } catch (err: any) {
      setError(err.message || 'Failed to load storage data');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (action: string, apiCall: () => Promise<any>, successMsg: string) => {
    try {
      setActionLoading(action);
      await apiCall();
      setActionSuccess(successMsg);
      if (action !== 'export') {
        await fetchStorage();
      }
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleExportData = async () => {
    try {
      setActionLoading('export');
      const res = await api.exportMyData();
      if (!res.ok) throw new Error('Export failed');
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'study-assistant-export.zip';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      
      setActionSuccess('Download started');
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmPassword) return;
    
    try {
      setActionLoading('delete_account');
      await api.deleteMyAccount(confirmPassword);
      logout();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
      setActionLoading(null);
    }
  };

  if (loading && !data) {
    return <CircleBuffer minHeight={260} size={36} />;
  }

  if (error) {
    return (
      <div className="alert alert-error mb-4">
        {error}
      </div>
    );
  }

  if (!data) return null;

  const usedPct = data.quota_bytes > 0 ? (data.total_used_bytes / data.quota_bytes) * 100 : 0;
  const availableBytes = Math.max(0, data.quota_bytes - data.total_used_bytes);

  const pdfPct = data.total_used_bytes > 0 ? (data.pdf_bytes / data.total_used_bytes) * 100 : 0;
  const vectorPct = data.total_used_bytes > 0 ? (data.vector_bytes / data.total_used_bytes) * 100 : 0;
  const chatPct = data.total_used_bytes > 0 ? (data.chat_bytes / data.total_used_bytes) * 100 : 0;
  const studyPct = data.total_used_bytes > 0 ? (data.study_bytes / data.total_used_bytes) * 100 : 0;

  return (
    <div className="profile-page fade-in">
      
      <div className="profile-page-header">
        <h1>Storage & Data</h1>
        <p>Manage your account storage, downloads, and personal data.</p>
      </div>

      {actionSuccess && <div className="alert alert-success mb-4">{actionSuccess}</div>}

      {/* Storage Bar Overview */}
      <div className="profile-section">
        <h3><HardDrive size={18} /> Storage Overview</h3>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '8px' }}>
          <span style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>Storage Used</span>
          <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>
            {formatBytes(data.total_used_bytes)} / {formatBytes(data.quota_bytes)}
          </span>
        </div>
        <div style={{ width: '100%', background: 'var(--bg-canvas)', borderRadius: '999px', height: '12px', marginBottom: '8px', overflow: 'hidden' }}>
          <div 
            style={{ 
              height: '100%', 
              background: usedPct > 90 ? 'var(--color-danger)' : 'var(--color-primary)', 
              borderRadius: '999px', 
              transition: 'all 1s ease', 
              width: `${Math.min(100, Math.max(1, usedPct))}%` 
            }} 
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)' }}>
          <span>{usedPct.toFixed(1)}% used</span>
          <span>{formatBytes(availableBytes)} available</span>
        </div>
      </div>

      {/* 4 Stat Cards & Breakdown */}
      <div className="profile-section">
        <h3>Storage Breakdown</h3>
        
        {/* Breakdown bar */}
        <div style={{ width: '100%', height: '16px', borderRadius: '999px', overflow: 'hidden', display: 'flex', background: 'var(--bg-canvas)', marginBottom: '16px' }}>
          <div style={{ width: `${pdfPct}%`, background: '#3b82f6' }} title={`PDFs: ${pdfPct.toFixed(1)}%`} />
          <div style={{ width: `${vectorPct}%`, background: '#8b5cf6' }} title={`Vectors: ${vectorPct.toFixed(1)}%`} />
          <div style={{ width: `${chatPct}%`, background: '#10b981' }} title={`Chats: ${chatPct.toFixed(1)}%`} />
          <div style={{ width: `${studyPct}%`, background: '#f59e0b' }} title={`Study Data: ${studyPct.toFixed(1)}%`} />
        </div>
        
        {/* Legend */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#3b82f6' }} />
            PDF Documents ({pdfPct.toFixed(0)}%)
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#8b5cf6' }} />
            Vector Index ({vectorPct.toFixed(0)}%)
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#10b981' }} />
            Chats ({chatPct.toFixed(0)}%)
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#f59e0b' }} />
            Study Data ({studyPct.toFixed(0)}%)
          </div>
        </div>

        {/* Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          
          <div className="stat-card" style={{ background: 'var(--bg-canvas)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-default)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              <FileText size={16} /> <span style={{ fontSize: '14px', fontWeight: 500 }}>Documents</span>
            </div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--text-primary)' }}>{data.doc_count}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{formatBytes(data.pdf_bytes)}</div>
          </div>

          <div className="stat-card" style={{ background: 'var(--bg-canvas)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-default)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              <Database size={16} /> <span style={{ fontSize: '14px', fontWeight: 500 }}>Vector Data</span>
            </div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--text-primary)' }}>{formatBytes(data.vector_bytes)}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{data.chunk_count.toLocaleString()} chunks</div>
          </div>

          <div className="stat-card" style={{ background: 'var(--bg-canvas)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-default)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              <MessageSquare size={16} /> <span style={{ fontSize: '14px', fontWeight: 500 }}>Chat Data</span>
            </div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--text-primary)' }}>{formatBytes(data.chat_bytes)}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{data.chat_count} chats</div>
          </div>

          <div className="stat-card" style={{ background: 'var(--bg-canvas)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-default)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', marginBottom: '8px' }}>
              <Brain size={16} /> <span style={{ fontSize: '14px', fontWeight: 500 }}>Study Data</span>
            </div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--text-primary)' }}>{formatBytes(data.study_bytes)}</div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{data.flashcard_count} cards, {data.quiz_count} qs</div>
          </div>

        </div>
      </div>

      {/* Actions */}
      <div className="profile-section">
        <h3>Data Management</h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '16px', borderBottom: '1px solid var(--border-default)' }}>
            <div>
              <div style={{ fontWeight: 500, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Database size={16} /> Rebuild Vector Index
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Re-process all documents to improve AI retrieval.
              </div>
            </div>
            <button 
              className="btn btn-secondary"
              onClick={() => handleAction('rebuild', () => api.rebuildVectorIndex(), 'Index rebuild queued')}
              disabled={actionLoading !== null}
            >
              {actionLoading === 'rebuild' && <RefreshCw size={14} className="animate-spin" />}
              Rebuild Index
            </button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '16px', borderBottom: '1px solid var(--border-default)' }}>
            <div>
              <div style={{ fontWeight: 500, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <MessageSquare size={16} /> Clear Chat History
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Delete all your chat conversations permanently.
              </div>
            </div>
            <button 
              className="btn btn-secondary"
              style={{ color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
              onClick={() => {
                if(window.confirm('Are you sure you want to delete ALL your chat history? This cannot be undone.')) {
                  handleAction('chats', () => api.clearChatHistory(), 'Chats cleared')
                }
              }}
              disabled={actionLoading !== null}
            >
              {actionLoading === 'chats' && <RefreshCw size={14} className="animate-spin" />}
              Clear Chats
            </button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '16px', borderBottom: '1px solid var(--border-default)' }}>
            <div>
              <div style={{ fontWeight: 500, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Brain size={16} /> Reset Learning Progress
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Reset all flashcards and quiz data.
              </div>
            </div>
            <button 
              className="btn btn-secondary"
              style={{ color: '#f59e0b', borderColor: '#f59e0b' }}
              onClick={() => {
                if(window.confirm('Reset all your flashcard and quiz learning progress?')) {
                  handleAction('study', () => api.resetStudyData(), 'Study data reset')
                }
              }}
              disabled={actionLoading !== null}
            >
              {actionLoading === 'study' && <RefreshCw size={14} className="animate-spin" />}
              Reset Progress
            </button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 500, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Download size={16} /> Export Account Data
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Download a ZIP containing all your data in JSON format.
              </div>
            </div>
            <button 
              className="btn btn-primary"
              onClick={handleExportData}
              disabled={actionLoading !== null}
            >
              {actionLoading === 'export' ? <RefreshCw size={14} className="animate-spin" /> : <Download size={14} />}
              Export Data
            </button>
          </div>

        </div>
      </div>

      {/* Danger Zone */}
      <div className="profile-section" style={{ border: '1px solid var(--color-danger)' }}>
        <h3 style={{ color: 'var(--color-danger)' }}><Trash2 size={18} /> Delete Account</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '16px', fontSize: '14px' }}>
          Permanently delete your account and all associated data. This action cannot be undone.
        </p>
        
        {!showDeleteConfirm ? (
          <button 
            type="button"
            className="btn btn-secondary"
            style={{ color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
            onClick={() => setShowDeleteConfirm(true)}
          >
            Delete Account
          </button>
        ) : (
          <form onSubmit={handleDeleteAccount} style={{ background: 'var(--bg-canvas)', padding: '16px', borderRadius: '8px', border: '1px solid var(--border-default)' }}>
            <div className="form-group" style={{ maxWidth: '400px', marginBottom: '16px' }}>
              <label className="form-label" style={{ color: 'var(--color-danger)' }}>Enter password to confirm deletion</label>
              <input
                type="password"
                className="form-input"
                placeholder="Your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button 
                type="submit"
                className="btn btn-primary"
                style={{ background: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
                disabled={actionLoading === 'delete_account' || !confirmPassword}
              >
                {actionLoading === 'delete_account' ? 'Deleting...' : 'Permanently Delete'}
              </button>
              <button 
                type="button"
                className="btn btn-secondary"
                onClick={() => { setShowDeleteConfirm(false); setConfirmPassword(''); }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
      
    </div>
  );
}
