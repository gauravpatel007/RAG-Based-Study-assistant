import React from 'react';

interface CircleBufferProps {
  size?: number;
  color?: string;
  trackColor?: string;
  strokeWidth?: number;
  minHeight?: number | string;
  style?: React.CSSProperties;
  className?: string;
}

export function CircleBuffer({
  size = 38,
  color = 'var(--text-primary, #111111)',
  trackColor = 'var(--border-default, rgba(0, 0, 0, 0.08))',
  strokeWidth,
  minHeight = 240,
  style,
  className = '',
}: CircleBufferProps) {
  const stroke = strokeWidth || Math.max(3, Math.round((size / 40) * 3.5));
  const center = 22;
  const radius = 18;

  const spinner = (
    <svg
      className={`circle-buffer-svg ${className}`}
      width={size}
      height={size}
      viewBox="0 0 44 44"
      style={{ ...style }}
      role="status"
      aria-label="Loading"
    >
      {/* Background circular track */}
      <circle
        className="circle-buffer-track"
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke={trackColor}
        strokeWidth={stroke}
      />
      {/* Dynamic moving black buffer */}
      <circle
        className="circle-buffer-head"
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
      />
    </svg>
  );

  if (minHeight !== undefined && minHeight !== null && minHeight !== 0) {
    return (
      <div
        className="circle-buffer-container"
        style={{
          minHeight,
        }}
      >
        {spinner}
      </div>
    );
  }

  return spinner;
}

export default CircleBuffer;
