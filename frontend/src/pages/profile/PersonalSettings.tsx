import { useState, useEffect, useRef } from 'react';
import { Camera, User as UserIcon, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useAuth } from '@/features/auth/AuthContext';
import { ImageModal } from '@/components/ImageModal';
import { CircleBuffer } from '@/components/CircleBuffer';

export function PersonalSettings() {
  const { user: authUser, setUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    username: '',
    display_name: '',
    email: '',
    phone_number: '',
    date_of_birth: '',
    bio: '',
    institution: '',
    course: '',
    avatar_url: '',
    version: 0,
  });

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const data = await api.getProfile();
      setFormData({
        username: data.username || '',
        display_name: data.display_name || '',
        email: data.email || '',
        phone_number: data.phone_number || '',
        date_of_birth: data.date_of_birth || '',
        bio: data.bio || '',
        institution: data.institution || '',
        course: data.course || '',
        avatar_url: data.avatar_url || '',
        version: data.version,
      });
      // Sync auth context if needed
      if (authUser && (authUser.display_name !== data.display_name || authUser.avatar_url !== data.avatar_url)) {
        setUser({ ...authUser, display_name: data.display_name, avatar_url: data.avatar_url });
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarClick = () => {
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setAvatarUploading(true);
      setError('');
      const updated = await api.uploadAvatar(file);
      setFormData(prev => ({
        ...prev,
        avatar_url: updated.avatar_url || '',
        version: updated.version,
      }));
      setSuccess('Avatar updated successfully');
      setTimeout(() => setSuccess(''), 3000);
      if (authUser) setUser({ ...authUser, avatar_url: updated.avatar_url });
    } catch (err: any) {
      setError(err.message || 'Failed to upload avatar');
    } finally {
      setAvatarUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemoveAvatar = async () => {
    try {
      setAvatarUploading(true);
      const updated = await api.deleteAvatar();
      setFormData(prev => ({
        ...prev,
        avatar_url: '',
        version: updated.version,
      }));
      if (authUser) setUser({ ...authUser, avatar_url: null });
    } catch (err: any) {
      setError(err.message || 'Failed to remove avatar');
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError('');
      setSuccess('');
      const updated = await api.updateProfile({
        username: formData.username,
        display_name: formData.display_name,
        phone_number: formData.phone_number,
        date_of_birth: formData.date_of_birth,
        bio: formData.bio,
        institution: formData.institution,
        course: formData.course,
        version: formData.version,
      });
      setFormData(prev => ({ ...prev, version: updated.version }));
      setSuccess('Profile updated successfully');
      setTimeout(() => setSuccess(''), 3000);
      if (authUser) setUser({ ...authUser, display_name: updated.display_name });
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
      if (err.code === 'EDIT_CONFLICT') {
        loadProfile();
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <CircleBuffer minHeight={300} size={36} />;
  }

  return (
    <div className="profile-page fade-in">
      <div className="profile-page-header">
        <h1>Personal Information</h1>
        <p>Update your photo and personal details.</p>
      </div>

      {error && <div className="alert alert-error mb-6">{error}</div>}
      {success && <div className="alert alert-success mb-6">{success}</div>}

      <div className="profile-section">
        <h3>Avatar</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <div 
            style={{ 
              width: '80px', height: '80px', borderRadius: '50%', 
              background: 'var(--bg-active)', display: 'flex', 
              alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden', position: 'relative'
            }}
          >
            {formData.avatar_url ? (
              <img 
                src={formData.avatar_url} 
                alt="Avatar" 
                style={{ width: '100%', height: '100%', objectFit: 'cover', cursor: 'pointer' }}
                onClick={() => setIsImageModalOpen(true)}
              />
            ) : (
              <UserIcon size={32} color="var(--text-muted)" />
            )}
            {avatarUploading && (
              <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Loader2 className="animate-spin text-white" size={20} />
              </div>
            )}
          </div>
          <div>
            <div style={{ display: 'flex', gap: '12px', marginBottom: '8px' }}>
              <button className="btn btn-secondary" onClick={handleAvatarClick} disabled={avatarUploading}>
                <Camera size={16} /> Change Photo
              </button>
              {formData.avatar_url && (
                <button className="btn btn-secondary" onClick={handleRemoveAvatar} disabled={avatarUploading} style={{ color: 'var(--accent-red)' }}>
                  Remove
                </button>
              )}
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>JPG, PNG or WebP. Max 10MB.</p>
            <input type="file" ref={fileInputRef} onChange={handleAvatarChange} accept="image/jpeg,image/png,image/webp" style={{ display: 'none' }} />
          </div>
        </div>
      </div>

      <form className="profile-section" onSubmit={handleSubmit}>
        <h3>Details</h3>
        <div className="form-grid">
          <div className="form-group">
            <label className="form-label">Username</label>
            <input type="text" className="form-input" value={formData.username} onChange={e => setFormData({ ...formData, username: e.target.value })} />
          </div>
          <div className="form-group">
            <label className="form-label">Display Name</label>
            <input type="text" className="form-input" value={formData.display_name} onChange={e => setFormData({ ...formData, display_name: e.target.value })} placeholder="How you want to be called" />
          </div>
          
          <div className="form-group">
            <label className="form-label">Email</label>
            <input type="email" className="form-input" value={formData.email} disabled />
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Email cannot be changed.</span>
          </div>
          <div className="form-group">
            <label className="form-label">Phone Number</label>
            <input type="tel" className="form-input" value={formData.phone_number} onChange={e => setFormData({ ...formData, phone_number: e.target.value })} />
          </div>

          <div className="form-group">
            <label className="form-label">Date of Birth</label>
            <input type="date" className="form-input" value={formData.date_of_birth} onChange={e => setFormData({ ...formData, date_of_birth: e.target.value })} />
          </div>
          
          <div className="form-group">
            <label className="form-label">Institution / Organization</label>
            <input type="text" className="form-input" value={formData.institution} onChange={e => setFormData({ ...formData, institution: e.target.value })} />
          </div>

          <div className="form-group full-width">
            <label className="form-label">Bio</label>
            <textarea className="form-input" value={formData.bio} onChange={e => setFormData({ ...formData, bio: e.target.value })} rows={3} placeholder="A short bio about yourself..." />
          </div>
        </div>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? <Loader2 className="animate-spin" size={16} /> : null}
            Save Changes
          </button>
        </div>
      </form>
      
      {formData.avatar_url && (
        <ImageModal 
          isOpen={isImageModalOpen} 
          onClose={() => setIsImageModalOpen(false)} 
          imageUrl={formData.avatar_url} 
          altText="Profile Picture" 
        />
      )}
    </div>
  );
}
