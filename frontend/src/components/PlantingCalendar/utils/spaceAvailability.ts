import { Plant, PlantingCalendar, GardenBed } from '../../../types';
import { PLANT_DATABASE } from '../../../data/plantDatabase';
import { getSFGCellsRequired } from '../../../utils/sfgSpacing';
import { getMIGardenerSpacing } from '../../../utils/migardenerSpacing';
import { getIntensiveSpacing, calculateIntensiveCellsRequired } from '../../../utils/intensiveSpacing';
import { calculateFootprintBedAware } from '../../GardenDesigner/utils/footprintCalculator';

/**
 * Represents an occupied grid cell with metadata
 */
export interface OccupiedCell {
  x: number;
  y: number;
  plantingEventId: number;
  plantName: string;
  variety?: string;
  startDate: Date;
  endDate: Date;
}

/**
 * Represents an available grid cell
 */
export interface AvailableCell {
  x: number;
  y: number;
}

/**
 * Get all occupied cells in a garden bed for a specific date range
 *
 * A cell is considered occupied if there's a planting event that:
 * 1. Has a position (position_x, position_y defined)
 * 2. Overlaps with the date range (temporal overlap check)
 * 3. Is in the specified garden bed
 *
 * @param gardenBedId - ID of the garden bed to check
 * @param dateRange - Start and end dates to check for occupancy
 * @param plantingEvents - All planting events to check
 * @param gardenBed - Optional garden bed object for bed-type aware footprint calculation
 * @returns Array of occupied cells with metadata
 */
export function getOccupiedCells(
  gardenBedId: string | number,
  dateRange: { start: Date; end: Date },
  plantingEvents: PlantingCalendar[],
  gardenBed?: GardenBed
): OccupiedCell[] {
  const occupiedCells: OccupiedCell[] = [];

  // Filter events for this bed with positions
  const relevantEvents = plantingEvents.filter(
    (event) =>
      event.gardenBedId === gardenBedId &&
      event.positionX !== undefined &&
      event.positionY !== undefined
  );

  for (const event of relevantEvents) {
    // Determine event's date range
    // Use the date when plant actually occupies space in the GARDEN BED
    // (not indoor seed start date - that doesn't use garden space!)
    const eventStart =
      event.directSeedDate || event.transplantDate || event.seedStartDate;
    const eventEnd = event.expectedHarvestDate;

    // Skip if we can't determine when the plant goes in the garden
    if (!eventStart || !eventEnd) continue;

    // Check for temporal overlap
    const hasOverlap =
      eventStart <= dateRange.end && eventEnd >= dateRange.start;

    if (hasOverlap && event.positionX !== undefined && event.positionY !== undefined) {
      // Calculate all cells occupied by this event using bed-aware footprint calculation
      const spaceRequired = event.spaceRequired || 1;

      // Look up human-readable plant name
      const plant = PLANT_DATABASE.find((p) => p.id === event.plantId);
      const plantName = plant?.name || event.plantId || 'Unknown';

      // Get bed-specific footprint calculation
      let footprintCells;
      if (gardenBed) {
        // Calculate spacing based on bed planning method
        let rowSpacing: number | null | undefined;
        let plantSpacing: number | undefined;
        const gridSize = gardenBed.gridSize || 12;

        if (gardenBed.planningMethod === 'migardener' && plant && event.plantId) {
          // Use MIGardener spacing calculation with overrides
          const migardenerSpacing = getMIGardenerSpacing(
            event.plantId,
            plant.spacing || 12,
            plant.rowSpacing
          );
          rowSpacing = migardenerSpacing.rowSpacing;
          plantSpacing = migardenerSpacing.plantSpacing;
        } else {
          // Use standard plant spacing
          rowSpacing = plant?.rowSpacing;
          plantSpacing = plant?.spacing;
        }

        footprintCells = calculateFootprintBedAware(
          event.positionX,
          event.positionY,
          spaceRequired,
          gardenBed.planningMethod || 'square-foot',
          gridSize,
          rowSpacing,
          plantSpacing
        );
      } else {
        // Fallback to square packing if bed not provided
        const cellsPerSide = Math.ceil(Math.sqrt(spaceRequired));
        footprintCells = [];
        for (let dx = 0; dx < cellsPerSide; dx++) {
          for (let dy = 0; dy < cellsPerSide; dy++) {
            footprintCells.push({ x: event.positionX + dx, y: event.positionY + dy });
          }
        }
      }

      // Add all occupied cells with metadata
      for (const cell of footprintCells) {
        occupiedCells.push({
          x: cell.x,
          y: cell.y,
          plantingEventId: event.id,
          plantName,
          variety: event.variety,
          startDate: eventStart,
          endDate: eventEnd,
        });
      }
    }
  }

  return occupiedCells;
}

/**
 * Get all available cells in a garden bed
 *
 * @param gardenBed - Garden bed object with dimensions
 * @param occupiedCells - Array of occupied cells to exclude
 * @returns Array of available cell positions
 */
export function getAvailableCells(
  gardenBed: GardenBed,
  occupiedCells: OccupiedCell[]
): AvailableCell[] {
  const availableCells: AvailableCell[] = [];

  // Calculate grid dimensions (assuming 12" square foot gardening)
  // NOTE: gardenBed.width and gardenBed.length are in FEET, must convert to inches
  const gridSize = gardenBed.gridSize || 12;
  const gridWidth = Math.floor((gardenBed.width * 12) / gridSize);
  const gridHeight = Math.floor((gardenBed.length * 12) / gridSize);

  // Create set of occupied positions for O(1) lookup
  const occupiedSet = new Set(
    occupiedCells.map((cell) => `${cell.x},${cell.y}`)
  );

  // Check each cell in the grid
  for (let x = 0; x < gridWidth; x++) {
    for (let y = 0; y < gridHeight; y++) {
      const key = `${x},${y}`;
      if (!occupiedSet.has(key)) {
        availableCells.push({ x, y });
      }
    }
  }

  return availableCells;
}

/**
 * Find contiguous available spaces that can fit the required space
 *
 * Uses a flood-fill algorithm to find connected groups of available cells
 *
 * @param availableCells - Array of available cells
 * @param spaceRequired - Number of cells needed (1, 4, 9, etc.)
 * @returns Array of cells that are part of contiguous spaces large enough
 */
export function findContiguousSpaces(
  availableCells: AvailableCell[],
  spaceRequired: number
): AvailableCell[] {
  if (spaceRequired <= 1) {
    // Every available cell is a valid option
    return availableCells;
  }

  // Calculate cells needed per side (e.g., 4 cells = 2x2 grid)
  const cellsPerSide = Math.ceil(Math.sqrt(spaceRequired));

  // Create set of available positions for O(1) lookup
  const availableSet = new Set(
    availableCells.map((cell) => `${cell.x},${cell.y}`)
  );

  const suitableCells: AvailableCell[] = [];

  // Check each available cell as potential top-left corner
  for (const cell of availableCells) {
    let canFit = true;

    // Check if required rectangle fits starting from this cell
    for (let dx = 0; dx < cellsPerSide && canFit; dx++) {
      for (let dy = 0; dy < cellsPerSide && canFit; dy++) {
        const key = `${cell.x + dx},${cell.y + dy}`;
        if (!availableSet.has(key)) {
          canFit = false;
        }
      }
    }

    if (canFit) {
      // Add all cells in this rectangle
      for (let dx = 0; dx < cellsPerSide; dx++) {
        for (let dy = 0; dy < cellsPerSide; dy++) {
          suitableCells.push({ x: cell.x + dx, y: cell.y + dy });
        }
      }
    }
  }

  // Remove duplicates
  const uniqueCells = Array.from(
    new Set(suitableCells.map((cell) => `${cell.x},${cell.y}`))
  ).map((key) => {
    const [x, y] = key.split(',').map(Number);
    return { x, y };
  });

  return uniqueCells;
}

/**
 * Calculate space requirement (in grid cells) for a plant
 *
 * Uses method-aware calculation based on the bed's planning method:
 * - Square Foot Gardening: Uses SFG rules (tomato = 1 cell)
 * - MIGardener: Uses ultra-dense spacing overrides
 * - Row/Traditional: Uses spacing-based calculation
 *
 * @param plant - Plant object with spacing requirements
 * @param gridSize - Grid cell size in inches (default: 12" square foot)
 * @param planningMethod - Bed's planning method ('square-foot', 'row', 'migardener', etc.)
 * @returns Number of grid cells needed (1, 4, 9, etc.)
 */
export function calculateSpaceRequirement(
  plant: Plant,
  gridSize: number = 12,
  planningMethod: string = 'row'
): number {
  // SQUARE FOOT GARDENING: Use SFG lookup table
  if (planningMethod === 'square-foot') {
    return getSFGCellsRequired(plant.id);
  }

  // MIGARDENER: Use existing MIGardener spacing system
  if (planningMethod === 'migardener') {
    const spacing = getMIGardenerSpacing(plant.id, plant.spacing, plant.rowSpacing);
    // Calculate cells needed based on both dimensions
    const cellsHorizontal = Math.ceil(spacing.plantSpacing / gridSize);
    // For intensive crops (null rowSpacing), use plantSpacing for both dimensions
    const cellsVertical = spacing.rowSpacing === null || spacing.rowSpacing === 0
      ? Math.ceil(spacing.plantSpacing / gridSize)
      : Math.ceil(spacing.rowSpacing / gridSize);
    return cellsHorizontal * cellsVertical;
  }

  // INTENSIVE/BIO-INTENSIVE: Use hexagonal packing with 0.866 offset
  if (planningMethod === 'intensive') {
    const onCenterSpacing = getIntensiveSpacing(plant.id, plant.spacing);
    return calculateIntensiveCellsRequired(onCenterSpacing, gridSize);
  }

  // ROW / TRADITIONAL / RAISED-BED: Use spacing-based calculation
  const spacing = plant.spacing || 12;
  const cellsPerSide = Math.ceil(spacing / gridSize);
  return cellsPerSide * cellsPerSide;
}

/**
 * Format occupied cell information for display
 *
 * @param cell - Occupied cell with metadata
 * @returns Formatted string for tooltip/display
 */
export function formatOccupiedCell(cell: OccupiedCell): string {
  const dateRange = `${cell.startDate.toLocaleDateString()} - ${cell.endDate.toLocaleDateString()}`;
  const varietyText = cell.variety ? ` (${cell.variety})` : '';
  return `${cell.plantName}${varietyText}\n${dateRange}`;
}
