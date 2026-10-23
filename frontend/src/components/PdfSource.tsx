import { useRef, useEffect, useState, useCallback } from 'react';
import { getDocument, GlobalWorkerOptions, TextLayer } from 'pdfjs-dist';
import 'pdfjs-dist/web/pdf_viewer.css';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
  ChevronLeft, ChevronRight, ZoomIn, ZoomOut,
  ExternalLink, X, Loader2, Maximize2, Minimize2,
  Quote, ChevronDown, ChevronUp, Copy, Check
} from 'lucide-react';
import { formatDocName } from '@/lib/formatters';
import { SelectionToolbar } from './SelectionToolbar';
import { useTextSelection } from '../hooks/useTextSelection';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

GlobalWorkerOptions.workerSrc = workerUrl;

export interface Source {
  document_id: string;
  page_number: number;
  original_filename: string;
  excerpt?: string;
}

export default function PdfSource({
  source,
  close,
  singlePageOnly,
  isAdmin
}: {
  source: Source;
  close: () => void;
  singlePageOnly?: boolean;
  isAdmin?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<any>(null);
  const textLayerTaskRef = useRef<any>(null);

  const { chatId } = useParams();
  const navigate = useNavigate();
  const { selection, clearSelection } = useTextSelection(containerRef);

  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState<number>(source.page_number || 1);
  const [numPages, setNumPages] = useState<number>(1);
  const [zoom, setZoom] = useState<number>(1.1);
  const [loading, setLoading] = useState<boolean>(true);
  const [rendering, setRendering] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const [touchEndX, setTouchEndX] = useState<number | null>(null);
  const [showExcerpt, setShowExcerpt] = useState<boolean>(true);
  const [isExcerptExpanded, setIsExcerptExpanded] = useState<boolean>(false);
  const [copiedExcerpt, setCopiedExcerpt] = useState<boolean>(false);

  // Reset excerpt visibility and expansion whenever citation source changes
  useEffect(() => {
    setShowExcerpt(true);
    setIsExcerptExpanded(false);
  }, [source.document_id, source.page_number, source.excerpt]);

  // Sync native fullscreen state
  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
    };
  }, []);

  const toggleFullscreen = () => {
    if (!isFullscreen && !document.fullscreenElement) {
      if (drawerRef.current?.requestFullscreen) {
        drawerRef.current.requestFullscreen().catch(() => {
          setIsFullscreen(true);
        });
      } else {
        setIsFullscreen(true);
      }
    } else {
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => { });
      }
      setIsFullscreen(false);
    }
  };

  // Handle ESC key and lock body scroll while drawer is open
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isFullscreen) {
          if (document.fullscreenElement) {
            document.exitFullscreen().catch(() => { });
          }
          setIsFullscreen(false);
        } else {
          close();
        }
      }
      if (!singlePageOnly && pdfDoc) {
        if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
          setCurrentPage(prev => Math.max(1, prev - 1));
        } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
          setCurrentPage(prev => Math.min(numPages, prev + 1));
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [close, singlePageOnly, pdfDoc, numPages, isFullscreen]);

  // Load PDF Document via direct fetch to ensure session cookies & CORS are handled correctly
  useEffect(() => {
    let isCancelled = false;
    let loadingTask: any = null;

    const loadPdf = async () => {
      setLoading(true);
      setError('');

      try {
        const fileUrl = isAdmin
          ? `/api/v1/admin/documents/${source.document_id}/file`
          : `/api/v1/documents/${source.document_id}/file`;
        const res = await fetch(fileUrl, { credentials: 'include' });

        if (!res.ok) {
          throw new Error(`Failed to load PDF file (${res.status} ${res.statusText})`);
        }

        const buffer = await res.arrayBuffer();
        if (isCancelled) return;

        loadingTask = getDocument({ data: new Uint8Array(buffer) });
        const pdf = await loadingTask.promise;
        if (isCancelled) return;

        setPdfDoc(pdf);
        setNumPages(pdf.numPages);
        setCurrentPage(Math.min(Math.max(1, source.page_number || 1), pdf.numPages));
        setLoading(false);
      } catch (err: any) {
        if (!isCancelled) {
          console.error('Failed to load PDF document:', err);
          setError(err?.message || 'This document could not be opened. It may have been removed or access was denied.');
          setLoading(false);
        }
      }
    };

    void loadPdf();

    return () => {
      isCancelled = true;
      if (loadingTask) {
        try {
          void loadingTask.destroy();
        } catch (e) {
          // ignore
        }
      }
    };
  }, [source.document_id, source.page_number]);

  // Render Page to Canvas
  const renderCurrentPage = useCallback(async () => {
    if (!pdfDoc || !canvasRef.current) return;

    if (renderTaskRef.current) {
      try {
        renderTaskRef.current.cancel();
      } catch (e) {}
      renderTaskRef.current = null;
    }
    if (textLayerTaskRef.current) {
      try {
        textLayerTaskRef.current.cancel();
      } catch (e) {}
      textLayerTaskRef.current = null;
    }

    setRendering(true);

    try {
      const page = await pdfDoc.getPage(currentPage);
      const canvas = canvasRef.current;
      if (!canvas) return;

      const baseViewport = page.getViewport({ scale: 1 });
      const containerWidth = containerRef.current
        ? containerRef.current.clientWidth - 48
        : 750;

      // Calculate fit scale relative to drawer container width
      const maxFit = isFullscreen ? 2.5 : 1.4;
      const fitScale = Math.min(maxFit, Math.max(0.6, containerWidth / baseViewport.width));
      const effectiveScale = fitScale * zoom;

      const viewport = page.getViewport({ scale: effectiveScale });
      const context = canvas.getContext('2d');
      if (!context) return;

      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;

      const transform = dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined;

      const renderContext = {
        canvasContext: context,
        transform: transform,
        viewport: viewport
      };

      const renderTask = page.render(renderContext);
      renderTaskRef.current = renderTask;

      await renderTask.promise;
      
      // Render text layer for selection
      if (textLayerRef.current) {
        textLayerRef.current.innerHTML = '';
        try {
          const textContent = await page.getTextContent();
          textLayerTaskRef.current = new TextLayer({
            textContentSource: textContent,
            container: textLayerRef.current,
            viewport: viewport
          });
          await textLayerTaskRef.current.render();
        } catch (e) {
          console.error('TextLayer error:', e);
        }
      }

      setRendering(false);
    } catch (err: any) {
      if (err?.name !== 'RenderingCancelledException') {
        console.error('Page render error:', err);
        setRendering(false);
      }
    }
  }, [pdfDoc, currentPage, zoom, isFullscreen]);

  useEffect(() => {
    void renderCurrentPage();
  }, [renderCurrentPage]);

  // Re-render when window resizes
  useEffect(() => {
    const handleResize = () => {
      void renderCurrentPage();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [renderCurrentPage]);

  const handlePrevPage = () => {
    setCurrentPage(prev => Math.max(1, prev - 1));
  };

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(numPages, prev + 1));
  };

  const handleZoomIn = () => {
    setZoom(prev => Math.min(2.5, +(prev + 0.15).toFixed(2)));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(0.6, +(prev - 0.15).toFixed(2)));
  };

  const handleResetZoom = () => {
    setZoom(1.1);
  };

  const handleAction = async (prompt: string | null, action: 'send' | 'compose' | 'note' | 'quote', actionId?: string, rawText?: string) => {
    if (!chatId) return;
    
    if (action === 'note' && prompt) {
      try {
        await api.createNote(chatId, {
          document_id: source.document_id,
          page_number: currentPage,
          selected_text: prompt,
        });
      } catch (e) {
        console.error('Failed to save note', e);
      }
      clearSelection();
      close();
      return;
    }
    
    clearSelection();
    close();

    if (actionId === 'mcq') {
      navigate(`/app/chats/${chatId}/quiz${rawText ? `?topic=${encodeURIComponent(rawText)}` : ''}`);
      return;
    }
    if (actionId === 'flashcard') {
      navigate(`/app/chats/${chatId}/flashcards${rawText ? `?topic=${encodeURIComponent(rawText)}` : ''}`);
      return;
    }

    if (prompt) {
      navigate(`/app/chats/${chatId}?q=${encodeURIComponent(prompt)}`);
    } else {
      navigate(`/app/chats/${chatId}`);
    }
  };

  const fileUrl = isAdmin
    ? `/api/v1/admin/documents/${source.document_id}/file#page=${currentPage}`
    : `/api/v1/documents/${source.document_id}/file#page=${currentPage}`;

  return (
    <div
      className="pdf-modal-backdrop"
      onClick={close}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: isFullscreen ? '#000000' : 'rgba(0, 0, 0, 0.5)',
        backdropFilter: isFullscreen ? 'none' : 'blur(2px)',
        zIndex: 9999,
        display: 'flex',
        justifyContent: isFullscreen ? 'center' : 'flex-end',
        alignItems: 'stretch',
        cursor: isFullscreen ? 'default' : 'pointer'
      }}
    >
      <div
        ref={drawerRef}
        className="pdf-drawer"
        onClick={e => e.stopPropagation()}
        style={{
          width: isFullscreen ? '100vw' : 'min(860px, 92vw)',
          maxWidth: isFullscreen ? '100vw' : undefined,
          height: '100vh',
          background: '#fff',
          boxShadow: isFullscreen ? 'none' : '-8px 0 35px rgba(0, 0, 0, 0.2)',
          display: 'flex',
          flexDirection: 'column',
          cursor: 'default',
          borderLeft: isFullscreen ? 'none' : '1px solid var(--border-default)',
          position: 'relative',
          zIndex: 10000,
          transition: 'width 0.2s ease, max-width 0.2s ease'
        }}
      >
        {/* Header */}
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-default)',
          background: '#fff',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          flexShrink: 0
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
              <span style={{
                background: '#EEF2FF',
                color: '#4F46E5',
                fontSize: '11px',
                fontWeight: '700',
                padding: '3px 8px',
                borderRadius: '6px',
                textTransform: 'uppercase',
                letterSpacing: '0.5px'
              }}>
                PDF
              </span>
              <strong style={{
                fontSize: '15px',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                color: 'var(--text-primary)'
              }} title={source.original_filename}>
                {formatDocName(source.original_filename, 30)}
              </strong>
            </div>

            {/* Controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              {/* Pagination */}
              {!singlePageOnly && numPages > 1 && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  background: '#f1f5f9',
                  borderRadius: '8px',
                  padding: '2px 4px',
                  gap: '4px'
                }}>
                  <button
                    type="button"
                    onClick={handlePrevPage}
                    disabled={currentPage <= 1 || loading}
                    style={{
                      border: 'none',
                      background: 'none',
                      cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
                      opacity: currentPage <= 1 ? 0.4 : 1,
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      borderRadius: '4px'
                    }}
                    title="Previous page"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <span style={{ fontSize: '13px', fontWeight: '600', padding: '0 6px', color: '#334155' }}>
                    {currentPage} / {numPages}
                  </span>
                  <button
                    type="button"
                    onClick={handleNextPage}
                    disabled={currentPage >= numPages || loading}
                    style={{
                      border: 'none',
                      background: 'none',
                      cursor: currentPage >= numPages ? 'not-allowed' : 'pointer',
                      opacity: currentPage >= numPages ? 0.4 : 1,
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      borderRadius: '4px'
                    }}
                    title="Next page"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              )}

              {/* Zoom Controls */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                background: '#f1f5f9',
                borderRadius: '8px',
                padding: '2px 4px',
                gap: '2px'
              }}>
                <button
                  type="button"
                  onClick={handleZoomOut}
                  disabled={loading}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '4px', borderRadius: '4px' }}
                  title="Zoom Out"
                >
                  <ZoomOut size={15} />
                </button>
                <button
                  type="button"
                  onClick={handleResetZoom}
                  disabled={loading}
                  style={{
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    fontSize: '12px',
                    fontWeight: '600',
                    padding: '2px 6px',
                    color: '#475569'
                  }}
                  title="Reset Zoom"
                >
                  {Math.round(zoom * 100)}%
                </button>
                <button
                  type="button"
                  onClick={handleZoomIn}
                  disabled={loading}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '4px', borderRadius: '4px' }}
                  title="Zoom In"
                >
                  <ZoomIn size={15} />
                </button>
              </div>

              {/* Open in new tab */}
              <a
                href={fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '6px 10px',
                  borderRadius: '8px',
                  background: '#f8fafc',
                  border: '1px solid var(--border-default)',
                  fontSize: '12px',
                  fontWeight: '500',
                  color: 'var(--text-secondary)',
                  textDecoration: 'none'
                }}
                title="Open original file in new tab"
              >
                <ExternalLink size={13} />
                <span className="hidden sm:inline">Download</span>
              </a>

              {/* Fullscreen Button */}
              <button
                type="button"
                onClick={toggleFullscreen}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  border: isFullscreen ? '1px solid #bfdbfe' : '1px solid var(--border-default)',
                  background: isFullscreen ? '#eff6ff' : '#f8fafc',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isFullscreen ? '#2563eb' : '#475569',
                  transition: 'all 0.15s'
                }}
                title={isFullscreen ? 'Exit Full Screen' : 'Full Screen'}
                aria-label={isFullscreen ? 'Exit Full Screen' : 'Full Screen'}
              >
                {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              </button>

              {/* Close Button */}
              <button
                type="button"
                onClick={close}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#f1f5f9',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#475569',
                  transition: 'background 0.15s'
                }}
                title="Close (Esc or click outside on the left)"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {source.excerpt && showExcerpt && (
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderLeft: '4px solid #3b82f6',
              borderRadius: '10px',
              padding: '10px 14px',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.04)',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              marginTop: '4px',
              position: 'relative'
            }}>
              {/* Header row with badge, actions and close button */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '2px 8px',
                    borderRadius: '6px',
                    background: '#eff6ff',
                    color: '#2563eb',
                    fontSize: '11px',
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase'
                  }}>
                    <Quote size={11} style={{ transform: 'rotate(180deg)' }} />
                    Citation Excerpt
                  </div>
                  {source.page_number && (
                    <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 500 }}>
                      Page {source.page_number}
                    </span>
                  )}
                </div>

                {/* Excerpt actions: Expand, Copy & Close */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {source.excerpt.length > 180 && (
                    <button
                      type="button"
                      onClick={() => setIsExcerptExpanded(!isExcerptExpanded)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 3,
                        border: 'none',
                        background: 'transparent',
                        color: '#2563eb',
                        fontSize: '11.5px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        padding: '2px 6px',
                        borderRadius: '4px'
                      }}
                      title={isExcerptExpanded ? 'Show less' : 'Show full excerpt'}
                    >
                      {isExcerptExpanded ? (
                        <><span>Less</span><ChevronUp size={13} /></>
                      ) : (
                        <><span>Expand</span><ChevronDown size={13} /></>
                      )}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(source.excerpt || '');
                      setCopiedExcerpt(true);
                      setTimeout(() => setCopiedExcerpt(false), 1500);
                    }}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: copiedExcerpt ? '#16a34a' : '#64748b',
                      fontSize: '11px',
                      cursor: 'pointer',
                      padding: '3px 6px',
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                    title="Copy excerpt to clipboard"
                  >
                    {copiedExcerpt ? <Check size={12} /> : <Copy size={12} />}
                    <span>{copiedExcerpt ? 'Copied' : 'Copy'}</span>
                  </button>

                  <div style={{ width: 1, height: 12, background: '#cbd5e1', margin: '0 2px' }} />

                  {/* Close button for citation excerpt */}
                  <button
                    type="button"
                    onClick={() => setShowExcerpt(false)}
                    style={{
                      width: '22px',
                      height: '22px',
                      borderRadius: '6px',
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#64748b',
                      transition: 'all 0.15s ease'
                    }}
                    title="Close excerpt"
                    aria-label="Close citation excerpt"
                    onMouseEnter={e => {
                      e.currentTarget.style.background = '#e2e8f0';
                      e.currentTarget.style.color = '#0f172a';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = '#64748b';
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* Excerpt text body */}
              <div style={{
                fontSize: '12px',
                color: '#334155',
                lineHeight: '1.55',
                maxHeight: isExcerptExpanded ? '200px' : '54px',
                overflowY: 'auto',
                fontStyle: 'normal',
                paddingRight: '4px',
                transition: 'max-height 0.2s ease',
                scrollbarWidth: 'thin',
                scrollbarColor: '#cbd5e1 transparent'
              }}>
                <span style={{ color: '#0f172a', fontWeight: 600, marginRight: 2 }}>“</span>
                {source.excerpt}
                <span style={{ color: '#0f172a', fontWeight: 600, marginLeft: 2 }}>”</span>
              </div>
            </div>
          )}

          {source.excerpt && !showExcerpt && (
            <div style={{ display: 'flex', justifyContent: 'flex-start', marginTop: '2px' }}>
              <button
                type="button"
                onClick={() => setShowExcerpt(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '3px 9px',
                  borderRadius: '6px',
                  background: '#f1f5f9',
                  border: '1px solid #e2e8f0',
                  color: '#475569',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = '#eff6ff';
                  e.currentTarget.style.borderColor = '#bfdbfe';
                  e.currentTarget.style.color = '#2563eb';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = '#f1f5f9';
                  e.currentTarget.style.borderColor = '#e2e8f0';
                  e.currentTarget.style.color = '#475569';
                }}
                title="View citation excerpt"
              >
                <Quote size={11} style={{ transform: 'rotate(180deg)' }} />
                <span>Show Citation Excerpt</span>
              </button>
            </div>
          )}
        </div>

        {/* Side Navigation Buttons (Desktop/Tablet) */}
        {!singlePageOnly && numPages > 1 && (
          <>
            <style>{`
              .pdf-nav-button:hover {
                background: rgba(255, 255, 255, 0.85) !important;
                color: #000000 !important;
                transform: translateY(-50%) scale(1.08) !important;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12) !important;
              }
              .pdf-nav-button:active {
                transform: translateY(-50%) scale(0.95) !important;
              }
              .pdf-viewport-container {
                scrollbar-width: auto;
                scrollbar-color: #94a3b8 #e2e8f0;
              }
              .pdf-viewport-container::-webkit-scrollbar {
                width: 10px;
                height: 10px;
              }
              .pdf-viewport-container::-webkit-scrollbar-track {
                background: #e2e8f0;
                border-radius: 6px;
              }
              .pdf-viewport-container::-webkit-scrollbar-thumb {
                background: #94a3b8;
                border-radius: 6px;
                border: 2px solid #e2e8f0;
              }
              .pdf-viewport-container::-webkit-scrollbar-thumb:hover {
                background: #64748b;
              }
            `}</style>

            {currentPage > 1 && (
              <button
                type="button"
                onClick={handlePrevPage}
                disabled={loading}
                style={{
                  position: 'absolute',
                  left: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  zIndex: 20,
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.45)',
                  backdropFilter: 'blur(4px)',
                  border: '1px solid rgba(0, 0, 0, 0.08)',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#000000',
                  transition: 'all 0.18s ease',
                  opacity: loading ? 0.5 : 1
                }}
                className="pdf-nav-button"
                title="Previous page (Left arrow)"
              >
                <ChevronLeft size={22} strokeWidth={2.8} />
              </button>
            )}

            {currentPage < numPages && (
              <button
                type="button"
                onClick={handleNextPage}
                disabled={loading}
                style={{
                  position: 'absolute',
                  right: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  zIndex: 20,
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.45)',
                  backdropFilter: 'blur(4px)',
                  border: '1px solid rgba(0, 0, 0, 0.08)',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: '#000000',
                  transition: 'all 0.18s ease',
                  opacity: loading ? 0.5 : 1
                }}
                className="pdf-nav-button"
                title="Next page (Right arrow)"
              >
                <ChevronRight size={22} strokeWidth={2.8} />
              </button>
            )}
          </>
        )}

        {/* Content Body */}
        <div
          ref={containerRef}
          className="pdf-viewport-container"
          onTouchStart={(e) => {
            setTouchEndX(null);
            setTouchStartX(e.targetTouches[0].clientX);
          }}
          onTouchMove={(e) => {
            setTouchEndX(e.targetTouches[0].clientX);
          }}
          onTouchEnd={() => {
            if (touchStartX === null || touchEndX === null) return;
            const distance = touchStartX - touchEndX;
            // 50px threshold for a swipe
            if (distance > 50 && !singlePageOnly) {
              handleNextPage();
            } else if (distance < -50 && !singlePageOnly) {
              handlePrevPage();
            }
          }}
          style={{
            flex: 1,
            minHeight: 0,
            overflowX: 'auto',
            overflowY: 'auto',
            background: '#cbd5e1',
            padding: '24px 20px',
            position: 'relative',
            boxSizing: 'border-box'
          }}
        >
          {loading && (
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(255,255,255,0.9)',
              zIndex: 10,
              gap: '12px'
            }}>
              <Loader2 size={36} className="animate-spin" style={{ color: 'var(--accent-blue)' }} />
              <div style={{ fontSize: '14px', fontWeight: '600', color: '#334155' }}>Loading Document...</div>
            </div>
          )}

          {error && (
            <div style={{
              margin: 'auto',
              background: '#fff',
              padding: '24px 32px',
              borderRadius: '12px',
              textAlign: 'center',
              maxWidth: '420px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
            }}>
              <p style={{ color: 'var(--accent-red)', marginBottom: '16px', fontSize: '14px', fontWeight: '500' }}>{error}</p>
              <a
                href={fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn btn-primary btn-sm"
                style={{ textDecoration: 'none' }}
              >
                Try opening in new tab
              </a>
            </div>
          )}

          {!error && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                width: 'fit-content',
                minWidth: '100%',
                margin: '0 auto',
                paddingBottom: '20px'
              }}
            >
              <div style={{
                position: 'relative',
                boxShadow: '0 10px 30px rgba(0, 0, 0, 0.2)',
                borderRadius: '4px',
                overflow: 'hidden',
                background: '#fff',
                width: 'fit-content',
                maxWidth: 'none',
                flexShrink: 0
              }}>
                {rendering && (
                  <div style={{
                    position: 'absolute',
                    top: 12,
                    right: 12,
                    background: 'rgba(0,0,0,0.65)',
                    color: '#fff',
                    borderRadius: '20px',
                    padding: '4px 12px',
                    fontSize: '11px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    zIndex: 5
                  }}>
                    <Loader2 size={12} className="animate-spin" /> Rendering...
                  </div>
                )}
                <div style={{ position: 'relative' }}>
                  <canvas
                    ref={canvasRef}
                    style={{
                      display: 'block',
                      background: '#fff'
                    }}
                  />
                  <div 
                    ref={textLayerRef} 
                    className="pdf-text-layer textLayer" 
                    style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden', lineHeight: 1 }} 
                  />
                  {selection.text && chatId && (
                    <SelectionToolbar
                      selection={selection}
                      chatId={chatId}
                      documentId={source.document_id}
                      pageNumber={currentPage}
                      onAction={handleAction}
                      onDismiss={clearSelection}
                    />
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
