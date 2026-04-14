import React from 'react';
import { PlantIconSVG } from '../common/PlantIcon';
import { PlantingEvent, Plant } from '../../types';
import { calculateSpacingBuffer } from './utils/footprintCalculator';
import { parseLocalDate } from '../../utils/dateUtils';

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

/**
 * Helper function to convert PlantingEvents to overlay positions
 *
 * Uses circular spacing buffer for multi-cell plants and optionally
 * filters by harvest window (Quick Harvest Filter integration).
 *
 * When harvestWindowDays is set:
 * - Only shows future plantings that START within that many days
 * - If you're planting lettuce (30d harvest), you don't need to see
 *   a squash scheduled for day 50 - your lettuce will be gone by then
 *
 * @param harvestWindowDays - If set, only show future events within this many days
 */
export const getFuturePlantingPositions = (
  events: PlantingEvent[],
  bedId: number,
  currentDate: string,
  plants: Plant[],
  getPlantIcon: (plantId: string) => string,
  harvestWindowDays: number | null = null
): FuturePlantingPosition[] => {
  const current = parseLocalDate(currentDate);
  const positions: FuturePlantingPosition[] = [];
  const occupiedCells = new Set<string>(); // Track which cells are already marked

  // Calculate the harvest cutoff date (if quick harvest filter is active)
  let harvestCutoff: Date | null = null;
  if (harvestWindowDays !== null) {
    harvestCutoff = new Date(current);
    harvestCutoff.setDate(harvestCutoff.getDate() + harvestWindowDays);
  }

  const filteredEvents = events.filter(event => {
    // Must be in the specified bed
    if (event.gardenBedId !== bedId) return false;

    // Must have position data (use loose equality to catch both null and undefined)
    if (event.positionX == null || event.positionY == null) return false;

    // Must be a planting event (not mulch, fertilizing, etc.)
    if (event.eventType && event.eventType !== 'planting') return false;

    // Get the relevant planting date
    const plantingDateStr = event.directSeedDate || event.transplantDate || event.seedStartDate;
    if (!plantingDateStr) return false;

    const plantingDate = new Date(plantingDateStr);
    // Only include future events (after current view date)
    if (plantingDate <= current) return false;

    // If harvest window is active, only show events that START before harvest cutoff
    // (these are the ones that would conflict with a crop planted today)
    if (harvestCutoff && plantingDate > harvestCutoff) return false;

    return true;
  });

  const gridSize = 12; // Standard SFG grid size in inches

  for (const event of filteredEvents) {
    const plantingDateStr = event.directSeedDate || event.transplantDate || event.seedStartDate || '';
    const originX = event.positionX!;
    const originY = event.positionY!;

    // Get plant spacing in inches - this determines the "no-plant zone" radius
    let spacingInches = 12; // Default to 1 cell (12")
    const plant = plants.find(p => p.id === event.plantId);

    if (event.spacing) {
      // Use spacing from event if available
      spacingInches = event.spacing;
    } else if (plant && plant.spacing) {
      // Otherwise use plant's default spacing
      spacingInches = plant.spacing;
    }

    // Calculate all cells within the plant's spacing buffer (circular zone)
    const bufferCells = calculateSpacingBuffer(originX, originY, spacingInches, gridSize);

    for (const cell of bufferCells) {
      const cellKey = `${cell.x},${cell.y}`;

      // Skip if this cell is already occupied by another future planting
      if (occupiedCells.has(cellKey)) continue;

      occupiedCells.add(cellKey);

      const isOrigin = cell.x === originX && cell.y === originY;

      positions.push({
        x: cell.x,
        y: cell.y,
        plantId: event.plantId,
        plantIcon: getPlantIcon(event.plantId || ''),
        variety: event.variety,
        plantingDate: plantingDateStr,
        isOrigin,
        spaceRequired: Math.ceil(spacingInches / gridSize), // For display purposes
      });
    }
  }

  return positions;
};

/**
 * Get all future planting events at a specific position
 * Checks if the position is within ANY plant's circular spacing buffer
 */
export const getFutureEventsAtPosition = (
  events: PlantingEvent[],
  bedId: number,
  posX: number,
  posY: number,
  currentDate: string,
  plants: Plant[] = []
): PlantingEvent[] => {
  const current = parseLocalDate(currentDate);
  const gridSize = 12; // Standard SFG grid size in inches

  return events
    .filter(event => {
      // Must be in the specified bed
      if (event.gardenBedId !== bedId) return false;

      // Must have position data (use loose equality to catch both null and undefined)
      if (event.positionX == null || event.positionY == null) return false;

      // Must be a planting event
      if (event.eventType && event.eventType !== 'planting') return false;

      // Get the relevant planting date
      const plantingDateStr = event.directSeedDate || event.transplantDate || event.seedStartDate;
      if (!plantingDateStr) return false;

      const plantingDate = new Date(plantingDateStr);
      // Only include future events
      if (plantingDate <= current) return false;

      // Check if position is within this event's spacing buffer
      const originX = event.positionX!;
      const originY = event.positionY!;

      // Get plant spacing in inches
      let spacingInches = 12; // Default
      const plant = plants.find(p => p.id === event.plantId);

      if (event.spacing) {
        spacingInches = event.spacing;
      } else if (plant && plant.spacing) {
        spacingInches = plant.spacing;
      }

      // Calculate distance from plant origin to target position (in inches)
      const dx = posX - originX;
      const dy = posY - originY;
      const distanceInches = Math.sqrt(
        Math.pow(dx * gridSize, 2) +
        Math.pow(dy * gridSize, 2)
      );

      // Position is affected if it's within the spacing distance
      return distanceInches < spacingInches;
    })
    .sort((a, b) => {
      // Sort by planting date ascending
      const dateA = new Date(a.directSeedDate || a.transplantDate || a.seedStartDate || '');
      const dateB = new Date(b.directSeedDate || b.transplantDate || b.seedStartDate || '');
      return dateA.getTime() - dateB.getTime();
    });
};

/**
 * Get future planting events assigned to a bed that have NO position data.
 * These are typically created via season planner export and haven't been
 * physically placed on the grid yet.
 */
export const getUnpositionedFutureEvents = (
  events: PlantingEvent[],
  bedId: number,
  currentDate: string
): PlantingEvent[] => {
  const current = parseLocalDate(currentDate);
  return events.filter(event => {
    if (event.gardenBedId !== bedId) return false;
    if (event.eventType && event.eventType !== 'planting') return false;
    // Only events WITHOUT position data
    if (event.positionX != null && event.positionY != null) return false;
    const dateStr = event.directSeedDate || event.transplantDate || event.seedStartDate;
    if (!dateStr) return false;
    return new Date(dateStr) > current;
  }).sort((a, b) => {
    const dA = new Date(a.directSeedDate || a.transplantDate || a.seedStartDate || '');
    const dB = new Date(b.directSeedDate || b.transplantDate || b.seedStartDate || '');
    return dA.getTime() - dB.getTime();
  });
};

export default FuturePlantingsOverlay;
