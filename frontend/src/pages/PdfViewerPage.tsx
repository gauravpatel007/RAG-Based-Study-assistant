import { useRef, useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { PdfViewer } from '../components/PdfViewer';
import { SelectionToolbar } from '../components/SelectionToolbar';
import { useTextSelection } from '../hooks/useTextSelection';
import { api } from '../lib/api';

export function PdfViewerPage() {
  const { chatId, documentId } = useParams();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement>(null);
  const { selection, clearSelection } = useTextSelection(containerRef);
  const [currentPage, setCurrentPage] = useState(1);
  const [documentName, setDocumentName] = useState('Document');
  
  // Fetch document metadata to display name
  useEffect(() => {
    if (!chatId || !documentId) return;
    api.getChatDocuments(chatId)
      .then(res => {
        const doc = res.items.find(d => d.id === documentId);
        if (doc) setDocumentName(doc.original_filename);
      })
      .catch(console.error);
  }, [chatId, documentId]);

  if (!chatId || !documentId) return null;

  const handleAction = async (prompt: string | null, action: 'send' | 'compose' | 'note' | 'quote') => {
    if (action === 'note' && prompt) {
      try {
        await api.createNote(chatId, {
          document_id: documentId,
          page_number: currentPage,
          selected_text: prompt,
        });
        // Could show a toast here
      } catch (e) {
        console.error('Failed to save note', e);
      }
      clearSelection();
      return;
    }
    
    clearSelection();
    if (prompt) {
      navigate(`/app/chats/${chatId}?q=${encodeURIComponent(prompt)}`);
    } else {
      navigate(`/app/chats/${chatId}`);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100%', backgroundColor: '#ffffff' }} ref={containerRef}>
      <header style={{ 
        display: 'flex', 
        alignItems: 'center', 
        height: '56px', 
        padding: '0 16px', 
        borderBottom: '1px solid var(--border-default)', 
        flexShrink: 0, 
        backgroundColor: '#ffffff', 
        boxShadow: '0 1px 2px rgba(0,0,0,0.05)', 
        zIndex: 10 
      }}>
        <button
          onClick={() => navigate(`/app/chats/${chatId}`)}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', background: 'transparent', border: 'none', cursor: 'pointer' }}
          onMouseOver={e => e.currentTarget.style.color = 'var(--text-primary)'}
          onMouseOut={e => e.currentTarget.style.color = 'var(--text-muted)'}
        >
          <ArrowLeft size={20} />
          <span style={{ fontWeight: 500 }}>Back to Chat</span>
        </button>
        <div style={{ width: '1px', height: '24px', backgroundColor: 'var(--border-default)', margin: '0 16px' }} />
        <h1 style={{ fontWeight: 600, fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '400px', margin: 0, color: 'var(--text-primary)' }}>{documentName}</h1>
      </header>

      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <PdfViewer
          documentId={documentId}
          initialPage={currentPage}
          onPageChange={setCurrentPage}
        >
          {selection.text && (
            <SelectionToolbar
              selection={selection}
              chatId={chatId}
              documentId={documentId}
              pageNumber={currentPage}
              onAction={handleAction}
              onDismiss={clearSelection}
            />
          )}
        </PdfViewer>
      </div>
    </div>
  );
}
