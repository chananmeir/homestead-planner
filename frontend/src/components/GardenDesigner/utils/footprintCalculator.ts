/**
 * Footprint Calculator Utility
 *
 * Calculates the spatial footprint (occupied cells) for multi-square plants
 * in garden bed grids. Used to determine if a cell will be occupied by a
 * future planting, even if it's not the plant's origin position.
 *
 * Supports bed-type aware footprint calculations:
 * - Square Foot: Square packing (default)
 * - MIGardener: Row-based or intensive packing
 * - Intensive: Hexagonal packing approximation
 * - Row/Traditional: Rectangular packing
 */

export interface FootprintCell {
  x: number;
  y: number;
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
 * Check if a specific cell is within a planting's footprint
 *
 * @param targetX - X coordinate of the cell to check
 * @param targetY - Y coordinate of the cell to check
 * @param originX - X coordinate of the plant's origin position
 * @param originY - Y coordinate of the plant's origin position
 * @param spaceRequired - Number of grid cells needed (1, 4, 9, 16, etc.)
 * @returns true if the target cell is within the footprint
 *
 * @example
 * // Check if cell C2 is occupied by a 2x2 plant at B1
 * isCellInFootprint(2, 1, 1, 0, 4) // returns true
 */
export function isCellInFootprint(
  targetX: number,
  targetY: number,
  originX: number,
  originY: number,
  spaceRequired: number = 1
): boolean {
  const cellsPerSide = Math.ceil(Math.sqrt(spaceRequired));

  return (
    targetX >= originX &&
    targetX < originX + cellsPerSide &&
    targetY >= originY &&
    targetY < originY + cellsPerSide
  );
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
 * Calculate all cells occupied by a planting's footprint
 *
 * @param originX - X coordinate of the plant's origin position
 * @param originY - Y coordinate of the plant's origin position
 * @param spaceRequired - Number of grid cells needed (sanitized to minimum 1)
 * @returns Array of all occupied cell coordinates
 *
 * @example
 * // Get all cells for a 2x2 plant at B1 (1, 0)
 * calculateFootprint(1, 0, 4)
 * // Returns: [{x:1,y:0}, {x:2,y:0}, {x:1,y:1}, {x:2,y:1}]
 */
export function calculateFootprint(
  originX: number,
  originY: number,
  spaceRequired: number = 1
): FootprintCell[] {
  const cells: FootprintCell[] = [];

  // Sanitize input to ensure valid positive integer
  const sanitized = Math.max(1, Math.floor(spaceRequired));
  const cellsPerSide = Math.ceil(Math.sqrt(sanitized));

  for (let dx = 0; dx < cellsPerSide; dx++) {
    for (let dy = 0; dy < cellsPerSide; dy++) {
      cells.push({
        x: originX + dx,
        y: originY + dy
      });
    }
  }

  return cells;
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

  // Check if target cell is within the rectangular footprint
  return (
    targetX >= originX &&
    targetX < originX + numCols &&
    targetY >= originY &&
    targetY < originY + numRows
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

      for (let dx = 0; dx < numCols; dx++) {
        for (let dy = 0; dy < numRows; dy++) {
          cells.push({ x: originX + dx, y: originY + dy });
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
