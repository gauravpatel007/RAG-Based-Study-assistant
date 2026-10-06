import React, { useEffect, useRef } from 'react';
import { X, ExternalLink } from 'lucide-react';
import { createPortal } from 'react-dom';

interface ImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  altText?: string;
}

export function ImageModal({ isOpen, onClose, imageUrl, altText = "Image" }: ImageModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
    }
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) {
      onClose();
    }
  };

  return createPortal(
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        animation: 'fadeIn 0.2s ease-out'
      }}
    >
      <div style={{ position: 'absolute', top: '24px', right: '24px', display: 'flex', alignItems: 'center', gap: '10px', zIndex: 10000 }}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            window.open(imageUrl, '_blank');
          }}
          style={{
            background: 'rgba(255, 255, 255, 0.15)',
            border: '1px solid rgba(255, 255, 255, 0.25)',
            borderRadius: '8px',
            color: 'white',
            cursor: 'pointer',
            padding: '8px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '13px',
            fontWeight: '600',
            transition: 'all 0.2s',
            backdropFilter: 'blur(8px)'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'}
          title="Open image in new window/tab"
          aria-label="Open in new window"
        >
          <ExternalLink size={15} />
          <span>New Window</span>
        </button>

        <button
          onClick={onClose}
          style={{
            background: 'rgba(255, 255, 255, 0.15)',
            border: '1px solid rgba(255, 255, 255, 0.25)',
            borderRadius: '8px',
            color: 'white',
            cursor: 'pointer',
            padding: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s',
            backdropFilter: 'blur(8px)'
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)'}
          aria-label="Close"
        >
          <X size={20} strokeWidth={2} />
        </button>
      </div>

      <div
        style={{
          position: 'relative',
          width: '85vw',
          height: '80vh',
          maxWidth: '1200px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          animation: 'scaleIn 0.2s ease-out'
        }}
      >
        <img
          src={imageUrl}
          alt={altText}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            borderRadius: '16px',
            boxShadow: '0 12px 48px rgba(0, 0, 0, 0.5)'
          }}
        />
      </div>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>,
    document.body
  );
}
