import { Plant, PlantedItem } from '../../../types';
import { getSFGCellsRequired } from '../../../utils/sfgSpacing';
import { getMIGardenerSpacing } from '../../../utils/migardenerSpacing';
import { getIntensiveSpacing, calculateIntensiveCellsRequired, HEX_ROW_OFFSET } from '../../../utils/intensiveSpacing';
import { PlantingStyle } from '../../../utils/plantingStyles';

/**
 * Fill direction for auto-placement
 * - 'across': Row-major, left-to-right then down (default)
 * - 'down': Column-major, top-to-bottom then right
 */
export type FillDirection = 'across' | 'down';

/**
 * Request parameters for auto-placement algorithm
 */
export interface PlacementRequest {
  startPosition: { x: number; y: number } | null;
  plant: Plant;
  quantity: number;
  bedDimensions: { gridWidth: number; gridHeight: number };
  gridSize: number; // inches per grid cell (e.g., 12 for SFG)
  existingPlants: PlantedItem[];
  dateFilter?: string; // ISO date for temporal conflict checking
  planningMethod?: string; // Planning method (e.g., 'square-foot', 'migardener', 'row')
  plantingStyle?: PlantingStyle; // NEW: Explicit planting style override (e.g., 'grid', 'row', 'broadcast')
  fillDirection?: FillDirection; // Direction to fill cells: 'across' (row-major) or 'down' (column-major)
}

/**
 * Result of auto-placement algorithm
 */
export interface PlacementResult {
  positions: { x: number; y: number }[];
  placed: number; // How many plants were successfully placed
  failed: number; // How many couldn't be placed
}

/**
 * Auto-place multiple plants in a garden bed.
 *
 * Strategy varies by planning method:
 *
 * MIGardener Method (when planningMethod='migardener' and plant has rowSpacing):
 * - Uses row-based placement pattern
 * - Rows separated by plant.rowSpacing (e.g., 4" for radish)
 * - Plants within row separated by plant.spacing (e.g., 1" for radish)
 * - Generates horizontal rows across the bed
 * - Example: Radish with 4" rows × 1" spacing = 3 rows per foot × 12 plants per row
 *
 * Generic Method (all other cases):
 * - Uses generic left-to-right, top-to-bottom fill pattern
 * - Spacing based on plant.spacing only
 * - Places plants in every available grid cell respecting spacing constraints
 *
 * Common Steps:
 * 1. Generate candidate positions using appropriate strategy
 * 2. Validate each candidate (bounds, spacing conflicts, occupancy)
 * 3. Return positions until quantity is reached or no more valid positions
 *
 * @param request - Placement parameters
 * @returns PlacementResult with positions array and counts
 */
export function autoPlacePlants(request: PlacementRequest): PlacementResult {
  const {
    startPosition,
    plant,
    quantity,
    bedDimensions,
    gridSize,
    existingPlants,
    planningMethod,
    plantingStyle,
    fillDirection = 'across',
  } = request;

  const positions: { x: number; y: number }[] = [];
  const { gridWidth, gridHeight } = bedDimensions;

  // Calculate required spacing in grid cells
  // plant.spacing is in inches, gridSize is inches per cell
  const plantSpacing = plant.spacing || 12;

  // Dense planting detection: plants with spacing ≤ gridSize can be placed adjacent
  // For SFG (12" grid), plants with 6-12" spacing are "dense" and multiple fit per square
  const isDensePlanting = plantSpacing <= gridSize;

  // For dense plants, allow adjacent placement (distance = 0)
  // Each square will contain multiple plants densely packed WITHIN the square
  // For large plants, maintain spacing between squares
  const requiredDistance = isDensePlanting ? 0 : Math.ceil(plantSpacing / gridSize);

  // Create a set of occupied positions for O(1) lookup
  const occupiedSet = new Set<string>();
  existingPlants.forEach((item) => {
    if (item.position) {
      occupiedSet.add(`${item.position.x},${item.position.y}`);
    }
  });

  /**
   * Check if a position is valid for placement
   */
  const isValidPosition = (x: number, y: number): boolean => {
    // 1. Check bounds
    if (x < 0 || y < 0 || x >= gridWidth || y >= gridHeight) {
      return false;
    }

    // 2. Check if already occupied
    if (occupiedSet.has(`${x},${y}`)) {
      return false;
    }

    // 3. Check spacing conflicts with existing plants (Chebyshev distance)
    for (const existing of existingPlants) {
      if (!existing.position) continue;

      const existingSpacing = Math.ceil((plant.spacing || 12) / gridSize);
      const maxSpacing = Math.max(requiredDistance, existingSpacing);

      // Chebyshev distance: max of absolute differences
      const distance = Math.max(
        Math.abs(existing.position.x - x),
        Math.abs(existing.position.y - y)
      );

      if (distance < maxSpacing) {
        return false; // Too close to existing plant
      }
    }

    // 4. Check spacing conflicts with already-placed positions from this batch
    // Skip spacing check for dense plants (requiredDistance = 0 allows adjacent placement)
    if (requiredDistance > 0) {
      for (const placed of positions) {
        const distance = Math.max(
          Math.abs(placed.x - x),
          Math.abs(placed.y - y)
        );

        if (distance < requiredDistance) {
          return false; // Too close to a position we're about to place
        }
      }
    }

    return true;
  };

  /**
   * Generate candidate positions for MIGardener row-based placement
   * Uses rowSpacing for row-to-row distance and spacing for within-row distance
   */
  const generateMIGardenerCandidates = (): { x: number; y: number }[] => {
    const candidates: { x: number; y: number }[] = [];
    const rowSpacing = plant.rowSpacing || plant.spacing || 12;
    const withinRowSpacing = plant.spacing || 12;

    // Calculate spacing in grid cells
    const rowSpacingCells = Math.max(1, Math.ceil(rowSpacing / gridSize));
    const withinRowSpacingCells = Math.max(1, Math.ceil(withinRowSpacing / gridSize));

    // Determine starting point
    const startX = (startPosition && startPosition.x >= 0 && startPosition.x < gridWidth)
      ? startPosition.x
      : 0;
    const startY = (startPosition && startPosition.y >= 0 && startPosition.y < gridHeight)
      ? startPosition.y
      : 0;

    // Generate positions in horizontal rows
    // Each row is separated by rowSpacingCells
    // Within each row, plants are separated by withinRowSpacingCells
    for (let y = startY; y < gridHeight; y += rowSpacingCells) {
      // For the first row, start from startX; for subsequent rows, start from 0
      const rowStartX = (y === startY) ? startX : 0;

      for (let x = rowStartX; x < gridWidth; x += withinRowSpacingCells) {
        candidates.push({ x, y });
      }
    }

    return candidates;
  };

  /**
   * Generate candidate positions for Intensive/Bio-Intensive hexagonal placement
   * Uses hexagonal packing with 0.866 row offset for maximum efficiency
   */
  const generateIntensiveCandidates = (): { x: number; y: number }[] => {
    const candidates: { x: number; y: number }[] = [];
    const onCenterSpacing = getIntensiveSpacing(plant.id, plant.spacing || 12);

    // Calculate spacing in grid cells
    const colSpacingCells = Math.max(1, Math.ceil(onCenterSpacing / gridSize));
    const rowSpacingCells = Math.max(1, Math.ceil((onCenterSpacing * HEX_ROW_OFFSET) / gridSize));

    // Determine starting point
    const startX = (startPosition && startPosition.x >= 0 && startPosition.x < gridWidth)
      ? startPosition.x
      : 0;
    const startY = (startPosition && startPosition.y >= 0 && startPosition.y < gridHeight)
      ? startPosition.y
      : 0;

    // Generate positions in hexagonal pattern
    // Even rows (0, 2, 4...): Normal positions
    // Odd rows (1, 3, 5...): Offset by half column spacing
    for (let y = startY; y < gridHeight; y += rowSpacingCells) {
      const rowStartX = (y === startY) ? startX : 0;
      const isOddRow = ((y - startY) / rowSpacingCells) % 2 === 1;
      const xOffset = isOddRow ? Math.floor(colSpacingCells / 2) : 0;

      for (let x = rowStartX + xOffset; x < gridWidth; x += colSpacingCells) {
        if (x >= 0 && x < gridWidth) {
          candidates.push({ x, y });
        }
      }
    }

    return candidates;
  };

  /**
   * Generate candidate positions in row-by-row or column-by-column order (generic)
   * @param direction - 'across' for row-major (left-to-right, then down), 'down' for column-major (top-to-bottom, then right)
   */
  const generateCandidates = (direction: FillDirection = 'across'): { x: number; y: number }[] => {
    const candidates: { x: number; y: number }[] = [];

    // Determine starting point
    const startX = (startPosition && startPosition.x >= 0 && startPosition.x < gridWidth)
      ? startPosition.x
      : 0;
    const startY = (startPosition && startPosition.y >= 0 && startPosition.y < gridHeight)
      ? startPosition.y
      : 0;

    if (direction === 'down') {
      // Column-major: fill column top-to-bottom, then next column
      for (let x = startX; x < gridWidth; x++) {
        const startRow = (x === startX) ? startY : 0; // Start from startY only on first column
        for (let y = startRow; y < gridHeight; y++) {
          candidates.push({ x, y });
        }
      }
    } else {
      // Row-major (default): fill row left-to-right, then next row
      for (let y = startY; y < gridHeight; y++) {
        const startCol = (y === startY) ? startX : 0; // Start from startX only on first row
        for (let x = startCol; x < gridWidth; x++) {
          candidates.push({ x, y });
        }
      }
    }

    return candidates;
  };

  // Determine which candidate generation strategy to use
  // Priority: plantingStyle > planningMethod (for backward compatibility)
  let useRowPlacement = false;
  let useIntensivePlacement = false;

  if (plantingStyle) {
    // NEW: Use explicit planting style if provided
    useRowPlacement = plantingStyle === 'row' || plantingStyle === 'trellis_linear';
    useIntensivePlacement = plantingStyle === 'dense_patch';
    // Note: 'broadcast' style typically doesn't use auto-placement
  } else {
    // LEGACY: Fall back to planningMethod-based detection
    useRowPlacement =
      planningMethod === 'migardener' &&
      plant.rowSpacing !== undefined &&
      plant.rowSpacing > 0;
    useIntensivePlacement = planningMethod === 'intensive';
  }

  // Find valid positions using appropriate strategy
  const candidates = useRowPlacement
    ? generateMIGardenerCandidates()
    : useIntensivePlacement
    ? generateIntensiveCandidates()
    : generateCandidates(fillDirection);

  for (const candidate of candidates) {
    if (positions.length >= quantity) {
      break; // We've placed enough plants
    }

    const isValid = isValidPosition(candidate.x, candidate.y);


    if (isValid) {
      positions.push({ x: candidate.x, y: candidate.y });
      // Mark this position as occupied for subsequent checks
      occupiedSet.add(`${candidate.x},${candidate.y}`);
    }
  }

  return {
    positions,
    placed: positions.length,
    failed: quantity - positions.length,
  };
}

/**
 * Calculate how many grid cells a plant requires based on its spacing
 *
 * Uses method-aware calculation based on the bed's planning method:
 * - Square Foot Gardening: Uses SFG rules (tomato = 1 cell)
 * - MIGardener: Uses ultra-dense spacing overrides
 * - Row/Traditional: Uses spacing-based calculation
 *
 * @param plant - Plant to calculate for
 * @param gridSize - Grid cell size in inches (default: 12 for SFG)
 * @param planningMethod - Bed's planning method ('square-foot', 'row', 'migardener', etc.)
 * @returns Number of grid cells needed (as a square area)
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
