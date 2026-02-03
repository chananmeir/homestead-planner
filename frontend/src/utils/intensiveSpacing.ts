/**
 * Intensive/Bio-Intensive Spacing Utilities
 *
 * Handles spacing calculations for bio-intensive gardening method pioneered by
 * John Jeavons and Ecology Action. Uses hexagonal (offset) planting pattern for
 * maximum space efficiency and plant health.
 *
 * Key Principles:
 * - Hexagonal packing: Each plant has 6 neighbors instead of 4 (square grid)
 * - Offset rows: Row 2 is offset by 0.866 × spacing from row 1
 * - On-center spacing: Single value represents distance between any two adjacent plants
 * - ~15% more plants per area than square spacing
 */

/**
 * Intensive spacing overrides (in inches) - on-center spacing for hexagonal packing
 * Based on John Jeavons' "How to Grow More Vegetables" spacing recommendations
 *
 * These values represent the distance from the center of one plant to the center
 * of its neighbor in a hexagonal pattern.
 */
export const INTENSIVE_SPACING_OVERRIDES: Record<string, number> = {
  // Fruiting crops - need airflow and space
  'tomato-1': 18,
  'pepper-1': 12,
  'eggplant-1': 18,

  // Brassicas - heading types
  'broccoli-1': 15,
  'cauliflower-1': 15,
  'cabbage-1': 15,
  'kale-1': 12,

  // Leafy greens
  'lettuce-1': 8,
  'spinach-1': 6,
  'chard-1': 8,
  'arugula-1': 4,

  // Root vegetables
  'carrot-1': 3,
  'beet-1': 4,
  'radish-1': 2,
  'onion-1': 4,
  'garlic-1': 6,
  'potato-1': 10,

  // Legumes
  'bean-1': 6,      // Bush beans
  'pea-1': 4,

  // Cucurbits
  'squash-1': 24,
  'cucumber-1': 12,
  'melon-1': 18,

  // Grains
  'corn-1': 15,

  // Herbs
  'basil-1': 8,
  'parsley-1': 6,

  // Flowers
  'marigold-1': 8,
  'nasturtium-1': 10,
};

/**
 * Hexagonal packing efficiency constant
 * In hexagonal packing, rows are offset by √3/2 ≈ 0.866 of the spacing
 * This allows plants to fit in the "valleys" between plants in the previous row
 */
export const HEX_ROW_OFFSET = Math.sqrt(3) / 2; // ≈ 0.866

/**
 * Get intensive spacing for a plant
 *
 * @param plantId - The plant ID to look up
 * @param standardSpacing - The plant's standard spacing from database (fallback)
 * @returns On-center spacing in inches for hexagonal packing
 */
export function getIntensiveSpacing(plantId: string, standardSpacing: number): number {
  // Check for specific override first
  if (INTENSIVE_SPACING_OVERRIDES[plantId]) {
    return INTENSIVE_SPACING_OVERRIDES[plantId];
  }

  // Fallback to standard spacing (close spacing is key to bio-intensive)
  // Use the tighter dimension for hexagonal packing
  return standardSpacing;
}

/**
 * Calculate how many plants fit in a row with hexagonal packing
 *
 * @param bedLengthFeet - Length of the bed in feet
 * @param onCenterSpacing - On-center spacing in inches
 * @returns Number of plants that fit in one row
 */
export function calculateIntensivePlantsPerRow(
  bedLengthFeet: number,
  onCenterSpacing: number
): number {
  const bedLengthInches = bedLengthFeet * 12;
  return Math.floor(bedLengthInches / onCenterSpacing);
}

/**
 * Calculate how many rows fit in a bed with hexagonal packing
 *
 * In hexagonal packing, rows are offset vertically by 0.866 × spacing
 * This is more efficient than square packing (1.0 × spacing)
 *
 * @param bedWidthFeet - Width of the bed in feet
 * @param onCenterSpacing - On-center spacing in inches
 * @returns Number of rows that fit in the bed
 */
export function calculateIntensiveRows(
  bedWidthFeet: number,
  onCenterSpacing: number
): number {
  const bedWidthInches = bedWidthFeet * 12;
  const rowSpacing = onCenterSpacing * HEX_ROW_OFFSET;
  return Math.floor(bedWidthInches / rowSpacing);
}

/**
 * Calculate total plants for a bed using hexagonal packing
 *
 * Accounts for offset rows where even rows may have one fewer plant
 *
 * @param bedWidthFeet - Width of the bed in feet
 * @param bedLengthFeet - Length of the bed in feet
 * @param plantId - The plant ID
 * @param standardSpacing - The plant's standard spacing from database
 * @returns Total number of plants that fit in the bed
 */
export function calculateIntensivePlantsPerBed(
  bedWidthFeet: number,
  bedLengthFeet: number,
  plantId: string,
  standardSpacing: number
): number {
  const onCenterSpacing = getIntensiveSpacing(plantId, standardSpacing);

  const plantsPerRow = calculateIntensivePlantsPerRow(bedLengthFeet, onCenterSpacing);
  const numRows = calculateIntensiveRows(bedWidthFeet, onCenterSpacing);

  // In hexagonal packing, alternating rows may be offset
  // Odd rows: full plants per row
  // Even rows: may have one fewer plant if they're offset by half-spacing
  // For simplicity, we'll use plantsPerRow × numRows as an approximation
  // (More precise calculation would alternate between plantsPerRow and plantsPerRow-1)

  return plantsPerRow * numRows;
}

/**
 * Calculate cells required for intensive spacing on a square grid
 *
 * Since the UI uses a square grid but intensive uses hexagonal packing,
 * we need to approximate the hexagonal area on the square grid.
 *
 * Hexagonal packing is ~15% more efficient than square packing,
 * so we reduce the cell requirement accordingly.
 *
 * @param onCenterSpacing - On-center spacing in inches
 * @param gridSize - Grid cell size in inches
 * @returns Number of grid cells required (approximate)
 */
export function calculateIntensiveCellsRequired(
  onCenterSpacing: number,
  gridSize: number
): number {
  // Base calculation: square grid cells
  const cellsPerSide = Math.ceil(onCenterSpacing / gridSize);
  const squareCells = cellsPerSide * cellsPerSide;

  // Hexagonal packing efficiency factor
  // Hex packing fits ~1.15× more plants in same area, so each plant needs ~0.87× the cells
  const hexEfficiency = 1 / 1.15;

  return Math.max(1, Math.ceil(squareCells * hexEfficiency));
}

/**
 * Check if a row is offset in hexagonal packing
 *
 * @param rowIndex - Zero-based row index
 * @returns True if this row should be offset (even rows are offset)
 */
export function isOffsetRow(rowIndex: number): boolean {
  return rowIndex % 2 === 1; // Offset every other row (0-indexed)
}

/**
 * Calculate X offset for a plant position in hexagonal packing
 *
 * @param rowIndex - Zero-based row index
 * @param onCenterSpacing - On-center spacing in inches
 * @returns X offset in inches (0 for odd rows, spacing/2 for even rows)
 */
export function getHexagonalXOffset(rowIndex: number, onCenterSpacing: number): number {
  return isOffsetRow(rowIndex) ? onCenterSpacing / 2 : 0;
}

/**
 * Calculate grid position for hexagonal packing
 *
 * Converts hexagonal packing coordinates to square grid coordinates
 *
 * @param rowIndex - Zero-based row index in hex pattern
 * @param colIndex - Zero-based column index in hex pattern
 * @param onCenterSpacing - On-center spacing in inches
 * @param gridSize - Grid cell size in inches
 * @returns Grid coordinates { x, y }
 */
export function hexToGridPosition(
  rowIndex: number,
  colIndex: number,
  onCenterSpacing: number,
  gridSize: number
): { x: number; y: number } {
  // Calculate actual position in inches
  const xInches = colIndex * onCenterSpacing + getHexagonalXOffset(rowIndex, onCenterSpacing);
  const yInches = rowIndex * onCenterSpacing * HEX_ROW_OFFSET;

  // Convert to grid coordinates
  const x = Math.floor(xInches / gridSize);
  const y = Math.floor(yInches / gridSize);

  return { x, y };
}
