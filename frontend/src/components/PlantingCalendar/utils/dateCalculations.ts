import { addDays, addWeeks } from 'date-fns';
import { Plant } from '../../../types';

/**
 * Calculates planting dates based on a plant's requirements and a base date (typically last frost date).
 * Returns seed start, transplant, and expected harvest dates.
 */
export const calculatePlantingDates = (plant: Plant, baseDate: Date = new Date()) => {
  const seedStartDate = addWeeks(baseDate, -plant.transplantWeeksBefore);
  const transplantDate = addDays(baseDate, plant.transplantWeeksBefore * 7);
  const expectedHarvestDate = addDays(transplantDate, plant.daysToMaturity);

  return {
    seedStartDate,
    transplantDate,
    expectedHarvestDate,
  };
};
