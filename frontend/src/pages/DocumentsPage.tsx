import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Search, Trash2, Plus, Download } from 'lucide-react';
import { api } from '@/lib/api';
import { formatDocName } from '@/lib/formatters';
import PdfSource, { type Source } from '@/components/PdfSource';
import { AddToChatModal } from '@/components/AddToChatModal';
import { CircleBuffer } from '@/components/CircleBuffer';

interface DocItem {
  id: string;
  original_filename: string;
  byte_size: number;
  page_count: number | null;
  status: string;
  chat_id: string;
  chat_title: string;
  created_at: string;
}

const statusBadge: Record<string, string> = {
  ready: 'badge-green',
  failed: 'badge-red',
  queued: 'badge-gray',
  extracting: 'badge-orange',
  ocr: 'badge-orange',
  chunking: 'badge-orange',
  embedding: 'badge-orange',
  indexing: 'badge-blue',
  deleting: 'badge-red',
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentsPage() {
  const navigate = useNavigate();
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [source, setSource] = useState<Source | null>(null);
  const [addDoc, setAddDoc] = useState<DocItem | null>(null);
  const [hoveredDocId, setHoveredDocId] = useState<string | null>(null);

  useEffect(() => {
    api.getAllDocuments()
      .then((res) => setDocs(res.items))
      .catch(() => setDocs([]))
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async (docId: string) => {
    if (!confirm('Delete this document? It will be removed from retrieval.')) return;
    try {
      await api.deleteDocument(docId);
      setDocs((prev) => prev.filter((d) => d.id !== docId));
    } catch {
      // Handle error
    }
  };

  const filters = ['all', 'ready', 'processing', 'failed'];

  const filteredDocs = docs.filter((d) => {
    if (statusFilter === 'processing') {
      return ['queued', 'extracting', 'ocr', 'chunking', 'embedding', 'indexing'].includes(d.status);
    }
    if (statusFilter !== 'all' && d.status !== statusFilter) return false;
    if (search) {
      return d.original_filename.toLowerCase().includes(search.toLowerCase()) ||
        d.chat_title.toLowerCase().includes(search.toLowerCase());
    }
    return true;
  });

  return (
    <div className="animate-fade-in" style={{ flex: 1, width: '100%', boxSizing: 'border-box' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Documents</h1>
          <div className="page-subtitle">{docs.length} documents across all chats</div>
        </div>
      </div>

      {/* Filter pills */}
      <div className="filter-bar">
        {filters.map((f) => (
          <button
            key={f}
            className={`filter-pill filter-${f}${statusFilter === f ? ' active' : ''}`}
            onClick={() => setStatusFilter(f)}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
        <div style={{ marginLeft: 'auto', position: 'relative', minWidth: 220 }}>
          <Search size={15} style={{
            position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--text-muted)', pointerEvents: 'none',
          }} />
          <input
            type="text"
            className="form-input"
            placeholder="Search documents…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 36, borderRadius: 'var(--radius-pill)', fontSize: 13 }}
            id="docs-search"
          />
        </div>
      </div>

      {/* Table */}
      <div className="table-card">
        {loading ? (
          <CircleBuffer minHeight={220} size={36} />
        ) : filteredDocs.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Filename</th>
                <th>Chat</th>
                <th>Size</th>
                <th>Pages</th>
                <th>Status</th>
                <th>Uploaded</th>
                <th style={{ width: 84 }}></th>
              </tr>
            </thead>
            <tbody>
              {filteredDocs.map((doc) => (
                <tr
                  key={doc.id}
                  className="doc-table-row"
                  onMouseEnter={() => setHoveredDocId(doc.id)}
                  onMouseLeave={() => setHoveredDocId(null)}
                >
                  <td style={{ fontWeight: 600 }}>
                    <button 
                      className="btn btn-ghost" 
                      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', margin: '-4px -8px', textAlign: 'left', border: 'none' }}
                      onClick={() => setSource({ document_id: doc.id, page_number: 1, original_filename: doc.original_filename })}
                    >
                      <FileText size={14} style={{ color: 'var(--accent-blue)', flexShrink: 0 }} />
                      <span className="truncate" style={{ maxWidth: 200 }} title={doc.original_filename}>{formatDocName(doc.original_filename)}</span>
                    </button>
                  </td>
                  <td>
                    <button
                      className="btn btn-ghost btn-sm"
                      style={{ padding: '2px 8px', fontSize: 12 }}
                      onClick={() => navigate(`/app/chats/${doc.chat_id}`)}
                    >
                      {doc.chat_title}
                    </button>
                  </td>
                  <td style={{ color: 'var(--text-muted)' }}>{formatBytes(doc.byte_size)}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{doc.page_count ?? '—'}</td>
                  <td>
                    <span className={`badge ${statusBadge[doc.status] || 'badge-gray'}`}>
                      {doc.status}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12.5 }}>
                    {new Date(doc.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                      <button
                        className="btn-icon doc-add-btn"
                        title="Add to chat"
                        onClick={(e) => {
                          e.stopPropagation();
                          setAddDoc(doc);
                        }}
                        style={{
                          padding: 6,
                          color: 'var(--accent-blue)',
                          borderRadius: '6px',
                          opacity: hoveredDocId === doc.id ? 1 : 0,
                          visibility: hoveredDocId === doc.id ? 'visible' : 'hidden',
                          transform: hoveredDocId === doc.id ? 'scale(1)' : 'scale(0.85)',
                          transition: 'opacity 0.15s ease, transform 0.15s ease, visibility 0.15s ease',
                          cursor: 'pointer',
                        }}
                      >
                        <Plus size={15} />
                      </button>
                      <button
                        className="btn-icon"
                        title="Download document"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(`/api/v1/documents/${doc.id}/file`, '_blank');
                        }}
                        style={{
                          padding: 6,
                          color: 'var(--text-primary)',
                          borderRadius: '6px',
                          opacity: hoveredDocId === doc.id ? 1 : 0,
                          visibility: hoveredDocId === doc.id ? 'visible' : 'hidden',
                          transform: hoveredDocId === doc.id ? 'scale(1)' : 'scale(0.85)',
                          transition: 'opacity 0.15s ease, transform 0.15s ease, visibility 0.15s ease',
                          cursor: 'pointer',
                        }}
                      >
                        <Download size={14} />
                      </button>
                      <button
                        className="btn-icon"
                        title="Remove document"
                        onClick={() => handleDelete(doc.id)}
                        style={{ 
                          padding: 6, 
                          color: 'var(--accent-red)', 
                          borderRadius: '6px',
                          opacity: hoveredDocId === doc.id ? 1 : 0,
                          visibility: hoveredDocId === doc.id ? 'visible' : 'hidden',
                          transform: hoveredDocId === doc.id ? 'scale(1)' : 'scale(0.85)',
                          transition: 'opacity 0.15s ease, transform 0.15s ease, visibility 0.15s ease',
                          cursor: 'pointer',
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-state">
            <div className="empty-state-icon">
              <FileText size={24} />
            </div>
            <div className="empty-state-title">
              {search || statusFilter !== 'all' ? 'No matching documents' : 'No documents yet'}
            </div>
            <div className="empty-state-sub">
              Upload PDFs in a chat to start studying
            </div>
          </div>
        )}
      </div>
      
      {source && <PdfSource source={source} close={() => setSource(null)} />}
      {addDoc && (
        <AddToChatModal
          doc={addDoc}
          onClose={() => setAddDoc(null)}
          onSuccess={() => {
            api.getAllDocuments()
              .then((res) => setDocs(res.items))
              .catch(() => {});
          }}
        />
      )}
    </div>
  );
}
