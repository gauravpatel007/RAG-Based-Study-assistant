import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Plus, Search, MessageSquare, CheckCircle2, FileText, Loader2, ArrowRight } from 'lucide-react';
import { api } from '@/lib/api';

interface DocItem {
  id: string;
  original_filename: string;
  byte_size?: number;
  page_count?: number | null;
  chat_id?: string;
  chat_title?: string;
}

interface ChatItem {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  document_count: number;
  message_count: number;
}

interface AddToChatModalProps {
  doc: DocItem | null;
  onClose: () => void;
  onSuccess?: (chatId: string, chatTitle: string) => void;
}

export function AddToChatModal({ doc, onClose, onSuccess }: AddToChatModalProps) {
  const navigate = useNavigate();
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [successInfo, setSuccessInfo] = useState<{ chatId: string; chatTitle: string } | null>(null);
  const [creatingChat, setCreatingChat] = useState(false);
  const [newChatTitle, setNewChatTitle] = useState('');

  useEffect(() => {
    if (!doc) return;

    // Close on Escape key
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    // Fetch user chats
    const fetchChats = async () => {
      try {
        setLoading(true);
        let all: ChatItem[] = [];
        let cursor: string | undefined;
        do {
          const res = await api.getChats({ cursor, limit: 100 });
          all = [...all, ...res.items];
          cursor = res.next_cursor ?? undefined;
        } while (cursor);
        setChats(all);
      } catch (err: any) {
        setError(err.message || 'Failed to load chats.');
      } finally {
        setLoading(false);
      }
    };

    void fetchChats();

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [doc, onClose]);

  if (!doc) return null;

  const handleSelectChat = (chatId: string) => {
    if (chatId === doc.chat_id) return; // already in this chat
    setSelectedChatId(chatId);
    setError('');
  };

  const handleAddDocument = async (targetChatId?: string) => {
    const chatId = targetChatId || selectedChatId;
    if (!chatId) return;
    const targetChat = chats.find(c => c.id === chatId);
    const chatTitle = targetChat?.title || 'Selected Chat';

    try {
      setSubmitting(true);
      setError('');
      await api.addDocumentToChat(doc.id, chatId);
      setSuccessInfo({ chatId, chatTitle });
      if (onSuccess) onSuccess(chatId, chatTitle);
    } catch (err: any) {
      setError(err.message || 'Failed to add document to chat.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCreateAndAdd = async () => {
    if (!newChatTitle.trim()) return;
    try {
      setSubmitting(true);
      setError('');
      const newChat = await api.createChat(newChatTitle.trim());
      await api.addDocumentToChat(doc.id, newChat.id);
      setSuccessInfo({ chatId: newChat.id, chatTitle: newChat.title });
      if (onSuccess) onSuccess(newChat.id, newChat.title);
    } catch (err: any) {
      setError(err.message || 'Failed to create chat and add document.');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredChats = chats.filter(c =>
    c.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(5px)',
        WebkitBackdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-default)',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '520px',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.35)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
          animation: 'scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '20px 24px 16px',
            borderBottom: '1px solid var(--border-default)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(168, 85, 247, 0.15))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--accent-blue)',
              }}
            >
              <Plus size={20} strokeWidth={2.5} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}>
                Add Document to Chat
              </h2>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Select a chat to make this document available for questions & study
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="btn-icon"
            style={{ color: 'var(--text-muted)', padding: '6px', borderRadius: '8px' }}
            title="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Success View */}
        {successInfo ? (
          <div style={{ padding: '36px 24px', textAlign: 'center' }}>
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                background: 'rgba(34, 197, 94, 0.15)',
                color: '#22c55e',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
              }}
            >
              <CheckCircle2 size={32} />
            </div>
            <h3 style={{ fontSize: '18px', fontWeight: '700', margin: '0 0 8px', color: 'var(--text-primary)' }}>
              Document Added!
            </h3>
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: '0 0 24px' }}>
              <strong>"{doc.original_filename}"</strong> has been successfully added to{' '}
              <strong>"{successInfo.chatTitle}"</strong>.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
                style={{ padding: '8px 20px' }}
              >
                Close
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  onClose();
                  navigate(`/app/chats/${successInfo.chatId}`);
                }}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 20px' }}
              >
                Go to Chat <ArrowRight size={15} />
              </button>
            </div>
          </div>
        ) : (
          <>
            {/* Modal Body */}
            <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
              {/* Document Banner */}
              <div
                style={{
                  background: 'var(--bg-hover)',
                  border: '1px solid var(--border-default)',
                  borderRadius: '12px',
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  marginBottom: '16px',
                }}
              >
                <div
                  style={{
                    padding: '8px',
                    borderRadius: '8px',
                    background: 'var(--bg-card)',
                    color: 'var(--accent-blue)',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
                  }}
                >
                  <FileText size={20} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: '13.5px',
                      fontWeight: '600',
                      color: 'var(--text-primary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {doc.original_filename}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', gap: '8px' }}>
                    {doc.chat_title && (
                      <span>
                        Current chat: <strong style={{ color: 'var(--text-secondary)' }}>{doc.chat_title}</strong>
                      </span>
                    )}
                    {doc.page_count && <span>• {doc.page_count} pages</span>}
                  </div>
                </div>
              </div>

              {/* Error Alert */}
              {error && (
                <div
                  style={{
                    padding: '10px 14px',
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    borderRadius: '8px',
                    color: '#ef4444',
                    fontSize: '13px',
                    marginBottom: '16px',
                  }}
                >
                  {error}
                </div>
              )}

              {/* Search Bar */}
              <div style={{ position: 'relative', marginBottom: '14px' }}>
                <Search
                  size={15}
                  style={{
                    position: 'absolute',
                    left: 12,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)',
                    pointerEvents: 'none',
                  }}
                />
                <input
                  type="text"
                  className="form-input"
                  placeholder="Search chats…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{
                    width: '100%',
                    paddingLeft: '36px',
                    paddingRight: '12px',
                    height: '38px',
                    borderRadius: '10px',
                    fontSize: '13px',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Chat List */}
              <div
                style={{
                  maxHeight: '260px',
                  overflowY: 'auto',
                  border: '1px solid var(--border-default)',
                  borderRadius: '12px',
                  background: 'var(--bg-card)',
                  padding: '6px',
                }}
              >
                {loading ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <Loader2 size={20} className="animate-spin" style={{ margin: '0 auto 8px' }} />
                    <div style={{ fontSize: '12px' }}>Loading chats…</div>
                  </div>
                ) : filteredChats.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                    {search ? 'No chats match your search.' : 'No chats found. Create one below!'}
                  </div>
                ) : (
                  filteredChats.map(chat => {
                    const isCurrent = chat.id === doc.chat_id;
                    const isSelected = selectedChatId === chat.id;

                    return (
                      <div
                        key={chat.id}
                        onClick={() => handleSelectChat(chat.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          borderRadius: '8px',
                          marginBottom: '4px',
                          cursor: isCurrent ? 'not-allowed' : 'pointer',
                          opacity: isCurrent ? 0.6 : 1,
                          background: isSelected
                            ? 'rgba(99, 102, 241, 0.12)'
                            : 'transparent',
                          border: isSelected
                            ? '1.5px solid var(--accent-blue)'
                            : '1.5px solid transparent',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                          <div
                            style={{
                              color: isSelected ? 'var(--accent-blue)' : 'var(--text-muted)',
                              flexShrink: 0,
                            }}
                          >
                            <MessageSquare size={16} />
                          </div>
                          <div style={{ minWidth: 0, flex: 1 }}>
                            <div
                              style={{
                                fontSize: '13.5px',
                                fontWeight: isSelected ? '600' : '500',
                                color: isSelected ? 'var(--text-primary)' : 'var(--text-primary)',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {chat.title}
                            </div>
                            <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginTop: '1px' }}>
                              {chat.document_count ?? 0} docs • {chat.message_count ?? 0} messages
                            </div>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '12px' }}>
                          {isCurrent ? (
                            <span
                              style={{
                                fontSize: '11px',
                                padding: '2px 8px',
                                borderRadius: '12px',
                                background: 'var(--bg-hover)',
                                color: 'var(--text-muted)',
                                border: '1px solid var(--border-default)',
                              }}
                            >
                              Current
                            </span>
                          ) : (
                            <div
                              style={{
                                width: '18px',
                                height: '18px',
                                borderRadius: '50%',
                                border: isSelected
                                  ? '5px solid var(--accent-blue)'
                                  : '2px solid var(--border-default)',
                                background: 'var(--bg-card)',
                                transition: 'all 0.15s ease',
                              }}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Or Create New Chat Accordion */}
              <div style={{ marginTop: '14px' }}>
                {!creatingChat ? (
                  <button
                    type="button"
                    onClick={() => setCreatingChat(true)}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: '4px 0',
                      fontSize: '12.5px',
                      color: 'var(--accent-blue)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontWeight: '500',
                    }}
                  >
                    <Plus size={14} /> Create a new chat
                  </button>
                ) : (
                  <div
                    style={{
                      background: 'var(--bg-hover)',
                      border: '1px solid var(--border-default)',
                      borderRadius: '10px',
                      padding: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-primary)' }}>
                      New Chat Title
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. Biology Study Group"
                        value={newChatTitle}
                        onChange={e => setNewChatTitle(e.target.value)}
                        style={{ flex: 1, fontSize: '13px', height: '34px', borderRadius: '8px' }}
                      />
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={handleCreateAndAdd}
                        disabled={submitting || !newChatTitle.trim()}
                        style={{ fontSize: '12px', padding: '0 14px', height: '34px' }}
                      >
                        {submitting ? 'Creating…' : 'Create & Add'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => {
                          setCreatingChat(false);
                          setNewChatTitle('');
                        }}
                        style={{ fontSize: '12px', padding: '0 10px', height: '34px' }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: '14px 24px',
                borderTop: '1px solid var(--border-default)',
                background: 'var(--bg-surface)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '10px',
              }}
            >
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
                disabled={submitting}
                style={{ padding: '8px 18px', fontSize: '13px' }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => handleAddDocument()}
                disabled={!selectedChatId || submitting}
                style={{
                  padding: '8px 20px',
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                }}
              >
                {submitting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" /> Adding…
                  </>
                ) : (
                  <>
                    <Plus size={15} /> Add to Chat
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
