import React, { useMemo } from 'react';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  isToday
} from 'date-fns';
import CalendarDayCell from './CalendarDayCell';
import { PlantingCalendar } from '../../../types';
import { PLANT_DATABASE } from '../../../data/plantDatabase';
import { createDateMarkers, groupMarkersByDate } from './utils';

interface CalendarGridProps {
  currentDate: Date;
  events: PlantingCalendar[];
  onDateClick?: (date: Date) => void;
  onEventClick?: (event: PlantingCalendar) => void;
}

const CalendarGrid: React.FC<CalendarGridProps> = ({ currentDate, events, onDateClick, onEventClick }) => {
  // Calculate the days to display in the calendar grid
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Day names for header
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const dayNamesShort = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  // Group events by date for efficient lookup
  const markersByDate = useMemo(() => {
    const markers = createDateMarkers(events, PLANT_DATABASE);
    return groupMarkersByDate(markers);
  }, [events]);

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

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day) => {
          const isCurrentMonth = isSameMonth(day, currentDate);
          const isTodayDate = isToday(day);
          const dateKey = format(day, 'yyyy-MM-dd');
          const dayMarkers = markersByDate[dateKey] || [];

          return (
            <CalendarDayCell
              key={day.toISOString()}
              date={day}
              isCurrentMonth={isCurrentMonth}
              isToday={isTodayDate}
              markers={dayMarkers}
              onClick={() => handleDayClick(day)}
              onEventClick={onEventClick}
            />
          );
        })}
      </div>
    </div>
  );
};

export default CalendarGrid;
