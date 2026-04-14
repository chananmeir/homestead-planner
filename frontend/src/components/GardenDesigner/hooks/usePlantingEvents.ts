/**
 * Custom hook for fetching planting events (current + future).
 * Extracted from GardenDesigner.tsx to reduce component complexity.
 */
import { useState, useCallback, useEffect } from 'react';
import { PlantingEvent } from '../../../types';
import { apiGet } from '../../../utils/api';
import { parseLocalDate } from '../../../utils/dateUtils';
import { formatLocalDate } from '../utils/designerHelpers';

interface DateFilterValue {
  mode: string;
  date: string;
}

interface UsePlantingEventsReturn {
  plantingEvents: PlantingEvent[];
  futurePlantingEvents: PlantingEvent[];
  fetchPlantingEvents: () => Promise<void>;
  fetchFuturePlantingEvents: () => Promise<void>;
}

export function usePlantingEvents(dateFilter: DateFilterValue): UsePlantingEventsReturn {
  const [plantingEvents, setPlantingEvents] = useState<PlantingEvent[]>([]);
  const [futurePlantingEvents, setFuturePlantingEvents] = useState<PlantingEvent[]>([]);

  const fetchPlantingEvents = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      params.append('start_date', dateFilter.date);
      params.append('end_date', dateFilter.date);

      const response = await apiGet(`/api/planting-events?${params.toString()}`);
      if (response.ok) {
        const events = await response.json();
        setPlantingEvents(events);
      } else {
        setPlantingEvents([]);
      }
    } catch {
      setPlantingEvents([]);
    }
  }, [dateFilter]);

  const fetchFuturePlantingEvents = useCallback(async () => {
    try {
      const tomorrow = parseLocalDate(dateFilter.date);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const oneYearLater = parseLocalDate(dateFilter.date);
      oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);

      const params = new URLSearchParams();
      params.append('start_date', formatLocalDate(tomorrow));
      params.append('end_date', formatLocalDate(oneYearLater));

      const response = await apiGet(`/api/planting-events?${params.toString()}`);
      if (response.ok) {
        const events = await response.json();
        setFuturePlantingEvents(events);
      } else {
        setFuturePlantingEvents([]);
      }
    } catch {
      setFuturePlantingEvents([]);
    }
  }, [dateFilter.date]);

  // Auto-fetch when date filter changes
  useEffect(() => {
    fetchPlantingEvents();
  }, [fetchPlantingEvents]);

  useEffect(() => {
    fetchFuturePlantingEvents();
  }, [fetchFuturePlantingEvents]);

  return { plantingEvents, futurePlantingEvents, fetchPlantingEvents, fetchFuturePlantingEvents };
}
