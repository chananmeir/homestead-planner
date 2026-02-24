import { addMonths, startOfMonth, endOfMonth, differenceInDays, format } from 'date-fns';

/**
 * Generate array of month columns for timeline header
 * @param startDate - Starting date for timeline
 * @param monthCount - Number of months to display
 * @returns Array of month objects with label and date
 */
export function getMonthColumns(startDate: Date, monthCount: number) {
  const months = [];
  for (let i = 0; i < monthCount; i++) {
    const monthDate = addMonths(startOfMonth(startDate), i);
    months.push({
      label: format(monthDate, 'MMM yyyy'),
      date: monthDate,
      start: startOfMonth(monthDate),
      end: endOfMonth(monthDate),
    });
  }
  return months;
}

/**
 * Calculate horizontal position of timeline bar
 * @param eventDate - Date of event (plant or start date)
 * @param timelineStart - Start date of timeline display
 * @param monthWidth - Width of one month column in pixels
 * @returns Left position in pixels
 */
export function calculateBarPosition(
  eventDate: Date,
  timelineStart: Date,
  monthWidth: number
): number {
  const daysFromStart = differenceInDays(eventDate, startOfMonth(timelineStart));
  const avgDaysPerMonth = 30.4; // Average days in a month
  return (daysFromStart / avgDaysPerMonth) * monthWidth;
}

/**
 * Calculate width of timeline bar
 * @param duration - Duration in days
 * @param monthWidth - Width of one month column in pixels
 * @returns Width in pixels
 */
export function calculateBarWidth(duration: number, monthWidth: number): number {
  const avgDaysPerMonth = 30.4;
  return (duration / avgDaysPerMonth) * monthWidth;
}

/**
 * Get color for plant category
 * @param category - Plant category (vegetable, herb, fruit, nut)
 * @returns Tailwind CSS color classes
 */
export function getCategoryColor(category: string): {
  bg: string;
  border: string;
  text: string;
} {
  switch (category.toLowerCase()) {
    case 'vegetable':
      return {
        bg: 'bg-green-500',
        border: 'border-green-600',
        text: 'text-green-900',
      };
    case 'herb':
      return {
        bg: 'bg-purple-500',
        border: 'border-purple-600',
        text: 'text-purple-900',
      };
    case 'fruit':
      return {
        bg: 'bg-orange-500',
        border: 'border-orange-600',
        text: 'text-orange-900',
      };
    case 'nut':
      return {
        bg: 'bg-amber-600',
        border: 'border-amber-700',
        text: 'text-amber-900',
      };
    default:
      return {
        bg: 'bg-gray-500',
        border: 'border-gray-600',
        text: 'text-gray-900',
      };
  }
}

/**
 * Get the primary planting date (for bar start position)
 * Prefers: transplantDate > directSeedDate > seedStartDate
 * @param event - Planting calendar event
 * @returns Primary planting date
 */
export function getPrimaryPlantingDate(event: {
  transplantDate?: Date;
  directSeedDate?: Date;
  seedStartDate?: Date;
}): Date | null {
  if (event.transplantDate) return event.transplantDate;
  if (event.directSeedDate) return event.directSeedDate;
  if (event.seedStartDate) return event.seedStartDate;
  return null;
}

/**
 * Calculate duration from plant date to harvest date
 * @param plantDate - Date plant is seeded/transplanted
 * @param harvestDate - Expected harvest date
 * @returns Duration in days
 */
export function calculateDuration(plantDate: Date, harvestDate: Date): number {
  return differenceInDays(harvestDate, plantDate);
}

/**
 * Format date range for display
 * @param startDate - Start date
 * @param endDate - End date
 * @returns Formatted date range string
 */
export function formatDateRange(startDate: Date, endDate: Date): string {
  return `${format(startDate, 'MMM d')} - ${format(endDate, 'MMM d, yyyy')}`;
}
