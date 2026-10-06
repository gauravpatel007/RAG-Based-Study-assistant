import React from 'react';
import { BookOpen, Sparkles, Lightbulb, HelpCircle, CreditCard, StickyNote, MessageSquare, Quote } from 'lucide-react';
import { type TextSelection } from '../hooks/useTextSelection';
import './SelectionToolbar.css';

interface Props {
  selection: TextSelection;
  chatId: string;
  documentId: string;
  pageNumber: number;
  onAction: (prompt: string | null, action: 'send' | 'compose' | 'note' | 'quote') => void;
  onDismiss: () => void;
}

const ACTIONS = [
  { id: 'explain',    label: 'Explain',         icon: BookOpen,     color: '#006aff', action: 'send' },
  { id: 'simplify',   label: 'Simplify',        icon: Sparkles,     color: '#7b5ea7', action: 'send' },
  { id: 'example',    label: 'Give Example',    icon: Lightbulb,    color: '#f5a623', action: 'send' },
  { id: 'mcq',        label: 'Generate MCQ',    icon: HelpCircle,   color: '#00b259', action: 'send' },
  { id: 'flashcard',  label: 'Create Flashcard',icon: CreditCard,   color: '#e22134', action: 'send' },
  { id: 'ask',        label: 'Ask AI',          icon: MessageSquare,color: '#1a1a1a', action: 'compose' },
  { id: 'note',       label: 'Add to Notes',    icon: StickyNote,   color: '#f5a623', action: 'note' },
  { id: 'quote',      label: 'Quote to Chat',   icon: Quote,        color: '#6b6b6b', action: 'quote' },
] as const;

export function SelectionToolbar({ selection, onAction, onDismiss }: Props) {
  if (!selection.rect || !selection.text) return null;

  const handleAction = (e: React.MouseEvent, actionItem: typeof ACTIONS[number]) => {
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
        // Prompt is passed as text for notes
        prompt = text;
        break;
    }
    
    onAction(prompt, actionItem.action);
    onDismiss();
  };

  // Position above the selection
  const top = selection.rect.top - 50; // 50px above selection
  const left = selection.rect.left + selection.rect.width / 2;

  return (
    <div 
      className="selection-toolbar"
      style={{
        top: `${top}px`,
        left: `${left}px`,
        transform: 'translateX(-50%)',
      }}
    >
      <div className="selection-toolbar-inner">
        {ACTIONS.map((action) => {
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
        })}
      </div>
      <div className="selection-toolbar-arrow" />
    </div>
  );
}
