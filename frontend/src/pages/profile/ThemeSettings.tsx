import { useState } from 'react';
import { Loader2, Moon, Sun, Check } from 'lucide-react';
import { useTheme } from '@/features/theme/ThemeProvider';
import { ACCENT_SWATCHES } from '@/features/theme/palette';

export function ThemeSettings() {
  const { theme, accent, previewTheme, previewAccent, setPreview, clearPreview, save, resetToDefault } = useTheme();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const activeTheme = previewTheme ?? theme;
  const activeAccent = previewAccent ?? accent;

  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');
      await save(activeTheme, activeAccent);
      setSuccess('Appearance updated successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save appearance');
    } finally {
      setSaving(false);
    }
  };

  const hasChanges = activeTheme !== theme || activeAccent !== accent;

  return (
    <div className="profile-page fade-in">
      <div className="profile-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1>Theme & Appearance</h1>
          <p>Customize the look and feel of your workspace.</p>
        </div>
        {hasChanges && (
          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="btn btn-secondary" onClick={clearPreview} disabled={saving}>
              Discard
            </button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="animate-spin" size={16} /> : null}
              Save Changes
            </button>
          </div>
        )}
      </div>

      {error && <div className="alert alert-error mb-6">{error}</div>}
      {success && <div className="alert alert-success mb-6">{success}</div>}

      <div className="profile-section">
        <h3>Mode</h3>
        <div style={{ display: 'flex', gap: '16px' }}>
          <button
            style={{
              flex: 1, padding: '24px', borderRadius: 'var(--radius-lg)',
              border: `2px solid ${activeTheme === 'light' ? 'var(--accent-solid)' : 'var(--border-default)'}`,
              background: 'var(--bg-canvas)', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
              transition: 'all 0.2s'
            }}
            onClick={() => setPreview('light', activeAccent)}
          >
            <Sun size={32} color={activeTheme === 'light' ? 'var(--accent-solid)' : 'var(--text-secondary)'} />
            <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>Light</span>
          </button>
          
          <button
            style={{
              flex: 1, padding: '24px', borderRadius: 'var(--radius-lg)',
              border: `2px solid ${activeTheme === 'dark' ? 'var(--accent-solid)' : 'var(--border-default)'}`,
              background: 'var(--bg-canvas)', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
              transition: 'all 0.2s'
            }}
            onClick={() => setPreview('dark', activeAccent)}
          >
            <Moon size={32} color={activeTheme === 'dark' ? 'var(--accent-solid)' : 'var(--text-secondary)'} />
            <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>Dark</span>
          </button>
        </div>
      </div>

      <div className="profile-section">
        <h3>Accent Color</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
          {ACCENT_SWATCHES.map((swatch) => (
            <button
              key={swatch.name}
              onClick={() => setPreview(activeTheme, swatch.name)}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '12px', borderRadius: 'var(--radius-md)',
                background: 'var(--bg-canvas)',
                border: `1px solid ${activeAccent === swatch.name ? 'var(--accent-solid)' : 'var(--border-default)'}`,
                cursor: 'pointer', transition: 'all 0.2s'
              }}
            >
              <div 
                style={{ 
                  width: '24px', height: '24px', borderRadius: '50%',
                  background: activeTheme === 'dark' ? swatch.darkColor : swatch.lightColor,
                  display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}
              >
                {activeAccent === swatch.name && <Check size={14} color="#fff" />}
              </div>
              <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{swatch.label}</span>
            </button>
          ))}
        </div>
      </div>
      
      <div style={{ marginTop: '40px', paddingTop: '24px', borderTop: '1px solid var(--border-light)' }}>
        <button className="btn btn-secondary" onClick={() => { resetToDefault(); setTimeout(handleSave, 0); }} disabled={saving}>
          Reset to Defaults
        </button>
      </div>
    </div>
  );
}
