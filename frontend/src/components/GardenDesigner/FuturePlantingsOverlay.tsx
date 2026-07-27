import React from 'react';
import { PlantIconSVG } from '../common/PlantIcon';

export interface FuturePlantingPosition {
  x: number;
  y: number;
  plantId?: string;
  plantIcon: string;
  variety?: string;
  plantingDate: string;
  isOrigin: boolean; // True if this is the plant's origin cell, false if it's just part of the footprint
  spaceRequired?: number; // Total space required (for display)
}

interface FuturePlantingsOverlayProps {
  positions: FuturePlantingPosition[];
  cellSize: number;
  showOverlay: boolean;
  onCellClick?: (position: FuturePlantingPosition, clickX: number, clickY: number) => void;
  onCellHover?: (gridX: number, gridY: number, svgX: number, svgY: number) => void;
  onCellHoverEnd?: () => void;
}

/**
 * FuturePlantingsOverlay - Shows visual indicators for future scheduled plantings
 *
 * Renders semi-transparent green indicators on the garden grid to show
 * where future plantings are scheduled. This helps users:
 * - See where NOT to plant during drag operations
 * - Understand upcoming space usage when planning
 * - Visualize succession planting patterns
 * - See the FULL footprint of multi-cell plants (not just the origin)
 *
 * Features:
 * - Semi-transparent green circles with plant icon (on origin cell)
 * - Lighter green indicators for footprint cells
 * - "FUTURE" badge on origin cells
 * - Clickable cells that show details about scheduled plantings
 * - Only renders when showOverlay is true
 */
export const FuturePlantingsOverlay: React.FC<FuturePlantingsOverlayProps> = ({
  positions,
  cellSize,
  showOverlay,
  onCellClick,
  onCellHover,
  onCellHoverEnd,
}) => {
  if (!showOverlay || positions.length === 0) {
    return null;
  }

  const handleClick = (pos: FuturePlantingPosition, e: React.MouseEvent) => {
    e.stopPropagation();
    if (onCellClick) {
      onCellClick(pos, e.clientX, e.clientY);
    }
  };

  return (
    <g className="future-plantings-overlay">
      {positions.map((pos, idx) => {
        const centerX = pos.x * cellSize + cellSize / 2;
        const centerY = pos.y * cellSize + cellSize / 2;
        const radius = cellSize * 0.4;

        // Origin cells get full treatment, footprint cells get lighter indicator
        const isOrigin = pos.isOrigin;

        return (
          <g
            key={`future-${pos.x}-${pos.y}-${idx}`}
            data-testid={isOrigin ? 'future-planting-cell' : 'future-planting-footprint'}
            opacity={isOrigin ? 0.6 : 0.4}
            onClick={(e) => handleClick(pos, e)}
            onMouseEnter={(e) => {
              if (onCellHover) {
                const svgRect = (e.currentTarget.closest('svg') as SVGSVGElement)?.getBoundingClientRect();
                if (svgRect) onCellHover(pos.x, pos.y, e.clientX - svgRect.left, e.clientY - svgRect.top);
              }
            }}
            onMouseMove={(e) => {
              if (onCellHover) {
                const svgRect = (e.currentTarget.closest('svg') as SVGSVGElement)?.getBoundingClientRect();
                if (svgRect) onCellHover(pos.x, pos.y, e.clientX - svgRect.left, e.clientY - svgRect.top);
              }
            }}
            onMouseLeave={() => { if (onCellHoverEnd) onCellHoverEnd(); }}
            style={{ cursor: onCellClick ? 'pointer' : 'default' }}
          >
            {/* Invisible click target for better UX */}
            <rect
              x={pos.x * cellSize}
              y={pos.y * cellSize}
              width={cellSize}
              height={cellSize}
              fill="transparent"
              pointerEvents="all"
            />

            {/* Outer glow effect - lighter green */}
            <circle
              cx={centerX}
              cy={centerY}
              r={radius + 4}
              fill={isOrigin ? "#86efac" : "#bbf7d0"}
              opacity={0.3}
              pointerEvents="none"
            />

            {/* Main circle background - green with dashed border */}
            <circle
              cx={centerX}
              cy={centerY}
              r={radius}
              fill={isOrigin ? "#bbf7d0" : "#dcfce7"}
              stroke={isOrigin ? "#22c55e" : "#86efac"}
              strokeWidth={2}
              strokeDasharray={isOrigin ? "6 3" : "4 4"}
              pointerEvents="none"
            />

            {/* Diagonal hash pattern to indicate "reserved" */}
            <defs>
              <pattern
                id={`future-hatch-${pos.x}-${pos.y}`}
                patternUnits="userSpaceOnUse"
                width="6"
                height="6"
                patternTransform="rotate(45)"
              >
                <line
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="6"
                  stroke={isOrigin ? "#16a34a" : "#22c55e"}
                  strokeWidth="1"
                  opacity="0.3"
                />
              </pattern>
            </defs>
            <circle
              cx={centerX}
              cy={centerY}
              r={radius - 2}
              fill={`url(#future-hatch-${pos.x}-${pos.y})`}
              pointerEvents="none"
            />

            {/* Plant icon - only on origin cell */}
            {isOrigin && pos.plantId && (
              <g opacity={0.7} pointerEvents="none">
                <PlantIconSVG
                  key={`future-icon-${pos.plantId}-${centerX}-${centerY}`}
                  plantId={pos.plantId}
                  plantIcon={pos.plantIcon}
                  x={centerX - (cellSize * 0.4) / 2}
                  y={centerY - (cellSize * 0.4) / 2}
                  width={cellSize * 0.4}
                  height={cellSize * 0.4}
                />
              </g>
            )}
            {isOrigin && !pos.plantId && (
              <text
                x={centerX}
                y={centerY}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={cellSize * 0.4}
                className="select-none"
                style={{ pointerEvents: 'none', opacity: 0.7 }}
              >
                {pos.plantIcon}
              </text>
            )}

            {/* Clock icon badge - only on origin cell, top-left corner */}
            {isOrigin && (
              <g transform={`translate(${centerX - cellSize * 0.35}, ${centerY - cellSize * 0.35})`} pointerEvents="none">
                {/* Badge background circle */}
                <circle
                  cx={0}
                  cy={0}
                  r={cellSize * 0.12}
                  fill="#16a34a"
                  stroke="white"
                  strokeWidth={1}
                />
                {/* Clock icon (simplified) */}
                <circle
                  cx={0}
                  cy={0}
                  r={cellSize * 0.06}
                  fill="none"
                  stroke="white"
                  strokeWidth={1}
                />
                <line
                  x1={0}
                  y1={0}
                  x2={0}
                  y2={-cellSize * 0.04}
                  stroke="white"
                  strokeWidth={1}
                />
                <line
                  x1={0}
                  y1={0}
                  x2={cellSize * 0.03}
                  y2={0}
                  stroke="white"
                  strokeWidth={1}
                />
              </g>
            )}

            {/* "FUTURE" label badge - only on origin cell */}
            {isOrigin && (
              <g transform={`translate(${centerX}, ${centerY + cellSize * 0.35})`} pointerEvents="none">
                <rect
                  x={-cellSize * 0.22}
                  y={-cellSize * 0.08}
                  width={cellSize * 0.44}
                  height={cellSize * 0.16}
                  rx={cellSize * 0.04}
                  fill="#16a34a"
                  stroke="white"
                  strokeWidth={0.5}
                />
                <text
                  x={0}
                  y={cellSize * 0.02}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={cellSize * 0.1}
                  fill="white"
                  fontWeight="bold"
                  className="select-none"
                  style={{ pointerEvents: 'none' }}
                >
                  FUTURE
                </text>
              </g>
            )}

            {/* Footprint indicator for non-origin cells */}
            {!isOrigin && (
              <g transform={`translate(${centerX}, ${centerY})`} pointerEvents="none">
                {/* Small dot to indicate this is part of a larger footprint */}
                <circle
                  cx={0}
                  cy={0}
                  r={cellSize * 0.08}
                  fill="#16a34a"
                  opacity={0.6}
                />
              </g>
            )}
          </g>
        );
      })}
    </g>
  );
};

export default FuturePlantingsOverlay;
