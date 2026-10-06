import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { Eye, EyeOff, X, Users } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import { api } from '@/lib/api';
import AdminUserDetail from './AdminUserDetail';
import { CircleBuffer } from '@/components/CircleBuffer';

interface AdminUser {
  id: string;
  username: string;
  is_active: boolean;
  created_at: string;
}
export default function AdminUsers() {
  const { user } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({ username: '', password: '', is_active: true });
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    fetchUsers();
  }, []);
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && modalOpen) {
        closeModal();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [modalOpen]);
  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await api.getAdminUsers();
      setUsers(res.users);
      setError('');
    } catch (err: any) {
      setError(err.message || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };
  const openCreate = () => {
    setEditingUser(null);
    setFormData({ username: '', password: '', is_active: true });
    setShowPassword(false);
    setFormError('');
    setModalOpen(true);
  };
  const openEdit = (u: AdminUser) => {
    setEditingUser(u);
    setFormData({ username: u.username, password: '', is_active: u.is_active });
    setShowPassword(false);
    setFormError('');
    setModalOpen(true);
  };
  const closeModal = () => {
    setModalOpen(false);
    setShowPassword(false);
  };
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formData.username.trim()) {
      return setFormError('Username is required');
    }

    if (!editingUser && !formData.password) {
      return setFormError('Password is required for new users');
    }

    try {
      setSaving(true);
      if (editingUser) {
        await api.updateAdminUser(editingUser.id, {
          username: formData.username,
          password: formData.password || undefined,
          is_active: formData.is_active
        });
      } else {
        await api.createAdminUser({
          username: formData.username,
          password: formData.password
        });
      }
      await fetchUsers();
      closeModal();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save user');
    } finally {
      setSaving(false);
    }
  };
  const handleDelete = async (userId: string, username: string) => {
    if (!window.confirm(`Are you sure you want to delete user "${username}"?\nThis will also delete all their chats and documents permanently.`)) return;

    try {
      await api.deleteAdminUser(userId);
      setUsers(users.filter(u => u.id !== userId));
    } catch (err: any) {
      alert(err.message || 'Failed to delete user');
    }
  };
  const handleToggleStatus = async (u: AdminUser) => {
    try {
      await api.updateAdminUser(u.id, { is_active: !u.is_active });
      setUsers(users.map(x => x.id === u.id ? { ...x, is_active: !u.is_active } : x));
    } catch (err: any) {
      alert(err.message || 'Failed to update status');
    }
  };
  if (user?.username !== 'admin') {
    return <Navigate to="/app" replace />;
  }
  const filteredUsers = users.filter(u => u.username.toLowerCase().includes(search.toLowerCase()));
  return (
    <div>
      <div style={{ marginBottom: '32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '16px',
            background: 'rgba(59, 130, 246, 0.1)',
            color: '#3b82f6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <Users size={24} />
          </div>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: '700', margin: 0 }}>User Management</h1>
            <p style={{ color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>View and manage registered users in the system.</p>
          </div>
        </div>
        <button onClick={openCreate} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          Add User
        </button>
      </div>
      {error && <div style={{ padding: '12px 16px', background: '#FEF2F2', color: '#EF4444', borderRadius: '8px', marginBottom: '24px' }}>{error}</div>}
      <div style={{ marginTop: '20px' }}>
        <div style={{ marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-card)', padding: '10px 16px', borderRadius: '24px', width: '300px', border: '1px solid var(--border-default)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--text-muted)', marginRight: '8px' }}>
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
            <input
              type="text"
              placeholder="Search users..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ border: 'none', outline: 'none', width: '100%', fontSize: '14px', background: 'transparent' }}
            />
          </div>
        </div>

        <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '1px solid var(--border-default)', overflow: 'hidden' }}>
          {loading ? (
            <CircleBuffer minHeight={260} size={36} />
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-default)', background: 'var(--bg-active)' }}>
                  <th style={{ padding: '16px 24px', fontWeight: '600', fontSize: '11px', letterSpacing: '0.5px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Username</th>
                  <th style={{ padding: '16px 24px', fontWeight: '600', fontSize: '11px', letterSpacing: '0.5px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Joined Date</th>
                  <th style={{ padding: '16px 24px', fontWeight: '600', fontSize: '11px', letterSpacing: '0.5px', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Status</th>
                  <th style={{ padding: '16px 24px', fontWeight: '600', fontSize: '11px', letterSpacing: '0.5px', color: 'var(--text-muted)', textTransform: 'uppercase', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>No users found.</td>
                  </tr>
                ) : filteredUsers.map(u => (
                  <tr 
                    key={u.id} 
                    onClick={() => setSelectedUserId(u.id)}
                    style={{ 
                      borderBottom: '1px solid var(--border-default)', 
                      background: 'var(--bg-card)',
                      cursor: 'pointer',
                      transition: 'background 0.15s ease'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-active)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'var(--bg-card)'}
                  >
                    <td style={{ padding: '16px 24px', fontWeight: '500' }}>
                      {u.username}
                      {u.username === 'admin' && <span style={{ marginLeft: '8px', fontSize: '11px', background: 'var(--bg-active)', color: 'var(--text-primary)', padding: '2px 6px', borderRadius: '4px' }}>Admin</span>}
                    </td>
                    <td style={{ padding: '16px 24px', color: 'var(--text-secondary)' }}>
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td style={{ padding: '16px 24px' }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (u.username !== 'admin') handleToggleStatus(u);
                        }}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px', borderRadius: '20px',
                          fontSize: '12px', fontWeight: '600', border: 'none',
                          cursor: u.username === 'admin' ? 'default' : 'pointer',
                          background: u.is_active ? '#EEF2FF' : '#FEF2F2',
                          color: u.is_active ? '#4F46E5' : '#EF4444'
                        }}
                      >
                        <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: u.is_active ? '#4F46E5' : '#EF4444' }}></div>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </button>
                    </td>
                    <td style={{ padding: '16px 24px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button 
                          onClick={(e) => { e.stopPropagation(); setSelectedUserId(u.id); }} 
                          style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid var(--border-default)', background: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#6366F1' }}
                          title="View Details"
                        >
                          <Eye size={14} />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); openEdit(u); }} style={{ width: '32px', height: '32px', borderRadius: '8px', border: '1px solid var(--border-default)', background: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--text-secondary)' }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(u.id, u.username); }}
                          disabled={u.username === 'admin'}
                          style={{
                            width: '32px', height: '32px', borderRadius: '8px',
                            border: u.username === 'admin' ? '1px solid #f0f0f0' : '1px solid #FEE2E2',
                            background: u.username === 'admin' ? '#fafafa' : '#FEF2F2',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: u.username === 'admin' ? 'not-allowed' : 'pointer',
                            color: u.username === 'admin' ? '#ccc' : '#EF4444'
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      {modalOpen && (
        <div
          onClick={closeModal}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            backdropFilter: 'blur(3px)',
            cursor: 'pointer'
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: 'var(--bg-card)',
              borderRadius: '12px',
              padding: '24px',
              width: '100%',
              maxWidth: '400px',
              boxShadow: '0 10px 25px rgba(0,0,0,0.15)',
              cursor: 'default',
              position: 'relative'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '700' }}>{editingUser ? 'Edit User' : 'Create User'}</h2>
              <button
                type="button"
                onClick={closeModal}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '4px',
                  borderRadius: '6px'
                }}
                title="Close"
              >
                <X size={18} />
              </button>
            </div>

            {formError && <div style={{ padding: '10px 12px', background: '#FEF2F2', color: '#EF4444', borderRadius: '6px', marginBottom: '16px', fontSize: '13px' }}>{formError}</div>}

            <form onSubmit={handleSave}>
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '500' }}>Username</label>
                <input
                  type="text"
                  value={formData.username}
                  onChange={e => setFormData({ ...formData, username: e.target.value })}
                  placeholder="Enter username"
                  style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--border-default)', borderRadius: '6px', outline: 'none', boxSizing: 'border-box', fontSize: '14px', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
                  disabled={editingUser?.username === 'admin'}
                />
              </div>

              {!editingUser && (
                <div style={{ marginBottom: '20px' }}>
                  <label style={{ display: 'block', marginBottom: '6px', fontSize: '13px', fontWeight: '500' }}>
                    Password
                  </label>
                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={formData.password}
                      onChange={e => setFormData({ ...formData, password: e.target.value })}
                      placeholder="Enter password"
                      style={{ width: '100%', padding: '10px 42px 10px 12px', border: '1px solid var(--border-default)', borderRadius: '6px', outline: 'none', boxSizing: 'border-box', fontSize: '14px', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(prev => !prev)}
                      title={showPassword ? 'Hide password' : 'Show password'}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      style={{
                        position: 'absolute',
                        right: '10px',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: 'var(--text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '4px'
                      }}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                </div>
              )}
              {editingUser && editingUser.username !== 'admin' && (
                <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    id="isActive"
                    checked={formData.is_active}
                    onChange={e => setFormData({ ...formData, is_active: e.target.checked })}
                    style={{ accentColor: 'var(--accent-blue)', width: '16px', height: '16px' }}
                  />
                  <label htmlFor="isActive" style={{ fontSize: '14px', userSelect: 'none', cursor: 'pointer' }}>Account is Active</label>
                </div>
              )}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={closeModal} className="btn btn-secondary" disabled={saving}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving...' : 'Save User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedUserId && (
        <AdminUserDetail 
          userId={selectedUserId} 
          onClose={() => setSelectedUserId(null)} 
          onUpdate={fetchUsers} 
        />
      )}
    </div>
  );
}
