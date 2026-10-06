import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { X, Search, Info, Download, Trash2, Edit3, Eye, FileText } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import { api } from '@/lib/api';
import PdfSource, { type Source } from '@/components/PdfSource';
import AdminDocumentDetail from './AdminDocumentDetail';
import { CircleBuffer } from '@/components/CircleBuffer';

interface AdminDocument {
  id: string;
  original_filename: string;
  username: string;
  byte_size: number;
  status: string;
  created_at: string;
  chat_id: string;
  chat_title: string;
  deleted_at?: string | null;
}

const FILTERS = [
  { id: 'all',          label: 'All',          color: 'var(--accent-blue)' },
  { id: 'ready',        label: 'Ready',        color: 'var(--accent-green)' },
  { id: 'processing',   label: 'Processing',   color: 'var(--accent-purple)' },
  { id: 'failed',       label: 'Failed',       color: 'var(--accent-red)' },
  { id: 'ocr_required', label: 'OCR Required', color: 'var(--accent-orange)' },
  { id: 'deleted',      label: 'Deleted',      color: 'var(--text-secondary)' },
];

export default function AdminDocuments() {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<AdminDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [filterCounts, setFilterCounts] = useState<Record<string, number>>({});
  
  // Modals
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<AdminDocument | null>(null);
  const [selectedPdf, setSelectedPdf] = useState<Source | null>(null);

  // Form State for quick rename
  const [formData, setFormData] = useState({ original_filename: '' });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchDocuments(statusFilter);
  }, [statusFilter]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && modalOpen) {
        closeModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modalOpen]);

  const fetchDocuments = async (filter = statusFilter) => {
    try {
      setLoading(true);
      const res = await api.getAdminDocuments(filter);
      setDocuments(res.documents);
      if (res.counts) {
        setFilterCounts(res.counts);
      }
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to fetch documents');
    } finally {
      setLoading(false);
    }
  };

  const openEdit = (d: AdminDocument) => {
    setEditingDoc(d);
    setFormData({ original_filename: d.original_filename });
    setFormError('');
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formData.original_filename.trim()) {
      return setFormError('Filename is required');
    }

    if (!editingDoc) return;

    try {
      setSaving(true);
      await api.updateAdminDocument(editingDoc.id, {
        original_filename: formData.original_filename
      });
      await fetchDocuments();
      closeModal();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save document');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (docId: string, filename: string) => {
    if (!window.confirm(`Are you sure you want to soft-delete document "${filename}"?\nIt will be moved to the Deleted tab.`)) return;

    try {
      await api.deleteAdminDocument(docId);
      await fetchDocuments();
    } catch (err: any) {
      alert(err.message || 'Failed to delete document');
    }
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleDownload = (docId: string) => {
    window.open(api.getAdminDocumentDownloadUrl(docId), '_blank');
  };

  if (user?.username !== 'admin') {
    return <Navigate to="/app" replace />;
  }

  const filteredDocs = documents.filter(d =>
    d.original_filename.toLowerCase().includes(search.toLowerCase()) ||
    d.username.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ flex: 1, width: '100%', boxSizing: 'border-box' }}>
      
      {/* Title Header */}
      <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
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
          <h1 style={{ fontSize: '28px', fontWeight: '700', margin: 0 }}>Document Library</h1>
          <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>Monitor and inspect all documents uploaded across the system.</p>
        </div>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', background: '#FEF2F2', color: '#EF4444', borderRadius: '8px', marginBottom: '24px' }}>
          {error}
        </div>
      )}

      {/* Filter Bar & Search Row */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        
        {/* Status Filter Tabs */}
        <div style={{ display: 'flex', gap: '6px', background: 'var(--bg-card)', padding: '4px', borderRadius: '12px', border: '1px solid var(--border-default)', overflowX: 'auto', maxWidth: '100%' }}>
          {FILTERS.map(f => {
            const isActive = statusFilter === f.id;
            const count = filterCounts[f.id];
            return (
              <button
                key={f.id}
                onClick={() => setStatusFilter(f.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '7px 14px',
                  borderRadius: '8px',
                  border: 'none',
                  background: isActive ? f.color : 'transparent',
                  color: isActive ? 'white' : 'var(--text-secondary)',
                  fontWeight: isActive ? '600' : '500',
                  fontSize: '13px',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  whiteSpace: 'nowrap'
                }}
              >
                <span>{f.label}</span>
                {count !== undefined && (
                  <span style={{
                    fontSize: '11px',
                    padding: '1px 6px',
                    borderRadius: '10px',
                    background: isActive ? 'rgba(255, 255, 255, 0.25)' : 'var(--bg-active)',
                    color: isActive ? 'white' : 'var(--text-muted)',
                    fontWeight: '600'
                  }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search Input */}
        <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-card)', padding: '9px 16px', borderRadius: '24px', width: '280px', border: '1px solid var(--border-default)' }}>
          <Search size={16} color="var(--text-muted)" style={{ marginRight: '8px' }} />
          <input
            type="text"
            placeholder="Search by filename or owner..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ border: 'none', outline: 'none', width: '100%', fontSize: '13px', background: 'transparent', color: 'var(--text-primary)' }}
          />
        </div>

      </div>

      {/* Documents Table */}
      <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-default)', overflow: 'hidden' }}>
        {loading ? (
          <CircleBuffer minHeight={260} size={36} />
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-default)', background: 'var(--bg-active)' }}>
                <th style={{ padding: '16px 24px', fontWeight: '600', fontSize: '11px', letterSpacing: '0.5px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Document Name</th>
                <th style={{ padding: '16px 24px', fontWeight: '600', fontSize: '11px', letterSpacing: '0.5px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Owner</th>
                <th style={{ padding: '16px 24px', fontWeight: '600', fontSize: '11px', letterSpacing: '0.5px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Size</th>
                <th style={{ padding: '16px 24px', fontWeight: '600', fontSize: '11px', letterSpacing: '0.5px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Status</th>
                <th style={{ padding: '16px 24px', fontWeight: '600', fontSize: '11px', letterSpacing: '0.5px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Upload Date</th>
                <th style={{ padding: '16px 24px', fontWeight: '600', fontSize: '11px', letterSpacing: '0.5px', color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredDocs.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No documents found in this filter.
                  </td>
                </tr>
              ) : filteredDocs.map(d => {
                const isDeleted = !!d.deleted_at;
                return (
                  <tr 
                    key={d.id} 
                    onClick={() => setSelectedDocId(d.id)}
                    style={{ 
                      borderBottom: '1px solid var(--border-default)', 
                      background: 'var(--bg-card)',
                      cursor: 'pointer',
                      transition: 'background 0.15s ease'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-active)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-card)'}
                  >
                    <td style={{ padding: '16px 24px', maxWidth: '300px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={d.original_filename}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <FileText size={16} color="var(--accent-blue)" style={{ flexShrink: 0 }} />
                        <span style={{ fontWeight: '500', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {d.original_filename}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '16px 24px', color: 'var(--text-secondary)' }}>
                      @{d.username}
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px',
                        borderRadius: '20px', fontSize: '12px', fontWeight: '600', background: 'var(--bg-active)', color: 'var(--text-secondary)'
                      }}>
                        {formatSize(d.byte_size)}
                      </span>
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      {isDeleted ? (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px',
                          borderRadius: '20px', fontSize: '12px', fontWeight: '600',
                          background: 'rgba(239, 68, 68, 0.1)', color: '#EF4444'
                        }}>
                          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#EF4444' }} />
                          Deleted
                        </span>
                      ) : (
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px',
                          borderRadius: '20px', fontSize: '12px', fontWeight: '600',
                          background: d.status === 'ready' ? '#ECFDF5' : d.status === 'failed' ? '#FEF2F2' : '#EFF6FF',
                          color: d.status === 'ready' ? '#10B981' : d.status === 'failed' ? '#EF4444' : '#3B82F6'
                        }}>
                          <div style={{ 
                            width: '6px', height: '6px', borderRadius: '50%', 
                            background: d.status === 'ready' ? '#10B981' : d.status === 'failed' ? '#EF4444' : '#3B82F6' 
                          }} />
                          {d.status}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '16px 24px', color: 'var(--text-secondary)' }}>
                      {new Date(d.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '16px 24px', textAlign: 'right' }} onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button 
                          onClick={() => setSelectedDocId(d.id)} 
                          title="View Details" 
                          style={{ 
                            width: '32px', height: '32px', borderRadius: '8px', border: '1px solid var(--border-default)', 
                            background: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                            cursor: 'pointer', color: 'var(--accent-blue)' 
                          }}
                        >
                          <Info size={15} />
                        </button>
                        <button 
                          onClick={() => setSelectedPdf({
                            document_id: d.id,
                            page_number: 1,
                            original_filename: d.original_filename
                          })} 
                          title="View PDF" 
                          style={{ 
                            width: '32px', height: '32px', borderRadius: '8px', border: '1px solid var(--border-default)', 
                            background: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                            cursor: 'pointer', color: 'var(--text-secondary)' 
                          }}
                        >
                          <Eye size={15} />
                        </button>
                        <button 
                          onClick={() => handleDownload(d.id)} 
                          title="Download" 
                          style={{ 
                            width: '32px', height: '32px', borderRadius: '8px', border: '1px solid var(--border-default)', 
                            background: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                            cursor: 'pointer', color: 'var(--text-secondary)' 
                          }}
                        >
                          <Download size={15} />
                        </button>
                        <button 
                          onClick={() => openEdit(d)} 
                          title="Rename" 
                          style={{ 
                            width: '32px', height: '32px', borderRadius: '8px', border: '1px solid var(--border-default)', 
                            background: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                            cursor: 'pointer', color: 'var(--text-secondary)' 
                          }}
                        >
                          <Edit3 size={15} />
                        </button>
                        {!isDeleted && (
                          <button 
                            onClick={() => handleDelete(d.id, d.original_filename)} 
                            title="Soft Delete" 
                            style={{ 
                              width: '32px', height: '32px', borderRadius: '8px', border: '1px solid #FEE2E2', 
                              background: '#FEF2F2', display: 'flex', alignItems: 'center', justifyContent: 'center', 
                              cursor: 'pointer', color: '#EF4444' 
                            }}
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Rename Modal */}
      {modalOpen && (
        <div
          onClick={closeModal}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', zIndex: 100, backdropFilter: 'blur(3px)',
            cursor: 'pointer'
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--bg-card)', borderRadius: '12px', padding: '24px',
              width: '100%', maxWidth: '400px', boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
              cursor: 'default', position: 'relative'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700' }}>Rename Document</h2>
              <button
                type="button"
                onClick={closeModal}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'var(--text-muted)', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', padding: '4px', borderRadius: '6px'
                }}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            {formError && (
              <div style={{ padding: '10px 12px', background: '#FEF2F2', color: '#EF4444', borderRadius: '6px', marginBottom: '16px', fontSize: '13px' }}>
                {formError}
              </div>
            )}

            <form onSubmit={handleSave}>
              <div style={{ marginBottom: '24px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '500' }}>Original Filename</label>
                <input
                  type="text"
                  value={formData.original_filename}
                  onChange={e => setFormData({ original_filename: e.target.value })}
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border-default)', borderRadius: '6px', outline: 'none', boxSizing: 'border-box', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={closeModal} className="btn btn-secondary" disabled={saving}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Rename Document'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Document Detail Modal */}
      {selectedDocId && (
        <AdminDocumentDetail
          documentId={selectedDocId}
          onClose={() => setSelectedDocId(null)}
          onUpdate={() => fetchDocuments(statusFilter)}
          onViewPdf={setSelectedPdf}
        />
      )}

      {/* PDF Viewer Modal */}
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
