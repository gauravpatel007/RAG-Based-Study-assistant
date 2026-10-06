import React from 'react';
import { Handle, Position, type NodeProps } from 'reactflow';
import { type LucideIcon } from 'lucide-react';
import * as Icons from 'lucide-react';

export type MindmapNodeData = {
  label: string;
  color?: string;
  iconName?: string;
  isRoot?: boolean;
};

export const MindmapNode: React.FC<NodeProps<MindmapNodeData>> = ({ data, selected }) => {
  const Icon = data.iconName ? (Icons as any)[data.iconName] as LucideIcon : null;

  // Root node (e.g., the "Sun")
  if (data.isRoot) {
    return (
      <div 
        className={`relative flex items-center justify-center rounded-full bg-orange-500 text-white font-bold text-lg shadow-lg border-4 border-orange-300 transition-all ${selected ? 'ring-4 ring-orange-200 ring-offset-2 scale-105' : 'hover:scale-105'}`}
        style={{ width: 120, height: 120 }}
      >
        <Handle type="source" position={Position.Right} className="!opacity-0" />
        <Handle type="source" position={Position.Left} className="!opacity-0" />
        <Handle type="source" position={Position.Top} className="!opacity-0" />
        <Handle type="source" position={Position.Bottom} className="!opacity-0" />
        
        {/* Sun rays effect */}
        <div className="absolute inset-0 -m-4 rounded-full border-4 border-dashed border-orange-400 animate-[spin_20s_linear_infinite] pointer-events-none opacity-50" />
        
        <div className="relative z-10 text-center flex flex-col items-center">
          {Icon && <Icon size={24} className="mb-1" />}
          {data.label}
        </div>
      </div>
    );
  }

  // Branch nodes (pill shape)
  const baseColor = data.color || 'blue';
  
  // Create dynamic color classes using inline styles for arbitrary colors, or tailwind mappings if we prefer standard colors.
  // We'll use inline variables so CSS handles it if it's a hex, but we can also map simple color names to tailwind classes if we want.
  // For safety with Tailwind arbitrary values, let's use a mapping for the known nice colors from the image, or just raw CSS colors.
  const colorMap: Record<string, { bg: string, border: string, text: string }> = {
    green: { bg: '#bbf7d0', border: '#4ade80', text: '#166534' },
    yellow: { bg: '#fef08a', border: '#facc15', text: '#854d0e' },
    blue: { bg: '#bfdbfe', border: '#60a5fa', text: '#1e3a8a' },
    purple: { bg: '#e9d5ff', border: '#c084fc', text: '#581c87' },
    lightblue: { bg: '#bae6fd', border: '#38bdf8', text: '#075985' },
    orange: { bg: '#fed7aa', border: '#fb923c', text: '#9a3412' },
  };

  const theme = colorMap[baseColor] || { bg: baseColor, border: 'currentColor', text: '#000' };

  return (
    <div 
      className={`relative px-4 py-2 rounded-full font-medium text-sm shadow-md transition-transform border-2 cursor-pointer
        ${selected ? 'scale-105 shadow-lg ring-2 ring-offset-2' : 'hover:scale-105 hover:shadow-lg'}`}
      style={{ 
        backgroundColor: theme.bg, 
        borderColor: theme.border, 
        color: theme.text,
        boxShadow: selected ? `0 0 0 2px ${theme.border}40` : undefined
      }}
    >
      <Handle type="target" position={Position.Left} className="!w-2 !h-2 !bg-gray-400 !border-white" style={{ left: -4 }} />
      
      <div className="flex items-center gap-2">
        {Icon && <Icon size={16} />}
        <span>{data.label}</span>
      </div>

      <Handle type="source" position={Position.Right} className="!w-2 !h-2 !bg-gray-400 !border-white" style={{ right: -4 }} />
    </div>
  );
};
