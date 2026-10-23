import React, { useRef, useLayoutEffect, useState } from 'react';
import { BookOpen, Sparkles, Lightbulb, HelpCircle, CreditCard, StickyNote, MessageSquare, Quote } from 'lucide-react';
import { type TextSelection } from '../hooks/useTextSelection';
import './SelectionToolbar.css';

interface Props {
  selection: TextSelection;
  chatId: string;
  documentId: string;
  pageNumber: number;
  onAction: (prompt: string | null, action: 'send' | 'compose' | 'note' | 'quote', actionId?: string, rawText?: string) => void;
  onDismiss: () => void;
}

const STUDY_ACTIONS = [
  { id: 'explain',    label: 'Explain',     icon: BookOpen,     color: '#006aff', action: 'send' },
  { id: 'simplify',   label: 'Simplify',    icon: Sparkles,     color: '#7b5ea7', action: 'send' },
  { id: 'example',    label: 'Example',     icon: Lightbulb,    color: '#f5a623', action: 'send' },
  { id: 'mcq',        label: 'Quiz',        icon: HelpCircle,   color: '#00b259', action: 'send' },
  { id: 'flashcard',  label: 'Flashcard',   icon: CreditCard,   color: '#e22134', action: 'send' },
] as const;

const WORKSPACE_ACTIONS = [
  { id: 'ask',        label: 'Ask AI',      icon: MessageSquare,color: '#1a1a1a', action: 'compose' },
  { id: 'note',       label: 'Note',        icon: StickyNote,   color: '#f5a623', action: 'note' },
  { id: 'quote',      label: 'Quote',       icon: Quote,        color: '#6b6b6b', action: 'quote' },
] as const;

export function SelectionToolbar({ selection, onAction, onDismiss }: Props) {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: -9999, left: -9999, arrowLeft: 50, placement: 'top', opacity: 0 });

  useLayoutEffect(() => {
    if (!selection.rect || !toolbarRef.current) return;
    const rect = selection.rect;
    const toolbar = toolbarRef.current;
    
    // We use a small timeout or frame to ensure the DOM has laid out the text and buttons.
    const frame = requestAnimationFrame(() => {
      const width = toolbar.offsetWidth;
      const height = toolbar.offsetHeight;
      
      const selCenterX = rect.left + rect.width / 2;
      let left = selCenterX - width / 2;
      
      const margin = 12;
      if (left < margin) left = margin;
      if (left + width > window.innerWidth - margin) left = window.innerWidth - width - margin;
      
      let arrowLeft = selCenterX - left;
      if (arrowLeft < 24) arrowLeft = 24;
      if (arrowLeft > width - 24) arrowLeft = width - 24;
      
      let top = rect.top - height - 12;
      let placement = 'top';
      if (top < 60) {
        top = rect.bottom + 12;
        placement = 'bottom';
      }
      
      setPosition({ top, left, arrowLeft, placement, opacity: 1 });
    });
    
    return () => cancelAnimationFrame(frame);
  }, [selection.rect]);

  if (!selection.rect || !selection.text) return null;

  const handleAction = (e: React.MouseEvent, actionItem: typeof STUDY_ACTIONS[number] | typeof WORKSPACE_ACTIONS[number]) => {
    e.preventDefault();
    e.stopPropagation();
    
    let prompt = null;
    const { text } = selection;
    
    switch (actionItem.id) {
      case 'explain':
        prompt = `Explain this passage from the textbook: «${text}»`;
        break;
      case 'simplify':
        prompt = `Simplify this in plain, easy-to-understand language: «${text}»`;
        break;
      case 'example':
        prompt = `Give a real-world example that illustrates this concept: «${text}»`;
        break;
      case 'mcq':
        prompt = `Generate a multiple-choice question (with 4 options and the correct answer) to test understanding of: «${text}»`;
        break;
      case 'flashcard':
        prompt = `Create a flashcard (Question and Answer) for this concept: «${text}»`;
        break;
      case 'ask':
        prompt = `«${text}»\n\nMy question: `;
        break;
      case 'quote':
        prompt = `> «${text}»\n\n`;
        break;
      case 'note':
        prompt = text;
        break;
    }
    
    onAction(prompt, actionItem.action, actionItem.id, text);
    onDismiss();
  };

  const renderAction = (action: any) => {
    const Icon = action.icon;
    return (
      <button
        key={action.id}
        className="selection-toolbar-btn"
        onClick={(e) => handleAction(e, action)}
        title={action.label}
        style={{ '--hover-color': action.color } as React.CSSProperties}
      >
        <Icon size={16} />
        <span>{action.label}</span>
      </button>
    );
  };

  return (
    <div 
      ref={toolbarRef}
      className={`selection-toolbar placement-${position.placement}`}
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
        opacity: position.opacity,
        visibility: position.opacity === 0 ? 'hidden' : 'visible'
      }}
    >
      <div className="selection-toolbar-inner">
        <div className="toolbar-group">
          {STUDY_ACTIONS.map(renderAction)}
        </div>
        <div className="toolbar-divider" />
        <div className="toolbar-group">
          {WORKSPACE_ACTIONS.map(renderAction)}
        </div>
      </div>
      <div 
        className="selection-toolbar-arrow"
        style={{ left: `${position.arrowLeft}px` }}
      />
    </div>
  );
}
