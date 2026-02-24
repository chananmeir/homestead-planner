import React from 'react';
import { PlantIconSVG } from '../common/PlantIcon';

interface PlacementPreviewProps {
  positions: { x: number; y: number }[];
  plantId?: string;
  plantIcon: string;
  cellSize: number;
  showPreview: boolean;
}

/**
 * PlacementPreview - Shows ghost outlines of where plants will be placed
 *
 * Renders semi-transparent preview markers on the garden grid to show
 * where auto-placement will position plants before the user confirms.
 *
 * Features:
 * - Semi-transparent green circles with plant emoji
 * - Position number badges (1, 2, 3, etc.)
 * - Only renders when showPreview is true
 */
export const PlacementPreview: React.FC<PlacementPreviewProps> = ({
  positions,
  plantId,
  plantIcon,
  cellSize,
  showPreview,
}) => {
  if (!showPreview || positions.length === 0) {
    return null;
  }

  return (
    <g className="placement-preview">
      {positions.map((pos, idx) => {
        const centerX = pos.x * cellSize + cellSize / 2;
        const centerY = pos.y * cellSize + cellSize / 2;
        const radius = cellSize * 0.4;

        return (
          <g key={`preview-${pos.x}-${pos.y}-${idx}`} opacity={0.7}>
            {/* Outer glow effect */}
            <circle
              cx={centerX}
              cy={centerY}
              r={radius + 2}
              fill="#4ade80"
              opacity={0.3}
            />

            {/* Main circle background */}
            <circle
              cx={centerX}
              cy={centerY}
              r={radius}
              fill="#4ade80"
              stroke="#22c55e"
              strokeWidth={2}
              strokeDasharray="4 2"
            />

            {/* Plant icon */}
            {plantId && (
              <PlantIconSVG
                key={`preview-${plantId}-${centerX}-${centerY}`}
                plantId={plantId}
                plantIcon={plantIcon}
                x={centerX - (cellSize * 0.6) / 2}
                y={centerY - (cellSize * 0.6) / 2}
                width={cellSize * 0.6}
                height={cellSize * 0.6}
              />
            )}
            {!plantId && (
              <text
                x={centerX}
                y={centerY}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={cellSize * 0.6}
                className="select-none"
                style={{ pointerEvents: 'none' }}
              >
                {plantIcon}
              </text>
            )}

            {/* Position number badge */}
            <g transform={`translate(${centerX + cellSize * 0.35}, ${centerY - cellSize * 0.35})`}>
              {/* Badge background circle */}
              <circle
                cx={0}
                cy={0}
                r={cellSize * 0.12}
                fill="#22c55e"
                stroke="white"
                strokeWidth={1}
              />
              {/* Badge number */}
              <text
                x={0}
                y={0}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={cellSize * 0.18}
                fill="white"
                fontWeight="bold"
                className="select-none"
                style={{ pointerEvents: 'none' }}
              >
                {idx + 1}
              </text>
            </g>
          </g>
        );
      })}
    </g>
  );
};

export default PlacementPreview;
