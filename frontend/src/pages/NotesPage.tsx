import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, type NoteItem } from '../lib/api';
import { StickyNote, Edit2, Trash2, Check, X } from 'lucide-react';
import { formatDocName } from '../lib/formatters';
import { CircleBuffer } from '@/components/CircleBuffer';

export function NotesPage() {
  const { chatId } = useParams();
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [documents, setDocuments] = useState<any[]>([]);

  useEffect(() => {
    if (!chatId) return;
    Promise.all([
      api.getNotes(chatId),
      api.getChatDocuments(chatId)
    ])
      .then(([notesRes, docsRes]) => {
        setNotes(notesRes.items);
        setDocuments(docsRes.items);
        setLoading(false);
      })
      .catch(console.error);
  }, [chatId]);

  const handleDelete = async (id: string) => {
    if (!chatId) return;
    try {
      await api.deleteNote(chatId, id);
      setNotes(notes.filter(n => n.id !== id));
    } catch (e) {
      console.error('Failed to delete note', e);
    }
  };

  const startEditing = (note: NoteItem) => {
    setEditingId(note.id);
    setEditValue(note.user_note || '');
  };

  const saveEdit = async (id: string) => {
    if (!chatId) return;
    try {
      await api.updateNote(chatId, id, editValue);
      setNotes(notes.map(n => n.id === id ? { ...n, user_note: editValue } : n));
      setEditingId(null);
    } catch (e) {
      console.error('Failed to update note', e);
    }
  };

  if (loading) {
    return <CircleBuffer minHeight={240} size={36} />;
  }

  if (notes.length === 0) {
    return (
      <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', height: '100%' }}>
        <StickyNote size={48} style={{ marginBottom: '16px', opacity: 0.2 }} />
        <p>No notes yet.</p>
        <p style={{ fontSize: '14px', marginTop: '8px', maxWidth: '300px', textAlign: 'center' }}>
          Open a PDF, select some text, and click "Add to Notes" to save it here.
        </p>
      </div>
    );
  }

  return (
    <div >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
        <StickyNote size={20} color="var(--primary)" />
        <h2 style={{ fontSize: '20px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>Saved Notes ({notes.length})</h2>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {notes.map(note => {
          const doc = documents.find(d => d.id === note.document_id);
          const docName = doc ? formatDocName(doc.original_filename) : 'Unknown Document';
          
          return (
            <div key={note.id} className="note-card" style={{ 
              background: 'var(--bg-card)', 
              border: '1px solid var(--border-default)', 
              borderRadius: '12px', 
              padding: '16px', 
              boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
              position: 'relative'
            }}>
              <div style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>From <strong style={{ color: 'var(--text-primary)' }}>{docName}</strong> {note.page_number ? `· p.${note.page_number}` : ''}</span>
                <span style={{ fontSize: '12px' }}>{new Date(note.created_at).toLocaleDateString()}</span>
              </div>
              
              <blockquote style={{ 
                borderLeft: '4px solid var(--primary)', 
                paddingLeft: '16px', 
                paddingTop: '4px',
                paddingBottom: '4px',
                margin: '12px 0', 
                background: 'var(--bg-secondary)', 
                borderRadius: '0 8px 8px 0', 
                fontSize: '14px', 
                color: 'var(--text-primary)',
                fontStyle: 'italic',
                opacity: 0.9
              }}>
                "{note.selected_text}"
              </blockquote>

              {editingId === note.id ? (
                <div style={{ marginTop: '12px' }}>
                  <textarea
                    style={{ 
                      width: '100%', 
                      minHeight: '80px', 
                      padding: '12px', 
                      border: '1px solid var(--border-focus)', 
                      borderRadius: '8px', 
                      fontSize: '14px', 
                      outline: 'none', 
                      resize: 'vertical',
                      background: 'var(--bg-primary)',
                      color: 'var(--text-primary)',
                      fontFamily: 'inherit'
                    }}
                    value={editValue}
                    onChange={e => setEditValue(e.target.value)}
                    placeholder="Add your own thoughts here..."
                    autoFocus
                  />
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px' }}>
                    <button
                      onClick={() => setEditingId(null)}
                      style={{ padding: '6px 12px', fontSize: '12px', fontWeight: '500', border: '1px solid var(--border-default)', borderRadius: '6px', background: 'transparent', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
                    >
                      <X size={14} /> Cancel
                    </button>
                    <button
                      onClick={() => saveEdit(note.id)}
                      style={{ padding: '6px 12px', fontSize: '12px', fontWeight: '500', border: 'none', borderRadius: '6px', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}
                    >
                      <Check size={14} /> Save
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ marginTop: '12px', minHeight: '40px' }}>
                  {note.user_note ? (
                    <p style={{ fontSize: '14px', margin: 0, color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>{note.user_note}</p>
                  ) : (
                    <p style={{ fontSize: '14px', color: 'var(--text-muted)', fontStyle: 'italic', margin: 0, opacity: 0.6 }}>No additional note added.</p>
                  )}
                  
                  <div className="note-actions" style={{ 
                    position: 'absolute', 
                    bottom: '16px', 
                    right: '16px', 
                    display: 'flex', 
                    gap: '8px',
                    opacity: 0.8
                  }}>
                    <button
                      onClick={() => startEditing(note)}
                      style={{ padding: '6px', color: 'var(--text-muted)', background: 'transparent', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex' }}
                      title="Edit note"
                      onMouseOver={e => e.currentTarget.style.color = 'var(--text-primary)'}
                      onMouseOut={e => e.currentTarget.style.color = 'var(--text-muted)'}
                    >
                      <Edit2 size={16} />
                    </button>
                    <button
                      onClick={() => handleDelete(note.id)}
                      style={{ padding: '6px', color: 'var(--text-muted)', background: 'transparent', border: 'none', borderRadius: '4px', cursor: 'pointer', display: 'flex' }}
                      title="Delete note"
                      onMouseOver={e => e.currentTarget.style.color = '#dc2626'}
                      onMouseOut={e => e.currentTarget.style.color = 'var(--text-muted)'}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
