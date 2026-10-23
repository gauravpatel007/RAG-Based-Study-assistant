import { useEffect, useState, useRef, useMemo } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { useParams, useNavigate } from 'react-router-dom';
import { api, type NoteItem } from '../lib/api';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import {
  StickyNote, Plus, Search, LayoutGrid, List, Pin, PinOff,
  Trash2, Copy, Check, X, FileText, Sparkles, BookOpen,
  HelpCircle, CreditCard, MessageSquare, Download, ChevronDown,
  ChevronUp, ExternalLink, Zap, Tag, Quote, Calendar, Pencil,
  Eye, Code, Bold, Italic, CheckSquare, ListOrdered, CheckCircle2
} from 'lucide-react';
import { formatDocName } from '../lib/formatters';
import PdfSource, { type Source } from '@/components/PdfSource';
import { CircleBuffer } from '@/components/CircleBuffer';
import './NotesPage.css';

export interface TagMeta {
  label: string;
  shortLabel: string;
  color: string;
  icon: typeof Sparkles;
}

export const TAG_META: Record<string, TagMeta> = {
  concept: {
    label: 'Core Concept',
    shortLabel: 'Concept',
    color: 'purple',
    icon: Sparkles,
  },
  formula: {
    label: 'Formula / Definition',
    shortLabel: 'Formula',
    color: 'blue',
    icon: BookOpen,
  },
  exam: {
    label: 'Exam High-Yield',
    shortLabel: 'High-Yield',
    color: 'green',
    icon: Zap,
  },
  doubt: {
    label: 'Doubt / Question',
    shortLabel: 'Question',
    color: 'orange',
    icon: HelpCircle,
  },
};

type ViewMode = 'grid' | 'list';
type TagFilter = 'all' | 'pinned' | 'concept' | 'formula' | 'exam' | 'doubt';

interface EditorState {
  open: boolean;
  editId: string | null;
  title: string;
  selectedText: string;
  userNote: string;
  tag: string;
}

const INITIAL_EDITOR: EditorState = {
  open: false,
  editId: null,
  title: '',
  selectedText: '',
  userNote: '',
  tag: '',
};

export function NotesPage() {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [tagFilter, setTagFilter] = useState<TagFilter>('all');
  const [docFilter, setDocFilter] = useState('all');
  const [docDropdownOpen, setDocDropdownOpen] = useState(false);
  const [editor, setEditor] = useState<EditorState>(INITIAL_EDITOR);
  const [editorTab, setEditorTab] = useState<'write' | 'preview'>('write');
  const [saving, setSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [aiMenuId, setAiMenuId] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiResult, setAiResult] = useState<{ action: string; content: string } | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [pdfSource, setPdfSource] = useState<Source | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2500);
  };

  // ── Load Data ──
  useEffect(() => {
    if (!chatId) return;
    Promise.all([api.getNotes(chatId), api.getChatDocuments(chatId)])
      .then(([notesRes, docsRes]) => {
        setNotes(notesRes.items);
        setDocuments(docsRes.items);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [chatId]);

  // Close menus on global click
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (aiMenuId && !target.closest('.note-ai-menu-container')) {
        setAiMenuId(null);
      }
      if (docDropdownOpen && !target.closest('.notes-doc-select-wrapper')) {
        setDocDropdownOpen(false);
      }
    };
    
    if (aiMenuId || docDropdownOpen) {
      window.addEventListener('click', handleGlobalClick);
      return () => window.removeEventListener('click', handleGlobalClick);
    }
  }, [aiMenuId, docDropdownOpen]);

  // ── Computed ──
  const docMap = useMemo(() => {
    const m: Record<string, string> = {};
    documents.forEach(d => { m[d.id] = d.original_filename; });
    return m;
  }, [documents]);

  const tagCounts = useMemo(() => {
    const counts: Record<string, number> = { all: notes.length, pinned: 0 };
    Object.keys(TAG_META).forEach(k => { counts[k] = 0; });
    notes.forEach(n => {
      if (n.is_pinned) counts.pinned++;
      if (n.tag && counts[n.tag] !== undefined) {
        counts[n.tag]++;
      }
    });
    return counts;
  }, [notes]);

  const filteredNotes = useMemo(() => {
    let result = notes;
    if (tagFilter === 'pinned') {
      result = result.filter(n => n.is_pinned);
    } else if (tagFilter !== 'all') {
      result = result.filter(n => n.tag === tagFilter);
    }
    if (docFilter !== 'all') {
      result = result.filter(n => n.document_id === docFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(n =>
        (n.title || '').toLowerCase().includes(q) ||
        (n.selected_text || '').toLowerCase().includes(q) ||
        (n.user_note || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [notes, tagFilter, docFilter, searchQuery]);

  const kpiStats = useMemo(() => {
    const tags = new Set(notes.filter(n => n.tag).map(n => n.tag));
    const sources = new Set(notes.filter(n => n.document_id).map(n => n.document_id));
    const pinned = notes.filter(n => n.is_pinned).length;
    return { total: notes.length, tags: tags.size, sources: sources.size, pinned };
  }, [notes]);

  // ── Actions ──
  const handleDelete = async (id: string) => {
    if (!chatId || !confirm('Delete this note?')) return;
    try {
      await api.deleteNote(chatId, id);
      setNotes(prev => prev.filter(n => n.id !== id));
      showToast('Note deleted');
    } catch (e) {
      console.error(e);
    }
  };

  const handlePin = async (note: NoteItem) => {
    if (!chatId) return;
    try {
      const nextPinned = !note.is_pinned;
      await api.updateNote(chatId, note.id, { is_pinned: nextPinned });
      setNotes(prev => prev.map(n =>
        n.id === note.id ? { ...n, is_pinned: nextPinned } : n
      ).sort((a, b) => {
        if (a.is_pinned !== b.is_pinned) return a.is_pinned ? -1 : 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }));
      showToast(nextPinned ? 'Pinned to top' : 'Unpinned');
    } catch (e) {
      console.error(e);
    }
  };

  const handleCopy = (note: NoteItem) => {
    const doc = note.document_id ? docMap[note.document_id] : null;
    const citation = doc ? `\n— ${formatDocName(doc)}${note.page_number ? `, p.${note.page_number}` : ''}` : '';
    const text = (note.title ? `${note.title}\n\n` : '') +
      (note.selected_text ? `"${note.selected_text}"\n\n` : '') +
      (note.user_note || '') + citation;
    navigator.clipboard.writeText(text);
    setCopiedId(note.id);
    showToast('Copied with citation');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const openEditor = (note?: NoteItem) => {
    setEditorTab('write');
    if (note) {
      setEditor({
        open: true,
        editId: note.id,
        title: note.title || '',
        selectedText: note.selected_text || '',
        userNote: note.user_note || '',
        tag: note.tag || '',
      });
    } else {
      setEditor({ ...INITIAL_EDITOR, open: true });
    }
  };

  const saveNote = async () => {
    if (!chatId) return;
    setSaving(true);
    try {
      if (editor.editId) {
        await api.updateNote(chatId, editor.editId, {
          title: editor.title.trim() || null,
          user_note: editor.userNote || null,
          selected_text: editor.selectedText || null,
          tag: editor.tag || null,
        });
        setNotes(prev => prev.map(n => n.id === editor.editId ? {
          ...n,
          title: editor.title.trim() || null,
          user_note: editor.userNote || null,
          selected_text: editor.selectedText || null,
          tag: editor.tag || null,
        } : n));
        showToast('Note updated');
      } else {
        const res = await api.createNote(chatId, {
          title: editor.title.trim() || null,
          selected_text: editor.selectedText || '',
          user_note: editor.userNote || null,
          tag: editor.tag || null,
        });
        setNotes(prev => [{
          id: res.id,
          document_id: null,
          page_number: null,
          title: editor.title.trim() || null,
          selected_text: editor.selectedText || '',
          user_note: editor.userNote || null,
          tag: editor.tag || null,
          is_pinned: false,
          created_at: res.created_at,
          updated_at: res.created_at,
        }, ...prev]);
        showToast('New note created');
      }
      setEditor(INITIAL_EDITOR);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const insertFormat = (prefix: string, suffix: string = '') => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = editor.userNote.slice(start, end);
    const newText = editor.userNote.slice(0, start) + prefix + selected + suffix + editor.userNote.slice(end);
    setEditor(prev => ({ ...prev, userNote: newText }));
    setTimeout(() => {
      ta.focus();
      ta.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
    }, 0);
  };

  // ── AI Actions ──
  const handleAiAction = async (noteId: string, action: string) => {
    if (!chatId) return;
    setAiMenuId(null);
    if (action === 'flashcard') {
      const note = notes.find(n => n.id === noteId);
      const topic = (note?.title || note?.selected_text || note?.user_note || '').slice(0, 300);
      navigate(`/app/chats/${chatId}/flashcards?topic=${encodeURIComponent(topic)}`);
      return;
    }
    if (action === 'quiz') {
      const note = notes.find(n => n.id === noteId);
      const topic = (note?.title || note?.selected_text || note?.user_note || '').slice(0, 300);
      navigate(`/app/chats/${chatId}/quiz?topic=${encodeURIComponent(topic)}`);
      return;
    }
    if (action === 'ask') {
      const note = notes.find(n => n.id === noteId);
      const text = (note?.selected_text || note?.user_note || note?.title || '').slice(0, 500);
      navigate(`/app/chats/${chatId}?q=${encodeURIComponent(`Regarding this study note:\n\n> ${text}\n\nPlease explain this in detail.`)}`);
      return;
    }
    setAiLoading(true);
    try {
      const res = await api.noteAiAction(chatId, noteId, action);
      if (res.type === 'result' && res.content) {
        setAiResult({ action: res.action || action, content: res.content });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setAiLoading(false);
    }
  };

  const handleExport = () => {
    if (!chatId || notes.length === 0) {
      showToast('No notes to export');
      return;
    }
    
    try {
      let htmlContent = `
        <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
        <head>
          <meta charset='utf-8'>
          <title>Study Notes</title>
          <style>
            body { font-family: 'Segoe UI', Arial, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 800px; margin: 0 auto; padding: 20px; }
            h1 { color: #1a1a1a; text-align: center; border-bottom: 2px solid #e5e5e5; padding-bottom: 10px; margin-bottom: 30px; font-size: 24px; }
            .note-container { margin-bottom: 30px; padding: 20px; border: 1px solid #e5e5e5; border-radius: 8px; background: #fafafa; }
            h2 { color: #006aff; margin-top: 0; margin-bottom: 12px; font-size: 18px; border-bottom: 1px solid #f0f0f0; padding-bottom: 8px; }
            .badge { display: inline-block; padding: 3px 8px; background: #e8f0ff; color: #006aff; border-radius: 4px; font-size: 11px; font-weight: bold; margin-left: 10px; vertical-align: middle; border: 1px solid #b3d4ff; }
            .source-info { font-size: 12px; color: #6b6b6b; margin-bottom: 15px; font-style: italic; }
            .quote { border-left: 3px solid #006aff; background: #f4f4f4; padding: 10px 15px; margin: 0 0 15px 0; font-style: italic; color: #4a4a4a; font-size: 13px; }
            .note-body { font-size: 14px; }
            table { border-collapse: collapse; width: 100%; margin-bottom: 15px; }
            th, td { border: 1px solid #e5e5e5; padding: 8px; text-align: left; }
            th { background-color: #f4f4f4; }
            code { background: #f0f0f0; padding: 2px 4px; border-radius: 3px; font-family: monospace; font-size: 13px; }
            pre { background: #f0f0f0; padding: 10px; border-radius: 5px; font-size: 13px; white-space: pre-wrap; }
            p { margin: 0 0 10px 0; }
          </style>
        </head>
        <body>
          <h1>Study Notes Export</h1>
      `;

      notes.forEach((note) => {
        let tagLabel = '';
        if (note.tag && TAG_META[note.tag]) {
          tagLabel = `<span class="badge">${TAG_META[note.tag].label}</span>`;
        }
        
        let sourceHTML = '';
        if (note.document_id) {
          const docName = docMap[note.document_id] || 'Document';
          sourceHTML = `<div class="source-info">Source: ${docName} ${note.page_number ? `(Page ${note.page_number})` : ''}</div>`;
        }

        let quoteHTML = '';
        if (note.selected_text) {
          // Replace newlines with <br> for HTML rendering of the plain text quote
          quoteHTML = `<div class="quote">${note.selected_text.replace(/\n/g, '<br/>')}</div>`;
        }
        
        let userNoteHTML = '';
        if (note.user_note) {
          const markdownElement = (
            <Markdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
              {note.user_note}
            </Markdown>
          );
          userNoteHTML = `<div class="note-body">${renderToStaticMarkup(markdownElement)}</div>`;
        }

        htmlContent += `
          <div class="note-container">
            <h2>${note.title || 'Untitled Note'} ${tagLabel}</h2>
            ${sourceHTML}
            ${quoteHTML}
            ${userNoteHTML}
          </div>
        `;
      });

      htmlContent += `</body></html>`;

      // Word handles UTF-8 characters properly if we include the BOM signature
      const blob = new Blob(['\ufeff', htmlContent], { type: 'application/msword' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Study_Notes_${chatId}.doc`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Exported to Word Document');
    } catch (e) {
      console.error(e);
      showToast('Export failed');
    }
  };

  const handleOpenPdf = (docId: string, pageNumber: number = 1, filename?: string) => {
    const docName = filename || docMap[docId] || 'Document';
    setPdfSource({
      document_id: docId,
      original_filename: docName,
      page_number: pageNumber || 1,
    });
  };

  if (loading) return <CircleBuffer minHeight={300} size={36} />;

  return (
    <div className="notes-page">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="notes-toast" role="status">
          <CheckCircle2 size={16} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ── KPI Dashboard Bar (Theme Consistent Metric Cards, No Harsh Borders) ── */}
      <div className="notes-kpi-bar">
        <div
          className="notes-kpi-card"
          onClick={() => setTagFilter('all')}
          title="Click to show all notes"
        >
          <div className="notes-kpi-info">
            <span className="notes-kpi-label">Total Notes</span>
            <span className="notes-kpi-value">{kpiStats.total}</span>
          </div>
          <div className="notes-kpi-icon total">
            <StickyNote size={18} />
          </div>
        </div>

        <div className="notes-kpi-card">
          <div className="notes-kpi-info">
            <span className="notes-kpi-label">Categories</span>
            <span className="notes-kpi-value">{kpiStats.tags}</span>
          </div>
          <div className="notes-kpi-icon tags">
            <Tag size={18} />
          </div>
        </div>

        <div className="notes-kpi-card">
          <div className="notes-kpi-info">
            <span className="notes-kpi-label">Source Books</span>
            <span className="notes-kpi-value">{kpiStats.sources}</span>
          </div>
          <div className="notes-kpi-icon sources">
            <FileText size={18} />
          </div>
        </div>

        <div
          className="notes-kpi-card"
          onClick={() => setTagFilter(tagFilter === 'pinned' ? 'all' : 'pinned')}
          title="Click to toggle pinned notes"
        >
          <div className="notes-kpi-info">
            <span className="notes-kpi-label">Pinned</span>
            <span className="notes-kpi-value">{kpiStats.pinned}</span>
          </div>
          <div className="notes-kpi-icon pinned">
            <Pin size={18} />
          </div>
        </div>
      </div>

      {/* ── Search & Actions Toolbar ── */}
      <div className="notes-toolbar">
        <div className="notes-search-box">
          <Search size={15} className="search-icon" />
          <input
            type="text"
            placeholder="Search notes by title, concept, or source..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              className="notes-search-clear"
              onClick={() => setSearchQuery('')}
              title="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="notes-toolbar-actions">
          <button
            className="notes-toolbar-btn"
            onClick={handleExport}
            title="Download notes as Word Document"
          >
            <Download size={14} />
            <span>Export to Word</span>
          </button>

          <div className="notes-view-toggle" role="group" aria-label="View mode toggle">
            <button
              className={viewMode === 'grid' ? 'active' : ''}
              onClick={() => setViewMode('grid')}
              title="Grid View"
            >
              <LayoutGrid size={15} />
            </button>
            <button
              className={viewMode === 'list' ? 'active' : ''}
              onClick={() => setViewMode('list')}
              title="List View"
            >
              <List size={15} />
            </button>
          </div>

          <button
            className="btn btn-primary notes-new-btn"
            onClick={() => openEditor()}
          >
            <Plus size={16} />
            <span>New Note</span>
          </button>
        </div>
      </div>

      {/* ── Tag / Category Filter Bar ── */}
      <div className="notes-tag-bar">
        <div className="notes-tag-chips">
          <button
            className={`notes-filter-chip ${tagFilter === 'all' ? 'active' : ''}`}
            onClick={() => setTagFilter('all')}
          >
            All <span className="chip-count">{tagCounts.all}</span>
          </button>

          {tagCounts.pinned > 0 && (
            <button
              className={`notes-filter-chip pinned-chip ${tagFilter === 'pinned' ? 'active' : ''}`}
              onClick={() => setTagFilter('pinned')}
            >
              <Pin size={12} className="chip-icon" />
              Pinned <span className="chip-count">{tagCounts.pinned}</span>
            </button>
          )}

          {Object.entries(TAG_META).map(([key, meta]) => {
            const Icon = meta.icon;
            const count = tagCounts[key] || 0;
            return (
              <button
                key={key}
                className={`notes-filter-chip tag-${key} ${tagFilter === key ? 'active' : ''}`}
                onClick={() => setTagFilter(key as TagFilter)}
              >
                <Icon size={12} className="chip-icon" />
                <span>{meta.label}</span>
                {count > 0 && <span className="chip-count">{count}</span>}
              </button>
            );
          })}
        </div>

        {documents.length > 0 && (
          <div className="notes-doc-select-wrapper">
            <button
              className={`notes-doc-custom-select ${docDropdownOpen ? 'open' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                setDocDropdownOpen(!docDropdownOpen);
              }}
              aria-label="Filter notes by document"
            >
              <FileText size={13} className="doc-select-icon" />
              <span className="doc-select-value">
                {docFilter === 'all' 
                  ? 'All Documents' 
                  : formatDocName(documents.find(d => d.id === docFilter)?.original_filename || '', 28)}
              </span>
              <ChevronDown size={14} className="doc-select-arrow" />
            </button>
            
            {docDropdownOpen && (
              <div className="notes-doc-custom-dropdown">
                <button 
                  className={`doc-option ${docFilter === 'all' ? 'selected' : ''}`}
                  onClick={() => { setDocFilter('all'); setDocDropdownOpen(false); }}
                >
                  <FileText size={13} className="option-icon" />
                  <span className="option-label">All Documents</span>
                  {docFilter === 'all' && <Check size={14} className="check-icon" />}
                </button>
                {documents.filter(d => d.status === 'ready').map(d => (
                  <button 
                    key={d.id}
                    className={`doc-option ${docFilter === d.id ? 'selected' : ''}`}
                    onClick={() => { setDocFilter(d.id); setDocDropdownOpen(false); }}
                  >
                    <FileText size={13} className="option-icon" />
                    <span className="option-label">{formatDocName(d.original_filename, 28)}</span>
                    {docFilter === d.id && <Check size={14} className="check-icon" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Notes Content: Grid or List ── */}
      {filteredNotes.length === 0 ? (
        <div className="notes-empty-state">
          <div className="notes-empty-icon-box">
            <StickyNote size={32} />
          </div>
          <h3>{notes.length === 0 ? 'No study notes yet' : 'No matching notes found'}</h3>
          <p>
            {notes.length === 0
              ? 'Click "+ New Note" above, or highlight any passage while reading a PDF to capture highlights with citations automatically.'
              : 'Try clearing your search query or switching category filters.'}
          </p>
          {notes.length === 0 ? (
            <button className="btn btn-primary" onClick={() => openEditor()}>
              <Plus size={15} /> Create your first note
            </button>
          ) : (
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => { setSearchQuery(''); setTagFilter('all'); setDocFilter('all'); }}
            >
              Reset all filters
            </button>
          )}
        </div>
      ) : (
        <div className={viewMode === 'grid' ? 'notes-grid' : 'notes-list'}>
          {filteredNotes.map(note => (
            <NoteCard
              key={note.id}
              note={note}
              docMap={docMap}
              copiedId={copiedId}
              aiMenuId={aiMenuId}
              aiLoading={aiLoading}
              onPin={() => handlePin(note)}
              onEdit={() => openEditor(note)}
              onDelete={() => handleDelete(note.id)}
              onCopy={() => handleCopy(note)}
              onAiMenuToggle={(e) => {
                e.stopPropagation();
                setAiMenuId(aiMenuId === note.id ? null : note.id);
              }}
              onAiAction={(action) => handleAiAction(note.id, action)}
              onOpenPdf={(docId, page, filename) => handleOpenPdf(docId, page, filename)}
            />
          ))}
        </div>
      )}

      {/* ── Editor Modal ── */}
      {editor.open && (
        <div className="note-editor-overlay" onClick={() => setEditor(INITIAL_EDITOR)}>
          <div className="note-editor-modal" onClick={e => e.stopPropagation()}>
            <div className="note-editor-header">
              <div className="note-editor-title-group">
                <div className="note-editor-icon-badge">
                  {editor.editId ? <Pencil size={16} /> : <StickyNote size={16} />}
                </div>
                <div>
                  <h3>{editor.editId ? 'Edit Study Note' : 'Create Study Note'}</h3>
                  <span className="note-editor-sub">Format with Markdown and LaTeX equations</span>
                </div>
              </div>
              <button
                className="btn-icon"
                onClick={() => setEditor(INITIAL_EDITOR)}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            <div className="note-editor-body">
              {/* Note Title */}
              <div className="note-form-group">
                <label className="note-form-label">Title</label>
                <input
                  className="note-form-input"
                  placeholder="e.g. Backpropagation Algorithm or Gradient Descent"
                  value={editor.title}
                  onChange={e => setEditor(prev => ({ ...prev, title: e.target.value }))}
                  autoFocus
                />
              </div>

              {/* Tag / Category Picker */}
              <div className="note-form-group">
                <label className="note-form-label">Category</label>
                <div className="note-tag-selector">
                  <button
                    type="button"
                    className={`tag-picker-btn none ${editor.tag === '' ? 'selected' : ''}`}
                    onClick={() => setEditor(prev => ({ ...prev, tag: '' }))}
                  >
                    None
                  </button>
                  {Object.entries(TAG_META).map(([key, meta]) => {
                    const Icon = meta.icon;
                    return (
                      <button
                        key={key}
                        type="button"
                        className={`tag-picker-btn tag-${key} ${editor.tag === key ? 'selected' : ''}`}
                        onClick={() => setEditor(prev => ({ ...prev, tag: key }))}
                      >
                        <Icon size={12} />
                        <span>{meta.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Highlighted text from PDF */}
              {(editor.selectedText || editor.editId) && (
                <div className="note-form-group">
                  <label className="note-form-label">
                    <Quote size={12} style={{ display: 'inline', marginRight: 4 }} />
                    Highlighted Passage (Source Text)
                  </label>
                  <textarea
                    className="note-form-textarea excerpt-input"
                    placeholder="Quoted excerpt from PDF document..."
                    value={editor.selectedText}
                    onChange={e => setEditor(prev => ({ ...prev, selectedText: e.target.value }))}
                    rows={2}
                  />
                </div>
              )}

              {/* User Note with Write / Preview Tabs */}
              <div className="note-form-group note-editor-content-group">
                <div className="note-editor-tabs-bar">
                  <label className="note-form-label" style={{ marginBottom: 0 }}>
                    Study Notes & Analysis
                  </label>
                  <div className="note-tab-switcher">
                    <button
                      type="button"
                      className={`note-tab-btn ${editorTab === 'write' ? 'active' : ''}`}
                      onClick={() => setEditorTab('write')}
                    >
                      <Pencil size={12} /> Write
                    </button>
                    <button
                      type="button"
                      className={`note-tab-btn ${editorTab === 'preview' ? 'active' : ''}`}
                      onClick={() => setEditorTab('preview')}
                    >
                      <Eye size={12} /> Preview
                    </button>
                  </div>
                </div>

                {editorTab === 'write' ? (
                  <>
                    <div className="note-format-toolbar">
                      <button type="button" className="fmt-btn" onClick={() => insertFormat('**', '**')} title="Bold">
                        <Bold size={13} />
                      </button>
                      <button type="button" className="fmt-btn" onClick={() => insertFormat('*', '*')} title="Italic">
                        <Italic size={13} />
                      </button>
                      <div className="fmt-separator" />
                      <button type="button" className="fmt-btn" onClick={() => insertFormat('\n- ')} title="Bullet List">
                        <List size={13} />
                      </button>
                      <button type="button" className="fmt-btn" onClick={() => insertFormat('\n1. ')} title="Numbered List">
                        <ListOrdered size={13} />
                      </button>
                      <button type="button" className="fmt-btn" onClick={() => insertFormat('\n- [ ] ')} title="Checklist Task">
                        <CheckSquare size={13} />
                      </button>
                      <div className="fmt-separator" />
                      <button type="button" className="fmt-btn" onClick={() => insertFormat('`', '`')} title="Inline Code">
                        <Code size={13} />
                      </button>
                      <button type="button" className="fmt-btn" onClick={() => insertFormat('\n```\n', '\n```')} title="Code Block">
                        Code
                      </button>
                      <div className="fmt-separator" />
                      <button type="button" className="fmt-btn" onClick={() => insertFormat('$', '$')} title="Inline Math: $E=mc^2$">
                        $Math$
                      </button>
                      <button type="button" className="fmt-btn" onClick={() => insertFormat('\n$$\n', '\n$$')} title="Math Block: $$...$$">
                        $$Block$$
                      </button>
                      <div className="fmt-separator" />
                      <button type="button" className="fmt-btn" onClick={() => insertFormat('\n> ')} title="Blockquote">
                        <Quote size={13} />
                      </button>
                    </div>

                    <textarea
                      ref={textareaRef}
                      className="note-form-textarea"
                      placeholder="Write your explanations, notes, or equations here...&#10;&#10;Supports **markdown**, lists, `code`, and math formulas like $E=mc^2$ or $$\int_0^\infty e^{-x} dx$$"
                      value={editor.userNote}
                      onChange={e => setEditor(prev => ({ ...prev, userNote: e.target.value }))}
                      onKeyDown={e => {
                        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                          e.preventDefault();
                          void saveNote();
                        }
                      }}
                      rows={8}
                    />
                  </>
                ) : (
                  <div className="note-preview-pane markdown-body">
                    {editor.userNote ? (
                      <Markdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                        {editor.userNote}
                      </Markdown>
                    ) : (
                      <div className="note-preview-empty">
                        <p>No note text entered yet. Switch back to "Write" to type your notes.</p>
                      </div>
                    )}
                  </div>
                )}
                <span className="note-shortcut-hint">
                  Press <kbd>Ctrl</kbd> + <kbd>Enter</kbd> to quickly save
                </span>
              </div>
            </div>

            <div className="note-editor-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setEditor(INITIAL_EDITOR)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={saveNote}
                disabled={saving}
              >
                {saving ? <CircleBuffer size={14} minHeight={0} /> : <Check size={14} />}
                <span>{editor.editId ? 'Save Changes' : 'Create Note'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── AI Result Modal ── */}
      {aiResult && (
        <div className="note-ai-result-overlay" onClick={() => setAiResult(null)}>
          <div className="note-ai-result-modal" onClick={e => e.stopPropagation()}>
            <div className="note-ai-header">
              <div className="note-ai-badge">
                <Sparkles size={16} />
                <span>{aiResult.action === 'summarize' ? 'Key Takeaways' : 'Explanation'}</span>
              </div>
              <button className="btn-icon" onClick={() => setAiResult(null)} aria-label="Close">
                <X size={16} />
              </button>
            </div>
            <div className="note-ai-result-content markdown-body">
              <Markdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
                {aiResult.content}
              </Markdown>
            </div>
            <div className="note-ai-footer">
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  navigator.clipboard.writeText(aiResult.content);
                  showToast('AI response copied');
                }}
              >
                <Copy size={13} /> Copy Content
              </button>
              <button className="btn btn-primary btn-sm" onClick={() => setAiResult(null)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── AI Loading Overlay ── */}
      {aiLoading && (
        <div className="note-ai-result-overlay">
          <div className="note-ai-result-modal loading-box">
            <CircleBuffer size={32} minHeight={0} />
            <p>AI is processing your study note...</p>
          </div>
        </div>
      )}

      {/* ── In-App PDF Source Viewer (Same as Documents Tab) ── */}
      {pdfSource && (
        <PdfSource
          source={pdfSource}
          close={() => setPdfSource(null)}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════
   NOTE CARD COMPONENT
   ═══════════════════════════════════════════════ */
function NoteCard({
  note,
  docMap,
  copiedId,
  aiMenuId,
  aiLoading,
  onPin,
  onEdit,
  onDelete,
  onCopy,
  onAiMenuToggle,
  onAiAction,
  onOpenPdf,
}: {
  note: NoteItem;
  docMap: Record<string, string>;
  copiedId: string | null;
  aiMenuId: string | null;
  aiLoading: boolean;
  onPin: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onCopy: () => void;
  onAiMenuToggle: (e: React.MouseEvent) => void;
  onAiAction: (action: string) => void;
  onOpenPdf: (docId: string, page: number, filename?: string) => void;
}) {
  const [excerptExpanded, setExcerptExpanded] = useState(false);
  const docName = note.document_id ? docMap[note.document_id] : null;
  const tagInfo = note.tag && TAG_META[note.tag] ? TAG_META[note.tag] : null;
  const TagIcon = tagInfo ? tagInfo.icon : Tag;
  const hasUserNote = Boolean(note.user_note && note.user_note.trim());
  const hasExcerpt = Boolean(note.selected_text && note.selected_text.trim());
  const isExcerptLong = (note.selected_text?.length || 0) > 160;

  // Format date nicely
  const formattedDate = useMemo(() => {
    try {
      const d = new Date(note.created_at);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return '';
    }
  }, [note.created_at]);

  return (
    <div className={`note-card ${note.tag ? `tag-${note.tag}` : 'tag-none'} ${note.is_pinned ? 'is-pinned' : ''}`}>
      {/* Top Header / Badges Row */}
      <div className="note-card-top-bar">
        <div className="note-badges-wrap">
          {tagInfo ? (
            <span className={`note-tag-badge tag-${note.tag}`}>
              <TagIcon size={11} className="tag-badge-icon" />
              <span>{tagInfo.label}</span>
            </span>
          ) : (
            <span className="note-tag-badge untagged">
              <StickyNote size={11} className="tag-badge-icon" />
              <span>Note</span>
            </span>
          )}

          {note.is_pinned && (
            <span className="note-pinned-indicator" title="Pinned to top">
              <Pin size={11} /> Pinned
            </span>
          )}
        </div>

        {/* Quick Actions (Pin, Copy, Edit, Delete) */}
        <div className="note-quick-actions">
          <button
            type="button"
            className={`note-btn-action ${note.is_pinned ? 'active-pin' : ''}`}
            onClick={onPin}
            title={note.is_pinned ? 'Unpin note' : 'Pin note to top'}
          >
            {note.is_pinned ? <PinOff size={14} /> : <Pin size={14} />}
          </button>
          <button
            type="button"
            className="note-btn-action"
            onClick={onCopy}
            title="Copy note with citation"
          >
            {copiedId === note.id ? <Check size={14} color="var(--accent-green)" /> : <Copy size={14} />}
          </button>
          <button
            type="button"
            className="note-btn-action"
            onClick={onEdit}
            title="Edit note"
          >
            <Pencil size={13} />
          </button>
          <button
            type="button"
            className="note-btn-action danger"
            onClick={onDelete}
            title="Delete note"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* Note Title */}
      <div className="note-title-section">
        <h4 className="note-card-title">
          {note.title || (hasExcerpt ? note.selected_text!.slice(0, 70) + (note.selected_text!.length > 70 ? '…' : '') : 'Untitled Study Note')}
        </h4>
      </div>

      {/* Source Citation Pill -> Opens in-app PDF viewer directly */}
      {docName && note.document_id && (
        <div className="note-source-pill">
          <button
            type="button"
            className="source-doc-btn"
            onClick={() => onOpenPdf(note.document_id!, note.page_number || 1, docName)}
            title={`Open ${docName} in PDF viewer`}
          >
            <FileText size={12} className="source-doc-icon" />
            <span className="source-doc-name">{formatDocName(docName, 26)}</span>
          </button>
          {note.page_number && (
            <button
              type="button"
              className="source-jump-btn"
              onClick={() => onOpenPdf(note.document_id!, note.page_number!, docName)}
              title={`Jump to Page ${note.page_number} in PDF viewer`}
            >
              <span>p.{note.page_number}</span>
              <ExternalLink size={10} />
            </button>
          )}
        </div>
      )}

      {/* PDF Highlight Quote */}
      {hasExcerpt && (
        <div className={`note-quote-block ${excerptExpanded ? 'expanded' : ''}`}>
          <Quote size={13} className="quote-mark-icon" />
          <div className="quote-text">
            {note.selected_text}
          </div>
          {isExcerptLong && (
            <button
              type="button"
              className="quote-expand-toggle"
              onClick={() => setExcerptExpanded(!excerptExpanded)}
            >
              {excerptExpanded ? (
                <>Show less <ChevronUp size={11} /></>
              ) : (
                <>Show more <ChevronDown size={11} /></>
              )}
            </button>
          )}
        </div>
      )}

      {/* User Note Markdown Content */}
      {hasUserNote ? (
        <div className="note-body-content markdown-body">
          <Markdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
            {note.user_note!}
          </Markdown>
        </div>
      ) : (
        /* Empty note prompt for notes created from PDF selection */
        <div className="note-empty-prompt" onClick={onEdit} role="button" title="Click to add personal study notes">
          <Pencil size={12} />
          <span>Add study notes, breakdown or formula insights…</span>
        </div>
      )}

      {/* Card Footer */}
      <div className="note-card-footer">
        <div className="note-date-tag">
          <Calendar size={12} />
          <span>{formattedDate}</span>
        </div>

        {/* AI Assist Menu */}
        <div className="note-ai-menu-container">
          <button
            type="button"
            className={`note-ai-btn ${aiMenuId === note.id ? 'active' : ''}`}
            onClick={onAiMenuToggle}
            disabled={aiLoading}
            title="AI study actions"
          >
            <Sparkles size={13} />
            <span>AI Assist</span>
            <ChevronDown size={11} />
          </button>

          {aiMenuId === note.id && (
            <div className="note-ai-dropdown" onClick={e => e.stopPropagation()}>
              <button onClick={() => onAiAction('summarize')}>
                <span className="ai-menu-icon" style={{ background: 'var(--accent-blue-light)', color: 'var(--accent-blue)' }}>
                  <Sparkles size={14} />
                </span>
                <div>
                  <strong>Key Takeaways</strong>
                  <small>Summarize core concepts</small>
                </div>
              </button>

              <button onClick={() => onAiAction('explain')}>
                <span className="ai-menu-icon" style={{ background: 'var(--accent-purple-light)', color: 'var(--accent-purple)' }}>
                  <BookOpen size={14} />
                </span>
                <div>
                  <strong>Explain Simply</strong>
                  <small>Plain English ELI5 breakdown</small>
                </div>
              </button>

              <button onClick={() => onAiAction('flashcard')}>
                <span className="ai-menu-icon" style={{ background: 'var(--accent-red-light)', color: 'var(--accent-red)' }}>
                  <CreditCard size={14} />
                </span>
                <div>
                  <strong>Convert to Flashcard</strong>
                  <small>Create spaced repetition card</small>
                </div>
              </button>

              <button onClick={() => onAiAction('quiz')}>
                <span className="ai-menu-icon" style={{ background: 'var(--accent-green-light)', color: 'var(--accent-green)' }}>
                  <HelpCircle size={14} />
                </span>
                <div>
                  <strong>Quiz MCQ Test</strong>
                  <small>Practice question on this topic</small>
                </div>
              </button>

              <button onClick={() => onAiAction('ask')}>
                <span className="ai-menu-icon" style={{ background: 'var(--bg-active)', color: 'var(--text-primary)' }}>
                  <MessageSquare size={14} />
                </span>
                <div>
                  <strong>Ask in Chat</strong>
                  <small>Discuss with AI tutor</small>
                </div>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
