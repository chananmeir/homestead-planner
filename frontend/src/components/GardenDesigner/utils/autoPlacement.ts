import { Plant, PlantedItem } from '../../../types';

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
 * Auto-place multiple plants in a garden bed using row-by-row pattern.
 *
 * Strategy:
 * 1. Calculate required spacing based on plant.spacing and gridSize
 * 2. Generate candidate positions in row-by-row order (left-to-right, top-to-bottom)
 * 3. Validate each candidate (bounds, spacing conflicts, occupancy)
 * 4. Return positions until quantity is reached or no more valid positions
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
  } = request;

  const positions: { x: number; y: number }[] = [];
  const { gridWidth, gridHeight } = bedDimensions;

  // Calculate required spacing in grid cells
  // plant.spacing is in inches, gridSize is inches per cell
  const plantSpacing = plant.spacing || 12;
  const requiredDistance = Math.ceil(plantSpacing / gridSize);

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
    for (const placed of positions) {
      const distance = Math.max(
        Math.abs(placed.x - x),
        Math.abs(placed.y - y)
      );

      if (distance < requiredDistance) {
        return false; // Too close to a position we're about to place
      }
    }

    return true;
  };

  /**
   * Generate candidate positions in row-by-row order
   */
  const generateCandidates = (): { x: number; y: number }[] => {
    const candidates: { x: number; y: number }[] = [];

    // Determine starting point
    let startX = 0;
    let startY = 0;

    if (startPosition &&
        startPosition.x >= 0 &&
        startPosition.x < gridWidth &&
        startPosition.y >= 0 &&
        startPosition.y < gridHeight) {
      startX = startPosition.x;
      startY = startPosition.y;
    }

    // Generate positions starting from (startX, startY), wrapping around
    // Row-by-row pattern: left to right, top to bottom
    for (let offsetY = 0; offsetY < gridHeight; offsetY++) {
      for (let offsetX = 0; offsetX < gridWidth; offsetX++) {
        const x = (startX + offsetX) % gridWidth;
        const y = (startY + offsetY) % gridHeight;

        // Avoid duplicates at the wrap-around point
        if (offsetY === 0 && offsetX === 0 && (startX !== 0 || startY !== 0)) {
          continue;
        }

        candidates.push({ x, y });
      }
    }

    return candidates;
  };

  // Find valid positions
  const candidates = generateCandidates();

  for (const candidate of candidates) {
    if (positions.length >= quantity) {
      break; // We've placed enough plants
    }

    if (isValidPosition(candidate.x, candidate.y)) {
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
 * @param plant - Plant to calculate for
 * @param gridSize - Grid cell size in inches (default: 12 for SFG)
 * @returns Number of grid cells needed (as a square area)
 */
export function calculateSpaceRequirement(
  plant: Plant,
  gridSize: number = 12
): number {
  const spacing = plant.spacing || 12; // Default to 12" if not specified
  const cellsPerSide = Math.ceil(spacing / gridSize);
  return cellsPerSide * cellsPerSide;
}
