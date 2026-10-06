import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { Check, Loader2, Sparkles, AlertCircle, BookOpen, Zap } from 'lucide-react';
import { useAuth } from '@/features/auth/AuthContext';
import { CircleBuffer } from '@/components/CircleBuffer';
import './ProfileLayout.css';

interface AiPreferences {
  response_length: string;
  explanation_level: string;
  not_in_docs_behavior: string;
  citation_style: string;
  default_search_scope: string;
  follow_up_suggestions: boolean;
  simplify_difficult_concepts: boolean;
  external_knowledge: boolean;
  answer_format: string;
  version: number;
}

export function AiPreferencesSettings() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<AiPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPreferences = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      setError(null);
      const data = await api.getPreferences();
      setPrefs({
        response_length: data.response_length || 'medium',
        explanation_level: data.explanation_level || 'undergraduate',
        not_in_docs_behavior: data.not_in_docs_behavior || 'tell_me',
        citation_style: data.citation_style || 'inline',
        default_search_scope: data.default_search_scope || 'selected',
        follow_up_suggestions: data.follow_up_suggestions ?? true,
        simplify_difficult_concepts: data.simplify_difficult_concepts ?? false,
        external_knowledge: data.external_knowledge ?? false,
        answer_format: data.answer_format || 'paragraph',
        version: data.version,
      });
    } catch (err: any) {
      setError(err.message || 'Failed to load preferences');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  const updatePref = async <K extends keyof AiPreferences>(key: K, value: AiPreferences[K]) => {
    if (!prefs) return;
    
    const newPrefs = { ...prefs, [key]: value };
    setPrefs(newPrefs);
    
    try {
      setSaving(true);
      setError(null);
      setSaveSuccess(false);
      
      const result = await api.updatePreferences({
        [key]: value,
        version: prefs.version
      });
      
      setPrefs(prev => prev ? { ...prev, version: result.version } : null);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    } catch (err: any) {
      if (err.status === 409) {
        setError('Preferences were modified elsewhere. Refreshing...');
        await fetchPreferences();
      } else {
        setError(err.message || 'Failed to save preferences');
        // Revert on failure
        setPrefs(prefs);
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading && !prefs) {
    return <CircleBuffer minHeight={300} size={36} />;
  }

  return (
    <div className="settings-pane">
      <div className="settings-header">
        <div>
          <h2>AI Preferences</h2>
          <p className="settings-subtitle">Configure how the Study Assistant behaves and responds to you.</p>
        </div>
        <div className="settings-status">
          {saving && <span className="status-saving"><Loader2 size={14} className="spinner" /> Saving...</span>}
          {saveSuccess && !saving && <span className="status-saved"><Check size={14} /> Saved</span>}
        </div>
      </div>

      {error && (
        <div className="settings-alert error">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {prefs && (
        <div className="settings-form">
          <div className="settings-section">
            <h3 className="section-title"><Sparkles size={16} /> Response Style</h3>
            
            <div className="setting-group">
              <label className="setting-label">Default Answer Format</label>
              <div className="radio-cards cols-4">
                <label className={`radio-card ${prefs.answer_format === 'paragraph' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="answer_format"
                    checked={prefs.answer_format === 'paragraph'}
                    onChange={() => updatePref('answer_format', 'paragraph')}
                  />
                  <div className="radio-content">
                    <span className="radio-title">Paragraph</span>
                    <span className="radio-desc">Cohesive prose</span>
                  </div>
                </label>
                <label className={`radio-card ${prefs.answer_format === 'bullet_points' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="answer_format"
                    checked={prefs.answer_format === 'bullet_points'}
                    onChange={() => updatePref('answer_format', 'bullet_points')}
                  />
                  <div className="radio-content">
                    <span className="radio-title">Bullet Points</span>
                    <span className="radio-desc">Key lists</span>
                  </div>
                </label>
                <label className={`radio-card ${prefs.answer_format === 'exam_style' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="answer_format"
                    checked={prefs.answer_format === 'exam_style'}
                    onChange={() => updatePref('answer_format', 'exam_style')}
                  />
                  <div className="radio-content">
                    <span className="radio-title">Exam Style</span>
                    <span className="radio-desc">Structured points</span>
                  </div>
                </label>
                <label className={`radio-card ${prefs.answer_format === 'step_by_step' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="answer_format"
                    checked={prefs.answer_format === 'step_by_step'}
                    onChange={() => updatePref('answer_format', 'step_by_step')}
                  />
                  <div className="radio-content">
                    <span className="radio-title">Step-by-Step</span>
                    <span className="radio-desc">Sequential guide</span>
                  </div>
                </label>
              </div>
            </div>
            
            <div className="setting-group">
              <label className="setting-label">Response Length</label>
              <div className="radio-cards">
                <label className={`radio-card ${prefs.response_length === 'short' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="response_length"
                    checked={prefs.response_length === 'short'}
                    onChange={() => updatePref('response_length', 'short')}
                  />
                  <div className="radio-content">
                    <span className="radio-title">Short</span>
                    <span className="radio-desc">Concise answers</span>
                  </div>
                </label>
                <label className={`radio-card ${prefs.response_length === 'medium' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="response_length"
                    checked={prefs.response_length === 'medium'}
                    onChange={() => updatePref('response_length', 'medium')}
                  />
                  <div className="radio-content">
                    <span className="radio-title">Medium</span>
                    <span className="radio-desc">Balanced details</span>
                  </div>
                </label>
                <label className={`radio-card ${prefs.response_length === 'detailed' ? 'selected' : ''}`}>
                  <input
                    type="radio"
                    name="response_length"
                    checked={prefs.response_length === 'detailed'}
                    onChange={() => updatePref('response_length', 'detailed')}
                  />
                  <div className="radio-content">
                    <span className="radio-title">Detailed</span>
                    <span className="radio-desc">Comprehensive</span>
                  </div>
                </label>
              </div>
            </div>

            <div className="setting-group">
              <label className="setting-label" htmlFor="explanation_level">Explanation Level</label>
              <select 
                id="explanation_level"
                className="form-select"
                value={prefs.explanation_level}
                onChange={(e) => updatePref('explanation_level', e.target.value)}
              >
                <option value="high_school">High School</option>
                <option value="undergraduate">Undergraduate</option>
                <option value="graduate">Graduate / Expert</option>
                <option value="simplify">Explain like I'm 5</option>
              </select>
            </div>
            
            <div className="setting-group checkbox-group">
              <label className="toggle-switch">
                <input 
                  type="checkbox" 
                  checked={prefs.simplify_difficult_concepts}
                  onChange={(e) => updatePref('simplify_difficult_concepts', e.target.checked)}
                />
                <span className="slider"></span>
              </label>
              <div className="toggle-label">
                <strong>Automatically simplify difficult concepts</strong>
                <p>Use analogies and simpler terms when explaining complex topics.</p>
              </div>
            </div>
          </div>

          <div className="settings-section">
            <h3 className="section-title"><BookOpen size={16} /> Knowledge & Sources</h3>
            
            <div className="setting-group">
              <label className="setting-label">External Knowledge</label>
              <div className="toggle-card premium-card">
                <div className="toggle-card-header">
                  <div className="toggle-card-title">
                    <Zap size={18} className="text-accent" />
                    <span>Use information outside uploaded documents</span>
                  </div>
                  <label className="toggle-switch">
                    <input 
                      type="checkbox" 
                      checked={prefs.external_knowledge}
                      onChange={(e) => updatePref('external_knowledge', e.target.checked)}
                    />
                    <span className="slider"></span>
                  </label>
                </div>
                <div className="toggle-card-body">
                  {prefs.external_knowledge ? (
                    <p><strong>ON:</strong> The AI may provide external knowledge but must clearly label it as "Outside your documents".</p>
                  ) : (
                    <p><strong>OFF:</strong> Answer strictly from uploaded PDFs.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="setting-group">
              <label className="setting-label">When answer isn't in documents:</label>
              <div className="radio-list">
                <label className="radio-item">
                  <input 
                    type="radio" 
                    name="not_in_docs" 
                    checked={prefs.not_in_docs_behavior === 'tell_me'}
                    onChange={() => updatePref('not_in_docs_behavior', 'tell_me')}
                  />
                  <span>Tell me it wasn't found</span>
                </label>
                <label className="radio-item">
                  <input 
                    type="radio" 
                    name="not_in_docs" 
                    checked={prefs.not_in_docs_behavior === 'give_general'}
                    onChange={() => updatePref('not_in_docs_behavior', 'give_general')}
                  />
                  <span>Give general knowledge separately</span>
                </label>
              </div>
            </div>

            <div className="setting-group">
              <label className="setting-label">Citation Style</label>
              <div className="radio-list">
                <label className="radio-item">
                  <input 
                    type="radio" 
                    name="citation_style" 
                    checked={prefs.citation_style === 'inline'}
                    onChange={() => updatePref('citation_style', 'inline')}
                  />
                  <span>Inline citations (e.g. 1., 2.)</span>
                </label>
                <label className="radio-item">
                  <input 
                    type="radio" 
                    name="citation_style" 
                    checked={prefs.citation_style === 'bottom'}
                    onChange={() => updatePref('citation_style', 'bottom')}
                  />
                  <span>Sources at bottom</span>
                </label>
              </div>
            </div>
            
            <div className="setting-group">
              <label className="setting-label">Default Search Scope</label>
              <div className="radio-list">
                <label className="radio-item">
                  <input 
                    type="radio" 
                    name="default_search_scope" 
                    checked={prefs.default_search_scope === 'selected'}
                    onChange={() => updatePref('default_search_scope', 'selected')}
                  />
                  <span>Selected PDFs</span>
                </label>
                <label className="radio-item">
                  <input 
                    type="radio" 
                    name="default_search_scope" 
                    checked={prefs.default_search_scope === 'all'}
                    onChange={() => updatePref('default_search_scope', 'all')}
                  />
                  <span>All PDFs</span>
                </label>
              </div>
            </div>
          </div>

          <div className="settings-section">
            <h3 className="section-title"><Sparkles size={16} /> Suggestions</h3>
            
            <div className="setting-group checkbox-group">
              <label className="toggle-switch">
                <input 
                  type="checkbox" 
                  checked={prefs.follow_up_suggestions}
                  onChange={(e) => updatePref('follow_up_suggestions', e.target.checked)}
                />
                <span className="slider"></span>
              </label>
              <div className="toggle-label">
                <strong>Follow-up Suggestions</strong>
                <p>Suggest relevant questions after each answer.</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
