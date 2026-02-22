/**
 * MIGardener Spacing Utilities
 *
 * Handles spacing calculations for Luke Marion's high-intensity gardening method.
 * MIGardener uses much tighter spacing than traditional gardening, based on
 * direct-seeding and natural plant self-thinning.
 */

/**
 * MIGardener-specific spacing overrides (in inches)
 * Based on Luke Marion's high-intensity direct-seed method
 *
 * Format: [rowSpacing, plantSpacing]
 * - rowSpacing: inches between rows (null = no row restriction, intensive planting)
 * - plantSpacing: inches between plants within a row
 *
 * Example: Lettuce [null, 4]
 * - null rowSpacing = intensive planting, no row restrictions (leaf crops)
 * - 4" between plants (after self-thinning from dense seeding)
 */
export const MIGARDENER_SPACING_OVERRIDES: Record<string, [number | null, number]> = {
  // Leafy Greens - Intensive planting for continuous leaf harvest (no row restrictions)
  'lettuce-1': [4, 1],      // Row-based seeding: 4" row spacing, 1" seed spacing (36 seeds/sqft)
  'arugula-1': [4, 1],      // Row-based seeding: 4" row spacing, 1" seed spacing (36 seeds/sqft)
  'spinach-1': [null, 4],   // Intensive: 4" plant spacing, no row limit
  'kale-1': [null, 8],      // Intensive: 8" plant spacing for leaf harvest, no row limit
  'chard-1': [null, 9],     // Intensive: 9" plant spacing, no row limit
  'mustard-1': [null, 3],   // Intensive: 3" plant spacing, no row limit
  'bok-choy-1': [8, 6],     // Needs space for head formation (traditional row spacing)

  // Brassicas - Heading Types (need space for head development)
  'cabbage-1': [18, 12],    // Leaves should slightly overlap
  'broccoli-1': [18, 12],   // Space for head development
  'cauliflower-1': [18, 12],// Space for head development
  'brussels-sprouts-1': [24, 18], // Vertical growth, needs air circulation

  // Root Vegetables & Tubers - Dense sowing, then thin
  'radish-1': [4, 1],       // Sow 1" apart, thin to 1-1.5" (36/sqft)
  'carrot-1': [6, 2],       // Sow densely, thin to 1.5-2" when 3-4 weeks old
  'beet-1': [12, 3],        // 3" for high-density (smaller beets), 4" for larger bulbs
  'turnip-1': [8, 3],       // Similar to beets
  'parsnip-1': [12, 3],     // Long roots, needs depth more than width
  'onion-1': [4, 4],        // 3-4" on center for medium bulbs, weed suppression
  'scallion-1': [4, 2],     // Green onions can be denser
  // Tubers - High-density spacing
  'potato-1': [20, 9],      // 20" rows (7 per 12' bed), 9" in-row - Luke Marion reference

  // Nightshade Family
  'tomato-1': [24, 18],      // 18" between plants, 24" rows - tighter than traditional but needs airflow
  'pepper-1': [21, 18],      // 18" minimum spacing (Luke Marion rule), ~21" rows
  'eggplant-1': [18, 15],    // 15" standard spacing (12-18" range), 18" rows

  // Cucumber Family
  'cucumber-1': [18, 12],             // Generic cucumber: bush spacing as safe default
  'cucumber-wisconsin-smr-pickling': [18, 12],  // Pickling variety: bush spacing
  'cucumber-bush-1': [18, 12],        // Bush: 12" spacing, compact varieties
  'cucumber-vining-trellised-1': [24, 18],  // Trellised: 18" minimum, airflow critical
  'cucumber-vining-ground-1': [48, 36],     // Ground: 36" (3 ft) MINIMUM - airflow for disease prevention

  // Melons & Large Crops
  'watermelon-1': [72, 60],  // 60" (5 ft) NON-NEGOTIABLE - "garden hog" (25 sq ft per plant)
  'okra-1': [18, 10],        // 10" spacing, tall/spindly, minimal horizontal spread

  // Grains & Block Crops
  'corn-1': [12, 6],         // 6" spacing, requires 4×4 ft minimum block for pollination
  'sunflower-single-headed-1': [18, 15],  // 15" spacing (12-18" range), giant varieties
  'peanut-1': [24, 18],      // 18" minimum, wide spacing for stem sprawl

  // Leafy Discretes & Root Vegetables
  'swiss-chard-1': [12, 9],  // 9" spacing (8-10" range), discrete plants not row-based
  'celery-1': [18, 12],      // 12" spacing, transplants only

  // Legumes - Closer than traditional methods
  'pea-1': [60, 1.5],       // Can sow 1-2" apart in 3" band at trellis base; 48-72" between rows
  'bean-1': [18, 5.5],      // Bush beans: 4-7" between plants, 18" row gap for airflow
  'bean-bush-1': [18, 6],   // Bush beans: 6" final spacing, 18" row spacing for airflow
  'bean-pole-1': [18, 6],   // Pole beans: 6" final spacing, 18" row spacing for airflow
  'pole-beans-1': [36, 6],  // Pole beans: 6" spacing on trellis, 36" row spacing

  // Perennial & Long-Cycle Crops
  'asparagus-1': [12, 8],    // 8" spacing (7-8" range), crown at soil line
  'artichoke-1': [48, 36],   // 36" spacing, large perennial, 2.5-3 ft wide
  'ginger-1': [30, 24],      // 24" spacing (18-24" range), spreads sideways not down
  'grape-1': [72, 60],       // 60" (5 ft) linear trellis allocation per vine
  'blackberry-1': [96, 36],  // 36" between canes, 96" between rows for access
  'raspberry-1': [72, 24],   // 24" between canes, 72" between rows
  'fig-1': [78, 66],         // 66" spacing (5-6 ft range), very wide canopy
  'goji-berry-1': [36, 30],  // 30" spacing (2-3 ft range), tall/floppy/wide

  // Shallots
  'shallot-from-sets': [12, 10],  // 10" spacing (8-10" range), cluster bulb formation
  'shallot-from-seed': [6, 3],    // 3" spacing (2-3" range), single bulb production

  // Herbs - Varies by use (microgreens vs. mature plants)
  'cilantro-1': [4, 2],     // Dense for microgreens/baby leaves
  'basil-1': [12, 8],       // Needs air circulation, 6-10" spacing
  'parsley-1': [8, 4],      // Moderate density
  'dill-1': [12, 6],        // Needs space for feathery growth
  'bee-balm-1': [30, 24],   // 24" spacing, spreads over time (mint family)
};

/**
 * Fallback multiplier for crops without specific MIGardener overrides
 * Applies a 4:1 density increase to standard spacing
 *
 * Example: Plant with 8" standard spacing → 8" × 0.25 = 2" MIGardener spacing
 */
export const MIGARDENER_DEFAULT_MULTIPLIER = 0.25;

/**
 * Calculate spacing for a plant in MIGardener bed
 *
 * @param plantId - The plant ID to look up
 * @param standardSpacing - The plant's standard within-row spacing from database
 * @param standardRowSpacing - The plant's standard row-to-row spacing from database
 * @returns Object with rowSpacing (null for intensive crops) and plantSpacing in inches
 */
export function getMIGardenerSpacing(
  plantId: string,
  standardSpacing: number,
  standardRowSpacing?: number
): { rowSpacing: number | null; plantSpacing: number } {
  // Check for specific override first
  if (MIGARDENER_SPACING_OVERRIDES[plantId]) {
    const [rowSpacing, plantSpacing] = MIGARDENER_SPACING_OVERRIDES[plantId];
    return { rowSpacing, plantSpacing };
  }

  // Fall back to applying multiplier to standard spacing
  const plantSpacing = standardSpacing * MIGARDENER_DEFAULT_MULTIPLIER;
  const rowSpacing = standardRowSpacing
    ? standardRowSpacing * MIGARDENER_DEFAULT_MULTIPLIER
    : standardSpacing; // If no rowSpacing provided, use standard spacing

  return { rowSpacing, plantSpacing };
}

/**
 * Calculate how many plants fit in a row for MIGardener bed
 *
 * @param bedLengthFeet - Length of the bed in feet (horizontal dimension)
 * @param plantId - The plant ID
 * @param standardSpacing - The plant's standard spacing from database
 * @param standardRowSpacing - The plant's standard row spacing from database
 * @returns Number of plants that fit in one row
 */
export function calculateMIGardenerPlantsPerRow(
  bedLengthFeet: number,
  plantId: string,
  standardSpacing: number,
  standardRowSpacing?: number
): number {
  const bedLengthInches = bedLengthFeet * 12;
  const spacing = getMIGardenerSpacing(plantId, standardSpacing, standardRowSpacing);
  return Math.floor(bedLengthInches / spacing.plantSpacing);
}

/**
 * Calculate how many rows fit in a MIGardener bed
 *
 * @param bedWidthFeet - Width of the bed in feet (vertical dimension)
 * @param plantId - The plant ID
 * @param standardSpacing - The plant's standard spacing from database
 * @param standardRowSpacing - The plant's standard row spacing from database
 * @returns Number of rows that fit in the bed
 */
export function calculateMIGardenerRows(
  bedWidthFeet: number,
  plantId: string,
  standardSpacing: number,
  standardRowSpacing?: number
): number {
  const spacing = getMIGardenerSpacing(plantId, standardSpacing, standardRowSpacing);

  // If rowSpacing is null or 0, this is an intensive crop with no row restrictions
  // Return maximum grid rows based on bed width and default grid size (3")
  if (!spacing.rowSpacing || spacing.rowSpacing === 0) {
    const bedWidthInches = bedWidthFeet * 12;
    const gridSize = 3; // Default grid size in inches
    return Math.floor(bedWidthInches / gridSize);
  }

  // Traditional row-based crops: calculate based on row spacing
  const bedWidthInches = bedWidthFeet * 12;
  return Math.floor(bedWidthInches / spacing.rowSpacing);
}

/**
 * Convert display row index to physical MIGardener row number
 * Snaps to nearest valid row based on plant's row spacing
 *
 * @param displayRowIndex - Visual row from UI (1, 2, 3, 4, 5...)
 * @param rowSpacingInches - Plant's row spacing (e.g., 4" for lettuce), null for intensive crops
 * @param gridSize - Bed's grid size (e.g., 3")
 * @returns Object with physical row number and snapped display row
 *
 * @example
 * // Intensive crop (null spacing) - 1:1 mapping, no snapping
 * displayRowToPhysicalRow(1, null, 3) // { physicalRowNumber: 1, snappedDisplayRow: 1 }
 * displayRowToPhysicalRow(5, null, 3) // { physicalRowNumber: 5, snappedDisplayRow: 5 }
 * // Lettuce with 4" spacing on 3" grid
 * displayRowToPhysicalRow(1, 4, 3) // { physicalRowNumber: 1, snappedDisplayRow: 1 }
 * displayRowToPhysicalRow(2, 4, 3) // { physicalRowNumber: 1, snappedDisplayRow: 1 } - snaps to row 1
 * displayRowToPhysicalRow(3, 4, 3) // { physicalRowNumber: 2, snappedDisplayRow: 3 }
 */
export function displayRowToPhysicalRow(
  displayRowIndex: number,
  rowSpacingInches: number | null,
  gridSize: number
): {
  physicalRowNumber: number;
  snappedDisplayRow: number;
} {
  // Intensive crops (no row spacing): 1:1 mapping, no snapping
  if (rowSpacingInches === null || rowSpacingInches === 0) {
    return {
      physicalRowNumber: displayRowIndex,
      snappedDisplayRow: displayRowIndex,
    };
  }

  const rowSpacingInCells = Math.ceil(rowSpacingInches / gridSize);

  // Snap to nearest valid display row
  const snappedDisplayRow = 1 + Math.floor((displayRowIndex - 1) / rowSpacingInCells) * rowSpacingInCells;

  // Convert to physical row number
  const physicalRowNumber = 1 + Math.floor((snappedDisplayRow - 1) / rowSpacingInCells);

  return { physicalRowNumber, snappedDisplayRow };
}

/**
 * Convert physical row number back to display row index
 * Used by Row Planner to show which visual row contains a physical row
 *
 * @param physicalRowNumber - Physical MIGardener row (1, 2, 3...)
 * @param rowSpacingInches - Plant's row spacing (e.g., 4" for lettuce), null for intensive crops
 * @param gridSize - Bed's grid size (e.g., 3")
 * @returns Display row index
 *
 * @example
 * // Intensive crop (null spacing) - 1:1 mapping
 * physicalRowToDisplayRow(1, null, 3) // 1
 * physicalRowToDisplayRow(5, null, 3) // 5
 * // Physical row 1 appears at display row 1
 * physicalRowToDisplayRow(1, 4, 3) // 1
 * // Physical row 2 appears at display row 3 (with 4" spacing on 3" grid)
 * physicalRowToDisplayRow(2, 4, 3) // 3
 */
export function physicalRowToDisplayRow(
  physicalRowNumber: number,
  rowSpacingInches: number | null,
  gridSize: number
): number {
  // Intensive crops (no row spacing): 1:1 mapping
  if (rowSpacingInches === null || rowSpacingInches === 0) {
    return physicalRowNumber;
  }

  const rowSpacingInCells = Math.ceil(rowSpacingInches / gridSize);
  return 1 + (physicalRowNumber - 1) * rowSpacingInCells;
}

/**
 * Convert physical MIGardener row to grid Y coordinate
 * Maps physical rows to their grid positions for rendering
 *
 * @param physicalRowNumber - Physical MIGardener row (1, 2, 3...)
 * @param rowSpacingInches - Plant's row spacing (e.g., 4" for lettuce), null for intensive crops
 * @param gridSize - Bed's grid size (e.g., 3")
 * @returns Grid Y coordinate (0-indexed)
 *
 * @example
 * // Intensive crop (null spacing) - rows map directly to grid
 * physicalRowToGridY(1, null, 3) // 0
 * physicalRowToGridY(5, null, 3) // 4
 * // Physical row 1 → gridY = 0
 * physicalRowToGridY(1, 4, 3) // 0
 * // Physical row 2 → gridY = 2 (with 4" spacing on 3" grid, 2 cells per row)
 * physicalRowToGridY(2, 4, 3) // 2
 */
export function physicalRowToGridY(
  physicalRowNumber: number,
  rowSpacingInches: number | null,
  gridSize: number
): number {
  // Intensive crops (no row spacing): rows map directly to grid cells
  if (rowSpacingInches === null || rowSpacingInches === 0) {
    return physicalRowNumber - 1;
  }

  const rowSpacingInCells = Math.ceil(rowSpacingInches / gridSize);
  return (physicalRowNumber - 1) * rowSpacingInCells;
}
