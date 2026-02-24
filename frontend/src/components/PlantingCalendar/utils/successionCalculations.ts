import { Plant } from '../../../types';

/**
 * Succession interval suggestion result
 */
export interface IntervalSuggestion {
  min: number;
  max: number;
  recommended: number | null;
  reasoning: string;
}

/**
 * Calculate suggested succession planting interval based on plant characteristics
 *
 * Logic:
 * - Quick crops (DTM < 50): interval = DTM × 0.4-0.5 (frequent plantings for continuous harvest)
 * - Medium crops (50-80 days): 14-21 days (standard succession interval)
 * - Long crops (80-120 days): 21-28 days (longer harvest window per plant)
 * - Very long crops (>120 days): 30-45 days or not recommended (typically planted once per season)
 *
 * Category-specific overrides:
 * - Greens (lettuce, spinach, arugula): 10-14 days (frequent harvests needed)
 * - Herbs (basil, cilantro, dill): 14-21 days (cut-and-come-again types)
 * - Root vegetables: 14-21 days
 * - Fruiting crops: 21-28 days
 *
 * @param plant - Plant object with daysToMaturity and category
 * @returns IntervalSuggestion with min, max, recommended intervals and reasoning
 */
export function calculateSuggestedInterval(plant: Plant): IntervalSuggestion {
  const dtm = plant.daysToMaturity;
  const plantName = plant.name.toLowerCase();
  const plantId = plant.id.toLowerCase();

  // Category-specific overrides for greens (frequent succession needed)
  const quickGreens = ['lettuce', 'arugula', 'spinach', 'mesclun', 'microgreens'];
  if (quickGreens.some(green => plantName.includes(green) || plantId.includes(green))) {
    return {
      min: 10,
      max: 14,
      recommended: 10,
      reasoning: `${plant.name} is a fast-growing green that benefits from frequent succession plantings for continuous harvest.`
    };
  }

  // Category-specific overrides for herbs (cut-and-come-again)
  const successionHerbs = ['basil', 'cilantro', 'dill', 'parsley'];
  if (plant.category === 'herb' && successionHerbs.some(herb => plantName.includes(herb) || plantId.includes(herb))) {
    return {
      min: 14,
      max: 21,
      recommended: 14,
      reasoning: `${plant.name} is a cut-and-come-again herb that benefits from regular succession plantings.`
    };
  }

  // Quick crops (< 50 days) - frequent succession for continuous harvest
  if (dtm < 50) {
    const minInterval = Math.max(7, Math.floor(dtm * 0.4));
    const maxInterval = Math.ceil(dtm * 0.5);
    const recommended = Math.round((minInterval + maxInterval) / 2);

    return {
      min: minInterval,
      max: maxInterval,
      recommended,
      reasoning: `Quick-maturing crops like ${plant.name} (${dtm} days) benefit from frequent succession plantings every ${recommended} days for continuous harvest.`
    };
  }

  // Medium crops (50-80 days) - standard succession interval
  if (dtm >= 50 && dtm < 80) {
    return {
      min: 14,
      max: 21,
      recommended: 14,
      reasoning: `${plant.name} (${dtm} days) is well-suited for succession planting every 14-21 days to extend your harvest window.`
    };
  }

  // Longer crops (80-120 days) - less frequent succession
  if (dtm >= 80 && dtm < 120) {
    return {
      min: 21,
      max: 28,
      recommended: 21,
      reasoning: `${plant.name} (${dtm} days) has a longer growing season. Plant every 21-28 days to stagger harvests.`
    };
  }

  // Very long crops (>= 120 days) - typically not suited for succession
  // Exception: Some long-season crops can benefit from early/late season succession
  if (dtm >= 120 && dtm < 200) {
    return {
      min: 30,
      max: 45,
      recommended: 30,
      reasoning: `${plant.name} (${dtm} days) has a very long growing season. Consider early and late season plantings rather than continuous succession.`
    };
  }

  // Perennials and extremely long crops (>= 200 days) - not recommended for succession
  return {
    min: 0,
    max: 0,
    recommended: null,
    reasoning: `${plant.name} (${dtm} days) is typically planted once per season and is not suited for succession planting.`
  };
}

/**
 * Check if a plant is suitable for succession planting
 *
 * @param plant - Plant object
 * @returns true if plant is suitable for succession planting
 */
export function isSuitableForSuccession(plant: Plant): boolean {
  const suggestion = calculateSuggestedInterval(plant);
  return suggestion.recommended !== null && suggestion.recommended > 0;
}

/**
 * Get succession count recommendation based on interval and season length
 *
 * @param intervalDays - Succession interval in days
 * @param seasonLengthDays - Length of growing season (default: 120 days = ~4 months)
 * @returns Recommended number of succession plantings
 */
export function getSuggestedCount(intervalDays: number, seasonLengthDays: number = 120): number {
  if (intervalDays <= 0) return 1;

  // Calculate how many plantings fit in the season
  const maxCount = Math.floor(seasonLengthDays / intervalDays);

  // Cap at reasonable limits
  const minCount = 2;
  const maxRecommended = 10;

  return Math.max(minCount, Math.min(maxCount, maxRecommended));
}

/**
 * Format interval suggestion as user-friendly string
 *
 * @param suggestion - IntervalSuggestion object
 * @returns Formatted string for display
 */
export function formatSuggestion(suggestion: IntervalSuggestion): string {
  if (suggestion.recommended === null || suggestion.recommended === 0) {
    return 'Not recommended for succession planting';
  }

  if (suggestion.min === suggestion.max) {
    return `Recommended: ${suggestion.recommended} days`;
  }

  return `Recommended: ${suggestion.recommended} days (typical range: ${suggestion.min}-${suggestion.max} days)`;
}
