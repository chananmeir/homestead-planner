/**
 * Footprint Calculator Utility
 *
 * Calculates the spatial footprint (occupied cells) for plants in garden bed grids.
 * Uses a CIRCULAR SPACING BUFFER approach - shows all cells within the plant's
 * spacing distance from the origin, just like how plants actually grow and
 * spread in a real garden.
 *
 * Key concept: If a plant has 24" spacing, no other plant should be within 24"
 * of its center. This utility calculates which grid cells fall within that zone.
 */

export interface FootprintCell {
  x: number;
  y: number;
  distanceFromOrigin?: number; // Distance in inches from the plant center
}

/**
 * Calculate all cells within a plant's spacing buffer (circular zone)
 *
 * Uses CIRCULAR SPACING approach: returns all cells whose center is within
 * the plant's spacing distance from the origin. This matches how plants
 * actually grow - spreading in ALL directions from where they're planted.
 *
 * @param originX - X coordinate of the plant's position (center)
 * @param originY - Y coordinate of the plant's position (center)
 * @param spacingInches - Plant spacing in inches (e.g., 24 for squash)
 * @param gridSizeInches - Grid cell size in inches (default 12 for SFG)
 * @returns Array of all cells within the spacing buffer
 *
 * @example
 * // Get all cells for a plant at C1 (x=2, y=0) with 24" spacing in 12" grid
 * calculateSpacingBuffer(2, 0, 24, 12)
 * // Returns cells within 24" of C1: B0, C0, D0, B1, C1, D1, B2, C2, D2
 */
export function calculateSpacingBuffer(
  originX: number,
  originY: number,
  spacingInches: number,
  gridSizeInches: number = 12
): FootprintCell[] {
  const cells: FootprintCell[] = [];

  // Calculate how many cells we need to check in each direction
  // Add 1 to ensure we catch edge cases
  const cellsToCheck = Math.ceil(spacingInches / gridSizeInches) + 1;

  for (let dx = -cellsToCheck; dx <= cellsToCheck; dx++) {
    for (let dy = -cellsToCheck; dy <= cellsToCheck; dy++) {
      const cellX = originX + dx;
      const cellY = originY + dy;

      // Skip cells with negative coordinates (outside grid)
      if (cellX < 0 || cellY < 0) continue;

      // Calculate distance from origin cell center to this cell's center (in inches)
      const distanceInches = Math.sqrt(
        Math.pow(dx * gridSizeInches, 2) +
        Math.pow(dy * gridSizeInches, 2)
      );

      // Include cell if it's within the spacing distance
      // Use < (not <=) because spacing is the minimum distance BETWEEN plants
      if (distanceInches < spacingInches) {
        cells.push({
          x: cellX,
          y: cellY,
          distanceFromOrigin: distanceInches
        });
      }
    }
  }

  return cells;
}

/**
 * Calculate all cells occupied by a planting's footprint
 *
 * This is a convenience wrapper that converts spaceRequired (cells) to
 * spacing (inches) and calls calculateSpacingBuffer.
 *
 * @param originX - X coordinate of the plant's position (center)
 * @param originY - Y coordinate of the plant's position (center)
 * @param spaceRequired - Number of grid cells needed (1, 4, 9, etc.)
 * @param gridSizeInches - Grid cell size in inches (default 12)
 * @returns Array of all cells within the spacing buffer
 */
function calculateFootprint(
  originX: number,
  originY: number,
  spaceRequired: number = 1,
  gridSizeInches: number = 12
): FootprintCell[] {
  // Convert spaceRequired (cells) to approximate spacing (inches)
  // spaceRequired of 4 cells = 2x2 = plant needs ~24" spacing
  // spaceRequired of 9 cells = 3x3 = plant needs ~36" spacing
  const cellsPerSide = Math.ceil(Math.sqrt(Math.max(1, spaceRequired)));
  const spacingInches = cellsPerSide * gridSizeInches;

  return calculateSpacingBuffer(originX, originY, spacingInches, gridSizeInches);
}

/**
 * Calculate all cells occupied by a planting's footprint (bed-type aware)
 *
 * @param originX - X coordinate of the plant's origin position
 * @param originY - Y coordinate of the plant's origin position
 * @param spaceRequired - Number of grid cells needed
 * @param planningMethod - Bed planning method ('square-foot', 'migardener', 'intensive', etc.)
 * @param gridSize - Grid cell size in inches
 * @param rowSpacing - For MIGardener: row spacing in inches (null = intensive)
 * @param plantSpacing - For MIGardener: plant spacing in inches
 * @returns Array of all occupied cell coordinates
 *
 * @example
 * // Square Foot bed
 * calculateFootprintBedAware(1, 0, 4, 'square-foot', 12)
 * // Returns: [{x:1,y:0}, {x:2,y:0}, {x:1,y:1}, {x:2,y:1}]
 */
export function calculateFootprintBedAware(
  originX: number,
  originY: number,
  spaceRequired: number = 1,
  planningMethod: string = 'square-foot',
  gridSize: number = 12,
  rowSpacing?: number | null,
  plantSpacing?: number
): FootprintCell[] {
  const cells: FootprintCell[] = [];

  // Sanitize input
  const sanitized = Math.max(1, Math.floor(spaceRequired));

  // Route based on planning method
  switch (planningMethod) {
    case 'migardener': {
      // Intensive crops: use square packing
      if (!rowSpacing || rowSpacing === 0) {
        return calculateFootprint(originX, originY, sanitized);
      }

      // Row-based crops: calculate rectangular footprint
      if (!plantSpacing) {
        return calculateFootprint(originX, originY, sanitized);
      }

      const rowSpacingInCells = Math.ceil(rowSpacing / gridSize);
      const plantSpacingInCells = Math.ceil(plantSpacing / gridSize);

      const totalArea = sanitized;
      const aspectRatio = rowSpacingInCells / plantSpacingInCells;

      let numRows: number;
      let numCols: number;

      if (aspectRatio >= 1) {
        numCols = Math.max(1, Math.ceil(Math.sqrt(totalArea / aspectRatio)));
        numRows = Math.max(1, Math.ceil(totalArea / numCols));
      } else {
        numRows = Math.max(1, Math.ceil(Math.sqrt(totalArea * aspectRatio)));
        numCols = Math.max(1, Math.ceil(totalArea / numRows));
      }

      // Center-based expansion for row crops too
      const offsetX = Math.floor(numCols / 2);
      const offsetY = Math.floor(numRows / 2);
      const startX = originX - offsetX;
      const startY = originY - offsetY;

      for (let dx = 0; dx < numCols; dx++) {
        for (let dy = 0; dy < numRows; dy++) {
          const cellX = startX + dx;
          const cellY = startY + dy;
          if (cellX >= 0 && cellY >= 0) {
            cells.push({ x: cellX, y: cellY });
          }
        }
      }

      return cells;
    }

    case 'intensive':
    case 'bio-intensive':
    case 'row':
    case 'traditional':
    case 'square-foot':
    default:
      // Use standard square packing
      return calculateFootprint(originX, originY, sanitized);
  }
}
