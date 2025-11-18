import React from 'react';
import { format, addMonths, subMonths } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface CalendarHeaderProps {
  currentDate: Date;
  onMonthChange: (date: Date) => void;
}

const CalendarHeader: React.FC<CalendarHeaderProps> = ({ currentDate, onMonthChange }) => {
  const handlePreviousMonth = () => {
    onMonthChange(subMonths(currentDate, 1));
  };

  const handleNextMonth = () => {
    onMonthChange(addMonths(currentDate, 1));
  };

  const handleToday = () => {
    onMonthChange(new Date());
  };

  return (
    <div className="calendar-header flex items-center justify-between mb-6">
      {/* Month/Year Display */}
      <h3 className="text-2xl font-bold text-gray-800">
        {format(currentDate, 'MMMM yyyy')}
      </h3>

      {/* Navigation Controls */}
      <div className="flex items-center gap-2">
        {/* Previous Month Button */}
        <button
          onClick={handlePreviousMonth}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          aria-label="Previous month"
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

        {/* Next Month Button */}
        <button
          onClick={handleNextMonth}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          aria-label="Next month"
        >
          <ChevronRight className="w-5 h-5 text-gray-600" />
        </button>
      </div>
    </div>
  );
};

export default CalendarHeader;
