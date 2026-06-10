import React from 'react';
import { format, addMonths, subMonths, addWeeks, subWeeks, startOfWeek, endOfWeek } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CalendarHeaderProps {
  currentDate: Date;
  onMonthChange: (date: Date) => void;
  /** 'month' (default) steps and titles by month; 'week' by week. */
  mode?: 'month' | 'week';
  /** Simulation-aware "today" for the Today button (real clock fallback). */
  today?: Date;
}

const CalendarHeader: React.FC<CalendarHeaderProps> = ({ currentDate, onMonthChange, mode = 'month', today }) => {
  const isWeek = mode === 'week';

  const handlePrevious = () => {
    onMonthChange(isWeek ? subWeeks(currentDate, 1) : subMonths(currentDate, 1));
  };

  const handleNext = () => {
    onMonthChange(isWeek ? addWeeks(currentDate, 1) : addMonths(currentDate, 1));
  };

  const handleToday = () => {
    onMonthChange(today ?? new Date());
  };

  const title = isWeek
    ? `Week of ${format(startOfWeek(currentDate), 'MMM d')} – ${format(endOfWeek(currentDate), 'MMM d, yyyy')}`
    : format(currentDate, 'MMMM yyyy');

  return (
    <div className="calendar-header flex items-center justify-between mb-6">
      {/* Month/Week Display */}
      <h3 className="text-2xl font-bold text-gray-800">
        {title}
      </h3>

      {/* Navigation Controls */}
      <div className="flex items-center gap-2">
        {/* Previous Button */}
        <button
          onClick={handlePrevious}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          aria-label={isWeek ? 'Previous week' : 'Previous month'}
        >
          <ChevronLeft className="w-5 h-5 text-gray-600" />
        </button>

        {/* Today Button */}
        <button
          onClick={handleToday}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
        >
          Today
        </button>

        {/* Next Button */}
        <button
          onClick={handleNext}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          aria-label={isWeek ? 'Next week' : 'Next month'}
        >
          <ChevronRight className="w-5 h-5 text-gray-600" />
        </button>
      </div>
    </div>
  );
};

export default CalendarHeader;
