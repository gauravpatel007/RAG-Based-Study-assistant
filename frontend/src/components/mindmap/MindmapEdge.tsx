import React from 'react';
import { getBezierPath, BaseEdge, type EdgeProps } from 'reactflow';

export const MindmapEdge: React.FC<EdgeProps> = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style = {},
  markerEnd,
  data,
}) => {
  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  // Color mapping similar to node for matching edge colors
  const colorMap: Record<string, string> = {
    green: '#4ade80',
    yellow: '#facc15',
    blue: '#60a5fa',
    purple: '#c084fc',
    lightblue: '#38bdf8',
    orange: '#fb923c',
  };

  const branchColor = data?.color ? colorMap[data.color] || data.color : '#94a3b8';

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      markerEnd={markerEnd}
      style={{
        ...style,
        stroke: branchColor,
        strokeWidth: 2,
        strokeDasharray: '5,5', // Dotted/dashed line effect
      }}
    />
  );
};
