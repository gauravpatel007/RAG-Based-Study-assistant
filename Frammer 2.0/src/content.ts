import { FileText, Layers, ListChecks, LockKeyhole, MessageSquare, Quote, ScanText, Shield, Zap } from 'lucide-react';

export const benefits = [
  { icon: LockKeyhole, title: '100% local & private', description: 'Ollama, Sentence-Transformers and ChromaDB run on your computer. Nothing leaves it.' },
  { icon: Zap, title: 'Zero API cost', description: 'Completely free to run. No OpenAI, Anthropic or cloud subscriptions required.' },
  { icon: Shield, title: 'Grounded answers', description: 'Answers come only from your textbook. If it isn’t in the material, it says so.' },
  { icon: Quote, title: 'Auditable citations', description: 'Every claim links to a verifiable PDF page and the exact excerpt behind it.' },
];

export const steps = [
  { title: 'Upload your materials', description: 'Drop in up to 5 PDFs per chat — 50 MB and 1,000 pages each. Scanned pages are read with Tesseract OCR automatically.' },
  { title: 'Ask in plain language', description: 'Scope to one book or search everything. Follow-ups like “explain it simpler” keep context, and answers stream in real time.' },
  { title: 'Verify and revise', description: 'Click any citation to see the exact excerpt and page. Generate ranked important topics with page references for revision.' },
];

export const features = [
  { icon: ScanText, title: 'Multi-PDF ingestion & OCR', description: 'PyMuPDF extraction with page offsets, ligature cleanup and automatic OCR for scanned pages.' },
  { icon: Layers, title: 'Semantic retrieval', description: '200-token chunks, local 384-dim embeddings and cosine search in ChromaDB with smart deduplication.' },
  { icon: Shield, title: 'Citation repair loop', description: 'Every claim is checked against [S1], [S2] source labels. Uncited answers are automatically repaired.' },
  { icon: FileText, title: 'Source inspector', description: 'Clickable source chips open the verbatim excerpt, page number and the original PDF in your browser.' },
  { icon: ListChecks, title: 'Important topics generator', description: 'Ranked exam topics with descriptions, importance rationale and page references. Quizzes and flashcards next.' },
  { icon: MessageSquare, title: 'ChatGPT-style interface', description: 'Frosted glass composer, smart auto-scroll, copy, feedback, inline rename and a stop button.' },
];

export const metrics = [
  { value: '50 MB', label: 'per PDF document' },
  { value: '1,000', label: 'pages per document' },
  { value: '4,096', label: 'token context budget' },
  { value: '$0', label: 'API cost, forever' },
];
