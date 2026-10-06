import { useState, useEffect } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Home, MessageSquare, FileText, Plus, LogOut,
  GraduationCap, Menu, X, MessageCircle, Pencil, Trash2
} from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import { api } from '@/lib/api';
import { ImageModal } from '@/components/ImageModal';

const mainNavItems = [
  { href: '/app', label: 'Study Home', icon: Home, exact: true },
  { href: '/app/chats', label: 'Chats', icon: MessageSquare },
  { href: '/app/documents', label: 'Documents', icon: FileText },
];
import { LayoutDashboard, Users, Activity, FileText as FileTextIcon, Settings, Shield, Brain, HardDrive } from 'lucide-react';

const adminNavItems = [
  { href: '/app/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/app/admin/users', label: 'Users', icon: Users },
  { href: '/app/admin/documents', label: 'Documents', icon: FileTextIcon },
  { href: '/app/admin/storage', label: 'Storage', icon: HardDrive },
  { href: '/app/admin/ai-usage', label: 'AI Usage', icon: Activity },
  { href: '/app/admin/rag-analytics', label: 'RAG Analytics', icon: Brain },
  { href: '/app/admin/models', label: 'AI Models', icon: Settings },
  { href: '/app/admin/audit', label: 'Audit & Security', icon: Shield },
];

export default function AppShell() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [recentChats, setRecentChats] = useState<{ id: string; title: string }[]>([]);
  const [visibleCount, setVisibleCount] = useState(6);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const isAdmin = user?.username === 'admin';

  useEffect(() => {
    if (isAdmin) return; // Don't load chats for admin
    const loadAllChats = async () => {
      try {
        let all: { id: string; title: string }[] = [];
        let cursor: string | undefined;
        do {
          const res = await api.getChats({ cursor, limit: 100 });
          all = [...all, ...res.items];
          cursor = res.next_cursor ?? undefined;
        } while (cursor);
        setRecentChats(all);
      } catch {
        api.getChats().then(res => setRecentChats(res.items)).catch(() => {});
      }
    };
    void loadAllChats();
  }, [location.pathname, isAdmin]);

  const remainingCount = Math.max(0, recentChats.length - visibleCount);
  const countToShow = Math.min(10, remainingCount);

  const handleSeeMore = () => {
    setVisibleCount(prev => prev + 10);
  };

  const handleNewChat = async () => {
    try {
      const chat = await api.createChat();
      navigate(`/app/chats/${chat.id}`);
      setMobileOpen(false);
    } catch {
      // If backend is down, navigate to chats list
      navigate('/app/chats');
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleStartRename = (e: React.MouseEvent, chat: { id: string; title: string }) => {
    e.preventDefault();
    e.stopPropagation();
    setEditingChatId(chat.id);
    setEditTitle(chat.title || 'New Chat');
  };

  const handleSaveRename = async (e: React.FormEvent, chatId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (!editTitle.trim()) {
      setEditingChatId(null);
      return;
    }
    try {
      await api.renameChat(chatId, editTitle.trim());
      setRecentChats(prev => prev.map(c => c.id === chatId ? { ...c, title: editTitle.trim() } : c));
      setEditingChatId(null);
    } catch (err) {
      console.error('Failed to rename chat', err);
    }
  };

  const handleDelete = async (e: React.MouseEvent, chatId: string) => {
    e.preventDefault();
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this chat?')) {
      try {
        await api.deleteChat(chatId);
        setRecentChats(prev => prev.filter(c => c.id !== chatId));
        if (location.pathname === `/app/chats/${chatId}`) {
          navigate('/app/chats');
        }
      } catch (err) {
        console.error('Failed to delete chat', err);
      }
    }
  };

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return location.pathname === href;
    return location.pathname === href || location.pathname.startsWith(href + '/');
  };

  const currentNavItems = isAdmin ? adminNavItems : mainNavItems;

  return (
    <>
      {/* Mobile menu button */}
      <button
        className="mobile-menu-btn"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label="Toggle menu"
      >
        {mobileOpen ? <X size={18} /> : <Menu size={18} />}
      </button>

      {/* Mobile overlay */}
      <div
        className={`mobile-overlay${mobileOpen ? ' open' : ''}`}
        onClick={() => setMobileOpen(false)}
      />

      <div className="app-layout">
        {/* Sidebar */}
        <aside className={`sidebar${mobileOpen ? ' open' : ''}`}>
          {/* Brand - Fixed */}
          <Link to={isAdmin ? "/app/admin" : "/app"} style={{ textDecoration: 'none', color: 'inherit' }} onClick={() => setMobileOpen(false)}>
            <div className="sidebar-brand">
              <div className="brand-row">
                <div className="brand-icon">
                  <GraduationCap size={18} />
                </div>
                <div>
                  <div className="brand-name">Study Assistant</div>
                  <div className="brand-sub">{isAdmin ? 'Admin Portal' : 'AI Study Workspace'}</div>
                </div>
              </div>
            </div>
          </Link>

          {/* Main Navigation - FIXED, NEVER SCROLLS */}
          <nav className="sidebar-main-nav">
            {currentNavItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href, item.exact);
              return (
                <Link
                  to={item.href}
                  key={item.href}
                  style={{ textDecoration: 'none' }}
                  onClick={() => setMobileOpen(false)}
                >
                  <button
                    className={`nav-item${active ? ' active' : ''}`}
                    id={`nav-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <span className="nav-item-icon">
                      <Icon size={17} />
                    </span>
                    {item.label}
                  </button>
                </Link>
              );
            })}
          </nav>

          {/* Scrollable Recent Chats Section (Only for non-admin) */}
          {!isAdmin && recentChats.length > 0 && (
            <div className="sidebar-recent-section">
              <div className="sidebar-recent-header">
                Recent Chats
              </div>
              <div className="sidebar-recent-scroll">
                {recentChats.slice(0, visibleCount).map(chat => (
                  <Link
                    to={`/app/chats/${chat.id}`}
                    key={chat.id}
                    style={{ textDecoration: 'none' }}
                    onClick={(e) => {
                      if (editingChatId === chat.id) e.preventDefault();
                      else setMobileOpen(false);
                    }}
                  >
                    <button
                      className={`nav-item${location.pathname === `/app/chats/${chat.id}` ? ' active' : ''}`}
                      title={chat.title || 'New Chat'}
                      style={{ paddingLeft: 14, position: 'relative', paddingRight: '48px' }}
                    >
                      <span className="nav-item-icon">
                        <MessageCircle size={15} />
                      </span>
                      {editingChatId === chat.id ? (
                        <form onSubmit={(e) => handleSaveRename(e, chat.id)} style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                          <input 
                            autoFocus
                            value={editTitle} 
                            onChange={e => setEditTitle(e.target.value)} 
                            onClick={e => { e.preventDefault(); e.stopPropagation(); }}
                            onBlur={(e) => handleSaveRename(e as unknown as React.FormEvent, chat.id)}
                            style={{ width: '100%', background: 'var(--bg-canvas)', border: '1px solid var(--border-focus)', borderRadius: '4px', padding: '2px 4px', outline: 'none', color: 'inherit', fontSize: 'inherit', fontFamily: 'inherit' }}
                          />
                        </form>
                      ) : (
                        <span className="truncate">{chat.title || 'New Chat'}</span>
                      )}

                      {editingChatId !== chat.id && (
                        <div 
                          className="chat-actions"
                          style={{ position: 'absolute', right: '8px', display: 'flex', gap: '2px', alignItems: 'center' }}
                        >
                          <div
                            onClick={(e) => handleStartRename(e, chat)}
                            style={{ padding: '4px', cursor: 'pointer', borderRadius: '4px', display: 'flex' }}
                            className="chat-action-btn"
                          >
                            <Pencil size={13} />
                          </div>
                          <div
                            onClick={(e) => handleDelete(e, chat.id)}
                            style={{ padding: '4px', cursor: 'pointer', borderRadius: '4px', color: '#e22134', display: 'flex' }}
                            className="chat-action-btn"
                          >
                            <Trash2 size={13} />
                          </div>
                        </div>
                      )}
                    </button>
                  </Link>
                ))}

                {remainingCount > 0 && (
                  <button
                    type="button"
                    className="see-more-btn"
                    onClick={handleSeeMore}
                  >
                    <Plus size={13} />
                    See {countToShow} more
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="sidebar-footer" style={{ marginTop: 'auto' }}>
            {!isAdmin && (
              <button
                className="new-chat-btn"
                id="new-chat-btn"
                onClick={handleNewChat}
              >
                <Plus size={16} />
                New Chat
              </button>
            )}

            <Link to="/app/profile" className="sidebar-user" style={{ textDecoration: 'none' }} onClick={() => setMobileOpen(false)}>
              <div className="avatar">
                {user?.avatar_url ? (
                  <img 
                    src={user.avatar_url} 
                    alt="Avatar" 
                    style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }} 
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setIsImageModalOpen(true);
                    }}
                  />
                ) : (
                  (user?.display_name?.charAt(0) || user?.username?.charAt(0) || 'U').toUpperCase()
                )}
              </div>
              <div className="sidebar-user-info">
                <span className="sidebar-user-name">
                  {user?.display_name || (user?.username ? user.username.charAt(0).toUpperCase() + user.username.slice(1) : 'Student')}
                </span>
                <span className="sidebar-user-badge">@{user?.username}</span>
              </div>
            </Link>

            <div className="sidebar-utils">
              <button
                className="util-btn logout"
                title="Logout"
                id="util-logout"
                onClick={handleLogout}
              >
                <LogOut size={16} />
                Logout
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="main-content">
          <div className="page-content">
            <Outlet />
          </div>
        </main>
      </div>

      {user?.avatar_url && (
        <ImageModal
          isOpen={isImageModalOpen}
          onClose={() => setIsImageModalOpen(false)}
          imageUrl={user.avatar_url}
          altText="User Avatar"
        />
      )}
    </>
  );
}
