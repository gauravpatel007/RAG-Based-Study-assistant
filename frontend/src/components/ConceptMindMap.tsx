import { useState, useEffect, useCallback } from 'react';
import { ReactFlow, Controls, Background, Panel, useNodesState, useEdgesState, Handle, Position } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import { api } from '@/lib/api';
import { Loader2, Network } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import PdfSource, { type Source } from '@/components/PdfSource';
import { X, Play, Brain, MessageSquare } from 'lucide-react';

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const nodeWidth = 250;
const nodeHeight = 100;

const getLayoutedElements = (nodes: any[], edges: any[], direction = 'TB') => {
  const isHorizontal = direction === 'LR';
  dagreGraph.setGraph({ rankdir: direction, nodesep: 50, ranksep: 100 });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  nodes.forEach((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    node.targetPosition = isHorizontal ? 'left' : 'top';
    node.sourcePosition = isHorizontal ? 'right' : 'bottom';
    
    // We are shifting the dagre node position (anchor=center center) to the top left
    // so it matches the React Flow node anchor point (top left).
    node.position = {
      x: nodeWithPosition.x - nodeWidth / 2,
      y: nodeWithPosition.y - nodeHeight / 2,
    };

    return node;
  });

  return { nodes, edges };
};

const COLORS = [
  { bg: '#bbf7d0', border: '#4ade80', text: '#166534', edge: '#4ade80' }, // green
  { bg: '#fef08a', border: '#facc15', text: '#854d0e', edge: '#facc15' }, // yellow
  { bg: '#bfdbfe', border: '#60a5fa', text: '#1e3a8a', edge: '#60a5fa' }, // blue
  { bg: '#e9d5ff', border: '#c084fc', text: '#581c87', edge: '#c084fc' }, // purple
  { bg: '#bae6fd', border: '#38bdf8', text: '#075985', edge: '#38bdf8' }, // lightblue
  { bg: '#fed7aa', border: '#fb923c', text: '#9a3412', edge: '#fb923c' }, // orange
];

const mindmapStyles = `
  @keyframes spin-slow {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
`;

function CustomNode({ data, selected }: { data: any, selected: boolean }) {
  if (data.isRoot) {
    return (
      <>
        <style>{mindmapStyles}</style>
        <div 
          style={{ 
            width: '100px', 
            height: '100px',
            backgroundColor: '#f97316',
            color: 'white',
            fontWeight: 'bold',
            fontSize: '14px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '4px solid #fdba74',
            boxShadow: selected ? '0 0 0 4px #fed7aa, 0 10px 15px -3px rgba(0,0,0,0.1)' : '0 10px 15px -3px rgba(0,0,0,0.1)',
            transform: selected ? 'scale(1.05)' : 'scale(1)',
            transition: 'all 0.2s',
            position: 'relative',
            cursor: 'grab'
          }}
        >
          <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
          <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
          <Handle type="source" position={Position.Left} style={{ opacity: 0 }} />
          <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
          
          <div style={{
            position: 'absolute',
            top: '-16px', left: '-16px', right: '-16px', bottom: '-16px',
            borderRadius: '50%',
            border: '4px dashed #fb923c',
            animation: 'spin-slow 20s linear infinite',
            pointerEvents: 'none',
            opacity: 0.6
          }} />
          
          <div style={{ position: 'relative', zIndex: 10, textAlign: 'center', padding: '8px' }}>
            {data.label}
          </div>
        </div>
      </>
    );
  }

  const theme = data.theme || COLORS[0];

  return (
    <div 
      style={{ 
        backgroundColor: theme.bg, 
        borderColor: theme.border, 
        color: theme.text,
        borderWidth: '2px',
        borderStyle: 'solid',
        borderRadius: '9999px',
        padding: '8px 16px',
        fontWeight: 600,
        fontSize: '13px',
        boxShadow: selected ? `0 0 0 3px ${theme.border}40, 0 4px 6px -1px rgba(0,0,0,0.1)` : '0 4px 6px -1px rgba(0,0,0,0.1)',
        transform: selected ? 'scale(1.05)' : 'scale(1)',
        transition: 'all 0.2s',
        minWidth: '100px',
        textAlign: 'center',
        cursor: 'grab',
        position: 'relative'
      }}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <Handle type="target" position={Position.Bottom} style={{ opacity: 0 }} />
      <Handle type="target" position={Position.Right} style={{ opacity: 0 }} />
      
      <span>{data.label}</span>
    </div>
  );
}

const nodeTypes = {
  custom: CustomNode,
};

export default function ConceptMindMap({ topicSet, isGeneratingTopics }: { topicSet: any, isGeneratingTopics: boolean }) {
  const { chatId } = useParams<{ chatId: string }>();
  const navigate = useNavigate();
  const [nodes, setNodes, onNodesChange] = useNodesState<any>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<any>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [expandingJobId, setExpandingJobId] = useState<string | null>(null);
  const [pdfSource, setPdfSource] = useState<Source | null>(null);
  const [hasAttemptedAutoGenerate, setHasAttemptedAutoGenerate] = useState(false);
  const [generatingJobId, setGeneratingJobId] = useState<string | null>(null);
  const [completionTime, setCompletionTime] = useState<number | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const onNodeClick = useCallback((_: React.MouseEvent, node: any) => {
    setSelectedTopicId(node.id);
  }, []);
  
  const fetchMap = useCallback(async () => {
    if (!chatId || !topicSet) return;
    setLoading(true);
    setError('');
    try {
      const edgeData = await api.getConceptMapEdges(chatId, topicSet.id);
      
      const jobs = await api.getChatJobs(chatId);
      const mindMapJobs = jobs.items.filter(j => j.type === 'generate_concept_map' && j.payload?.topic_set_id === topicSet.id);
      const latestJob = mindMapJobs.length > 0 ? mindMapJobs[0] : null;

      if (latestJob) {
          if (['pending', 'running'].includes(latestJob.status)) {
              setGenerating(true);
              setGeneratingJobId(latestJob.id);
          } else if (latestJob.status === 'complete' && latestJob.updated_at) {
              setCompletionTime(Math.max(0, Math.floor((Date.parse(latestJob.updated_at) - Date.parse(topicSet.created_at)) / 1000)));
          }
      }

      if (edgeData.length > 0) {
        
        // Calculate in-degree to find roots
        const inDegree: Record<string, number> = {};
        topicSet.topics.forEach((t: any) => inDegree[t.id] = 0);
        edgeData.forEach((e: any) => {
          if (inDegree[e.target_topic_id] !== undefined) {
             inDegree[e.target_topic_id]++;
          }
        });

        // Breadth-first traversal to assign branches and colors
        const nodeThemeMap: Record<string, typeof COLORS[0]> = {};
        const isRootMap: Record<string, boolean> = {};
        
        const roots = topicSet.topics.filter((t: any) => inDegree[t.id] === 0);
        if (roots.length === 0 && topicSet.topics.length > 0) roots.push(topicSet.topics[0]); // fallback
        
        roots.forEach((r: any) => {
            isRootMap[r.id] = true;
        });

        // Assign branch colors based on edges from roots
        let colorIdx = 0;
        const queue: { id: string, color: typeof COLORS[0] }[] = [];
        
        edgeData.forEach((e: any) => {
           if (isRootMap[e.source_topic_id] && !nodeThemeMap[e.target_topic_id]) {
               const theme = COLORS[colorIdx % COLORS.length];
               nodeThemeMap[e.target_topic_id] = theme;
               queue.push({ id: e.target_topic_id, color: theme });
               colorIdx++;
           }
        });

        // BFS to propagate colors
        while (queue.length > 0) {
            const curr = queue.shift()!;
            edgeData.forEach((e: any) => {
                if (e.source_topic_id === curr.id && !nodeThemeMap[e.target_topic_id] && !isRootMap[e.target_topic_id]) {
                    nodeThemeMap[e.target_topic_id] = curr.color;
                    queue.push({ id: e.target_topic_id, color: curr.color });
                }
            });
        }
        
        // Fallback for unconnected nodes
        topicSet.topics.forEach((t: any) => {
            if (!isRootMap[t.id] && !nodeThemeMap[t.id]) {
                nodeThemeMap[t.id] = COLORS[Math.floor(Math.random() * COLORS.length)];
            }
        });

        const initialNodes = topicSet.topics.map((t: any) => ({
          id: t.id,
          type: 'custom',
          data: { 
              label: t.title, 
              description: t.description,
              isRoot: !!isRootMap[t.id],
              theme: nodeThemeMap[t.id]
          }
        }));
        
        const initialEdges = edgeData.map((e: any) => {
          const theme = nodeThemeMap[e.target_topic_id] || COLORS[0];
          return {
            id: e.id,
            source: e.source_topic_id,
            target: e.target_topic_id,
            type: 'default',
            animated: true,
            style: { 
                stroke: theme.edge, 
                strokeWidth: 2,
                strokeDasharray: '5,5' 
            }
          };
        });

        const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(initialNodes, initialEdges, 'LR');
        setNodes(layoutedNodes);
        setEdges(layoutedEdges);
        setGenerating(false);
      } else {
        setNodes([]);
        setEdges([]);
        // Auto-generate once if it's empty, and no job is running
        if (!hasAttemptedAutoGenerate && !generating && (!latestJob || !['pending', 'running'].includes(latestJob.status))) {
          setHasAttemptedAutoGenerate(true);
          setTimeout(() => handleGenerate(), 0);
        }
      }
    } catch (e: any) {
      setError(e.message || 'Failed to load concept map');
    } finally {
      setLoading(false);
    }
  }, [chatId, topicSet, setNodes, setEdges, generating, hasAttemptedAutoGenerate]);

  useEffect(() => {
    fetchMap();
  }, [fetchMap]);
  
  // Polling if generating
  useEffect(() => {
    if (!generating || !chatId || !topicSet) return;
    let stopped = false;
    const timer = setInterval(() => {
      if (generatingJobId) {
          api.getJob(generatingJobId).then(job => {
              if (job.status === 'failed' || job.status === 'cancelled') {
                  setGenerating(false);
                  setGeneratingJobId(null);
                  setError(`Generation ${job.status}: ${job.error_code || 'Unknown error'}`);
              } else if (job.status === 'complete') {
                  if (!stopped) {
                      setGenerating(false);
                      setGeneratingJobId(null);
                      fetchMap();
                  }
              }
          }).catch(() => {});
      } else {
          api.getConceptMapEdges(chatId, topicSet.id).then(edgeData => {
            if (!stopped && edgeData.length > 0) {
                setGenerating(false);
                fetchMap();
            }
          }).catch(e => {
            if (!stopped) setError(e.message);
          });
      }
    }, 2000);
    return () => { stopped = true; clearInterval(timer); };
  }, [generating, generatingJobId, chatId, topicSet, fetchMap]);

  useEffect(() => {
    if (!expandingJobId) return;
    const timer = setInterval(() => {
      api.getJob(expandingJobId).then(job => {
        if (job.status === 'complete') {
          setExpandingJobId(null);
          // Wait briefly, then fetch the updated map. It might need a reload of topics if topicSet is cached, 
          // but since topicSet is passed via props, we might just reload the edges and recreate nodes from edges?
          // Actually, our getConceptMapEdges just returns edges. We need to reload the TopicSet to get new nodes.
          // For now, we can trigger a hard reload of the page or just let the user see it after reloading the parent component.
          // Let's trigger fetchMap and see if topicSet needs a refresh. If we need to refresh TopicSet, we can call window.location.reload() or pass a callback.
          window.location.reload(); 
        } else if (job.status === 'failed' || job.status === 'cancelled') {
          setExpandingJobId(null);
          setError(`Expand branch failed: ${job.error_code}`);
        }
      });
    }, 2000);
    return () => clearInterval(timer);
  }, [expandingJobId]);

  async function handleGenerate() {
    if (!chatId || !topicSet) return;
    setGenerating(true);
    setError('');
    try {
      const res = await api.generateConceptMap(chatId, topicSet.id);
      setGeneratingJobId(res.job_id);
    } catch(e: any) {
      setError(e.message || 'Failed to trigger generation');
      setGenerating(false);
    }
  }

  async function handleExpandTopic(topicId: string) {
    if (!chatId || !topicSet) return;
    try {
      const res = await api.expandTopicBranch(chatId, topicSet.id, topicId);
      setExpandingJobId(res.job_id);
    } catch (e: any) {
      setError(e.message || 'Failed to expand topic');
    }
  }

  const onLayout = useCallback(
    (direction: string) => {
      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
        nodes,
        edges,
        direction
      );
      setNodes([...layoutedNodes]);
      setEdges([...layoutedEdges]);
    },
    [nodes, edges, setNodes, setEdges]
  );

  if (!topicSet) return null;
  if (isGeneratingTopics) {
    return (
      <div className="empty-state topics-empty animate-fade-in" style={{ height: '400px' }}>
        <Loader2 size={40} className="animate-spin text-accent" style={{ marginBottom: 16 }} />
        <h3>Waiting for Topics...</h3>
        <p>The mind map will be available after topics finish extracting.</p>
      </div>
    );
  }

  const selectedTopic = selectedTopicId ? topicSet?.topics?.find((t: any) => t.id === selectedTopicId) : null;
  const prerequisites = selectedTopicId ? edges.filter((e: any) => e.target === selectedTopicId && e.label === 'dependency').map((e: any) => topicSet?.topics?.find((t: any) => t.id === e.source)).filter(Boolean) : [];
  const relatedConcepts = selectedTopicId ? edges.filter((e: any) => (e.source === selectedTopicId || e.target === selectedTopicId) && e.label === 'related').map((e: any) => topicSet?.topics?.find((t: any) => t.id === (e.source === selectedTopicId ? e.target : e.source))).filter(Boolean) : [];

  return (
    <div style={{ width: '100%', height: 'calc(100vh - 200px)', minHeight: '600px', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', background: 'var(--background)' }}>
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <Loader2 size={32} className="animate-spin text-accent" />
        </div>
      ) : nodes.length === 0 ? (
        <div className="empty-state topics-empty animate-fade-in" style={{ height: '100%' }}>
          {generating ? (
            <>
              <Loader2 size={40} className="animate-spin text-accent" style={{ marginBottom: 16 }} />
              <h3>Generating Mind Map...</h3>
              <p style={{ marginBottom: 16 }}>The local AI is analyzing relationships between the extracted topics.</p>
              {generatingJobId && (
                <button className="btn btn-secondary cancel-job-btn" disabled={cancelling} onClick={async () => {
                  setCancelling(true);
                  try { await api.cancelJob(generatingJobId); }
                  finally { setCancelling(false); }
                }}>{cancelling ? 'Stopping...' : 'Stop Generation'}</button>
              )}
            </>
          ) : (
            <>
              <div className="empty-icon-wrapper" style={{ marginBottom: 16 }}>
                 <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="empty-icon text-accent"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
              </div>
              <h3>AI Concept Mind Map</h3>
              <p style={{ marginBottom: 24, maxWidth: '400px', margin: '0 auto 24px auto' }}>Visually explore the connections, dependencies, and hierarchy of the extracted topics.</p>
              <button className="btn btn-primary" onClick={handleGenerate}>
                Generate Mind Map
              </button>
            </>
          )}
          {error && <div className="alert-box error" style={{ marginTop: 24 }}><p>{error}</p></div>}
        </div>
      ) : (
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          onNodeClick={onNodeClick}
          fitView
          attributionPosition="bottom-right"
        >
          <Panel position="top-right" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {completionTime !== null && (
              <span className="badge" style={{ backgroundColor: '#e6f7ee', color: '#00b259' }}>
                Processed in {completionTime}s
              </span>
            )}
            <button className="btn btn-secondary btn-sm" onClick={() => onLayout('TB')}>vertical layout</button>
            <button className="btn btn-secondary btn-sm" onClick={() => onLayout('LR')}>horizontal layout</button>
          </Panel>
          <Controls />
          <Background color="#ccc" gap={16} />
        </ReactFlow>
      )}

      {selectedTopic && (
        <div className="concept-side-panel" style={{
          position: 'absolute', top: 0, right: 0, bottom: 0, width: '400px', background: 'var(--bg-canvas)',
          borderLeft: '1px solid var(--border-color)', boxShadow: '-4px 0 15px rgba(0,0,0,0.1)',
          display: 'flex', flexDirection: 'column', zIndex: 10, animation: 'slideInRight 0.3s ease-out'
        }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600 }}>{selectedTopic.title}</h2>
            <button className="btn-icon" onClick={() => setSelectedTopicId(null)}><X size={20} /></button>
          </div>
          <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
            <div style={{ marginBottom: 24 }}>
              <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Explanation</h4>
              <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.6 }}>{selectedTopic.description}</p>
              <p style={{ margin: '8px 0 0 0', fontSize: '14px', lineHeight: 1.6, color: 'var(--text-secondary)' }}>{selectedTopic.importance_reason}</p>
            </div>
            
            {selectedTopic.sources_json?.sources && selectedTopic.sources_json.sources.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Source Pages</h4>
                <div className="source-chips">
                  {selectedTopic.sources_json.sources.map((src: any, i: number) => (
                    <button key={i} className="source-chip" onClick={() => setPdfSource({ document_id: src.document_id, page_number: src.page_number, original_filename: src.filename || 'Document' })}>
                      Page {src.page_number}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {prerequisites.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Prerequisites</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {prerequisites.map((p: any) => (
                    <button key={p.id} className="link-button" onClick={() => setSelectedTopicId(p.id)} style={{ textAlign: 'left', color: 'var(--accent-color)' }}>
                      {p.title}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {relatedConcepts.length > 0 && (
              <div style={{ marginBottom: 24 }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>Related Concepts</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {relatedConcepts.map((p: any) => (
                    <button key={p.id} className="link-button" onClick={() => setSelectedTopicId(p.id)} style={{ textAlign: 'left', color: 'var(--accent-color)' }}>
                      {p.title}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginTop: 32, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => handleExpandTopic(selectedTopic.id)} disabled={!!expandingJobId}>
                {expandingJobId ? <Loader2 size={16} className="animate-spin" style={{ marginRight: 8 }} /> : <Network size={16} style={{ marginRight: 8 }} />}
                {expandingJobId ? 'Expanding...' : 'Expand Topic Branch'}
              </button>
              <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => navigate(`/app/chats/${chatId}?q=${encodeURIComponent('Explain the topic: ' + selectedTopic.title)}`)}>
                <MessageSquare size={16} style={{ marginRight: 8 }} /> Ask AI
              </button>
              <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => navigate(`/app/chats/${chatId}/quiz?topic=${encodeURIComponent(selectedTopic.title)}`)}>
                <Play size={16} style={{ marginRight: 8 }} /> Take Quiz
              </button>
              <button className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => navigate(`/app/chats/${chatId}/flashcards?topic=${encodeURIComponent(selectedTopic.title)}`)}>
                <Brain size={16} style={{ marginRight: 8 }} /> Study Flashcards
              </button>
            </div>
          </div>
        </div>
      )}
      {pdfSource && <PdfSource source={pdfSource} close={() => setPdfSource(null)} />}
    </div>
  );
}
