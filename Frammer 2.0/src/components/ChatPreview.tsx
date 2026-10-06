import { useRef, useState } from 'react';
import { ArrowUp, Check, Copy, FileText, Paperclip, Search, Sparkles, ThumbsDown, ThumbsUp, X } from 'lucide-react';

const answer = 'Multi-head attention runs several attention functions in parallel, each learning a different representation subspace [S1]. Their outputs are concatenated and projected, letting the model jointly attend to information from different positions [S2].';
const recent = [
  ['Transformer attention', '12 messages · 2 docs'],
  ['Organic chemistry ch. 4', '8 messages · 1 doc'],
  ['Macroeconomics revision', '21 messages · 3 docs'],
];

export default function ChatPreview({ appUrl }: { appUrl: string }) {
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(false);
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);
  const [source, setSource] = useState(412);
  const dialog = useRef<HTMLDialogElement>(null);

  async function copyAnswer() {
    try {
      await navigator.clipboard.writeText(answer);
      setCopied(true);
      setCopyError(false);
    } catch { setCopyError(true); }
  }

  function openSource(page: number) {
    setSource(page);
    dialog.current?.showModal();
  }

  return (
    <div className="sl-chat-preview" role="region" aria-label="Illustrative study chat preview">
      <aside className="sl-chat-sidebar" aria-label="Example conversations">
        <a href={appUrl} className="sl-new-chat"><Sparkles size={15} /> New chat</a>
        <span className="sl-recent-label">Recent</span>
        {recent.map(([title, detail], index) => <a href={appUrl} className={`sl-recent-chat ${index === 0 ? 'is-selected' : ''}`} key={title}><span>{title}</span><small>{detail}</small></a>)}
      </aside>
      <div className="sl-chat-main">
        <div className="sl-chat-context"><span><Search size={11} /> Searching 1 of 3 selected</span><small>Deep_Learning.pdf</small></div>
        <p className="sl-user-message">What is multi-head attention and why does it help?</p>
        <div className="sl-assistant-message"><span className="sl-assistant-icon"><Sparkles size={16} /></span><div>
          <p>{answer}</p>
          <div className="sl-source-chips">{[412, 413].map(page => <button key={page} onClick={() => openSource(page)}><FileText size={12} /> Deep_Learning.pdf · PDF page {page}</button>)}</div>
          <div className="sl-message-actions">
            <button className="sl-icon-button" aria-label={copied ? 'Answer copied' : 'Copy example answer'} onClick={copyAnswer}>{copied ? <Check size={15} /> : <Copy size={15} />}</button>
            <button className="sl-icon-button" aria-label="Like example answer" aria-pressed={feedback === 'up'} onClick={() => setFeedback(feedback === 'up' ? null : 'up')}><ThumbsUp size={15} /></button>
            <button className="sl-icon-button" aria-label="Dislike example answer" aria-pressed={feedback === 'down'} onClick={() => setFeedback(feedback === 'down' ? null : 'down')}><ThumbsDown size={15} /></button>
            <span className="sl-demo-status" role="status">{copyError ? 'Copy unavailable in this browser.' : feedback ? 'Preview feedback only' : copied ? 'Copied' : ''}</span>
          </div>
        </div></div>
        <a className="sl-composer" href={appUrl} aria-label="Open Study Assistant to ask about your documents"><Paperclip size={19} /><span>Ask about your documents…</span><span className="sl-send"><ArrowUp size={18} /></span></a>
      </div>
      <dialog className="sl-source-dialog" ref={dialog} onClick={e => { if (e.target === e.currentTarget) dialog.current?.close(); }}>
        <div className="sl-dialog-header"><span className="sl-eyebrow">Illustrative source preview</span><button className="sl-icon-button" aria-label="Close source preview" onClick={() => dialog.current?.close()}><X size={20} /></button></div>
        <h2>Deep_Learning.pdf</h2><p className="sl-dialog-page">PDF page {source}</p>
        <blockquote>{source === 412 ? 'Multi-head attention runs several attention functions in parallel, each learning a different representation subspace.' : 'Their outputs are concatenated and projected, letting the model jointly attend to information from different positions.'}</blockquote>
        <p>This is a sample of the source inspector, not an excerpt from an uploaded textbook. Upload your own PDF in Study Assistant to explore real citations.</p>
        <a href={appUrl} className="sl-button">Open Study Assistant <ArrowUp size={16} /></a>
      </dialog>
    </div>
  );
}
