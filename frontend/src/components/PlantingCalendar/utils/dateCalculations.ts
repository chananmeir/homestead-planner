import { addDays, addWeeks } from 'date-fns';
import { Plant } from '../../../types';

/**
 * Calculates planting dates based on a plant's requirements and a base date (typically last frost date).
 *
 * For TRANSPLANT method:
 *   - seedStartDate: When to start seeds indoors (baseDate - transplantWeeksBefore)
 *   - transplantDate: When to transplant outdoors (baseDate)
 *   - expectedHarvestDate: When to expect harvest (transplantDate + daysToMaturity)
 *
 * For SEED (direct seed) method:
 *   - directSeedDate: When to sow seeds directly in garden (baseDate)
 *   - expectedHarvestDate: When to expect harvest (directSeedDate + daysToMaturity)
 *
 * @param plant - Plant with transplantWeeksBefore and daysToMaturity
 * @param baseDate - Base date (typically last frost date or user-selected date)
 * @param plantingMethod - 'seed' for direct seeding, 'transplant' for indoor start + transplant
 * @returns Object with relevant dates based on planting method
 */
export const calculatePlantingDates = (
  plant: Plant,
  baseDate: Date = new Date(),
  plantingMethod: 'seed' | 'transplant' = 'transplant'
) => {
  if (plantingMethod === 'transplant') {
    // For transplants: start seeds indoors earlier, then move outdoors
    const seedStartDate = addWeeks(baseDate, -plant.transplantWeeksBefore);
    const transplantDate = baseDate;
    const expectedHarvestDate = addDays(transplantDate, plant.daysToMaturity);

    return {
      seedStartDate,
      transplantDate,
      directSeedDate: undefined,
      expectedHarvestDate,
    };
  } else {
    // For direct seeding: sow seeds directly in garden
    const directSeedDate = baseDate;
    const expectedHarvestDate = addDays(directSeedDate, plant.daysToMaturity);

    return {
      seedStartDate: undefined,
      transplantDate: undefined,
      directSeedDate,
      expectedHarvestDate,
    };
  }
};
