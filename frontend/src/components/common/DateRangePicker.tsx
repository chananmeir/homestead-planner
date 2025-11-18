import React, { useState } from 'react';

export interface DateRange {
  startDate: string | null; // ISO date string
  endDate: string | null;   // ISO date string
}

interface DateRangePickerProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
  label?: string;
  className?: string;
}

export const DateRangePicker: React.FC<DateRangePickerProps> = ({
  value,
  onChange,
  label = 'Date Range',
  className = '',
}) => {
  const [showPresets, setShowPresets] = useState(false);

  const formatDateForInput = (isoDate: string | null): string => {
    if (!isoDate) return '';
    return isoDate.split('T')[0]; // Convert ISO to YYYY-MM-DD
  };

  const handleStartChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({
      ...value,
      startDate: e.target.value || null,
    });
  };

  const handleEndChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({
      ...value,
      endDate: e.target.value || null,
    });
  };

  const handlePreset = (preset: string) => {
    const today = new Date();
    const endDate = today.toISOString().split('T')[0];
    let startDate: string;

    switch (preset) {
      case 'today':
        startDate = endDate;
        break;
      case 'week': {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        startDate = weekAgo.toISOString().split('T')[0];
        break;
      }
      case 'month': {
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        startDate = monthAgo.toISOString().split('T')[0];
        break;
      }
      case '3months': {
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        startDate = threeMonthsAgo.toISOString().split('T')[0];
        break;
      }
      case 'year': {
        const yearAgo = new Date();
        yearAgo.setFullYear(yearAgo.getFullYear() - 1);
        startDate = yearAgo.toISOString().split('T')[0];
        break;
      }
      case 'all':
        onChange({ startDate: null, endDate: null });
        setShowPresets(false);
        return;
      default:
        return;
    }

    onChange({ startDate, endDate });
    setShowPresets(false);
  };

  const handleClear = () => {
    onChange({ startDate: null, endDate: null });
  };

  const hasValue = value.startDate || value.endDate;

  return (
    <div className={`space-y-2 ${className}`}>
      <label className="block text-sm font-medium text-gray-700">
        {label}
      </label>

      <div className="flex flex-wrap gap-2 items-center">
        {/* Start Date */}
        <div className="flex items-center gap-2">
          <label htmlFor="start-date" className="text-sm text-gray-600">
            From:
          </label>
          <input
            id="start-date"
            type="date"
            value={formatDateForInput(value.startDate)}
            onChange={handleStartChange}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
          />
        </div>

        {/* End Date */}
        <div className="flex items-center gap-2">
          <label htmlFor="end-date" className="text-sm text-gray-600">
            To:
          </label>
          <input
            id="end-date"
            type="date"
            value={formatDateForInput(value.endDate)}
            onChange={handleEndChange}
            min={formatDateForInput(value.startDate)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent text-sm"
          />
        </div>

        {/* Presets Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowPresets(!showPresets)}
            className="px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-700 focus:ring-2 focus:ring-green-500 focus:outline-none transition-colors"
          >
            Presets
          </button>

          {showPresets && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowPresets(false)}
              />

              {/* Dropdown Menu */}
              <div className="absolute z-20 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg min-w-[150px] right-0">
                <div className="py-1">
                  <button
                    type="button"
                    onClick={() => handlePreset('today')}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePreset('week')}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                  >
                    Last 7 days
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePreset('month')}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                  >
                    Last month
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePreset('3months')}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                  >
                    Last 3 months
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePreset('year')}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                  >
                    Last year
                  </button>
                  <div className="border-t border-gray-200 my-1" />
                  <button
                    type="button"
                    onClick={() => handlePreset('all')}
                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                  >
                    All time
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Clear Button */}
        {hasValue && (
          <button
            type="button"
            onClick={handleClear}
            className="px-3 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-300 rounded-lg transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Active Range Display */}
      {hasValue && (
        <p className="text-xs text-gray-600">
          {value.startDate && value.endDate ? (
            <>
              Showing from{' '}
              <span className="font-medium">
                {new Date(value.startDate).toLocaleDateString()}
              </span>{' '}
              to{' '}
              <span className="font-medium">
                {new Date(value.endDate).toLocaleDateString()}
              </span>
            </>
          ) : value.startDate ? (
            <>
              Showing from{' '}
              <span className="font-medium">
                {new Date(value.startDate).toLocaleDateString()}
              </span>{' '}
              onwards
            </>
          ) : (
            <>
              Showing up to{' '}
              <span className="font-medium">
                {new Date(value.endDate!).toLocaleDateString()}
              </span>
            </>
          )}
        </p>
      )}
    </div>
  );
};
