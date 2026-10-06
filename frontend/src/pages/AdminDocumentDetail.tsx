import { useEffect, useState } from 'react';
import { api, type AdminDocumentDetailData } from '@/lib/api';
import { CircleBuffer } from '@/components/CircleBuffer';
import { 
  X, FileText, User, MessageSquare, Calendar, Layers, Hash, 
  Cpu, HardDrive, Download, Eye, Edit3, RefreshCw, Search, 
  Brain, Trash2, ShieldAlert, AlertTriangle, RotateCcw, Check, Sparkles
} from 'lucide-react';

interface AdminDocumentDetailProps {
  documentId: string;
  onClose: () => void;
  onUpdate: () => void;
  onViewPdf?: (doc: { document_id: string; page_number: number; original_filename: string }) => void;
}

export default function AdminDocumentDetail({ 
  documentId, 
  onClose, 
  onUpdate,
  onViewPdf 
}: AdminDocumentDetailProps) {
  const [detail, setDetail] = useState<AdminDocumentDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  
  // Inline rename state
  const [isRenaming, setIsRenaming] = useState(false);
  const [newFilename, setNewFilename] = useState('');
  const [renameError, setRenameError] = useState('');

  // Error expand state
  const [showErrorDetails, setShowErrorDetails] = useState(false);

  useEffect(() => {
    fetchDetail();
  }, [documentId]);

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
      const res = await api.getAdminDocumentDetail(documentId);
      setDetail(res);
      setNewFilename(res.original_filename);
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (actionKey: string, actionFn: () => Promise<any>, closeAfter = false) => {
    try {
      setActionLoading(actionKey);
      await actionFn();
      onUpdate();
      if (closeAfter) {
        onClose();
      } else {
        await fetchDetail();
      }
    } catch (err: any) {
      alert(err.message || 'Action failed');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRename = async () => {
    if (!newFilename.trim()) {
      setRenameError('Filename cannot be empty');
      return;
    }
    setRenameError('');
    await handleAction('rename', async () => {
      await api.updateAdminDocument(documentId, { original_filename: newFilename.trim() });
      setIsRenaming(false);
    });
  };

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getStatusBadge = (status: string, isDeleted: boolean) => {
    if (isDeleted) {
      return (
        <span style={{ padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: '600', background: 'rgba(239, 68, 68, 0.1)', color: '#EF4444' }}>
          Deleted
        </span>
      );
    }
    switch (status) {
      case 'ready':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: '600', background: '#ECFDF5', color: '#10B981' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10B981' }} />
            Ready
          </span>
        );
      case 'failed':
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: '600', background: '#FEF2F2', color: '#EF4444' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#EF4444' }} />
            Failed
          </span>
        );
      default:
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: '600', background: '#EFF6FF', color: '#3B82F6' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#3B82F6' }} />
            {status}
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div 
        onClick={onClose}
        style={{ 
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', 
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 
        }}
      >
        <div 
          onClick={e => e.stopPropagation()}
          style={{ background: 'var(--bg-card)', padding: '32px', borderRadius: '16px', color: 'var(--text-primary)', border: '1px solid var(--border-default)', boxShadow: '0 20px 40px rgba(0,0,0,0.2)' }}
        >
          <CircleBuffer minHeight={60} size={36} />
        </div>
      </div>
    );
  }

  if (!detail) return null;

  const isSoftDeleted = !!detail.deleted_at;
  const hasError = !!detail.error_code || !!detail.latest_job_error;

  return (
    <div 
      onClick={onClose}
      style={{ 
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '24px'
      }}
    >
      <div 
        onClick={e => e.stopPropagation()}
        style={{ 
          background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-default)',
          width: '100%', maxWidth: '960px', maxHeight: '90vh', display: 'flex', flexDirection: 'column',
          boxShadow: '0 20px 40px rgba(0,0,0,0.25)', overflow: 'hidden'
        }}
      >
        
        {/* Header */}
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
              <FileText size={20} />
            </div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '600', color: 'var(--text-primary)' }}>Document Information</h2>
          </div>
          <button 
            onClick={onClose} 
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', padding: '4px', borderRadius: '6px' }}
          >
            <X size={22} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          
          {/* Left Column: Metadata */}
          <div style={{ flex: 1, padding: '24px', overflowY: 'auto', borderRight: '1px solid var(--border-default)' }}>
            
            {/* Title / Rename Box */}
            <div style={{ marginBottom: '24px' }}>
              {isRenaming ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <input
                      type="text"
                      value={newFilename}
                      onChange={e => setNewFilename(e.target.value)}
                      placeholder="Enter new filename"
                      style={{ 
                        flex: 1, padding: '8px 12px', borderRadius: '8px', 
                        border: '1px solid var(--accent-blue)', background: 'var(--bg-input)', 
                        color: 'var(--text-primary)', fontSize: '14px', outline: 'none' 
                      }}
                      autoFocus
                    />
                    <button 
                      onClick={handleRename}
                      disabled={actionLoading === 'rename'}
                      style={{ 
                        display: 'flex', alignItems: 'center', gap: '4px', padding: '8px 14px', 
                        background: '#10B981', color: 'white', border: 'none', borderRadius: '8px', 
                        cursor: 'pointer', fontWeight: '500', fontSize: '13px' 
                      }}
                    >
                      <Check size={16} /> Save
                    </button>
                    <button 
                      onClick={() => { setIsRenaming(false); setNewFilename(detail.original_filename); setRenameError(''); }}
                      style={{ 
                        padding: '8px 14px', background: 'var(--bg-active)', color: 'var(--text-secondary)', 
                        border: '1px solid var(--border-default)', borderRadius: '8px', cursor: 'pointer', 
                        fontSize: '13px', fontWeight: '500' 
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                  {renameError && <span style={{ color: '#EF4444', fontSize: '12px' }}>{renameError}</span>}
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                  <div>
                    <h3 style={{ margin: '0 0 6px 0', fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)', wordBreak: 'break-word' }}>
                      {detail.original_filename}
                    </h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <User size={14} /> @{detail.owner_username}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <MessageSquare size={14} /> {detail.chat_title}
                      </span>
                    </div>
                  </div>
                  <div>
                    {getStatusBadge(detail.status, isSoftDeleted)}
                  </div>
                </div>
              )}
            </div>

            {/* Error Notification if any */}
            {hasError && (
              <div style={{ 
                marginBottom: '24px', padding: '14px 16px', borderRadius: '10px', 
                background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', 
                color: '#EF4444' 
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: showErrorDetails ? '8px' : '0' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600', fontSize: '13px' }}>
                    <AlertTriangle size={16} />
                    Processing Error: {detail.error_code || 'Execution Failed'}
                  </div>
                  {detail.latest_job_error && (
                    <button 
                      onClick={() => setShowErrorDetails(!showErrorDetails)}
                      style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: '12px', textDecoration: 'underline', padding: 0 }}
                    >
                      {showErrorDetails ? 'Hide Details' : 'View Details'}
                    </button>
                  )}
                </div>
                {showErrorDetails && detail.latest_job_error && (
                  <pre style={{ margin: 0, padding: '10px', borderRadius: '6px', background: 'rgba(0,0,0,0.05)', fontSize: '12px', overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all', fontFamily: 'monospace' }}>
                    {detail.latest_job_error}
                  </pre>
                )}
              </div>
            )}

            {/* Metadata Rows */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '10px', borderBottom: '1px solid var(--border-default)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                  <Layers size={16} /> Pages
                </span>
                <span style={{ color: 'var(--text-primary)', fontWeight: '600', fontSize: '14px' }}>
                  {detail.page_count ?? 'N/A'}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '10px', borderBottom: '1px solid var(--border-default)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                  <HardDrive size={16} /> File Size
                </span>
                <span style={{ color: 'var(--text-primary)', fontWeight: '600', fontSize: '14px' }}>
                  {formatBytes(detail.byte_size)}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '10px', borderBottom: '1px solid var(--border-default)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                  <Search size={16} /> OCR Pages
                </span>
                <span style={{ 
                  color: detail.ocr_page_count > 0 ? '#d97706' : 'var(--text-primary)', 
                  fontWeight: '600', fontSize: '14px',
                  display: 'flex', alignItems: 'center', gap: '6px'
                }}>
                  {detail.ocr_page_count}
                  {detail.ocr_page_count > 0 && (
                    <span style={{ fontSize: '11px', background: 'rgba(217, 119, 6, 0.1)', color: '#d97706', padding: '2px 6px', borderRadius: '4px' }}>
                      OCR Required
                    </span>
                  )}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '10px', borderBottom: '1px solid var(--border-default)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                  <Hash size={16} /> Chunks Extracted
                </span>
                <span style={{ color: 'var(--text-primary)', fontWeight: '600', fontSize: '14px' }}>
                  {detail.chunk_count.toLocaleString()}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '10px', borderBottom: '1px solid var(--border-default)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                  <Cpu size={16} /> Active Index Version
                </span>
                <span style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '13px', fontFamily: 'monospace' }}>
                  {detail.index_version ? detail.index_version.substring(0, 8) : 'None'}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '10px', borderBottom: '1px solid var(--border-default)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                  <Sparkles size={16} /> Extraction Engine
                </span>
                <span style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '13px' }}>
                  {detail.extraction_version || 'standard'}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '10px', borderBottom: '1px solid var(--border-default)' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                  <Calendar size={16} /> Upload Date
                </span>
                <span style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '13px' }}>
                  {new Date(detail.created_at).toLocaleString()}
                </span>
              </div>

              {detail.updated_at && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '10px', borderBottom: '1px solid var(--border-default)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-secondary)', fontSize: '13px' }}>
                    <Calendar size={16} /> Last Modified
                  </span>
                  <span style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '13px' }}>
                    {new Date(detail.updated_at).toLocaleString()}
                  </span>
                </div>
              )}

              {isSoftDeleted && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '10px', borderBottom: '1px solid var(--border-default)' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#EF4444', fontSize: '13px' }}>
                    <Trash2 size={16} /> Deleted At
                  </span>
                  <span style={{ color: '#EF4444', fontWeight: '500', fontSize: '13px' }}>
                    {new Date(detail.deleted_at!).toLocaleString()}
                  </span>
                </div>
              )}
            </div>

          </div>

          {/* Right Column: Admin Actions */}
          <div style={{ width: '320px', padding: '24px', overflowY: 'auto', background: 'var(--bg-active)' }}>
            
            {/* General Actions */}
            <h4 style={{ margin: '0 0 14px 0', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              General Actions
            </h4>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
              {onViewPdf && (
                <button 
                  onClick={() => onViewPdf({
                    document_id: detail.id,
                    page_number: 1,
                    original_filename: detail.original_filename
                  })}
                  disabled={isSoftDeleted}
                  style={{ 
                    display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', 
                    background: 'var(--bg-card)', border: '1px solid var(--border-default)', 
                    borderRadius: '8px', color: 'var(--text-primary)', cursor: isSoftDeleted ? 'not-allowed' : 'pointer', 
                    fontWeight: '500', fontSize: '13px', opacity: isSoftDeleted ? 0.5 : 1
                  }}
                >
                  <Eye size={16} color="var(--accent-blue)" /> View PDF
                </button>
              )}

              <button 
                onClick={() => window.open(api.getAdminDocumentDownloadUrl(detail.id), '_blank')}
                disabled={isSoftDeleted}
                style={{ 
                  display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', 
                  background: 'var(--bg-card)', border: '1px solid var(--border-default)', 
                  borderRadius: '8px', color: 'var(--text-primary)', cursor: isSoftDeleted ? 'not-allowed' : 'pointer', 
                  fontWeight: '500', fontSize: '13px', opacity: isSoftDeleted ? 0.5 : 1
                }}
              >
                <Download size={16} color="#10B981" /> Download PDF
              </button>

              <button 
                onClick={() => { setIsRenaming(true); setNewFilename(detail.original_filename); }}
                disabled={isSoftDeleted}
                style={{ 
                  display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', 
                  background: 'var(--bg-card)', border: '1px solid var(--border-default)', 
                  borderRadius: '8px', color: 'var(--text-primary)', cursor: isSoftDeleted ? 'not-allowed' : 'pointer', 
                  fontWeight: '500', fontSize: '13px', opacity: isSoftDeleted ? 0.5 : 1
                }}
              >
                <Edit3 size={16} color="#8B5CF6" /> Rename Document
              </button>
            </div>

            {/* Pipeline Jobs */}
            <h4 style={{ margin: '0 0 14px 0', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Pipeline & Vectors
            </h4>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
              <button 
                onClick={() => handleAction('reprocess', () => api.adminReprocessDocument(detail.id))}
                disabled={isSoftDeleted || actionLoading !== null}
                style={{ 
                  display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', 
                  background: 'var(--bg-card)', border: '1px solid var(--border-default)', 
                  borderRadius: '8px', color: 'var(--text-primary)', cursor: isSoftDeleted ? 'not-allowed' : 'pointer', 
                  fontWeight: '500', fontSize: '13px', opacity: isSoftDeleted ? 0.5 : 1
                }}
              >
                <RefreshCw size={16} color="#3B82F6" className={actionLoading === 'reprocess' ? 'animate-spin' : ''} /> 
                {actionLoading === 'reprocess' ? 'Queuing...' : 'Reprocess (Full)'}
              </button>

              <button 
                onClick={() => handleAction('reocr', () => api.adminReprocessDocument(detail.id))}
                disabled={isSoftDeleted || actionLoading !== null}
                style={{ 
                  display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', 
                  background: 'var(--bg-card)', border: '1px solid var(--border-default)', 
                  borderRadius: '8px', color: 'var(--text-primary)', cursor: isSoftDeleted ? 'not-allowed' : 'pointer', 
                  fontWeight: '500', fontSize: '13px', opacity: isSoftDeleted ? 0.5 : 1
                }}
              >
                <Search size={16} color="#d97706" className={actionLoading === 'reocr' ? 'animate-spin' : ''} /> 
                {actionLoading === 'reocr' ? 'Queuing...' : 'Re-run OCR'}
              </button>

              <button 
                onClick={() => handleAction('reembed', () => api.adminReprocessDocument(detail.id))}
                disabled={isSoftDeleted || actionLoading !== null}
                style={{ 
                  display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', 
                  background: 'var(--bg-card)', border: '1px solid var(--border-default)', 
                  borderRadius: '8px', color: 'var(--text-primary)', cursor: isSoftDeleted ? 'not-allowed' : 'pointer', 
                  fontWeight: '500', fontSize: '13px', opacity: isSoftDeleted ? 0.5 : 1
                }}
              >
                <Brain size={16} color="#8B5CF6" className={actionLoading === 'reembed' ? 'animate-spin' : ''} /> 
                {actionLoading === 'reembed' ? 'Queuing...' : 'Rebuild Embeddings'}
              </button>

              <button 
                onClick={() => handleAction('reindex', () => api.adminReindexDocument(detail.id))}
                disabled={isSoftDeleted || actionLoading !== null}
                style={{ 
                  display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', 
                  background: 'var(--bg-card)', border: '1px solid var(--border-default)', 
                  borderRadius: '8px', color: 'var(--text-primary)', cursor: isSoftDeleted ? 'not-allowed' : 'pointer', 
                  fontWeight: '500', fontSize: '13px', opacity: isSoftDeleted ? 0.5 : 1
                }}
              >
                <Layers size={16} color="#06b6d4" className={actionLoading === 'reindex' ? 'animate-spin' : ''} /> 
                {actionLoading === 'reindex' ? 'Queuing...' : 'Reindex Only'}
              </button>
            </div>

            {/* Destructive Actions */}
            <h4 style={{ margin: '0 0 14px 0', fontSize: '12px', color: 'var(--text-secondary)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Danger Zone
            </h4>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {isSoftDeleted ? (
                <button 
                  onClick={() => handleAction('restore', () => api.adminRestoreDocument(detail.id))}
                  disabled={actionLoading !== null}
                  style={{ 
                    display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', 
                    background: 'var(--bg-card)', border: '1px solid var(--border-default)', 
                    borderRadius: '8px', color: '#10B981', cursor: 'pointer', fontWeight: '600', fontSize: '13px'
                  }}
                >
                  <RotateCcw size={16} /> Restore Document
                </button>
              ) : (
                <button 
                  onClick={() => {
                    if (window.confirm(`Are you sure you want to soft-delete "${detail.original_filename}"?\nIt will be moved to the Deleted filter.`)) {
                      handleAction('delete', () => api.deleteAdminDocument(detail.id));
                    }
                  }}
                  disabled={actionLoading !== null}
                  style={{ 
                    display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', 
                    background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', 
                    borderRadius: '8px', color: '#EF4444', cursor: 'pointer', fontWeight: '600', fontSize: '13px'
                  }}
                >
                  <Trash2 size={16} /> Soft-Delete Document
                </button>
              )}

              <button 
                onClick={() => {
                  if (window.confirm(`PERMANENT DELETE WARNING:\n\nAre you sure you want to permanently delete "${detail.original_filename}"?\n\nThis will completely remove the file, database records, and Chroma embeddings. This CANNOT be undone.`)) {
                    handleAction('permanent_delete', () => api.adminPermanentDeleteDocument(detail.id), true);
                  }
                }}
                disabled={actionLoading !== null}
                style={{ 
                  display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', 
                  background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.4)', 
                  borderRadius: '8px', color: '#DC2626', cursor: 'pointer', fontWeight: '700', fontSize: '13px'
                }}
              >
                <ShieldAlert size={16} /> Permanently Delete
              </button>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
