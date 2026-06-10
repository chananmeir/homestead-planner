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
const toSafeDate = (dateValue: Date | string | undefined | null): Date | null => {
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
 * Maps a marker type to the PlantingEvent date field that marker represents.
 * Used by drag-to-reschedule and the quick-reschedule popover so that moving a
 * marker updates the correct date (e.g. dragging a harvest marker moves
 * expectedHarvestDate, not the planting date). Mulch/maple events store their
 * application date in expectedHarvestDate by convention.
 */
export type ReschedulableDateField =
  | 'seedStartDate'
  | 'transplantDate'
  | 'directSeedDate'
  | 'expectedHarvestDate';

export const getDateFieldForMarkerType = (type: EventMarkerType): ReschedulableDateField => {
  switch (type) {
    case 'seed-start':
      return 'seedStartDate';
    case 'transplant':
      return 'transplantDate';
    case 'direct-seed':
      return 'directSeedDate';
    case 'harvest':
    case 'mulch-application':
    case 'maple-tapping':
      return 'expectedHarvestDate';
  }
};

/**
 * Returns the events represented by a marker (1 for a single marker, N for a group).
 */
export const getMarkerEvents = (marker: DateMarkerOrGroup): PlantingCalendar[] => {
  return isGroupedMarker(marker) ? marker.events : [marker.event];
};

/**
 * True when every event behind the marker is soft-cancelled ("skipped").
 */
export const isMarkerSkipped = (marker: DateMarkerOrGroup): boolean => {
  const events = getMarkerEvents(marker);
  return events.length > 0 && events.every(e => e.cancelledAt != null);
};

// ---------------------------------------------------------------------------
// Succession-series awareness
// ---------------------------------------------------------------------------

export interface SuccessionInfo {
  /** 1-based position of the event within its succession series (by plant date). */
  index: number;
  total: number;
  /** Stable palette index derived from the group id (for the series color bar). */
  colorIdx: number;
}

/** Tailwind border-color classes used to visually link a succession series. */
export const SUCCESSION_PALETTE = [
  'border-l-cyan-300',
  'border-l-fuchsia-300',
  'border-l-lime-300',
  'border-l-orange-300',
  'border-l-sky-300',
  'border-l-rose-300',
  'border-l-yellow-300',
  'border-l-violet-300',
];

/** Deterministic tiny string hash → palette slot (stable across renders/sessions). */
export const successionColorIdx = (groupId: string): number => {
  let hash = 0;
  for (let i = 0; i < groupId.length; i++) {
    hash = (hash * 31 + groupId.charCodeAt(i)) | 0; // eslint-disable-line no-bitwise
  }
  return Math.abs(hash) % SUCCESSION_PALETTE.length;
};

/**
 * Builds eventId → SuccessionInfo for every event that belongs to a succession
 * series (2+ events sharing a successionGroupId). Series order follows the
 * primary planting date (direct seed → transplant → seed start fallback).
 */
export const buildSuccessionIndex = (events: PlantingCalendar[]): Map<number, SuccessionInfo> => {
  const groups = new Map<string, PlantingCalendar[]>();
  for (const event of events) {
    if (!event.successionGroupId) continue;
    const list = groups.get(event.successionGroupId) || [];
    list.push(event);
    groups.set(event.successionGroupId, list);
  }

  const primaryDate = (e: PlantingCalendar): number => {
    const d = toSafeDate(e.directSeedDate) || toSafeDate(e.transplantDate)
      || toSafeDate(e.seedStartDate) || toSafeDate(e.expectedHarvestDate);
    return d ? d.getTime() : Number.MAX_SAFE_INTEGER;
  };

  const result = new Map<number, SuccessionInfo>();
  groups.forEach((list, groupId) => {
    if (list.length < 2) return; // a "series" of one isn't worth badging
    const sorted = [...list].sort((a, b) => primaryDate(a) - primaryDate(b));
    const colorIdx = successionColorIdx(groupId);
    sorted.forEach((e, i) => {
      result.set(e.id, { index: i + 1, total: sorted.length, colorIdx });
    });
  });
  return result;
};

// ---------------------------------------------------------------------------
// Weather strip (frost / precipitation day flags)
// ---------------------------------------------------------------------------

export interface DayWeatherFlags {
  frost?: boolean;   // low ≤ 32°F
  freeze?: boolean;  // low ≤ 28°F (hard freeze)
  rain?: boolean;    // precipitation ≥ 0.5"
  lowTemp?: number;
  precipitation?: number;
}

/** Thresholds match WeatherAlerts.tsx (frost/freeze) and the dashboard rain alert. */
export const buildWeatherFlags = (day: { lowTemp?: number; precipitation?: number }): DayWeatherFlags | null => {
  const lowTemp = typeof day.lowTemp === 'number' ? day.lowTemp : undefined;
  const precipitation = typeof day.precipitation === 'number' ? day.precipitation : undefined;
  const frost = lowTemp !== undefined && lowTemp <= 32;
  const freeze = lowTemp !== undefined && lowTemp <= 28;
  const rain = precipitation !== undefined && precipitation >= 0.5;
  if (!frost && !rain) return null;
  return { frost, freeze, rain, lowTemp, precipitation };
};

// ---------------------------------------------------------------------------
// Dashboard-parity attention overlays
// ---------------------------------------------------------------------------

export interface CalendarAttention {
  /** PlantingEvent ids the dashboard reports as ready to harvest. */
  harvestReady: Set<number>;
  /** Event ids in the dashboard "missed" buckets, keyed by the marker type they affect. */
  missed: Partial<Record<'seed-start' | 'transplant' | 'direct-seed', Set<number>>>;
}

export type MarkerAttention = 'harvest-ready' | 'missed';

/**
 * Maps a marker to its dashboard attention state, if any. Harvest markers glow
 * when the dashboard says the planting is ready; start/transplant/seed markers
 * pick up the dashboard's "missed" classification.
 */
export const getMarkerAttention = (
  marker: DateMarkerOrGroup,
  attention?: CalendarAttention
): MarkerAttention | undefined => {
  if (!attention) return undefined;
  const events = getMarkerEvents(marker);

  if (marker.type === 'harvest') {
    return events.some(e => attention.harvestReady.has(e.id)) ? 'harvest-ready' : undefined;
  }
  if (marker.type === 'seed-start' || marker.type === 'transplant' || marker.type === 'direct-seed') {
    const missedSet = attention.missed[marker.type];
    if (missedSet && events.some(e => missedSet.has(e.id))) return 'missed';
  }
  return undefined;
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
