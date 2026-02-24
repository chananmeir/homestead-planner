import React from 'react';

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
  const handleDateChange = (date: string) => {
    onChange({ mode: 'single', date });
  };

  const handleTodayClick = () => {
    const today = new Date().toISOString().split('T')[0];
    onChange({ mode: 'single', date: today });
  };

  const isToday = value.date === new Date().toISOString().split('T')[0];

  return (
    <div className="bg-white border border-gray-300 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">View Garden On:</h3>
      </div>

      <div className="flex items-center gap-3">
        <input
          type="date"
          value={value.date || ''}
          onChange={(e) => handleDateChange(e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />

        <button
          onClick={handleTodayClick}
          disabled={isToday}
          className={`px-4 py-2 rounded font-medium text-sm transition-colors ${
            isToday
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-green-600 hover:bg-green-700 text-white'
          }`}
        >
          Today
        </button>
      </div>
    </div>
  );
};
