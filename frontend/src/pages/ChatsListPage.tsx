import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MessageSquare, Plus, Search, Pencil, Trash2, Check, X,
} from 'lucide-react';
import { api } from '@/lib/api';
import { CircleBuffer } from '@/components/CircleBuffer';

interface ChatItem {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  document_count: number;
  message_count: number;
}

export default function ChatsListPage() {
  const navigate = useNavigate();
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const loadChats = async (searchTerm?: string) => {
    try {
      const res = await api.getChats({ search: searchTerm });
      setChats(res.items);
    } catch {
      setChats([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadChats();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadChats(search || undefined);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const handleNewChat = async () => {
    try {
      const chat = await api.createChat();
      navigate(`/app/chats/${chat.id}`);
    } catch {
      // Backend unavailable
    }
  };

  const handleRename = async (chatId: string) => {
    if (!editTitle.trim()) return;
    try {
      await api.renameChat(chatId, editTitle.trim());
      setChats((prev) =>
        prev.map((c) => (c.id === chatId ? { ...c, title: editTitle.trim() } : c))
      );
    } catch {
      // Handle error
    }
    setEditingId(null);
  };

  const handleDelete = async (chatId: string) => {
    if (!confirm('Delete this chat? This will remove all messages, documents, and topics.')) return;
    try {
      await api.deleteChat(chatId);
      setChats((prev) => prev.filter((c) => c.id !== chatId));
    } catch {
      // Handle error
    }
  };

  return (
    <div className="animate-fade-in" style={{ flex: 1, width: '100%', boxSizing: 'border-box' }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Chats</h1>
          <div className="page-subtitle">Manage your study conversations</div>
        </div>
        <div className="header-actions">
          <button className="btn btn-primary btn-sm" id="chats-new-btn" onClick={handleNewChat}>
            <Plus size={14} /> New Chat
          </button>
        </div>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ position: 'relative', maxWidth: 360 }}>
          <Search size={15} style={{
            position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
            color: 'var(--text-muted)', pointerEvents: 'none',
          }} />
          <input
            type="text"
            className="form-input"
            placeholder="Search chats…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ paddingLeft: 36, borderRadius: 'var(--radius-pill)' }}
            id="chats-search"
          />
        </div>
      </div>

      {/* Chats Table */}
      <div className="table-card">
        {loading ? (
          <CircleBuffer minHeight={220} size={36} />
        ) : chats.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr>
                <th>Chat Title</th>
                <th>Documents</th>
                <th>Messages</th>
                <th>Created</th>
                <th>Last Active</th>
                <th style={{ width: 100 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {chats.map((chat) => (
                <tr key={chat.id}>
                  <td
                    style={{ fontWeight: 600, cursor: 'pointer' }}
                    onClick={() => {
                      if (editingId !== chat.id) navigate(`/app/chats/${chat.id}`);
                    }}
                  >
                    {editingId === chat.id ? (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <input
                          type="text"
                          className="form-input"
                          value={editTitle}
                          onChange={(e) => setEditTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRename(chat.id);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          autoFocus
                          style={{ padding: '4px 8px', fontSize: 13 }}
                        />
                        <button
                          className="btn-icon"
                          style={{ padding: 4, border: 'none' }}
                          onClick={(e) => { e.stopPropagation(); handleRename(chat.id); }}
                        >
                          <Check size={14} style={{ color: 'var(--accent-green)' }} />
                        </button>
                        <button
                          className="btn-icon"
                          style={{ padding: 4, border: 'none' }}
                          onClick={(e) => { e.stopPropagation(); setEditingId(null); }}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      chat.title
                    )}
                  </td>
                  <td>
                    <span className="badge badge-blue">{chat.document_count} docs</span>
                  </td>
                  <td style={{ color: 'var(--text-muted)' }}>{chat.message_count}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12.5 }}>
                    {new Date(chat.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12.5 }}>
                    {new Date(chat.updated_at).toLocaleDateString()}
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button
                        className="btn-icon"
                        title="Rename"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingId(chat.id);
                          setEditTitle(chat.title);
                        }}
                        style={{ padding: 6 }}
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        className="btn-icon"
                        title="Delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(chat.id);
                        }}
                        style={{ padding: 6, color: 'var(--accent-red)' }}
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
              <MessageSquare size={24} />
            </div>
            <div className="empty-state-title">
              {search ? 'No matching chats' : 'No chats yet'}
            </div>
            <div className="empty-state-sub">
              {search ? 'Try a different search term' : 'Create your first chat to start studying'}
            </div>
            {!search && (
              <button className="btn btn-primary btn-sm" onClick={handleNewChat}>
                <Plus size={14} /> New Chat
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
