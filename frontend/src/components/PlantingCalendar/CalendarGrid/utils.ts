import { format } from 'date-fns';
import { PlantingCalendar } from '../../../types';

export type EventMarkerType = 'seed-start' | 'transplant' | 'direct-seed' | 'harvest';

export interface DateMarker {
  date: Date;
  type: EventMarkerType;
  event: PlantingCalendar;
}

/**
 * Safely converts a Date, string, or undefined value to a Date object.
 * Returns null for invalid or missing dates.
 */
export const toSafeDate = (dateValue: Date | string | undefined | null): Date | null => {
  if (!dateValue) return null;

  if (dateValue instanceof Date) {
    return isNaN(dateValue.getTime()) ? null : dateValue;
  }

  try {
    const parsed = new Date(dateValue);
    return isNaN(parsed.getTime()) ? null : parsed;
  } catch {
    return null;
  }
};

/**
 * Expands planting events into individual date markers for calendar display.
 * Each event can have multiple dates (seed start, transplant, direct seed, harvest),
 * and this function creates a marker for each date.
 */
export const createDateMarkers = (events: PlantingCalendar[]): DateMarker[] => {
  return events.flatMap(event => {
    const markers: DateMarker[] = [];

    const seedStartDate = toSafeDate(event.seedStartDate);
    if (seedStartDate) {
      markers.push({
        date: seedStartDate,
        type: 'seed-start',
        event
      });
    }

    const transplantDate = toSafeDate(event.transplantDate);
    if (transplantDate) {
      markers.push({
        date: transplantDate,
        type: 'transplant',
        event
      });
    }

    const directSeedDate = toSafeDate(event.directSeedDate);
    if (directSeedDate) {
      markers.push({
        date: directSeedDate,
        type: 'direct-seed',
        event
      });
    }

    const expectedHarvestDate = toSafeDate(event.expectedHarvestDate);
    if (expectedHarvestDate) {
      markers.push({
        date: expectedHarvestDate,
        type: 'harvest',
        event
      });
    }

    return markers;
  });
};

/**
 * Groups date markers by date (yyyy-MM-dd format) for calendar grid display.
 */
export const groupMarkersByDate = (markers: DateMarker[]): Record<string, DateMarker[]> => {
  return markers.reduce((acc, marker) => {
    const dateKey = format(marker.date, 'yyyy-MM-dd');
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(marker);
    return acc;
  }, {} as Record<string, DateMarker[]>);
};

/**
 * Gets the color class for a plant category.
 */
export const getCategoryColor = (category: string): string => {
  const colorMap: Record<string, string> = {
    'vegetable': 'bg-green-500',
    'herb': 'bg-purple-500',
    'fruit': 'bg-red-500',
    'flower': 'bg-pink-500',
    'cover-crop': 'bg-amber-700',
  };

  return colorMap[category] || 'bg-gray-500';
};

/**
 * Gets the icon for an event marker type.
 */
export const getEventIcon = (type: EventMarkerType): string => {
  const iconMap: Record<EventMarkerType, string> = {
    'seed-start': '🌱',
    'transplant': '🌿',
    'direct-seed': '🥕',
    'harvest': '🎉',
  };

  return iconMap[type];
};

/**
 * Gets a human-readable label for an event marker type.
 */
export const getEventLabel = (type: EventMarkerType): string => {
  const labelMap: Record<EventMarkerType, string> = {
    'seed-start': 'Start Seeds',
    'transplant': 'Transplant',
    'direct-seed': 'Direct Seed',
    'harvest': 'Harvest',
  };

  return labelMap[type];
};
