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
 * Parameters for bed-type aware footprint checking
 */
export interface FootprintCheckParams {
  targetX: number;
  targetY: number;
  originX: number;
  originY: number;
  spaceRequired: number;
  planningMethod?: string;
  gridSize?: number;
  /** For MIGardener beds: row spacing in inches (null = intensive) */
  rowSpacing?: number | null;
  /** For MIGardener beds: plant spacing in inches */
  plantSpacing?: number;
}

/**
 * Check if a specific cell is within a planting's spacing buffer
 *
 * Uses CIRCULAR SPACING approach: returns true if the target cell's center
 * is within the plant's spacing distance from the origin.
 *
 * @param targetX - X coordinate of the cell to check
 * @param targetY - Y coordinate of the cell to check
 * @param originX - X coordinate of the plant's position (center)
 * @param originY - Y coordinate of the plant's position (center)
 * @param spaceRequired - Number of grid cells needed (1, 4, 9, 16, etc.)
 * @param gridSizeInches - Grid cell size in inches (default 12)
 * @returns true if the target cell is within the spacing buffer
 *
 * @example
 * // Check if cell B1 is within range of a plant at C1 with 24" spacing
 * isCellInFootprint(1, 0, 2, 0, 4, 12) // returns true (B1 is 12" away, within 24")
 */
export function isCellInFootprint(
  targetX: number,
  targetY: number,
  originX: number,
  originY: number,
  spaceRequired: number = 1,
  gridSizeInches: number = 12
): boolean {
  // Convert spaceRequired to spacing in inches
  const cellsPerSide = Math.ceil(Math.sqrt(Math.max(1, spaceRequired)));
  const spacingInches = cellsPerSide * gridSizeInches;

  // Calculate distance from origin to target (in inches)
  const dx = targetX - originX;
  const dy = targetY - originY;
  const distanceInches = Math.sqrt(
    Math.pow(dx * gridSizeInches, 2) +
    Math.pow(dy * gridSizeInches, 2)
  );

  // Cell is in footprint if distance is less than spacing
  return distanceInches < spacingInches;
}

/**
 * Get formatted footprint size for display
 *
 * @param spaceRequired - Number of grid cells needed
 * @returns Human-readable footprint description
 *
 * @example
 * formatFootprintSize(1)  // "1 cell"
 * formatFootprintSize(4)  // "2×2 (4 cells)"
 * formatFootprintSize(9)  // "3×3 (9 cells)"
 */
export function formatFootprintSize(spaceRequired: number): string {
  if (spaceRequired === 1) return "1 cell";

  const cellsPerSide = Math.ceil(Math.sqrt(spaceRequired));
  return `${cellsPerSide}×${cellsPerSide} (${spaceRequired} cells)`;
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
export function calculateFootprint(
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
 * Check if a cell is within a planting's footprint (bed-type aware)
 *
 * Routes to appropriate footprint calculation based on planning method:
 * - Square Foot: Square packing (default)
 * - MIGardener: Row-based (rectangular) or intensive (square) packing
 * - Intensive: Hexagonal pattern approximation
 * - Row/Traditional: Rectangular packing
 *
 * @param params - Footprint check parameters including bed context
 * @returns true if the target cell is within the footprint
 *
 * @example
 * // Check MIGardener row-based planting
 * isCellInFootprintBedAware({
 *   targetX: 2, targetY: 1,
 *   originX: 1, originY: 0,
 *   spaceRequired: 4,
 *   planningMethod: 'migardener',
 *   rowSpacing: 4,
 *   plantSpacing: 1,
 *   gridSize: 3
 * })
 */
export function isCellInFootprintBedAware(params: FootprintCheckParams): boolean {
  const {
    targetX,
    targetY,
    originX,
    originY,
    spaceRequired = 1,
    planningMethod = 'square-foot',
    gridSize = 12,
    rowSpacing,
    plantSpacing
  } = params;

  // Route to appropriate method-specific function
  switch (planningMethod) {
    case 'migardener':
      return isCellInFootprintMIGardener(
        targetX, targetY, originX, originY,
        spaceRequired, rowSpacing, plantSpacing, gridSize
      );

    case 'intensive':
    case 'bio-intensive':
      return isCellInFootprintIntensive(
        targetX, targetY, originX, originY,
        spaceRequired, gridSize
      );

    case 'row':
    case 'traditional':
      // Row-based uses rectangular packing similar to MIGardener row-based
      return isCellInFootprintMIGardener(
        targetX, targetY, originX, originY,
        spaceRequired, rowSpacing, plantSpacing, gridSize
      );

    case 'square-foot':
    default:
      // Default to square packing (existing logic)
      return isCellInFootprint(targetX, targetY, originX, originY, spaceRequired);
  }
}

/**
 * Check if a cell is within a MIGardener planting's footprint
 *
 * MIGardener beds support two planting patterns:
 * - Intensive crops (rowSpacing = null): Square packing like SFG
 * - Row-based crops (rowSpacing > 0): Rectangular packing based on row/plant spacing
 *
 * @param targetX - X coordinate of the cell to check
 * @param targetY - Y coordinate of the cell to check
 * @param originX - X coordinate of the plant's origin position
 * @param originY - Y coordinate of the plant's origin position
 * @param spaceRequired - Number of grid cells needed
 * @param rowSpacing - Row spacing in inches (null = intensive crop)
 * @param plantSpacing - Plant spacing in inches
 * @param gridSize - Grid cell size in inches
 * @returns true if the target cell is within the footprint
 */
function isCellInFootprintMIGardener(
  targetX: number,
  targetY: number,
  originX: number,
  originY: number,
  spaceRequired: number,
  rowSpacing: number | null | undefined,
  plantSpacing: number | undefined,
  gridSize: number
): boolean {
  // Intensive crops (null rowSpacing): use square packing
  if (!rowSpacing || rowSpacing === 0) {
    return isCellInFootprint(targetX, targetY, originX, originY, spaceRequired);
  }

  // Row-based crops: use rectangular packing
  // Check if we have the spacing data needed
  if (!plantSpacing) {
    // Fallback to square packing if spacing data missing
    return isCellInFootprint(targetX, targetY, originX, originY, spaceRequired);
  }

  // Calculate row and column dimensions
  const rowSpacingInCells = Math.ceil(rowSpacing / gridSize);
  const plantSpacingInCells = Math.ceil(plantSpacing / gridSize);

  // Estimate rows and columns from spaceRequired
  // For row-based: spaceRequired ≈ (rows × rowSpacing × cols × plantSpacing) / gridSize²
  // We approximate by assuming the footprint tries to maintain aspect ratio
  const totalArea = spaceRequired; // in grid cells
  const aspectRatio = rowSpacingInCells / plantSpacingInCells;

  let numRows: number;
  let numCols: number;

  if (aspectRatio >= 1) {
    // Wider rows than columns
    numCols = Math.max(1, Math.ceil(Math.sqrt(totalArea / aspectRatio)));
    numRows = Math.max(1, Math.ceil(totalArea / numCols));
  } else {
    // More rows than columns
    numRows = Math.max(1, Math.ceil(Math.sqrt(totalArea * aspectRatio)));
    numCols = Math.max(1, Math.ceil(totalArea / numRows));
  }

  // Center-based expansion for row crops too
  const offsetX = Math.floor(numCols / 2);
  const offsetY = Math.floor(numRows / 2);
  const startX = originX - offsetX;
  const startY = originY - offsetY;

  // Check if target cell is within the rectangular footprint (centered)
  return (
    targetX >= startX &&
    targetX < startX + numCols &&
    targetY >= startY &&
    targetY < startY + numRows
  );
}

/**
 * Check if a cell is within an Intensive/Bio-Intensive planting's footprint
 *
 * Intensive beds use hexagonal packing, which is more efficient than square packing.
 * We approximate the hexagonal footprint on the square grid.
 *
 * @param targetX - X coordinate of the cell to check
 * @param targetY - Y coordinate of the cell to check
 * @param originX - X coordinate of the plant's origin position
 * @param originY - Y coordinate of the plant's origin position
 * @param spaceRequired - Number of grid cells needed
 * @param gridSize - Grid cell size in inches
 * @returns true if the target cell is within the footprint
 */
function isCellInFootprintIntensive(
  targetX: number,
  targetY: number,
  originX: number,
  originY: number,
  spaceRequired: number,
  gridSize: number
): boolean {
  // For intensive beds, we approximate hexagonal packing with square packing
  // The spaceRequired should already account for hexagonal efficiency
  // (calculated via calculateIntensiveCellsRequired in spaceAvailability.ts)

  // Use standard square packing as approximation
  return isCellInFootprint(targetX, targetY, originX, originY, spaceRequired);
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
