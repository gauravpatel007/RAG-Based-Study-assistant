import React, { useRef, useEffect, useState, useCallback } from 'react';
import { getDocument, GlobalWorkerOptions, TextLayer } from 'pdfjs-dist';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut } from 'lucide-react';
import 'pdfjs-dist/web/pdf_viewer.css';
import './PdfViewer.css';
import { CircleBuffer } from './CircleBuffer';

GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

interface Props {
  documentId: string;
  initialPage?: number;
  isAdmin?: boolean;
  onPageChange?: (page: number) => void;
  children?: React.ReactNode; // for passing the toolbar inside
}

export function PdfViewer({ documentId, initialPage = 1, isAdmin, onPageChange, children }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<any>(null);
  const textLayerTaskRef = useRef<any>(null);

  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState<number>(initialPage);
  const [numPages, setNumPages] = useState<number>(1);
  const [zoom, setZoom] = useState<number>(1.0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');

  // Load PDF Document
  useEffect(() => {
    let isCancelled = false;
    let loadingTask: any = null;

    const loadPdf = async () => {
      setLoading(true);
      setError('');

      try {
        const fileUrl = isAdmin
          ? `/api/v1/admin/documents/${documentId}/file`
          : `/api/v1/documents/${documentId}/file`;
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
        setCurrentPage(Math.min(Math.max(1, initialPage), pdf.numPages));
        setLoading(false);
      } catch (err: any) {
        if (!isCancelled) {
          console.error('Failed to load PDF document:', err);
          setError(err?.message || 'This document could not be opened.');
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
        } catch (e) {}
      }
    };
  }, [documentId, isAdmin, initialPage]);

  // Render Page to Canvas + Text Layer
  const renderCurrentPage = useCallback(async () => {
    if (!pdfDoc || !canvasRef.current || !textLayerRef.current) return;

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

    try {
      const page = await pdfDoc.getPage(currentPage);
      const canvas = canvasRef.current;
      const textLayer = textLayerRef.current;

      const baseViewport = page.getViewport({ scale: 1 });
      const containerWidth = containerRef.current ? containerRef.current.clientWidth - 40 : 800;
      const fitScale = Math.min(2.5, Math.max(0.6, containerWidth / baseViewport.width));
      const effectiveScale = fitScale * zoom;

      const viewport = page.getViewport({ scale: effectiveScale });
      const context = canvas.getContext('2d');
      if (!context) return;

      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      
      textLayer.style.width = `${Math.floor(viewport.width)}px`;
      textLayer.style.height = `${Math.floor(viewport.height)}px`;
      textLayer.style.setProperty('--scale-factor', viewport.scale.toString());
      textLayer.innerHTML = '';

      const transform = dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : undefined;

      const renderContext = {
        canvasContext: context,
        transform: transform,
        viewport: viewport
      };

      const renderTask = page.render(renderContext);
      renderTaskRef.current = renderTask;

      await renderTask.promise;
      
      // Render Text Layer
      const textContent = await page.getTextContent();
      const textLayerInstance = new TextLayer({
        textContentSource: textContent,
        container: textLayer,
        viewport: viewport,
      });
      textLayerTaskRef.current = textLayerInstance;
      await textLayerInstance.render();
      
    } catch (err: any) {
      if (err?.name !== 'RenderingCancelledException') {
        console.error('Page render error:', err);
      }
    }
  }, [pdfDoc, currentPage, zoom]);

  useEffect(() => {
    void renderCurrentPage();
  }, [renderCurrentPage]);

  // Handle Keyboard Nav
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (pdfDoc) {
        if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
          handlePrevPage();
        } else if (e.key === 'ArrowRight' || e.key === 'PageDown') {
          handleNextPage();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pdfDoc, numPages]);

  const handlePrevPage = () => {
    setCurrentPage(prev => {
      const next = Math.max(1, prev - 1);
      if (next !== prev && onPageChange) onPageChange(next);
      return next;
    });
  };

  const handleNextPage = () => {
    setCurrentPage(prev => {
      const next = Math.min(numPages, prev + 1);
      if (next !== prev && onPageChange) onPageChange(next);
      return next;
    });
  };

  return (
    <div className="pdf-viewer-container">
      <div className="pdf-viewer-toolbar">
        <div className="pdf-viewer-controls">
          <button onClick={handlePrevPage} disabled={currentPage <= 1 || loading} className="btn-icon">
            <ChevronLeft size={18} />
          </button>
          <span className="page-indicator">
            Page {currentPage} of {numPages}
          </span>
          <button onClick={handleNextPage} disabled={currentPage >= numPages || loading} className="btn-icon">
            <ChevronRight size={18} />
          </button>
        </div>
        
        <div className="pdf-viewer-controls">
          <button onClick={() => setZoom(z => Math.max(0.5, z - 0.2))} disabled={loading} className="btn-icon">
            <ZoomOut size={18} />
          </button>
          <span className="zoom-indicator">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom(z => Math.min(2.5, z + 0.2))} disabled={loading} className="btn-icon">
            <ZoomIn size={18} />
          </button>
        </div>
      </div>

      <div className="pdf-viewer-content" ref={containerRef}>
        {loading && (
          <div className="pdf-loading">
            <CircleBuffer minHeight={120} size={36} />
          </div>
        )}
        {error && (
          <div className="pdf-error">
            <p>{error}</p>
          </div>
        )}
        
        {!loading && !error && (
          <div className="pdf-page-container">
            <canvas ref={canvasRef} className="pdf-canvas" />
            <div ref={textLayerRef} className="pdf-text-layer textLayer" />
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
