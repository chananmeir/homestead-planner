import { PlantingCalendar } from '../types';

export type EventDetailsMap = Record<string, unknown>;

export const parseEventDetails = (
  eventDetails: PlantingCalendar['eventDetails']
): EventDetailsMap => {
  if (!eventDetails) return {};

  if (typeof eventDetails === 'string') {
    try {
      const parsed = JSON.parse(eventDetails);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
        ? parsed as EventDetailsMap
        : {};
    } catch {
      return {};
    }
  }

  return typeof eventDetails === 'object' && !Array.isArray(eventDetails)
    ? eventDetails as EventDetailsMap
    : {};
};

export const getEventDetail = <T = unknown>(
  details: EventDetailsMap,
  ...keys: string[]
): T | undefined => {
  for (const key of keys) {
    const value = details[key];
    if (value !== undefined && value !== null && value !== '') {
      return value as T;
    }
  }
  return undefined;
};
