/**
 * Pure utility functions extracted from GardenDesigner.tsx
 * No state dependencies — can be used by any component.
 */

import { Plant, PlantedItem, PlantingEvent } from '../../../types';
import { coordinateToGridLabel } from './gridCoordinates';

// Badge positioning constants (percentage of cell size)
export const BADGE_POSITION = {
  X_OFFSET: 0.78,
  Y_OFFSET: 0.08,
  TEXT_X_OFFSET: 0.92,
  TEXT_Y_OFFSET: 0.155
} as const;

export const BADGE_DIMENSIONS = {
  WIDTH_POSITIVE: 28,
  WIDTH_NEGATIVE: 42,
  HEIGHT: 15,
  RADIUS: 7.5,
  STROKE_WIDTH: 2,
  FONT_SIZE: 9
} as const;

export const BADGE_COLORS = {
  POSITIVE_BG: '#059669',
  NEGATIVE_BG: '#dc2626',
  TEXT: '#1f2937',
  STROKE: '#374151'
} as const;

/** Format a conflict error response into a readable message */
export function formatConflictError(errorData: {
  error?: string;
  message?: string;
  conflicts?: { plantName?: string; variety?: string; position?: { x: number; y: number }; dates?: string }[];
  failed_position?: { x: number; y: number };
}): string {
  if (errorData.conflicts && errorData.conflicts.length > 0) {
    const failedPos = errorData.failed_position;
    const posLabel = failedPos
      ? ` at ${coordinateToGridLabel(failedPos.x, failedPos.y)}`
      : '';
    const conflictList = errorData.conflicts.map(c => {
      const name = c.plantName || 'Unknown';
      const v = c.variety ? ` (${c.variety})` : '';
      const pos = c.position ? ` at ${coordinateToGridLabel(c.position.x, c.position.y)}` : '';
      const dates = c.dates ? ` [${c.dates}]` : '';
      return `• ${name}${v}${pos}${dates}`;
    }).join('\n');
    return `Planting conflict${posLabel} — overlaps with:\n${conflictList}`;
  }
  return errorData.message || errorData.error || 'Failed to place plants';
}

/** Format a Date as YYYY-MM-DD using local date components */
export const formatLocalDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Safe date formatter - returns "Date TBD" for invalid/missing dates */
export const formatDateSafe = (dateValue: Date | string | null | undefined): string => {
  if (!dateValue) return 'Date TBD';
  try {
    const date = typeof dateValue === 'string' ? new Date(dateValue) : dateValue;
    if (isNaN(date.getTime())) return 'Date TBD';
    return date.toLocaleDateString();
  } catch {
    return 'Date TBD';
  }
};

/** Calculate expected harvest date for a planted item */
export const calculateHarvestDate = (item: PlantedItem, plant: Plant | undefined): Date | null => {
  if (item.harvestDate) {
    const harvest = new Date(item.harvestDate);
    return isNaN(harvest.getTime()) ? null : harvest;
  }
  if (!plant?.daysToMaturity) return null;
  const baseDateStr = item.transplantDate || item.plantedDate;
  if (!baseDateStr) return null;
  const baseDate = new Date(baseDateStr);
  if (isNaN(baseDate.getTime())) return null;
  const harvestDate = new Date(baseDate);
  harvestDate.setDate(harvestDate.getDate() + plant.daysToMaturity);
  return harvestDate;
};

/** Get future planting events at a specific grid position */
export const getFuturePlantingsAtPosition = (
  plantingEvents: PlantingEvent[],
  bedId: number,
  posX: number,
  posY: number,
  currentDate: string
): PlantingEvent[] => {
  const current = new Date(currentDate);
  return plantingEvents.filter(event => {
    if (event.gardenBedId !== bedId) return false;
    if (event.positionX !== posX || event.positionY !== posY) return false;
    const plantingDateStr = event.directSeedDate || event.transplantDate || event.seedStartDate;
    if (!plantingDateStr) return false;
    const plantingDate = new Date(plantingDateStr);
    return plantingDate > current;
  }).sort((a, b) => {
    const dateA = new Date(a.directSeedDate || a.transplantDate || a.seedStartDate || '');
    const dateB = new Date(b.directSeedDate || b.transplantDate || b.seedStartDate || '');
    return dateA.getTime() - dateB.getTime();
  });
};

/** Calculate tooltip/panel position to keep within viewport */
export const calculateTooltipPosition = (clickX: number, clickY: number) => {
  const panelWidth = 300;
  const panelHeight = 500;
  const padding = 16;

  let left = clickX + 10;
  let top = clickY + 10;

  if (left + panelWidth > window.innerWidth - padding) {
    left = clickX - panelWidth - 10;
  }
  if (left < padding) {
    left = padding;
  }
  if (top + panelHeight > window.innerHeight - padding) {
    top = Math.max(padding, window.innerHeight - panelHeight - padding);
  }

  return { left, top };
};
