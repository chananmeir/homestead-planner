/**
 * Square Foot Gardening (SFG) Spacing Rules
 *
 * This table stores how many plants fit in ONE square foot (12" × 12" cell).
 * Based on Mel Bartholomew's Square Foot Gardening methodology.
 *
 * Example: If carrot = 16, then 16 carrots fit in 1 square foot.
 * To calculate space for N plants: N / plantsPerCell = cells needed
 */

export const SFG_PLANTS_PER_CELL: Record<string, number> = {
  // === 0.5 PLANTS PER SQUARE (need 2 squares per plant) ===
  // Extra-large plants (17" spacing)
  'watermelon': 0.5,
  'watermelon-1': 0.5,
  'melon': 0.5,
  'melon-1': 0.5,
  'cantaloupe': 0.5,
  'cantaloupe-1': 0.5,
  'pumpkin': 0.5,
  'pumpkin-1': 0.5,

  // === 1 PLANT PER SQUARE (12" spacing) ===
  // Large plants
  'tomato': 1,
  'tomato-1': 1,
  'pepper': 1,
  'pepper-1': 1,
  'eggplant': 1,
  'eggplant-1': 1,
  'broccoli': 1,
  'broccoli-1': 1,
  'cauliflower': 1,
  'cauliflower-1': 1,
  'cabbage': 1,
  'cabbage-1': 1,
  'brussels-sprouts': 1,
  'brussels-sprouts-1': 1,
  'kale': 1,
  'kale-1': 1,
  'collards': 1,
  'collards-1': 1,
  'collard': 1,
  'collard-1': 1,
  'cilantro': 1,
  'cilantro-1': 1,
  'squash': 1,
  'squash-1': 1,
  'cucumber': 1,
  'cucumber-1': 1,
  'okra': 1,
  'okra-1': 1,
  'corn': 1,
  'corn-1': 1,
  'celery': 1,
  'celery-1': 1,
  'lettuce-head': 1,
  'lettuce-head-1': 1,
  'lettuce-crisphead': 1,
  'lettuce-crisphead-1': 1,

  // === 4 PLANTS PER SQUARE (6" spacing) ===
  // Medium plants
  'lettuce': 4,
  'lettuce-1': 4,
  'lettuce-leaf': 4,
  'lettuce-leaf-1': 4,
  'lettuce-romaine': 4,
  'lettuce-romaine-1': 4,
  'mustard-greens': 4,
  'mustard-greens-1': 4,
  'bok-choy': 4,
  'bok-choy-1': 4,
  'marigold': 4,
  'marigold-1': 4,
  'nasturtium': 4,
  'nasturtium-1': 4,
  'zinnia': 4,
  'zinnia-1': 4,
  'parsley': 4,
  'parsley-1': 4,
  'chard': 4,
  'chard-1': 4,
  'beet': 4,
  'beet-1': 4,
  'onion': 4,
  'onion-1': 4,
  'shallot': 4,
  'shallot-1': 4,
  'garlic': 4,
  'garlic-1': 4,
  'leek': 4,
  'leek-1': 4,
  'kohlrabi': 4,
  'kohlrabi-1': 4,
  'thyme': 4,
  'thyme-1': 4,

  // === 8 PLANTS PER SQUARE (4.2" spacing) ===
  // Pole/climbing plants (typically vertical/trellis)
  'pea': 8,
  'pea-1': 8,
  'bean-pole': 8,
  'bean-pole-1': 8,

  // === 9 PLANTS PER SQUARE (4" spacing) ===
  // Small plants
  'arugula': 9,
  'arugula-1': 9,
  'turnip': 9,
  'turnip-1': 9,
  'spinach': 9,
  'spinach-1': 9,
  'bush-bean': 9,
  'bush-bean-1': 9,
  'bean': 9,
  'bean-1': 9,
  'asian-greens': 9,
  'asian-greens-1': 9,
  'scallion': 9,
  'scallion-1': 9,

  // === 16 PLANTS PER SQUARE (3" spacing) ===
  // Tiny plants
  'carrot': 16,
  'carrot-1': 16,
  'radish': 16,
  'radish-1': 16,
  'chive': 16,
  'chive-1': 16,
};

/**
 * Get the number of plants that fit in one square foot cell
 *
 * @param plantId - Plant identifier (e.g., 'carrot-1', 'tomato-2')
 * @returns Number of plants per square foot (e.g., 16 for carrots, 1 for tomatoes)
 */
export function getSFGPlantsPerCell(plantId: string): number {
  // Check exact match first
  if (SFG_PLANTS_PER_CELL[plantId] !== undefined) {
    return SFG_PLANTS_PER_CELL[plantId];
  }

  // Check partial matches (e.g., 'tomato-2' matches 'tomato')
  const baseId = plantId.split('-')[0];
  if (SFG_PLANTS_PER_CELL[baseId] !== undefined) {
    return SFG_PLANTS_PER_CELL[baseId];
  }

  // Try matching the base pattern from keys
  for (const [key, value] of Object.entries(SFG_PLANTS_PER_CELL)) {
    const keyBase = key.split('-')[0];
    if (keyBase === baseId) {
      return value;
    }
  }

  // Default: 1 per square for unknown plants (conservative estimate)
  return 1;
}

/**
 * Get the number of grid cells required for a single plant in Square Foot Gardening
 *
 * @param plantId - Plant identifier (e.g., 'tomato-1')
 * @returns Fractional cells per plant (e.g., 0.0625 for carrots, 1 for tomatoes, 2 for watermelons)
 *
 * Example calculations:
 * - Carrot (16 per sq ft): 1 / 16 = 0.0625 cells per plant
 * - Lettuce (4 per sq ft): 1 / 4 = 0.25 cells per plant
 * - Tomato (1 per sq ft): 1 / 1 = 1 cell per plant
 * - Watermelon (0.5 per sq ft): 1 / 0.5 = 2 cells per plant
 */
export function getSFGCellsRequired(plantId: string): number {
  const plantsPerCell = getSFGPlantsPerCell(plantId);
  return 1 / plantsPerCell;
}
