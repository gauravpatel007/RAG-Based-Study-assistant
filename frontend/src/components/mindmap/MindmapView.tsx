import React, { useCallback, useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type Edge,
  type Node,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';
import dagre from 'dagre';
import { MindmapNode } from './MindmapNode';
import { MindmapEdge } from './MindmapEdge';

const nodeTypes = {
  mindmapNode: MindmapNode,
};

const edgeTypes = {
  mindmapEdge: MindmapEdge,
};

// Initial setup data matching the reference image concept
const initialNodes: Node[] = [
  { id: 'root', type: 'mindmapNode', data: { label: 'Holiday', isRoot: true }, position: { x: 0, y: 0 } },
  { id: 'act', type: 'mindmapNode', data: { label: 'activity', color: 'green' }, position: { x: 0, y: 0 } },
  { id: 'trip', type: 'mindmapNode', data: { label: 'trip', color: 'green' }, position: { x: 0, y: 0 } },
  { id: 'sport', type: 'mindmapNode', data: { label: 'sport', color: 'green' }, position: { x: 0, y: 0 } },
  { id: 'swim', type: 'mindmapNode', data: { label: 'swimming', color: 'green' }, position: { x: 0, y: 0 } },
  { id: 'cycle', type: 'mindmapNode', data: { label: 'cycling', color: 'green', iconName: 'Bike' }, position: { x: 0, y: 0 } },
  { id: 'mtb', type: 'mindmapNode', data: { label: 'mtb', color: 'green' }, position: { x: 0, y: 0 } },
  
  { id: 'trans', type: 'mindmapNode', data: { label: 'transportation', color: 'blue' }, position: { x: 0, y: 0 } },
  { id: 'car', type: 'mindmapNode', data: { label: 'car', color: 'blue' }, position: { x: 0, y: 0 } },
  { id: 'rental', type: 'mindmapNode', data: { label: 'rental', color: 'blue' }, position: { x: 0, y: 0 } },
  { id: 'plane', type: 'mindmapNode', data: { label: 'plane', color: 'blue', iconName: 'Plane' }, position: { x: 0, y: 0 } },
  
  { id: 'acc', type: 'mindmapNode', data: { label: 'accommodation', color: 'purple' }, position: { x: 0, y: 0 } },
  { id: 'apt', type: 'mindmapNode', data: { label: 'apartment', color: 'purple' }, position: { x: 0, y: 0 } },
  { id: 'sz', type: 'mindmapNode', data: { label: 'San Zanobi', color: 'purple', iconName: 'CheckSquare' }, position: { x: 0, y: 0 } },
  
  { id: 'tusc', type: 'mindmapNode', data: { label: 'Tuscany', color: 'yellow' }, position: { x: 0, y: 0 } },
  { id: 'flor', type: 'mindmapNode', data: { label: 'Florence', color: 'yellow' }, position: { x: 0, y: 0 } },
  
  { id: 'fam', type: 'mindmapNode', data: { label: 'family', color: 'lightblue', iconName: 'Users' }, position: { x: 0, y: 0 } },
  { id: 'zoe', type: 'mindmapNode', data: { label: 'Zoë', color: 'lightblue' }, position: { x: 0, y: 0 } },
  { id: 'anna', type: 'mindmapNode', data: { label: 'Anna', color: 'lightblue' }, position: { x: 0, y: 0 } },
];

const initialEdges: Edge[] = [
  { id: 'e1', source: 'root', target: 'act', type: 'mindmapEdge', data: { color: 'green' } },
  { id: 'e2', source: 'act', target: 'trip', type: 'mindmapEdge', data: { color: 'green' } },
  { id: 'e3', source: 'act', target: 'sport', type: 'mindmapEdge', data: { color: 'green' } },
  { id: 'e4', source: 'sport', target: 'swim', type: 'mindmapEdge', data: { color: 'green' } },
  { id: 'e5', source: 'sport', target: 'cycle', type: 'mindmapEdge', data: { color: 'green' } },
  { id: 'e6', source: 'cycle', target: 'mtb', type: 'mindmapEdge', data: { color: 'green' } },
  
  { id: 'e7', source: 'root', target: 'trans', type: 'mindmapEdge', data: { color: 'blue' } },
  { id: 'e8', source: 'trans', target: 'car', type: 'mindmapEdge', data: { color: 'blue' } },
  { id: 'e9', source: 'trans', target: 'plane', type: 'mindmapEdge', data: { color: 'blue' } },
  { id: 'e10', source: 'car', target: 'rental', type: 'mindmapEdge', data: { color: 'blue' } },
  
  { id: 'e11', source: 'root', target: 'acc', type: 'mindmapEdge', data: { color: 'purple' } },
  { id: 'e12', source: 'acc', target: 'apt', type: 'mindmapEdge', data: { color: 'purple' } },
  { id: 'e13', source: 'apt', target: 'sz', type: 'mindmapEdge', data: { color: 'purple' } },
  
  { id: 'e14', source: 'root', target: 'tusc', type: 'mindmapEdge', data: { color: 'yellow' } },
  { id: 'e15', source: 'tusc', target: 'flor', type: 'mindmapEdge', data: { color: 'yellow' } },
  
  { id: 'e16', source: 'root', target: 'fam', type: 'mindmapEdge', data: { color: 'lightblue' } },
  { id: 'e17', source: 'fam', target: 'zoe', type: 'mindmapEdge', data: { color: 'lightblue' } },
  { id: 'e18', source: 'fam', target: 'anna', type: 'mindmapEdge', data: { color: 'lightblue' } },
];

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const nodeWidth = 150;
const nodeHeight = 50;

const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'LR') => {
  const isHorizontal = direction === 'LR';
  dagreGraph.setGraph({ rankdir: direction, nodesep: 40, ranksep: 100 });

  nodes.forEach((node) => {
    // Root needs more space
    if (node.data.isRoot) {
       dagreGraph.setNode(node.id, { width: 140, height: 140 });
    } else {
       dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
    }
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    node.targetPosition = isHorizontal ? Position.Left : Position.Top;
    node.sourcePosition = isHorizontal ? Position.Right : Position.Bottom;

    // We are shifting the dagre node position (anchor=center center) to the top left
    // so it matches the react flow node anchor point (top left).
    const width = node.data.isRoot ? 140 : nodeWidth;
    const height = node.data.isRoot ? 140 : nodeHeight;
    node.position = {
      x: nodeWithPosition.x - width / 2,
      y: nodeWithPosition.y - height / 2,
    };

    return node;
  });

  return { nodes: layoutedNodes, edges };
};

export const MindmapView: React.FC = () => {
  const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(() => getLayoutedElements(initialNodes, initialEdges, 'LR'), []);
  
  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges);

  const onConnect = useCallback(
    (params: Connection | Edge) => setEdges((eds) => addEdge({ ...params, type: 'mindmapEdge' }, eds)),
    [setEdges],
  );

  return (
    <div className="w-full h-full min-h-[600px] bg-slate-50 border rounded-xl overflow-hidden relative shadow-inner">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={2}
      >
        <Background color="#ccc" gap={16} />
        <Controls className="bg-white shadow-md rounded-md p-1" />
        <MiniMap 
          nodeColor={(n) => {
            if (n.data.isRoot) return '#f97316';
            const colorMap: Record<string, string> = {
              green: '#4ade80', yellow: '#facc15', blue: '#60a5fa', purple: '#c084fc', lightblue: '#38bdf8', orange: '#fb923c',
            };
            return n.data.color ? colorMap[n.data.color] : '#eee';
          }} 
          maskColor="rgba(248, 250, 252, 0.8)"
        />
      </ReactFlow>
      
      {/* Floating Toolbar */}
      <div className="absolute top-4 left-4 bg-white/90 backdrop-blur shadow-md rounded-lg p-3 z-10 flex gap-2">
        <h2 className="font-semibold text-slate-800 mr-2 flex items-center">Mindmap Workspace</h2>
        <button className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded text-sm hover:bg-indigo-100 transition-colors">
          + Add Node
        </button>
        <button className="px-3 py-1 bg-slate-50 text-slate-600 rounded text-sm hover:bg-slate-100 transition-colors" onClick={() => {
            const { nodes: resetNodes } = getLayoutedElements(nodes, edges, 'LR');
            setNodes([...resetNodes]);
        }}>
          Auto Layout
        </button>
      </div>
    </div>
  );
};
