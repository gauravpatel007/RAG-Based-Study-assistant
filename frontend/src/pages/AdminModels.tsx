import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { CircleBuffer } from '@/components/CircleBuffer';
import { 
  Save, 
  Play, 
  RefreshCw, 
  Cpu, 
  Sliders, 
  CheckCircle2, 
  AlertCircle, 
  DownloadCloud, 
  Zap, 
  Layers, 
  Activity,
  Network,
  Copy,
  Check
} from 'lucide-react';

const POPULAR_MODELS = [
  { id: 'qwen3:4b', label: 'Qwen 3 (4B)', tag: 'Recommended', desc: 'Fast & accurate textbook comprehension' },
  { id: 'llama3.2:latest', label: 'Llama 3.2 (3B)', tag: 'Lightweight', desc: 'Meta lightweight conversational model' },
  { id: 'deepseek-r1:7b', label: 'DeepSeek R1 (7B)', tag: 'Reasoning', desc: 'High-depth step-by-step reasoning' },
  { id: 'mistral:latest', label: 'Mistral (7B)', tag: 'Balanced', desc: 'Strong instruction adherence & summaries' },
];

const CONTEXT_PRESETS = [4096, 8192, 16384, 32768];

type SectionTab = 'all' | 'model' | 'downloader' | 'rag' | 'hybrid' | 'benchmark';

export default function AdminModels() {
  const [configs, setConfigs] = useState<Record<string, any>>({
    CHUNK_SIZE: 200,
    CHUNK_OVERLAP: 30,
    RETRIEVAL_MAX_DISTANCE: 1.05,
    TOP_K: 12,
    LLM_MODEL: 'qwen3:4b',
    LLM_CONTEXT_TOKENS: 8192,
    LLM_MAX_OUTPUT_TOKENS: 4096,
    LLM_TEMPERATURE: 0.2,
    RERANKER_ENABLED: true,
    BM25_ENABLED: true,
    SEMANTIC_TOP_K: 20,
    BM25_TOP_K: 20,
    RERANKER_TOP_N: 8,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeSection, setActiveSection] = useState<SectionTab>('all');
  const [copiedResponse, setCopiedResponse] = useState(false);

  // Model pulling
  const [modelToPull, setModelToPull] = useState('');
  const [pulling, setPulling] = useState(false);
  const [pullProgress, setPullProgress] = useState<string>('');
  const [pullPercent, setPullPercent] = useState<number | null>(null);

  // Benchmark
  const [benchmarkPrompt, setBenchmarkPrompt] = useState('Why does condensation form on a cold glass? Explain concisely.');
  const [benchmarking, setBenchmarking] = useState(false);
  const [benchmarkResult, setBenchmarkResult] = useState<any>(null);
  
  // Status
  const [ollamaStatus, setOllamaStatus] = useState<{ connected: boolean; models: string[]; active_model: string } | null>(null);

  useEffect(() => {
    loadConfigs();
  }, []);

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const loadConfigs = async () => {
    try {
      setLoading(true);
      const res = await api.rawRequest<Record<string, any>>('/admin/models/configs');
      if (res && Object.keys(res).length > 0) {
        setConfigs(prev => ({ ...prev, ...res }));
      }
      const status = await api.getOllamaStatus();
      setOllamaStatus(status);
    } catch (err: any) {
      setToastMessage({ type: 'error', text: err?.message || 'Failed to load system settings' });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { OLLAMA_BASE_URL, EMBEDDING_MODEL, ...updateData } = configs;
      await api.rawRequest('/admin/models/configs', {
        method: 'PUT',
        body: JSON.stringify({ configs: updateData })
      });
      setToastMessage({ type: 'success', text: 'All AI model & RAG configurations saved live!' });
    } catch (err: any) {
      setToastMessage({ type: 'error', text: err?.message || 'Failed to save configurations' });
    } finally {
      setSaving(false);
    }
  };

  const handleConfigChange = (key: string, value: any) => {
    setConfigs(prev => ({ ...prev, [key]: value }));
  };

  const handlePullModel = async (modelName?: string) => {
    const target = (modelName || modelToPull).trim();
    if (!target) return;
    setPulling(true);
    setPullProgress(`Initiating download for ${target}...`);
    setPullPercent(0);

    try {
      const response = await fetch('/api/v1/admin/models/pull', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('sa_session') || ''}`
        },
        body: JSON.stringify({ model: target })
      });

      if (!response.body) throw new Error('No streaming response received');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n').filter(Boolean);

        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            if (data.status) {
              let msg = data.status;
              if (data.total && data.completed) {
                const pct = Math.round((data.completed / data.total) * 100);
                setPullPercent(pct);
                msg += ` (${pct}%)`;
              }
              setPullProgress(msg);
            }
            if (data.error) {
              setPullProgress(`Error: ${data.error}`);
            }
          } catch {
            // Partial JSON chunk
          }
        }
      }
      setPullProgress(`Model ${target} successfully downloaded and registered!`);
      setPullPercent(100);
      handleConfigChange('LLM_MODEL', target);
      setToastMessage({ type: 'success', text: `Model ${target} downloaded and activated!` });
    } catch (err: any) {
      setPullProgress(`Failed to pull: ${err.message}`);
      setToastMessage({ type: 'error', text: 'Failed to download model.' });
    } finally {
      setPulling(false);
    }
  };

  const handleBenchmark = async () => {
    if (!benchmarkPrompt.trim()) return;
    setBenchmarking(true);
    setBenchmarkResult(null);

    try {
      const res = await api.rawRequest<any>('/admin/models/benchmark', {
        method: 'POST',
        body: JSON.stringify({ prompt: benchmarkPrompt.trim() })
      });
      setBenchmarkResult(res);
      setToastMessage({ type: 'success', text: `Benchmark finished in ${res.latency_sec}s (${res.tokens_per_sec} t/s)` });
    } catch (err: any) {
      setToastMessage({ type: 'error', text: err?.message || 'Benchmark execution failed' });
    } finally {
      setBenchmarking(false);
    }
  };

  const handleCopyResponse = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedResponse(true);
    setTimeout(() => setCopiedResponse(false), 2000);
  };

  // ─────────────────────────────────────────────────────────────
  // 1. SECTION: Active LLM Inference
  // ─────────────────────────────────────────────────────────────
  const renderModelCard = () => (
    <div style={{
      background: 'var(--bg-card)',
      borderRadius: '18px',
      border: '1px solid var(--border-default)',
      padding: '24px',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <div style={{
          width: '42px',
          height: '42px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          borderRadius: '12px',
          background: 'linear-gradient(135deg, #f3e8ff, #e9d5ff)',
          color: '#7c3aed'
        }}>
          <Cpu size={22} strokeWidth={2.4} />
        </div>
        <div>
          <h2 style={{ fontSize: '17px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
            Active LLM Inference
          </h2>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Target model selection, context limits, and temperature
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 }}>
        {/* Model Selector & Chips */}
        <div>
          <label style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', display: 'block', marginBottom: '8px' }}>
            Active Model Tag
          </label>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '12px' }}>
            {POPULAR_MODELS.map(m => {
              const isSelected = configs.LLM_MODEL === m.id;
              return (
                <div
                  key={m.id}
                  onClick={() => handleConfigChange('LLM_MODEL', m.id)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: '10px',
                    border: isSelected ? '2px solid var(--accent-purple, #7c3aed)' : '1px solid var(--border-default)',
                    background: isSelected ? 'var(--accent-purple-light, rgba(124, 58, 237, 0.08))' : 'var(--bg-input)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2px' }}>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: isSelected ? '#7c3aed' : 'var(--text-primary)' }}>
                      {m.label}
                    </span>
                    <span style={{ 
                      fontSize: '10px', 
                      padding: '2px 6px', 
                      borderRadius: '4px', 
                      background: isSelected ? '#7c3aed' : 'var(--border-default)', 
                      color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                      fontWeight: '600'
                    }}>
                      {m.tag}
                    </span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                    {m.desc}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Custom input */}
          <div>
            <input
              type="text"
              placeholder="Custom model tag (e.g. llama3.2:1b)"
              value={configs.LLM_MODEL || ''}
              onChange={e => handleConfigChange('LLM_MODEL', e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                borderRadius: '10px',
                border: '1px solid var(--border-default)',
                background: 'var(--bg-input)',
                color: 'var(--text-primary)',
                fontSize: '13px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>
          {ollamaStatus?.connected && configs.LLM_MODEL && !ollamaStatus.models.includes(configs.LLM_MODEL) && (
            <div style={{ marginTop: '8px', padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', fontSize: '12px', color: '#991b1b', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertCircle size={14} />
              <span>This model is not currently downloaded. Use the pull tool below before saving.</span>
            </div>
          )}
        </div>

        {/* Context Token Window */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <label style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>
              Context Window (num_ctx)
            </label>
            <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>
              {(configs.LLM_CONTEXT_TOKENS || 8192).toLocaleString()} tokens
            </span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {CONTEXT_PRESETS.map(ctx => (
              <button
                key={ctx}
                type="button"
                onClick={() => handleConfigChange('LLM_CONTEXT_TOKENS', ctx)}
                style={{
                  flex: 1,
                  padding: '8px 4px',
                  borderRadius: '8px',
                  border: configs.LLM_CONTEXT_TOKENS === ctx ? '2px solid #7c3aed' : '1px solid var(--border-default)',
                  background: configs.LLM_CONTEXT_TOKENS === ctx ? 'rgba(124, 58, 237, 0.08)' : 'var(--bg-input)',
                  color: configs.LLM_CONTEXT_TOKENS === ctx ? '#7c3aed' : 'var(--text-secondary)',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                {ctx / 1024}k
              </button>
            ))}
          </div>
        </div>

        {/* Temperature */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div>
              <label style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', display: 'block' }}>
                Temperature
              </label>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                {configs.LLM_TEMPERATURE <= 0.1 ? 'Deterministic (Strict textbook facts)' : configs.LLM_TEMPERATURE < 0.6 ? 'Balanced accuracy' : 'Creative & expansive'}
              </span>
            </div>
            <span style={{
              padding: '4px 10px',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-default)',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '700',
              color: 'var(--text-primary)'
            }}>
              {configs.LLM_TEMPERATURE ?? 0.2}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="1.2"
            step="0.05"
            value={configs.LLM_TEMPERATURE ?? 0.2}
            onChange={e => handleConfigChange('LLM_TEMPERATURE', parseFloat(e.target.value))}
            style={{ width: '100%', accentColor: '#7c3aed', cursor: 'pointer' }}
          />
        </div>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────
  // 2. SECTION: Ollama Model Manager & Downloader
  // ─────────────────────────────────────────────────────────────
  const renderDownloaderCard = () => (
    <div style={{
      background: 'var(--bg-card)',
      borderRadius: '18px',
      border: '1px solid var(--border-default)',
      padding: '24px',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '12px',
        marginBottom: '18px',
        flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
          <div style={{
            width: '42px',
            height: '42px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #ecfdf5, #d1fae5)',
            color: '#059669'
          }}>
            <DownloadCloud size={22} strokeWidth={2.4} />
          </div>
          <div>
            <h2 style={{ fontSize: '17px', fontWeight: '700', color: 'var(--text-primary)', margin: 0, lineHeight: 1.2 }}>
              Pull Model from Ollama
            </h2>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Download and cache local weights directly
            </span>
          </div>
        </div>

        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '7px',
          padding: '5px 12px',
          borderRadius: '20px',
          background: ollamaStatus?.connected ? '#ecfdf5' : '#fef2f2',
          border: `1px solid ${ollamaStatus?.connected ? '#a7f3d0' : '#fecaca'}`,
          fontSize: '12px',
          color: ollamaStatus?.connected ? '#065f46' : '#991b1b',
          fontWeight: '600',
          whiteSpace: 'nowrap',
          flexShrink: 0
        }}>
          <span style={{
            width: '7px',
            height: '7px',
            borderRadius: '50%',
            background: ollamaStatus?.connected ? '#10b981' : '#ef4444',
            flexShrink: 0
          }} />
          {ollamaStatus?.connected ? `Ollama Connected (${ollamaStatus.models.length} models)` : 'Ollama Unreachable'}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1 }}>
        <div style={{ display: 'flex', gap: '10px' }}>
          <input
            type="text"
            placeholder="Enter model tag (e.g. mistral:7b, llama3.2:1b)"
            value={modelToPull}
            onChange={e => setModelToPull(e.target.value)}
            disabled={pulling}
            style={{
              flex: 1,
              padding: '11px 14px',
              borderRadius: '10px',
              border: '1px solid var(--border-default)',
              background: 'var(--bg-input)',
              color: 'var(--text-primary)',
              fontSize: '14px',
              outline: 'none'
            }}
          />
          <button
            onClick={() => handlePullModel()}
            disabled={pulling || !modelToPull.trim()}
            style={{
              padding: '0 20px',
              borderRadius: '10px',
              background: 'var(--btn-primary-bg)',
              color: 'var(--btn-primary-text)',
              border: 'none',
              fontWeight: '600',
              fontSize: '14px',
              cursor: pulling || !modelToPull.trim() ? 'not-allowed' : 'pointer',
              opacity: pulling || !modelToPull.trim() ? 0.6 : 1,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            {pulling ? <RefreshCw size={16} className="animate-spin" /> : <DownloadCloud size={16} />}
            {pulling ? 'Downloading...' : 'Pull'}
          </button>
        </div>

        {/* Quick pull badges */}
        <div>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '6px' }}>
            Quick pull recommendations:
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {['qwen3:4b', 'llama3.2:latest', 'deepseek-r1:7b', 'mistral:latest'].map(tag => (
              <button
                key={tag}
                type="button"
                onClick={() => { setModelToPull(tag); handlePullModel(tag); }}
                disabled={pulling}
                style={{
                  padding: '5px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-default)',
                  background: 'var(--bg-input)',
                  color: 'var(--text-secondary)',
                  fontSize: '12px',
                  fontWeight: '500',
                  cursor: pulling ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <DownloadCloud size={12} color="#059669" />
                {tag}
              </button>
            ))}
          </div>
        </div>

        {/* Installed models in Ollama */}
        {ollamaStatus?.models && ollamaStatus.models.length > 0 && (
          <div style={{ marginTop: 'auto', paddingTop: '10px', borderTop: '1px solid var(--border-default)' }}>
            <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--text-muted)', display: 'block', marginBottom: '8px' }}>
              Installed Local Models ({ollamaStatus.models.length}):
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '110px', overflowY: 'auto' }}>
              {ollamaStatus.models.map(m => {
                const isActive = configs.LLM_MODEL === m;
                return (
                  <span
                    key={m}
                    onClick={() => handleConfigChange('LLM_MODEL', m)}
                    style={{
                      padding: '3px 9px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: isActive ? '700' : '500',
                      background: isActive ? 'rgba(5, 150, 105, 0.15)' : 'var(--bg-input)',
                      color: isActive ? '#059669' : 'var(--text-secondary)',
                      border: isActive ? '1px solid #10b981' : '1px solid var(--border-default)',
                      cursor: 'pointer'
                    }}
                    title="Click to set as active model"
                  >
                    {isActive ? '✓ ' : ''}{m}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Download progress bar & status */}
        {pullProgress && (
          <div style={{
            padding: '14px',
            borderRadius: '10px',
            background: 'var(--bg-input)',
            border: '1px solid var(--border-default)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '6px', fontWeight: '500' }}>
              <span style={{ color: 'var(--text-primary)' }}>{pullProgress}</span>
              {pullPercent !== null && <span style={{ color: 'var(--accent-blue)', fontWeight: '700' }}>{pullPercent}%</span>}
            </div>
            {pullPercent !== null && (
              <div style={{ width: '100%', height: '8px', background: 'var(--border-default)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{
                  width: `${pullPercent}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #059669, #10b981)',
                  borderRadius: '4px',
                  transition: 'width 0.2s ease'
                }} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────
  // 3. SECTION: RAG Pipeline Hyperparameters
  // ─────────────────────────────────────────────────────────────
  const renderRagCard = () => (
    <div style={{
      background: 'var(--bg-card)',
      borderRadius: '18px',
      border: '1px solid var(--border-default)',
      padding: '24px',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <div style={{
          width: '42px',
          height: '42px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          borderRadius: '12px',
          background: 'linear-gradient(135deg, #fee2e2, #fecaca)',
          color: 'var(--accent-red, #dc2626)'
        }}>
          <Layers size={22} strokeWidth={2.4} />
        </div>
        <div>
          <h2 style={{ fontSize: '17px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
            RAG Pipeline Hyperparameters
          </h2>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            Chunking granularity and vector distance cutoffs
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '22px', flex: 1 }}>
        {/* Chunk Size */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <label style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>
              Chunk Size
            </label>
            <span style={{
              padding: '4px 10px',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-default)',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '700',
              color: 'var(--text-primary)'
            }}>
              {configs.CHUNK_SIZE || 200} tokens
            </span>
          </div>
          <input
            type="range"
            min="100"
            max="800"
            step="20"
            value={configs.CHUNK_SIZE || 200}
            onChange={e => handleConfigChange('CHUNK_SIZE', parseInt(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--accent-red, #dc2626)', cursor: 'pointer' }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
            <span>100 tokens (Fine details)</span>
            <span>800 tokens (Broad concepts)</span>
          </div>
        </div>

        {/* Chunk Overlap */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <label style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>
              Chunk Overlap
            </label>
            <span style={{
              padding: '4px 10px',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-default)',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '700',
              color: 'var(--text-primary)'
            }}>
              {configs.CHUNK_OVERLAP || 30} tokens
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="150"
            step="5"
            value={configs.CHUNK_OVERLAP || 30}
            onChange={e => handleConfigChange('CHUNK_OVERLAP', parseInt(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--accent-red, #dc2626)', cursor: 'pointer' }}
          />
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
            Maintains semantic context between adjacent split segments.
          </span>
        </div>

        {/* Retrieval Max Distance */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div>
              <label style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', display: 'block' }}>
                Retrieval Max Distance
              </label>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Cosine distance threshold (lower = stricter match)
              </span>
            </div>
            <span style={{
              padding: '4px 10px',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-default)',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '700',
              color: 'var(--text-primary)'
            }}>
              {configs.RETRIEVAL_MAX_DISTANCE || 1.05}
            </span>
          </div>
          <input
            type="range"
            min="0.5"
            max="1.6"
            step="0.05"
            value={configs.RETRIEVAL_MAX_DISTANCE || 1.05}
            onChange={e => handleConfigChange('RETRIEVAL_MAX_DISTANCE', parseFloat(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--accent-red, #dc2626)', cursor: 'pointer' }}
          />
        </div>

        {/* Top-K Chunks */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div>
              <label style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)', display: 'block' }}>
                Top-K Retrieval Budget
              </label>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Maximum matching text passages supplied to the LLM
              </span>
            </div>
            <span style={{
              padding: '4px 10px',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-default)',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '700',
              color: 'var(--text-primary)'
            }}>
              {configs.TOP_K || 12} chunks
            </span>
          </div>
          <input
            type="range"
            min="4"
            max="25"
            step="1"
            value={configs.TOP_K || 12}
            onChange={e => handleConfigChange('TOP_K', parseInt(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--accent-red, #dc2626)', cursor: 'pointer' }}
          />
        </div>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────
  // 4. SECTION: Hybrid RAG Pipeline (BM25 + Reranking)
  // ─────────────────────────────────────────────────────────────
  const renderHybridCard = () => (
    <div style={{
      background: 'var(--bg-card)',
      borderRadius: '18px',
      border: '1px solid var(--border-default)',
      padding: '24px',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
        <div style={{
          width: '42px',
          height: '42px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          borderRadius: '12px',
          background: 'linear-gradient(135deg, #ffedd5, #fed7aa)',
          color: '#ea580c'
        }}>
          <Network size={22} strokeWidth={2.4} />
        </div>
        <div>
          <h2 style={{ fontSize: '17px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
            Hybrid RAG Pipeline (BM25 + Reranking)
          </h2>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Combine semantic search with exact keyword matching, and rerank best chunks
          </span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1 }}>
        {/* Modern Toggles */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div style={{
            padding: '12px 14px',
            borderRadius: '12px',
            background: 'var(--bg-input)',
            border: '1px solid var(--border-default)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div>
              <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', display: 'block' }}>
                BM25 Search
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Exact keywords</span>
            </div>
            <label style={{ position: 'relative', display: 'inline-block', width: '42px', height: '22px', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={configs.BM25_ENABLED !== false && configs.BM25_ENABLED !== 'false'}
                onChange={e => handleConfigChange('BM25_ENABLED', e.target.checked)} 
                style={{ opacity: 0, width: 0, height: 0 }}
              />
              <span style={{
                position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                background: (configs.BM25_ENABLED !== false && configs.BM25_ENABLED !== 'false') ? '#ea580c' : 'var(--border-default)',
                transition: '0.2s ease', borderRadius: '22px'
              }}>
                <span style={{
                  position: 'absolute', content: '""', height: '16px', width: '16px', 
                  left: (configs.BM25_ENABLED !== false && configs.BM25_ENABLED !== 'false') ? '23px' : '3px', bottom: '3px',
                  background: 'white', transition: '0.2s ease', borderRadius: '50%', boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                }} />
              </span>
            </label>
          </div>

          <div style={{
            padding: '12px 14px',
            borderRadius: '12px',
            background: 'var(--bg-input)',
            border: '1px solid var(--border-default)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div>
              <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)', display: 'block' }}>
                Cross-Encoder
              </span>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Neural reranker</span>
            </div>
            <label style={{ position: 'relative', display: 'inline-block', width: '42px', height: '22px', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={configs.RERANKER_ENABLED !== false && configs.RERANKER_ENABLED !== 'false'}
                onChange={e => handleConfigChange('RERANKER_ENABLED', e.target.checked)} 
                style={{ opacity: 0, width: 0, height: 0 }}
              />
              <span style={{
                position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                background: (configs.RERANKER_ENABLED !== false && configs.RERANKER_ENABLED !== 'false') ? '#ea580c' : 'var(--border-default)',
                transition: '0.2s ease', borderRadius: '22px'
              }}>
                <span style={{
                  position: 'absolute', content: '""', height: '16px', width: '16px', 
                  left: (configs.RERANKER_ENABLED !== false && configs.RERANKER_ENABLED !== 'false') ? '23px' : '3px', bottom: '3px',
                  background: 'white', transition: '0.2s ease', borderRadius: '50%', boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                }} />
              </span>
            </label>
          </div>
        </div>

        {/* Final Chunks to LLM */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <label style={{ fontSize: '14px', fontWeight: '600', color: 'var(--text-primary)' }}>
              Final Chunks to LLM (Top N)
            </label>
            <span style={{ padding: '4px 10px', background: 'var(--bg-input)', border: '1px solid var(--border-default)', borderRadius: '8px', fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)' }}>
              {configs.RERANKER_TOP_N || 8}
            </span>
          </div>
          <input 
            type="range" 
            min="3" 
            max="15" 
            step="1" 
            value={configs.RERANKER_TOP_N || 8} 
            onChange={e => handleConfigChange('RERANKER_TOP_N', parseInt(e.target.value))} 
            style={{ width: '100%', accentColor: '#ea580c', cursor: 'pointer' }} 
          />
        </div>

        {/* Candidate Knobs Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
                Semantic (Top K)
              </label>
              <span style={{ padding: '3px 8px', background: 'var(--bg-input)', border: '1px solid var(--border-default)', borderRadius: '6px', fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)' }}>
                {configs.SEMANTIC_TOP_K || 20}
              </span>
            </div>
            <input 
              type="range" 
              min="5" 
              max="50" 
              step="5" 
              value={configs.SEMANTIC_TOP_K || 20} 
              onChange={e => handleConfigChange('SEMANTIC_TOP_K', parseInt(e.target.value))} 
              style={{ width: '100%', accentColor: '#ea580c', cursor: 'pointer' }} 
            />
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-primary)' }}>
                BM25 (Top K)
              </label>
              <span style={{ padding: '3px 8px', background: 'var(--bg-input)', border: '1px solid var(--border-default)', borderRadius: '6px', fontSize: '12px', fontWeight: '700', color: 'var(--text-primary)' }}>
                {configs.BM25_TOP_K || 20}
              </span>
            </div>
            <input 
              type="range" 
              min="5" 
              max="50" 
              step="5" 
              value={configs.BM25_TOP_K || 20} 
              onChange={e => handleConfigChange('BM25_TOP_K', parseInt(e.target.value))} 
              style={{ width: '100%', accentColor: '#ea580c', cursor: 'pointer' }} 
            />
          </div>
        </div>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────
  // 5. SECTION: Live Speed & Latency Benchmark (Full Width)
  // ─────────────────────────────────────────────────────────────
  const renderBenchmarkCard = () => (
    <div style={{
      background: 'var(--bg-card)',
      borderRadius: '18px',
      border: '1px solid var(--border-default)',
      padding: '26px',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.03)',
      width: '100%',
      boxSizing: 'border-box'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #ecfeff, #cffafe)',
            color: '#0891b2'
          }}>
            <Zap size={22} strokeWidth={2.4} />
          </div>
          <div>
            <h2 style={{ fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
              Live Speed & Latency Benchmark
            </h2>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              Measure real-time response latency and tokens-per-second throughput on current hardware
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600' }}>Quick Prompts:</span>
          <button
            type="button"
            onClick={() => setBenchmarkPrompt('Explain photosynthesis in two concise sentences.')}
            style={{
              fontSize: '12px',
              padding: '4px 10px',
              borderRadius: '6px',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-default)',
              color: 'var(--text-primary)',
              cursor: 'pointer'
            }}
          >
            Photosynthesis
          </button>
          <button
            type="button"
            onClick={() => setBenchmarkPrompt('Summarize the primary differences between mitosis and meiosis.')}
            style={{
              fontSize: '12px',
              padding: '4px 10px',
              borderRadius: '6px',
              background: 'var(--bg-input)',
              border: '1px solid var(--border-default)',
              color: 'var(--text-primary)',
              cursor: 'pointer'
            }}
          >
            Mitosis vs Meiosis
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: benchmarkResult ? '1fr 1fr' : '1fr', gap: '20px', alignItems: 'start' }}>
        {/* Left / Input column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
              Benchmark Prompt Input
            </label>
            <textarea
              value={benchmarkPrompt}
              onChange={e => setBenchmarkPrompt(e.target.value)}
              rows={3}
              disabled={benchmarking}
              placeholder="Type any test prompt to benchmark..."
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: '10px',
                border: '1px solid var(--border-default)',
                background: 'var(--bg-input)',
                color: 'var(--text-primary)',
                fontSize: '14px',
                resize: 'none',
                outline: 'none',
                boxSizing: 'border-box',
                lineHeight: '1.5'
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button
              onClick={handleBenchmark}
              disabled={benchmarking || !benchmarkPrompt.trim()}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 22px',
                borderRadius: '10px',
                background: 'linear-gradient(135deg, #06b6d4, #0891b2)',
                color: '#ffffff',
                border: 'none',
                fontWeight: '600',
                fontSize: '14px',
                cursor: benchmarking || !benchmarkPrompt.trim() ? 'not-allowed' : 'pointer',
                opacity: benchmarking || !benchmarkPrompt.trim() ? 0.7 : 1,
                boxShadow: '0 2px 10px rgba(8, 145, 178, 0.25)',
                transition: 'all 0.2s'
              }}
            >
              {benchmarking ? <Activity size={16} className="animate-spin" /> : <Play size={16} />}
              {benchmarking ? 'Running In-Memory Benchmark...' : 'Run Benchmark'}
            </button>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Target: <strong style={{ color: 'var(--text-primary)' }}>{configs.LLM_MODEL}</strong>
            </span>
          </div>
        </div>

        {/* Right / Results Column */}
        {benchmarkResult && (
          <div style={{
            padding: '18px',
            borderRadius: '14px',
            background: 'var(--bg-input)',
            border: '1px solid var(--border-default)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            {/* KPI metrics */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '12px',
              paddingBottom: '14px',
              borderBottom: '1px solid var(--border-default)'
            }}>
              <div style={{ background: 'var(--bg-card)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-default)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Speed
                </div>
                <div style={{ fontSize: '22px', fontWeight: '800', color: '#059669', marginTop: '2px' }}>
                  {benchmarkResult.tokens_per_sec} <span style={{ fontSize: '12px', fontWeight: '600' }}>tok/s</span>
                </div>
              </div>

              <div style={{ background: 'var(--bg-card)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-default)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Total Latency
                </div>
                <div style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-primary)', marginTop: '2px' }}>
                  {benchmarkResult.latency_sec}s
                </div>
              </div>

              <div style={{ background: 'var(--bg-card)', padding: '12px', borderRadius: '10px', border: '1px solid var(--border-default)' }}>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Model Tested
                </div>
                <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', marginTop: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {benchmarkResult.model}
                </div>
              </div>
            </div>

            {/* Response sample */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Inference Output Preview
                </span>
                <button
                  type="button"
                  onClick={() => handleCopyResponse(benchmarkResult.response)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    border: '1px solid var(--border-default)',
                    background: 'var(--bg-card)',
                    color: copiedResponse ? '#059669' : 'var(--text-secondary)',
                    cursor: 'pointer'
                  }}
                >
                  {copiedResponse ? <Check size={12} /> : <Copy size={12} />}
                  {copiedResponse ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <div style={{
                padding: '12px 14px',
                borderRadius: '10px',
                background: 'var(--bg-card)',
                border: '1px solid var(--border-default)',
                fontSize: '13px',
                lineHeight: '1.5',
                color: 'var(--text-primary)',
                maxHeight: '130px',
                overflowY: 'auto'
              }}>
                "{benchmarkResult.response}"
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div style={{ flex: 1, width: '100%', boxSizing: 'border-box', fontFamily: 'var(--font-family)', paddingBottom: '40px' }}>
      {/* Header section */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between', 
        flexWrap: 'wrap', 
        gap: '16px',
        marginBottom: '24px',
        paddingBottom: '20px',
        borderBottom: '1px solid var(--border-default)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            borderRadius: '16px',
            background: 'rgba(245, 158, 11, 0.1)',
            color: '#f59e0b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <Cpu size={24} />
          </div>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
              AI Models & Pipeline Config
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: '4px 0 0 0' }}>
              Fine-tune retrieval hyperparameters, switch local Ollama models dynamically, and test inference speeds.
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={loadConfigs}
            disabled={loading || saving}
            title="Reload settings from database"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '10px 16px',
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-default)',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>

          <button
            onClick={handleSave}
            disabled={saving || loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 22px',
              background: 'var(--btn-primary-bg)',
              color: 'var(--btn-primary-text)',
              border: 'none',
              borderRadius: '10px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: saving ? 'not-allowed' : 'pointer',
              boxShadow: '0 4px 14px rgba(0, 0, 0, 0.12)',
              transition: 'all 0.2s ease',
              opacity: saving ? 0.7 : 1
            }}
          >
            <Save size={16} />
            {saving ? 'Saving Changes...' : 'Save Settings'}
          </button>
        </div>
      </div>

      {/* Toast Alert */}
      {toastMessage && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '12px 18px',
          borderRadius: '12px',
          marginBottom: '24px',
          fontSize: '14px',
          fontWeight: '500',
          background: toastMessage.type === 'success' ? '#ecfdf5' : '#fef2f2',
          color: toastMessage.type === 'success' ? '#065f46' : '#991b1b',
          border: `1px solid ${toastMessage.type === 'success' ? '#a7f3d0' : '#fecaca'}`,
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)'
        }}>
          {toastMessage.type === 'success' ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Section Navigation Filter Tabs */}
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        background: 'var(--bg-card)',
        padding: '4px',
        borderRadius: '12px',
        border: '1px solid var(--border-default)',
        marginBottom: '28px',
        overflowX: 'auto',
        maxWidth: '100%'
      }}>
        {[
          { id: 'all', label: 'All 5 Sections', icon: Sliders, color: 'var(--accent-blue)' },
          { id: 'model', label: 'Active LLM', icon: Cpu, color: 'var(--accent-purple)' },
          { id: 'downloader', label: 'Model Library', icon: DownloadCloud, color: 'var(--accent-green)' },
          { id: 'rag', label: 'RAG Pipeline', icon: Layers, color: 'var(--accent-red)' },
          { id: 'hybrid', label: 'Hybrid Search', icon: Network, color: 'var(--accent-orange)' },
          { id: 'benchmark', label: 'Speed Benchmark', icon: Zap, color: '#0891b2' },
        ].map(tab => {
          const isActive = activeSection === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id as SectionTab)}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.background = 'var(--bg-active)';
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.background = 'transparent';
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '7px 14px',
                borderRadius: '8px',
                border: 'none',
                background: isActive ? tab.color : 'transparent',
                color: isActive ? '#ffffff' : 'var(--text-secondary)',
                fontWeight: isActive ? '600' : '500',
                fontSize: '13px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap'
              }}
            >
              <tab.icon size={15} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {loading && !ollamaStatus ? (
        <CircleBuffer minHeight="50vh" size={42} />
      ) : (
        <>
          {/* VIEW ALL 5 SECTIONS IN ORGANIZED GROUPS */}
          {activeSection === 'all' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
              
              {/* GROUP 1: LLM Engine & Local Weights */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)' }}>
                    1. AI Model Engine & Local Weights
                  </span>
                  <div style={{ flex: 1, height: '1px', background: 'var(--border-default)' }} />
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))',
                  gap: '24px'
                }}>
                  {renderModelCard()}
                  {renderDownloaderCard()}
                </div>
              </div>

              {/* GROUP 2: Knowledge Retrieval & RAG Pipeline */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)' }}>
                    2. Knowledge Retrieval & RAG Pipeline
                  </span>
                  <div style={{ flex: 1, height: '1px', background: 'var(--border-default)' }} />
                </div>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(460px, 1fr))',
                  gap: '24px'
                }}>
                  {renderRagCard()}
                  {renderHybridCard()}
                </div>
              </div>

              {/* GROUP 3: Performance & Diagnostics */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.8px', color: 'var(--text-muted)' }}>
                    3. Live Performance & Inference Diagnostics
                  </span>
                  <div style={{ flex: 1, height: '1px', background: 'var(--border-default)' }} />
                </div>
                {renderBenchmarkCard()}
              </div>

            </div>
          )}

          {/* FOCUSED INDIVIDUAL SECTION VIEWS (Full Horizontal Width) */}
          {activeSection === 'model' && (
            <div style={{ width: '100%' }}>
              {renderModelCard()}
            </div>
          )}

          {activeSection === 'downloader' && (
            <div style={{ width: '100%' }}>
              {renderDownloaderCard()}
            </div>
          )}

          {activeSection === 'rag' && (
            <div style={{ width: '100%' }}>
              {renderRagCard()}
            </div>
          )}

          {activeSection === 'hybrid' && (
            <div style={{ width: '100%' }}>
              {renderHybridCard()}
            </div>
          )}

          {activeSection === 'benchmark' && (
            <div style={{ width: '100%' }}>
              {renderBenchmarkCard()}
            </div>
          )}
        </>
      )}
    </div>
  );
}
