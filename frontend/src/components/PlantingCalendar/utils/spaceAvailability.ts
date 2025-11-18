import { Plant, PlantingCalendar, GardenBed } from '../../../types';
import { PLANT_DATABASE } from '../../../data/plantDatabase';

/**
 * Represents an occupied grid cell with metadata
 */
export interface OccupiedCell {
  x: number;
  y: number;
  plantingEventId: string;
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
 * @returns Array of occupied cells with metadata
 */
export function getOccupiedCells(
  gardenBedId: string,
  dateRange: { start: Date; end: Date },
  plantingEvents: PlantingCalendar[]
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
    const eventStart =
      event.seedStartDate || event.transplantDate || event.expectedHarvestDate;
    const eventEnd = event.expectedHarvestDate;

    // Check for temporal overlap
    const hasOverlap =
      eventStart <= dateRange.end && eventEnd >= dateRange.start;

    if (hasOverlap && event.positionX !== undefined && event.positionY !== undefined) {
      // Calculate all cells occupied by this event
      const spaceRequired = event.spaceRequired || 1;
      const cellsPerSide = Math.ceil(Math.sqrt(spaceRequired));

      // Look up human-readable plant name
      const plant = PLANT_DATABASE.find((p) => p.id === event.plantId);
      const plantName = plant?.name || event.plantId;

      for (let dx = 0; dx < cellsPerSide; dx++) {
        for (let dy = 0; dy < cellsPerSide; dy++) {
          occupiedCells.push({
            x: event.positionX + dx,
            y: event.positionY + dy,
            plantingEventId: event.id,
            plantName,
            variety: event.variety,
            startDate: eventStart,
            endDate: eventEnd,
          });
        }
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
  const gridSize = gardenBed.gridSize || 12;
  const gridWidth = Math.floor(gardenBed.width / gridSize);
  const gridHeight = Math.floor(gardenBed.length / gridSize);

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
 * @param plant - Plant object with spacing requirements
 * @param gridSize - Grid cell size in inches (default: 12" square foot)
 * @returns Number of grid cells needed (1, 4, 9, etc.)
 */
export function calculateSpaceRequirement(
  plant: Plant,
  gridSize: number = 12
): number {
  const spacing = plant.spacing; // Spacing in inches

  // Calculate how many grid cells are needed per side
  const cellsPerSide = Math.ceil(spacing / gridSize);

  // Return total cells (square area)
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
