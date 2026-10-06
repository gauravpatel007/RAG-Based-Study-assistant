import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, Link, Outlet, useLocation } from 'react-router-dom';
import { Upload, FileText, Lightbulb, HelpCircle, Loader2, Bot, User, Square, Plus, Mic, ArrowUp, ArrowDown, X, ThumbsUp, ThumbsDown, Copy, Check, Layers, Network, Edit2, Trash2, Clock, StickyNote } from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { api } from '@/lib/api';
import { formatDocName, formatCitationNumbers } from '@/lib/formatters';
import PdfSource, { type Source } from '@/components/PdfSource';
import { CircleBuffer } from '@/components/CircleBuffer';

type MessageItem = Awaited<ReturnType<typeof api.getMessages>>['items'][number];
type DocItem = Awaited<ReturnType<typeof api.getChatDocuments>>['items'][number];

function UserMessageActions({ msg, onEdit, onDelete }: { msg: MessageItem; onEdit: () => void; onDelete: () => void }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(msg.content).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <div className="message-actions user-actions" style={{ display: 'flex', gap: '8px', marginTop: '6px', paddingLeft: '4px' }}>
      <button className="btn-icon" style={{ padding: '6px', width: '28px', height: '28px', borderRadius: '50%' }} onClick={onEdit} title="Edit">
        <Edit2 size={14} />
      </button>
      <button className="btn-icon" style={{ padding: '6px', width: '28px', height: '28px', borderRadius: '50%' }} onClick={handleCopy} title="Copy">
        {copied ? <Check size={14} color="#00b259" /> : <Copy size={14} />}
      </button>
      <button className="btn-icon" style={{ padding: '6px', width: '28px', height: '28px', borderRadius: '50%', color: '#e22134' }} onClick={onDelete} title="Delete">
        <Trash2 size={14} />
      </button>
    </div>
  );
}

function MessageActionButtons({ msg, chatId }: { msg: MessageItem; chatId: string }) {
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<number | null>(msg.feedback || null);

  const handleCopy = () => {
    navigator.clipboard.writeText(formatCitationNumbers(msg.content)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleFeedback = async (val: number) => {
    const newVal = feedback === val ? 0 : val;
    setFeedback(newVal);
    try {
      await api.sendFeedback(chatId, msg.id, newVal);
    } catch (e) {
      console.error('Feedback error', e);
    }
  };

  return (
    <div className="message-actions" style={{ display: 'flex', gap: '8px', marginTop: '6px', paddingLeft: '4px' }}>
      <button className="btn-icon" style={{ padding: '6px', width: '28px', height: '28px', borderRadius: '50%' }} onClick={handleCopy} title="Copy">
        {copied ? <Check size={14} color="#00b259" /> : <Copy size={14} />}
      </button>
      <button className="btn-icon" style={{ padding: '6px', width: '28px', height: '28px', borderRadius: '50%', color: feedback === 1 ? '#006aff' : '' }} onClick={() => handleFeedback(1)} title="Helpful">
        <ThumbsUp size={14} />
      </button>
      <button className="btn-icon" style={{ padding: '6px', width: '28px', height: '28px', borderRadius: '50%', color: feedback === -1 ? '#e22134' : '' }} onClick={() => handleFeedback(-1)} title="Not Helpful">
        <ThumbsDown size={14} />
      </button>
      {msg.created_at && msg.updated_at && new Date(msg.updated_at).getTime() > new Date(msg.created_at).getTime() + 100 && (
        <div style={{ marginLeft: '12px', display: 'flex', alignItems: 'center' }}>
          <span className="badge badge-green" title="Generation Time">
            <Clock size={12} />
            {((new Date(msg.updated_at).getTime() - new Date(msg.created_at).getTime()) / 1000).toFixed(1)}s
          </span>
        </div>
      )}
    </div>
  );
}

export default function ChatViewPage() {
  const { chatId } = useParams<{ chatId: string }>();
  const location = useLocation();
  const end = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const userScrolledUpRef = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState('Chat');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [documents, setDocuments] = useState<DocItem[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [sending, setSending] = useState(false);
  const [activeJob, setActiveJob] = useState<string | null>(null);
  const [jobStage, setJobStage] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [source, setSource] = useState<Source | null>(null);
  const [progress, setProgress] = useState<Record<string, string>>({});
  const activeChat = useRef(chatId);
  const isTopics = location.pathname.endsWith('/topics');
  const isMindMaps = location.pathname.endsWith('/mind-maps');
  const isQuiz = location.pathname.endsWith('/quiz');
  const isCompare = location.pathname.endsWith('/compare');
  const isFlashcards = location.pathname.endsWith('/flashcards');
  const isNotes = location.pathname.endsWith('/notes');
  const isChat = !isTopics && !isQuiz && !isCompare && !isFlashcards && !isMindMaps && !isNotes;

  const handleScroll = () => {
    const el = panelRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const isScrolledUp = distanceFromBottom > 150;
    userScrolledUpRef.current = isScrolledUp;
    setShowScrollDown(isScrolledUp);
  };

  const scrollToBottom = () => {
    end.current?.scrollIntoView({ behavior: 'smooth' });
    setShowScrollDown(false);
  };

  const reload = useCallback(async () => {
    if (!chatId) return;
    try {
      const [chat, docs] = await Promise.all([api.getChat(chatId), api.getChatDocuments(chatId)]);
      const all: MessageItem[] = [];
      let cursor: string | undefined;
      do {
        const page = await api.getMessages(chatId, cursor);
        all.push(...page.items);
        cursor = page.next_cursor ?? undefined;
      } while (cursor);
      if (activeChat.current !== chatId) return;
      setTitle(chat.title); setDocuments(docs.items); setMessages(all); setActiveJob(chat.active_job);
    } catch (e) { if (activeChat.current === chatId) setError((e as Error).message || 'Unable to load this chat.'); }
    finally { if (activeChat.current === chatId) setLoading(false); }
  }, [chatId]);

  useEffect(() => {
    activeChat.current = chatId;
    userScrolledUpRef.current = false;
    setMessages([]); setDocuments([]); setSelected([]); setActiveJob(null); setProgress({}); setSource(null); setError(''); setInput(''); setLoading(true);
    void reload();
  }, [reload]);
  useEffect(() => { const q = new URLSearchParams(location.search).get('q'); if (q) setInput(q); }, [location.search]);
  useEffect(() => {
    if (!userScrolledUpRef.current) {
      end.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(() => {
    if (!activeJob) return;
    setJobStage('');
    const stream = new EventSource(`/api/v1/jobs/${activeJob}/events`, { withCredentials: true });
    stream.addEventListener('snapshot', (event) => {
      if (activeChat.current !== chatId) return;
      const data = JSON.parse(event.data);
      setJobStage(data.progress?.stage ?? '');
      if (data.message) setMessages(current => current.some(m => m.id === data.message.id)
        ? current.map(m => m.id === data.message.id ? data.message : m) : [...current, data.message]);
      if (['complete', 'failed', 'cancelled', 'interrupted'].includes(data.status)) {
        stream.close(); setActiveJob(null);
        if (data.error_code && data.status === 'failed') setError(`Processing failed: ${data.error_code}`);
        void reload();
      }
    });
    stream.addEventListener('expired', () => { stream.close(); window.location.assign('/login'); });
    stream.addEventListener('removed', () => { stream.close(); setActiveJob(null); void reload(); });
    // EventSource reconnects automatically; job snapshots replace rather than append text.
    return () => stream.close();
  }, [activeJob, chatId, reload]);

  const hasProcessing = documents.some(d => !['ready', 'failed', 'cancelled'].includes(d.status));
  useEffect(() => {
    if (!chatId || !hasProcessing) return;
    let stopped = false;
    const timer = setInterval(async () => {
      try {
        const docs = await api.getChatDocuments(chatId);
        if (stopped) return;
        setDocuments(docs.items);
        for (const doc of docs.items.filter(d => d.status !== 'ready')) {
          const detail = await api.documentDetail(doc.id);
          if (stopped) return;
          const job = detail.jobs.find(j => j.type === 'ingest_document');
          if (job) setProgress(p => ({ ...p, [doc.id]: job.error_code || (job.progress?.pages ? `${job.progress.pages}/${job.progress.total} pages` : job.status) }));
        }
      } catch { /* API notice displays actionable failures. */ }
    }, 2000);
    return () => { stopped = true; clearInterval(timer); };
  }, [chatId, hasProcessing]);

  async function send() {
    if (!chatId || !input.trim() || sending || activeJob) return;
    setSending(true); setError('');
    const question = input.trim();
    try {
      const job = await api.sendMessage(chatId, question, selected.length ? selected : undefined);
      if (activeChat.current !== chatId) return;
      setInput('');
      userScrolledUpRef.current = false;
      await reload();
      setActiveJob(job.job_id);
      setTimeout(() => end.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    } catch (e) { setError((e as Error).message || 'Unable to send this question.'); }
    finally { setSending(false); }
  }
  async function upload(files: FileList | null) {
    if (!chatId || !files) return;
    setUploading(true); setError('');
    try { for (const file of Array.from(files)) await api.uploadDocument(chatId, file); await reload(); }
    catch (e) { setError((e as Error).message || 'Upload failed.'); }
    finally { setUploading(false); if (fileInput.current) fileInput.current.value = ''; }
  }
  async function retry(docId: string) {
    try {
      const detail = await api.documentDetail(docId);
      const job = detail.jobs.find(j => j.type === 'ingest_document');
      if (job) await api.retryJob(job.id);
      await reload();
    } catch (e) { setError((e as Error).message); }
  }

  if (loading) return <div className="skeleton" style={{ height: 400 }} aria-label="Loading chat" />;
  return <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 56px)', width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}>
    <div className="chat-header">
      {isEditingTitle ? (
        <input
          type="text"
          value={editTitle}
          onChange={e => setEditTitle(e.target.value)}
          onBlur={async () => {
            setIsEditingTitle(false);
            if (editTitle.trim() && editTitle.trim() !== title) {
              const oldTitle = title;
              setTitle(editTitle.trim());
              try {
                await api.renameChat(chatId!, editTitle.trim());
                window.dispatchEvent(new Event('chat-updated'));
              } catch (e) {
                setTitle(oldTitle);
              }
            }
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') setIsEditingTitle(false);
          }}
          autoFocus
          className="form-input"
          style={{ fontSize: 22, fontWeight: 700, margin: 0, padding: '2px 8px', maxWidth: '300px' }}
        />
      ) : (
        <h1
          className="page-title editable-title"
          style={{ fontSize: 22, cursor: 'text', borderBottom: '2px solid transparent', display: 'inline-block', transition: 'border-color 0.2s', padding: '2px 8px', margin: '0 -8px', borderRadius: '4px' }}
          onClick={() => { setEditTitle(title); setIsEditingTitle(true); }}
          onMouseEnter={(e) => e.currentTarget.style.borderBottomColor = 'currentColor'}
          onMouseLeave={(e) => e.currentTarget.style.borderBottomColor = 'transparent'}
          title="Click to edit chat name"
        >
          {title}
        </h1>
      )}
    </div>
    <div className="chat-tabs">
      <Link className={`chat-tab${isChat ? ' active' : ''}`} id="tab-chat" to={`/app/chats/${chatId}`}><FileText size={14} /> Chat</Link>
      <Link className={`chat-tab${isTopics ? ' active' : ''}`} id="tab-topics" to={`/app/chats/${chatId}/topics`}><Lightbulb size={14} /> Important Topics</Link>
      <Link className={`chat-tab${isQuiz ? ' active' : ''}`} id="tab-quiz" to={`/app/chats/${chatId}/quiz`}><HelpCircle size={14} /> Quiz</Link>
      <Link className={`chat-tab${isCompare ? ' active' : ''}`} id="tab-compare" to={`/app/chats/${chatId}/compare`}><FileText size={14} /> Compare Sources</Link>
      <Link className={`chat-tab${isFlashcards ? ' active' : ''}`} id="tab-flashcards" to={`/app/chats/${chatId}/flashcards`}><Layers size={14} /> Flashcards</Link>
      <Link className={`chat-tab${isMindMaps ? ' active' : ''}`} id="tab-mind-maps" to={`/app/chats/${chatId}/mind-maps`}><Network size={14} /> Mind Maps</Link>
      <Link className={`chat-tab${isNotes ? ' active' : ''}`} id="tab-notes" to={`/app/chats/${chatId}/notes`}><StickyNote size={14} /> Notes</Link>
    </div>
    {error && (
      <div role="alert" className="inline-error inline-error-banner">
        <span>{error}</span>
        <button
          type="button"
          className="inline-error-close"
          onClick={() => setError('')}
          aria-label="Close notification"
          title="Close notification"
        >
          <X size={16} />
        </button>
      </div>
    )}
    {!isChat ? <Outlet /> : <div className="chat-container" style={{ flex: 1, minHeight: 400, position: 'relative', display: 'flex', flexDirection: 'column' }}>
      <div className="doc-chips">
        {documents.map(doc => <div className="doc-chip" key={doc.id}>
          {doc.status === 'ready' && <input type="checkbox" aria-label={`Use ${doc.original_filename}`} checked={selected.includes(doc.id)} onChange={e => setSelected(s => e.target.checked ? [...s, doc.id] : s.filter(id => id !== doc.id))} />}
          <div style={{ display: 'flex', gap: '2px', alignItems: 'center' }}>
            <button className="btn btn-sm" disabled={doc.status !== 'ready'} title={doc.original_filename} onClick={() => setSource({ document_id: doc.id, original_filename: doc.original_filename, page_number: 1 })}>{formatDocName(doc.original_filename, 22)}</button>
          </div>
          <span className={`doc-status ${doc.status === 'ready' ? 'ready' : doc.status === 'failed' ? 'failed' : 'processing'}`} />
          <small>{doc.status === 'ready' ? `${doc.page_count} pages` : progress[doc.id] || doc.status}</small>
          {['failed', 'cancelled'].includes(doc.status) && <button className="btn btn-sm" onClick={() => void retry(doc.id)}>Retry</button>}
          <button
            className="btn-icon"
            style={{ padding: 2, marginLeft: 4, width: '20px', height: '20px' }}
            onClick={() => {
              if (window.confirm(`Are you sure you want to remove "${doc.original_filename}" from this chat?`)) {
                api.deleteDocument(doc.id).then(reload).catch(e => setError((e as Error).message));
              }
            }}
            title="Remove document"
          >
            <X size={12} />
          </button>
        </div>)}
        <button className="doc-chip" disabled={uploading} onClick={() => fileInput.current?.click()}><Upload size={14} /> {uploading ? 'Uploading…' : 'Add PDF'}</button>
        {documents.some(d => d.status === 'ready') && (
          <span style={{ alignSelf: 'center', fontSize: '12px', color: 'var(--text-muted)', marginLeft: 8 }}>
            {selected.length ? (
              <>
                Searching {selected.length} of {documents.filter(d => d.status === 'ready').length} selected (
                <button
                  type="button"
                  style={{ background: 'none', border: 'none', color: 'var(--accent-blue)', cursor: 'pointer', padding: 0, textDecoration: 'underline', fontSize: 'inherit' }}
                  onClick={() => setSelected([])}
                >
                  Search all
                </button>
                )
              </>
            ) : (
              ''
            )}
          </span>
        )}
      </div>
      <div className="messages-panel" ref={panelRef} onScroll={handleScroll} aria-live="polite">
        {loading ? (
          <CircleBuffer minHeight={300} size={36} />
        ) : !messages.length ? (
          <div className="empty-state"><div className="empty-state-icon"><FileText size={24} /></div><h2 className="empty-state-title">Your study space starts here</h2><p className="empty-state-sub">Upload a textbook PDF, then ask a question. This chat has its own documents and memory.</p></div>
        ) : null}
        {messages.map(msg => <div className={`message ${msg.role}`} key={msg.id}>
          <div className={`message-avatar ${msg.role}`}>{msg.role === 'user' ? <User size={16} /> : <Bot size={16} />}</div>
          <div className="message-content">
            {editingMessageId === msg.id ? (
              <div className="message-bubble editing">
                <textarea 
                  value={editingContent} 
                  onChange={e => setEditingContent(e.target.value)} 
                  className="form-input" 
                  style={{ width: '100%', minHeight: '80px', marginBottom: '8px', fontSize: '15px' }}
                />
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button className="btn btn-sm" onClick={() => setEditingMessageId(null)}>Cancel</button>
                  <button className="btn btn-sm btn-primary" onClick={() => {
                    api.editMessage(chatId!, msg.id, editingContent, selected.length ? selected : undefined).then(() => {
                      setEditingMessageId(null);
                      reload();
                    }).catch(e => setError(e.message));
                  }}>Save & Submit</button>
                </div>
              </div>
            ) : (
              <div className="message-bubble markdown-body">
                <Markdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{formatCitationNumbers(msg.content)}</Markdown>
                {['queued', 'generating'].includes(msg.status) && <small><Loader2 size={12} className="animate-spin" /> {jobStage === 'restoring_index' ? 'Restoring saved document search index…' : msg.status === 'queued' ? 'Queued…' : 'Generating…'}</small>}
                {['failed', 'stopped', 'interrupted'].includes(msg.status) && <p className="inline-error">Answer {msg.status}. You can send the question again.</p>}
              </div>
            )}
            <div className="source-chips">{msg.sources?.map((s, i) => <button className="source-chip" key={i} disabled={!s.document_id} title={s.original_filename} onClick={() => setSource(s)}><FileText size={11} /> {formatDocName(s.original_filename, 20)} · p.{s.page_number}</button>)}</div>
            {msg.role === 'assistant' && msg.status === 'complete' && <MessageActionButtons msg={msg} chatId={chatId!} />}
            {msg.role === 'user' && editingMessageId !== msg.id && (
              <UserMessageActions 
                msg={msg} 
                onEdit={() => { setEditingMessageId(msg.id); setEditingContent(msg.content); }} 
                onDelete={() => {
                  if (window.confirm("Delete this message? This will also remove the AI's response.")) {
                    api.deleteMessage(chatId!, msg.id).then(() => reload()).catch(e => setError(e.message));
                  }
                }} 
              />
            )}
          </div>
        </div>)}<div ref={end} />
      </div>
      
      {showScrollDown && (
        <button 
          onClick={scrollToBottom}
          className="scroll-to-bottom-btn"
          style={{
            position: 'absolute',
            bottom: '90px',
            right: '50%',
            transform: 'translateX(50%)',
            background: 'var(--bg-card)',
            border: '1px solid var(--border-default)',
            color: 'var(--text-primary)',
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 10,
            transition: 'opacity 0.2s, transform 0.2s',
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'translateX(50%) scale(1.05)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'translateX(50%) scale(1)'}
          aria-label="Scroll to bottom"
          title="Scroll to bottom"
        >
          <ArrowDown size={18} strokeWidth={2.5} />
        </button>
      )}
      
      <div className="composer-wrapper">
        <div className="composer">
          <button className="composer-action-btn" title="Upload PDF" onClick={() => fileInput.current?.click()}>
            <Plus size={22} strokeWidth={1.5} />
          </button>
          <textarea className="composer-input" id="chat-composer" aria-label="Question" placeholder="Ask a question about your textbooks…" value={input} maxLength={4000} onChange={e => setInput(e.target.value)} rows={1} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void send(); } }} />
          <button className="composer-action-btn" title="Voice Input">
            <Mic size={20} strokeWidth={1.5} />
          </button>
          {activeJob ? (
            <button className="composer-send" onClick={() => void api.cancelJob(activeJob)}>
              <Square size={14} fill="currentColor" />
            </button>
          ) : (
            <button className="composer-send" id="chat-send-btn" title="Send message" disabled={!input.trim() || sending} onClick={() => void send()}>
              <ArrowUp size={18} strokeWidth={2.5} />
            </button>
          )}
        </div>
      </div>
      <input ref={fileInput} type="file" accept="application/pdf,.pdf" multiple hidden onChange={e => void upload(e.target.files)} />
    </div>}
    {source && <PdfSource source={source} close={() => setSource(null)} />}
  </div>;
}
