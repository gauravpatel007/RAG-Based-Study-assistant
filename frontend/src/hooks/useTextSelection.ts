import { useEffect, useState, useCallback } from 'react';

export interface TextSelection {
  text: string;
  rect: DOMRect | null;  // bounding rect of the selection
}

export function useTextSelection(containerRef: React.RefObject<HTMLElement | null>) {
  const [selection, setSelection] = useState<TextSelection>({ text: '', rect: null });

  const handleMouseUp = useCallback(() => {
    const sel = window.getSelection();
    const text = sel?.toString().trim() ?? '';
    if (!text || !containerRef.current) {
      setSelection({ text: '', rect: null });
      return;
    }
    // Ensure selection is inside our container
    const range = sel!.getRangeAt(0);
    if (!containerRef.current.contains(range.commonAncestorContainer)) {
      setSelection({ text: '', rect: null });
      return;
    }
    const rect = range.getBoundingClientRect();
    setSelection({ text, rect });
  }, [containerRef]);

  const clear = useCallback(() => {
    window.getSelection()?.removeAllRanges();
    setSelection({ text: '', rect: null });
  }, []);

  useEffect(() => {
    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, [handleMouseUp]);

  return { selection, clearSelection: clear };
}
