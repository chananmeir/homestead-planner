import React from 'react';

export interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

export interface FilterGroup {
  id: string;
  label: string;
  options: FilterOption[];
}

export interface ActiveFilter {
  groupId: string;
  groupLabel: string;
  value: string;
  label: string;
}

interface FilterBarProps {
  filterGroups: FilterGroup[];
  activeFilters: Record<string, string[]>;
  onFilterChange: (groupId: string, values: string[]) => void;
  onClearAll?: () => void;
  className?: string;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  filterGroups,
  activeFilters,
  onFilterChange,
  onClearAll,
  className = '',
}) => {
  const handleFilterToggle = (groupId: string, value: string) => {
    const currentValues = activeFilters[groupId] || [];
    const newValues = currentValues.includes(value)
      ? currentValues.filter(v => v !== value)
      : [...currentValues, value];

    onFilterChange(groupId, newValues);
  };

  const handleRemoveFilter = (groupId: string, value: string) => {
    const currentValues = activeFilters[groupId] || [];
    const newValues = currentValues.filter(v => v !== value);
    onFilterChange(groupId, newValues);
  };

  // Build list of active filters for chip display
  const activeFilterChips: ActiveFilter[] = [];
  Object.entries(activeFilters).forEach(([groupId, values]) => {
    const group = filterGroups.find(g => g.id === groupId);
    if (group && values.length > 0) {
      values.forEach(value => {
        const option = group.options.find(opt => opt.value === value);
        if (option) {
          activeFilterChips.push({
            groupId,
            groupLabel: group.label,
            value,
            label: option.label,
          });
        }
      });
    }
  });

  const hasActiveFilters = activeFilterChips.length > 0;

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Filter Dropdowns */}
      <div className="flex flex-wrap gap-3">
        {filterGroups.map((group) => {
          const activeCount = (activeFilters[group.id] || []).length;

          return (
            <div key={group.id} className="relative">
              <details className="group">
                <summary className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors list-none">
                  <span className="text-sm font-medium text-gray-700">
                    {group.label}
                  </span>
                  {activeCount > 0 && (
                    <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-bold text-white bg-green-600 rounded-full">
                      {activeCount}
                    </span>
                  )}
                  <svg
                    className="w-4 h-4 text-gray-500 transition-transform group-open:rotate-180"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </summary>

                {/* Dropdown Content */}
                <div className="absolute z-10 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg min-w-[200px] max-h-[300px] overflow-y-auto">
                  <div className="p-2 space-y-1">
                    {group.options.map((option) => {
                      const isActive = (activeFilters[group.id] || []).includes(option.value);

                      return (
                        <label
                          key={option.value}
                          className="flex items-center gap-2 px-3 py-2 rounded hover:bg-gray-50 cursor-pointer transition-colors"
                        >
                          <input
                            type="checkbox"
                            checked={isActive}
                            onChange={() => handleFilterToggle(group.id, option.value)}
                            className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500 cursor-pointer"
                          />
                          <span className="text-sm text-gray-700 flex-1">
                            {option.label}
                          </span>
                          {option.count !== undefined && (
                            <span className="text-xs text-gray-500">
                              ({option.count})
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </div>
              </details>
            </div>
          );
        })}

        {/* Clear All Button */}
        {hasActiveFilters && onClearAll && (
          <button
            type="button"
            onClick={onClearAll}
            className="px-4 py-2 text-sm font-medium text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-300 rounded-lg transition-colors"
          >
            Clear All
          </button>
        )}
      </div>

      {/* Active Filter Chips */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-sm font-medium text-gray-600">Active filters:</span>
          {activeFilterChips.map((filter, index) => (
            <span
              key={`${filter.groupId}-${filter.value}-${index}`}
              className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 text-sm rounded-full"
            >
              <span className="font-medium">{filter.groupLabel}:</span>
              <span>{filter.label}</span>
              <button
                type="button"
                onClick={() => handleRemoveFilter(filter.groupId, filter.value)}
                className="ml-1 text-green-600 hover:text-green-800 focus:outline-none"
                aria-label={`Remove ${filter.label} filter`}
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
