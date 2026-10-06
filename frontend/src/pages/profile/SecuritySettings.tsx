import { useState } from 'react';
import { Loader2, LogOut, Eye, EyeOff } from 'lucide-react';
import { api } from '@/lib/api';

export function SecuritySettings() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  
  const [savingPassword, setSavingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  const [revoking, setRevoking] = useState(false);
  const [revokeSuccess, setRevokeSuccess] = useState('');

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match');
      return;
    }
    if (newPassword.length < 4) {
      setPasswordError('New password must be at least 4 characters');
      return;
    }

    try {
      setSavingPassword(true);
      setPasswordError('');
      setPasswordSuccess('');
      await api.changePassword({ current_password: currentPassword, new_password: newPassword });
      setPasswordSuccess('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(''), 3000);
    } catch (err: any) {
      setPasswordError(err.message || 'Failed to change password');
    } finally {
      setSavingPassword(false);
    }
  };

  const handleRevokeSessions = async () => {
    if (!window.confirm('Are you sure you want to log out of all other devices?')) return;
    try {
      setRevoking(true);
      setRevokeSuccess('');
      await api.revokeOtherSessions();
      setRevokeSuccess('All other sessions revoked successfully');
      setTimeout(() => setRevokeSuccess(''), 3000);
    } catch (err: any) {
      alert(err.message || 'Failed to revoke sessions');
    } finally {
      setRevoking(false);
    }
  };

  return (
    <div className="profile-page fade-in">
      <div className="profile-page-header">
        <h1>Security</h1>
        <p>Manage your password and active sessions.</p>
      </div>

      <form className="profile-section" onSubmit={handlePasswordSubmit}>
        <h3>Change Password</h3>
        
        {passwordError && <div className="alert alert-error mb-4">{passwordError}</div>}
        {passwordSuccess && <div className="alert alert-success mb-4">{passwordSuccess}</div>}

        <div className="form-group" style={{ maxWidth: '400px', marginBottom: '16px' }}>
          <label className="form-label">Current Password</label>
          <div style={{ position: 'relative' }}>
            <input 
              type={showCurrent ? "text" : "password"} 
              className="form-input" 
              value={currentPassword} 
              onChange={e => setCurrentPassword(e.target.value)} 
              required 
            />
            <button 
              type="button" 
              onClick={() => setShowCurrent(!showCurrent)}
              style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
            >
              {showCurrent ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <div className="form-group" style={{ maxWidth: '400px', marginBottom: '16px' }}>
          <label className="form-label">New Password</label>
          <div style={{ position: 'relative' }}>
            <input 
              type={showNew ? "text" : "password"} 
              className="form-input" 
              value={newPassword} 
              onChange={e => setNewPassword(e.target.value)} 
              required 
              minLength={4}
            />
            <button 
              type="button" 
              onClick={() => setShowNew(!showNew)}
              style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
            >
              {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <div className="form-group" style={{ maxWidth: '400px', marginBottom: '24px' }}>
          <label className="form-label">Confirm New Password</label>
          <div style={{ position: 'relative' }}>
            <input 
              type={showNew ? "text" : "password"} 
              className="form-input" 
              value={confirmPassword} 
              onChange={e => setConfirmPassword(e.target.value)} 
              required 
              minLength={4}
            />
          </div>
        </div>

        <button type="submit" className="btn btn-primary" disabled={savingPassword}>
          {savingPassword ? <Loader2 className="animate-spin" size={16} /> : null}
          Update Password
        </button>
      </form>

      <div className="profile-section">
        <h3>Active Sessions</h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>
          Log out of all other devices and browsers. Your current session will remain active.
        </p>
        
        {revokeSuccess && <div className="alert alert-success mb-4">{revokeSuccess}</div>}

        <button type="button" className="btn btn-secondary" onClick={handleRevokeSessions} disabled={revoking}>
          {revoking ? <Loader2 className="animate-spin" size={16} /> : <LogOut size={16} />}
          Sign out of all other sessions
        </button>
      </div>
    </div>
  );
}
