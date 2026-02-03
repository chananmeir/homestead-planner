import { format, addWeeks } from 'date-fns';
import { PlantingCalendar, Plant } from '../../../types';

export type EventMarkerType = 'seed-start' | 'transplant' | 'direct-seed' | 'harvest' | 'mulch-application' | 'maple-tapping';

export interface DateMarker {
  date: Date;
  type: EventMarkerType;
  event: PlantingCalendar;
}

export interface GroupedDateMarker {
  date: Date;
  type: EventMarkerType;
  plantId: string;
  variety?: string;
  gardenBedId?: number;
  events: PlantingCalendar[];  // Array of all events in this group
  count: number;                // How many events
}

export type DateMarkerOrGroup = DateMarker | GroupedDateMarker;

/**
 * Type guard to check if a marker is a grouped marker
 */
export function isGroupedMarker(marker: DateMarkerOrGroup): marker is GroupedDateMarker {
  return 'events' in marker && Array.isArray((marker as GroupedDateMarker).events);
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
 * Expands planting events into date markers for calendar display, grouping similar events.
 * Each event can have multiple dates (seed start, transplant, direct seed, harvest),
 * and this function creates a marker for each date, then groups identical plantings.
 *
 * Grouping logic: Events with same plant + variety + bed + date + type are grouped together
 */
export const createDateMarkers = (events: PlantingCalendar[], plants: Plant[]): DateMarkerOrGroup[] => {
  // Step 1: Create all individual markers (same as before)
  const allMarkers: DateMarker[] = events.flatMap(event => {
    const markers: DateMarker[] = [];

    // Handle different event types
    if (event.eventType === 'mulch') {
      // MULCH EVENT - use expectedHarvestDate as application date
      const applicationDate = toSafeDate(event.expectedHarvestDate);
      if (applicationDate) {
        markers.push({
          date: applicationDate,
          type: 'mulch-application',
          event
        });
      }
    } else if (event.eventType === 'maple-tapping') {
      // MAPLE TAPPING EVENT - use expectedHarvestDate as tapping date
      const tappingDate = toSafeDate(event.expectedHarvestDate);
      if (tappingDate) {
        markers.push({
          date: tappingDate,
          type: 'maple-tapping',
          event
        });
      }
    } else {
      // PLANTING EVENT - existing logic
      // Calculate seed start date with fallback
      let seedStartDate = toSafeDate(event.seedStartDate);

      // If missing, calculate from transplant date
      if (!seedStartDate && event.transplantDate) {
        const transplantDate = toSafeDate(event.transplantDate);
        const plant = plants.find(p => p.id === event.plantId);
        if (plant?.transplantWeeksBefore && transplantDate) {
          seedStartDate = addWeeks(transplantDate, -plant.transplantWeeksBefore);
        }
      }

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
    }

    return markers;
  });

  // Step 2: Group markers by date + type + plantId + variety + bedId
  const grouped = allMarkers.reduce((acc, marker) => {
    const dateKey = format(marker.date, 'yyyy-MM-dd');
    const groupKey = `${dateKey}_${marker.type}_${marker.event.plantId}_${marker.event.variety || 'none'}_${marker.event.gardenBedId || 'none'}`;

    if (!acc[groupKey]) {
      acc[groupKey] = [];
    }
    acc[groupKey].push(marker);
    return acc;
  }, {} as Record<string, DateMarker[]>);

  // Step 3: Convert groups to GroupedDateMarker or keep as DateMarker
  return Object.values(grouped).map(markersInGroup => {
    if (markersInGroup.length === 1) {
      // Single event - return as-is
      return markersInGroup[0];
    } else {
      // Multiple events - create grouped marker
      const first = markersInGroup[0];
      return {
        date: first.date,
        type: first.type,
        plantId: first.event.plantId,
        variety: first.event.variety,
        gardenBedId: first.event.gardenBedId,
        events: markersInGroup.map(m => m.event),
        count: markersInGroup.length,
      } as GroupedDateMarker;
    }
  });
};

/**
 * Groups date markers by date (yyyy-MM-dd format) for calendar grid display.
 */
export const groupMarkersByDate = (markers: DateMarkerOrGroup[]): Record<string, DateMarkerOrGroup[]> => {
  return markers.reduce((acc, marker) => {
    const dateKey = format(marker.date, 'yyyy-MM-dd');
    if (!acc[dateKey]) {
      acc[dateKey] = [];
    }
    acc[dateKey].push(marker);
    return acc;
  }, {} as Record<string, DateMarkerOrGroup[]>);
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
    'mulch-application': '🛡️',
    'maple-tapping': '🍁',
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
    'mulch-application': 'Apply Mulch',
    'maple-tapping': 'Tap Maple Tree',
  };

  return labelMap[type];
};
