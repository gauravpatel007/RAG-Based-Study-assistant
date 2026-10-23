import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { ReactFlow, Controls, Background, Panel, useNodesState, useEdgesState, Handle, Position, getNodesBounds, getViewportForBounds } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { toPng } from 'html-to-image';
import dagre from 'dagre';
import { api } from '@/lib/api';
import { Loader2, Network } from 'lucide-react';
import { useParams, useNavigate } from 'react-router-dom';
import PdfSource, { type Source } from '@/components/PdfSource';
import { X, Play, Brain, MessageSquare, Maximize2, Minimize2, ChevronDown, Check, Download } from 'lucide-react';

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const nodeWidth = 250;
const nodeHeight = 100;

const getLayoutedElements = (nodes: any[], edges: any[], layoutMode: 'radial' | 'tree' = 'radial') => {
  if (nodes.length === 0) return { nodes, edges };

  // 1. Build adjacency and in-degree maps
  const inDegree: Record<string, number> = {};
  const adj: Record<string, any[]> = {};

  nodes.forEach(n => {
    inDegree[n.id] = 0;
    adj[n.id] = [];
  });

  edges.forEach(e => {
    if (inDegree[e.target] !== undefined) inDegree[e.target]++;
    if (adj[e.source]) adj[e.source].push(nodes.find(n => n.id === e.target));
  });

  // 2. Find roots (inDegree 0)
  const roots = nodes.filter(n => inDegree[n.id] === 0);
  const rootNode = roots.length > 0 ? roots[0] : nodes[0];

  if (!rootNode) return { nodes, edges };

  if (layoutMode === 'tree') {
    dagreGraph.setGraph({ rankdir: 'TB', nodesep: 150, ranksep: 100 });

    nodes.forEach((node) => {
      dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
    });

    edges.forEach((edge) => {
      dagreGraph.setEdge(edge.source, edge.target);
    });

    dagre.layout(dagreGraph);

    const assignDepths = (nId: string, depth: number, visited: Set<string>) => {
      if (visited.has(nId)) return;
      visited.add(nId);
      const nodeObj = nodes.find(n => n.id === nId);
      if (nodeObj) {
        nodeObj.data = { ...nodeObj.data, depth, isRoot: depth === 0 };
      }
      (adj[nId] || []).forEach(child => {
        if (child) assignDepths(child.id, depth + 1, new Set(visited));
      });
    };
    if (rootNode) assignDepths(rootNode.id, 0, new Set());

    nodes.forEach((node) => {
      const nodeWithPosition = dagreGraph.node(node.id);
      node.position = {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      };
    });

    return { nodes, edges: edges.map(e => ({ ...e, type: 'default', animated: true })) };
  }

  // --- Center-Out Mind Map Layout (Radial) ---
  // Split root children into left and right
  const rootChildrenNodes = adj[rootNode.id] || [];
  const leftRootChildren = new Set<string>();
  const rightRootChildren = new Set<string>();

  rootChildrenNodes.forEach((child, idx) => {
    if (idx % 2 === 0) rightRootChildren.add(child.id);
    else leftRootChildren.add(child.id);
  });

  const nodeSideMap: Record<string, 'left' | 'right'> = {};
  nodeSideMap[rootNode.id] = 'right'; // arbitrary, root is center

  const assignSide = (nId: string, side: 'left' | 'right', visited: Set<string>) => {
    if (visited.has(nId)) return;
    visited.add(nId);
    nodeSideMap[nId] = side;
    (adj[nId] || []).forEach(c => {
      if (c) assignSide(c.id, side, new Set(visited));
    });
  };

  rightRootChildren.forEach(id => assignSide(id, 'right', new Set()));
  leftRootChildren.forEach(id => assignSide(id, 'left', new Set()));

  const dagreRight = new dagre.graphlib.Graph();
  dagreRight.setGraph({ rankdir: 'LR', nodesep: 40, ranksep: 100 });
  dagreRight.setDefaultEdgeLabel(() => ({}));

  const dagreLeft = new dagre.graphlib.Graph();
  dagreLeft.setGraph({ rankdir: 'RL', nodesep: 40, ranksep: 100 });
  dagreLeft.setDefaultEdgeLabel(() => ({}));

  nodes.forEach(n => {
    if (n.id === rootNode.id) {
      dagreRight.setNode(n.id, { width: 120, height: 120 });
      dagreLeft.setNode(n.id, { width: 120, height: 120 });
    } else if (nodeSideMap[n.id] === 'right') {
      dagreRight.setNode(n.id, { width: nodeWidth, height: nodeHeight });
    } else {
      dagreLeft.setNode(n.id, { width: nodeWidth, height: nodeHeight });
    }
  });

  edges.forEach(e => {
    if (nodeSideMap[e.target] === 'right' || (e.source === rootNode.id && rightRootChildren.has(e.target))) {
      dagreRight.setEdge(e.source, e.target);
    } else if (nodeSideMap[e.target] === 'left' || (e.source === rootNode.id && leftRootChildren.has(e.target))) {
      dagreLeft.setEdge(e.source, e.target);
    }
  });

  dagre.layout(dagreRight);
  dagre.layout(dagreLeft);

  const rootRightPos = dagreRight.node(rootNode.id) || { x: 0, y: 0 };
  const rootLeftPos = dagreLeft.node(rootNode.id) || { x: 0, y: 0 };

  const assignDepths = (nId: string, depth: number, visited: Set<string>) => {
    if (visited.has(nId)) return;
    visited.add(nId);
    const nodeObj = nodes.find(n => n.id === nId);
    if (nodeObj) {
      nodeObj.data = { ...nodeObj.data, depth, isRoot: depth === 0, isLeft: nodeSideMap[nId] === 'left' };
    }
    (adj[nId] || []).forEach(child => {
      if (child) assignDepths(child.id, depth + 1, new Set(visited));
    });
  };
  if (rootNode) assignDepths(rootNode.id, 0, new Set());

  nodes.forEach(n => {
    let pos = { x: 0, y: 0 };
    if (n.id === rootNode.id) {
      pos = { x: 0, y: 0 };
    } else if (nodeSideMap[n.id] === 'right') {
      const raw = dagreRight.node(n.id);
      if (raw) pos = { x: raw.x - rootRightPos.x, y: raw.y - rootRightPos.y };
    } else {
      const raw = dagreLeft.node(n.id);
      if (raw) pos = { x: raw.x - rootLeftPos.x, y: raw.y - rootLeftPos.y };
    }

    n.position = {
      x: pos.x - (n.id === rootNode.id ? 60 : nodeWidth / 2),
      y: pos.y - (n.id === rootNode.id ? 60 : nodeHeight / 2)
    };

    if (isNaN(n.position.x)) n.position = { x: 0, y: 0 };
  });

  const newEdges = edges.map(e => ({
    ...e,
    type: 'default',
    animated: false,
  }));

  return { nodes, edges: newEdges };
};

const COLORS = [
  { bg: '#f9a8d4', text: '#831843', edge: '#cbd5e1', indicator: '#f9a8d4' }, // pink
  { bg: '#fde047', text: '#713f12', edge: '#cbd5e1', indicator: '#fde047' }, // yellow
  { bg: '#93c5fd', text: '#1e3a8a', edge: '#cbd5e1', indicator: '#93c5fd' }, // blue
  { bg: '#86efac', text: '#14532d', edge: '#cbd5e1', indicator: '#86efac' }, // green
  { bg: '#c4b5fd', text: '#4c1d95', edge: '#cbd5e1', indicator: '#c4b5fd' }, // purple
  { bg: '#fdba74', text: '#7c2d12', edge: '#cbd5e1', indicator: '#fdba74' }, // orange
];

function CustomNode({ data, selected }: { data: any, selected: boolean }) {
  if (data.isRoot) {
    return (
      <div
        style={{
          width: '120px',
          height: '120px',
          backgroundColor: '#93c5fd',
          color: '#1e3a8a',
          fontWeight: 600,
          fontSize: '15px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: 'none',
          boxShadow: selected ? '0 0 0 4px rgba(59, 130, 246, 0.4), 0 10px 15px -3px rgba(0,0,0,0.1)' : '0 10px 15px -3px rgba(0,0,0,0.1)',
          transform: selected ? 'scale(1.02)' : 'scale(1)',
          transition: 'all 0.2s',
          position: 'relative',
          cursor: 'grab',
          wordWrap: 'break-word',
          whiteSpace: 'pre-wrap',
          textAlign: 'center',
          padding: '16px',
          lineHeight: '1.2'
        }}
      >
        <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
        <Handle type="target" position={Position.Right} style={{ opacity: 0 }} />
        <Handle type="source" position={Position.Left} style={{ opacity: 0 }} />
        <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />

        <div style={{ position: 'relative', zIndex: 10, textAlign: 'center' }}>
          {data.label}
        </div>
      </div>
    );
  }

  const theme = data.theme || COLORS[0];

  return (
    <div
      style={{
        backgroundColor: theme.bg,
        color: theme.text,
        border: 'none',
        borderRadius: '9999px',
        padding: '10px 20px',
        fontWeight: 500,
        fontSize: '13px',
        boxShadow: selected ? `0 0 0 3px rgba(0,0,0,0.1)` : '0 2px 4px -1px rgba(0,0,0,0.05)',
        transform: selected ? 'scale(1.02)' : 'scale(1)',
        transition: 'all 0.2s',
        minWidth: '100px',
        maxWidth: '220px',
        textAlign: 'center',
        cursor: 'grab',
        position: 'relative',
        wordWrap: 'break-word',
        whiteSpace: 'pre-wrap',
        lineHeight: '1.2'
      }}
    >
      <Handle type="target" position={data.isLeft ? Position.Right : Position.Left} style={{ opacity: 0 }} />
      <Handle type="source" position={data.isLeft ? Position.Left : Position.Right} style={{ opacity: 0 }} />

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
  const [layoutMode, setLayoutMode] = useState<'radial' | 'tree'>('radial');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [layoutDropdownOpen, setLayoutDropdownOpen] = useState(false);
  const [preGenLayoutDropdownOpen, setPreGenLayoutDropdownOpen] = useState(false);

  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [expandingJobId, setExpandingJobId] = useState<string | null>(null);
  const [pdfSource, setPdfSource] = useState<Source | null>(null);
  const [hasAttemptedAutoGenerate, setHasAttemptedAutoGenerate] = useState(false);
  const [generatingJobId, setGeneratingJobId] = useState<string | null>(null);
  const [completionTime, setCompletionTime] = useState<number | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [downloadingPng, setDownloadingPng] = useState(false);

  const handleExportPng = useCallback(async () => {
    if (!nodes || nodes.length === 0) return;
    setDownloadingPng(true);
    try {
      const nodesWithDimensions = nodes.map(n => ({
        ...n,
        width: n.measured?.width || n.width || (n.data?.isRoot ? 140 : 240),
        height: n.measured?.height || n.height || (n.data?.isRoot ? 140 : 80),
      }));

      const nodesBounds = getNodesBounds(nodesWithDimensions);
      const padding = 80;
      const width = Math.max(1280, Math.ceil(nodesBounds.width + padding * 2));
      const height = Math.max(800, Math.ceil(nodesBounds.height + padding * 2));

      const viewport = getViewportForBounds(
        nodesBounds,
        width,
        height,
        0.2,
        2,
        0.15
      );

      const viewportEl = document.querySelector<HTMLElement>('.react-flow__viewport');
      if (!viewportEl) {
        throw new Error('Mind map canvas viewport not found');
      }

      const styleOptions = {
        width: `${width}px`,
        height: `${height}px`,
        transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
      };

      let dataUrl: string;
      try {
        dataUrl = await toPng(viewportEl, {
          backgroundColor: '#ffffff',
          width,
          height,
          style: styleOptions,
        });
      } catch {
        dataUrl = await toPng(viewportEl, {
          backgroundColor: '#ffffff',
          width,
          height,
          style: styleOptions,
          skipFonts: true,
        });
      }

      const safeTitle = (topicSet?.title || topicSet?.focus_query || 'mindmap')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      const filename = `${safeTitle || 'concept-mindmap'}.png`;

      const downloadLink = document.createElement('a');
      downloadLink.href = dataUrl;
      downloadLink.download = filename;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
    } catch (err) {
      console.error('Failed to export mind map as PNG:', err);
    } finally {
      setDownloadingPng(false);
    }
  }, [nodes, topicSet]);

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
            type: 'smoothstep',
            animated: false,
            style: {
              stroke: theme.edge,
              strokeWidth: 1.5
            }
          };
        });

        const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(initialNodes, initialEdges, layoutMode);
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
  }, [chatId, topicSet, setNodes, setEdges, generating, hasAttemptedAutoGenerate, layoutMode]);

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
        }).catch(() => { });
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
    } catch (e: any) {
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

  const handleLayoutChange = useCallback(
    (mode: 'radial' | 'tree') => {
      setLayoutMode(mode);
      const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
        nodes,
        edges,
        mode
      );
      setNodes([...layoutedNodes]);
      setEdges([...layoutedEdges]);
    },
    [nodes, edges, setNodes, setEdges]
  );

  // Close custom dropdowns on outside click
  useEffect(() => {
    const handleGlobalClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (layoutDropdownOpen && !target.closest('.mindmap-layout-dropdown')) {
        setLayoutDropdownOpen(false);
      }
      if (preGenLayoutDropdownOpen && !target.closest('.mindmap-pregen-dropdown')) {
        setPreGenLayoutDropdownOpen(false);
      }
    };

    if (layoutDropdownOpen || preGenLayoutDropdownOpen) {
      window.addEventListener('click', handleGlobalClick);
      return () => window.removeEventListener('click', handleGlobalClick);
    }
  }, [layoutDropdownOpen, preGenLayoutDropdownOpen]);

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
              <div className="mindmap-pregen-dropdown" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', position: 'relative' }}>
                <label style={{ marginRight: 8, fontSize: '14px', fontWeight: 500 }}>Layout Style:</label>
                <div style={{ position: 'relative' }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); setPreGenLayoutDropdownOpen(!preGenLayoutDropdownOpen); }}
                    className="btn"
                    style={{
                      display: 'flex', alignItems: 'center', gap: '8px',
                      padding: '6px 12px', background: 'var(--bg-canvas)', border: '1px solid var(--border-color)',
                      borderRadius: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)'
                    }}
                  >
                    {layoutMode === 'radial' ? 'Radial Structure (Center-Out)' : 'Tree Structure (Top-Down)'}
                    <ChevronDown size={14} />
                  </button>
                  {preGenLayoutDropdownOpen && (
                    <div style={{
                      position: 'absolute', top: '100%', left: 0, marginTop: '4px',
                      background: 'var(--bg-canvas)', border: '1px solid var(--border-color)',
                      borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      minWidth: '220px', zIndex: 100, display: 'flex', flexDirection: 'column',
                      padding: '4px'
                    }}>
                      <button
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '8px 12px', background: layoutMode === 'radial' ? 'var(--bg-hover)' : 'transparent',
                          border: 'none', borderRadius: '4px', fontSize: '13px', color: 'var(--text-primary)', cursor: 'pointer', textAlign: 'left'
                        }}
                        onClick={() => { setLayoutMode('radial'); setPreGenLayoutDropdownOpen(false); }}
                      >
                        Radial Structure (Center-Out)
                        {layoutMode === 'radial' && <Check size={14} />}
                      </button>
                      <button
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          padding: '8px 12px', background: layoutMode === 'tree' ? 'var(--bg-hover)' : 'transparent',
                          border: 'none', borderRadius: '4px', fontSize: '13px', color: 'var(--text-primary)', cursor: 'pointer', textAlign: 'left'
                        }}
                        onClick={() => { setLayoutMode('tree'); setPreGenLayoutDropdownOpen(false); }}
                      >
                        Tree Structure (Top-Down)
                        {layoutMode === 'tree' && <Check size={14} />}
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <button className="btn btn-primary" onClick={handleGenerate}>
                Generate Mind Map
              </button>
            </>
          )}
          {error && <div className="alert-box error" style={{ marginTop: 24 }}><p>{error}</p></div>}
        </div>
      ) : (
        <>
          {isFullscreen ? createPortal(
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999998, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)' }}
                onClick={() => setIsFullscreen(false)}
              />
              <div style={{
                position: 'relative', width: '94vw', height: '94vh',
                zIndex: 999999, background: 'var(--bg-canvas)', borderRadius: '12px',
                boxShadow: '0 25px 50px -12px rgba(0,0,0,0.5)', overflow: 'hidden'
              }}>
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
                    <div className="mindmap-layout-dropdown" style={{ position: 'relative' }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); setLayoutDropdownOpen(!layoutDropdownOpen); }}
                        className="btn"
                        style={{
                          display: 'flex', alignItems: 'center', gap: '8px',
                          padding: '6px 12px', background: 'var(--bg-canvas)', border: '1px solid var(--border-color)',
                          borderRadius: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)'
                        }}
                      >
                        {layoutMode === 'radial' ? 'Radial Layout' : 'Tree Layout'}
                        <ChevronDown size={14} />
                      </button>
                      {layoutDropdownOpen && (
                        <div style={{
                          position: 'absolute', top: '100%', right: 0, marginTop: '4px',
                          background: 'var(--bg-canvas)', border: '1px solid var(--border-color)',
                          borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                          minWidth: '160px', zIndex: 100, display: 'flex', flexDirection: 'column',
                          padding: '4px'
                        }}>
                          <button
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              padding: '8px 12px', background: layoutMode === 'radial' ? 'var(--bg-hover)' : 'transparent',
                              border: 'none', borderRadius: '4px', fontSize: '13px', color: 'var(--text-primary)', cursor: 'pointer', textAlign: 'left'
                            }}
                            onClick={() => { handleLayoutChange('radial'); setLayoutDropdownOpen(false); }}
                          >
                            Radial Layout
                            {layoutMode === 'radial' && <Check size={14} />}
                          </button>
                          <button
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              padding: '8px 12px', background: layoutMode === 'tree' ? 'var(--bg-hover)' : 'transparent',
                              border: 'none', borderRadius: '4px', fontSize: '13px', color: 'var(--text-primary)', cursor: 'pointer', textAlign: 'left'
                            }}
                            onClick={() => { handleLayoutChange('tree'); setLayoutDropdownOpen(false); }}
                          >
                            Tree Layout
                            {layoutMode === 'tree' && <Check size={14} />}
                          </button>
                        </div>
                      )}
                    </div>
                    <button className="btn btn-secondary btn-sm" onClick={() => handleLayoutChange(layoutMode)} title="Refresh Layout">Refresh</button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={handleExportPng}
                      disabled={downloadingPng || nodes.length === 0}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                      title="Download Mind Map as PNG"
                    >
                      {downloadingPng ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                      <span>{downloadingPng ? 'Exporting...' : 'Export'}</span>
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px 8px' }}
                      onClick={() => setIsFullscreen(false)}
                      title="Exit Fullscreen"
                    >
                      <Minimize2 size={16} />
                    </button>
                  </Panel>
                  <Controls />
                  <Background color="#ccc" gap={16} />
                </ReactFlow>
              </div>
            </div>, document.body
          ) : (
            <div style={{ width: '100%', height: '100%', position: 'relative' }}>
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
                  <div className="mindmap-layout-dropdown" style={{ position: 'relative' }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); setLayoutDropdownOpen(!layoutDropdownOpen); }}
                      className="btn"
                      style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        padding: '6px 12px', background: 'var(--bg-canvas)', border: '1px solid var(--border-color)',
                        borderRadius: '6px', fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)'
                      }}
                    >
                      {layoutMode === 'radial' ? 'Radial Layout' : 'Tree Layout'}
                      <ChevronDown size={14} />
                    </button>
                    {layoutDropdownOpen && (
                      <div style={{
                        position: 'absolute', top: '100%', right: 0, marginTop: '4px',
                        background: 'var(--bg-canvas)', border: '1px solid var(--border-color)',
                        borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        minWidth: '160px', zIndex: 100, display: 'flex', flexDirection: 'column',
                        padding: '4px'
                      }}>
                        <button
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '8px 12px', background: layoutMode === 'radial' ? 'var(--bg-hover)' : 'transparent',
                            border: 'none', borderRadius: '4px', fontSize: '13px', color: 'var(--text-primary)', cursor: 'pointer', textAlign: 'left'
                          }}
                          onClick={() => { handleLayoutChange('radial'); setLayoutDropdownOpen(false); }}
                        >
                          Radial Layout
                          {layoutMode === 'radial' && <Check size={14} />}
                        </button>
                        <button
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '8px 12px', background: layoutMode === 'tree' ? 'var(--bg-hover)' : 'transparent',
                            border: 'none', borderRadius: '4px', fontSize: '13px', color: 'var(--text-primary)', cursor: 'pointer', textAlign: 'left'
                          }}
                          onClick={() => { handleLayoutChange('tree'); setLayoutDropdownOpen(false); }}
                        >
                          Tree Layout
                          {layoutMode === 'tree' && <Check size={14} />}
                        </button>
                      </div>
                    )}
                  </div>
                  <button className="btn btn-secondary btn-sm" onClick={() => handleLayoutChange(layoutMode)} title="Refresh Layout">Refresh</button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={handleExportPng}
                    disabled={downloadingPng || nodes.length === 0}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    title="Download Mind Map as PNG"
                  >
                    {downloadingPng ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                    <span>{downloadingPng ? 'Exporting...' : 'Export'}</span>
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px 8px' }}
                    onClick={() => setIsFullscreen(true)}
                    title="Enter Fullscreen"
                  >
                    <Maximize2 size={16} />
                  </button>
                </Panel>
                <Controls />
                <Background color="#ccc" gap={16} />
              </ReactFlow>
            </div>
          )}
        </>
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
