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
