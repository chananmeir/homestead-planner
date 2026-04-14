import React from 'react';
import { useToday } from '../../contexts/SimulationContext';

export type DateFilterMode = 'single';

export interface DateFilterValue {
  mode: DateFilterMode;
  date: string; // ISO date string (YYYY-MM-DD)
}

interface DateFilterProps {
  value: DateFilterValue;
  onChange: (value: DateFilterValue) => void;
}

/**
 * DateFilter component for filtering garden views by date
 * Simplified to show a single date with a quick "Today" button
 */
export const DateFilter: React.FC<DateFilterProps> = ({ value, onChange }) => {
  const today = useToday();

  const handleDateChange = (date: string) => {
    onChange({ mode: 'single', date });
  };

  const handleTodayClick = () => {
    onChange({ mode: 'single', date: today });
  };

  const isToday = value.date === today;

  return (
    <div className="flex items-center gap-1.5">
      <input
        type="date"
        value={value.date || ''}
        onChange={(e) => handleDateChange(e.target.value)}
        className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
      />
      <button
        onClick={handleTodayClick}
        disabled={isToday}
        className={`px-2 py-1 rounded font-medium text-xs transition-colors ${
          isToday
            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
            : 'bg-green-600 hover:bg-green-700 text-white'
        }`}
      >
        Today
      </button>
    </div>
  );
};
