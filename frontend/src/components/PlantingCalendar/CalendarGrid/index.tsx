import React, { useMemo, useCallback } from 'react';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isToday,
  parseISO
} from 'date-fns';
import { DndContext, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import CalendarDayCell, { MarkerQuickActions } from './CalendarDayCell';
import { PlantingCalendar } from '../../../types';
import { PLANT_DATABASE } from '../../../data/plantDatabase';
import { apiPut, apiPost } from '../../../utils/api';
import { useToast } from '../../common/Toast';
import {
  createDateMarkers,
  groupMarkersByDate,
  getDateFieldForMarkerType,
  getMarkerEvents,
  getEventLabel,
  buildSuccessionIndex,
  DateMarkerOrGroup,
  CalendarAttention,
  DayWeatherFlags,
} from './utils';

interface CalendarGridProps {
  currentDate: Date;
  events: PlantingCalendar[];
  coldWarnings?: Record<string, 'too_cold' | 'marginal' | 'too_hot'>;
  /** Simulation-aware "today" (yyyy-MM-dd). Falls back to the real clock when absent. */
  todayStr?: string;
  /** 'month' (default) renders the full month; 'week' renders one tall 7-day row. */
  mode?: 'month' | 'week';
  /** yyyy-MM-dd → forecast flags for the frost/rain strip on day cells. */
  weatherByDate?: Record<string, DayWeatherFlags>;
  /** Dashboard-parity attention sets (harvest-ready / missed). */
  attention?: CalendarAttention;
  onDateClick?: (date: Date) => void;
  onEventClick?: (event: PlantingCalendar) => void;
  onEventUpdated?: () => void;
}

const CalendarGrid: React.FC<CalendarGridProps> = ({ currentDate, events, coldWarnings, todayStr, mode = 'month', weatherByDate, attention, onDateClick, onEventClick, onEventUpdated }) => {
  const { showSuccess, showError } = useToast();
  const isWeek = mode === 'week';

  // Calculate the days to display: the full month grid, or a single week row.
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = isWeek ? startOfWeek(currentDate) : startOfWeek(monthStart);
  const calendarEnd = isWeek ? endOfWeek(currentDate) : endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // eventId → succession-series position for "k/N" badges and series color bars.
  const successionIndex = useMemo(() => buildSuccessionIndex(events), [events]);

  // Day names for header
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayNamesShort = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  // Group events by date for efficient lookup
  const markersByDate = useMemo(() => {
    const markers = createDateMarkers(events, PLANT_DATABASE);
    return groupMarkersByDate(markers);
  }, [events]);

  // Drag starts only after 6px of movement so plain clicks still open modals.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const describeMarker = (marker: DateMarkerOrGroup): string => {
    const eventsList = getMarkerEvents(marker);
    const first = eventsList[0];
    const plant = PLANT_DATABASE.find(p => p.id === first?.plantId);
    const name = plant?.name || first?.plantId || 'event';
    const label = getEventLabel(marker.type).toLowerCase();
    const countSuffix = eventsList.length > 1 ? ` (${eventsList.length} plantings)` : '';
    return `${name} ${label}${countSuffix}`;
  };

  /**
   * Reschedule the marker's date field to newDate for every event it represents.
   * The backend PUT re-validates conflicts and answers 409 with details.
   */
  const rescheduleMarker = useCallback(async (marker: DateMarkerOrGroup, newDate: string) => {
    const field = getDateFieldForMarkerType(marker.type);
    const eventsList = getMarkerEvents(marker);
    try {
      const responses = await Promise.all(
        eventsList.map(e => apiPut(`/api/planting-events/${e.id}`, { [field]: newDate }))
      );
      const conflict = responses.find(r => r.status === 409);
      const failed = responses.find(r => !r.ok && r.status !== 409);
      if (conflict) {
        let message = 'Conflict with another planting at the new date.';
        try {
          const body = await conflict.json();
          message = body.message || body.error || message;
        } catch { /* keep default */ }
        showError(`Could not move ${describeMarker(marker)}: ${message}`);
      } else if (failed) {
        showError(`Failed to move ${describeMarker(marker)}.`);
      } else {
        showSuccess(`Moved ${describeMarker(marker)} to ${format(parseISO(newDate), 'MMM d')}.`);
      }
    } catch (err) {
      console.error('Failed to reschedule event(s):', err);
      showError(`Failed to move ${describeMarker(marker)}.`);
    } finally {
      onEventUpdated?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onEventUpdated, showSuccess, showError]);

  const handleDragEnd = useCallback((dragEnd: DragEndEvent) => {
    const marker = dragEnd.active?.data?.current?.marker as DateMarkerOrGroup | undefined;
    const targetDate = dragEnd.over?.id as string | undefined;
    if (!marker || !targetDate) return;
    const currentKey = format(marker.date, 'yyyy-MM-dd');
    if (targetDate === currentKey) return; // dropped on its own day
    rescheduleMarker(marker, targetDate);
  }, [rescheduleMarker]);

  const quickActions: MarkerQuickActions = useMemo(() => ({
    onReschedule: rescheduleMarker,
    onComplete: async (marker) => {
      const eventsList = getMarkerEvents(marker);
      const payload = marker.type === 'harvest' ? { harvestCompleted: true } : { completed: true };
      try {
        const responses = await Promise.all(
          eventsList.map(e => apiPut(`/api/planting-events/${e.id}`, payload))
        );
        if (responses.every(r => r.ok)) {
          showSuccess(`Marked ${describeMarker(marker)} complete.`);
        } else {
          showError(`Failed to complete ${describeMarker(marker)}.`);
        }
      } catch (err) {
        console.error('Failed to complete event(s):', err);
        showError(`Failed to complete ${describeMarker(marker)}.`);
      } finally {
        onEventUpdated?.();
      }
    },
    onSkip: async (marker) => {
      const eventsList = getMarkerEvents(marker);
      try {
        const responses = await Promise.all(
          eventsList.map(e => apiPost(`/api/planting-events/${e.id}/cancel`, {}))
        );
        if (responses.every(r => r.ok)) {
          showSuccess(`Skipped ${describeMarker(marker)} — use "Show skipped" to undo.`);
        } else {
          showError(`Failed to skip ${describeMarker(marker)}.`);
        }
      } catch (err) {
        console.error('Failed to skip event(s):', err);
        showError(`Failed to skip ${describeMarker(marker)}.`);
      } finally {
        onEventUpdated?.();
      }
    },
    onUndoSkip: async (marker) => {
      const eventsList = getMarkerEvents(marker);
      try {
        const responses = await Promise.all(
          eventsList.map(e => apiPost(`/api/planting-events/${e.id}/uncancel`, {}))
        );
        if (responses.every(r => r.ok)) {
          showSuccess(`Restored ${describeMarker(marker)}.`);
        } else {
          showError(`Failed to restore ${describeMarker(marker)}.`);
        }
      } catch (err) {
        console.error('Failed to restore event(s):', err);
        showError(`Failed to restore ${describeMarker(marker)}.`);
      } finally {
        onEventUpdated?.();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [rescheduleMarker, onEventUpdated, showSuccess, showError]);

  const handleDayClick = (date: Date) => {
    if (onDateClick) {
      onDateClick(date);
    }
  };

  return (
    <div className="calendar-grid">
      {/* Day name headers - responsive */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {dayNames.map((day, index) => (
          <div
            key={day}
            className="text-center font-semibold text-gray-700 py-2"
          >
            {/* Full name on desktop, single letter on mobile */}
            <span className="hidden md:inline">{day}</span>
            <span className="md:hidden">{dayNamesShort[index]}</span>
          </div>
        ))}
      </div>

      {/* Calendar grid — DndContext enables drag-to-reschedule between day cells */}
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className={`grid grid-cols-7 gap-1 ${isWeek ? 'items-stretch' : ''}`}>
          {days.map((day) => {
            // Week view shows days from adjacent months at full strength.
            const isCurrentMonth = isWeek ? true : isSameMonth(day, currentDate);
            const dateKey = format(day, 'yyyy-MM-dd');
            // Simulation-aware today when provided; real clock otherwise.
            const isTodayDate = todayStr ? dateKey === todayStr : isToday(day);
            const dayMarkers = markersByDate[dateKey] || [];

            return (
              <div key={day.toISOString()} className={isWeek ? 'min-h-[320px] flex flex-col [&>div]:flex-1' : ''}>
                <CalendarDayCell
                  date={day}
                  isCurrentMonth={isCurrentMonth}
                  isToday={isTodayDate}
                  markers={dayMarkers}
                  coldWarnings={coldWarnings}
                  todayStr={todayStr}
                  quickActions={quickActions}
                  maxVisible={isWeek ? 14 : 5}
                  weather={weatherByDate?.[dateKey] ?? null}
                  successionIndex={successionIndex}
                  attention={attention}
                  onClick={() => handleDayClick(day)}
                  onEventClick={onEventClick}
                  onEventUpdated={onEventUpdated}
                />
              </div>
            );
          })}
        </div>
      </DndContext>
    </div>
  );
};

export default CalendarGrid;
