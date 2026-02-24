import React from 'react';

export interface SortOption {
  value: string;
  label: string;
}

export type SortDirection = 'asc' | 'desc';

interface SortDropdownProps {
  options: SortOption[];
  sortBy: string;
  sortDirection: SortDirection;
  onSortChange: (sortBy: string, direction: SortDirection) => void;
  className?: string;
}

export const SortDropdown: React.FC<SortDropdownProps> = ({
  options,
  sortBy,
  sortDirection,
  onSortChange,
  className = '',
}) => {
  const handleSortByChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onSortChange(e.target.value, sortDirection);
  };

  const toggleDirection = () => {
    const newDirection = sortDirection === 'asc' ? 'desc' : 'asc';
    onSortChange(sortBy, newDirection);
  };

  const currentOption = options.find(opt => opt.value === sortBy);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Sort By Label */}
      <label htmlFor="sort-by" className="text-sm font-medium text-gray-700 whitespace-nowrap">
        Sort by:
      </label>

      {/* Sort Field Selector */}
      <select
        id="sort-by"
        value={sortBy}
        onChange={handleSortByChange}
        className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent bg-white text-sm"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {/* Direction Toggle Button */}
      <button
        type="button"
        onClick={toggleDirection}
        className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 focus:ring-2 focus:ring-green-500 focus:outline-none transition-colors"
        title={`Sort ${currentOption?.label || 'items'} ${sortDirection === 'asc' ? 'descending' : 'ascending'}`}
        aria-label={`Toggle sort direction. Currently ${sortDirection === 'asc' ? 'ascending' : 'descending'}`}
      >
        {sortDirection === 'asc' ? (
          <svg
            className="w-5 h-5 text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12"
            />
          </svg>
        ) : (
          <svg
            className="w-5 h-5 text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M3 4h13M3 8h9m-9 4h9m5-4v12m0 0l-4-4m4 4l4-4"
            />
          </svg>
        )}
      </button>
    </div>
  );
};
