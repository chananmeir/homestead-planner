/**
 * Row Continuity Utilities
 *
 * Detects and tracks continuous rows formed by adjacent grid cells.
 * MIGardener methodology plants continuous rows; grid cells are a UI abstraction.
 */

import { PlantedItem } from '../../../types';

/**
 * Generate a unique row group ID
 */
export function generateRowGroupId(): string {
  return `row-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Check if two positions are horizontally adjacent
 */
export function areHorizontallyAdjacent(pos1: { x: number; y: number }, pos2: { x: number; y: number }): boolean {
  return pos1.y === pos2.y && Math.abs(pos1.x - pos2.x) === 1;
}

/**
 * Check if two positions are vertically adjacent
 */
export function areVerticallyAdjacent(pos1: { x: number; y: number }, pos2: { x: number; y: number }): boolean {
  return pos1.x === pos2.x && Math.abs(pos1.y - pos2.y) === 1;
}

/**
 * Find adjacent plantings that match the current plant
 */
export function findAdjacentPlantings(
  currentPosition: { x: number; y: number },
  plantId: string,
  existingPlantings: PlantedItem[]
): PlantedItem[] {
  return existingPlantings.filter(planted => {
    if (!planted.position || typeof planted.position.x === 'undefined' || typeof planted.position.y === 'undefined') {
      return false;
    }

    const plantedPos = planted.position;
    const samePlant = planted.plantId === plantId;
    const isAdjacent = areHorizontallyAdjacent(currentPosition, plantedPos) ||
                       areVerticallyAdjacent(currentPosition, plantedPos);

    return samePlant && isAdjacent;
  });
}

/**
 * Determine row continuity information for a new planting
 */
export function determineRowContinuity(
  currentPosition: { x: number; y: number },
  plantId: string,
  existingPlantings: PlantedItem[]
): {
  rowGroupId: string;
  rowSegmentIndex: number;
  totalRowSegments: number;
  isPartOfRow: boolean;
} {
  const adjacentPlantings = findAdjacentPlantings(currentPosition, plantId, existingPlantings);

  if (adjacentPlantings.length === 0) {
    // This is a standalone planting (not part of a continuous row)
    const rowGroupId = generateRowGroupId();
    return {
      rowGroupId,
      rowSegmentIndex: 0,
      totalRowSegments: 1,
      isPartOfRow: false
    };
  }

  // Find existing row group
  const existingRowGroup = adjacentPlantings.find(p => p.rowGroupId);

  if (existingRowGroup && existingRowGroup.rowGroupId) {
    // Join existing row group
    // Find all plantings in this row group
    const rowGroupPlantings = existingPlantings.filter(p => p.rowGroupId === existingRowGroup.rowGroupId);
    const maxSegmentIndex = Math.max(...rowGroupPlantings.map(p => p.rowSegmentIndex || 0));

    return {
      rowGroupId: existingRowGroup.rowGroupId,
      rowSegmentIndex: maxSegmentIndex + 1,
      totalRowSegments: rowGroupPlantings.length + 1,
      isPartOfRow: true
    };
  }

  // Create new row group with adjacent plantings
  const rowGroupId = generateRowGroupId();
  return {
    rowGroupId,
    rowSegmentIndex: adjacentPlantings.length,  // New planting comes after existing ones
    totalRowSegments: adjacentPlantings.length + 1,
    isPartOfRow: true
  };
}

/**
 * Calculate total row length from multiple segments
 */
export function calculateTotalRowLength(
  rowGroupId: string,
  existingPlantings: PlantedItem[],
  uiSegmentLengthInches: number
): number {
  const rowPlantings = existingPlantings.filter(p => p.rowGroupId === rowGroupId);
  return (rowPlantings.length + 1) * uiSegmentLengthInches;  // +1 for current planting
}

/**
 * Get row continuity display message
 */
export function getRowContinuityMessage(
  totalRowSegments: number,
  uiSegmentLengthInches: number,
  isPartOfRow: boolean
): string | null {
  if (!isPartOfRow) {
    return null;
  }

  const totalLength = totalRowSegments * uiSegmentLengthInches;
  return `Part of ${totalLength}" continuous row (${totalRowSegments} segments)`;
}
