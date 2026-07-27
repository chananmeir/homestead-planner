/**
 * Pure utility functions extracted from GardenDesigner.tsx
 * No state dependencies — can be used by any component.
 */

import { Plant, PlantedItem, PlantingEvent } from '../../../types';
import { formatDisplayDate, parseLocalDate } from '../../../utils/dateUtils';
import { coordinateToGridLabel } from './gridCoordinates';

const TERMINAL_PLANT_OUTCOMES = new Set(['failed', 'didnt_establish', 'not_planted']);

/** Quantity-safe plant count for UI aggregates. */
export const getPlantedItemQuantity = (item: Pick<PlantedItem, 'quantity'>): number => {
  const quantity = Number(item.quantity);
  if (!Number.isFinite(quantity)) return 0;
  return Math.max(0, quantity);
};

/** Total individual plants represented by placement records. */
export const getTotalPlantedQuantity = (items: Pick<PlantedItem, 'quantity'>[]): number => {
  return items.reduce((sum, item) => sum + getPlantedItemQuantity(item), 0);
};

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

const normalizeDay = (value: Date | string | null | undefined): Date | null => {
  if (!value) return null;
  const date = typeof value === 'string' ? parseLocalDate(value) : new Date(value);
  if (isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
};

/** Safe date formatter - returns "Date TBD" for invalid/missing dates */
export const formatDateSafe = (dateValue: Date | string | null | undefined): string => {
  if (!dateValue) return 'Date TBD';
  try {
    const date = normalizeDay(dateValue);
    if (!date) return 'Date TBD';
    return formatDisplayDate(date);
  } catch {
    return 'Date TBD';
  }
};

/** Calculate expected harvest date for a planted item */
export const calculateHarvestDate = (item: PlantedItem, plant: Plant | undefined): Date | null => {
  if (item.harvestDate) {
    return normalizeDay(item.harvestDate);
  }
  if (!plant?.daysToMaturity) return null;
  const baseDateStr = item.transplantDate || item.plantedDate;
  if (!baseDateStr) return null;
  const baseDate = normalizeDay(baseDateStr);
  if (!baseDate) return null;
  const harvestDate = new Date(baseDate);
  harvestDate.setDate(harvestDate.getDate() + plant.daysToMaturity);
  return harvestDate;
};

/** True when a placed item should be visible in the actual bed state. */
export const isPlantedItemActiveOnDate = (item: PlantedItem, viewDate: Date): boolean => {
  if (item.cancelledAt) return false;
  if (item.clearedAt) return false;
  if (item.outcome && TERMINAL_PLANT_OUTCOMES.has(item.outcome)) return false;
  if (!item.plantedDate) return false;

  const planted = normalizeDay(item.plantedDate);
  if (!planted) return false;

  const viewDay = new Date(viewDate);
  viewDay.setHours(0, 0, 0, 0);

  if (planted > viewDay) return false;

  if (item.status === 'harvested') {
    if (!item.harvestDate) return false;
    const harvest = normalizeDay(item.harvestDate);
    if (!harvest) return false;
    return harvest >= viewDay;
  }

  if (item.status === 'saving-seed') {
    return !item.seedsCollected;
  }

  return true;
};

/** True when the bed detail panel should offer a terminal failed/no-yield outcome. */
export const canMarkPlantedItemFailed = (
  item: PlantedItem,
  viewDate: Date | string = new Date()
): boolean => {
  if (item.cancelledAt) return false;
  if (item.clearedAt) return false;
  if (TERMINAL_PLANT_OUTCOMES.has(item.status)) return false;
  if (item.status === 'harvested') return false;
  if (item.outcome) return false;
  if (item.seedsCollected || item.saveForSeed) return false;

  if (item.status !== 'planned') return true;

  const plantedDay = normalizeDay(item.plantedDate);
  const viewDay = normalizeDay(viewDate);
  return !!plantedDay && !!viewDay && plantedDay <= viewDay;
};

/** True when a harvested placement can be soft-cleared without recording new yield. */
export const canClearHarvestedPlantedItem = (item: PlantedItem): boolean => {
  return item.status === 'harvested'
    && !item.cancelledAt
    && !item.clearedAt
    && !item.outcome;
};

export const getBulkFailureGroupsForPlantedItem = (
  items: PlantedItem[],
  sourceItem: PlantedItem,
  viewDate: Date | string = new Date()
): { rowItems: PlantedItem[]; allMatchingItems: PlantedItem[] } => {
  const sourceDay = normalizeDay(sourceItem.plantedDate);
  if (!sourceDay || !canMarkPlantedItemFailed(sourceItem, viewDate)) {
    return { rowItems: [], allMatchingItems: [] };
  }

  const sameVariety = (item: PlantedItem) =>
    (item.variety || '') === (sourceItem.variety || '');

  const allMatchingItems = items
    .filter(item => {
      const itemDay = normalizeDay(item.plantedDate);
      return item.plantId === sourceItem.plantId
        && sameVariety(item)
        && !!itemDay
        && itemDay.getTime() === sourceDay.getTime()
        && canMarkPlantedItemFailed(item, viewDate);
    })
    .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x || a.id - b.id);

  const rowItems = allMatchingItems.filter(item => item.position.y === sourceItem.position.y);

  return { rowItems, allMatchingItems };
};

export const getBulkHarvestedClearGroupsForPlantedItem = (
  items: PlantedItem[],
  sourceItem: PlantedItem
): { rowItems: PlantedItem[]; allMatchingItems: PlantedItem[] } => {
  const sourceDay = normalizeDay(sourceItem.plantedDate);
  if (!sourceDay || !canClearHarvestedPlantedItem(sourceItem)) {
    return { rowItems: [], allMatchingItems: [] };
  }

  const sameVariety = (item: PlantedItem) =>
    (item.variety || '') === (sourceItem.variety || '');

  const allMatchingItems = items
    .filter(item => {
      const itemDay = normalizeDay(item.plantedDate);
      return item.plantId === sourceItem.plantId
        && sameVariety(item)
        && !!itemDay
        && itemDay.getTime() === sourceDay.getTime()
        && canClearHarvestedPlantedItem(item);
    })
    .sort((a, b) => a.position.y - b.position.y || a.position.x - b.position.x || a.id - b.id);

  const rowItems = allMatchingItems.filter(item => item.position.y === sourceItem.position.y);

  return { rowItems, allMatchingItems };
};

export type PlantedItemDisplayStatusTone =
  | 'scheduled'
  | 'growing'
  | 'seeded'
  | 'transplanted'
  | 'harvested'
  | 'saving-seed'
  | 'failed'
  | 'not-planted'
  | 'neutral';

export interface PlantedItemDisplayStatus {
  label: string;
  tone: PlantedItemDisplayStatusTone;
}

/** User-facing status for placed plants. Keeps "planned" for unplaced plans only. */
export const getPlantedItemDisplayStatus = (
  item: PlantedItem,
  viewDate: Date = new Date()
): PlantedItemDisplayStatus => {
  if (item.cancelledAt) return { label: 'Skipped', tone: 'neutral' };
  if (item.clearedAt) return { label: 'Harvested', tone: 'harvested' };
  if (item.outcome === 'failed') return { label: 'Failed', tone: 'failed' };
  if (item.outcome === 'didnt_establish') return { label: "Didn't establish", tone: 'failed' };
  if (item.outcome === 'not_planted') return { label: 'Not planted', tone: 'not-planted' };
  if (item.status === 'harvested') return { label: 'Harvested', tone: 'harvested' };
  if (item.status === 'saving-seed') return { label: 'Saving seed', tone: 'saving-seed' };

  const plantedDay = normalizeDay(item.plantedDate);
  const viewDay = normalizeDay(viewDate);
  if (plantedDay && viewDay && plantedDay > viewDay) {
    return { label: 'Scheduled', tone: 'scheduled' };
  }

  if (item.status === 'planned') return { label: 'Growing', tone: 'growing' };
  if (item.status === 'seeded') return { label: 'Seeded', tone: 'seeded' };
  if (item.status === 'transplanted') return { label: 'Transplanted', tone: 'transplanted' };
  if (item.status === 'growing') return { label: 'Growing', tone: 'growing' };

  return { label: item.status || 'Placed', tone: 'neutral' };
};

/** Get future planting events at a specific grid position */
export const getFuturePlantingsAtPosition = (
  plantingEvents: PlantingEvent[],
  bedId: number,
  posX: number,
  posY: number,
  currentDate: string
): PlantingEvent[] => {
  const current = normalizeDay(currentDate);
  if (!current) return [];
  return plantingEvents.filter(event => {
    if (event.gardenBedId !== bedId) return false;
    if (event.positionX !== posX || event.positionY !== posY) return false;
    const plantingDateStr = event.directSeedDate || event.transplantDate || event.seedStartDate;
    if (!plantingDateStr) return false;
    const plantingDate = normalizeDay(plantingDateStr);
    if (!plantingDate) return false;
    return plantingDate > current;
  }).sort((a, b) => {
    const dateA = normalizeDay(a.directSeedDate || a.transplantDate || a.seedStartDate || '');
    const dateB = normalizeDay(b.directSeedDate || b.transplantDate || b.seedStartDate || '');
    return (dateA?.getTime() ?? 0) - (dateB?.getTime() ?? 0);
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

/**
 * Lay out `totalQuantity` plants across a set of pre-computed cells, filling each cell
 * up to `cellCapacity` plants before moving to the next. The input cells already encode
 * the plant's real spacing (one entry per placeable cell), so walking them in order lays
 * plants out at proper spacing — 1 per cell for wide-spacing crops (cellCapacity === 1),
 * multiple per cell only for dense crops (cellCapacity > 1).
 *
 * Crucially it NEVER stacks more than a cell can hold: that was the bug that crammed a
 * whole row of peppers into a single square (e.g. 5 plants -> A7 qty3 + C7 qty2) and then
 * rendered it as one icon. If more plants are requested than fit at proper spacing, the
 * surplus is returned as `notFitted` so the caller can warn the user ("stop at bed edge")
 * instead of over-stacking.
 *
 * Pure function — no state or DOM dependencies, so it is unit-testable.
 */
export function distributePlantsAcrossCells(
  cells: { x: number; y: number }[],
  totalQuantity: number,
  cellCapacity: number
): {
  positions: { x: number; y: number; quantity: number }[];
  notFitted: number;
} {
  const capacity = Math.max(1, Math.floor(cellCapacity));
  let remaining = Math.max(0, Math.floor(totalQuantity));
  const positions: { x: number; y: number; quantity: number }[] = [];

  for (const cell of cells) {
    if (remaining <= 0) break;
    const quantity = Math.min(capacity, remaining);
    remaining -= quantity;
    positions.push({ x: cell.x, y: cell.y, quantity });
  }

  return { positions, notFitted: remaining };
}

/**
 * Lay out `totalQuantity` plants evenly across pre-computed cells, capping each
 * cell at `cellCapacity`. Remainder plants go to the earliest cells.
 */
export function distributePlantsEvenlyAcrossCells(
  cells: { x: number; y: number }[],
  totalQuantity: number,
  cellCapacity: number
): {
  positions: { x: number; y: number; quantity: number }[];
  notFitted: number;
} {
  const capacity = Math.max(1, Math.floor(cellCapacity));
  const requested = Math.max(0, Math.floor(totalQuantity));
  const totalCapacity = cells.length * capacity;
  const quantityToPlace = Math.min(requested, totalCapacity);
  const positions: { x: number; y: number; quantity: number }[] = [];

  if (cells.length === 0 || quantityToPlace <= 0) {
    return { positions, notFitted: requested };
  }

  const baseQuantity = Math.floor(quantityToPlace / cells.length);
  let remainder = quantityToPlace % cells.length;

  for (const cell of cells) {
    const quantity = Math.min(
      capacity,
      baseQuantity + (remainder > 0 ? 1 : 0)
    );
    if (remainder > 0) {
      remainder -= 1;
    }
    if (quantity > 0) {
      positions.push({ x: cell.x, y: cell.y, quantity });
    }
  }

  return { positions, notFitted: requested - quantityToPlace };
}
